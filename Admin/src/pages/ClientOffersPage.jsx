import { useState, useEffect } from "react";
import { toast } from "react-toastify";
import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";
import {
  getOfferSidebarConfig,
  updateOfferSidebarConfig,
  getOfferTemplates,
  createOfferTemplate,
  updateOfferTemplate,
  deleteOfferTemplate,
} from "../services/api";
import { 
  Gift, 
  Loader2, 
  Plus, 
  Edit2, 
  Trash2, 
  X, 
  CheckCircle2,
} from "lucide-react";

const ClientOffersPage = () => {
  // Sidebar configuration state
  const [offerSidebarEnabled, setOfferSidebarEnabled] = useState(false);
  const [offerSidebarDisplayText, setOfferSidebarDisplayText] = useState("Offers");
  const [updatingSidebarConfig, setUpdatingSidebarConfig] = useState(false);
  const [loadingConfig, setLoadingConfig] = useState(false);

  // Templates state
  const [templates, setTemplates] = useState([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [showTemplateForm, setShowTemplateForm] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [savingTemplate, setSavingTemplate] = useState(false);

  // Template form state
  const [templateForm, setTemplateForm] = useState({
    image_url: "",
    content: "",
    button_text: "",
    button_link: "",
    order: 0,
    is_active: true,
  });

  useEffect(() => {
    fetchSidebarConfig();
    fetchTemplates();
  }, []);

  const fetchSidebarConfig = async () => {
    try {
      setLoadingConfig(true);
      const response = await getOfferSidebarConfig();
      const data = response.data.data || response.data;
      setOfferSidebarEnabled(data.offer_templates_enabled || false);
      setOfferSidebarDisplayText(data.offer_sidebar_display_text || "Offers");
    } catch (error) {
      console.error("Error fetching sidebar config:", error);
      // If endpoint doesn't exist (500 error), silently disable offer templates
      if (error.response?.status === 500) {
        console.warn("Offer templates sidebar config endpoint not available - feature disabled");
        setOfferSidebarEnabled(false);
        setOfferSidebarDisplayText("Offers");
      } else {
        toast.error("Failed to load sidebar configuration");
      }
    } finally {
      setLoadingConfig(false);
    }
  };

  const fetchTemplates = async () => {
    try {
      setLoadingTemplates(true);
      const response = await getOfferTemplates();
      const data = response.data.data || response.data;
      setTemplates(data.templates || []);
    } catch (error) {
      console.error("Error fetching templates:", error);
      // If endpoint doesn't exist (500 error), show empty state
      if (error.response?.status === 500) {
        console.warn("Offer templates endpoint not available - showing empty state");
        setTemplates([]);
      } else {
        toast.error("Failed to load offer templates");
      }
    } finally {
      setLoadingTemplates(false);
    }
  };

  const handleSaveSidebarConfig = async () => {
    if (!offerSidebarDisplayText.trim()) {
      toast.error("Display text is required");
      return;
    }

    try {
      setUpdatingSidebarConfig(true);
      await updateOfferSidebarConfig(offerSidebarEnabled, offerSidebarDisplayText);
      toast.success("Sidebar configuration saved successfully! ✅");
    } catch (error) {
      console.error("Error saving sidebar config:", error);
      toast.error(error.response?.data?.message || "Failed to save sidebar configuration");
    } finally {
      setUpdatingSidebarConfig(false);
    }
  };

  const handleCreateTemplate = () => {
    setEditingTemplate(null);
    setTemplateForm({
      image_url: "",
      content: "",
      button_text: "",
      button_link: "",
      order: templates.length,
      is_active: true,
    });
    setShowTemplateForm(true);
  };

  const handleEditTemplate = (template) => {
    setEditingTemplate(template);
    setTemplateForm({
      image_url: template.image_url || "",
      content: template.content || "",
      button_text: template.button_text || "",
      button_link: template.button_link || "",
      order: template.order || 0,
      is_active: template.is_active !== undefined ? template.is_active : true,
    });
    setShowTemplateForm(true);
  };

  const handleSaveTemplate = async () => {
    if (!templateForm.content.trim()) {
      toast.error("Content is required");
      return;
    }

    if (!templateForm.button_text.trim()) {
      toast.error("Button text is required");
      return;
    }

    if (!templateForm.button_link.trim()) {
      toast.error("Button link is required");
      return;
    }

    // Validate URL
    try {
      new URL(templateForm.button_link.trim());
    } catch (e) {
      toast.error("Button link must be a valid URL");
      return;
    }

    try {
      setSavingTemplate(true);
      if (editingTemplate) {
        await updateOfferTemplate(editingTemplate._id, templateForm);
        toast.success("Offer template updated successfully! ✅");
      } else {
        await createOfferTemplate(templateForm);
        toast.success("Offer template created successfully! ✅");
      }
      setShowTemplateForm(false);
      setEditingTemplate(null);
      fetchTemplates();
    } catch (error) {
      console.error("Error saving template:", error);
      toast.error(error.response?.data?.message || "Failed to save template");
    } finally {
      setSavingTemplate(false);
    }
  };

  const handleDeleteTemplate = async (templateId) => {
    if (!window.confirm("Are you sure you want to delete this offer template?")) {
      return;
    }

    try {
      await deleteOfferTemplate(templateId);
      toast.success("Offer template deleted successfully");
      fetchTemplates();
    } catch (error) {
      console.error("Error deleting template:", error);
      toast.error(error.response?.data?.message || "Failed to delete template");
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-[#1e3a8a] mb-2">Client Offers</h1>
        <p className="text-gray-600">Manage global offer templates that will appear in all user dashboards</p>
      </div>

        {loadingConfig ? (
          <div className="bg-white rounded-xl shadow-lg p-12 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-4" />
            <p className="text-gray-600">Loading configuration...</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Sidebar Configuration */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <div className="flex items-center mb-4">
                <Gift className="h-6 w-6 text-purple-600 mr-2" />
                <h2 className="text-xl font-semibold text-gray-800">Sidebar Configuration</h2>
              </div>

              <div className="mb-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-800">Show Offers in User Dashboard Sidebar</h3>
                    <p className="text-sm text-gray-500 mt-1">
                      Enable to show offers menu item in user dashboard sidebar
                    </p>
                  </div>
                  <button
                    onClick={() => setOfferSidebarEnabled(!offerSidebarEnabled)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      offerSidebarEnabled ? "bg-purple-600" : "bg-gray-300"
                    } cursor-pointer`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        offerSidebarEnabled ? "translate-x-6" : "translate-x-1"
                      }`}
                    />
                  </button>
                </div>

                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Sidebar Menu Text
                  </label>
                  <input
                    type="text"
                    value={offerSidebarDisplayText}
                    onChange={(e) => setOfferSidebarDisplayText(e.target.value)}
                    placeholder="e.g., Offers, Special Offers, Client Offers"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    disabled={!offerSidebarEnabled}
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    This text will appear as the menu item in user dashboard sidebar
                  </p>
                </div>

                <button
                  onClick={handleSaveSidebarConfig}
                  disabled={updatingSidebarConfig}
                  className="w-full md:w-auto px-6 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-semibold rounded-lg shadow-md hover:shadow-lg transform hover:scale-105 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center"
                >
                  {updatingSidebarConfig ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin mr-2" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-5 w-5 mr-2" />
                      Save Sidebar Configuration
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Templates Management */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center">
                  <Gift className="h-6 w-6 text-purple-600 mr-2" />
                  <h2 className="text-xl font-semibold text-gray-800">Offer Templates</h2>
                </div>
                <button
                  onClick={handleCreateTemplate}
                  className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                >
                  <Plus className="h-5 w-5" />
                  Create New Template
                </button>
              </div>

              {/* Templates List */}
              {loadingTemplates ? (
                <div className="text-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-purple-600 mx-auto mb-2" />
                  <p className="text-gray-600">Loading templates...</p>
                </div>
              ) : templates.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <Gift className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                  <p>No offer templates created yet</p>
                  <p className="text-sm mt-2">Click "Create New Template" to get started</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {templates.map((template) => (
                    <div
                      key={template._id}
                      className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <span className="text-xs font-medium text-gray-500">Order: {template.order}</span>
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-medium ${
                            template.is_active
                              ? "bg-green-100 text-green-800"
                              : "bg-gray-100 text-gray-800"
                          }`}
                        >
                          {template.is_active ? "Active" : "Inactive"}
                        </span>
                      </div>

                      {template.image_url && (
                        <div className="mb-3">
                          <img
                            src={template.image_url}
                            alt="Offer"
                            className="w-full h-32 object-cover rounded-lg"
                            onError={(e) => {
                              e.target.style.display = "none";
                            }}
                          />
                        </div>
                      )}

                      <div
                        className="text-sm text-gray-700 mb-3 line-clamp-3"
                        dangerouslySetInnerHTML={{
                          __html: template.content.substring(0, 100) + (template.content.length > 100 ? "..." : ""),
                        }}
                      />

                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-xs text-gray-500">Button:</span>
                        <span className="text-sm font-medium text-purple-600">{template.button_text}</span>
                      </div>

                      <div className="flex gap-2">
                        <button
                          onClick={() => handleEditTemplate(template)}
                          className="flex-1 px-3 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors flex items-center justify-center gap-1"
                        >
                          <Edit2 className="h-4 w-4" />
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteTemplate(template._id)}
                          className="px-3 py-2 bg-red-600 text-white text-sm rounded hover:bg-red-700 transition-colors flex items-center justify-center"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Template Form Modal */}
            {showTemplateForm && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
                  <div className="sticky top-0 bg-white border-b border-gray-200 p-6 flex items-center justify-between z-10">
                    <h3 className="text-xl font-semibold text-gray-800">
                      {editingTemplate ? "Edit Offer Template" : "Create Offer Template"}
                    </h3>
                    <button
                      onClick={() => {
                        setShowTemplateForm(false);
                        setEditingTemplate(null);
                      }}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <X className="h-6 w-6" />
                    </button>
                  </div>

                  <div className="p-6 space-y-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Image URL (Optional)
                      </label>
                      <input
                        type="url"
                        value={templateForm.image_url}
                        onChange={(e) => setTemplateForm({ ...templateForm, image_url: e.target.value })}
                        placeholder="https://example.com/image.jpg"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      />
                      {templateForm.image_url && (
                        <div className="mt-2">
                          <img
                            src={templateForm.image_url}
                            alt="Preview"
                            className="w-full h-48 object-cover rounded-lg border border-gray-200"
                            onError={(e) => {
                              e.target.style.display = "none";
                            }}
                          />
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Content <span className="text-red-500">*</span>
                      </label>
                      <ReactQuill
                        theme="snow"
                        value={templateForm.content}
                        onChange={(value) => setTemplateForm({ ...templateForm, content: value })}
                        placeholder="Enter offer content..."
                        className="bg-white"
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Button Text <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={templateForm.button_text}
                          onChange={(e) => setTemplateForm({ ...templateForm, button_text: e.target.value })}
                          placeholder="e.g., Claim Now, Learn More"
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Button Link (URL) <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="url"
                          value={templateForm.button_link}
                          onChange={(e) => setTemplateForm({ ...templateForm, button_link: e.target.value })}
                          placeholder="https://example.com/offer"
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Display Order
                        </label>
                        <input
                          type="number"
                          value={templateForm.order}
                          onChange={(e) => setTemplateForm({ ...templateForm, order: parseInt(e.target.value) || 0 })}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        />
                        <p className="mt-1 text-xs text-gray-500">Lower numbers appear first</p>
                      </div>

                      <div className="flex items-center justify-between">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Status
                          </label>
                          <p className="text-xs text-gray-500">Active templates are shown to users</p>
                        </div>
                        <button
                          onClick={() => setTemplateForm({ ...templateForm, is_active: !templateForm.is_active })}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                            templateForm.is_active ? "bg-green-600" : "bg-gray-300"
                          } cursor-pointer`}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                              templateForm.is_active ? "translate-x-6" : "translate-x-1"
                            }`}
                          />
                        </button>
                      </div>
                    </div>

                    <div className="flex gap-3 pt-4 border-t border-gray-200">
                      <button
                        onClick={handleSaveTemplate}
                        disabled={savingTemplate}
                        className="flex-1 px-6 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-semibold rounded-lg shadow-md hover:shadow-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                      >
                        {savingTemplate ? (
                          <>
                            <Loader2 className="h-5 w-5 animate-spin mr-2" />
                            Saving...
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="h-5 w-5 mr-2" />
                            {editingTemplate ? "Update Template" : "Create Template"}
                          </>
                        )}
                      </button>
                      <button
                        onClick={() => {
                          setShowTemplateForm(false);
                          setEditingTemplate(null);
                        }}
                        className="px-6 py-3 bg-gray-200 text-gray-700 font-semibold rounded-lg hover:bg-gray-300 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
    </div>
  );
};

export default ClientOffersPage;

