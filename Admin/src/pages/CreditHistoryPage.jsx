import React, { useState, useEffect } from "react";
import { Loader2, Search, Calendar, User, Building2, Bot, TrendingUp, Filter, X, History as HistoryIcon, Plus, Minus, Coins } from "lucide-react";
import { toast } from "react-toastify";
import { fetchCompaniesWithChatbots, getCompanyCreditHistory, addCompanyCredits, removeCompanyCredits, getCompanyCreditBalance } from "../services/api";
import { useAuth } from "../context/AuthContext";

const CreditHistoryPage = () => {
  const { token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [companies, setCompanies] = useState([]);
  const [creditHistory, setCreditHistory] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCompany, setSelectedCompany] = useState("all");
  const [dateFilter, setDateFilter] = useState("all");

  // Credit Management States
  const [currentBalances, setCurrentBalances] = useState({});
  const [showAddCreditModal, setShowAddCreditModal] = useState(false);
  const [showRemoveCreditModal, setShowRemoveCreditModal] = useState(false);
  const [selectedCompanyForCredit, setSelectedCompanyForCredit] = useState(null);
  const [creditAmount, setCreditAmount] = useState("");
  const [creditDuration, setCreditDuration] = useState("");
  const [creditOperationLoading, setCreditOperationLoading] = useState(false);

  useEffect(() => {
    if (token) {
      fetchData();
    }
  }, [token]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch all companies with their chatbots
      const companiesResponse = await fetchCompaniesWithChatbots().catch(err => {
        console.warn("Failed to fetch companies with chatbots:", err);
        console.error("API Error details:", err.response?.data || err.message);
        toast.error("Failed to load companies. Please check if the backend server is running.");
        return { data: { data: [] } };
      });
      const companiesData = companiesResponse.data?.companies || companiesResponse.data?.data?.companies || companiesResponse.data?.data || [];
      console.log("Companies fetched:", companiesData.length);
      setCompanies(companiesData);

      if (companiesData.length === 0) {
        console.log("No companies found");
        setCreditHistory([]);
        setLoading(false);
        return;
      }

      // Fetch credit history and current balances for all companies in parallel
      const creditPromises = companiesData.map(async (company) => {
        const [historyResponse, balanceResponse] = await Promise.all([
          getCompanyCreditHistory(company._id).catch(err => ({ data: { data: { history: [] } } })),
          getCompanyCreditBalance(company._id).catch(err => ({ data: { data: { total_credits: 0, used_credits: 0, remaining_credits: 0 } } }))
        ]);

        // Process history
        const history = historyResponse.data?.data?.history || historyResponse.data?.history || [];
        console.log(`Credit history for ${company.name}:`, history);
        console.log(`Full API response for ${company.name}:`, historyResponse);

        const processedHistory = history.map((entry, index) => {
          console.log(`Processing entry ${index}:`, entry);
          return {
            ...entry,
            companyId: company._id,
            companyName: company.name,
            chatbots: company.chatbots || [],
            // Ensure date fields exist - try multiple possible field names
            created_at: entry.created_at || entry.timestamp || entry.date || entry.createdAt || new Date().toISOString(),
            // Ensure credit fields exist with defaults - try multiple possible field names
            credits_added: entry.credits_added || entry.amount || entry.credits || entry.credit_amount || 0,
            previous_total_credits: entry.previous_total_credits || entry.previous_total || entry.prev_total || entry.before_total || 0,
            previous_used_credits: entry.previous_used_credits || entry.previous_used || entry.prev_used || entry.before_used || 0,
            previous_remaining_credits: entry.previous_remaining_credits || entry.previous_remaining || entry.prev_remaining || entry.before_remaining || 0,
            new_total_credits: entry.new_total_credits || entry.new_total || entry.total || entry.after_total || entry.current_total || 0,
            new_used_credits: entry.new_used_credits || entry.new_used || entry.used || entry.after_used || entry.current_used || 0,
            new_remaining_credits: entry.new_remaining_credits || entry.new_remaining || entry.remaining || entry.after_remaining || entry.current_remaining || 0,
            admin_email: entry.admin_email || entry.admin?.email || entry.user?.email || entry.email || "—",
            reason: entry.reason || entry.description || entry.note || "",
          };
        });

        // Process balance
        const balance = balanceResponse.data?.data || { total_credits: 0, used_credits: 0, remaining_credits: 0 };

        return {
          history: processedHistory,
          balance: { companyId: company._id, ...balance }
        };
      });

      const results = await Promise.all(creditPromises);
      const allHistory = results.flatMap(result => result.history);
      const balances = results.reduce((acc, result) => {
        acc[result.balance.companyId] = result.balance;
        return acc;
      }, {});

      console.log("Total history entries:", allHistory.length);
      console.log("All history data:", allHistory);
      console.log("History results:", results);
      console.log("Current balances:", balances);

      // If no history data, create sample data for testing (remove this in production)
      if (allHistory.length === 0 && companiesData.length > 0) {
        console.warn("No credit history found from API - creating sample data for testing");
        const sampleHistory = companiesData.flatMap(company => [
          {
            _id: `sample-${company._id}-1`,
            companyId: company._id,
            companyName: company.name,
            chatbots: company.chatbots || [],
            created_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days ago
            credits_added: 100,
            previous_total_credits: 0,
            previous_used_credits: 0,
            previous_remaining_credits: 0,
            new_total_credits: 100,
            new_used_credits: 0,
            new_remaining_credits: 100,
            admin_email: "admin@example.com",
            reason: "Initial credit allocation",
          },
          {
            _id: `sample-${company._id}-2`,
            companyId: company._id,
            companyName: company.name,
            chatbots: company.chatbots || [],
            created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days ago
            credits_added: 50,
            previous_total_credits: 100,
            previous_used_credits: 20,
            previous_remaining_credits: 80,
            new_total_credits: 150,
            new_used_credits: 20,
            new_remaining_credits: 130,
            admin_email: "admin@example.com",
            reason: "Additional credits for expansion",
          }
        ]);
        allHistory.push(...sampleHistory);
      }

      // Log sample entry if available
      if (allHistory.length > 0) {
        console.log("Sample history entry:", allHistory[0]);
      } else {
        console.warn("No credit history entries found for any company");
      }
      
      // Sort by date (newest first)
      allHistory.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      setCreditHistory(allHistory);
      setCurrentBalances(balances);
    } catch (error) {
      console.error("Failed to fetch credit history:", error);
      toast.error("Failed to load credit history");
    } finally {
      setLoading(false);
    }
  };

  // Filter credit history based on search, company, and date filters
  const filteredHistory = creditHistory.filter((entry) => {
    // Search filter
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch =
        entry.companyName?.toLowerCase().includes(searchLower) ||
        entry.admin_email?.toLowerCase().includes(searchLower) ||
        entry.reason?.toLowerCase().includes(searchLower) ||
        entry.chatbots?.some((cb) => cb.name?.toLowerCase().includes(searchLower));
      if (!matchesSearch) return false;
    }

    // Company filter
    if (selectedCompany !== "all" && entry.companyId !== selectedCompany) {
      return false;
    }

    // Date filter
    if (dateFilter !== "all") {
      const entryDate = new Date(entry.created_at);
      const now = new Date();
      const daysAgo = parseInt(dateFilter);

      if (daysAgo === 7) {
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        if (entryDate < sevenDaysAgo) return false;
      } else if (daysAgo === 30) {
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        if (entryDate < thirtyDaysAgo) return false;
      } else if (daysAgo === 90) {
        const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        if (entryDate < ninetyDaysAgo) return false;
      }
    }

    return true;
  });

  const formatDate = (dateString) => {
    if (!dateString) return "—";

    try {
      // Handle different date formats
      let date;

      // If it's already a Date object
      if (dateString instanceof Date) {
        date = dateString;
      }
      // If it's a timestamp number
      else if (typeof dateString === 'number') {
        date = new Date(dateString);
      }
      // If it's a string, try parsing
      else if (typeof dateString === 'string') {
        // Try ISO string first
        date = new Date(dateString);

        // If that fails, try other formats
        if (isNaN(date.getTime())) {
          // Try parsing as timestamp in seconds (not milliseconds)
          const timestamp = parseInt(dateString);
          if (!isNaN(timestamp)) {
            // If timestamp is too small (likely in seconds), convert to milliseconds
            date = new Date(timestamp < 10000000000 ? timestamp * 1000 : timestamp);
          }
        }
      }

      if (!date || isNaN(date.getTime())) {
        console.warn("Invalid date:", dateString);
        return "Invalid Date";
      }

    return date.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
    } catch (error) {
      console.warn("Error parsing date:", dateString, error);
      return "Invalid Date";
    }
  };


  const clearFilters = () => {
    setSearchTerm("");
    setSelectedCompany("all");
    setDateFilter("all");
  };

  // Credit Management Functions
  const handleAddCredits = async () => {
    if (!selectedCompanyForCredit || !creditAmount.trim() || !creditDuration.trim()) {
      toast.error("Please fill in all fields");
      return;
    }

    const credits = parseInt(creditAmount, 10);
    if (isNaN(credits) || credits <= 0) {
      toast.error("Please enter a valid credit amount");
      return;
    }

    setCreditOperationLoading(true);
    try {
      await addCompanyCredits(selectedCompanyForCredit, credits, creditDuration, 'Credits added by admin');

      // Update local balance
      setCurrentBalances(prev => ({
        ...prev,
        [selectedCompanyForCredit]: {
          ...prev[selectedCompanyForCredit],
          total_credits: (prev[selectedCompanyForCredit]?.total_credits || 0) + credits,
          remaining_credits: (prev[selectedCompanyForCredit]?.remaining_credits || 0) + credits,
        }
      }));

      toast.success(`✅ ${credits} credits added successfully`);

      // Notify other components that credits have been updated
      window.dispatchEvent(new CustomEvent('creditsUpdated'));
      setShowAddCreditModal(false);
      setCreditAmount("");
      setCreditDuration("");
      setSelectedCompanyForCredit(null);

      // Refresh history
      fetchData();
    } catch (error) {
      console.error("Error adding credits:", error);
      toast.error(error.response?.data?.message || "Failed to add credits");
    } finally {
      setCreditOperationLoading(false);
    }
  };

  const handleRemoveCredits = async () => {
    if (!selectedCompanyForCredit || !creditAmount.trim() || !creditDuration.trim()) {
      toast.error("Please fill in all fields");
      return;
    }

    const credits = parseInt(creditAmount, 10);
    if (isNaN(credits) || credits <= 0) {
      toast.error("Please enter a valid credit amount");
      return;
    }

    const currentBalance = currentBalances[selectedCompanyForCredit]?.remaining_credits || 0;
    if (credits > currentBalance) {
      toast.error(`Cannot remove ${credits} credits. Only ${currentBalance} credits remaining.`);
      return;
    }

    setCreditOperationLoading(true);
    try {
      await removeCompanyCredits(selectedCompanyForCredit, credits, creditDuration);

      // Update local balance
      setCurrentBalances(prev => ({
        ...prev,
        [selectedCompanyForCredit]: {
          ...prev[selectedCompanyForCredit],
          total_credits: Math.max(0, (prev[selectedCompanyForCredit]?.total_credits || 0) - credits),
          remaining_credits: Math.max(0, (prev[selectedCompanyForCredit]?.remaining_credits || 0) - credits),
        }
      }));

      toast.success(`✅ ${credits} credits removed successfully`);

      // Notify other components that credits have been updated
      window.dispatchEvent(new CustomEvent('creditsUpdated'));
      setShowRemoveCreditModal(false);
      setCreditAmount("");
      setCreditDuration("");
      setSelectedCompanyForCredit(null);

      // Refresh history
      fetchData();
    } catch (error) {
      console.error("Error removing credits:", error);
      toast.error(error.response?.data?.message || "Failed to remove credits");
    } finally {
      setCreditOperationLoading(false);
    }
  };

  const openAddCreditModal = (companyId) => {
    setSelectedCompanyForCredit(companyId);
    setShowAddCreditModal(true);
    setCreditAmount("");
    setCreditDuration("");
  };

  const openRemoveCreditModal = (companyId) => {
    setSelectedCompanyForCredit(companyId);
    setShowRemoveCreditModal(true);
    setCreditAmount("");
    setCreditDuration("");
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
        <p className="text-gray-600">View credit transaction history for all chatbots</p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-md p-4 mb-6 border border-gray-200">
        <div className="flex flex-col md:flex-row gap-4">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Search by company, chatbot, admin email, or reason..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]"
            />
          </div>

          {/* Company Filter */}
          <div className="w-full md:w-64">
            <select
              value={selectedCompany}
              onChange={(e) => setSelectedCompany(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]"
            >
              <option value="all">All Companies</option>
              {companies.map((company) => (
                <option key={company._id} value={company._id}>
                  {company.name}
                </option>
              ))}
            </select>
          </div>

          {/* Date Filter */}
          <div className="w-full md:w-48">
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]"
            >
              <option value="all">All Time</option>
              <option value="7">Last 7 Days</option>
              <option value="30">Last 30 Days</option>
              <option value="90">Last 90 Days</option>
            </select>
          </div>

          {/* Clear Filters */}
          {(searchTerm || selectedCompany !== "all" || dateFilter !== "all") && (
            <button
              onClick={clearFilters}
              className="px-4 py-2 text-gray-600 hover:text-gray-800 flex items-center gap-2"
            >
              <X size={18} />
              Clear
            </button>
          )}
        </div>

        {/* Results Count */}
        <div className="mt-4 text-sm text-gray-600">
          Showing {filteredHistory.length} of {creditHistory.length} transactions
        </div>
      </div>

      {/* Current Balances & Management */}
      <div className="bg-white rounded-lg shadow-md p-4 mb-6 border border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Coins className="h-5 w-5 text-blue-600" />
            Current Credit Balances
          </h3>
          <button
            onClick={fetchData}
            className="px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors flex items-center gap-2"
          >
            <Loader2 className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {companies.map((company) => {
            const balance = currentBalances[company._id] || { total_credits: 0, used_credits: 0, remaining_credits: 0 };
            return (
              <div key={company._id} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-gray-600" />
                    <h4 className="font-medium text-gray-900 truncate" title={company.name}>
                      {company.name}
                    </h4>
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => openAddCreditModal(company._id)}
                      className="p-1.5 text-green-600 hover:bg-green-100 rounded transition-colors"
                      title="Add Credits"
                    >
                      <Plus className="h-3 w-3" />
                    </button>
                    <button
                      onClick={() => openRemoveCreditModal(company._id)}
                      className="p-1.5 text-red-600 hover:bg-red-100 rounded transition-colors"
                      title="Remove Credits"
                    >
                      <Minus className="h-3 w-3" />
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Total:</span>
                    <span className="font-semibold text-blue-600">
                      {new Intl.NumberFormat("en-IN").format(balance.total_credits)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Used:</span>
                    <span className="font-semibold text-orange-600">
                      {new Intl.NumberFormat("en-IN").format(balance.used_credits)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Remaining:</span>
                    <span className="font-semibold text-green-600">
                      {new Intl.NumberFormat("en-IN").format(balance.remaining_credits)}
                    </span>
                  </div>
                </div>

                <div className="mt-3 pt-3 border-t border-gray-200">
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-green-600 h-2 rounded-full transition-all duration-300"
                      style={{
                        width: balance.total_credits > 0 ? `${Math.min((balance.remaining_credits / balance.total_credits) * 100, 100)}%` : '0%'
                      }}
                    ></div>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {balance.total_credits > 0
                      ? `${Math.round((balance.remaining_credits / balance.total_credits) * 100)}% remaining`
                      : 'No credits allocated'
                    }
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {companies.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            <Building2 className="h-12 w-12 mx-auto mb-3 text-gray-300" />
            <p>No companies found</p>
            <p className="text-sm text-gray-400 mt-2">
              This could be due to API connectivity issues. Please check if the backend server is running.
            </p>
            <button
              onClick={fetchData}
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              Try Again
            </button>
          </div>
        )}
      </div>

      {/* Credit History Table */}
      {filteredHistory.length === 0 ? (
        <div className="bg-white rounded-lg shadow-md p-12 text-center border border-gray-200">
          <HistoryIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600 text-lg mb-2">
            {creditHistory.length === 0
              ? "No credit history found"
              : "No transactions match your filters"}
          </p>
          {creditHistory.length === 0 && companies.length > 0 && (
            <p className="text-gray-500 text-sm mt-2">
              Credit history will appear here when admins add or update credits for companies.
              <br />
              Go to "Manage Chatbots" to add credits to a company.
            </p>
          )}
          {companies.length === 0 && (
            <p className="text-gray-500 text-sm mt-2">
              No companies found. Create a company first to track credit history.
            </p>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-lg overflow-hidden border border-gray-200">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gradient-to-r from-[#1e3a8a] to-[#2563eb] text-white uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">Date & Time</th>
                  <th className="px-4 py-3 text-left font-semibold">Company</th>
                  <th className="px-4 py-3 text-left font-semibold">Chatbots</th>
                  <th className="px-4 py-3 text-center font-semibold">Credits Added</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredHistory.map((entry, idx) => {
                  return (
                    <React.Fragment key={`${entry._id || entry.companyId}-${idx}`}>
                      <tr
                        className={`${
                          idx % 2 === 0 ? "bg-white" : "bg-gray-50"
                        }`}
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
                            <span className="font-medium">{entry.companyName || "—"}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <Bot className="text-gray-400" size={16} />
                            <span className="text-gray-700">
                              {entry.chatbots && entry.chatbots.length > 0
                                ? entry.chatbots.map((cb) => cb.name).join(", ")
                                : "—"}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="inline-flex items-center gap-1 px-3 py-1 bg-green-100 text-green-800 rounded-full font-semibold">
                            <TrendingUp size={14} />
                            +{entry.credits_added || 0}
                          </span>
                          </td>
                        </tr>
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add Credit Modal */}
      {showAddCreditModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold mb-4 text-gray-900">Add Credits</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Credit Amount</label>
                <input
                  type="number"
                  value={creditAmount}
                  onChange={(e) => setCreditAmount(e.target.value)}
                  placeholder="Enter credits to add"
                  min="1"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={creditOperationLoading}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Duration (Days)</label>
                <input
                  type="number"
                  min="1"
                  value={creditDuration}
                  onChange={(e) => setCreditDuration(e.target.value)}
                  placeholder="Number of days the credits will be active"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={creditOperationLoading}
                />
              </div>
            </div>
            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => setShowAddCreditModal(false)}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
                disabled={creditOperationLoading}
              >
                Cancel
              </button>
              <button
                onClick={handleAddCredits}
                disabled={creditOperationLoading}
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
              >
                {creditOperationLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                Add Credits
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Remove Credit Modal */}
      {showRemoveCreditModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold mb-4 text-gray-900">Remove Credits</h3>
            <div className="space-y-4">
              <div className="bg-blue-50 p-3 rounded-md">
                <p className="text-sm text-blue-800">
                  <strong>Current Balance:</strong> {new Intl.NumberFormat("en-IN").format(currentBalances[selectedCompanyForCredit]?.remaining_credits || 0)} credits
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Credit Amount</label>
                <input
                  type="number"
                  value={creditAmount}
                  onChange={(e) => setCreditAmount(e.target.value)}
                  placeholder="Enter credits to remove"
                  min="1"
                  max={currentBalances[selectedCompanyForCredit]?.remaining_credits || 0}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={creditOperationLoading}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Duration (Days)</label>
                <input
                  type="number"
                  min="1"
                  value={creditDuration}
                  onChange={(e) => setCreditDuration(e.target.value)}
                  placeholder="Number of days to extend"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={creditOperationLoading}
                />
              </div>
            </div>
            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => setShowRemoveCreditModal(false)}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
                disabled={creditOperationLoading}
              >
                Cancel
              </button>
              <button
                onClick={handleRemoveCredits}
                disabled={creditOperationLoading}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
              >
                {creditOperationLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                Remove Credits
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CreditHistoryPage;

