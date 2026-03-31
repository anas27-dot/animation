import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import Layout from "../components/Layout";
import { fetchUserCompany, fetchUserLeads } from "../services/api";
import {
  Search,
  Download,
  Phone,
  MessageCircle,
  Calendar,
  X,
} from "lucide-react";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import { TextField, Popover, Box } from "@mui/material";
// import ReactMarkdown from "react-markdown"; // TEMPORARILY DISABLED - for chat modal
dayjs.extend(relativeTime);

// Skeleton Loader Components
const CardSkeleton = () => (
  <div className="bg-white rounded-xl p-6 shadow-sm animate-pulse">
    <div className="flex items-center gap-2 mb-4">
      <div className="w-8 h-8 bg-gray-200 rounded-md"></div>
      <div className="h-4 bg-gray-200 rounded-full w-1/2"></div>
    </div>
    <div className="space-y-3">
      <div className="h-6 bg-gray-200 rounded-full w-3/4"></div>
      <div className="h-4 bg-gray-200 rounded-full w-1/2"></div>
    </div>
  </div>
);

const TableSkeleton = () => (
  <div className="bg-white rounded-xl p-6 shadow-sm animate-pulse">
    <div className="h-6 bg-gray-200 rounded-full w-1/3 mb-6"></div>
    <div className="space-y-4">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="flex items-center gap-4">
          <div className="w-8 h-8 bg-gray-200 rounded-full"></div>
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-gray-200 rounded-full w-1/4"></div>
            <div className="h-3 bg-gray-200 rounded-full w-1/2"></div>
          </div>
          <div className="h-6 bg-gray-200 rounded-full w-16"></div>
        </div>
      ))}
    </div>
  </div>
);

