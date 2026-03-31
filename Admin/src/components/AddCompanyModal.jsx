import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Eye, EyeOff } from "lucide-react";
import api from "../services/api";
import { toast } from "react-toastify";

const AddCompanyModal = ({ onClose, onSuccess, emailTemplate }) => {
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [email, setEmail] = useState("");
  const [userName, setUserName] = useState("");
  const [phoneNo, setPhoneNo] = useState("");
  const [managedByName, setManagedByName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [shake, setShake] = useState(false);

  const passwordsMatch =
    password && confirmPassword && password === confirmPassword;

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

  const handleAdd = async () => {
    // Validate all required fields
    if (!name.trim()) {
      toast.error("Company name is required.");
      return;
    }
    if (!url.trim()) {
      toast.error("Domain is required.");
      return;
    }
    if (!email.trim()) {
      toast.error("Email is required.");
      return;
    }
    if (!userName.trim()) {
      toast.error("User name is required.");
      return;
    }
    if (!phoneNo.trim()) {
      toast.error("Phone number is required.");
      return;
    }
    if (!managedByName.trim()) {
      toast.error("Managed by name is required.");
      return;
    }
    if (!password.trim()) {
      toast.error("Password is required.");
      return;
    }
    if (!isPasswordStrong) {
      const errors = [];
      if (!passwordStrength.hasMinLength) {
        errors.push(`At least ${16 - passwordStrength.length} more characters needed`);
      }
      if (!passwordStrength.hasUpperCase) errors.push("Uppercase letter required");
      if (!passwordStrength.hasLowerCase) errors.push("Lowercase letter required");
      if (!passwordStrength.hasNumbers) errors.push("Number required");
      if (!passwordStrength.hasSpecialChar) errors.push("Special character required");

      toast.error(`Weak password: ${errors.join(", ")}`);
      setShake(true);
      setTimeout(() => setShake(false), 500);
      return;
    }
    if (!passwordsMatch) {
      toast.error("Passwords do not match.");
      setShake(true);
      setTimeout(() => setShake(false), 500); // reset after animation
      return;
    }

    try {
      setLoading(true);
      const token = localStorage.getItem("token"); // Use 'token' from AuthContext
      
      // Backend now handles both company and user creation
      const response = await api.post(
        "/company/create",
        {
          name: name.trim(),
          url: url,
          domain: url ? url.replace(/^https?:\/\//, '').replace(/\/$/, '') : undefined,
          email: email.trim(),
          userName: userName.trim(),
          phoneNo: phoneNo.trim(),
          managed_by_name: managedByName.trim(),
          password,
          emailSubject: emailTemplate?.subject,
          emailBody: emailTemplate?.body,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      toast.success(response.data?.message || "Company added successfully.");
      onSuccess();
      onClose();
    } catch (err) {
      const errorMsg = err?.response?.data?.error || err?.response?.data?.message || err?.message || "Failed to add company.";
      toast.error(errorMsg);
      console.error("Failed to add company:", err?.response?.data || err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        key="backdrop"
        // MODIFIED: Removed bg-black/50
        className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <motion.div
          key="modal"
          initial={{ opacity: 0, scale: 0.9, y: -20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: -20 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          className="bg-white border border-gray-200 shadow-2xl rounded-xl p-8 w-full max-w-md"
        >
          <h2 className="text-2xl font-bold text-[#1e3a8a] mb-1">
            Add New Company
          </h2>
          <p className="text-sm text-gray-500 mb-6">
            Fill in the details to create a new company account.
          </p>

          <div className="space-y-4">
            <input
              className="w-full px-4 py-2 border border-gray-300 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-[#1e3a8a] transition-all shadow-sm"
              placeholder="Company Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <input
              className="w-full px-4 py-2 border border-gray-300 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-[#1e3a8a] transition-all shadow-sm"
              placeholder="Domain"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
            <input
              type="email"
              className="w-full px-4 py-2 border border-gray-300 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-[#1e3a8a] transition-all shadow-sm"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <input
              className="w-full px-4 py-2 border border-gray-300 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-[#1e3a8a] transition-all shadow-sm"
              placeholder="User Name"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
            />
            <input
              type="tel"
              className="w-full px-4 py-2 border border-gray-300 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-[#1e3a8a] transition-all shadow-sm"
              placeholder="Phone No"
              value={phoneNo}
              onChange={(e) => setPhoneNo(e.target.value)}
            />
            <input
              className="w-full px-4 py-2 border border-gray-300 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-[#1e3a8a] transition-all shadow-sm"
              placeholder="Managed By Name"
              value={managedByName}
              onChange={(e) => setManagedByName(e.target.value)}
            />

            {/* Password Field */}
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                className="w-full px-4 py-2 border border-gray-200 rounded-xl bg-white/70 focus:outline-none focus:ring-2 focus:ring-blue-400 transition-all pr-10"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-3 flex items-center text-gray-500 hover:text-gray-700"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>

            {/* Password Strength Indicator */}
            {password && (
              <div className={`text-xs font-medium ${isPasswordStrong ? 'text-green-600' : 'text-red-600'}`}>
                {isPasswordStrong ? '✓ 16+ characters and strong password' : '✗ Requires 16+ characters and strong password'}
              </div>
            )}

            {/* Confirm Password Field with shake animation */}
            <motion.div
              animate={
                shake
                  ? { x: [0, -8, 8, -8, 8, 0] }
                  : { x: 0 }
              }
              transition={{ duration: 0.4 }}
              className="relative"
            >
              <input
                type={showConfirmPassword ? "text" : "password"}
                className="w-full px-4 py-2 border border-gray-200 rounded-xl bg-white/70 focus:outline-none focus:ring-2 focus:ring-blue-400 transition-all pr-10"
                placeholder="Confirm Password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
              <button
                type="button"
                onClick={() =>
                  setShowConfirmPassword(!showConfirmPassword)
                }
                className="absolute inset-y-0 right-3 flex items-center text-gray-500 hover:text-gray-700"
              >
                {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </motion.div>

            {/* Password Match Indicator */}
            {password && confirmPassword && passwordsMatch && (
              <p className="text-sm mt-1 text-green-600">
                ✅ Passwords match
              </p>
            )}
          </div>

          <div className="flex justify-end gap-3 mt-8">
            <button
              onClick={onClose}
              className="px-5 py-2 rounded-xl bg-gray-100 text-gray-700 hover:bg-gray-200 transition-all"
            >
              Cancel
            </button>
            <button
              onClick={handleAdd}
              disabled={loading}
              className={`px-6 py-2 rounded-xl text-white font-medium shadow-md transition-all ${
                loading
                  ? "bg-[#1e3a8a]/60 cursor-not-allowed"
                  : "bg-[#1e3a8a] hover:bg-[#1e40af]"
              }`}
            >
              {loading ? "Adding..." : "Add Company"}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default AddCompanyModal;