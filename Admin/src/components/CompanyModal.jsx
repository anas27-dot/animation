// src/components/CompanyModal.js

import { useState, useEffect } from "react";
import { motion } from "framer-motion"; // Import motion
import { Eye, EyeOff } from "lucide-react"; // Import icons
import api from "../services/api";
import { toast } from "react-toastify";

const CompanyModal = ({ company, onClose, refresh }) => {
  const [formData, setFormData] = useState({
    name: "",
    url: "",
    password: "",
  });

  // ADDED: State for confirm password, visibility, and animation
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [shake, setShake] = useState(false);

  // ADDED: Logic to check if passwords match
  const passwordsMatch = formData.password && confirmPassword && formData.password === confirmPassword;

  useEffect(() => {
    if (company) {
      setFormData({
        name: company.name || "",
        url: company.url || "",
        password: "",
      });
      // Reset confirm password field when modal opens
      setConfirmPassword("");
    }
  }, [company]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prevData) => ({
      ...prevData,
      [name]: value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // MODIFIED: Check for password mismatch only if a new password is entered
    if (formData.password && !passwordsMatch) {
      toast.error("Passwords do not match.");
      setShake(true);
      setTimeout(() => setShake(false), 500); // reset after animation
      return;
    }

    if (!formData.name || !formData.url) {
      toast.error("Name and Domain cannot be empty.");
      return;
    }

    const payload = {
      name: formData.name,
      url: formData.url,
    };

    // Only include the password in the payload if it's new and valid
    if (formData.password && passwordsMatch) {
      payload.password = formData.password;
    }

    try {
      const token = localStorage.getItem("adminToken");
      await api.put(`/company/update/${company._id}`, payload, {
        headers: { Authorization: `Bearer ${token}` },
      });
      toast.success("Company updated successfully! ✨");
      refresh();
      onClose();
    } catch (error) {
      console.error("Error updating company:", error);
      toast.error(error.response?.data?.message || "Failed to update company.");
    }
  };

  if (!company) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-white p-8 rounded-xl shadow-2xl w-full max-w-2xl border border-gray-200">
        <h2 className="text-2xl font-bold mb-6 text-[#1e3a8a]">Edit Company</h2>
        <form onSubmit={handleSubmit}>
          <div className="space-y-6">
            <div>
              <label htmlFor="name" className="block text-gray-700 text-sm font-bold mb-2">
                Company Name
              </label>
              <input
                type="text"
                id="name"
                name="name"
                value={formData.name}
                onChange={handleChange}
                className="shadow appearance-none border border-gray-300 rounded-lg w-full py-3 px-4 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-[#1e3a8a] text-base"
                required
              />
            </div>
            <div>
              <label htmlFor="url" className="block text-gray-700 text-sm font-bold mb-2">
                Domain / URL
              </label>
              <input
                type="text"
                id="url"
                name="url"
                value={formData.url}
                onChange={handleChange}
                className="shadow appearance-none border border-gray-300 rounded-lg w-full py-3 px-4 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-[#1e3a8a] text-base"
                required
              />
            </div>

            {/* MODIFIED: New Password Field */}
            <div className="relative">
              <label htmlFor="password" className="block text-gray-700 text-sm font-bold mb-2">
                New Password (leave blank to keep current)
              </label>
              <input
                type={showPassword ? "text" : "password"}
                id="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                className="shadow appearance-none border rounded w-full py-3 px-4 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500 text-base pr-12"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 top-7 pr-4 flex items-center text-gray-500 hover:text-gray-700"
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>

            {/* ADDED: Confirm Password Field */}
            <motion.div
              animate={shake ? { x: [0, -8, 8, -8, 8, 0] } : { x: 0 }}
              transition={{ duration: 0.4 }}
              className="relative"
            >
              <label htmlFor="confirmPassword" className="block text-gray-700 text-sm font-bold mb-2">
                Confirm New Password
              </label>
              <input
                type={showConfirmPassword ? "text" : "password"}
                id="confirmPassword"
                name="confirmPassword"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="shadow appearance-none border border-gray-300 rounded-lg w-full py-3 px-4 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-[#1e3a8a] text-base pr-12"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute inset-y-0 right-0 top-7 pr-4 flex items-center text-gray-500 hover:text-gray-700"
              >
                {showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </motion.div>

            {/* ADDED: Password Match Indicator */}
            {formData.password && confirmPassword && passwordsMatch && (
              <p className="text-sm -mt-4 text-green-600">✅ Passwords match</p>
            )}

          </div>
          <div className="flex items-center justify-end space-x-4 mt-8">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-lg bg-gray-200 text-gray-800 hover:bg-gray-300 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 rounded-lg bg-[#1e3a8a] hover:bg-[#1e40af] text-white shadow-md transition-colors"
            >
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CompanyModal;