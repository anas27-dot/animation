import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Clipboard, ClipboardCheck } from "lucide-react";
import { toast } from "react-toastify";
import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";

const EmailTemplateModal = ({ onClose, template, onSave, onReset }) => {
  const [copied, setCopied] = useState(false);
  const [subject, setSubject] = useState(template?.subject || "");
  const [body, setBody] = useState(template?.body || "");

  useEffect(() => {
    setSubject(template?.subject || "");
    setBody(template?.body || "");
  }, [template]);

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

  const handleCopy = async () => {
    try {
      if (!navigator?.clipboard?.writeText) {
        throw new Error("Clipboard API not available");
      }
      const combined = `Subject: ${subject}\n\n${body}`;
      await navigator.clipboard.writeText(combined);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success("Template copied to clipboard");
    } catch (err) {
      toast.error("Unable to copy template");
      console.error("Clipboard copy failed:", err);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <motion.div
          initial={{ opacity: 0, y: -16, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -16, scale: 0.98 }}
          transition={{ duration: 0.2 }}
          className="relative bg-white rounded-2xl shadow-2xl border border-gray-200 w-full max-w-3xl p-6 md:p-8 space-y-6"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-blue-500 font-semibold mb-1">
                Email Template
              </p>
              <h2 className="text-2xl md:text-3xl font-bold text-[#1e3a8a]">
                New Company Notification
              </h2>
              <p className="text-sm text-gray-600 mt-2">
                Use this template when a company is created. Replace placeholders
                with the form values.
              </p>
            </div>
            <button
              onClick={onClose}
              className="flex items-center justify-center h-9 w-9 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 transition-colors"
              aria-label="Close"
            >
              <X size={18} />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
            <div className="col-span-1 space-y-3">
              <h3 className="text-sm font-semibold text-gray-800">
                Include these fields
              </h3>
              <div className="space-y-2 text-sm text-gray-600">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-blue-500" />
                  Company Name
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-blue-500" />
                  Domain / Login URL
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-blue-500" />
                  Email (login)
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-blue-500" />
                  Username
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-blue-500" />
                  Phone
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-blue-500" />
                  Temporary Password or set-password link
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-blue-500" />
                  Support contact
                </div>
              </div>
            </div>

            <div className="col-span-1 md:col-span-2">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-800">
                  Ready-to-copy draft
                </h3>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      onSave?.({ subject, body });
                      onClose?.();
                    }}
                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#1e3a8a] text-white text-sm font-semibold hover:bg-[#1e40af] transition-colors"
                  >
                    Use template
                  </button>
                  <button
                    onClick={handleCopy}
                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    {copied ? <ClipboardCheck size={16} /> : <Clipboard size={16} />}
                    {copied ? "Copied" : "Copy"}
                  </button>
                  <button
                    onClick={() => {
                      onReset?.();
                      setSubject(template?.subject || "");
                      setBody(template?.body || "");
                      toast.info("Template reset to default");
                    }}
                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    Reset
                  </button>
                </div>
              </div>
              <div className="space-y-3">
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
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default EmailTemplateModal;

