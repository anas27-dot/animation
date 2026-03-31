import React, { useState, useEffect } from "react";
import { iconOptions } from "../utils/icons";
import {
  fetchAllChatbots,
  fetchChatbotConfig,
  updateChatbotConfig,
} from "../services/chatbotService";
import {
  fetchSuggestions,
  updateSuggestions,
} from "../services/suggestionsService";


// Convert iconOptions keys into dropdown options
const iconNames = Object.keys(iconOptions);

export default function ClientConfigPage() {
  const [chatbots, setChatbots] = useState([]);
  const [selectedChatbot, setSelectedChatbot] = useState("");

  const [linkIntents, setLinkIntents] = useState([]);
  const [uiSuggestions, setUiSuggestions] = useState([]);

  const [loading, setLoading] = useState(false);

  // Load all chatbots
  useEffect(() => {
    const loadChatbots = async () => {
      try {
        const data = await fetchAllChatbots();
        // Ensure we always set an array, even if the API response doesn't have chatbots property
        const chatbots = data?.chatbots || data?.data?.chatbots || data;
        setChatbots(Array.isArray(chatbots) ? chatbots : []);
      } catch (err) {
        console.error("Error loading chatbots:", err);
        // Set empty array on error to prevent undefined issues
        setChatbots([]);
      }
    };
    loadChatbots();
  }, []);

  // Load config + suggestions when chatbot selected
  useEffect(() => {
    if (!selectedChatbot) return;

    const loadConfigAndSuggestions = async () => {
      setLoading(true);
      try {
        // Config (link intents)
        const configRes = await fetchChatbotConfig(selectedChatbot);
        setLinkIntents(configRes.config.link_intents || []);

        // Suggestions
        const suggestionsRes = await fetchSuggestions(selectedChatbot);
        setUiSuggestions(suggestionsRes || []);
      } catch (err) {
        console.error("Error loading config/suggestions:", err);
      } finally {
        setLoading(false);
      }
    };

    loadConfigAndSuggestions();
  }, [selectedChatbot]);

  // --- Link Intents Handlers ---
  const handleAddIntent = () => {
    setLinkIntents([...linkIntents, { intent: "", keywords: [], link: "" }]);
  };

  const handleIntentChange = (index, field, value) => {
    const updated = [...linkIntents];
    if (field === "keywords") {
      updated[index][field] = value.split(",").map((k) => k.trim());
    } else {
      updated[index][field] = value;
    }
    setLinkIntents(updated);
  };

  const handleRemoveIntent = (index) => {
    const updated = linkIntents.filter((_, i) => i !== index);
    setLinkIntents(updated);
  };

  const saveLinkIntents = async () => {
    try {
      await updateChatbotConfig(selectedChatbot, { link_intents: linkIntents });
      alert("Link intents updated!");
    } catch (err) {
      console.error("Save link intents error:", err);
    }
  };

  // --- UI Suggestions Handlers ---
  const handleAddSuggestion = () => {
    setUiSuggestions([
      ...uiSuggestions,
      { label: "", icon: "FaBuilding", bg: "#10b981" },
    ]);
  };

  const handleSuggestionChange = (index, field, value) => {
    const updated = [...uiSuggestions];
    updated[index][field] = value;
    setUiSuggestions(updated);
  };

  const handleRemoveSuggestion = (index) => {
    const updated = uiSuggestions.filter((_, i) => i !== index);
    setUiSuggestions(updated);
  };

  const saveUiSuggestions = async () => {
    try {
      await updateSuggestions(selectedChatbot, uiSuggestions);
      alert("UI suggestions updated!");
    } catch (err) {
      console.error("Save UI suggestions error:", err);
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h2 className="text-2xl font-bold mb-6">
        Client Config & UI Suggestions
      </h2>

      {/* Chatbot Dropdown */}
      <div className="mb-6">
        <select
          className="border border-gray-300 rounded-md px-4 py-2 w-80"
          value={selectedChatbot}
          onChange={(e) => setSelectedChatbot(e.target.value)}
        >
          <option value="">Select a chatbot</option>
          {Array.isArray(chatbots) ? chatbots.map((bot) => (
            <option key={bot._id} value={bot._id}>
              {bot.name || bot.company_name} ({bot.company_url})
            </option>
          )) : null}
        </select>
      </div>

      {loading && <p>Loading config...</p>}

      {!loading && selectedChatbot && (
        <div className="space-y-12">
          {/* --- Link Intents Section --- */}
          <div>
            <h3 className="text-xl font-semibold mb-4">Link Intents</h3>
            <div className="space-y-4">
              {linkIntents.map((intent, index) => (
                <div
                  key={index}
                  className="flex flex-col md:flex-row md:items-center gap-2"
                >
                  <input
                    type="text"
                    placeholder="Intent"
                    value={intent.intent}
                    onChange={(e) =>
                      handleIntentChange(index, "intent", e.target.value)
                    }
                    className="border border-gray-300 rounded-md px-3 py-2 w-full md:w-1/4"
                  />
                  <input
                    type="text"
                    placeholder="Keywords (comma separated)"
                    value={intent.keywords.join(", ")}
                    onChange={(e) =>
                      handleIntentChange(index, "keywords", e.target.value)
                    }
                    className="border border-gray-300 rounded-md px-3 py-2 w-full md:w-1/3"
                  />
                  <input
                    type="text"
                    placeholder="Link"
                    value={intent.link}
                    onChange={(e) =>
                      handleIntentChange(index, "link", e.target.value)
                    }
                    className="border border-gray-300 rounded-md px-3 py-2 w-full md:w-1/3"
                  />
                  <button
                    onClick={() => handleRemoveIntent(index)}
                    className="bg-red-500 text-white px-3 py-2 rounded-md"
                  >
                    Remove
                  </button>
                </div>
              ))}

              <div className="flex gap-2">
                <button
                  onClick={handleAddIntent}
                  className="bg-gray-200 px-4 py-2 rounded-md"
                >
                  Add Intent
                </button>
                <button
                  onClick={saveLinkIntents}
                  className="bg-[#1e3a8a] hover:bg-[#1e40af] text-white px-4 py-2 rounded-lg shadow-md transition-colors"
                >
                  Save
                </button>
              </div>
            </div>
          </div>

          {/* --- UI Suggestions Section --- */}
          <div>
            <h3 className="text-xl font-semibold mb-4">UI Suggestions</h3>
            <div className="space-y-4">
              {uiSuggestions.map((suggestion, index) => (
                <div
                  key={index}
                  className="flex flex-col md:flex-row md:items-center gap-2"
                >
                  {/* Label */}
                  <input
                    type="text"
                    placeholder="Label"
                    value={suggestion.label}
                    onChange={(e) =>
                      handleSuggestionChange(index, "label", e.target.value)
                    }
                    className="border border-gray-300 rounded-md px-3 py-2 w-full md:w-1/4"
                  />

                  {/* Icon Picker */}
                  <select
                    value={suggestion.icon}
                    onChange={(e) =>
                      handleSuggestionChange(index, "icon", e.target.value)
                    }
                    className="border border-gray-300 rounded-md px-3 py-2 w-full md:w-1/4"
                  >
                    {iconNames.map((iconName) => (
                      <option key={iconName} value={iconName}>
                        {iconName}
                      </option>
                    ))}
                  </select>

                  {/* BG Color */}
                  <input
                    type="color"
                    value={suggestion.bg}
                    onChange={(e) =>
                      handleSuggestionChange(index, "bg", e.target.value)
                    }
                    className="w-16 h-10 border rounded"
                  />

                  <button
                    onClick={() => handleRemoveSuggestion(index)}
                    className="bg-red-500 text-white px-3 py-2 rounded-md"
                  >
                    Remove
                  </button>
                </div>
              ))}

              <div className="flex gap-2">
                <button
                  onClick={handleAddSuggestion}
                  className="bg-gray-200 px-4 py-2 rounded-md"
                >
                  Add Suggestion
                </button>
                <button
                  onClick={saveUiSuggestions}
                  className="bg-[#1e3a8a] hover:bg-[#1e40af] text-white px-4 py-2 rounded-lg shadow-md transition-colors"
                >
                  Save
                </button>
              </div>

              {/* --- Live Preview --- */}
              {uiSuggestions.length > 0 && (
                <div className="mt-6">
                  <h4 className="font-semibold mb-2">Preview</h4>
                  <div className="flex flex-col gap-3">
                    {uiSuggestions.map((suggestion, index) => {
                      const IconComp = iconOptions[suggestion.icon] || null;
                      return (
                        <div
                          key={index}
                          className="flex items-center gap-3 bg-white rounded-lg px-4 py-3 shadow border border-gray-100"
                        >
                          {/* Icon Circle */}
                          <div
                            className="w-10 h-10 flex items-center justify-center rounded-full text-white"
                            style={{ backgroundColor: suggestion.bg }}
                          >
                            {IconComp && <IconComp size={18} />}
                          </div>

                          {/* Label */}
                          <span className="text-gray-800 font-medium">
                            {suggestion.label || "Button"}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
