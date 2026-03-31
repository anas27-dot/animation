import { useState, useEffect } from "react";
import { toast } from "react-toastify";
import {
  fetchChatbots,
  getChatbotSidebarConfig,
  updateChatbotSidebarEnabled,
  updateChatbotSidebarWhatsApp,
  updateChatbotSidebarCall,
  updateChatbotSidebarCalendly,
} from "../services/api";
import { MessageSquare, Phone, Loader2, ChevronDown, ChevronUp, Settings } from "lucide-react";

const ManageSidebarPage = () => {
  const [chatbots, setChatbots] = useState([]);
  const [selectedChatbotId, setSelectedChatbotId] = useState("");
  const [selectedChatbot, setSelectedChatbot] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingConfig, setLoadingConfig] = useState(false);

  // Sidebar configuration state
  const [sidebarEnabled, setSidebarEnabled] = useState(false);
  const [whatsappEnabled, setWhatsappEnabled] = useState(false);
  const [whatsappMode, setWhatsappMode] = useState("premium_modal");
  const [whatsappUrl, setWhatsappUrl] = useState("");
  const [callEnabled, setCallEnabled] = useState(false);
  const [callMode, setCallMode] = useState("premium_modal");
  const [callNumber, setCallNumber] = useState("");
  const [calendlyEnabled, setCalendlyEnabled] = useState(false);
  const [calendlyMode, setCalendlyMode] = useState("premium_modal");
  const [calendlyUrl, setCalendlyUrl] = useState("");
  const [calendlyText, setCalendlyText] = useState("Schedule a Meeting");
  const [calendlyEventTypeUri, setCalendlyEventTypeUri] = useState("");
  const [calendlyPat, setCalendlyPat] = useState("");

  // UI state
  const [updatingMaster, setUpdatingMaster] = useState(false);
  const [updatingWhatsApp, setUpdatingWhatsApp] = useState(false);
  const [updatingCall, setUpdatingCall] = useState(false);
  const [updatingCalendly, setUpdatingCalendly] = useState(false);
  const [showWhatsAppSection, setShowWhatsAppSection] = useState(false);
  const [showCallSection, setShowCallSection] = useState(false);
  const [showCalendlySection, setShowCalendlySection] = useState(false);

  // Fetch all chatbots on mount
  useEffect(() => {
    fetchChatbotsList();
  }, []);

  // Fetch sidebar config when chatbot is selected
  useEffect(() => {
    if (selectedChatbotId) {
      fetchSidebarConfig(selectedChatbotId);
      // Reset section states when chatbot changes
      setShowWhatsAppSection(false);
      setShowCallSection(false);
    } else {
      resetConfig();
    }
  }, [selectedChatbotId]);

  const fetchChatbotsList = async () => {
    try {
      setLoading(true);
      const response = await fetchChatbots();
      setChatbots(response.data.data?.chatbots || response.data.chatbots || []);
    } catch (error) {
      console.error("Error fetching chatbots:", error);
      toast.error("Failed to load chatbots");
    } finally {
      setLoading(false);
    }
  };

  const fetchSidebarConfig = async (chatbotId) => {
    try {
      setLoadingConfig(true);
      const response = await getChatbotSidebarConfig(chatbotId);
      const config = response.data.data || response.data;

      setSidebarEnabled(config.sidebar_enabled || false);
      setWhatsappEnabled(config.whatsapp_enabled || false);
      setWhatsappMode(config.whatsapp_mode || "premium_modal");
      setWhatsappUrl(config.whatsapp_url || "");
      setCallEnabled(config.call_enabled || false);
      setCallMode(config.call_mode || "premium_modal");
      setCallNumber(config.call_number || "");
      setCalendlyEnabled(config.calendly_enabled || false);
      setCalendlyMode(config.calendly_mode || "premium_modal");
      setCalendlyUrl(config.calendly_url || "");
      setCalendlyText(config.calendly_text || "Schedule a Meeting");
      setCalendlyEventTypeUri(config.calendly_event_type_uri || "");

      // Find and set selected chatbot details
      const chatbot = chatbots.find((c) => c._id === chatbotId);
      setSelectedChatbot(chatbot || { name: config.chatbot_name || "Unknown" });
    } catch (error) {
      console.error("Error fetching sidebar config:", error);
      toast.error("Failed to load sidebar configuration");
      resetConfig();
    } finally {
      setLoadingConfig(false);
    }
  };

  const resetConfig = () => {
    setSidebarEnabled(false);
    setWhatsappEnabled(false);
    setWhatsappMode("premium_modal");
    setWhatsappUrl("");
    setCallEnabled(false);
    setCallMode("premium_modal");
    setCallNumber("");
    setCalendlyEnabled(false);
    setCalendlyMode("premium_modal");
    setCalendlyUrl("");
    setCalendlyText("Schedule a Meeting");
    setCalendlyEventTypeUri("");
    setCalendlyPat("");
    setSelectedChatbot(null);
  };

  const handleUpdateMasterToggle = async () => {
    if (!selectedChatbotId) {
      toast.error("Please select a chatbot first");
      return;
    }

    try {
      setUpdatingMaster(true);
      await updateChatbotSidebarEnabled(selectedChatbotId, !sidebarEnabled);
      setSidebarEnabled(!sidebarEnabled);
      toast.success(`Sidebar ${!sidebarEnabled ? "enabled" : "disabled"} successfully! ✅`);
    } catch (error) {
      console.error("Error updating master toggle:", error);
      toast.error(error.response?.data?.message || "Failed to update sidebar toggle");
    } finally {
      setUpdatingMaster(false);
    }
  };

  const handleUpdateWhatsApp = async () => {
    if (!selectedChatbotId) {
      toast.error("Please select a chatbot first");
      return;
    }

    // Validate URL if mode is redirect
    if (whatsappMode === "redirect" && !whatsappUrl.trim()) {
      toast.error("Please enter a WhatsApp URL when mode is 'Redirect'");
      return;
    }

    // Basic URL validation for redirect mode
    if (whatsappMode === "redirect" && whatsappUrl.trim()) {
      const whatsappUrlPattern = /^(https?:\/\/)?(wa\.me\/|api\.whatsapp\.com\/send\?phone=|\+?\d{10,15})/i;
      if (!whatsappUrlPattern.test(whatsappUrl.trim())) {
        toast.error("Invalid WhatsApp URL format. Use format like https://wa.me/1234567890 or +1234567890");
        return;
      }
    }

    try {
      setUpdatingWhatsApp(true);
      await updateChatbotSidebarWhatsApp(
        selectedChatbotId,
        whatsappEnabled,
        whatsappMode,
        whatsappMode === "redirect" ? whatsappUrl.trim() : null
      );
      toast.success("WhatsApp configuration updated successfully! ✅");
    } catch (error) {
      console.error("Error updating WhatsApp config:", error);
      toast.error(error.response?.data?.message || "Failed to update WhatsApp configuration");
    } finally {
      setUpdatingWhatsApp(false);
    }
  };

  const handleUpdateCall = async () => {
    if (!selectedChatbotId) {
      toast.error("Please select a chatbot first");
      return;
    }

    // Validate phone number if mode is redirect
    if (callMode === "redirect" && !callNumber.trim()) {
      toast.error("Please enter a phone number when mode is 'Redirect'");
      return;
    }

    // Basic phone validation for redirect mode
    if (callMode === "redirect" && callNumber.trim()) {
      const phonePattern = /^[\+]?[(]?[0-9]{1,4}[)]?[-\s\.]?[(]?[0-9]{1,4}[)]?[-\s\.]?[0-9]{1,9}$/;
      if (!phonePattern.test(callNumber.trim())) {
        toast.error("Invalid phone number format");
        return;
      }
    }

    try {
      setUpdatingCall(true);
      await updateChatbotSidebarCall(
        selectedChatbotId,
        callEnabled,
        callMode,
        callMode === "redirect" ? callNumber.trim() : null
      );
      toast.success("Call configuration updated successfully! ✅");
    } catch (error) {
      console.error("Error updating Call config:", error);
      toast.error(error.response?.data?.message || "Failed to update Call configuration");
    } finally {
      setUpdatingCall(false);
    }
  };

  const handleUpdateCalendly = async () => {
    if (!selectedChatbotId) {
      toast.error("Please select a chatbot first");
      return;
    }

    if (calendlyMode === "redirect" && !calendlyUrl.trim()) {
      toast.error("Please enter a Calendly URL when mode is 'Redirect'");
      return;
    }

    // Basic Calendly URL validation for redirect mode
    if (calendlyMode === "redirect" && calendlyUrl.trim()) {
      try {
        const urlObj = new URL(calendlyUrl.trim());
        if (!urlObj.hostname.includes("calendly.com")) {
          toast.error("URL must be a valid Calendly link (e.g., https://calendly.com/username/meeting)");
          return;
        }
      } catch (e) {
        toast.error("Invalid Calendly URL format");
        return;
      }
    }

    try {
      setUpdatingCalendly(true);
      await updateChatbotSidebarCalendly(
        selectedChatbotId,
        calendlyEnabled,
        calendlyMode,
        calendlyMode === "redirect" ? calendlyUrl.trim() : null,
        calendlyText,
        calendlyPat ? calendlyPat.trim() : null,
        calendlyEventTypeUri ? calendlyEventTypeUri.trim() : null
      );
      toast.success("Calendly configuration updated successfully! ✅");
      // Clear PAT input after save
      setCalendlyPat("");
      // If backend resolved a new event type URI, refetch config to display it
      fetchSidebarConfig(selectedChatbotId);
    } catch (error) {
      console.error("Error updating Calendly config:", error);
      toast.error(error.response?.data?.message || "Failed to update Calendly configuration");
    } finally {
      setUpdatingCalendly(false);
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">Manage Sidebar</h1>
        <p className="text-gray-600">Configure sidebar items (Calendly, WhatsApp, Call) for your chatbots</p>
      </div>

      {/* Chatbot Selection */}
      <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
        <label className="block text-sm font-semibold text-gray-700 mb-2">Select Chatbot</label>
        {loading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
            <span className="ml-2 text-gray-600">Loading chatbots...</span>
          </div>
        ) : (
          <select
            value={selectedChatbotId}
            onChange={(e) => setSelectedChatbotId(e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-700 bg-white"
          >
            <option value="">-- Select a chatbot --</option>
            {chatbots.map((chatbot) => (
              <option key={chatbot._id} value={chatbot._id}>
                {chatbot.name} ({chatbot.company_name || "N/A"})
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Sidebar Configuration Section */}
      {selectedChatbotId && (
        <div className="space-y-6">
          {loadingConfig ? (
            <div className="bg-white rounded-xl shadow-lg p-12 text-center">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-4" />
              <p className="text-gray-600">Loading sidebar configuration...</p>
            </div>
          ) : (
            <>
              {/* Current Chatbot Info */}
              {selectedChatbot && (
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-4 border border-blue-200">
                  <p className="text-sm text-gray-600">Current Chatbot:</p>
                  <p className="text-lg font-semibold text-gray-800">{selectedChatbot.name}</p>
                </div>
              )}

              {/* Calendly Section */}
              {showCalendlySection && (
                <div className="bg-white rounded-xl shadow-lg p-6 space-y-4">
                  <div className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-lg p-4">
                    <div>
                      <p className="text-sm font-semibold text-gray-800">Calendly in Sidebar</p>
                      <p className="text-sm text-gray-600">Master toggle for Calendly entry</p>
                    </div>
                    <button
                      onClick={() => setCalendlyEnabled(!calendlyEnabled)}
                      className={`px-4 py-2 rounded-lg text-sm font-semibold ${
                        calendlyEnabled ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {calendlyEnabled ? "Enabled" : "Disabled"}
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1">Mode</label>
                      <select
                        value={calendlyMode}
                        onChange={(e) => setCalendlyMode(e.target.value)}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-700 bg-white"
                      >
                        <option value="premium_modal">Premium Modal</option>
                        <option value="redirect">Redirect</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1">Button Text</label>
                      <input
                        type="text"
                        value={calendlyText}
                        onChange={(e) => setCalendlyText(e.target.value)}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Schedule a Meeting"
                      />
                    </div>
                  </div>

                  {calendlyMode === "redirect" && (
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1">Calendly Scheduling URL</label>
                      <input
                        type="text"
                        value={calendlyUrl}
                        onChange={(e) => setCalendlyUrl(e.target.value)}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="https://calendly.com/username/meeting"
                      />
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1">
                        Event Type API URI (for availability)
                      </label>
                      <input
                        type="text"
                        value={calendlyEventTypeUri}
                        onChange={(e) => setCalendlyEventTypeUri(e.target.value)}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="https://api.calendly.com/event_types/uuid"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Optional: leave blank and provide PAT + URL to auto-resolve.
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1">
                        Calendly PAT (not returned after save)
                      </label>
                      <input
                        type="password"
                        value={calendlyPat}
                        onChange={(e) => setCalendlyPat(e.target.value)}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Paste PAT to resolve availability"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        PAT is used to resolve event type and fetch availability; not stored client-side after save.
                      </p>
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <button
                      onClick={handleUpdateCalendly}
                      disabled={updatingCalendly}
                      className="px-5 py-2.5 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 transition disabled:opacity-60"
                    >
                      {updatingCalendly ? "Saving..." : "Save Calendly"}
                    </button>
                  </div>
                </div>
              )}

              {/* Master Toggle */}
              <div className="bg-white rounded-xl shadow-lg p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <Settings className="h-6 w-6 text-blue-600 mr-2" />
                    <div>
                      <h2 className="text-xl font-semibold text-gray-800">Enable Sidebar Items</h2>
                      <p className="text-sm text-gray-500 mt-1">
                        Master toggle to show/hide sidebar items. Individual items must also be enabled.
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={handleUpdateMasterToggle}
                    disabled={updatingMaster}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      sidebarEnabled ? "bg-blue-600" : "bg-gray-300"
                    } ${updatingMaster ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        sidebarEnabled ? "translate-x-6" : "translate-x-1"
                      }`}
                    />
                  </button>
                </div>
              </div>

              {/* Toggle Buttons */}
              {sidebarEnabled && (
                <div className="flex flex-wrap gap-4 mb-4">
                  <button
                    onClick={() => {
                      setShowCalendlySection((v) => !v);
                      setShowWhatsAppSection(false);
                      setShowCallSection(false);
                    }}
                    className={`flex items-center px-6 py-3 rounded-lg font-semibold transition-all duration-200 shadow-md hover:shadow-lg transform hover:scale-105 ${
                      showCalendlySection
                        ? "bg-gradient-to-r from-indigo-600 to-purple-600 text-white"
                        : "bg-white text-gray-700 border-2 border-gray-300 hover:border-indigo-500"
                    }`}
                  >
                    <Settings className="h-5 w-5 mr-2" />
                    Calendly Configuration
                    {showCalendlySection ? (
                      <ChevronUp className="h-5 w-5 ml-2" />
                    ) : (
                      <ChevronDown className="h-5 w-5 ml-2" />
                    )}
                  </button>

                  <button
                    onClick={() => {
                      setShowWhatsAppSection((v) => !v);
                      setShowCallSection(false);
                      setShowCalendlySection(false);
                    }}
                    className={`flex items-center px-6 py-3 rounded-lg font-semibold transition-all duration-200 shadow-md hover:shadow-lg transform hover:scale-105 ${
                      showWhatsAppSection
                        ? "bg-gradient-to-r from-green-600 to-emerald-600 text-white"
                        : "bg-white text-gray-700 border-2 border-gray-300 hover:border-green-500"
                    }`}
                  >
                    <MessageSquare className="h-5 w-5 mr-2" />
                    WhatsApp Configuration
                    {showWhatsAppSection ? (
                      <ChevronUp className="h-5 w-5 ml-2" />
                    ) : (
                      <ChevronDown className="h-5 w-5 ml-2" />
                    )}
                  </button>

                  <button
                    onClick={() => {
                      setShowCallSection((v) => !v);
                      setShowWhatsAppSection(false);
                      setShowCalendlySection(false);
                    }}
                    className={`flex items-center px-6 py-3 rounded-lg font-semibold transition-all duration-200 shadow-md hover:shadow-lg transform hover:scale-105 ${
                      showCallSection
                        ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white"
                        : "bg-white text-gray-700 border-2 border-gray-300 hover:border-blue-500"
                    }`}
                  >
                    <Phone className="h-5 w-5 mr-2" />
                    Call Configuration
                    {showCallSection ? (
                      <ChevronUp className="h-5 w-5 ml-2" />
                    ) : (
                      <ChevronDown className="h-5 w-5 ml-2" />
                    )}
                  </button>
                </div>
              )}

              {/* WhatsApp Configuration Section */}
              {sidebarEnabled && showWhatsAppSection && (
                <div className="bg-white rounded-xl shadow-lg p-6">
                  <div className="flex items-center mb-4">
                    <MessageSquare className="h-6 w-6 text-green-600 mr-2" />
                    <h2 className="text-xl font-semibold text-gray-800">WhatsApp Configuration</h2>
                  </div>

                  {/* Enable WhatsApp Toggle */}
                  <div className="mb-6">
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-sm font-medium text-gray-700">
                        Show WhatsApp in Sidebar
                      </label>
                      <button
                        onClick={() => setWhatsappEnabled(!whatsappEnabled)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                          whatsappEnabled ? "bg-green-600" : "bg-gray-300"
                        } cursor-pointer`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            whatsappEnabled ? "translate-x-6" : "translate-x-1"
                          }`}
                        />
                      </button>
                    </div>
                  </div>

                  {/* Behavior Mode */}
                  <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-700 mb-3">
                      Behavior Mode
                    </label>
                    <div className="space-y-3">
                      <label className="flex items-center cursor-pointer">
                        <input
                          type="radio"
                          name="whatsappMode"
                          value="redirect"
                          checked={whatsappMode === "redirect"}
                          onChange={(e) => setWhatsappMode(e.target.value)}
                          className="mr-3 h-4 w-4 text-green-600 focus:ring-green-500"
                        />
                        <span className="text-gray-700">Redirect to WhatsApp</span>
                      </label>
                      <label className="flex items-center cursor-pointer">
                        <input
                          type="radio"
                          name="whatsappMode"
                          value="premium_modal"
                          checked={whatsappMode === "premium_modal"}
                          onChange={(e) => setWhatsappMode(e.target.value)}
                          className="mr-3 h-4 w-4 text-green-600 focus:ring-green-500"
                        />
                        <span className="text-gray-700">Show Premium Modal</span>
                      </label>
                    </div>
                  </div>

                  {/* WhatsApp URL Input (only if redirect mode) */}
                  {whatsappMode === "redirect" && (
                    <div className="mb-6">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        WhatsApp URL
                      </label>
                      <input
                        type="text"
                        value={whatsappUrl}
                        onChange={(e) => setWhatsappUrl(e.target.value)}
                        placeholder="https://wa.me/1234567890 or +1234567890"
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 text-gray-700"
                      />
                      <p className="mt-2 text-xs text-gray-500">
                        Enter WhatsApp URL (e.g., https://wa.me/919876543210) or phone number with country code
                      </p>
                    </div>
                  )}

                  <button
                    onClick={handleUpdateWhatsApp}
                    disabled={updatingWhatsApp}
                    className="w-full md:w-auto px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white font-semibold rounded-lg shadow-md hover:shadow-lg transform hover:scale-105 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center"
                  >
                    {updatingWhatsApp ? (
                      <>
                        <Loader2 className="h-5 w-5 animate-spin mr-2" />
                        Updating...
                      </>
                    ) : (
                      <>
                        <MessageSquare className="h-5 w-5 mr-2" />
                        Update WhatsApp Settings
                      </>
                    )}
                  </button>
                </div>
              )}

              {/* Call Configuration Section */}
              {sidebarEnabled && showCallSection && (
                <div className="bg-white rounded-xl shadow-lg p-6">
                  <div className="flex items-center mb-4">
                    <Phone className="h-6 w-6 text-blue-600 mr-2" />
                    <h2 className="text-xl font-semibold text-gray-800">Call Configuration</h2>
                  </div>

                  {/* Enable Call Toggle */}
                  <div className="mb-6">
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-sm font-medium text-gray-700">
                        Show Call in Sidebar
                      </label>
                      <button
                        onClick={() => setCallEnabled(!callEnabled)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                          callEnabled ? "bg-blue-600" : "bg-gray-300"
                        } cursor-pointer`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            callEnabled ? "translate-x-6" : "translate-x-1"
                          }`}
                        />
                      </button>
                    </div>
                  </div>

                  {/* Behavior Mode */}
                  <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-700 mb-3">
                      Behavior Mode
                    </label>
                    <div className="space-y-3">
                      <label className="flex items-center cursor-pointer">
                        <input
                          type="radio"
                          name="callMode"
                          value="redirect"
                          checked={callMode === "redirect"}
                          onChange={(e) => setCallMode(e.target.value)}
                          className="mr-3 h-4 w-4 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-gray-700">Redirect to Phone</span>
                      </label>
                      <label className="flex items-center cursor-pointer">
                        <input
                          type="radio"
                          name="callMode"
                          value="premium_modal"
                          checked={callMode === "premium_modal"}
                          onChange={(e) => setCallMode(e.target.value)}
                          className="mr-3 h-4 w-4 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-gray-700">Show Premium Modal</span>
                      </label>
                    </div>
                  </div>

                  {/* Phone Number Input (only if redirect mode) */}
                  {callMode === "redirect" && (
                    <div className="mb-6">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Phone Number
                      </label>
                      <input
                        type="tel"
                        value={callNumber}
                        onChange={(e) => setCallNumber(e.target.value)}
                        placeholder="+1234567890 or 1234567890"
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-700"
                      />
                      <p className="mt-2 text-xs text-gray-500">
                        Enter phone number with country code (e.g., +919876543210)
                      </p>
                    </div>
                  )}

                  <button
                    onClick={handleUpdateCall}
                    disabled={updatingCall}
                    className="w-full md:w-auto px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold rounded-lg shadow-md hover:shadow-lg transform hover:scale-105 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center"
                  >
                    {updatingCall ? (
                      <>
                        <Loader2 className="h-5 w-5 animate-spin mr-2" />
                        Updating...
                      </>
                    ) : (
                      <>
                        <Phone className="h-5 w-5 mr-2" />
                        Update Call Settings
                      </>
                    )}
                  </button>
                </div>
              )}

              {/* Info Message when sidebar is disabled */}
              {!sidebarEnabled && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
                  <p className="text-sm text-yellow-800">
                    <strong>Note:</strong> Enable "Sidebar Items" above to configure WhatsApp and Call options.
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Empty State */}
      {!selectedChatbotId && !loading && (
        <div className="bg-white rounded-xl shadow-lg p-12 text-center">
          <Settings className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600 text-lg">Select a chatbot to manage its sidebar configuration</p>
        </div>
      )}
    </div>
  );
};

export default ManageSidebarPage;

