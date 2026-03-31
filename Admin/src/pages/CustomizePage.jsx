import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import ChatbotPreview from "../components/ChatbotPreview";
import IconPicker from "../components/IconPicker";
import * as FaIcons from "react-icons/fa";
import { motion } from "framer-motion";
import {
  Plus,
  Trash2,
  Palette,
  Save,
  MessageSquare,
  Type,
  Volume2,
  VolumeX,
  RotateCcw,
  ArrowLeft,
  Settings
} from "lucide-react";
import "@fontsource/outfit";
import { ToggleButton, ToggleButtonGroup, FormControl, InputLabel, Select, MenuItem, Switch, FormControlLabel } from "@mui/material";
import { toast } from "react-toastify";
import { fetchCustomization, updateCustomization as updateCustomizationApi, resetCustomization } from "../services/api";
import { fetchChatbotById } from "../services/chatbotService";

// === Gradient Presets ===
const PRESET_GRADIENTS = [
  "linear-gradient(135deg, #a855f7, #ec4899)",
  "linear-gradient(to right, #d43f8d, #0250c5)",
  "linear-gradient(135deg, #667eea, #764ba2)",
  "linear-gradient(to right, #84fab0, #8fd3f4)",
  "linear-gradient(to right, #ff7e5f, #feb47b)",
  "linear-gradient(to right, #43e97b, #38f9d7)",
  "linear-gradient(to right, #ff8177, #f99185, #b12a5b)",
  "linear-gradient(to right, #a18cd1, #fbc2eb)",
  "linear-gradient(to top, #5ee7df, #b490ca)",
  "linear-gradient(to right, #4facfe, #00f2fe)",
  "linear-gradient(to right, #fa709a, #fee140)"
];

// Popular Google Fonts - Add new fonts here as needed
const GOOGLE_FONTS = [
  "Outfit",
  "Inter",
  "Roboto",
  "Open Sans",
  "Lato",
  "Poppins",
  "Montserrat",
  "Raleway",
  "Oswald",
  "Noto Sans",
  "Merriweather",
  "Source Sans Pro",
  "Ubuntu",
  "Playfair Display",
  "Fira Sans",
  "Rubik",
  "Quicksand",
  "Work Sans",
  "Inconsolata",
  "Caveat",
  "Pacifico",
  "Lobster",
  "Nunito",
  "Exo 2",
  "Teko",
  "Kanit",
  "Josefin Sans",
  "Bebas Neue",
  "Signika",
  "Asap",
  // Add new Google Fonts here
  "Dancing Script",
  "Great Vibes",
  "Satisfy",
  "Kaushan Script",
  "Allura",
  "Alex Brush",
  "Tangerine",
  "Yellowtail",
  "Sacramento",
  "Homemade Apple"
];