const LeadsPage = () => {
  const [analytics, setAnalytics] = useState(null);
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
  const [exporting, setExporting] = useState(false);

  // Chat history modal state - TEMPORARILY DISABLED
  // const [showChatModal, setShowChatModal] = useState(false);
  // const [selectedPhone, setSelectedPhone] = useState(null);
  // const [chatHistory, setChatHistory] = useState([]);
  // const [loadingChat, setLoadingChat] = useState(false);

  const limit = 10;

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      window.location.href = "/";
      return;
    }

    // Get company ID from user data
    fetchCompanyData();
  }, []);

  // Refetch data when filters change
  useEffect(() => {
    if (companyId) {
      fetchAllData(companyId);
    }
  }, [searchTerm, dateRange, customStartDate, customEndDate, currentPage]);

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

  // CHAT HISTORY MODAL HANDLERS - TEMPORARILY DISABLED
  // const handleRowClick = async (phone) => {
  //   setSelectedPhone(phone);
  //   setShowChatModal(true);
  //   setLoadingChat(true);

  //   try {
  //     // Fetch chat history for this phone number
  //     const response = await fetch(`http://localhost:5000/api/user/messages?phone=${phone}&chatbot_id=${companyId}`, {
  //       headers: {
  //         'Authorization': `Bearer ${localStorage.getItem('token')}`
  //       }
  //     });

  //     const data = await response.json();
  //     const messages = data.data?.messages || data.messages || [];
  //     setChatHistory(messages);
  //   } catch (error) {
  //     console.error("Error fetching chat history:", error);
  //     toast.error("Failed to load chat history");
  //     setChatHistory([]);
  //   } finally {
  //     setLoadingChat(false);
  //   }
  // };

  // const handleCloseModal = () => {
  //   setShowChatModal(false);
  //   setSelectedPhone(null);
  //   setChatHistory([]);
  // };

  const fetchCompanyData = async () => {
    try {
      const response = await fetchUserCompany();
      // API wraps response in { success, data: {...} }
      const apiData = response.data.data || response.data;
      console.log('Company data:', apiData); // Debug log
      setCompanyId(apiData.chatbot_id);
      if (apiData.chatbot_id) {
        console.log('Fetching leads for chatbot:', apiData.chatbot_id); // Debug log
        await fetchAllData(apiData.chatbot_id);
      } else {
        console.error('No chatbot_id found in response:', apiData);
      }
    } catch (error) {
      console.error("Error fetching company data:", error);
      toast.error("Failed to load company data");
    }
  };

  const fetchAllData = async (companyId) => {
    setLoading(true);
    try {
      console.log('Fetching leads with params:', { page: currentPage, limit, searchTerm, dateRange }); // Debug log

      // Prepare query params
      const params = {
        page: currentPage,
        limit: limit,
        searchTerm: searchTerm,
        dateRange: dateRange
      };

      // Add custom date range if selected
      if (dateRange === "custom" && customStartDate && customEndDate) {
        params.startDate = customStartDate.format('YYYY-MM-DD');
        params.endDate = customEndDate.format('YYYY-MM-DD');
      }

      // Fetch verified phone leads
      const response = await fetchUserLeads(params);

      console.log('Leads API response:', response); // Debug log

      // API wraps response in { success, data: {...} }
      const apiData = response.data.data || response.data;
      console.log('Extracted leads data:', apiData); // Debug log

      // Filter out leads with null or empty phone numbers
      const allLeads = apiData.leads || [];
      const validLeads = allLeads.filter(lead => lead.phone && lead.phone.trim() !== '');

      // Set leads data
      setLeads(validLeads);
      setTotalPages(apiData.totalPages || 1);

      // Use backend's total count (which should already exclude nulls ideally, but we show current filtered count)
      // For accurate display, we should show backend's total
      const total = apiData.total || 0;
      let periodText = dateRange === "all" ? "all time" : dateRange.replace("days", " days");
      if (dateRange === "custom" && customStartDate && customEndDate) {
        periodText = "custom range";
      }
      setAnalytics({
        summary: { totalLeads: total, period: periodText }
      });
    } catch (error) {
      console.error("Error fetching leads data:", error);
      toast.error("Failed to load leads data");
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
      // Prepare query params for export
      const params = {
        page: 1,
        limit: 10000,
        searchTerm: searchTerm,
        dateRange: dateRange
      };

      // Add custom date range if selected
      if (dateRange === "custom" && customStartDate && customEndDate) {
        params.startDate = customStartDate.format('YYYY-MM-DD');
        params.endDate = customEndDate.format('YYYY-MM-DD');
      }

      // Fetch all leads without pagination for export
      const response = await fetchUserLeads(params);

      // API wraps response in { success, data: {...} }
      const apiData = response.data.data || response.data;
      const allLeads = apiData.leads || [];

      // Filter out leads with null or empty phone numbers
      const leadsToExport = allLeads.filter(lead => lead.phone && lead.phone.trim() !== '');

      if (leadsToExport.length === 0) {
        toast.info("No leads to export");
        return;
      }

      // Convert to CSV format (removed Provider column, source is always WhatsApp)
      const csvHeaders = "Phone Number,Verified,Source,Verified At\n";
      const csvRows = leadsToExport.map(lead => {
        const verifiedAt = dayjs(lead.verifiedAt).format('YYYY-MM-DD HH:mm:ss');
        return `"${lead.phone}",${lead.verified ? 'Yes' : 'No'},"WhatsApp","${verifiedAt}"`;
      }).join('\n');

      const csvContent = csvHeaders + csvRows;

      // Create and trigger download
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `phone_leads_${dayjs().format('YYYY-MM-DD')}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast.success(`Exported ${leadsToExport.length} phone leads`);
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
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Verified Leads</h1>
          <p className="text-gray-600 mt-2">
            Verified phone numbers from your Agents interactions
            {/* {!loading && leads.length > 0 && ` • ${leads.length} of ${analytics?.summary?.totalLeads || 0} shown`} */}
          </p>
        </div>

        {/* Date Range Filter and Export */}
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => {
                setDateRange("all");
                setCurrentPage(1);
              }}
              disabled={loading}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${dateRange === "all"
                  ? "bg-[#1e3a8a]/10 text-[#1e3a8a] border border-[#1e3a8a]/30"
                  : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
                } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              All time
            </button>
            <button
              onClick={() => {
                setDateRange("7days");
                setCurrentPage(1);
              }}
              disabled={loading}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${dateRange === "7days"
                  ? "bg-blue-100 text-blue-800 border border-blue-300"
                  : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
                } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              Last 7 days
            </button>
            <button
              onClick={() => {
                setDateRange("30days");
                setCurrentPage(1);
              }}
              disabled={loading}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${dateRange === "30days"
                  ? "bg-blue-100 text-blue-800 border border-blue-300"
                  : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
                } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              Last 30 days
            </button>
            <button
              onClick={() => {
                setDateRange("90days");
                setCurrentPage(1);
              }}
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

            {/* Clear Custom Date Range Button */}
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

                {/* Tooltip */}
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
          anchorOrigin={{
            vertical: "bottom",
            horizontal: "left",
          }}
          transformOrigin={{
            vertical: "top",
            horizontal: "left",
          }}
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
              <Phone className="w-5 h-5 text-blue-600" />
              Verified Phone Numbers
            </h3>
            <div className="flex gap-2">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search phone numbers..."
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
                  <div className="w-20 h-6 bg-gray-200 rounded-full"></div>
                  <div className="w-24 h-6 bg-gray-200 rounded-full"></div>
                  <div className="w-32 h-4 bg-gray-200 rounded"></div>
                </div>
              ))}
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">Phone Number</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">Verified Status</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">Source</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">Verified At</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leads.map((lead, index) => {
                      return (
                        <tr
                          key={lead.id || index}
                          // onClick={() => handleRowClick(lead.phone)}
                          className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                        >
                          <td className="py-4 px-4">
                            <div className="flex items-center gap-2">
                              <Phone className="w-4 h-4 text-blue-600" />
                              <span className="font-medium text-gray-900">{lead.phone}</span>
                            </div>
                          </td>
                          <td className="py-4 px-4">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${lead.verified ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'
                              }`}>
                              {lead.verified ? 'Verified' : 'Pending'}
                            </span>
                          </td>
                          <td className="py-4 px-4">
                            <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 flex items-center gap-1 w-fit">
                              <MessageCircle className="w-3 h-3" />
                              WhatsApp
                            </span>
                          </td>
                          <td className="py-4 px-4">
                            <div className="flex flex-col">
                              <span className="text-sm text-gray-900">
                                {dayjs(lead.verifiedAt).format('MMM D, YYYY')}
                              </span>
                              <span className="text-xs text-gray-500">
                                {dayjs(lead.verifiedAt).format('h:mm A')}
                              </span>
                              <span className="text-xs text-gray-400 mt-1">
                                {dayjs(lead.verifiedAt).fromNow()}
                              </span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {leads.length === 0 && (
                <div className="text-center py-12 text-gray-500">
                  <Phone className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                  <p className="text-lg font-medium">No verified phone numbers found</p>
                  <p className="text-sm mt-2">Phone numbers will appear here once users verify them through your chatbot</p>
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

        {/* CHAT HISTORY MODAL - TEMPORARILY DISABLED */}
        {/* {showChatModal && (
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
                  <div className="p-2 bg-green-100 rounded-lg">
                    <MessageCircle className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">Chat History</h2>
                    <p className="text-sm text-gray-600">{selectedPhone}</p>
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
                          className={`max-w-[70%] rounded-lg p-4 ${
                            isUser
                              ? 'bg-blue-600 text-white'
                              : 'bg-gray-100 text-gray-900'
                          }`}
                        >
                          <div className={`text-sm leading-relaxed prose prose-sm max-w-none ${
                            isUser
                              ? 'prose-invert prose-headings:text-white prose-p:text-white prose-strong:text-white prose-code:text-white prose-a:text-blue-200'
                              : 'prose-headings:text-gray-900 prose-p:text-gray-900 prose-strong:text-gray-900 prose-code:bg-gray-200 prose-code:text-gray-900 prose-a:text-blue-600'
                          }`}>
                            <ReactMarkdown>{message.content}</ReactMarkdown>
                          </div>
                          <div
                            className={`flex items-center gap-2 mt-2 text-xs ${
                              isUser ? 'text-blue-100' : 'text-gray-500'
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
        )} */}
      </div>
    </Layout>
  );
};

export default LeadsPage;
