import { useState, useEffect } from "react";
import api from "../services/api";
import { toast } from "react-toastify";
import { Eye, EyeOff } from "lucide-react";

const EditAdminModal = ({ admin, onClose, refresh }) => {
  const [formData, setFormData] = useState({ name: "", email: "" });
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  // Password strength validation
  const validatePasswordStrength = (pwd) => {
    const minLength = 16;
    const hasUpperCase = /[A-Z]/.test(pwd);
    const hasLowerCase = /[a-z]/.test(pwd);
    const hasNumbers = /\d/.test(pwd);
    const hasSpecialChar = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(pwd);

    return {
      isValid: pwd.length >= minLength && hasUpperCase && hasLowerCase && hasNumbers && hasSpecialChar,
      hasMinLength: pwd.length >= minLength,
      hasUpperCase,
      hasLowerCase,
      hasNumbers,
      hasSpecialChar,
      length: pwd.length
    };
  };

  const passwordStrength = validatePasswordStrength(password);
  const isPasswordStrong = passwordStrength.isValid;

  useEffect(() => {
    if (admin) {
      setFormData({
        name: admin.name || "",
        email: admin.email || "",
      });
      setPassword(""); // Always clear password field on open
    }
  }, [admin]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    // Validate password strength if password is being changed
    if (password && !isPasswordStrong) {
      const errors = [];
      if (!passwordStrength.hasMinLength) {
        errors.push(`At least ${16 - passwordStrength.length} more characters needed`);
      }
      if (!passwordStrength.hasUpperCase) errors.push("Uppercase letter required");
      if (!passwordStrength.hasLowerCase) errors.push("Lowercase letter required");
      if (!passwordStrength.hasNumbers) errors.push("Number required");
      if (!passwordStrength.hasSpecialChar) errors.push("Special character required");

      toast.error(`Weak password: ${errors.join(", ")}`);
      setLoading(false);
      return;
    }

    const payload = { ...formData };
    if (password) {
      payload.password = password; // Only add password to payload if it's changed
    }

    try {
      const token = localStorage.getItem("adminToken");
      await api.put(`/admin/update/${admin._id}`, payload, {
        headers: { Authorization: `Bearer ${token}` },
      });
      toast.success("Admin updated successfully!");
      refresh();
      onClose();
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to update admin.");
    } finally {
      setLoading(false);
    }
  };

  if (!admin) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-white p-8 rounded-xl shadow-2xl w-full max-w-lg border border-gray-200">
        <h2 className="text-2xl font-bold mb-6 text-[#1e3a8a]">Edit Admin: {admin.name}</h2>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="name" className="block text-sm font-bold text-gray-700 mb-2">
              Admin Name
            </label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1e3a8a] shadow-sm"
              required
            />
          </div>
          <div>
            <label htmlFor="email" className="block text-sm font-bold text-gray-700 mb-2">
              Admin Email
            </label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1e3a8a] shadow-sm"
              required
            />
          </div>
          <div className="relative">
            <label htmlFor="password" className="block text-sm font-bold text-gray-700 mb-2">
              New Password (leave blank to keep current)
            </label>
            <input
              type={showPassword ? "text" : "password"}
              id="password"
              name="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full p-3 border border-gray-300 rounded-lg pr-12 focus:ring-2 focus:ring-[#1e3a8a] shadow-sm"
            />
            <button
              type="button"
              onClick={() => setShowPassword((p) => !p)}
              className="absolute right-4 top-10 text-gray-500"
            >
              {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>

          {/* Password Strength Indicator */}
          {password && (
            <div className={`text-xs font-medium mt-1 ${isPasswordStrong ? 'text-green-600' : 'text-red-600'}`}>
              {isPasswordStrong ? '✓ 16+ characters and strong password' : '✗ Requires 16+ characters and strong password'}
            </div>
          )}

          <div className="flex justify-end gap-4 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2 rounded-lg bg-gray-200 text-gray-800 hover:bg-gray-300"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2 rounded-lg bg-[#1e3a8a] text-white hover:bg-[#1e40af] disabled:opacity-50 shadow-md transition-colors"
            >
              {loading ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditAdminModal;
