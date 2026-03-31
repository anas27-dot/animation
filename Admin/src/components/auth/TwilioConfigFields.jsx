import React from "react";
import { Eye, EyeOff } from "lucide-react";

const TwilioConfigFields = ({ config, setConfig, showPassword, setShowPassword }) => {
  return (
    <>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Account SID <span className="text-red-500">*</span>
        </label>
        <div className="relative">
          <input
            type={showPassword.twilio_account_sid ? "text" : "password"}
            value={config.provider_config?.account_sid || ""}
            onChange={(e) =>
              setConfig({
                ...config,
                provider_config: {
                  ...config.provider_config,
                  account_sid: e.target.value,
                },
              })
            }
            placeholder="Enter Twilio Account SID"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1e3a8a] pr-10"
            required
          />
          <button
            type="button"
            onClick={() =>
              setShowPassword({
                ...showPassword,
                twilio_account_sid: !showPassword.twilio_account_sid,
              })
            }
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            {showPassword.twilio_account_sid ? (
              <EyeOff size={18} />
            ) : (
              <Eye size={18} />
            )}
          </button>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Auth Token <span className="text-red-500">*</span>
        </label>
        <div className="relative">
          <input
            type={showPassword.twilio_auth_token ? "text" : "password"}
            value={config.provider_config?.auth_token || ""}
            onChange={(e) =>
              setConfig({
                ...config,
                provider_config: {
                  ...config.provider_config,
                  auth_token: e.target.value,
                },
              })
            }
            placeholder="Enter Twilio Auth Token"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1e3a8a] pr-10"
            required
          />
          <button
            type="button"
            onClick={() =>
              setShowPassword({
                ...showPassword,
                twilio_auth_token: !showPassword.twilio_auth_token,
              })
            }
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            {showPassword.twilio_auth_token ? (
              <EyeOff size={18} />
            ) : (
              <Eye size={18} />
            )}
          </button>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          WhatsApp From Number <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={config.provider_config?.whatsapp_from || ""}
          onChange={(e) =>
            setConfig({
              ...config,
              provider_config: {
                ...config.provider_config,
                whatsapp_from: e.target.value,
              },
            })
          }
          placeholder="whatsapp:+14155238886"
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]"
          required
        />
        <p className="mt-1 text-xs text-gray-500">
          Format: whatsapp:+[country code][number]
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          OTP Template SID (Optional)
        </label>
        <input
          type="text"
          value={config.provider_config?.otp_template_sid || ""}
          onChange={(e) =>
            setConfig({
              ...config,
              provider_config: {
                ...config.provider_config,
                otp_template_sid: e.target.value,
              },
            })
          }
          placeholder="Enter Content Template SID"
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]"
        />
        <p className="mt-1 text-xs text-gray-500">
          Twilio Content Template SID for OTP messages
        </p>
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

export default TwilioConfigFields;

