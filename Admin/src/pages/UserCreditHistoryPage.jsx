import React, { useState, useEffect } from "react";
import { Loader2, History as HistoryIcon, Calendar, TrendingUp, Building2, Bot } from "lucide-react";
import { toast } from "react-toastify";
import { getCompanyCreditHistory, fetchUserCompany } from "../services/api";
import { useAuth } from "../context/AuthContext";

const UserCreditHistoryPage = () => {
  const { token, user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [company, setCompany] = useState(null);
  const [creditHistory, setCreditHistory] = useState([]);
  const [expandedRows, setExpandedRows] = useState(new Set());

  useEffect(() => {
    if (token) {
      fetchUserData();
    }
  }, [token]);

  const fetchUserData = async () => {
    setLoading(true);
    try {
      // First get user's company
      const companyResponse = await fetchUserCompany();
      const userCompany = companyResponse.data?.company || companyResponse.data;
      setCompany(userCompany);

      if (userCompany?._id) {
        // Then fetch credit history for the company
        const historyResponse = await getCompanyCreditHistory(userCompany._id);
        const history = historyResponse.data?.data?.history || [];

        // Sort by date (newest first)
        history.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        setCreditHistory(history);
      }
    } catch (error) {
      console.error("Failed to fetch credit history:", error);
      toast.error("Failed to load credit history");
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const toggleRowExpansion = (index) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedRows(newExpanded);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        <span className="ml-2 text-gray-600">Loading credit history...</span>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-[#1e3a8a] mb-2">Credit History</h1>
        <p className="text-gray-600">View credit transaction history for {company?.name || "your company"}</p>
      </div>

      {/* Credit History Table */}
      {creditHistory.length === 0 ? (
        <div className="bg-white rounded-lg shadow-md p-12 text-center border border-gray-200">
          <HistoryIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600 text-lg mb-2">
            No credit history found
          </p>
          <p className="text-gray-500 text-sm mt-2">
            Credit history will appear here when your admin adds or updates credits for your company.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-lg overflow-hidden border border-gray-200">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gradient-to-r from-[#1e3a8a] to-[#2563eb] text-white uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">Date & Time</th>
                  <th className="px-4 py-3 text-left font-semibold">Company</th>
                  <th className="px-4 py-3 text-center font-semibold">Credits Added</th>
                  <th className="px-4 py-3 text-center font-semibold">Previous State</th>
                  <th className="px-4 py-3 text-center font-semibold">New State</th>
                  <th className="px-4 py-3 text-left font-semibold">Admin</th>
                  <th className="px-4 py-3 text-center font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {creditHistory.map((entry, idx) => {
                  const isExpanded = expandedRows.has(idx);
                  return (
                    <React.Fragment key={`${entry._id || entry.companyId}-${idx}`}>
                      <tr
                        className={`hover:bg-gray-50 cursor-pointer ${
                          idx % 2 === 0 ? "bg-white" : "bg-gray-50"
                        }`}
                        onClick={() => toggleRowExpansion(idx)}
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <Calendar className="text-gray-400" size={16} />
                            <span className="font-medium">{formatDate(entry.created_at)}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <Building2 className="text-gray-400" size={16} />
                            <span className="font-medium">{entry.companyName || company?.name || "—"}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="inline-flex items-center gap-1 px-3 py-1 bg-green-100 text-green-800 rounded-full font-semibold">
                            <TrendingUp size={14} />
                            +{entry.credits_added || 0}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center text-xs text-gray-600">
                          <div>Total: {entry.previous_total_credits || 0}</div>
                          <div>Used: {entry.previous_used_credits || 0}</div>
                          <div>Remaining: {entry.previous_remaining_credits || 0}</div>
                        </td>
                        <td className="px-4 py-3 text-center text-xs font-semibold text-blue-700">
                          <div>Total: {entry.new_total_credits || 0}</div>
                          <div>Used: {entry.new_used_credits || 0}</div>
                          <div>Remaining: {entry.new_remaining_credits || 0}</div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <Bot className="text-gray-400" size={16} />
                            <span className="text-gray-700">
                              {entry.admin_email || entry.admin_id?.email || "—"}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button className="text-blue-600 hover:text-blue-800 font-medium">
                            {isExpanded ? "Hide" : "View"}
                          </button>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr className="bg-blue-50">
                          <td colSpan="7" className="px-4 py-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div>
                                <h4 className="font-semibold text-gray-700 mb-2">Previous State</h4>
                                <div className="bg-white rounded p-3 space-y-1 text-sm">
                                  <div className="flex justify-between">
                                    <span className="text-gray-600">Total Credits:</span>
                                    <span className="font-medium">{entry.previous_total_credits || 0}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-gray-600">Used Credits:</span>
                                    <span className="font-medium text-orange-600">
                                      {entry.previous_used_credits || 0}
                                    </span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-gray-600">Remaining Credits:</span>
                                    <span className="font-medium text-green-600">
                                      {entry.previous_remaining_credits || 0}
                                    </span>
                                  </div>
                                </div>
                              </div>
                              <div>
                                <h4 className="font-semibold text-gray-700 mb-2">New State</h4>
                                <div className="bg-white rounded p-3 space-y-1 text-sm">
                                  <div className="flex justify-between">
                                    <span className="text-gray-600">Total Credits:</span>
                                    <span className="font-medium text-blue-700">
                                      {entry.new_total_credits || 0}
                                    </span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-gray-600">Used Credits:</span>
                                    <span className="font-medium">
                                      {entry.new_used_credits || 0}
                                    </span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-gray-600">Remaining Credits:</span>
                                    <span className="font-medium text-green-600">
                                      {entry.new_remaining_credits || 0}
                                    </span>
                                  </div>
                                </div>
                              </div>
                              {entry.reason && (
                                <div className="md:col-span-2">
                                  <h4 className="font-semibold text-gray-700 mb-2">Reason/Note</h4>
                                  <div className="bg-white rounded p-3 text-sm text-gray-700">
                                    {entry.reason}
                                  </div>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserCreditHistoryPage;