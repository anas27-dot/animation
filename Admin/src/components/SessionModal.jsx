import React from "react";

const SessionModal = ({ sessionId, messages, onClose }) => {
  if (!sessionId || !messages) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white shadow-xl rounded-3xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col border border-gray-200">
        {/* Header */}
        <div className="px-8 py-5 border-b bg-gradient-to-r from-blue-700 to-indigo-700 text-white flex items-center justify-between">
          <h2 className="text-xl font-semibold tracking-wide">
            📧 Identity: <span className="font-mono text-base">{sessionId}</span>
          </h2>
          <button
            onClick={onClose}
            className="text-white bg-red-500 hover:bg-red-600 px-4 py-1.5 rounded-full text-sm shadow-md transition-all duration-200"
          >
            ✖ Close
          </button>
        </div>

        {/* Message list */}
        <div className="px-6 py-6 overflow-y-auto flex-1 space-y-5 bg-gray-50">
          {messages.map((msg, idx) => (
            <div
              key={idx}
              className="p-5 rounded-2xl shadow-sm border border-gray-200 bg-white hover:shadow-md transition duration-200"
            >
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-semibold text-[#1e3a8a] uppercase tracking-wide">
                  {msg.sender}
                </span>
                <span className="text-xs text-gray-500">
                  {new Date(msg.timestamp).toLocaleString()}
                </span>
              </div>
              <p className="text-gray-800 text-sm leading-relaxed">{msg.content}</p>
              <p className="text-[11px] text-gray-400 mt-3 italic">
                Session ID: {msg.session_id}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default SessionModal;
