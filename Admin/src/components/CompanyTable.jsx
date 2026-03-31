import { useState } from "react";
import UploadContextModal from "./UploadContextModal";
import AddChatbotModal from "./AddChatbotModal";
import CrawlerToggle from "./CrawlerToggle";
import api from "../services/api";
import { toast } from "react-toastify";
import { addCompanyCredits } from "../services/api";

// --- ADDED: Skeleton Loader Component ---
const SkeletonRow = () => (
  <tr className="bg-white/70">
    <td className="p-2 md:p-4">
      <div className="h-4 bg-gray-300 rounded animate-pulse"></div>
    </td>
    <td className="p-2 md:p-4">
      <div className="h-4 bg-gray-300 rounded animate-pulse"></div>
    </td>
    <td className="p-2 md:p-4">
      <div className="h-8 w-16 bg-gray-300 rounded-lg animate-pulse"></div>
    </td>
    <td className="p-2 md:p-4">
      <div className="h-8 w-24 bg-gray-300 rounded-lg animate-pulse"></div>
    </td>
    <td className="p-2 md:p-4">
      <div className="h-8 w-20 bg-gray-300 rounded-lg animate-pulse"></div>
    </td>
    <td className="p-2 md:p-4">
      <div className="h-8 w-20 bg-gray-300 rounded-lg animate-pulse"></div>
    </td>
  </tr>
);

const TableSkeleton = ({ rows = 5 }) => (
  <div className="overflow-x-auto rounded-xl shadow-lg border border-gray-200 bg-white table-container hide-scrollbar">
    <table className="w-full text-xs md:text-sm text-left text-gray-700 min-w-[600px]">
      <thead className="bg-gradient-to-r from-[#1e3a8a] to-[#2563eb] text-white uppercase tracking-wider">
        <tr>
          <th className="p-2 md:p-4">Name</th>
          <th className="p-2 md:p-4">Domain</th>
          <th className="p-2 md:p-4">Crawler</th>
          <th className="p-2 md:p-4">Upload</th>
          <th className="p-2 md:p-4">Del Chatbot</th>
          <th className="p-2 md:p-4">Del Company</th>
        </tr>
      </thead>
      <tbody>
        {Array.from({ length: rows }).map((_, index) => (
          <SkeletonRow key={index} />
        ))}
      </tbody>
    </table>
  </div>
);
// --- END: Skeleton Loader Component ---

