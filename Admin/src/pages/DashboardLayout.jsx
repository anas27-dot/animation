import Sidebar from "../components/Sidebar";
import { Outlet } from "react-router-dom";
import { useState } from "react";
import { Menu } from "lucide-react";

const DashboardLayout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleMenuClick = () => {
    setSidebarOpen(!sidebarOpen);
  };

  const handleSidebarClose = () => {
    setSidebarOpen(false);
  };

  return (
    <div className="bg-[#e0f2fe] min-h-screen text-gray-800">
      <Sidebar isOpen={sidebarOpen} onClose={handleSidebarClose} />
      
      {/* Mobile Header */}
      <div className="md:hidden bg-white shadow-md px-4 py-3 flex items-center justify-between border-b border-gray-200">
        <button
          onClick={handleMenuClick}
          className="p-2 rounded-lg hover:bg-blue-50 transition-colors"
        >
          <Menu size={24} className="text-[#1e3a8a]" />
        </button>
        <h1 className="text-lg font-semibold text-[#1e3a8a]">Admin Dashboard</h1>
        <div className="w-10"></div> {/* Spacer for centering */}
      </div>
      
      <main className="md:ml-64 p-4 md:p-6 bg-[#e0f2fe] min-h-screen overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
};

export default DashboardLayout;
