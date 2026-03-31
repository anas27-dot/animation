import { useState } from "react";
import { Loader2, Image as ImageIcon } from "lucide-react";
import { toast } from "react-toastify";
import { uploadChatBackgroundFile, updateChatbotUIChatBackground } from "../services/api";

/* Watermark first — best for photos; Cover fills the area */
const STYLES = ["watermark", "cover", "pattern"];

export default function ChatBackgroundSettings({
  chatbotId,
  enabled,
  imageUrl,
  opacity,
  displayStyle,
  onEnabledChange,
  onImageUrlChange,
  onOpacityChange,
  onStyleChange,
}) {
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !chatbotId) return;
    setUploading(true);
    try {
      const { data } = await uploadChatBackgroundFile(chatbotId, file);
      const publicUrl = data?.publicUrl;
      if (!publicUrl) {
        toast.error("Upload succeeded but no image URL was returned");
        return;
      }
      onImageUrlChange(publicUrl);
      toast.success("Image uploaded — remember to save");
    } catch (err) {
      console.error("Chat background upload error:", err);
      const msg =
        err.response?.data?.error ||
        (err.code === "ERR_NETWORK" ||
        err.code === "ECONNRESET" ||
        err.message?.includes("CONNECTION_RESET")
          ? "Server closed the connection — ensure the API is running on the configured base URL."
          : null) ||
        "Failed to upload image";
      toast.error(msg);
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const handleSave = async () => {
    if (!chatbotId) {
      toast.error("Select a chatbot first");
      return;
    }
    setSaving(true);
    try {
      await updateChatbotUIChatBackground(chatbotId, {
        enabled,
        image_url: imageUrl.trim(),
        opacity: Number(opacity),
        style: displayStyle,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      toast.success("Chat background saved");
    } catch (err) {
      console.error("Save chat background error:", err);
      toast.error(err.response?.data?.error || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <ImageIcon className="h-7 w-7 text-emerald-600" />
          <div>
            <h2 className="text-xl font-semibold text-gray-800">Chat Background</h2>
            <p className="text-sm text-gray-500">
              <strong className="font-medium text-gray-700">Image strength</strong> controls how much the photo shows through the white veil (higher = bolder image).{" "}
              The widget uses more blur at low strength and a sharp photo at high strength (e.g. 80%).{" "}
              For subtle backgrounds, try <strong className="font-medium text-gray-700">Watermark</strong> and <strong className="font-medium text-gray-700">8–12%</strong>.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => onEnabledChange(!enabled)}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
            enabled ? "bg-green-600" : "bg-gray-300"
          } cursor-pointer`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              enabled ? "translate-x-6" : "translate-x-1"
            }`}
          />
        </button>
      </div>

      {enabled && (
        <div className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Background Image</label>
            <div className="flex flex-wrap gap-3 items-center">
              <label className="cursor-pointer bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg px-4 py-3 text-sm text-gray-500 hover:border-emerald-400 hover:text-emerald-700 transition-all">
                {uploading ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Uploading...
                  </span>
                ) : (
                  "Upload image"
                )}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  disabled={uploading}
                  onChange={handleImageUpload}
                />
              </label>
              <span className="text-gray-500 text-sm">JPEG, PNG, WebP, etc. — max 8MB</span>
            </div>
            {imageUrl && (
              <div className="mt-3 rounded-lg overflow-hidden h-24 border border-gray-200 bg-gray-100">
                <img
                  src={imageUrl}
                  alt="Background preview"
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.target.style.display = "none";
                  }}
                />
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Display Style</label>
            <p className="text-xs text-gray-500 mb-2">Cover fills the screen; Watermark uses a smaller tile (better for faces and logos).</p>
            <div className="flex flex-wrap gap-2">
              {STYLES.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => onStyleChange(s)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium capitalize border transition-all ${
                    displayStyle === s
                      ? "bg-emerald-600 text-white border-emerald-600"
                      : "bg-white text-gray-600 border-gray-300 hover:border-emerald-400"
                  }`}
                >
                  {s === "cover" ? "Cover" : s === "watermark" ? "Watermark" : "Pattern"}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Image strength —{" "}
              <span className="text-emerald-600 font-semibold">{opacity}%</span>
            </label>
            <input
              type="range"
              min={5}
              max={80}
              value={opacity}
              onChange={(e) => onOpacityChange(Number(e.target.value))}
              className="w-full accent-emerald-600"
            />
            <div className="flex justify-between text-xs text-gray-400 mt-1">
              <span>Subtle (5%)</span>
              <span>Strong (80%)</span>
            </div>
          </div>

          {enabled && !imageUrl.trim() && (
            <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              Upload an image to see the background in the chat widget, then save.
            </p>
          )}
        </div>
      )}

      <div className="mt-6">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="w-full bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 text-white font-semibold py-2.5 rounded-lg transition-all text-sm flex items-center justify-center gap-2 disabled:opacity-60"
        >
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : saved ? (
            "Saved"
          ) : (
            "Save background settings"
          )}
        </button>
      </div>
    </div>
  );
}
