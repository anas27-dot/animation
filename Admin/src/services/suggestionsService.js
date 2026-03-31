import api from "./api";

// ✅ Fetch UI suggestions
export const fetchSuggestions = async (chatbotId) => {
  const { data } = await api.get(`/suggestions/${chatbotId}`);
  return data; // returns []
};

// ✅ Create/Update suggestions (upsert)
export const saveSuggestions = async (chatbotId, suggestions) => {
  const { data } = await api.post(`/suggestions/${chatbotId}`, { suggestions });
  return data;
};

// ✅ Update existing suggestions only
export const updateSuggestions = async (chatbotId, suggestions) => {
  const { data } = await api.put(`/suggestions/${chatbotId}`, { suggestions });
  return data;
};
