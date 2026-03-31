import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext"; // Import the useAuth hook
import { adminLogin, userLogin } from "../services/api";
import { Eye, EyeOff } from "lucide-react";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

const LoginPage = () => {
  console.log("📄 [LOGIN] LoginPage component rendered");
  const { login } = useAuth(); // Use the login function from the context
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  
  // Log when component mounts
  useEffect(() => {
    console.log("📄 [LOGIN] LoginPage component mounted");
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    console.log("🚀 [LOGIN] handleLogin called with email:", email);
    console.log("🚀 [LOGIN] Form submitted, starting login process...");
    setLoading(true);

    // Helper function to check if error is deactivation
    const isDeactivationError = (error) => {
      // Check multiple possible locations for error message
      const errorMsg = error?.response?.data?.message || 
                      error?.response?.data?.error ||
                      error?.message || 
                      error?.response?.message ||
                      "";
      
      console.log("🔍 [LOGIN] Checking error:", {
        status: error?.response?.status,
        message: errorMsg,
        fullError: error?.response?.data
      });
      
      const isDeactivated = errorMsg.toLowerCase().includes("deactivated") || 
                            errorMsg.toLowerCase().includes("inactive") || 
                            errorMsg.toLowerCase().includes("all chatbots are currently inactive") ||
                            errorMsg.toLowerCase().includes("currently inactive");
      
      if (isDeactivated) {
        console.log("🔴 [LOGIN] Deactivation error detected:", errorMsg);
      }
      
      return isDeactivated;
    };

    try {
      // Try admin login first
      let res;
      try {
        console.log("🔵 [LOGIN] Attempting admin login...");
        res = await adminLogin({
          email,
          password,
        });
        console.log("✅ [LOGIN] Admin login successful:", res.data);
      } catch (adminErr) {
        console.log("⚠️ [LOGIN] Admin login failed:", {
          status: adminErr.response?.status,
          message: adminErr.response?.data?.message,
          data: adminErr.response?.data
        });
        
        // Check for deactivation error immediately
        if (isDeactivationError(adminErr)) {
          console.log("🔴 [LOGIN] Deactivation detected! Redirecting to deactivated page (admin error)");
          setLoading(false);
          // Clear any partial auth data
          localStorage.removeItem("token");
          localStorage.removeItem("user");
          localStorage.removeItem("role");
          // Use window.location.replace for immediate redirect (prevents back button)
          console.log("🔴 [LOGIN] Executing redirect: window.location.replace('/account-deactivated')");
          window.location.replace("/account-deactivated");
          return;
        }
        
        // If admin login fails with 401, try user login
        if (adminErr.response?.status === 401) {
          console.log("🔵 [LOGIN] Admin login returned 401, trying user login...");
          // Try user login
          try {
            res = await userLogin({
              email,
              password,
            });
            console.log("✅ [LOGIN] User login successful:", res.data);
          } catch (userErr) {
            console.log("⚠️ [LOGIN] User login error caught:", {
              status: userErr.response?.status,
              message: userErr.response?.data?.message,
              data: userErr.response?.data,
              fullError: userErr
            });
            
            // Check for deactivation error immediately
            if (isDeactivationError(userErr)) {
              console.log("🔴 [LOGIN] Deactivation detected! Redirecting to deactivated page (user error)");
              console.log("🔴 [LOGIN] Error details:", userErr.response?.data);
              setLoading(false);
              // Clear any partial auth data
              localStorage.removeItem("token");
              localStorage.removeItem("user");
              localStorage.removeItem("role");
              // Use window.location for immediate redirect (no React navigation delay)
              console.log("🔴 [LOGIN] Executing redirect: window.location.replace('/account-deactivated')");
              // Force redirect immediately - use replace to prevent back button
              window.location.replace("/account-deactivated");
              // Don't continue execution
              return;
            }
            
            // Re-throw user error if not deactivation
            throw userErr;
          }
        } else {
          // Re-throw admin error if not 401
          throw adminErr;
        }
      }

      // The login function from the context now handles everything:
      // setting state, localStorage, and navigating.
      login(res.data);

      toast.success("Login successful 🎉");
    } catch (err) {
      console.error("Login error:", err);
      
      // Final check for deactivation error
      if (isDeactivationError(err)) {
        console.log("🔴 [LOGIN] Deactivation detected! Redirecting to deactivated page (final catch)");
        console.log("🔴 [LOGIN] Error details:", err.response?.data);
        setLoading(false);
        // Clear any partial auth data
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        localStorage.removeItem("role");
        // Use window.location.replace for immediate redirect (prevents back button)
        console.log("🔴 [LOGIN] Executing redirect: window.location.replace('/account-deactivated')");
        window.location.replace("/account-deactivated");
        return;
      }
      
      const errorMsg = err.response?.data?.message || err.message || "Login failed. Please try again.";
      toast.error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-white to-blue-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-8 border border-gray-200">
        <div className="text-center mb-6">
          <h1 className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-teal-500">
            Troika Tech
          </h1>
          <p className="text-gray-600 mt-2 text-sm">
            AI Agent Management Dashboard
          </p>
        </div>

        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label className="block mb-1 text-sm font-medium text-gray-700">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400 transition"
              placeholder="admin@troika.ai"
            />
          </div>

          <div>
            <label className="block mb-1 text-sm font-medium text-gray-700">
              Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg shadow-sm pr-10 focus:outline-none focus:ring-2 focus:ring-blue-400 transition"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-3 flex items-center text-gray-500 hover:text-gray-800"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className={`w-full cursor-pointer bg-gradient-to-r from-blue-600 to-teal-500 text-white py-2.5 rounded-lg font-semibold shadow-md transition-all ${
              loading
                ? "opacity-60 cursor-not-allowed"
                : "hover:from-blue-500 hover:to-teal-400"
            }`}
          >
            {loading ? (
              <div className="flex items-center justify-center gap-2">
                {/* SVG Loader */}
                <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
                </svg>
                Logging in...
              </div>
            ) : (
              "Login to Dashboard"
            )}
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-gray-400">
          &copy; {new Date().getFullYear()}{" "}
          <span className="text-gray-600 font-medium">Troika Tech</span>. All
          rights reserved.
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
