import api from "./api"; // <-- your axios instance file

// ✅ Fetch all chatbots
export const fetchAllChatbots = async () => {
  const { data } = await api.get("/chatbot/all");
  return data; // { chatbots: [...] }
};

// ✅ Fetch chatbot details by ID from subscriptions
export const fetchChatbotById = async (chatbotId) => {
  try {
    const { data } = await api.get("/subscriptions");
    const subscription = data.subscriptions?.find(sub => sub.chatbot_id._id === chatbotId);
    
    if (subscription && subscription.chatbot_id) {
      return {
        success: true,
        chatbot: subscription.chatbot_id
      };
    } else {
      return {
        success: false,
        message: "Chatbot not found in subscriptions"
      };
    }
  } catch (error) {
    throw error;
  }
};

// ✅ Fetch chatbot config
export const fetchChatbotConfig = async (chatbotId) => {
  const { data } = await api.get(`/chatbot/${chatbotId}/config`);
  return data; // { config: {...} }
};

// ✅ Update chatbot config
export const updateChatbotConfig = async (chatbotId, configData) => {
  const { data } = await api.put(`/chatbot/${chatbotId}/config`, configData);
  return data; // { message, config }
};