const CompanyTable = ({ companies, refresh, onEditCompany, loading }) => { // 👈 ADDED loading prop
  const [selectedCompanyForAdd, setSelectedCompanyForAdd] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);

  const handleCreateChatbot = async (companyId, name, initialCredits) => {
    try {
      // Use the correct endpoint path - backend route is /api/chatbot/create
      // The api interceptor will automatically add the Authorization header
      // initialCredits is now required
      if (initialCredits === null || initialCredits === undefined || initialCredits < 0) {
        toast.error("Initial credits is required and must be 0 or greater");
        return;
      }

      const payload = { companyId, name, initial_credits: initialCredits };
      await api.post("/chatbot/create", payload);

      // Also add the initial credits to the company's credit balance
      // This ensures the credits are reflected in the REMAINING CREDITS section
      // Pass 0 duration to clear any existing expiration when adding initial credits
      if (initialCredits > 0) {
        await addCompanyCredits(companyId, initialCredits, 0, `Initial credits for chatbot: ${name}`);
      }

      toast.success(`Chatbot created and ${initialCredits} credits assigned ✅`);
      refresh();
    } catch (error) {
      console.error(
        "Error creating chatbot:",
        error.response?.data || error.message
      );
      toast.error(error.response?.data?.message || "Failed to create chatbot.");
    }
  };

  const handleDeleteChatbot = async (e, chatbotId) => {
    e.stopPropagation();
    if (!window.confirm("Are you sure you want to delete this chatbot?"))
      return;

    try {
      // The api interceptor will automatically add the Authorization header
      await api.delete(`/chatbot/delete/${chatbotId}`);
      toast.success("Chatbot deleted");
      refresh();
    } catch (error) {
      console.error("Error deleting chatbot:", error);
      toast.error("Failed to delete chatbot.");
    }
  };

  const handleDeleteCompany = async (e, companyId) => {
    e.stopPropagation();
    if (
      !window.confirm(
        "This will delete the company and all its chatbots. Continue?"
      )
    )
      return;

    try {
      // The api interceptor will automatically add the Authorization header
      await api.delete(`/company/delete/${companyId}`);
      toast.success("Company deleted");
      refresh();
    } catch (error) {
      console.error("Error deleting company:", error);
      console.log("Error response data:", error.response?.data); // Debug logging

      // Show specific backend error message if available
      const errorMessage = error.response?.data?.error || error.response?.data?.message || "Failed to delete company.";
      console.log("Using error message:", errorMessage); // Debug logging
      toast.error(errorMessage);
    }
  };

  // 👇 ADDED: Conditional rendering for the skeleton loader
  if (loading) {
    return <TableSkeleton rows={5} />;
  }

  return (
    <div className="overflow-x-auto rounded-xl shadow-lg border border-gray-200 bg-white table-container hide-scrollbar">
      <table className="w-full text-xs md:text-sm text-left text-gray-700 min-w-[600px]">
        <thead className="bg-gradient-to-r from-[#1e3a8a] to-[#2563eb] text-white uppercase tracking-wider">
          <tr>
            <th className="p-2 md:p-4">Name</th>
            <th className="p-2 md:p-4">Domain</th>
            <th className="p-2 md:p-4">Crawler</th>
            <th className="p-2 md:p-4">Upload</th>
            <th className="p-2 md:p-4">Del Chatbot</th>
            <th className="p-2 md:p-4">Del Company</th>
          </tr>
        </thead>
        <tbody>
          {companies.map((company, index) => (
            <tr
              key={company._id}
              onClick={() => onEditCompany(company)}
              className={`transition-all duration-200 hover:shadow-md hover:bg-blue-50 cursor-pointer ${
                index % 2 === 0 ? "bg-white" : "bg-gray-50"
              }`}
            >
              <td className="p-2 md:p-4 font-medium">{company.name}</td>
              <td className="p-2 md:p-4 text-[#1e3a8a] hover:text-[#2563eb] underline transition-colors">{company.domain || company.url || '—'}</td>
              <td className="p-2 md:p-4" onClick={(e) => e.stopPropagation()}>
                <CrawlerToggle company={company} onUpdate={refresh} />
              </td>
              <td className="p-2 md:p-4" onClick={(e) => e.stopPropagation()}>
                {company.chatbots?.length > 0 ? (
                  <UploadContextModal chatbotId={company.chatbots[0]._id} />
                ) : (
                  <span className="text-gray-400">—</span>
                )}
              </td>
              <td className="p-2 md:p-4">
                {Array.isArray(company.chatbots) &&
                company.chatbots.length > 0 ? (
                  <button
                    onClick={(e) =>
                      handleDeleteChatbot(e, company.chatbots[0]._id)
                    }
                    className="px-2 md:px-4 py-1 md:py-1.5 rounded-lg bg-gradient-to-r from-red-500 to-red-600 text-white shadow hover:scale-105 transition-transform text-xs md:text-sm"
                  >
                    <span className="hidden sm:inline">Delete</span>
                    <span className="sm:hidden">Del</span>
                  </button>
                ) : (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedCompanyForAdd(company);
                      setShowAddModal(true);
                    }}
                    className="px-2 md:px-4 py-1 md:py-1.5 rounded-lg bg-gradient-to-r from-green-500 to-green-600 text-white shadow hover:scale-105 transition-transform text-xs md:text-sm"
                  >
                    <span className="hidden sm:inline">Create</span>
                    <span className="sm:hidden">Add</span>
                  </button>
                )}
              </td>
              <td className="p-2 md:p-4">
                <button
                  onClick={(e) => handleDeleteCompany(e, company._id)}
                  className="px-2 md:px-4 py-1 md:py-1.5 rounded-lg bg-gradient-to-r from-gray-500 to-gray-600 text-white shadow hover:scale-105 transition-transform text-xs md:text-sm"
                >
                  <span className="hidden sm:inline">Delete</span>
                  <span className="sm:hidden">Del</span>
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {showAddModal && selectedCompanyForAdd && (
        <AddChatbotModal
          company={selectedCompanyForAdd}
          onClose={() => {
            setSelectedCompanyForAdd(null);
            setShowAddModal(false);
          }}
          onCreate={handleCreateChatbot}
        />
      )}
    </div>
  );
};

export default CompanyTable;