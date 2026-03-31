import { NavLink } from "react-router-dom";
import { useAuth } from "../context/AuthContext"; // Import the useAuth hook
import { useState } from "react";
import {
  LayoutDashboard,
  Building2,
  Bot,
  LogOut,
  ShieldCheck,
  Menu,
  X,
  Palette,
  History,
  Mail,
  Gift,
  User,
} from "lucide-react";

const Sidebar = ({ isOpen, onClose }) => {
  // Use the user and logout function from the AuthContext
  const { user, logout } = useAuth();

  const navItemClass = ({ isActive }) =>
    `flex items-center px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 ${isActive
      ? "bg-blue-500 text-white font-semibold shadow-md"
      : "text-white/80 hover:bg-blue-600/50 hover:text-white"
    }`;

  // Helper to get initials from name
  const getInitials = (name = "") =>
    name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase();

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
      <aside className={`h-screen fixed w-64 bg-[#1e3a8a] border-r border-blue-800 p-4 flex flex-col justify-between shadow-2xl z-50 transition-transform duration-300 overflow-hidden ${isOpen ? 'translate-x-0' : '-translate-x-full'
        } md:translate-x-0`}>
        <div className="flex flex-col h-full">
          <div className="flex-shrink-0">
            <h2 className="text-2xl font-bold text-white mb-6 text-center tracking-wide">
              Supa Agent
            </h2>

            {/* --- ADDED: Profile Info Section --- */}
            {user && (
              <div className="flex flex-col items-center mb-6 border-b border-blue-700/50 pb-6">
                <div className="w-16 h-16 bg-gradient-to-br from-blue-400 to-teal-400 rounded-full flex items-center justify-center text-white text-2xl font-bold mb-2 shadow-lg ring-4 ring-blue-500/30">
                  {getInitials(user.name)}
                </div>
                <p className="font-semibold text-white text-md">{user.name}</p>
                <p className="text-xs text-white bg-blue-600 rounded-full px-3 py-1 mt-1 font-medium tracking-wide">
                  {user.isSuperAdmin ? "Super Admin" : "Admin"}
                </p>
              </div>
            )}
            {/* --- END: Profile Info Section --- */}
          </div>

          <nav className="space-y-2 overflow-y-auto flex-1 min-h-0">
            <NavLink to="/dashboard/overview" className={navItemClass}>
              <LayoutDashboard className="mr-3 h-5 w-5" />
              Overview
            </NavLink>

            <NavLink to="/dashboard/companies" className={navItemClass}>
              <Building2 className="mr-3 h-5 w-5" />
              Manage Companies
            </NavLink>

            <NavLink to="/dashboard/chatbots" className={navItemClass}>
              <Bot className="mr-3 h-5 w-5" />
              Manage Chatbots
            </NavLink>

            <NavLink to="/dashboard/users" className={navItemClass}>
              <User className="mr-3 h-5 w-5" />
              Manage Users
            </NavLink>

            <NavLink to="/dashboard/manage-chatbot-ui" className={navItemClass}>
              <Palette className="mr-3 h-5 w-5" />
              Manage Chatbot UI
            </NavLink>

            <NavLink to="/dashboard/client-offers" className={navItemClass}>
              <Gift className="mr-3 h-5 w-5" />
              Client Offers
            </NavLink>

            <NavLink to="/dashboard/credit-history" className={navItemClass}>
              <History className="mr-3 h-5 w-5" />
              Credit History
            </NavLink>


            <NavLink to="/dashboard/daily-email" className={navItemClass}>
              <Mail className="mr-3 h-5 w-5" />
              Daily Email Send
            </NavLink>

            {/* This link is now only visible to super admins */}
            {user && user.isSuperAdmin && (
              <NavLink to="/dashboard/manage-admins" className={navItemClass}>
                <ShieldCheck className="mr-3 h-5 w-5" />
                Manage Admins
              </NavLink>
            )}
          </nav>
        </div>

        <div className="flex-shrink-0">
          <button
            onClick={logout} // Use the logout function from the context
            className="flex cursor-pointer items-center px-4 py-2 rounded-lg text-sm font-medium text-white/80 hover:text-white hover:bg-red-600 transition-all duration-300 w-full"
          >
            <LogOut className="mr-3 h-5 w-5" />
            Logout
          </button>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;