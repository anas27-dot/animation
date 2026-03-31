import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AlertCircle, LogOut, Mail, Phone } from "lucide-react";

const AccountDeactivatedPage = () => {
  const navigate = useNavigate();

  useEffect(() => {
    // Clear token on mount
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    localStorage.removeItem("role");
    console.log("🔴 [AccountDeactivatedPage] Page loaded and auth data cleared");
    console.log("🔴 [AccountDeactivatedPage] Current pathname:", window.location.pathname);
  }, []);

  const handleGoToLogin = () => {
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
          {/* Icon */}
          <div className="mx-auto w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mb-6">
            <AlertCircle className="w-10 h-10 text-red-600" />
          </div>

          {/* Title */}
          <h1 className="text-3xl font-bold text-gray-900 mb-3">
            Account Deactivated
          </h1>

          {/* Message */}
          <p className="text-gray-600 mb-6 leading-relaxed">
            Your account has been deactivated. All chatbots associated with your account are currently inactive.
          </p>

          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6 text-left">
            <p className="text-sm text-yellow-800">
              <strong>What does this mean?</strong>
            </p>
            <p className="text-sm text-yellow-700 mt-2">
              Your access to the dashboard has been temporarily suspended. This typically happens when all chatbots under your account have been deactivated by an administrator.
            </p>
          </div>

          {/* Contact Information */}
          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <p className="text-sm font-semibold text-gray-700 mb-3">
              Need help? Contact support:
            </p>
            <div className="space-y-2 text-sm text-gray-600">
              <div className="flex items-center justify-center gap-2">
                <Mail className="w-4 h-4" />
                <span>support@troikatech.in</span>
              </div>
              <div className="flex items-center justify-center gap-2">
                <Phone className="w-4 h-4" />
                <span>+91 8261903871</span>
              </div>
            </div>
          </div>

          {/* Action Button */}
          <button
            onClick={handleGoToLogin}
            className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-semibold py-3 px-6 rounded-lg transition-all duration-200 flex items-center justify-center gap-2 shadow-lg"
          >
            <LogOut className="w-5 h-5" />
            Return to Login
          </button>

          {/* Footer Note */}
          <p className="text-xs text-gray-500 mt-6">
            If you believe this is an error, please contact support immediately.
          </p>
        </div>
      </div>
    </div>
  );
};

export default AccountDeactivatedPage;

