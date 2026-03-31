import { useEffect, useState } from "react";
import api from "../services/api";
import {
  Bot,
  Building2,
  Users,
  MessageSquareText,
  BarChart3,
  CheckCircle,
} from "lucide-react";
import ClipLoader from "react-spinners/ClipLoader";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell } from 'recharts';

const OverviewPage = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [trends, setTrends] = useState([]);
  const [trendsLoading, setTrendsLoading] = useState(true);
  const [timeRange, setTimeRange] = useState(30);

  const fetchStats = async () => {
    try {
      const token = localStorage.getItem("adminToken");
      const res = await api.get("/admin/stats", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      // The API wraps data in a 'data' property via sendSuccessResponse
      // Response structure: { success: true, status: 200, message: "...", data: { totalCompanies, totalChatbots, ... } }
      const statsData = res.data?.data || res.data || {};
      setStats(statsData);
    } catch (err) {
      console.error("Failed to fetch stats:", err);
      console.error("Error details:", err.response?.data);
    } finally {
      setLoading(false);
    }
  };

  const fetchTrends = async (days = 30) => {
    try {
      const token = localStorage.getItem("adminToken");
      const res = await api.get(`/admin/trends?days=${days}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const trendsData = res.data?.data?.trends || res.data?.trends || [];

      // Calculate cumulative totals for growth trends
      let cumulativeChatbots = 0;
      let cumulativeCompanies = 0;
      let cumulativeMessages = 0;
      let cumulativeUsers = 0;

      const processedTrends = trendsData.map(trend => {
        cumulativeChatbots += trend.companies || 0; // Note: backend returns 'companies' for new companies that day
        cumulativeCompanies += trend.companies || 0;
        cumulativeMessages += trend.messages || 0;
        cumulativeUsers += trend.sessions || 0; // Using sessions as proxy for unique users

        return {
          ...trend,
          totalChatbots: cumulativeChatbots,
          totalCompanies: cumulativeCompanies,
          totalMessages: cumulativeMessages,
          uniqueUsers: cumulativeUsers,
          date: trend.date // Ensure date is in YYYY-MM-DD format
        };
      });

      setTrends(processedTrends);
    } catch (err) {
      console.error("Failed to fetch trends:", err);
      setTrends([]);
    } finally {
      setTrendsLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
    fetchTrends(timeRange);
  }, []);

  useEffect(() => {
    if (timeRange) {
      setTrendsLoading(true);
      fetchTrends(timeRange);
    }
  }, [timeRange]);

  // Shimmer loader
  const SkeletonCard = () => (
    <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm animate-pulse">
      <div className="w-12 h-12 rounded-lg bg-gray-200 mb-4"></div>
      <div className="h-4 bg-gray-200 rounded w-24 mb-2"></div>
      <div className="h-6 bg-gray-200 rounded w-16"></div>
    </div>
  );

  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {[...Array(6)].map((_, idx) => (
          <SkeletonCard key={idx} />
        ))}
      </div>
    );
  }

  if (!stats) {
    return <p className="text-red-500 text-center mt-6">Failed to load stats.</p>;
  }

  // Prepare pie chart data
  const pieData = [
    {
      name: 'Registered Users',
      value: stats?.users?.total || 0,
      color: '#2563eb'
    },
    {
      name: 'Monthly Chat',
      value: stats?.messages?.last7Days || 0,
      color: '#3b82f6'
    },
    {
      name: 'Total Messages',
      value: stats?.messages?.total || 0,
      color: '#06b6d4'
    }
  ];

  const statData = [
    {
      label: "Total Chatbots",
      value: stats?.chatbots?.total || 0,
      iconBg: "bg-blue-500",
      icon: <Bot className="w-7 h-7 text-white" />,
    },
    {
      label: "Total Companies",
      value: stats?.companies?.total || 0,
      iconBg: "bg-teal-500",
      icon: <Building2 className="w-7 h-7 text-white" />,
    },
    {
      label: "Active Companies",
      value: stats?.companies?.active || 0,
      iconBg: "bg-green-500",
      icon: <CheckCircle className="w-7 h-7 text-white" />,
    },
    {
      label: "Registered Users",
      value: stats?.users?.total || 0,
      iconBg: "bg-blue-600",
      icon: <Users className="w-7 h-7 text-white" />,
    },
    {
      label: "Total Messages",
      value: stats?.messages?.total || 0,
      iconBg: "bg-teal-400",
      icon: <MessageSquareText className="w-7 h-7 text-white" />,
    },
    {
      label: "Monthly Chat",
      value: stats?.messages?.last7Days || 0,
      iconBg: "bg-blue-400",
      icon: <MessageSquareText className="w-7 h-7 text-white" />,
    },
  ];

  return (
    <div className="w-full">
      <h1 className="text-2xl md:text-3xl font-bold mb-4 md:mb-6 text-[#1e3a8a]">
        Overview
      </h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
        {statData.map((stat, idx) => (
          <div
            key={idx}
            className="bg-white p-4 md:p-6 rounded-xl border border-gray-200 shadow-lg hover:shadow-xl hover:-translate-y-1 transform transition-all duration-300"
          >
            <p className="text-xs md:text-sm font-medium text-gray-500 uppercase tracking-wide mb-3 md:mb-4">{stat.label}</p>
            <div className="flex items-center gap-3 md:gap-4">
              <div
                className={`w-12 h-12 md:w-14 md:h-14 rounded-lg ${stat.iconBg} flex items-center justify-center shadow-md flex-shrink-0`}
              >
                {stat.icon}
              </div>
              <div className="flex-1">
                <h3 className="text-2xl md:text-3xl font-bold text-gray-800">
                  {typeof stat.value === 'number' ? stat.value.toLocaleString() : stat.value}
                </h3>
                {stat.dateRange && (
                  <p className="text-[10px] md:text-xs text-gray-400 mt-1">
                    {new Date(stat.dateRange.start).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - {new Date(stat.dateRange.end).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </p>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Charts Section - Grid Layout */}
      <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Growth Trends Chart */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-lg p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6">
          <div>
            <h2 className="text-xl md:text-2xl font-bold text-gray-900">Growth Trends</h2>
            <p className="text-sm text-gray-500 mt-1">Cumulative metrics over time</p>
          </div>
          <div className="flex gap-2 mt-4 sm:mt-0">
            {[7, 30, 90].map((days) => (
              <button
                key={days}
                onClick={() => setTimeRange(days)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  timeRange === days
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {days}d
              </button>
            ))}
          </div>
        </div>

        {trendsLoading ? (
          <div className="flex items-center justify-center h-[400px]">
            <ClipLoader color="#3b82f6" size={40} />
          </div>
        ) : trends.length > 0 ? (
          <ResponsiveContainer width="100%" height={400}>
            <LineChart
              data={trends}
              margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis
                dataKey="date"
                stroke="#6b7280"
                style={{ fontSize: '12px' }}
                angle={-45}
                textAnchor="end"
                height={80}
                tickFormatter={(value) => {
                  const date = new Date(value);
                  return `${date.getMonth() + 1}/${date.getDate()}`;
                }}
              />
              <YAxis
                yAxisId="left"
                stroke="#6b7280"
                style={{ fontSize: '12px' }}
                label={{ value: 'Count', angle: -90, position: 'insideLeft', style: { fontSize: '14px', fill: '#6b7280' } }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#fff',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                }}
                labelStyle={{ color: '#374151', fontWeight: 'bold' }}
                formatter={(value, name) => [value.toLocaleString(), name]}
                labelFormatter={(label) => {
                  const date = new Date(label);
                  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                }}
              />
              <Legend
                wrapperStyle={{ fontSize: '14px' }}
                iconType="line"
              />
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="totalChatbots"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={{ fill: '#3b82f6', r: 3 }}
                activeDot={{ r: 5 }}
                name="Total Chatbots"
              />
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="totalCompanies"
                stroke="#14b8a6"
                strokeWidth={2}
                dot={{ fill: '#14b8a6', r: 3 }}
                activeDot={{ r: 5 }}
                name="Total Companies"
              />
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="uniqueUsers"
                stroke="#2563eb"
                strokeWidth={2}
                dot={{ fill: '#2563eb', r: 3 }}
                activeDot={{ r: 5 }}
                name="Registered Users"
              />
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="totalMessages"
                stroke="#06b6d4"
                strokeWidth={2}
                dot={{ fill: '#06b6d4', r: 3 }}
                activeDot={{ r: 5 }}
                name="Total Messages"
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex items-center justify-center h-[400px] text-gray-400">
            <p>No trend data available</p>
          </div>
        )}
        </div>

        {/* Pie Chart for Metrics Distribution */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-lg p-6">
          <div className="mb-6">
            <h2 className="text-xl md:text-2xl font-bold text-gray-900">Metrics Distribution</h2>
            <p className="text-sm text-gray-500 mt-1">Current activity breakdown</p>
          </div>

          {loading ? (
            <div className="flex items-center justify-center h-[400px]">
              <ClipLoader color="#3b82f6" size={40} />
            </div>
          ) : stats ? (
              <div className="flex flex-col items-center">
                <ResponsiveContainer width="100%" height={350}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent, value }) => 
                        `${name}: ${value.toLocaleString()} (${(percent * 100).toFixed(1)}%)`
                      }
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#fff',
                        border: '1px solid #e5e7eb',
                        borderRadius: '8px',
                        boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                      }}
                      formatter={(value, name) => [value.toLocaleString(), name]}
                    />
                    <Legend
                      wrapperStyle={{ fontSize: '14px', marginTop: '20px' }}
                      iconType="circle"
                    />
                  </PieChart>
                </ResponsiveContainer>
              
              {/* Summary Stats */}
              <div className="mt-6 w-full grid grid-cols-3 gap-4">
                <div className="text-center p-4 bg-blue-50 rounded-lg">
                  <p className="text-xs text-gray-500 mb-1">Registered Users</p>
                  <p className="text-2xl font-bold text-blue-600">
                    {(stats?.users?.total || 0).toLocaleString()}
                  </p>
                </div>
                <div className="text-center p-4 bg-blue-50 rounded-lg">
                  <p className="text-xs text-gray-500 mb-1">Monthly Chat</p>
                  <p className="text-2xl font-bold text-blue-500">
                    {(stats?.messages?.last7Days || 0).toLocaleString()}
                  </p>
                </div>
                <div className="text-center p-4 bg-cyan-50 rounded-lg">
                  <p className="text-xs text-gray-500 mb-1">Total Messages</p>
                  <p className="text-2xl font-bold text-cyan-500">
                    {(stats?.messages?.total || 0).toLocaleString()}
                  </p>
                </div>
              </div>
              </div>
          ) : (
            <div className="flex items-center justify-center h-[400px] text-gray-400">
              <p>No data available</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default OverviewPage;