const ChatbotCustomizationPage = () => {
  const { chatbotId } = useParams();
  const navigate = useNavigate();
  
  // State matching backend schema
  const [customization, setCustomization] = useState({
    fontFamily: "Arial",
    headerBackground: "linear-gradient(135deg, #a855f7, #ec4899)",
    headerStyleType: "gradient",
    headerSubtitle: "AI Assistant",
    buttonColor: "linear-gradient(135deg, #ff7e5f, #feb47b)",
    buttonStyleType: "gradient",
    welcomeMessage: "👋 Hello! I'm Supa Agent. How can I assist you today?",
    startingSuggestions: [
      {
        title: "Hi! I need some assistance",
        icon: "FaHandSparkles",
        iconBg: "#F59E0B",
        bgType: "color"
      },
      {
        title: "Tell me more about the company",
        icon: "FaBuilding",
        iconBg: "#6366F1",
        bgType: "color"
      },
      {
        title: "Give me contact details",
        icon: "FaPhoneAlt",
        iconBg: "#10B981",
        bgType: "color"
      }
    ],
         chatWindowBg: "#ffffff",
     chatWindowBgType: "solid",
    includeAudio: true,
    includeSuggestionButton: true
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [chatbotDetails, setChatbotDetails] = useState(null);
  const [chatbotDetailsLoading, setChatbotDetailsLoading] = useState(false);

  // Fetch customization and chatbot details on component mount
  useEffect(() => {
    if (chatbotId) {
      fetchCustomizationData();
      fetchChatbotDetails();
    }
  }, [chatbotId]);

  // Load Google Font when customization changes
  useEffect(() => {
    if (customization.fontFamily && !GOOGLE_FONTS.includes(customization.fontFamily)) {
      loadGoogleFont(customization.fontFamily);
    }
  }, [customization.fontFamily]);

  const fetchCustomizationData = async () => {
    try {
      setLoading(true);
      const response = await fetchCustomization(chatbotId);
      if (response.data.success) {
        const data = response.data.data;
        // Set default style types if not present
        if (!data.headerStyleType) {
          data.headerStyleType = data.headerBackground.startsWith("#") ? "solid" : "gradient";
        }
        if (!data.buttonStyleType) {
          data.buttonStyleType = data.buttonColor.startsWith("#") ? "solid" : "gradient";
        }
                 // Set default bgType for suggestions if not present
         if (data.startingSuggestions) {
           data.startingSuggestions = data.startingSuggestions.map(s => ({
             ...s,
             bgType: s.bgType || (s.iconBg && s.iconBg.startsWith("#") ? "color" : "gradient")
           }));
         }
         // Set default chatWindowBgType if not present
         if (!data.chatWindowBgType) {
           data.chatWindowBgType = data.chatWindowBg && data.chatWindowBg.startsWith("#") ? "solid" : 
             (data.chatWindowBg && data.chatWindowBg.includes("gradient") ? "gradient" : "image");
         }
        setCustomization(data);
      } else {
        toast.error("Failed to load customization settings");
      }
    } catch (error) {
      console.error("Error fetching customization:", error);
      if (error.response?.status === 404) {
        toast.error("Chatbot not found");
      } else {
        toast.error("Failed to load customization settings");
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchChatbotDetails = async () => {
    try {
      setChatbotDetailsLoading(true);
      console.log("🔍 Fetching chatbot details for ID:", chatbotId);
      
      const response = await fetchChatbotById(chatbotId);
      console.log("📡 API Response:", response);
      
      if (response.success && response.chatbot) {
        console.log("✅ Chatbot details loaded:", response.chatbot);
        setChatbotDetails(response.chatbot);
      } else {
        console.warn("⚠️ Failed to fetch chatbot details:", response.message);
        // Set a fallback with just the ID
        console.log("🔄 Setting fallback chatbot details");
        setChatbotDetails({ 
          _id: chatbotId, 
          name: `Chatbot ${chatbotId.slice(-6)}` // Use last 6 characters of ID as fallback name
        });
      }
    } catch (error) {
      console.error("❌ Error fetching chatbot details:", error);
      // Set a fallback with just the ID
      console.log("🔄 Setting fallback chatbot details due to error");
      setChatbotDetails({ 
        _id: chatbotId, 
        name: `Chatbot ${chatbotId.slice(-6)}` // Use last 6 characters of ID as fallback name
      });
    } finally {
      setChatbotDetailsLoading(false);
    }
  };

  const saveCustomizationData = async () => {
    try {
      setSaving(true);
      
      // Validate and load custom font before saving
      if (customization.fontFamily && !GOOGLE_FONTS.includes(customization.fontFamily)) {
        console.log(`🔤 Validating custom font: ${customization.fontFamily}`);
        
        // Try to load the font first
        loadGoogleFont(customization.fontFamily);
        
        // Wait a bit for the font to load
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Check if font is now available
        if (!isFontAvailable(customization.fontFamily)) {
          console.warn(`⚠️ Font ${customization.fontFamily} may not be available`);
          toast.warning(`Warning: Font "${customization.fontFamily}" may not be available. The customization will still be saved.`);
        }
      }
      
      const response = await updateCustomizationApi(chatbotId, customization);
      if (response.data.success) {
        toast.success("Customization saved successfully!");
        
        // If it's a custom font, show success message
        if (customization.fontFamily && !GOOGLE_FONTS.includes(customization.fontFamily)) {
          toast.info(`Font "${customization.fontFamily}" will be available in the chatbot preview.`);
        }
      } else {
        toast.error("Failed to save customization");
      }
    } catch (error) {
      console.error("Error saving customization:", error);
      if (error.response?.status === 400) {
        toast.error("Invalid customization data");
      } else if (error.response?.status === 403) {
        toast.error("You don't have permission to modify this chatbot");
      } else {
        toast.error("Failed to save customization");
      }
    } finally {
      setSaving(false);
    }
  };

  const resetToDefaults = async () => {
    if (window.confirm("Are you sure you want to reset all customization to defaults?")) {
      try {
        setSaving(true);
        const response = await resetCustomization(chatbotId);
        if (response.data.success) {
          setCustomization(response.data.data);
          toast.success("Customization reset to defaults");
        } else {
          toast.error("Failed to reset customization");
        }
      } catch (error) {
        console.error("Error resetting customization:", error);
        if (error.response?.status === 403) {
          toast.error("You don't have permission to modify this chatbot");
        } else {
          toast.error("Failed to reset customization");
        }
      } finally {
        setSaving(false);
      }
    }
  };

  // === Handlers ===
  const handleSuggestionChange = (index, field, value) => {
    // Validate gradient values for suggestions
    if (field === "iconBg" && value && typeof value === "string") {
      if (value.includes("gradient") && !value.includes("linear-gradient") && !value.includes("radial-gradient")) {
        console.warn("Invalid gradient format for suggestion:", value);
        return; // Don't update with invalid gradient
      }
    }
    
    const newSuggestions = [...customization.startingSuggestions];
    newSuggestions[index][field] = value;
    setCustomization({
      ...customization,
      startingSuggestions: newSuggestions
    });
  };

  const handleAddSuggestion = () => {
    if (customization.startingSuggestions.length >= 5) {
      setErrorMessage("You can only add up to 5 suggestions.");
      setTimeout(() => setErrorMessage(""), 3000);
      return;
    }
    setCustomization({
      ...customization,
      startingSuggestions: [
        ...customization.startingSuggestions,
        {
          title: "",
          icon: "FaQuestionCircle",
          iconBg: "#cccccc",
          bgType: "color"
        }
      ]
    });
  };

  const handleRemoveSuggestion = (index) => {
    if (customization.startingSuggestions.length > 1) {
      const newSuggestions = customization.startingSuggestions.filter((_, i) => i !== index);
      setCustomization({
        ...customization,
        startingSuggestions: newSuggestions
      });
    }
  };

  const updateCustomizationField = (field, value) => {
    console.log(`Updating ${field}:`, value); // Debug log
    
    // Validate gradient values to prevent crashes
    if (field === "headerBackground" || field === "buttonColor" || field === "chatWindowBg") {
      if (value && typeof value === "string") {
        // If it's a gradient, ensure it's valid CSS
        if (value.includes("gradient") && !value.includes("linear-gradient") && !value.includes("radial-gradient")) {
          console.warn("Invalid gradient format:", value);
          return; // Don't update with invalid gradient
        }
      }
    }

    // Handle font family updates
    if (field === "fontFamily") {
      loadGoogleFont(value);
    }
    
    setCustomization(prev => {
      const newState = {
        ...prev,
        [field]: value
      };
      console.log("New customization state:", newState); // Debug log
      return newState;
    });
  };

  // Function to check if a font is available
  const isFontAvailable = (fontName) => {
    if (!fontName) return false;
    
    // Check if it's a preset font
    if (GOOGLE_FONTS.includes(fontName)) return true;
    
    // Check if font is loaded in document
    try {
      return document.fonts.check(`12px "${fontName}"`);
    } catch (error) {
      console.warn(`⚠️ Could not check font availability: ${fontName}`, error);
      return false;
    }
  };

  // Function to dynamically load Google Fonts
  const loadGoogleFont = (fontName) => {
    if (!fontName || GOOGLE_FONTS.includes(fontName)) return; // Skip if already loaded or in preset list
    
    try {
      // Check if font is already loaded
      if (document.querySelector(`link[href*="${fontName.replace(/\s+/g, '+')}"]`)) {
        console.log(`✅ Font already loaded: ${fontName}`);
        return;
      }

      // Create link element for Google Fonts
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = `https://fonts.googleapis.com/css2?family=${fontName.replace(/\s+/g, '+')}:wght@300;400;500;600;700&display=swap`;
      
      // Add error handling
      link.onerror = () => {
        console.warn(`⚠️ Failed to load font: ${fontName}`);
        toast.warning(`Failed to load font: ${fontName}. Please check the font name.`);
      };
      
      link.onload = () => {
        console.log(`✅ Successfully loaded custom font: ${fontName}`);
        toast.success(`Font "${fontName}" loaded successfully!`);
      };
      
      // Add to head
      document.head.appendChild(link);
      
      // Set a timeout to check if font loaded successfully
      setTimeout(() => {
        if (!document.fonts.check(`12px "${fontName}"`)) {
          console.warn(`⚠️ Font may not have loaded properly: ${fontName}`);
        }
      }, 2000);
      
    } catch (error) {
      console.error(`❌ Error loading custom font: ${fontName}`, error);
      toast.error(`Error loading font: ${fontName}`);
    }
  };

  if (!chatbotId) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 mb-4">No chatbot ID provided</p>
          <button
            onClick={() => navigate(-1)}
            className="px-4 py-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading customization settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen">
      {/* LEFT PANEL */}
      <div className="w-1/2 overflow-y-auto p-8 space-y-8 bg-white shadow-lg border-r border-gray-200">
        {/* PAGE HEADER */}
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate(-1)}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <motion.h1
            className="text-3xl font-bold text-gray-900"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            Chatbot Customization
          </motion.h1>
        </div>

        {/* CHATBOT DETAILS */}
        {chatbotDetailsLoading ? (
          <motion.div
            className="bg-gradient-to-r from-[#1e3a8a]/5 to-[#2563eb]/5 p-6 rounded-xl border border-[#1e3a8a]/20 shadow-sm"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-gradient-to-br from-[#1e3a8a] to-[#2563eb] rounded-lg flex items-center justify-center">
                <MessageSquare size={20} className="text-white" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-[#1e3a8a]">Chatbot Details</h2>
                <p className="text-sm text-gray-600">Loading chatbot information...</p>
              </div>
            </div>
            <div className="animate-pulse space-y-3">
              <div className="h-4 bg-[#1e3a8a]/20 rounded w-3/4"></div>
              <div className="h-4 bg-[#1e3a8a]/20 rounded w-1/2"></div>
            </div>
          </motion.div>
        ) : chatbotDetails ? (
          <motion.div
            className="bg-gradient-to-r from-[#1e3a8a]/5 to-[#2563eb]/5 p-6 rounded-xl border border-[#1e3a8a]/20 shadow-sm"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-gradient-to-br from-[#1e3a8a] to-[#2563eb] rounded-lg flex items-center justify-center">
                <MessageSquare size={20} className="text-white" />
              </div>
                              <div>
                  <h2 className="text-lg font-semibold text-gray-800">Chatbot Details</h2>
                  <p className="text-sm text-gray-600">
                    {chatbotDetails.name && chatbotDetails.name.startsWith("Chatbot ") 
                      ? "Using fallback information" 
                      : "Configuration and customization settings"
                    }
                  </p>
                </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-600">ID:</span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm bg-gray-100 px-2 py-1 rounded text-indigo-700">
                      {chatbotDetails._id}
                    </span>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(chatbotDetails._id);
                        toast.success("Chatbot ID copied to clipboard!");
                      }}
                      className="p-1 hover:bg-[#1e3a8a]/10 rounded transition-colors"
                      title="Copy ID"
                    >
                      <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    </button>
                  </div>
                </div>
                                 <div className="flex items-center gap-2">
                   <span className="text-sm font-medium text-gray-600">Name:</span>
                   <span className="font-semibold text-gray-900">{chatbotDetails.name}</span>
                 </div>
                 

                                 {chatbotDetails.company_name && (
                   <div className="flex items-center gap-2">
                     <span className="text-sm font-medium text-gray-600">Company:</span>
                     <span className="text-sm text-gray-700">{chatbotDetails.company_name}</span>
                   </div>
                 )}
                 
                 {/* Current Font Display */}
                 <div className="flex items-center gap-2">
                   <span className="text-sm font-medium text-gray-600">Current Font:</span>
                   <span className="font-mono text-sm bg-gray-100 px-2 py-1 rounded text-indigo-700">
                     {customization.fontFamily}
                   </span>
                 </div>
              </div>
              
              <div className="space-y-2">
                {chatbotDetails.createdAt && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-600">Created:</span>
                    <span className="text-sm text-gray-700">
                      {new Date(chatbotDetails.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                )}
                {chatbotDetails.updatedAt && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-600">Updated:</span>
                    <span className="text-sm text-gray-700">
                      {new Date(chatbotDetails.updatedAt).toLocaleDateString()}
                    </span>
                  </div>
                )}
                {chatbotDetails.status && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-600">Status:</span>
                    <span className={`text-sm px-2 py-1 rounded-full ${
                      chatbotDetails.status === 'active' 
                        ? 'bg-green-100 text-green-800' 
                        : chatbotDetails.status === 'inactive'
                        ? 'bg-red-100 text-red-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {chatbotDetails.status.charAt(0).toUpperCase() + chatbotDetails.status.slice(1)}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        ) : null}



        {/* FONT SELECTOR */}
        <SectionCard title="Font Family" icon={<Type size={20} />}>
          <div className="space-y-4">
            {/* Preset Fonts */}
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-2">
                Choose from popular fonts:
              </label>
              <FormControl fullWidth>
                <Select
                  value={customization.fontFamily}
                  onChange={(e) => updateCustomizationField("fontFamily", e.target.value)}
                  displayEmpty
                >
                  {GOOGLE_FONTS.map((font) => (
                    <MenuItem key={font} value={font} style={{ fontFamily: font }}>
                      {font}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </div>

            {/* Custom Font Input */}
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-2">
                Or enter a custom Google Font name:
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="e.g., Dancing Script, Great Vibes, Satisfy"
                  className="flex-1 p-2 border border-gray-300 rounded focus:ring-2 focus:ring-indigo-500"
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      const customFont = e.target.value.trim();
                      if (customFont) {
                        updateCustomizationField("fontFamily", customFont);
                        e.target.value = '';
                      }
                    }
                  }}
                />
                <button
                  onClick={(e) => {
                    const customFont = e.target.previousElementSibling.value.trim();
                    if (customFont) {
                      updateCustomizationField("fontFamily", customFont);
                      e.target.previousElementSibling.value = '';
                    }
                  }}
                  className="px-4 py-2 bg-indigo-500 text-white rounded hover:bg-indigo-600 transition-colors"
                >
                  Apply
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                💡 Tip: Enter the exact font name from Google Fonts (e.g., "Dancing Script" not "dancing-script")
              </p>
            </div>

                         {/* Current Font Preview */}
             <div className="p-3 bg-gray-50 rounded-lg border">
               <label className="block text-sm font-medium text-gray-600 mb-2">
                 Preview:
               </label>
               <div className="space-y-2">
                 <p 
                   className="text-lg"
                   style={{ fontFamily: customization.fontFamily }}
                 >
                   This is how your text will look with "{customization.fontFamily}" font
                 </p>
                 
                 {/* Font Status Indicator */}
                 <div className="flex items-center gap-2 text-sm">
                   {isFontAvailable(customization.fontFamily) ? (
                     <span className="flex items-center gap-1 text-green-600">
                       <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                         <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                       </svg>
                       Font available
                     </span>
                   ) : (
                     <span className="flex items-center gap-1 text-orange-600">
                       <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                         <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                       </svg>
                       Font loading...
                     </span>
                   )}
                 </div>
                 
                 {/* Font Loading Instructions */}
                 {!isFontAvailable(customization.fontFamily) && !GOOGLE_FONTS.includes(customization.fontFamily) && (
                   <p className="text-xs text-orange-600 bg-orange-50 p-2 rounded">
                     💡 This font will be loaded from Google Fonts when you save the customization.
                   </p>
                 )}
               </div>
             </div>
          </div>
        </SectionCard>

        {/* HEADER CUSTOMIZATION */}
        <SectionCard title="Header Background" icon={<Palette size={20} />}>
          <ToggleButtonGroup
            value={customization.headerStyleType || "gradient"}
            exclusive
            onChange={(e, val) => {
              if (val) {
                updateCustomizationField("headerStyleType", val);
                if (val === "solid" && !customization.headerBackground.startsWith("#")) {
                  updateCustomizationField("headerBackground", "#a855f7");
                } else if (val === "gradient" && customization.headerBackground.startsWith("#")) {
                  updateCustomizationField("headerBackground", PRESET_GRADIENTS[0]);
                }
              }
            }}
            sx={{ mt: 2 }}
          >
            <ToggleButton value="solid">Solid Color</ToggleButton>
            <ToggleButton value="gradient">Gradient</ToggleButton>
          </ToggleButtonGroup>

          {(customization.headerStyleType || "gradient") === "solid" ? (
            <ColorInput
              value={customization.headerBackground}
              onChange={(e) => updateCustomizationField("headerBackground", e.target.value)}
              placeholder="Enter color (e.g., #a855f7)"
              showColorPicker={true}
            />
          ) : (
            <div>
              <CustomGradientInput
                value={customization.headerBackground}
                onChange={(e) => updateCustomizationField("headerBackground", e.target.value)}
                placeholder="Enter custom gradient (e.g., linear-gradient(135deg, #a855f7, #ec4899))"
              />
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-600 mb-2">
                  Or choose from presets:
                </label>
                <GradientGrid
                  gradients={PRESET_GRADIENTS}
                  selected={customization.headerBackground}
                  onSelect={(grad) => updateCustomizationField("headerBackground", grad)}
                />
              </div>
            </div>
          )}
        </SectionCard>

        {/* BUTTON CUSTOMIZATION */}
        <SectionCard title="Button Styles" icon={<Palette size={20} />}>
          <ToggleButtonGroup
            value={customization.buttonStyleType || "gradient"}
            exclusive
            onChange={(e, val) => {
              if (val) {
                updateCustomizationField("buttonStyleType", val);
                if (val === "solid" && !customization.buttonColor.startsWith("#")) {
                  updateCustomizationField("buttonColor", "#ff7e5f");
                } else if (val === "gradient" && customization.buttonColor.startsWith("#")) {
                  updateCustomizationField("buttonColor", PRESET_GRADIENTS[0]);
                }
              }
            }}
            sx={{ mt: 2 }}
          >
            <ToggleButton value="solid">Solid Color</ToggleButton>
            <ToggleButton value="gradient">Gradient</ToggleButton>
          </ToggleButtonGroup>

          {(customization.buttonStyleType || "gradient") === "solid" ? (
            <ColorInput
              value={customization.buttonColor}
              onChange={(e) => updateCustomizationField("buttonColor", e.target.value)}
              placeholder="Enter color (e.g., #ff7e5f)"
              showColorPicker={true}
            />
          ) : (
            <div>
              <CustomGradientInput
                value={customization.buttonColor}
                onChange={(e) => updateCustomizationField("buttonColor", e.target.value)}
                placeholder="Enter custom gradient (e.g., linear-gradient(135deg, #ff7e5f, #feb47b))"
              />
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-600 mb-2">
                  Or choose from presets:
                </label>
                <GradientGrid
                  gradients={PRESET_GRADIENTS}
                  selected={customization.buttonColor}
                  onSelect={(grad) => updateCustomizationField("buttonColor", grad)}
                />
              </div>
            </div>
          )}
        </SectionCard>

        {/* BOT CONTENT */}
        <SectionCard title="Bot Content" icon={<MessageSquare size={20} />}>
          <TextInput
            label="Bot Subtitle"
            value={customization.headerSubtitle}
            onChange={(e) => updateCustomizationField("headerSubtitle", e.target.value)}
          />
          <TextInput
            label="Welcome Message"
            value={customization.welcomeMessage}
            onChange={(e) => updateCustomizationField("welcomeMessage", e.target.value)}
          />
        </SectionCard>

        {/* CHAT WINDOW BACKGROUND */}
        <SectionCard title="Chat Window Background" icon={<Palette size={20} />}>
          <ToggleButtonGroup
            value={customization.chatWindowBgType || "solid"}
            exclusive
            onChange={(e, val) => {
              if (val) {
                updateCustomizationField("chatWindowBgType", val);
                if (val === "solid" && !customization.chatWindowBg.startsWith("#")) {
                  updateCustomizationField("chatWindowBg", "#ffffff");
                } else if (val === "gradient" && customization.chatWindowBg.startsWith("#")) {
                  updateCustomizationField("chatWindowBg", PRESET_GRADIENTS[0]);
                } else if (val === "image" && !customization.chatWindowBg.startsWith("http")) {
                  updateCustomizationField("chatWindowBg", "");
                }
              }
            }}
            sx={{ mt: 2 }}
          >
            <ToggleButton value="solid">Solid Color</ToggleButton>
            <ToggleButton value="gradient">Gradient</ToggleButton>
            <ToggleButton value="image">Image</ToggleButton>
          </ToggleButtonGroup>

          {(customization.chatWindowBgType || "solid") === "solid" ? (
            <ColorInput
              value={customization.chatWindowBg}
              onChange={(e) => updateCustomizationField("chatWindowBg", e.target.value)}
              placeholder="Enter color (e.g., #ffffff)"
              showColorPicker={true}
            />
          ) : (customization.chatWindowBgType || "solid") === "gradient" ? (
            <div>
              <CustomGradientInput
                value={customization.chatWindowBg}
                onChange={(e) => updateCustomizationField("chatWindowBg", e.target.value)}
                placeholder="Enter custom gradient (e.g., linear-gradient(135deg, #f3f4f6, #e5e7eb))"
              />
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-600 mb-2">
                  Or choose from presets:
                </label>
                <GradientGrid
                  gradients={PRESET_GRADIENTS}
                  selected={customization.chatWindowBg}
                  onSelect={(grad) => updateCustomizationField("chatWindowBg", grad)}
                />
              </div>
            </div>
          ) : (
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-600 mb-2">
                Image URL
              </label>
              <input
                type="url"
                value={customization.chatWindowBg || ""}
                onChange={(e) => updateCustomizationField("chatWindowBg", e.target.value)}
                placeholder="Enter image URL (e.g., https://example.com/image.jpg)"
                className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-indigo-500"
              />
              <p className="text-xs text-gray-500 mt-1">
                Enter a valid image URL (JPG, PNG, GIF, etc.)
              </p>
            </div>
          )}
        </SectionCard>

        {/* FEATURE TOGGLES */}
        <SectionCard title="Features" icon={<Settings size={20} />}>
          <FormControlLabel
            control={
              <Switch
                checked={customization.includeAudio}
                onChange={(e) => updateCustomizationField("includeAudio", e.target.checked)}
              />
            }
            label="Include Audio Functionality"
          />
          <FormControlLabel
            control={
              <Switch
                checked={customization.includeSuggestionButton}
                onChange={(e) => updateCustomizationField("includeSuggestionButton", e.target.checked)}
              />
            }
            label="Show Suggestion Buttons"
          />
        </SectionCard>

        {/* UI SUGGESTIONS */}
        <SectionCard title="Starting Suggestions" icon={<Type size={20} />}>
          {!customization.includeSuggestionButton ? (
            <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-yellow-800 text-sm">
                💡 Enable "Show Suggestion Buttons" above to edit suggestions
              </p>
            </div>
          ) : (
            <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-green-800 text-sm">
                ✨ Suggestions are enabled! You can now customize up to 5 starting suggestions.
              </p>
            </div>
          )}

          {errorMessage && (
            <p className="text-red-500 text-sm mb-2">{errorMessage}</p>
          )}

          {customization.startingSuggestions.map((suggestion, index) => (
            <div
              key={index}
              className={`mt-4 p-4 rounded-xl flex flex-col gap-3 border ${
                customization.includeSuggestionButton 
                  ? "bg-gray-50 border-gray-200" 
                  : "bg-gray-100 border-gray-300 opacity-60"
              }`}
            >
              <div className="flex justify-between items-center">
                <input
                  type="text"
                  value={suggestion.title}
                  onChange={(e) =>
                    handleSuggestionChange(index, "title", e.target.value)
                  }
                  className={`border p-2 rounded-lg flex-1 ${
                    !customization.includeSuggestionButton 
                      ? "bg-gray-200 cursor-not-allowed" 
                      : ""
                  }`}
                  placeholder="Suggestion Title"
                  disabled={!customization.includeSuggestionButton}
                />
                <button
                  onClick={() => handleRemoveSuggestion(index)}
                  className={`ml-3 ${
                    customization.includeSuggestionButton
                      ? "text-red-500 hover:text-red-700"
                      : "text-gray-400 cursor-not-allowed"
                  }`}
                  disabled={!customization.includeSuggestionButton}
                >
                  <Trash2 size={20} />
                </button>
              </div>

              <IconPicker
                value={suggestion.icon}
                onChange={(icon) =>
                  handleSuggestionChange(index, "icon", icon)
                }
                disabled={!customization.includeSuggestionButton}
              />

              {/* Solid/Gradient selector for each suggestion */}
              <ToggleButtonGroup
                value={suggestion.bgType || "color"}
                exclusive
                onChange={(e, val) => {
                  if (val) {
                    handleSuggestionChange(index, "bgType", val);
                    if (val === "gradient" && suggestion.iconBg && suggestion.iconBg.startsWith("#")) {
                      handleSuggestionChange(index, "iconBg", PRESET_GRADIENTS[0]);
                    } else if (val === "color" && suggestion.iconBg && !suggestion.iconBg.startsWith("#")) {
                      handleSuggestionChange(index, "iconBg", "#cccccc");
                    }
                  }
                }}
                disabled={!customization.includeSuggestionButton}
              >
                <ToggleButton value="color" disabled={!customization.includeSuggestionButton}>
                  Solid Color
                </ToggleButton>
                <ToggleButton value="gradient" disabled={!customization.includeSuggestionButton}>
                  Gradient
                </ToggleButton>
              </ToggleButtonGroup>

              {suggestion.bgType === "color" ? (
                <ColorInput
                  value={suggestion.iconBg}
                  onChange={(e) =>
                    handleSuggestionChange(index, "iconBg", e.target.value)
                  }
                  placeholder="Icon background color"
                  showColorPicker={true}
                  disabled={!customization.includeSuggestionButton}
                />
              ) : (
                <div>
                  <CustomGradientInput
                    value={suggestion.iconBg}
                    onChange={(e) =>
                      handleSuggestionChange(index, "iconBg", e.target.value)
                    }
                    placeholder="Enter custom gradient (e.g., linear-gradient(135deg, #a855f7, #ec4899))"
                    disabled={!customization.includeSuggestionButton}
                  />
                  <div className="mt-4">
                    <label className="block text-sm font-medium text-gray-600 mb-2">
                      Or choose from presets:
                    </label>
                    <GradientGrid
                      gradients={PRESET_GRADIENTS}
                      selected={suggestion.iconBg}
                      onSelect={(grad) =>
                        handleSuggestionChange(index, "iconBg", grad)
                      }
                      disabled={!customization.includeSuggestionButton}
                    />
                  </div>
                </div>
              )}
            </div>
          ))}

          <div className="flex gap-3 mt-4">
            <ActionButton
              onClick={handleAddSuggestion}
              icon={<Plus size={18} />}
              label="Add Suggestion"
              disabled={!customization.includeSuggestionButton}
            />
          </div>
        </SectionCard>

        {/* ACTION BUTTONS */}
        <div className="flex gap-3 mt-8">
          <ActionButton
            onClick={resetToDefaults}
            icon={<RotateCcw size={18} />}
            label="Reset to Defaults"
          />
          <ActionButton
            onClick={saveCustomizationData}
            icon={<Save size={18} />}
            label={saving ? "Saving..." : "Save Changes"}
            primary
            disabled={saving}
          />
        </div>
      </div>

      {/* RIGHT PANEL */}
      <div className="w-1/2 bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-[380px] h-[680px] bg-white rounded-3xl shadow-2xl overflow-hidden border border-gray-200"
        >
                     <ChatbotPreview
             botSubtitle={customization.headerSubtitle}
             headerColor={customization.headerBackground}
             buttonColor={customization.buttonColor}
             textColor="#FFFFFF"
             welcomeMessage={customization.welcomeMessage}
             suggestions={customization.startingSuggestions.map(s => ({
               label: s.title,
               icon: s.icon,
               bg: s.iconBg,
               bgType: s.bgType || "color"
             }))}
             bgImage={customization.chatWindowBgType === "image" ? customization.chatWindowBg : ""}
             bgColor={customization.chatWindowBgType !== "image" ? customization.chatWindowBg : ""}
             fontFamily={customization.fontFamily}
             includeSuggestionButton={customization.includeSuggestionButton}
             includeAudio={customization.includeAudio}
           />
        </motion.div>
      </div>
    </div>
  );
};

/* === Reusable Components === */
const SectionCard = ({ title, icon, children }) => (
  <motion.section
    className="bg-white p-6 rounded-2xl shadow-md border border-gray-100"
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
  >
    <h2 className="text-xl font-semibold flex items-center gap-2">
      {icon} {title}
    </h2>
    {children}
  </motion.section>
);

const ColorInput = ({ value, onChange, placeholder, showColorPicker, disabled }) => (
  <div className="mt-4">
    <label className="block text-sm font-medium text-gray-600 mb-2">
      {placeholder || "Color"}
    </label>
    <input
      type="text"
      value={value || ""}
      onChange={onChange}
      placeholder={placeholder}
      disabled={disabled}
      className={`w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-indigo-500 mb-2 ${
        disabled ? "bg-gray-200 cursor-not-allowed" : ""
      }`}
    />
    {showColorPicker && (
      <input
        type="color"
        value={(value && value.startsWith("#")) ? value : "#000000"}
        onChange={onChange}
        disabled={disabled}
        className={`w-full h-12 rounded-lg border border-gray-200 ${
          disabled ? "opacity-50 cursor-not-allowed" : ""
        }`}
      />
    )}
  </div>
);

const CustomGradientInput = ({ value, onChange, placeholder, disabled }) => (
  <div className="mt-4">
    <label className="block text-sm font-medium text-gray-600 mb-2">
      Custom Gradient
    </label>
    <input
      type="text"
      value={value || ""}
      onChange={onChange}
      disabled={disabled}
      className={`w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-indigo-500 ${
        disabled ? "bg-gray-200 cursor-not-allowed" : ""
      }`}
      placeholder={placeholder}
    />
  </div>
);

const GradientGrid = ({ gradients, selected, onSelect, disabled }) => (
  <div className="grid grid-cols-6 gap-3 mt-4">
    {gradients.map((grad, idx) => (
      <div
        key={idx}
        onClick={() => !disabled && onSelect(grad)}
        className={`w-12 h-12 rounded-full border-2 ${
          disabled 
            ? "opacity-50 cursor-not-allowed" 
            : "cursor-pointer"
        } ${
          (selected && selected === grad) ? "border-indigo-500" : "border-transparent"
        }`}
        style={{ background: grad }}
      />
    ))}
  </div>
 );

const TextInput = ({ label, value, onChange }) => (
  <div className="mt-4">
    <label className="block text-sm font-medium text-gray-600">{label}</label>
    <input
      type="text"
      value={value}
      onChange={onChange}
      className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-indigo-500"
    />
  </div>
);

const ActionButton = ({ onClick, icon, label, primary, disabled }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
      primary
        ? "bg-indigo-500 text-white hover:bg-indigo-600 disabled:bg-indigo-300"
        : "bg-gray-100 hover:bg-gray-200 text-gray-700 disabled:bg-gray-50 disabled:text-gray-400"
    } disabled:cursor-not-allowed`}
  >
    {icon} {label}
  </button>
);

export default ChatbotCustomizationPage;
