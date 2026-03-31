import { useEffect, useState } from "react";
import { fetchClientConfig, updateClientConfig } from "../services/api";

const EditClientConfigModal = ({ chatbot, onClose }) => {
  const [config, setConfig] = useState({
    demo_message: "",
    demo_link: "",
    default_suggestions: "",
    demo_keywords: "",
    curtom_intro: "",
    // Lead detection keywords
    hot_words: "",
    follow_up_keywords: "",
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (chatbot?._id) {
      fetchClientConfig(chatbot._id)
        .then((res) => {
          const data = res.data?.config || res.data || {};
          const normalize = (value) =>
            Array.isArray(value) && value.length > 0 ? value : [];
          setConfig({
            demo_message: data.demo_message || "",
            demo_link: data.demo_link || "",
            default_suggestions: (data.default_suggestions || []).join(", "),
            demo_keywords: (data.demo_keywords || []).join(", "),
            // Lead detection keywords: use backend defaults (schema-driven)
            hot_words: normalize(data.hot_words).join(", "),
            follow_up_keywords: normalize(data.follow_up_keywords).join(", "),
          });
          setLoading(false); // ✅ correctly placed
        })
        .catch((err) => {
          console.error("Config fetch error", err);
          setLoading(false); // ✅ also good to prevent modal freeze on error
        });
    }
  }, [chatbot]);

  const handleSave = async () => {
    try {
      const payload = {
        demo_message: config.demo_message,
        demo_link: config.demo_link,
        default_suggestions: config.default_suggestions
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        demo_keywords: config.demo_keywords
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        // Lead detection keywords
        hot_words: config.hot_words
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        follow_up_keywords: config.follow_up_keywords
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      };

      await updateClientConfig(chatbot._id, payload);
      alert("✅ Client config updated!");
      onClose();
    } catch (err) {
      console.error("Update error", err);
      alert("❌ Failed to update config");
    }
  };

  if (loading) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 overflow-y-auto py-6">
      <div className="bg-white w-full max-w-lg rounded-xl p-6 relative shadow-xl my-auto">
        <h2 className="text-xl font-semibold mb-4 text-gray-800">
          ✏️ Edit Client Config – {chatbot.name}
        </h2>

        <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
          <div>
            <label className="block font-medium mb-1">Demo Message</label>
            <textarea
              className="w-full p-2 border border-gray-300 rounded"
              rows={3}
              value={config.demo_message}
              onChange={(e) =>
                setConfig({ ...config, demo_message: e.target.value })
              }
            />
          </div>

          <div>
            <label className="block font-medium mb-1">Demo Link</label>
            <input
              type="text"
              className="w-full p-2 border border-gray-300 rounded"
              value={config.demo_link}
              onChange={(e) =>
                setConfig({ ...config, demo_link: e.target.value })
              }
            />
          </div>

          <div>
            <label className="block font-medium mb-1">
              Default Suggestions (comma-separated)
            </label>
            <input
              type="text"
              className="w-full p-2 border border-gray-300 rounded"
              value={config.default_suggestions}
              onChange={(e) =>
                setConfig({ ...config, default_suggestions: e.target.value })
              }
            />
          </div>

          <div>
            <label className="block font-medium mb-1">
              Demo Keywords (comma-separated)
            </label>
            <input
              type="text"
              className="w-full p-2 border border-gray-300 rounded"
              value={config.demo_keywords}
              onChange={(e) =>
                setConfig({ ...config, demo_keywords: e.target.value })
              }
            />
          </div>

          {/* Lead Detection Section */}
          <div className="pt-4 border-t border-gray-300">
            <h3 className="text-lg font-semibold mb-3 text-gray-800 flex items-center gap-2">
              🎯 Lead Detection Keywords
            </h3>
            <p className="text-xs text-gray-600 mb-4 bg-blue-50 p-2 rounded border border-blue-200">
              ℹ️ Default keywords are pre-filled. You can edit them directly (comma-separated)
            </p>

            <div className="space-y-4">
              <div>
                <label className="block font-medium mb-1 text-sm">
                  🔥 Hot Words (comma-separated)
                </label>
                <p className="text-xs text-gray-500 mb-2">
                  Keywords indicating high purchase intent - Edit as needed
                </p>
                <textarea
                  className="w-full p-2 border border-gray-300 rounded text-sm font-mono"
                  rows={4}
                  value={config.hot_words}
                  onChange={(e) =>
                    setConfig({ ...config, hot_words: e.target.value })
                  }
                  placeholder="Enter keywords separated by commas"
                />
              </div>

              <div>
                <label className="block font-medium mb-1 text-sm">
                  📞 Follow-up Keywords (comma-separated)
                </label>
                <p className="text-xs text-gray-500 mb-2">
                  Keywords indicating user wants to be contacted - Edit as needed
                </p>
                <textarea
                  className="w-full p-2 border border-gray-300 rounded text-sm font-mono"
                  rows={4}
                  value={config.follow_up_keywords}
                  onChange={(e) =>
                    setConfig({ ...config, follow_up_keywords: e.target.value })
                  }
                  placeholder="Enter keywords separated by commas"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-4">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-300 hover:bg-gray-400 rounded"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-[#1e3a8a] hover:bg-[#1e40af] text-white rounded-lg shadow-md transition-colors"
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
};

export default EditClientConfigModal;
