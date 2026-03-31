import { useState } from "react";
import api from "../services/api";
import { toast } from "react-toastify";

const CrawlerToggle = ({ company, onUpdate }) => {
  const [crawlerEnabled, setCrawlerEnabled] = useState(company.settings?.crawler?.enabled || false);
  const [isUpdating, setIsUpdating] = useState(false);

  const handleToggle = async () => {
    setIsUpdating(true);
    try {
      const response = await api.put(`/admin/companies/${company._id}/crawler`, {
        enabled: !crawlerEnabled
      });

      if (response.data.success) {
        setCrawlerEnabled(!crawlerEnabled);
        toast.success(`Web crawler ${!crawlerEnabled ? 'enabled' : 'disabled'} for ${company.name}`);
        if (onUpdate) onUpdate();
      }
    } catch (error) {
      console.error('Failed to update crawler settings:', error);
      toast.error('Failed to update crawler settings');
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <label className="relative inline-flex items-center cursor-pointer">
      <input
        type="checkbox"
        className="sr-only peer"
        checked={crawlerEnabled}
        onChange={handleToggle}
        disabled={isUpdating}
      />
      <div className={`w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[""] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600 ${isUpdating ? 'opacity-50' : ''}`}></div>
      {isUpdating && (
        <span className="ml-3 text-sm font-medium text-gray-500">
          Updating...
        </span>
      )}
    </label>
  );
};

export default CrawlerToggle;