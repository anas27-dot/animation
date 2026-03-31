import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import Layout from "../components/Layout";
import UserSidebar from "../components/UserSidebar";
import Header from "../components/Header";
import { MessageSquare, Users, Clock, Calendar, X, TrendingUp, Phone, Mail, UserCircle } from "lucide-react";
import { fetchUserCompany, fetchUserAnalytics, fetchTopUsers } from "../services/api";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import dayjs from "dayjs";
import { TextField, Popover, Box } from "@mui/material";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import UserChatHistoryModal from "../components/UserChatHistoryModal";

const AnalyticsPage = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [company, setCompany] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState("all"); // all, 7days, 30days, 90days, custom
  const [customStartDate, setCustomStartDate] = useState(null);
  const [customEndDate, setCustomEndDate] = useState(null);
  const [anchorEl, setAnchorEl] = useState(null);

  // Analytics data
  const [websiteAnalytics, setWebsiteAnalytics] = useState({
    avgDuration: 0,
    totalMessages: 0,
    avgMessagesPerChat: 0,
    totalUsers: 0
  });

  const [chartData, setChartData] = useState([]);
  const [showClearTooltip, setShowClearTooltip] = useState(false);
  const [topUsers, setTopUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [showChatModal, setShowChatModal] = useState(false);

  const token = localStorage.getItem("token");

  useEffect(() => {
    if (!token) {
      window.location.href = "/";
      return;
    }
    fetchData();
  }, [token, dateRange]);

  const fetchData = async () => {
    try {
      setLoading(true);

      // Fetch company data
      const companyRes = await fetchUserCompany();
      const companyData = companyRes.data;
      setCompany(companyData);

      // Prepare query params for analytics
      const analyticsParams = {
        dateRange: dateRange
      };

      // Add custom date range if selected
      if (dateRange === "custom" && customStartDate && customEndDate) {
        analyticsParams.startDate = customStartDate.format('YYYY-MM-DD');
        analyticsParams.endDate = customEndDate.format('YYYY-MM-DD');
      }

      // Fetch all analytics data in one optimized call
      const analyticsRes = await fetchUserAnalytics(analyticsParams);
      const analyticsData = analyticsRes.data.data || analyticsRes.data;

      setWebsiteAnalytics({
        avgDuration: analyticsData.avgDurationSeconds || 0,
        totalMessages: analyticsData.totalMessages || 0,
        avgMessagesPerChat: analyticsData.avgMessagesPerChat || 0,
        totalUsers: analyticsData.totalSessions || 0
      });

      // Process chart data from backend aggregated data
      const processedChartData = processChartData(analyticsData.chartData || [], dateRange, customStartDate, customEndDate);
      setChartData(processedChartData);

      // Fetch top users data
      const topUsersRes = await fetchTopUsers(analyticsParams);
      const topUsersData = topUsersRes.data.data || topUsersRes.data;
      setTopUsers(topUsersData.topUsers || []);

    } catch (err) {
      if (err.response?.status === 401) {
        localStorage.removeItem("token");
        window.location.href = "/";
        return;
      }
      toast.error("Failed to load analytics data");
    } finally {
      setLoading(false);
    }
  };

  const filterByDateRange = (data) => {
    const now = new Date();
    let cutoffDate = new Date();

    switch (dateRange) {
      case "7days":
        cutoffDate.setDate(now.getDate() - 7);
        break;
      case "30days":
        cutoffDate.setDate(now.getDate() - 30);
        break;
      case "90days":
        cutoffDate.setDate(now.getDate() - 90);
        break;
      default:
        cutoffDate.setDate(now.getDate() - 7);
    }

    return data.filter(item => {
      const itemDate = new Date(item.timestamp || item.created_at);
      return itemDate >= cutoffDate;
    });
  };

  const formatDuration = (seconds) => {
    if (seconds === 0) return "0s";

    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    const parts = [];
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    if (secs > 0 || parts.length === 0) parts.push(`${secs}s`);

    return parts.join(' ');
  };

  const getDateRangeText = () => {
    if (dateRange === "custom" && customStartDate && customEndDate) {
      const formatDate = (date) => {
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        return `${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
      };
      return `${formatDate(customStartDate.toDate())} - ${formatDate(customEndDate.toDate())}`;
    }

    const now = new Date();
    let startDate = new Date();

    switch (dateRange) {
      case "7days":
        startDate.setDate(now.getDate() - 7);
        break;
      case "30days":
        startDate.setDate(now.getDate() - 30);
        break;
      case "90days":
        startDate.setDate(now.getDate() - 90);
        break;
      default:
        startDate.setDate(now.getDate() - 7);
    }

    const formatDate = (date) => {
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      return `${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
    };

    return `${formatDate(startDate)} - ${formatDate(now)}`;
  };

  const handleDatePickerOpen = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleDatePickerClose = () => {
    setAnchorEl(null);
  };

  const handleApplyCustomDateRange = () => {
    if (customStartDate && customEndDate) {
      setDateRange("custom");
      handleDatePickerClose();
    } else {
      toast.error("Please select both start and end dates");
    }
  };

  const handleClearCustomDateRange = () => {
    setCustomStartDate(null);
    setCustomEndDate(null);
    setDateRange("all"); // Reset to default
  };

  const processChartData = (aggregatedData, range, startDate, endDate) => {
    if (!aggregatedData || aggregatedData.length === 0) return [];

    // Convert aggregated data to a map for quick lookup
    const messagesByDate = {};
    aggregatedData.forEach(item => {
      messagesByDate[item.date] = item.count;
    });

    // Determine the date range
    let start, end;
    if (range === "custom" && startDate && endDate) {
      start = startDate.toDate();
      end = endDate.toDate();
    } else if (range === "all") {
      // For "all time", use the earliest and latest dates from data
      if (aggregatedData.length > 0) {
        const dates = aggregatedData.map(item => new Date(item.date));
        start = new Date(Math.min(...dates));
        end = new Date();
      } else {
        return [];
      }
    } else {
      end = new Date();
      start = new Date();
      switch (range) {
        case "7days":
          start.setDate(end.getDate() - 7);
          break;
        case "30days":
          start.setDate(end.getDate() - 30);
          break;
        case "90days":
          start.setDate(end.getDate() - 90);
          break;
        default:
          start.setDate(end.getDate() - 7);
      }
    }

    // Create array of all dates in range with counts
    const chartData = [];
    const currentDate = new Date(start);
    while (currentDate <= end) {
      const dateKey = currentDate.toISOString().split('T')[0];
      const count = messagesByDate[dateKey] || 0;

      chartData.push({
        date: dateKey,
        messages: count,
        displayDate: formatChartDate(currentDate, range)
      });

      currentDate.setDate(currentDate.getDate() + 1);
    }

    return chartData;
  };

  const formatChartDate = (date, range) => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = months[date.getMonth()];
    const day = date.getDate();

    // For longer ranges, show month and day
    if (range === "90days" || range === "custom") {
      return `${month} ${day}`;
    }
    // For shorter ranges, show day and month
    return `${day} ${month}`;
  };

  const handleUserClick = (user) => {
    setSelectedUser(user);
    setShowChatModal(true);
  };

  const handleCloseModal = () => {
    setShowChatModal(false);
    setSelectedUser(null);
  };

  const open = Boolean(anchorEl);

  return (
    <div className="min-h-screen bg-white font-['Exo_2',sans-serif]">
      <div className="flex">
        {/* Sidebar */}
        <UserSidebar
          chatbotId={company?.chatbot_id}
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          company={company}
        />

        {/* Main Content */}
        <div className="flex-1 min-h-screen w-full md:ml-64 md:w-[calc(100%-16rem)]">
          <Header onMenuClick={() => setSidebarOpen(true)} />

          <div className="p-6">
            {/* Page Header */}
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-[#1e3a8a] mb-2">Analytics</h1>
              <p className="text-gray-500">View and analyze your agent performance metrics</p>
            </div>

            {/* Filters Section */}
            <div className="bg-white border border-gray-200 rounded-xl p-4 mb-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                {/* Date Range Filters */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setDateRange("all")}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      dateRange === "all"
                        ? "bg-gradient-to-r from-[#3a2d9c]/10 to-[#017977]/10 text-[#3a2d9c] border border-[#3a2d9c]/30"
                        : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
                    }`}
                  >
                    All time
                  </button>
                  <button
                    onClick={() => setDateRange("7days")}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      dateRange === "7days"
                        ? "bg-gradient-to-r from-[#3a2d9c]/10 to-[#017977]/10 text-[#3a2d9c] border border-[#3a2d9c]/30"
                        : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
                    }`}
                  >
                    Last 7 days
                  </button>
                  <button
                    onClick={() => setDateRange("30days")}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      dateRange === "30days"
                        ? "bg-gradient-to-r from-[#3a2d9c]/10 to-[#017977]/10 text-[#3a2d9c] border border-[#3a2d9c]/30"
                        : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
                    }`}
                  >
                    Last 30 days
                  </button>
                  <button
                    onClick={() => setDateRange("90days")}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      dateRange === "90days"
                        ? "bg-gradient-to-r from-[#3a2d9c]/10 to-[#017977]/10 text-[#3a2d9c] border border-[#3a2d9c]/30"
                        : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
                    }`}
                  >
                    Last 90 days
                  </button>
                  <button
                    onClick={handleDatePickerOpen}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                      dateRange === "custom"
                        ? "bg-gradient-to-r from-[#3a2d9c]/10 to-[#017977]/10 text-[#3a2d9c] border border-[#3a2d9c]/30"
                        : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
                    }`}
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

                      {/* Custom Tooltip */}
                      {showClearTooltip && (
                        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gradient-to-r from-[#3a2d9c] to-[#017977] text-white text-xs font-medium rounded-lg shadow-lg whitespace-nowrap z-50">
                          Clear custom date range
                          <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-[#017977]"></div>
                        </div>
                      )}
                    </div>
                  )}

                  <Popover
                    open={open}
                    anchorEl={anchorEl}
                    onClose={handleDatePickerClose}
                    anchorOrigin={{
                      vertical: 'bottom',
                      horizontal: 'left',
                    }}
                    transformOrigin={{
                      vertical: 'top',
                      horizontal: 'left',
                    }}
                    sx={{
                      '& .MuiPopover-paper': {
                        marginTop: '8px',
                        padding: '20px',
                        borderRadius: '12px',
                        boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
                      }
                    }}
                  >
                    <LocalizationProvider dateAdapter={AdapterDayjs}>
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: '300px' }}>
                        <div className="text-lg font-semibold text-gray-900 mb-2">Select Date Range</div>

                        <DatePicker
                          label="Start Date"
                          value={customStartDate}
                          onChange={(newValue) => setCustomStartDate(newValue)}
                          maxDate={customEndDate || dayjs()}
                          slotProps={{
                            textField: {
                              size: 'small',
                              fullWidth: true,
                            },
                          }}
                        />

                        <DatePicker
                          label="End Date"
                          value={customEndDate}
                          onChange={(newValue) => setCustomEndDate(newValue)}
                          minDate={customStartDate}
                          maxDate={dayjs()}
                          slotProps={{
                            textField: {
                              size: 'small',
                              fullWidth: true,
                            },
                          }}
                        />

                        <div className="flex gap-2 mt-2">
                          <button
                            onClick={handleDatePickerClose}
                            className="flex-1 px-4 py-2 rounded-lg text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 transition-all"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={handleApplyCustomDateRange}
                            className="flex-1 px-4 py-2 rounded-lg text-sm font-medium bg-gradient-to-r from-[#3a2d9c] to-[#017977] text-white hover:opacity-90 transition-all"
                          >
                            Apply
                          </button>
                        </div>
                      </Box>
                    </LocalizationProvider>
                  </Popover>
                </div>
              </div>
            </div>

            {/* Tab */}
            <div className="flex gap-1 mb-6 bg-gray-100 p-1 rounded-lg w-fit">
              <button
                className="px-6 py-2.5 rounded-lg text-sm font-medium transition-all bg-gradient-to-r from-[#3a2d9c] to-[#017977] text-white shadow-md"
              >
                Agent Analytics
              </button>
            </div>

            {/* Analytics Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {loading ? (
                // Skeleton loading for cards
                <>
                  {[1, 2, 3, 4].map(i => (
                    <div key={i} className="bg-white rounded-xl border-t-4 border-gray-200 p-6 shadow-sm animate-pulse">
                      <div className="flex items-start justify-between mb-4">
                        <div className="h-4 bg-gray-200 rounded w-24"></div>
                        <div className="w-10 h-10 bg-gray-200 rounded-lg"></div>
                      </div>
                      <div className="h-10 bg-gray-200 rounded w-32"></div>
                    </div>
                  ))}
                </>
              ) : (
                <>
                  {/* Average Duration */}
                  <div className="bg-white rounded-xl border-t-4 border-[#3a2d9c] p-6 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between mb-4">
                      <div className="text-sm font-bold text-gray-600">Avg. Duration</div>
                      <div className="w-10 h-10 bg-gradient-to-r from-[#3a2d9c]/10 to-[#017977]/10 rounded-lg flex items-center justify-center">
                        <Clock className="w-5 h-5 text-[#3a2d9c]" />
                      </div>
                    </div>
                    <div className="text-4xl font-bold text-gray-900">
                      {formatDuration(websiteAnalytics.avgDuration)}
                    </div>
                  </div>

                  {/* Total Messages */}
                  <div className="bg-white rounded-xl border-t-4 border-[#3a2d9c] p-6 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between mb-4">
                      <div className="text-sm font-bold text-gray-600">Total Messages</div>
                      <div className="w-10 h-10 bg-gradient-to-r from-[#3a2d9c]/10 to-[#017977]/10 rounded-lg flex items-center justify-center">
                        <MessageSquare className="w-5 h-5 text-[#3a2d9c]" />
                      </div>
                    </div>
                    <div className="text-4xl font-bold text-gray-900">
                      {websiteAnalytics.totalMessages}
                    </div>
                  </div>

                  {/* Average Messages Per Chat */}
                  <div className="bg-white rounded-xl border-t-4 border-[#3a2d9c] p-6 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between mb-4">
                      <div className="text-sm font-bold text-gray-600">Avg. Messages/Chat</div>
                      <div className="w-10 h-10 bg-gradient-to-r from-[#3a2d9c]/10 to-[#017977]/10 rounded-lg flex items-center justify-center">
                        <MessageSquare className="w-5 h-5 text-[#3a2d9c]" />
                      </div>
                    </div>
                    <div className="text-4xl font-bold text-gray-900">
                      {websiteAnalytics.avgMessagesPerChat}
                    </div>
                  </div>

                  {/* Total Users */}
                  <div className="bg-white rounded-xl border-t-4 border-[#3a2d9c] p-6 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between mb-4">
                      <div className="text-sm font-bold text-gray-600">Total Users</div>
                      <div className="w-10 h-10 bg-gradient-to-r from-[#3a2d9c]/10 to-[#017977]/10 rounded-lg flex items-center justify-center">
                        <Users className="w-5 h-5 text-[#3a2d9c]" />
                      </div>
                    </div>
                    <div className="text-4xl font-bold text-gray-900">
                      {websiteAnalytics.totalUsers}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Message Trend Chart */}
            <div className="mt-6 bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
              <div className="mb-4">
                <h2 className="text-xl font-bold text-gray-900">Message Trends</h2>
                <p className="text-sm text-gray-500">Daily message activity over the selected period</p>
              </div>

              {loading ? (
                // Skeleton loading for chart
                <div className="animate-pulse">
                  <div className="h-[400px] bg-gray-200 rounded-lg"></div>
                </div>
              ) : chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={400}>
                  <LineChart
                    data={chartData}
                    margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis
                      dataKey="displayDate"
                      stroke="#6b7280"
                      style={{ fontSize: '12px' }}
                      angle={-45}
                      textAnchor="end"
                      height={80}
                    />
                    <YAxis
                      stroke="#6b7280"
                      style={{ fontSize: '12px' }}
                      label={{ value: 'Messages', angle: -90, position: 'insideLeft', style: { fontSize: '14px', fill: '#6b7280' } }}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#fff',
                        border: '1px solid #e5e7eb',
                        borderRadius: '8px',
                        boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                      }}
                      labelStyle={{ color: '#374151', fontWeight: 'bold' }}
                    />
                    <Legend
                      wrapperStyle={{ fontSize: '14px' }}
                      iconType="line"
                    />
                    <Line
                      type="monotone"
                      dataKey="messages"
                      stroke="url(#colorGradient)"
                      strokeWidth={3}
                      dot={{ fill: '#3a2d9c', r: 4 }}
                      activeDot={{ r: 6, fill: '#017977' }}
                      name="Total Messages"
                    />
                    <defs>
                      <linearGradient id="colorGradient" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="#3a2d9c" />
                        <stop offset="100%" stopColor="#017977" />
                      </linearGradient>
                    </defs>
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-64 text-gray-400">
                  <div className="text-center">
                    <MessageSquare className="w-16 h-16 mx-auto mb-4 opacity-50" />
                    <p className="text-lg">No message data available for the selected period</p>
                  </div>
                </div>
              )}
            </div>

            {/* Top 10 Users Section */}
            <div className="mt-6 bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
              <div className="mb-6 flex items-center gap-3">
                <TrendingUp className="w-6 h-6 text-[#3a2d9c]" />
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Top 10 Most Active Users</h2>
                  <p className="text-sm text-gray-500">Users with the highest number of chat messages</p>
                </div>
              </div>

              {loading ? (
                // Skeleton loading for top users
                <div className="space-y-3">
                  {[1, 2, 3, 4, 5].map(i => (
                    <div key={i} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg animate-pulse">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gray-200 rounded-full"></div>
                        <div>
                          <div className="h-4 bg-gray-200 rounded w-32 mb-2"></div>
                          <div className="h-3 bg-gray-200 rounded w-24"></div>
                        </div>
                      </div>
                      <div className="h-6 bg-gray-200 rounded w-20"></div>
                    </div>
                  ))}
                </div>
              ) : topUsers.length > 0 ? (
                <div className="space-y-3">
                  {topUsers.map((user, index) => (
                    <div
                      key={index}
                      onClick={() => handleUserClick(user)}
                      className="flex items-center justify-between p-4 bg-gradient-to-r from-gray-50 to-gray-100 rounded-lg hover:from-[#3a2d9c]/5 hover:to-[#017977]/5 border border-gray-200 hover:border-[#3a2d9c]/30 transition-all cursor-pointer group"
                    >
                      <div className="flex items-center gap-4">
                        <div className="flex-shrink-0 w-10 h-10 bg-gradient-to-br from-[#3a2d9c] to-[#017977] rounded-full flex items-center justify-center text-white font-bold text-lg">
                          {index + 1}
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-white rounded-lg border border-gray-200 group-hover:border-[#3a2d9c]/30 transition-all">
                            {user.identifierType === "phone" && <Phone className="w-5 h-5 text-[#3a2d9c]" />}
                            {user.identifierType === "email" && <Mail className="w-5 h-5 text-[#3a2d9c]" />}
                            {user.identifierType === "guest" && <UserCircle className="w-5 h-5 text-[#3a2d9c]" />}
                          </div>
                          <div>
                            <p className="font-semibold text-gray-900 group-hover:text-[#3a2d9c] transition-colors">
                              {user.identifier}
                            </p>
                            <p className="text-xs text-gray-500">
                              Last active: {new Date(user.lastActive).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="text-2xl font-bold text-[#3a2d9c]">{user.messageCount}</p>
                          <p className="text-xs text-gray-500">messages</p>
                        </div>
                        <MessageSquare className="w-5 h-5 text-gray-400 group-hover:text-[#3a2d9c] transition-colors" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex items-center justify-center h-48 text-gray-400">
                  <div className="text-center">
                    <Users className="w-16 h-16 mx-auto mb-4 opacity-50" />
                    <p className="text-lg">No user data available for the selected period</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* User Chat History Modal */}
      <UserChatHistoryModal
        isOpen={showChatModal}
        onClose={handleCloseModal}
        userData={selectedUser}
      />
    </div>
  );
};

export default AnalyticsPage;
