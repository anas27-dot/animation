import React, { useState, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "react-toastify";
import { fetchUserChatHistory } from "../services/api";
import { X, MessageCircle, User, Bot, Clock } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";

const UserChatHistoryModal = ({ isOpen, onClose, userData }) => {
  const [loading, setLoading] = useState(false);
  const [chatData, setChatData] = useState(null);

  useEffect(() => {
    if (isOpen && userData) {
      loadChatHistory();
    }
  }, [isOpen, userData]);

  const loadChatHistory = async () => {
    try {
      setLoading(true);
      const params = {
        session_id: userData.session_id,
      };

      if (userData.phone) {
        params.phone = userData.phone;
      }
      if (userData.email) {
        params.email = userData.email;
      }

      const response = await fetchUserChatHistory(params);
      setChatData(response.data.data);
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to load chat history");
      console.error("Error loading chat history:", err);
    } finally {
      setLoading(false);
    }
  };

  const formatDuration = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          transition={{ type: "spring", duration: 0.5 }}
          className="bg-white/95 backdrop-blur-md border border-white/40 rounded-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="px-8 py-6 border-b border-gray-200 bg-gradient-to-r from-[#3a2d9c] to-[#017977] text-white">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <MessageCircle className="w-6 h-6" />
                <div>
                  <h2 className="text-xl font-semibold">Chat History</h2>
                  <p className="text-sm text-white/80 mt-1">
                    {userData?.identifierType === "phone" && `Phone: ${userData.identifier}`}
                    {userData?.identifierType === "email" && `Email: ${userData.identifier}`}
                    {userData?.identifierType === "guest" && `Guest: ${userData.identifier}`}
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="text-white hover:bg-white/20 p-2 rounded-full transition-all duration-200"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
          </div>

          {/* Loading State */}
          {loading && (
            <div className="flex-1 flex items-center justify-center p-8">
              <div className="text-center">
                <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-[#3a2d9c] mb-4"></div>
                <p className="text-gray-600">Loading chat history...</p>
              </div>
            </div>
          )}

          {/* Stats Section */}
          {!loading && chatData && (
            <>
              <div className="px-8 py-4 bg-gray-50 border-b border-gray-200">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-[#1e3a8a]/10 rounded-lg">
                      <MessageCircle className="w-5 h-5 text-[#1e3a8a]" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Total Messages</p>
                      <p className="text-lg font-semibold text-gray-800">{chatData.stats.totalMessages}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-green-100 rounded-lg">
                      <User className="w-5 h-5 text-green-600" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">User Messages</p>
                      <p className="text-lg font-semibold text-gray-800">{chatData.stats.userMessages}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-purple-100 rounded-lg">
                      <Bot className="w-5 h-5 text-purple-600" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Bot Messages</p>
                      <p className="text-lg font-semibold text-gray-800">{chatData.stats.botMessages}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-orange-100 rounded-lg">
                      <Clock className="w-5 h-5 text-orange-600" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Duration</p>
                      <p className="text-lg font-semibold text-gray-800">{formatDuration(chatData.stats.duration)}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Messages List */}
              <div className="flex-1 overflow-y-auto px-8 py-6 space-y-1 bg-gray-50">
                {chatData.messages.map((msg, idx) => {
                  const prevMsg = idx > 0 ? chatData.messages[idx - 1] : null;
                  const nextMsg = idx < chatData.messages.length - 1 ? chatData.messages[idx + 1] : null;
                  const isFirstInGroup = !prevMsg || prevMsg.sender !== msg.sender;
                  const isLastInGroup = !nextMsg || nextMsg.sender !== msg.sender;

                  return (
                    <motion.div
                      key={idx}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.05 }}
                      className={`flex ${msg.sender === "user" ? "justify-end" : "justify-start"} ${isLastInGroup ? "mb-3" : "mb-1"
                        }`}
                    >
                      <div
                        className={`max-w-[75%] p-4 shadow-sm ${msg.sender === "user"
                          ? "bg-gradient-to-br from-[#3a2d9c] to-[#5a4db7] text-white"
                          : "bg-white border border-gray-200 text-gray-800"
                          } ${
                          // Rounded corners based on position in group
                          isFirstInGroup && isLastInGroup
                            ? "rounded-2xl"
                            : isFirstInGroup
                              ? msg.sender === "user"
                                ? "rounded-2xl rounded-br-md"
                                : "rounded-2xl rounded-bl-md"
                              : isLastInGroup
                                ? msg.sender === "user"
                                  ? "rounded-2xl rounded-tr-md"
                                  : "rounded-2xl rounded-tl-md"
                                : msg.sender === "user"
                                  ? "rounded-2xl rounded-tr-md rounded-br-md"
                                  : "rounded-2xl rounded-tl-md rounded-bl-md"
                          }`}
                      >
                        {/* Show sender header only for first message in group */}
                        {isFirstInGroup && (
                          <div className="flex items-center gap-2 mb-2">
                            {msg.sender === "user" ? (
                              <User className="w-4 h-4" />
                            ) : (
                              <Bot className="w-4 h-4" />
                            )}
                            <span className="text-xs font-semibold uppercase tracking-wide">
                              {msg.sender}
                            </span>
                            <span className={`text-xs ml-auto ${msg.sender === "user" ? "text-white/70" : "text-gray-400"}`}>
                              {new Date(msg.timestamp).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                          </div>
                        )}

                        <div className="text-sm leading-relaxed break-words prose prose-sm max-w-none">
                          {msg.sender === "bot" ? (
                            <ReactMarkdown
                              remarkPlugins={[remarkGfm]}
                              rehypePlugins={[rehypeRaw]}
                              components={{
                                p: ({ node, ...props }) => <p className="mb-2 last:mb-0" {...props} />,
                                ul: ({ node, ...props }) => <ul className="list-disc ml-4 mb-2" {...props} />,
                                ol: ({ node, ...props }) => <ol className="list-decimal ml-4 mb-2" {...props} />,
                                li: ({ node, ...props }) => <li className="mb-1" {...props} />,
                                a: ({ node, ...props }) => (
                                  <a
                                    className="text-[#1e3a8a] hover:underline"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    {...props}
                                  />
                                ),
                                code: ({ node, inline, ...props }) =>
                                  inline ? (
                                    <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs" {...props} />
                                  ) : (
                                    <code className="block bg-gray-100 p-2 rounded text-xs overflow-x-auto" {...props} />
                                  ),
                                strong: ({ node, ...props }) => <strong className="font-semibold" {...props} />,
                                em: ({ node, ...props }) => <em className="italic" {...props} />,
                                h1: ({ node, ...props }) => <h1 className="text-lg font-bold mb-2" {...props} />,
                                h2: ({ node, ...props }) => <h2 className="text-base font-bold mb-2" {...props} />,
                                h3: ({ node, ...props }) => <h3 className="text-sm font-bold mb-1" {...props} />,
                                blockquote: ({ node, ...props }) => (
                                  <blockquote className="border-l-4 border-gray-300 pl-3 italic my-2" {...props} />
                                ),
                              }}
                            >
                              {typeof msg.content === 'string' ? msg.content.replace(/^(\d+)\.\s+/gm, '**$1.** ') : msg.content}
                            </ReactMarkdown>
                          ) : (
                            <p className="whitespace-pre-wrap">{msg.content}</p>
                          )}
                        </div>

                        {/* Show timestamp only for last message in group */}
                        {isLastInGroup && (
                          <div className={`mt-2 pt-2 border-t ${msg.sender === "user" ? "border-white/20" : "border-gray-200"}`}>
                            <p className={`text-xs ${msg.sender === "user" ? "text-white/60" : "text-gray-400"}`}>
                              {new Date(msg.timestamp).toLocaleDateString([], {
                                year: "numeric",
                                month: "short",
                                day: "numeric",
                              })} at {new Date(msg.timestamp).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </p>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </>
          )}

          {/* Empty State */}
          {!loading && !chatData && (
            <div className="flex-1 flex items-center justify-center p-8">
              <div className="text-center">
                <MessageCircle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-600">No chat history found</p>
              </div>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default UserChatHistoryModal;
