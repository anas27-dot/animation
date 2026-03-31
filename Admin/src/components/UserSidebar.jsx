import React from "react";
import {
  LayoutDashboard,
  MessageSquare,
  Download,
  FileDown,
  LogOut,
  BarChart3,
  Phone,
  Users,
  History
} from "lucide-react";
import { useLocation } from "react-router-dom";


export default function Sidebar({ chatbotId, isOpen, onClose, company }) {
  const mainMenuItems = [
    {
      name: "Dashboard",
      icon: <LayoutDashboard size={18} />,
      path: "/user/dashboard",
    },
    {
      name: "Analytics",
      icon: <BarChart3 size={18} />,
      path: "/user/analytics",
    },
    {
      name: "Credit History",
      icon: <History size={18} />,
      path: "/user/credit-history",
    },
    {
      name: "Message History",
      icon: <MessageSquare size={18} />,
      path: "/user/message-history",
    },
    // {
    //   name: "Leads",
    //   icon: <Phone size={18} />,
    //   path: "/user/leads",
    // },
    {
      name: "Collected Leads",
      icon: <Users size={18} />,
      path: "/user/collected-leads",
    },
    // {
    //   name: "Download Data",
    //   icon: <Download size={18} />,
    //   path: "/user/download-data",
    // },
    {
      name: "Download Report",
      icon: <FileDown size={18} />,
      path: "/user/download-report",
    },
  ];


  const handleLogout = () => {
    localStorage.clear();
    window.location.href = "/login";
  };

  const location = useLocation();
  const activePath = location.pathname;

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden"
          onClick={onClose}
        />
      )}
      
      {/* Sidebar */}
      <aside className={`w-64 fixed h-screen bg-white shadow-lg border-r border-gray-200 px-6 py-8 flex flex-col justify-between z-50 transition-all duration-300 overflow-hidden ${
        isOpen ? 'translate-x-0' : '-translate-x-full'
      } md:translate-x-0`}>
        
        {/* Top Section */}
        <div className="flex flex-col h-full">
          {/* Logo Section */}
          <div className="flex-shrink-0 mb-8">
            {/* TROIKA TECH Logo */}
            <div className="flex flex-col items-center justify-center mb-4">
              <img 
                src="/dashboard-logo.png" 
                alt="Troika Tech Logo" 
                className="h-14 w-auto object-contain mb-2"
              />
              <h1 className="text-2xl font-bold bg-gradient-to-r from-[#3a2d9c] to-[#017977] bg-clip-text text-transparent">Troika Tech</h1>
            </div>
          </div>

          {/* Main Menu Items */}
          <nav className="flex flex-col gap-1 overflow-y-auto flex-1 min-h-0">
            {mainMenuItems.map((item) => {
              const isActive = item.path === activePath;
              return (
                <a
                  key={item.name}
                  href={item.path}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg text-base font-medium transition-all duration-200 group relative ${
                    isActive
                      ? "bg-gradient-to-r from-[#3a2d9c] to-[#017977] text-white shadow-md"
                      : "text-[#3a2d9c] hover:text-[#017977] hover:bg-gradient-to-r hover:from-purple-50 hover:to-teal-50"
                  }`}
                >
                  <div className={`p-1 rounded ${
                    isActive 
                      ? "bg-white/20" 
                      : "text-[#3a2d9c] group-hover:text-[#017977]"
                  }`}>
                    {item.icon}
                  </div>
                  <span className="flex-1">{item.name}</span>
                </a>
              );
            })}
          </nav>
        </div>

        {/* Bottom Logout Button */}
        <div className="flex-shrink-0 mt-8">
          <button
            onClick={handleLogout}
            className="flex cursor-pointer text-base items-center gap-3 text-red-600 hover:text-red-700 px-4 py-3 rounded-lg hover:bg-red-50 transition-all duration-200 w-full group"
          >
            <div className="p-1 rounded group-hover:bg-red-100 transition-colors duration-200">
              <LogOut size={16} />
            </div>
            <span className="font-medium">Logout</span>
          </button>
        </div>
      </aside>
    </>
  );
}
