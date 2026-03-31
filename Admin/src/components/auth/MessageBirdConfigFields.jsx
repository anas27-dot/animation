import React from "react";
import { Eye, EyeOff } from "lucide-react";

const MessageBirdConfigFields = ({ config, setConfig, showPassword, setShowPassword }) => {
  return (
    <>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          API Key <span className="text-red-500">*</span>
        </label>
        <div className="relative">
          <input
            type={showPassword.messagebird_api_key ? "text" : "password"}
            value={config.provider_config?.api_key || ""}
            onChange={(e) =>
              setConfig({
                ...config,
                provider_config: {
                  ...config.provider_config,
                  api_key: e.target.value,
                },
              })
            }
            placeholder="Enter MessageBird API key"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1e3a8a] pr-10"
            required
          />
          <button
            type="button"
            onClick={() =>
              setShowPassword({
                ...showPassword,
                messagebird_api_key: !showPassword.messagebird_api_key,
              })
            }
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            {showPassword.messagebird_api_key ? (
              <EyeOff size={18} />
            ) : (
              <Eye size={18} />
            )}
          </button>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Channel ID <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={config.provider_config?.channel_id || ""}
          onChange={(e) =>
            setConfig({
              ...config,
              provider_config: {
                ...config.provider_config,
                channel_id: e.target.value,
              },
            })
          }
          placeholder="Enter MessageBird channel ID"
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Template Name (Optional)
        </label>
        <input
          type="text"
          value={config.provider_config?.template_name || ""}
          onChange={(e) =>
            setConfig({
              ...config,
              provider_config: {
                ...config.provider_config,
                template_name: e.target.value,
              },
            })
          }
          placeholder="otp_template"
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Country Code
        </label>
        <input
          type="text"
          value={config.provider_config?.country_code || "91"}
          onChange={(e) =>
            setConfig({
              ...config,
              provider_config: {
                ...config.provider_config,
                country_code: e.target.value.replace(/\D/g, ""),
              },
            })
          }
          placeholder="91"
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]"
        />
      </div>
    </>
  );
};

export default MessageBirdConfigFields;

