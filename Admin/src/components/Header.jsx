import { Menu } from "lucide-react";
import api from "../services/api";
import { useState, useEffect } from "react";

export default function Header({ onMenuClick }) {
  const token = localStorage.getItem("token");
  const [companyName, setCompanyName] = useState("");

  if (!token) {
    window.location.href = "/";
  }

  // Fetch company name on component mount
  useEffect(() => {
    const fetchCompanyName = async () => {
      try {
        console.log("🔍 Fetching company name with token:", token ? "present" : "missing");
        const res = await api.get("/user/company", {
          headers: { Authorization: `Bearer ${token}` },
        });
        console.log("📊 Company API response:", res.data);
        setCompanyName(res.data.data?.name || "");
      } catch (err) {
        console.error("❌ Failed to fetch company name:", err);
        // Set a fallback company name for testing
        setCompanyName("Demo Company");
      }
    };

    if (token) {
      fetchCompanyName();
    }
  }, [token]);

  return (
    <header className="flex justify-between items-center px-4 md:px-6 py-4 md:py-6 bg-white border-b border-gray-200 shadow-sm">
      <div className="flex items-center space-x-3">
        {/* Mobile Menu Button */}
        <button
          onClick={onMenuClick}
          className="md:hidden p-2 rounded-lg hover:bg-gray-100 transition-colors"
        >
          <Menu size={24} className="text-gray-600" />
        </button>
        
        <div>
          <h1 className="text-gray-800 font-bold text-xl md:text-2xl font-['Exo_2',sans-serif]">
            User Dashboard
          </h1>
        </div>
      </div>

      <div className="flex items-center space-x-2 md:space-x-4">
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-gray-600 text-sm md:text-base font-['Exo_2',sans-serif]">
              Welcome Back ! {companyName || "User"}
            </p>
          </div>
          <div className="w-10 h-10 bg-gradient-to-r from-[#3a2d9c] to-[#017977] rounded-full flex items-center justify-center shadow-lg">
            <span className="text-white font-bold text-lg">
              {(companyName || "U").charAt(0).toUpperCase()}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}
