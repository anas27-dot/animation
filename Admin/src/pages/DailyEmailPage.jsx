import { useEffect, useMemo, useState } from "react";
import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";
import { toast } from "react-toastify";
import { format } from "date-fns";
import {
  getDailyEmailTemplate,
  updateDailyEmailTemplate,
  sendDailyEmail,
  fetchDailyEmailLogs,
} from "../services/api";

const defaultTemplate = {
  subject: "Your daily chatbot summary",
  body: `<p>Hi {User Name},</p>
<p>Here is your last 24h summary (6pm–6pm):</p>
<ul>
  <li><strong>Total Chats:</strong> {Total Chats}</li>
  <li><strong>Total Visitors:</strong> {Total Visitors}</li>
  <li><strong>Total Duration:</strong> {Total Duration}</li>
  <li><strong>Credit Balance:</strong> {Credit Balance}</li>
</ul>
<p>View details: {Dashboard URL}</p>
<p>Thanks,<br/>Supa Agent Team</p>`,
};

function DailyEmailPage() {
  const [subject, setSubject] = useState(defaultTemplate.subject);
  const [body, setBody] = useState(defaultTemplate.body);
  const [recipient, setRecipient] = useState("");
  const [formData, setFormData] = useState({
    "User Name": "",
    "Total Chats": "",
    "Total Visitors": "",
    "Total Duration": "",
    "Credit Balance": "",
    "Dashboard URL": "",
  });
  const [logs, setLogs] = useState([]);
  const quillModules = useMemo(
    () => ({
      toolbar: [
        [{ header: [1, 2, false] }],
        ["bold", "italic", "underline", "strike"],
        [{ list: "ordered" }, { list: "bullet" }],
        ["link"],
        ["clean"],
      ],
    }),
    []
  );

  // Load template and logs from backend
  useEffect(() => {
    const load = async () => {
      try {
        const tplRes = await getDailyEmailTemplate();
        const tpl = tplRes?.data?.data || tplRes?.data;
        if (tpl?.subject && tpl?.body) {
          setSubject(tpl.subject);
          setBody(tpl.body);
        }
      } catch (err) {
        console.warn("Failed to load template, using defaults", err);
      }

      try {
        const logsRes = await fetchDailyEmailLogs(50);
        const apiLogs = logsRes?.data?.data?.logs || logsRes?.data?.logs || [];
        setLogs(apiLogs);
      } catch (err) {
        console.warn("Failed to load logs", err);
      }
    };
    load();
  }, []);

  const refreshLogs = async () => {
    try {
      const logsRes = await fetchDailyEmailLogs(50);
      const apiLogs = logsRes?.data?.data?.logs || logsRes?.data?.logs || [];
      setLogs(apiLogs);
    } catch (err) {
      console.warn("Failed to refresh logs", err);
    }
  };

  const handleSave = async () => {
    try {
      await updateDailyEmailTemplate({ subject, body });
      toast.success("Template saved");
    } catch (err) {
      console.error("Save failed", err);
      toast.error(err?.response?.data?.message || "Failed to save template");
    }
  };

  const handleReset = async () => {
    setSubject(defaultTemplate.subject);
    setBody(defaultTemplate.body);
    try {
      await updateDailyEmailTemplate(defaultTemplate);
      toast.info("Template reset to default");
    } catch (err) {
      console.error("Reset failed", err);
      toast.error(err?.response?.data?.message || "Failed to reset template");
    }
  };

  const handleSend = async () => {
    if (!recipient) {
      toast.error("Please enter a recipient email");
      return;
    }
    try {
      await sendDailyEmail({
        to: recipient,
        subject,
        html: body,
        data: formData,
      });
      toast.success("Email sent");
      refreshLogs();
    } catch (err) {
      console.error("Send failed", err);
      toast.error(err?.response?.data?.message || "Failed to send email");
      refreshLogs();
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-blue-500 font-semibold mb-1">
          Daily Email
        </p>
        <h1 className="text-3xl font-bold text-[#1e3a8a]">Send Summary</h1>
        <p className="text-sm text-gray-600">
          Configure the daily 6pm summary email template and review sends.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white shadow-lg border border-gray-200 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                Template
              </h2>
              <p className="text-sm text-gray-500">
                Use placeholders like {"{User Name}"}, {"{Total Chats}"},
                {"{Total Visitors}"}, {"{Total Duration}"},
                {"{Credit Balance}"}, {"{Dashboard URL}"}.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleReset}
                className="px-3 py-1.5 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Reset
              </button>
              <button
                onClick={handleSave}
                className="px-3 py-1.5 rounded-lg bg-[#1e3a8a] text-white text-sm font-semibold hover:bg-[#1e40af]"
              >
                Save
              </button>
            </div>
          </div>

          <div className="space-y-3">
            <input
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              placeholder="Recipient email"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]"
            />
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Email subject"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]"
            />
            <ReactQuill
              theme="snow"
              value={body}
              onChange={setBody}
              modules={quillModules}
              className="bg-white rounded-xl"
            />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {Object.keys(formData).map((key) => (
                <div key={key}>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">
                    {key}
                  </label>
                  <input
                    value={formData[key]}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, [key]: e.target.value }))
                    }
                    placeholder={`Value for ${key}`}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]"
                  />
                </div>
              ))}
            </div>
            <div className="flex justify-end">
              <button
                onClick={handleSend}
                className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700"
              >
                Send Now
              </button>
            </div>
          </div>
        </div>

        <div className="bg-white shadow-lg border border-gray-200 rounded-2xl p-5 space-y-3">
          <h3 className="text-base font-semibold text-gray-900">
            Send schedule
          </h3>
          <p className="text-sm text-gray-600">
            Emails are planned daily at 6:00 PM (server time) with the last 24h
            stats. Configure the template on the left.
          </p>
          <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-sm text-blue-800">
            <div className="font-semibold">Placeholders</div>
            <ul className="list-disc ml-4 space-y-1">
              <li>{"{User Name}"}</li>
              <li>{"{Total Chats}"}</li>
              <li>{"{Total Visitors}"}</li>
              <li>{"{Total Duration}"}</li>
              <li>{"{Credit Balance}"}</li>
              <li>{"{Dashboard URL}"}</li>
            </ul>
          </div>
        </div>
      </div>

      <div className="bg-white shadow-lg border border-gray-200 rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              Send History
            </h3>
            <p className="text-sm text-gray-500">
              Recent emails (from server log).
            </p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left text-gray-700">
            <thead className="bg-gray-100 text-gray-600 uppercase text-xs">
              <tr>
                <th className="px-3 py-2">Recipient</th>
                <th className="px-3 py-2">Subject</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Sent At</th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 && (
                <tr>
                  <td
                    colSpan="4"
                    className="px-3 py-4 text-center text-gray-500"
                  >
                    No sends recorded yet.
                  </td>
                </tr>
              )}
              {logs.map((log) => (
                <tr
                  key={log._id || log.id}
                  className="border-b border-gray-100 hover:bg-gray-50"
                >
                  <td className="px-3 py-2">{log.to || log.recipient}</td>
                  <td className="px-3 py-2 truncate max-w-xs">{log.subject}</td>
                  <td className="px-3 py-2">
                    <span className="inline-flex px-2 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700">
                      {log.status}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-gray-600">
                    {log.createdAt
                      ? format(new Date(log.createdAt), "PP p")
                      : log.sentAt
                      ? format(new Date(log.sentAt), "PP p")
                      : "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default DailyEmailPage;

