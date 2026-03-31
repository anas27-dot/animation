import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import Layout from "../components/Layout";
import { fetchUserCompany, fetchCollectedLeads, fetchUserChatHistory } from "../services/api";
import {
  Search,
  Download,
  User,
  Phone,
  MessageCircle,
  Calendar,
  X,
  Eye,
} from "lucide-react";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import { TextField, Popover, Box } from "@mui/material";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";

dayjs.extend(relativeTime);

const CollectedLeadsPage = () => {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [companyId, setCompanyId] = useState(null);
  const [dateRange, setDateRange] = useState("30days");
  const [customStartDate, setCustomStartDate] = useState(null);
  const [customEndDate, setCustomEndDate] = useState(null);
  const [anchorEl, setAnchorEl] = useState(null);
  const [showClearTooltip, setShowClearTooltip] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalLeads, setTotalLeads] = useState(0);
  const [exporting, setExporting] = useState(false);

  // Chat history modal state
  const [showChatModal, setShowChatModal] = useState(false);
  const [selectedLead, setSelectedLead] = useState(null);
  const [chatHistory, setChatHistory] = useState([]);
  const [loadingChat, setLoadingChat] = useState(false);

  const limit = 10;

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      window.location.href = "/";
      return;
    }

    fetchCompanyData();
  }, []);

  useEffect(() => {
    if (companyId) {
      fetchAllData(companyId);
    }
  }, [searchTerm, dateRange, customStartDate, customEndDate, currentPage, companyId]);

  const handleSearch = () => {
    setSearchTerm(searchInput);
    setCurrentPage(1);
  };

  const handleSearchKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const handleDatePickerOpen = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleDatePickerClose = () => {
    setAnchorEl(null);
  };

  const handleDateRangeApply = () => {
    if (customStartDate && customEndDate) {
      setDateRange("custom");
      setCurrentPage(1);
    }
    handleDatePickerClose();
  };

  const handleClearCustomDateRange = () => {
    setCustomStartDate(null);
    setCustomEndDate(null);
    setDateRange("all");
    setCurrentPage(1);
  };

  const getDateRangeText = () => {
    if (dateRange === "custom" && customStartDate && customEndDate) {
      return `${customStartDate.format("MMM D, YYYY")} - ${customEndDate.format("MMM D, YYYY")}`;
    }
    return "Custom Range";
  };

  const handleRowClick = async (lead) => {
    setSelectedLead(lead);
    setShowChatModal(true);
    setLoadingChat(true);

    try {
      // Fetch by phone if available, otherwise by session_id
      const params = lead.phone && lead.phone !== "N/A"
        ? { phone: lead.phone }
        : { session_id: lead.session_id };

      const response = await fetchUserChatHistory(params);
      const data = response.data.data || response.data;
      const messages = data.messages || [];
      setChatHistory(messages);
    } catch (error) {
      console.error("Error fetching chat history:", error);
      toast.error("Failed to load chat history");
      setChatHistory([]);
    } finally {
      setLoadingChat(false);
    }
  };

  const handleCloseModal = () => {
    setShowChatModal(false);
    setSelectedLead(null);
    setChatHistory([]);
  };

  const fetchCompanyData = async () => {
    try {
      const response = await fetchUserCompany();
      const apiData = response.data.data || response.data;
      setCompanyId(apiData.chatbot_id);
      if (apiData.chatbot_id) {
        await fetchAllData(apiData.chatbot_id);
      }
    } catch (error) {
      console.error("Error fetching company data:", error);
      toast.error("Failed to load company data");
    }
  };

  const fetchAllData = async (companyId) => {
    setLoading(true);
    try {
      const params = {
        page: currentPage,
        limit: limit,
        searchTerm: searchTerm,
        dateRange: dateRange
      };

      if (dateRange === "custom" && customStartDate && customEndDate) {
        params.startDate = customStartDate.format('YYYY-MM-DD');
        params.endDate = customEndDate.format('YYYY-MM-DD');
      }

      const response = await fetchCollectedLeads(params);
      const apiData = response.data.data || response.data;

      setLeads(apiData.leads || []);
      setTotalPages(apiData.totalPages || 1);
      setTotalLeads(apiData.total || 0);
    } catch (error) {
      console.error("Error fetching collected leads:", error);
      toast.error("Failed to load collected leads");
      setLeads([]);
      setTotalPages(1);
    } finally {
      setLoading(false);
    }
  };

  const handleExportLeads = async () => {
    if (!companyId) {
      toast.error("Company ID not found");
      return;
    }

    setExporting(true);
    try {
      const params = {
        page: 1,
        limit: 10000,
        searchTerm: searchTerm,
        dateRange: dateRange
      };

      if (dateRange === "custom" && customStartDate && customEndDate) {
        params.startDate = customStartDate.format('YYYY-MM-DD');
        params.endDate = customEndDate.format('YYYY-MM-DD');
      }

      const response = await fetchCollectedLeads(params);
      const apiData = response.data.data || response.data;
      const leadsToExport = apiData.leads || [];

      if (leadsToExport.length === 0) {
        toast.info("No leads to export");
        return;
      }

      const csvHeaders = "Name,Phone Number,Collected At,Message Count\n";
      const csvRows = leadsToExport.map(lead => {
        const collectedAt = dayjs(lead.collectedAt).format('YYYY-MM-DD HH:mm:ss');
        const name = (lead.name || 'Anonymous').replace(/"/g, '""');
        const phone = (lead.phone || 'N/A').replace(/"/g, '""');
        return `"${name}","${phone}","${collectedAt}",${lead.messageCount}`;
      }).join('\n');

      const csvContent = csvHeaders + csvRows;

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `collected_leads_${dayjs().format('YYYY-MM-DD')}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast.success(`Exported ${leadsToExport.length} collected leads`);
    } catch (error) {
      console.error("Error exporting leads:", error);
      toast.error("Failed to export leads");
    } finally {
      setExporting(false);
    }
  };

  return (
    <Layout>
      <div className="max-w-7xl mx-auto p-4 md:p-6 lg:p-10 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Collected Leads</h1>
          <p className="text-gray-600 mt-2">
            Users who shared their name and phone number through chat
            {!loading && totalLeads > 0 && ` • ${totalLeads} total leads`}
          </p>
        </div>

        {/* Date Range Filter and Export */}
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => { setDateRange("all"); setCurrentPage(1); }}
              disabled={loading}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${dateRange === "all"
                  ? "bg-blue-100 text-blue-800 border border-blue-300"
                  : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
                } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              All time
            </button>
            <button
              onClick={() => { setDateRange("7days"); setCurrentPage(1); }}
              disabled={loading}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${dateRange === "7days"
                  ? "bg-blue-100 text-blue-800 border border-blue-300"
                  : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
                } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              Last 7 days
            </button>
            <button
              onClick={() => { setDateRange("30days"); setCurrentPage(1); }}
              disabled={loading}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${dateRange === "30days"
                  ? "bg-blue-100 text-blue-800 border border-blue-300"
                  : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
                } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              Last 30 days
            </button>
            <button
              onClick={() => { setDateRange("90days"); setCurrentPage(1); }}
              disabled={loading}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${dateRange === "90days"
                  ? "bg-blue-100 text-blue-800 border border-blue-300"
                  : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
                } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              Last 90 days
            </button>
            <button
              onClick={handleDatePickerOpen}
              disabled={loading}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${dateRange === "custom"
                  ? "bg-blue-100 text-blue-800 border border-blue-300"
                  : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
                } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              <Calendar className="w-4 h-4" />
              {getDateRangeText()}
            </button>

            {dateRange === "custom" && (
              <div className="relative">
                <button
                  onClick={handleClearCustomDateRange}
                  onMouseEnter={() => setShowClearTooltip(true)}
                  onMouseLeave={() => setShowClearTooltip(false)}
                  className="p-2 rounded-lg text-sm font-medium bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 transition-all flex items-center gap-1 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>

                {showClearTooltip && (
                  <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-blue-600 text-white text-xs font-medium rounded-lg shadow-lg whitespace-nowrap z-50">
                    Clear custom date range
                    <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-blue-600"></div>
                  </div>
                )}
              </div>
            )}

            <button
              onClick={handleExportLeads}
              disabled={exporting || leads.length === 0 || loading}
              className="flex items-center gap-1 md:gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium ml-auto"
            >
              <Download className={`w-4 h-4 ${exporting ? "animate-pulse" : ""}`} />
              <span className="hidden sm:inline">{exporting ? "Exporting..." : "Export CSV"}</span>
              <span className="sm:hidden">{exporting ? "..." : "Export"}</span>
            </button>
          </div>
        </div>

        {/* Date Picker Popover */}
        <Popover
          open={Boolean(anchorEl)}
          anchorEl={anchorEl}
          onClose={handleDatePickerClose}
          anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
          transformOrigin={{ vertical: "top", horizontal: "left" }}
        >
          <LocalizationProvider dateAdapter={AdapterDayjs}>
            <Box sx={{ p: 3, display: "flex", flexDirection: "column", gap: 2 }}>
              <DatePicker
                label="Start Date"
                value={customStartDate}
                onChange={(newValue) => setCustomStartDate(newValue)}
                renderInput={(params) => <TextField {...params} />}
              />
              <DatePicker
                label="End Date"
                value={customEndDate}
                onChange={(newValue) => setCustomEndDate(newValue)}
                minDate={customStartDate}
                renderInput={(params) => <TextField {...params} />}
              />
              <button
                onClick={handleDateRangeApply}
                disabled={!customStartDate || !customEndDate}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium text-sm"
              >
                Apply Date Range
              </button>
            </Box>
          </LocalizationProvider>
        </Popover>

        {/* Leads Table */}
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <User className="w-5 h-5 text-blue-600" />
              Collected User Information
            </h3>
            <div className="flex gap-2">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search by name or phone..."
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  onKeyPress={handleSearchKeyPress}
                  disabled={loading}
                  className="pl-4 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
                />
              </div>
              <button
                onClick={handleSearch}
                disabled={loading}
                className="flex items-center gap-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Search className="w-4 h-4" />
                Search
              </button>
            </div>
          </div>

          {loading ? (
            <div className="space-y-4 animate-pulse">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-center gap-4 py-4 border-b border-gray-100">
                  <div className="w-32 h-4 bg-gray-200 rounded"></div>
                  <div className="w-24 h-4 bg-gray-200 rounded"></div>
                  <div className="w-32 h-4 bg-gray-200 rounded"></div>
                  <div className="w-20 h-4 bg-gray-200 rounded"></div>
                </div>
              ))}
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">Name</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">Phone Number</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">Collected At</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">Messages</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leads.map((lead, index) => (
                      <tr
                        key={lead.id || index}
                        className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                      >
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-2">
                            <User className={`w-4 h-4 ${lead.hasName ? 'text-green-600' : 'text-gray-400'}`} />
                            <span className={`font-medium ${lead.hasName ? 'text-gray-900' : 'text-gray-400'}`}>
                              {lead.name}
                            </span>
                          </div>
                        </td>
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-2">
                            <Phone className={`w-4 h-4 ${lead.hasPhone ? 'text-blue-600' : 'text-gray-400'}`} />
                            <span className={`${lead.hasPhone ? 'text-gray-900' : 'text-gray-400'}`}>
                              {lead.phone}
                            </span>
                          </div>
                        </td>
                        <td className="py-4 px-4">
                          <div className="flex flex-col">
                            <span className="text-sm text-gray-900">
                              {dayjs(lead.collectedAt).format('MMM D, YYYY')}
                            </span>
                            <span className="text-xs text-gray-500">
                              {dayjs(lead.collectedAt).format('h:mm A')}
                            </span>
                            <span className="text-xs text-gray-400 mt-1">
                              {dayjs(lead.collectedAt).fromNow()}
                            </span>
                          </div>
                        </td>
                        <td className="py-4 px-4">
                          <span className="px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800 flex items-center gap-1 w-fit">
                            <MessageCircle className="w-3 h-3" />
                            {lead.messageCount}
                          </span>
                        </td>
                        <td className="py-4 px-4">
                          <button
                            onClick={() => handleRowClick(lead)}
                            className="flex items-center gap-1 px-3 py-1 text-sm bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors"
                          >
                            <Eye className="w-4 h-4" />
                            View Chat
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {leads.length === 0 && (
                <div className="text-center py-12 text-gray-500">
                  <User className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                  <p className="text-lg font-medium">No collected leads found</p>
                  <p className="text-sm mt-2">Leads will appear here once users share their information through chat</p>
                </div>
              )}

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex justify-center mt-6">
                  <div className="flex gap-2">
                    <button
                      onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                      disabled={currentPage === 1}
                      className="px-3 py-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                    >
                      Previous
                    </button>
                    <span className="px-4 py-2 text-sm text-gray-600">
                      Page {currentPage} of {totalPages}
                    </span>
                    <button
                      onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                      disabled={currentPage === totalPages}
                      className="px-3 py-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Chat History Modal */}
        {showChatModal && (
          <div
            className="fixed inset-0 backdrop-blur-md bg-white/30 flex items-center justify-center z-50 p-4"
            onClick={handleCloseModal}
          >
            <div
              className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[80vh] flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between p-6 border-b border-gray-200">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <MessageCircle className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">Chat History</h2>
                    <p className="text-sm text-gray-600">
                      {selectedLead?.name} • {selectedLead?.phone}
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleCloseModal}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {loadingChat ? (
                  <div className="space-y-4 animate-pulse">
                    {[...Array(5)].map((_, i) => (
                      <div key={i} className={`flex ${i % 2 === 0 ? 'justify-start' : 'justify-end'}`}>
                        <div className={`max-w-[70%] ${i % 2 === 0 ? 'bg-gray-100' : 'bg-blue-100'} rounded-lg p-4`}>
                          <div className="h-4 bg-gray-300 rounded w-48 mb-2"></div>
                          <div className="h-3 bg-gray-300 rounded w-32"></div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : chatHistory.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <MessageCircle className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                    <p className="text-lg font-medium">No chat history found</p>
                    <p className="text-sm mt-2">Messages will appear here once this user starts chatting</p>
                  </div>
                ) : (
                  chatHistory.map((message, index) => {
                    const isUser = message.sender === 'user';
                    return (
                      <div
                        key={message._id || index}
                        className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`max-w-[70%] rounded-lg p-4 ${isUser
                              ? 'bg-blue-600 text-white'
                              : 'bg-gray-100 text-gray-900'
                            }`}
                        >
                          {!isUser ? (
                            <div className="text-sm leading-relaxed prose prose-sm max-w-none prose-p:my-2 prose-ul:my-2 prose-ol:my-2 prose-li:my-1">
                              <ReactMarkdown
                                remarkPlugins={[remarkGfm]}
                                rehypePlugins={[rehypeRaw]}
                              >
                                {message.content}
                              </ReactMarkdown>
                            </div>
                          ) : (
                            <div className="text-sm leading-relaxed">
                              <p className="whitespace-pre-wrap">{message.content}</p>
                            </div>
                          )}
                          <div
                            className={`flex items-center gap-2 mt-2 text-xs ${isUser ? 'text-blue-100' : 'text-gray-500'
                              }`}
                          >
                            <span className="font-medium">
                              {isUser ? 'User' : 'Bot'}
                            </span>
                            <span>•</span>
                            <span>
                              {dayjs(message.timestamp).format('MMM D, h:mm A')}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              <div className="p-6 border-t border-gray-200 bg-gray-50 rounded-b-2xl">
                <div className="flex items-center justify-between text-sm text-gray-600">
                  <span>
                    {chatHistory.length > 0
                      ? `${chatHistory.length} message${chatHistory.length !== 1 ? 's' : ''}`
                      : 'No messages'}
                  </span>
                  <button
                    onClick={handleCloseModal}
                    className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default CollectedLeadsPage;
