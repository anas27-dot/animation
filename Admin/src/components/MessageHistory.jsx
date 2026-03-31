import { useEffect, useState } from "react";
import api from "../services/api";
import { saveAs } from "file-saver";
import { Users } from "lucide-react";

// Helper function to detect guest users
const isGuestUser = (msg) => {
  return !msg.email && !msg.phone && msg.session_id;
};

const MessageHistory = ({ chatbotId }) => {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showGuests, setShowGuests] = useState(true);

  const fetchMessages = async () => {
    try {
      const token = localStorage.getItem("adminToken");
      const res = await api.get(`/chatbot/messages/${chatbotId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      let filteredMessages = res.data.messages || [];
      
      // Filter by guest status
      if (!showGuests) {
        filteredMessages = filteredMessages.filter(msg => !isGuestUser(msg));
      }
      
      setMessages(filteredMessages);
    } catch (err) {
      console.error("Failed to fetch messages:", err);
    } finally {
      setLoading(false);
    }
  };

  const exportCSV = () => {
    const headers = "User,Message,Response,Timestamp,User Type,Contact Info\n";
    const rows = [];

    let i = 0;
    while (i < messages.length) {
      const userMsg = messages[i];
      const botMsg = messages[i + 1];

      if (userMsg?.sender === "user" && botMsg?.sender === "bot") {
        const isGuest = isGuestUser(userMsg);
        const userType = isGuest ? "Guest" : "Authenticated";
        const contactInfo = isGuest ? `Session: ${userMsg.session_id}` : (userMsg.email || userMsg.phone || "Unknown");
        
        rows.push(
          [
            userMsg.sender,
            `"${userMsg.content}"`,
            `"${botMsg.content}"`,
            new Date(userMsg.timestamp).toLocaleString(),
            userType,
            contactInfo
          ].join(",")
        );
        i += 2;
      } else {
        i += 1;
      }
    }

    const csv = headers + rows.join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    saveAs(blob, "chatbot_messages.csv");
  };

  useEffect(() => {
    fetchMessages();
  }, [showGuests]);

  if (loading)
    return <p className="text-gray-500 italic">Loading messages...</p>;

  if (!messages.length)
    return <p className="text-gray-500 italic">No messages found.</p>;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex justify-between items-center">
        <p className="text-sm text-gray-600">
          Showing {messages.length} message{messages.length !== 1 && "s"}
        </p>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowGuests(!showGuests)}
            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded text-sm font-medium transition-colors ${
              showGuests 
                ? "bg-orange-100 text-orange-800 border border-orange-200" 
                : "bg-gray-100 text-gray-600 border border-gray-200"
            }`}
          >
            <Users className="w-4 h-4" />
            {showGuests ? "Hide Guests" : "Show Guests"}
          </button>
          <button
            onClick={exportCSV}
            className="bg-green-600 hover:bg-green-700 text-white px-4 py-1.5 rounded text-sm font-medium shadow"
          >
            Export CSV
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="border border-gray-200 rounded-lg overflow-y-auto max-h-[60vh] divide-y divide-gray-200 bg-white shadow-sm">
        {messages.map((msg) => {
          const isGuest = isGuestUser(msg);
          return (
            <div key={msg.id} className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <p className="text-sm font-semibold text-gray-700 capitalize">
                  {msg.sender}:
                </p>
                {isGuest && (
                  <span className="px-2 py-1 bg-orange-100 text-orange-800 text-xs font-medium rounded-full flex items-center gap-1">
                    <Users className="w-3 h-3" />
                    Guest
                  </span>
                )}
              </div>
              <p className="text-gray-800 mt-1">{msg.content}</p>
              <div className="flex items-center justify-between mt-2">
                <p className="text-xs text-gray-500">
                  {new Date(msg.timestamp).toLocaleString()}
                </p>
                {isGuest && (
                  <p className="text-xs text-orange-600 font-medium">
                    Session: {msg.session_id}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default MessageHistory;
