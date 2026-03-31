import { useEffect, useState, useCallback, useMemo } from "react";
import api, {
  fetchUserCompany,
  fetchUserUsage,
  fetchChatbotSubscription,
  fetchUserMessages,
  fetchUniqueEmailsAndPhones,
  fetchUserSessions
} from "../services/api";
import { toast } from "react-toastify";
import SessionModal from "../components/SessionModal";
import Layout from "../components/Layout";
import WelcomeCard from "../components/WelcomeCard";
import DynamicCharts from "../components/DynamicCharts";
import UserDetailsCard from "../components/UserDetailsCard";
import UserSidebar from "../components/UserSidebar";
import Header from "../components/Header";
import EnhancedMetricCard from "../components/EnhancedMetricCard";
import EnhancedAnalyticsDashboard from "../components/EnhancedAnalyticsDashboard";
import { motion, AnimatePresence } from "framer-motion";

import {
  Mail,
  Globe,
  Crown,
  Calendar,
  Clock,
  Clock3,
  BarChart3,
  MessageSquare,
  Users,
  Briefcase,
  UserCircle,
  Bot,
  SquareUserRound,
  CircleUser,
  Search,
  Bell,
  Settings,
  ChevronDown,
  ArrowUp,
  ArrowDown,
  MoreHorizontal,
  RefreshCw,
  ShoppingCart,
  Eye,
  User,
  TrendingUp,
  DollarSign,
  Activity,
  Zap,
  Target,
  Star,
  Sparkles,
  Layers,
  Cpu,
  Database,
  Shield,
  Rocket,
  Flame,
  Wind,
  Waves,
  Mountain,
  Sun,
  Moon,
  Cloud,
  Droplets,
  Snowflake,
  Leaf,
} from "lucide-react";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import advancedFormat from "dayjs/plugin/advancedFormat";
import customParseFormat from "dayjs/plugin/customParseFormat";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";

dayjs.extend(relativeTime);
dayjs.extend(advancedFormat);
dayjs.extend(customParseFormat);
dayjs.extend(timezone);
dayjs.extend(utc);

// --- Enhanced 3D Skeleton Loader Components ---
const CardSkeleton = () => (
  <div className="bg-white/90 backdrop-blur-sm rounded-2xl p-4 sm:p-6 shadow-xl border border-gray-200/50 animate-pulse relative overflow-hidden group transform-gpu" style={{ transformStyle: 'preserve-3d' }}>
    {/* 3D Shimmer Effect */}
    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-gray-200/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 transform-gpu" style={{ transform: 'translateZ(5px)' }}></div>

    {/* 3D Shadow Layer */}
    <div className="absolute inset-0 bg-gradient-to-br from-black/5 to-transparent rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-1000 transform-gpu" style={{ transform: 'translateZ(-2px) translateY(4px)' }}></div>

    <div className="flex items-center gap-2 sm:gap-3 mb-6 sm:mb-8 relative z-10 transform-gpu group-hover:rotateX(1deg) group-hover:rotateY(1deg) transition-transform duration-1000">
      <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-br from-gray-200 to-gray-300 rounded-xl animate-pulse transform-gpu" style={{ transform: 'translateZ(10px)' }}></div>
      <div className="h-4 sm:h-5 bg-gradient-to-r from-gray-200 to-gray-300 rounded-full w-1/2 animate-pulse transform-gpu" style={{ transform: 'translateZ(10px)' }}></div>
    </div>
    <div className="space-y-4 sm:space-y-6 relative z-10 transform-gpu group-hover:rotateX(-1deg) group-hover:rotateY(-1deg) transition-transform duration-1000">
      {[...Array(3)].map((_, i) => (
        <div key={i} className="flex items-start gap-3 sm:gap-4 animate-pulse transform-gpu" style={{ animationDelay: `${i * 0.2}s`, transform: `translateZ(${5 + i * 2}px)` }}>
          <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-br from-gray-200 to-gray-300 rounded-xl"></div>
          <div className="flex-1 space-y-2 sm:space-y-3">
            <div className="h-3 sm:h-4 bg-gradient-to-r from-gray-200 to-gray-300 rounded-full w-1/4"></div>
            <div className="h-4 sm:h-5 bg-gradient-to-r from-gray-200 to-gray-300 rounded-full w-3/4"></div>
          </div>
        </div>
      ))}
    </div>
  </div>
);

const MessageItemSkeleton = () => (
  <div className="bg-white/90 backdrop-blur-sm border border-gray-200/50 rounded-xl p-4 sm:p-6 mb-4 sm:mb-6 shadow-lg animate-pulse relative overflow-hidden group transform-gpu" style={{ transformStyle: 'preserve-3d' }}>
    {/* 3D Shimmer Effect */}
    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-gray-200/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 transform-gpu" style={{ transform: 'translateZ(5px)' }}></div>

    {/* 3D Shadow Layer */}
    <div className="absolute inset-0 bg-gradient-to-br from-black/5 to-transparent rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-1000 transform-gpu" style={{ transform: 'translateZ(-2px) translateY(3px)' }}></div>

    <div className="flex items-center gap-3 sm:gap-4 mb-3 sm:mb-4 relative z-10 transform-gpu group-hover:rotateX(1deg) group-hover:rotateY(1deg) transition-transform duration-1000">
      <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-br from-gray-200 to-gray-300 rounded-full animate-pulse transform-gpu" style={{ transform: 'translateZ(8px)' }}></div>
      <div className="h-4 sm:h-5 bg-gradient-to-r from-gray-200 to-gray-300 rounded-full w-20 sm:w-24 animate-pulse transform-gpu" style={{ transform: 'translateZ(8px)' }}></div>
    </div>
    <div className="space-y-2 sm:space-y-3 relative z-10 transform-gpu group-hover:rotateX(-1deg) group-hover:rotateY(-1deg) transition-transform duration-1000">
      <div className="h-3 sm:h-4 bg-gradient-to-r from-gray-200 to-gray-300 rounded-full w-full animate-pulse transform-gpu" style={{ transform: 'translateZ(6px)' }}></div>
      <div className="h-3 sm:h-4 bg-gradient-to-r from-gray-200 to-gray-300 rounded-full w-5/6 animate-pulse transform-gpu" style={{ transform: 'translateZ(6px)' }}></div>
    </div>
  </div>
);

const DashboardSkeleton = () => (
  <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 relative overflow-hidden perspective-1000 font-['Exo_2',sans-serif]">
    {/* 3D Animated Background Elements */}
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <div className="absolute -top-40 -right-40 w-80 h-80 bg-gradient-to-br from-blue-200/40 to-indigo-200/40 rounded-full blur-3xl animate-pulse transform-gpu" style={{ transform: 'translateZ(0) rotateX(15deg) rotateY(25deg)' }}></div>
      <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-gradient-to-tr from-purple-200/40 to-pink-200/40 rounded-full blur-3xl animate-pulse transform-gpu" style={{ animationDelay: '1s', transform: 'translateZ(0) rotateX(-10deg) rotateY(-20deg)' }}></div>
      <div className="absolute top-20 left-1/4 w-32 h-32 bg-gradient-to-br from-emerald-200/20 to-teal-200/20 rounded-full blur-2xl animate-bounce transform-gpu" style={{ animationDuration: '3s', transform: 'translateZ(50px) rotateX(20deg) rotateY(30deg)' }}></div>
      <div className="absolute bottom-20 right-1/4 w-40 h-40 bg-gradient-to-br from-rose-200/20 to-pink-200/20 rounded-full blur-2xl animate-bounce transform-gpu" style={{ animationDuration: '4s', animationDelay: '1s', transform: 'translateZ(30px) rotateX(-15deg) rotateY(-25deg)' }}></div>

      {/* 3D Geometric Shapes */}
      <div className="absolute top-1/3 right-1/3 w-24 h-24 bg-gradient-to-br from-yellow-200/20 to-orange-200/20 rounded-lg blur-xl animate-spin transform-gpu" style={{ animationDuration: '8s', transform: 'translateZ(100px) rotateX(45deg) rotateY(45deg)' }}></div>
      <div className="absolute bottom-1/3 left-1/3 w-20 h-20 bg-gradient-to-br from-violet-200/20 to-purple-200/20 rounded-lg blur-xl animate-spin transform-gpu" style={{ animationDuration: '6s', animationDirection: 'reverse', transform: 'translateZ(80px) rotateX(-30deg) rotateY(60deg)' }}></div>
    </div>

    <div className="relative max-w-7xl mx-auto p-4 sm:p-6 lg:p-10 space-y-6 sm:space-y-8 lg:space-y-12 transform-gpu">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-8">
        <div className="transform transition-all duration-700 hover:scale-105 transform-gpu" style={{ transformStyle: 'preserve-3d' }}>
          <CardSkeleton />
        </div>
        <div className="transform transition-all duration-700 hover:scale-105 transform-gpu" style={{ animationDelay: '0.2s', transformStyle: 'preserve-3d' }}>
          <CardSkeleton />
        </div>
        <div className="transform transition-all duration-700 hover:scale-105 transform-gpu sm:col-span-2 lg:col-span-1" style={{ animationDelay: '0.4s', transformStyle: 'preserve-3d' }}>
          <CardSkeleton />
        </div>
      </div>
      <div className="bg-white/90 backdrop-blur-sm rounded-2xl p-4 sm:p-6 lg:p-8 shadow-xl border border-gray-200/50 animate-pulse relative overflow-hidden group transform-gpu" style={{ transformStyle: 'preserve-3d' }}>
        {/* 3D Shimmer Effect */}
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-gray-200/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 transform-gpu" style={{ transform: 'translateZ(5px)' }}></div>
        {/* 3D Shadow Layer */}
        <div className="absolute inset-0 bg-gradient-to-br from-black/5 to-transparent rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-1000 transform-gpu" style={{ transform: 'translateZ(-2px) translateY(6px)' }}></div>
        <div className="relative z-10 transform-gpu group-hover:rotateX(1deg) group-hover:rotateY(1deg) transition-transform duration-1000">
          <div className="h-6 sm:h-8 bg-gradient-to-r from-gray-200 to-gray-300 rounded-full w-1/3 mb-6 sm:mb-8 animate-pulse transform-gpu" style={{ transform: 'translateZ(10px)' }}></div>
          <MessageItemSkeleton />
          <MessageItemSkeleton />
          <MessageItemSkeleton />
        </div>
      </div>
    </div>
  </div>
);
// --- End Skeleton Components ---

const UserDashboard = () => {

  // Core Data States
  const [company, setCompany] = useState(null);
  const [plan, setPlan] = useState(null);
  const [usage, setUsage] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);

  // Enhanced Analytics States
  const [analytics, setAnalytics] = useState({
    dailyStats: [],
    weeklyStats: [],
    monthlyStats: [],
    userEngagement: {},
    messageTrends: {},
    performanceMetrics: {},
    realTimeStats: {}
  });

  // UI States
  const [page, setPage] = useState(1);
  const [sessionFilter, setSessionFilter] = useState("");
  const [allSessions, setAllSessions] = useState([]);
  const [totalPages, setTotalPages] = useState(1);
  const [sessionMessages, setSessionMessages] = useState(null);
  const [selectedSessionId, setSelectedSessionId] = useState(null);
  const [viewMode, setViewMode] = useState("email");
  const [allEmails, setAllEmails] = useState([]);
  const [chartAnimationKey, setChartAnimationKey] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [refreshInterval, setRefreshInterval] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(new Date());

  // Animation States
  const [floatingElements, setFloatingElements] = useState([]);
  const [particleSystem, setParticleSystem] = useState([]);

  const limit = 10;
  const token = localStorage.getItem("token");

  // Check token validity and redirect if needed
  useEffect(() => {
    if (!token) {
      window.location.href = "/";
      return;
    }
  }, [token]);

  // Load Exo 2 font from Google Fonts
  useEffect(() => {
    const link = document.createElement('link');
    link.href = 'https://fonts.googleapis.com/css2?family=Exo+2:wght@300;400;500;600;700;800;900&display=swap';
    link.rel = 'stylesheet';
    document.head.appendChild(link);

    return () => {
      // Cleanup on unmount
      if (document.head.contains(link)) {
        document.head.removeChild(link);
      }
    };
  }, []);

  // Helper function to handle 403 errors (account deactivated)
  const handle403Error = (err) => {
    if (err.response?.status === 403) {
      localStorage.removeItem("token");
      window.location.href = "/account-deactivated";
      return true; // Indicates error was handled
    }
    return false; // Error not handled
  };

  // Enhanced Data Fetching Functions
  const fetchSubscription = async (chatbotId) => {
    try {
      const res = await fetchChatbotSubscription(chatbotId);

      // Handle nested response structure
      const subscriptionData = res.data.data || res.data;

      if (!subscriptionData || !subscriptionData.end_date) {
        toast.error("Subscription not found");
        return;
      }

      setPlan(subscriptionData);
    } catch (err) {
      if (handle403Error(err)) return;
      toast.error("Failed to fetch subscription");
    }
  };

  // Fetch comprehensive analytics data
  const fetchAnalytics = useCallback(async (chatbotId) => {
    try {

      // Fetch analytics data in parallel with individual error handling
      const [
        emailsRes,
        subscriptionRes,
        messagesRes,
        sessionsRes
      ] = await Promise.allSettled([
        fetchUniqueEmailsAndPhones(),
        fetchChatbotSubscription(chatbotId),
        fetchUserMessages({ page: 1, limit: 100 }),
        fetchUserSessions()
      ]);

      // Check each result individually

      // Check for 403 errors in rejected promises
      const rejectedPromises = [emailsRes, subscriptionRes, messagesRes, sessionsRes].filter(r => r.status === 'rejected');
      for (const rejected of rejectedPromises) {
        if (rejected.reason?.response?.status === 403) {
          localStorage.removeItem("token");
          window.location.href = "/account-deactivated";
          return;
        }
      }

      // Handle failed requests
      let hasErrors = false;
      if (emailsRes.status === 'rejected') {
        hasErrors = true;
      }
      if (subscriptionRes.status === 'rejected') {
        hasErrors = true;
      }

      // Handle nested response structure for emails/phones
      const emailData = emailsRes.status === 'fulfilled' ? (emailsRes.value.data.data || emailsRes.value.data) : {};
      const emails = emailData.emails || [];
      const phoneNumbers = emailData.phoneNumbers || [];

      // Handle nested response structure for messages
      const messageData = messagesRes.status === 'fulfilled' ? (messagesRes.value.data.data || messagesRes.value.data) : {};
      const allMessages = messageData.messages || [];

      // Extract sessions from the dedicated sessions endpoint
      const sessions = [];
      if (sessionsRes.status === 'fulfilled') {
        const sessionsData = sessionsRes.value.data.data || sessionsRes.value.data;
        const sessionsList = sessionsData.sessions || [];
        sessions.push(...sessionsList.map(session => ({
          id: session.session_id,
          name: session.phone ? `Phone: ${session.phone}` : session.email ? `Email: ${session.email}` : (session.name ? `User: ${session.name}` : `Session: ${session.session_id}`)
        })));
      } else {
        // Fallback to extracting from messages if sessions API fails
        const uniqueSessions = [...new Set(allMessages.map(msg => msg.session_id).filter(Boolean))];
        sessions.push(...uniqueSessions.map(sessionId => ({ id: sessionId, name: `Session: ${sessionId}` })));
      }

      // Handle nested response structure for subscription
      const subscriptionData = subscriptionRes.status === 'fulfilled' ? (subscriptionRes.value.data.data || subscriptionRes.value.data) : {};
      const subscription = subscriptionData;

      // Calculate daily stats
      const dailyStats = calculateDailyStats(allMessages);

      // Calculate weekly stats
      const weeklyStats = calculateWeeklyStats(allMessages);

      // Calculate monthly stats
      const monthlyStats = calculateMonthlyStats(allMessages);

      // Calculate user engagement metrics
      const userEngagement = calculateUserEngagement(allMessages, sessions);

      // Calculate message trends
      const messageTrends = calculateMessageTrends(allMessages);

      // Calculate performance metrics
      const performanceMetrics = calculatePerformanceMetrics(allMessages, subscription);

      // Calculate real-time stats
      const realTimeStats = calculateRealTimeStats(allMessages);

      setAnalytics({
        dailyStats,
        weeklyStats,
        monthlyStats,
        userEngagement,
        messageTrends,
        performanceMetrics,
        realTimeStats
      });

    } catch (err) {
      toast.error("Failed to load analytics data");
    }
  }, [token]);

  // Calculate daily statistics
  const calculateDailyStats = (messages) => {
    const now = new Date();
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      return date;
    }).reverse();

    return last7Days.map(date => {
      const dayStart = new Date(date);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(date);
      dayEnd.setHours(23, 59, 59, 999);

      const dayMessages = messages.filter(msg => {
        const msgDate = new Date(msg.timestamp);
        return msgDate >= dayStart && msgDate <= dayEnd;
      });

      const uniqueUsers = new Set(dayMessages.map(msg => msg.email || msg.phone)).size;
      const userMessages = dayMessages.filter(msg => msg.sender === 'user').length;
      const botMessages = dayMessages.filter(msg => msg.sender === 'bot').length;

      return {
        date: date.toISOString().split('T')[0],
        dayName: date.toLocaleDateString('en-US', { weekday: 'short' }),
        totalMessages: dayMessages.length,
        userMessages,
        botMessages,
        uniqueUsers,
        avgResponseTime: calculateAvgResponseTime(dayMessages),
        engagementRate: calculateEngagementRate(dayMessages)
      };
    });
  };

  // Calculate weekly statistics
  const calculateWeeklyStats = (messages) => {
    const now = new Date();
    const last4Weeks = Array.from({ length: 4 }, (_, i) => {
      const weekStart = new Date(now);
      weekStart.setDate(weekStart.getDate() - (i + 1) * 7);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);
      return { start: weekStart, end: weekEnd };
    }).reverse();

    return last4Weeks.map((week, index) => {
      const weekMessages = messages.filter(msg => {
        const msgDate = new Date(msg.timestamp);
        return msgDate >= week.start && msgDate <= week.end;
      });

      const uniqueUsers = new Set(weekMessages.map(msg => msg.email || msg.phone)).size;
      const sessions = new Set(weekMessages.map(msg => msg.session_id)).size;

      return {
        week: `Week ${4 - index}`,
        startDate: week.start.toISOString().split('T')[0],
        endDate: week.end.toISOString().split('T')[0],
        totalMessages: weekMessages.length,
        uniqueUsers,
        sessions,
        avgMessagesPerUser: uniqueUsers > 0 ? Math.round(weekMessages.length / uniqueUsers) : 0,
        growthRate: index > 0 ? calculateGrowthRate(weekMessages.length, last4Weeks[index - 1]) : 0
      };
    });
  };

  // Calculate monthly statistics
  const calculateMonthlyStats = (messages) => {
    const now = new Date();
    const last6Months = Array.from({ length: 6 }, (_, i) => {
      const month = new Date(now.getFullYear(), now.getMonth() - i, 1);
      return month;
    }).reverse();

    return last6Months.map(month => {
      const monthStart = new Date(month.getFullYear(), month.getMonth(), 1);
      const monthEnd = new Date(month.getFullYear(), month.getMonth() + 1, 0);

      const monthMessages = messages.filter(msg => {
        const msgDate = new Date(msg.timestamp);
        return msgDate >= monthStart && msgDate <= monthEnd;
      });

      const uniqueUsers = new Set(monthMessages.map(msg => msg.email || msg.phone)).size;
      const sessions = new Set(monthMessages.map(msg => msg.session_id)).size;

      return {
        month: month.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
        totalMessages: monthMessages.length,
        uniqueUsers,
        sessions,
        avgDailyMessages: Math.round(monthMessages.length / monthEnd.getDate()),
        retentionRate: calculateRetentionRate(monthMessages)
      };
    });
  };

  // Calculate user engagement metrics
  const calculateUserEngagement = (messages, sessions) => {
    const userSessions = {};

    // Group messages by user
    messages.forEach(msg => {
      const userId = msg.email || msg.phone;
      if (!userSessions[userId]) {
        userSessions[userId] = {
          sessions: new Set(),
          messages: [],
          firstSeen: new Date(msg.timestamp),
          lastSeen: new Date(msg.timestamp)
        };
      }
      userSessions[userId].sessions.add(msg.session_id);
      userSessions[userId].messages.push(msg);
      userSessions[userId].lastSeen = new Date(Math.max(
        userSessions[userId].lastSeen.getTime(),
        new Date(msg.timestamp).getTime()
      ));
    });

    const engagementData = Object.values(userSessions);

    return {
      totalUsers: engagementData.length,
      activeUsers: engagementData.filter(user => {
        const daysSinceLastSeen = (new Date() - user.lastSeen) / (1000 * 60 * 60 * 24);
        return daysSinceLastSeen <= 7;
      }).length,
      avgSessionsPerUser: engagementData.reduce((sum, user) => sum + user.sessions.size, 0) / engagementData.length,
      avgMessagesPerUser: engagementData.reduce((sum, user) => sum + user.messages.length, 0) / engagementData.length,
      avgSessionDuration: calculateAvgSessionDuration(engagementData),
      userRetentionRate: calculateUserRetentionRate(engagementData)
    };
  };

  // Calculate message trends
  const calculateMessageTrends = (messages) => {
    const now = new Date();
    const last24Hours = messages.filter(msg => {
      const msgDate = new Date(msg.timestamp);
      return (now - msgDate) <= 24 * 60 * 60 * 1000;
    });

    const hourlyDistribution = Array.from({ length: 24 }, (_, hour) => {
      const hourMessages = last24Hours.filter(msg => {
        const msgDate = new Date(msg.timestamp);
        return msgDate.getHours() === hour;
      });
      return {
        hour,
        messages: hourMessages.length,
        users: new Set(hourMessages.map(msg => msg.email || msg.phone)).size
      };
    });

    return {
      last24Hours: last24Hours.length,
      peakHour: hourlyDistribution.reduce((peak, current) =>
        current.messages > peak.messages ? current : peak
      ),
      hourlyDistribution,
      avgMessagesPerHour: Math.round(last24Hours.length / 24),
      responseRate: calculateResponseRate(last24Hours)
    };
  };

  // Calculate performance metrics
  const calculatePerformanceMetrics = (messages, subscription) => {
    const totalMessages = messages.length;
    const userMessages = messages.filter(msg => msg.sender === 'user').length;
    const botMessages = messages.filter(msg => msg.sender === 'bot').length;

    const planLimit = subscription?.plan_id?.max_users || 1000;
    const usedTokens = messages.reduce((sum, msg) => sum + (msg.token_count || 0), 0);
    const tokenLimit = subscription?.plan_id?.tokens || 100000;

    return {
      totalMessages,
      userMessages,
      botMessages,
      messageEfficiency: userMessages > 0 ? Math.round((botMessages / userMessages) * 100) : 0,
      tokenUsage: {
        used: usedTokens,
        limit: tokenLimit,
        percentage: Math.round((usedTokens / tokenLimit) * 100)
      },
      userLimit: {
        used: new Set(messages.map(msg => msg.email || msg.phone)).size,
        limit: planLimit,
        percentage: Math.round((new Set(messages.map(msg => msg.email || msg.phone)).size / planLimit) * 100)
      },
      avgResponseTime: calculateAvgResponseTime(messages),
      successRate: calculateSuccessRate(messages)
    };
  };

  // Calculate real-time statistics
  const calculateRealTimeStats = (messages) => {
    const now = new Date();
    const lastHour = messages.filter(msg => {
      const msgDate = new Date(msg.timestamp);
      return (now - msgDate) <= 60 * 60 * 1000;
    });

    const last5Minutes = messages.filter(msg => {
      const msgDate = new Date(msg.timestamp);
      return (now - msgDate) <= 5 * 60 * 1000;
    });

    // Calculate last session datetime - find when the most recent session started
    let lastSessionDateTime = null;
    if (messages.length > 0) {
      // Group messages by session_id
      const sessionsMap = new Map();
      messages.forEach(msg => {
        if (msg.session_id) {
          if (!sessionsMap.has(msg.session_id)) {
            sessionsMap.set(msg.session_id, []);
          }
          sessionsMap.get(msg.session_id).push(new Date(msg.timestamp));
        }
      });

      // Find the last activity time (latest message) for each session to identify the most recent session
      const sessionData = Array.from(sessionsMap.entries()).map(([sessionId, timestamps]) => ({
        sessionId,
        lastActivity: new Date(Math.max(...timestamps)),
        startTime: new Date(Math.min(...timestamps))
      }));

      // Get the most recent session (by last activity) and return its start time
      if (sessionData.length > 0) {
        const mostRecentSession = sessionData.reduce((prev, current) =>
          current.lastActivity > prev.lastActivity ? current : prev
        );
        lastSessionDateTime = mostRecentSession.startTime;
      }
    }

    // Calculate last message sent datetime - find the most recent message timestamp
    const lastMessageDateTime = messages.length > 0 ?
      new Date(Math.max(...messages.map(msg => new Date(msg.timestamp)))) : null;

    return {
      messagesLastHour: lastHour.length,
      messagesLast5Minutes: last5Minutes.length,
      activeUsersLastHour: new Set(lastHour.map(msg => msg.email || msg.phone)).size,
      currentLoad: last5Minutes.length,
      systemHealth: calculateSystemHealth(messages),
      lastSessionDateTime: lastSessionDateTime,
      lastMessageDateTime: lastMessageDateTime
    };
  };

  // Helper calculation functions
  const calculateAvgResponseTime = (messages) => {
    const userMessages = messages.filter(msg => msg.sender === 'user');
    const botMessages = messages.filter(msg => msg.sender === 'bot');

    let totalResponseTime = 0;
    let responseCount = 0;

    userMessages.forEach(userMsg => {
      const botResponse = botMessages.find(botMsg =>
        botMsg.session_id === userMsg.session_id &&
        new Date(botMsg.timestamp) > new Date(userMsg.timestamp)
      );

      if (botResponse) {
        totalResponseTime += new Date(botResponse.timestamp) - new Date(userMsg.timestamp);
        responseCount++;
      }
    });

    return responseCount > 0 ? Math.round(totalResponseTime / responseCount / 1000) : 0; // in seconds
  };

  const calculateEngagementRate = (messages) => {
    const sessions = new Set(messages.map(msg => msg.session_id));
    const multiMessageSessions = Array.from(sessions).filter(sessionId => {
      const sessionMessages = messages.filter(msg => msg.session_id === sessionId);
      return sessionMessages.length > 1;
    });

    return sessions.size > 0 ? Math.round((multiMessageSessions.length / sessions.size) * 100) : 0;
  };

  const calculateGrowthRate = (current, previous) => {
    if (previous === 0) return 100;
    return Math.round(((current - previous) / previous) * 100);
  };

  const calculateRetentionRate = (messages) => {
    // Simplified retention calculation
    const uniqueUsers = new Set(messages.map(msg => msg.email || msg.phone));
    const returningUsers = Array.from(uniqueUsers).filter(userId => {
      const userMessages = messages.filter(msg => (msg.email || msg.phone) === userId);
      const sessions = new Set(userMessages.map(msg => msg.session_id));
      return sessions.size > 1;
    });

    return uniqueUsers.size > 0 ? Math.round((returningUsers.length / uniqueUsers.size) * 100) : 0;
  };

  const calculateAvgSessionDuration = (engagementData) => {
    // Simplified session duration calculation
    return engagementData.reduce((sum, user) => {
      const sessionDurations = Array.from(user.sessions).map(sessionId => {
        const sessionMessages = user.messages.filter(msg => msg.session_id === sessionId);
        if (sessionMessages.length < 2) return 0;

        const firstMessage = sessionMessages[0];
        const lastMessage = sessionMessages[sessionMessages.length - 1];
        return new Date(lastMessage.timestamp) - new Date(firstMessage.timestamp);
      });

      return sum + sessionDurations.reduce((a, b) => a + b, 0) / sessionDurations.length;
    }, 0) / engagementData.length;
  };

  const calculateUserRetentionRate = (engagementData) => {
    const now = new Date();
    const activeUsers = engagementData.filter(user => {
      const daysSinceLastSeen = (now - user.lastSeen) / (1000 * 60 * 60 * 24);
      return daysSinceLastSeen <= 30;
    });

    return engagementData.length > 0 ? Math.round((activeUsers.length / engagementData.length) * 100) : 0;
  };

  const calculateResponseRate = (messages) => {
    const userMessages = messages.filter(msg => msg.sender === 'user');
    const botMessages = messages.filter(msg => msg.sender === 'bot');

    return userMessages.length > 0 ? Math.round((botMessages.length / userMessages.length) * 100) : 0;
  };

  const calculateSuccessRate = (messages) => {
    // Simplified success rate calculation based on message patterns
    const sessions = new Set(messages.map(msg => msg.session_id));
    const successfulSessions = Array.from(sessions).filter(sessionId => {
      const sessionMessages = messages.filter(msg => msg.session_id === sessionId);
      const hasUserMessage = sessionMessages.some(msg => msg.sender === 'user');
      const hasBotResponse = sessionMessages.some(msg => msg.sender === 'bot');
      return hasUserMessage && hasBotResponse;
    });

    return sessions.size > 0 ? Math.round((successfulSessions.length / sessions.size) * 100) : 0;
  };

  const calculateSystemHealth = (messages) => {
    const now = new Date();
    const lastHour = messages.filter(msg => {
      const msgDate = new Date(msg.timestamp);
      return (now - msgDate) <= 60 * 60 * 1000;
    });

    const responseRate = calculateResponseRate(lastHour);
    const avgResponseTime = calculateAvgResponseTime(lastHour);

    // Health score based on response rate and response time
    let healthScore = 100;
    if (responseRate < 80) healthScore -= 20;
    if (avgResponseTime > 30) healthScore -= 15;
    if (lastHour.length === 0) healthScore = 95; // No activity is not necessarily bad

    return Math.max(0, Math.min(100, healthScore));
  };

  const fetchData = async () => {
    try {
      // Check if token exists before making requests
      if (!token) {
        window.location.href = "/";
        return;
      }

      console.log("🚀 [fetchData] Starting data fetch...");

      const [companyRes, usageRes] = await Promise.all([
        fetchUserCompany(),
        fetchUserUsage(),
      ]);

      console.log("📦 [fetchData] Raw API responses:");
      console.log("  - companyRes:", companyRes);
      console.log("  - usageRes:", usageRes);

      const companyData = companyRes.data;
      setCompany(companyData);
      console.log("🏢 [fetchData] Company data:", companyData);

      // Handle nested response structure for usage data
      const usageData = usageRes.data.data || usageRes.data;
      console.log("📊 [fetchData] Usage data extracted:", usageData);
      console.log("  - total_messages:", usageData.total_messages);
      console.log("  - unique_users:", usageData.unique_users);
      console.log("  - last_activity:", usageData.last_activity);
      setUsage(usageData);

      // Extract chatbot_id from the nested data structure
      const chatbotId = companyData.data?.chatbot_id || companyData.chatbot_id;
      console.log("🤖 [fetchData] Chatbot ID:", chatbotId);

      if (chatbotId) {
        await fetchSubscription(chatbotId);
        await fetchAnalytics(chatbotId);
      } else {
        toast.error("No chatbot ID found for this user.");
        setPlan(null); // Prevent crashing
      }
    } catch (err) {
      console.error("❌ [fetchData] Error:", err);
      // Handle 401 Unauthorized errors
      if (err.response?.status === 401) {
        localStorage.removeItem("token");
        window.location.href = "/";
        return;
      }

      // Handle 403 Forbidden (account deactivated)
      if (err.response?.status === 403) {
        // Redirect to deactivated page immediately
        localStorage.removeItem("token");
        window.location.href = "/account-deactivated";
        return;
      }

      toast.error("Failed to load dashboard data");
      setPlan(null); // Ensure no crash
    } finally {
      setLoading(false);
    }
  };

  // Real-time data refresh
  const startRealTimeUpdates = useCallback(() => {
    if (refreshInterval) {
      clearInterval(refreshInterval);
    }

    const interval = setInterval(async () => {
      if (company?.chatbot_id) {
        try {
          await fetchAnalytics(company.chatbot_id);
          setLastUpdated(new Date());
        } catch (err) {
          // Check for 403 error (account deactivated)
          if (err.response?.status === 403) {
            localStorage.removeItem("token");
            window.location.href = "/account-deactivated";
            return;
          }
          // Real-time update failed silently for other errors
        }
      }
    }, 30000); // Update every 30 seconds

    setRefreshInterval(interval);
  }, [company?.chatbot_id, fetchAnalytics, refreshInterval]);

  // Particle system for floating effects
  const generateParticles = useCallback(() => {
    const particles = Array.from({ length: 20 }, (_, i) => ({
      id: i,
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      vx: (Math.random() - 0.5) * 0.5,
      vy: (Math.random() - 0.5) * 0.5,
      size: Math.random() * 3 + 1,
      opacity: Math.random() * 0.5 + 0.1,
      color: ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'][Math.floor(Math.random() * 5)]
    }));
    setParticleSystem(particles);
  }, []);

  // Floating elements animation
  const generateFloatingElements = useCallback(() => {
    const elements = Array.from({ length: 8 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      rotation: Math.random() * 360,
      scale: Math.random() * 0.5 + 0.5,
      delay: Math.random() * 2,
      duration: Math.random() * 3 + 2,
      icon: [Zap, Star, Sparkles, Layers, Cpu, Database, Shield, Rocket][i]
    }));
    setFloatingElements(elements);
  }, []);

  const fetchMessages = async () => {
    try {
      if (!token) {
        return;
      }

      // Prepare parameters
      const params = {
        page: page,
        limit: limit
      };

      // Add filters if they exist
      if (viewMode === "session" && sessionFilter) {
        params.session_id = sessionFilter;
      } else if (viewMode === "email" && sessionFilter) {
        params.email = sessionFilter;
      }

      const res = await fetchUserMessages(params);

      // Handle nested response structure
      const messageData = res.data.data || res.data;

      setMessages(messageData.messages || []);
      setTotalPages(messageData.totalPages || 1);
    } catch (err) {
      if (err.response?.status === 401) {
        localStorage.removeItem("token");
        window.location.href = "/";
        return;
      }

      toast.error("Failed to fetch messages");
    }
  };


  const fetchFilterOptions = async () => {
    try {
      if (!token) {
        return;
      }

      // Fetch sessions only
      const sessionsRes = await fetchUserSessions();

      // Handle sessions from the dedicated sessions endpoint
      const sessionsData = sessionsRes.data.data || sessionsRes.data;
      const sessions = sessionsData.sessions || [];

      const sessionList = sessions.map(session => ({
        id: session.session_id,
        name: session.phone ? `Phone: ${session.phone}` : session.email ? `Email: ${session.email}` : (session.name ? `User: ${session.name}` : `Session: ${session.session_id}`)
      }));
      setAllSessions(sessionList);

      // Fetch emails separately
      const emailRes = await fetchUniqueEmailsAndPhones();
      const emailData = emailRes.data.data || emailRes.data;
      setAllEmails(emailData.emails || []);

    } catch (err) {
      if (err.response?.status === 401) {
        localStorage.removeItem("token");
        window.location.href = "/";
        return;
      }
    }
  };

  const openSessionModal = async (sessionId) => {
    setSelectedSessionId(sessionId);
    try {
      const res = await fetchUserMessages({
        session_id: sessionId,
        limit: 1000
      });
      setSessionMessages(res.data.messages || []);
    } catch (err) {
      // Error fetching session messages
    }
  };

  useEffect(() => {
    fetchData();
    fetchFilterOptions();
    generateParticles();
    generateFloatingElements();
  }, []);

  useEffect(() => {
    const timeout = setTimeout(() => {
      fetchMessages();
    }, 300); // 300ms debounce

    return () => clearTimeout(timeout);
  }, [page, sessionFilter, viewMode]);

  useEffect(() => {
    setPage(1); // reset to page 1 when session changes
  }, [sessionFilter, viewMode]);

  useEffect(() => {
    if (company?.chatbot_id && !loading) {
      startRealTimeUpdates();
    }

    return () => {
      if (refreshInterval) {
        clearInterval(refreshInterval);
      }
    };
  }, [company?.chatbot_id, loading, startRealTimeUpdates, refreshInterval]);

  useEffect(() => {
    const interval = setInterval(() => {
      setChartAnimationKey(prev => prev + 1);
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const animateParticles = () => {
      setParticleSystem(prev => prev.map(particle => ({
        ...particle,
        x: (particle.x + particle.vx + window.innerWidth) % window.innerWidth,
        y: (particle.y + particle.vy + window.innerHeight) % window.innerHeight,
        rotation: particle.rotation + 0.5
      })));
    };

    const interval = setInterval(animateParticles, 50);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const animateFloatingElements = () => {
      setFloatingElements(prev => prev.map(element => ({
        ...element,
        y: element.y + Math.sin(Date.now() / 1000 + element.delay) * 0.5,
        rotation: element.rotation + 0.2,
        scale: element.scale + Math.sin(Date.now() / 1000 + element.delay) * 0.05
      })));
    };

    const interval = setInterval(animateFloatingElements, 16);
    return () => clearInterval(interval);
  }, []);

  const handleLogout = () => {
    localStorage.clear();
    window.location.href = "/login";
  };

  if (loading) {
    return (
      <Layout>
        <DashboardSkeleton />
      </Layout>
    );
  }

  if (!company || !usage)
    return (
      <Layout chatbotId={company?.chatbot_id}>
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-red-50 to-pink-50 flex items-center justify-center relative overflow-hidden perspective-1000 font-['Exo_2',sans-serif]">
          {/* 3D Animated Background Elements */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute -top-40 -right-40 w-80 h-80 bg-gradient-to-br from-red-200/40 to-pink-200/40 rounded-full blur-3xl animate-pulse transform-gpu" style={{ transform: 'translateZ(0) rotateX(15deg) rotateY(25deg)' }}></div>
            <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-gradient-to-tr from-rose-200/40 to-pink-200/40 rounded-full blur-3xl animate-pulse transform-gpu" style={{ animationDelay: '1s', transform: 'translateZ(0) rotateX(-10deg) rotateY(-20deg)' }}></div>
            <div className="absolute top-20 left-1/4 w-32 h-32 bg-gradient-to-br from-red-200/20 to-pink-200/20 rounded-full blur-2xl animate-bounce transform-gpu" style={{ animationDuration: '3s', transform: 'translateZ(50px) rotateX(20deg) rotateY(30deg)' }}></div>

            {/* 3D Geometric Shapes */}
            <div className="absolute top-1/3 right-1/3 w-24 h-24 bg-gradient-to-br from-red-200/20 to-pink-200/20 rounded-lg blur-xl animate-spin transform-gpu" style={{ animationDuration: '8s', transform: 'translateZ(100px) rotateX(45deg) rotateY(45deg)' }}></div>
            <div className="absolute bottom-1/3 left-1/3 w-20 h-20 bg-gradient-to-br from-rose-200/20 to-pink-200/20 rounded-lg blur-xl animate-spin transform-gpu" style={{ animationDuration: '6s', animationDirection: 'reverse', transform: 'translateZ(80px) rotateX(-30deg) rotateY(60deg)' }}></div>
          </div>

          <div className="text-center p-8 bg-white/90 backdrop-blur-sm rounded-2xl shadow-2xl border border-red-200/50 max-w-md mx-4 relative z-10 transform transition-all duration-700 hover:scale-105 hover:shadow-3xl transform-gpu" style={{ transformStyle: 'preserve-3d' }}>
            {/* 3D Glowing Border Effect */}
            <div className="absolute -inset-1 bg-gradient-to-r from-red-500/20 via-pink-500/20 to-rose-500/20 rounded-2xl blur opacity-0 hover:opacity-100 transition-opacity duration-1000 transform-gpu" style={{ transform: 'translateZ(-10px)' }}></div>
            {/* 3D Shadow Layer */}
            <div className="absolute inset-0 bg-gradient-to-br from-black/5 to-transparent rounded-2xl opacity-0 hover:opacity-100 transition-opacity duration-1000 transform-gpu" style={{ transform: 'translateZ(-5px) translateY(8px)' }}></div>

            <div className="relative transform-gpu hover:rotateX(2deg) hover:rotateY(1deg) transition-transform duration-1000" style={{ transformStyle: 'preserve-3d' }}>
              <div className="w-16 h-16 bg-gradient-to-br from-red-100 to-pink-100 rounded-full flex items-center justify-center mx-auto mb-6 animate-pulse transform-gpu" style={{ transform: 'translateZ(10px)' }}>
                <div className="w-8 h-8 bg-gradient-to-br from-red-500 to-pink-500 rounded-full animate-bounce transform-gpu" style={{ transform: 'translateZ(15px)' }}></div>
              </div>
              <h2 className="text-2xl font-bold text-gray-800 mb-4 animate-pulse transform-gpu" style={{ transform: 'translateZ(8px)' }}>Oops! Something went wrong</h2>
              <p className="text-red-600 text-lg mb-6 animate-pulse transform-gpu" style={{ animationDelay: '0.5s', transform: 'translateZ(6px)' }}>Failed to load data. Please try again.</p>
              <button
                onClick={() => window.location.reload()}
                className="px-6 py-3 bg-gradient-to-r from-red-500 to-pink-500 text-white rounded-xl font-semibold hover:from-red-600 hover:to-pink-600 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105 animate-pulse transform-gpu"
                style={{ animationDelay: '1s', transform: 'translateZ(12px)' }}
              >
                Try Again
              </button>
            </div>
          </div>
        </div>
      </Layout>
    );

  const userLimit = plan?.max_users || 200;
  const userPercentage = Math.round((usage.unique_users / userLimit) * 100);

  // Enhanced dynamic uptime calculation based on available data
  const calculateUptime = () => {
    if (!usage || !plan) return 99.9; // Default fallback

    // Calculate uptime based on message success rate and user engagement
    const messageSuccessRate = Math.min(100, Math.max(95, 100 - (usage.total_messages * 0.001)));
    const userEngagementRate = Math.min(100, Math.max(90, 100 - (usage.unique_users * 0.01)));
    const planHealthRate = plan.days_remaining > 30 ? 100 : Math.max(85, 100 - ((30 - plan.days_remaining) * 0.5));

    // Add time-based variation for more realistic uptime
    const timeVariation = Math.sin(Date.now() / 15000) * 0.2; // Very subtle variation

    // Weighted average of different factors
    const uptime = (messageSuccessRate * 0.4 + userEngagementRate * 0.3 + planHealthRate * 0.3) + timeVariation;
    return Math.min(99.9, Math.max(85.0, uptime));
  };

  const calculateUptimeTrend = () => {
    if (!usage || !plan) return 8; // Default fallback

    // Calculate trend based on recent activity and plan status
    const messageTrend = Math.min(15, Math.max(0, Math.round(usage.total_messages / 100)));
    const userTrend = Math.min(10, Math.max(0, Math.round(usage.unique_users / 5)));
    const planTrend = plan.days_remaining > 15 ? 5 : Math.max(0, Math.round(plan.days_remaining / 3));

    // Add subtle time-based variation
    const timeVariation = Math.sin(Date.now() / 12000) * 1;

    return Math.min(15, Math.max(0, messageTrend + userTrend + planTrend + timeVariation)).toFixed(2);
  };

  // Generate dynamic uptime chart data with animation
  const generateUptimeChartData = () => {
    if (!usage || !plan) return {
      uptimeLine: "10,45 50,40 90,35 130,30 170,32",
      trendLine: "10,35 50,30 90,25 130,20 170,22"
    };

    const uptime = currentUptime;
    const trend = uptimeTrend;
    const variation = Math.sin(Date.now() / 10000) * 1.5; // Subtle animation variation

    // Generate uptime line with subtle variations
    const uptimePoints = [
      { x: 10, y: 45 - (uptime - 85) * 0.3 + variation },
      { x: 50, y: 40 - (uptime - 85) * 0.25 + variation * 0.8 },
      { x: 90, y: 35 - (uptime - 85) * 0.2 + variation * 0.6 },
      { x: 130, y: 30 - (uptime - 85) * 0.15 + variation * 0.4 },
      { x: 170, y: 32 - (uptime - 85) * 0.1 + variation * 0.2 }
    ];

    // Generate trend line with variations
    const trendPoints = [
      { x: 10, y: 35 - (trend * 0.5) + variation * 0.5 },
      { x: 50, y: 30 - (trend * 0.4) + variation * 0.4 },
      { x: 90, y: 25 - (trend * 0.3) + variation * 0.3 },
      { x: 130, y: 20 - (trend * 0.2) + variation * 0.2 },
      { x: 170, y: 22 - (trend * 0.1) + variation * 0.1 }
    ];

    return {
      uptimeLine: uptimePoints.map(p => `${p.x},${Math.max(10, Math.min(50, p.y))}`).join(' '),
      trendLine: trendPoints.map(p => `${p.x},${Math.max(10, Math.min(50, p.y))}`).join(' ')
    };
  };

  const currentUptime = calculateUptime();
  const uptimeTrend = calculateUptimeTrend();

  // Enhanced dynamic chart data generation functions with better calculations
  const generateMessagesChartData = () => {
    if (!usage?.total_messages) return "10,50 50,40 90,30 130,20 170,25";

    const totalMessages = usage.total_messages;
    const planLimit = plan?.max_messages || 10000;
    const usagePercentage = (totalMessages / planLimit) * 100;

    // More realistic scaling based on usage percentage
    const baseValue = Math.max(5, Math.min(35, usagePercentage * 0.35));
    const variation = Math.sin(Date.now() / 10000) * 2; // Subtle animation variation

    // Generate 5 data points with more realistic growth pattern
    const points = [
      { x: 10, y: 50 - (baseValue * 0.2) + variation },
      { x: 50, y: 45 - (baseValue * 0.4) + variation * 0.8 },
      { x: 90, y: 40 - (baseValue * 0.6) + variation * 0.6 },
      { x: 130, y: 35 - (baseValue * 0.8) + variation * 0.4 },
      { x: 170, y: 30 - baseValue + variation * 0.2 }
    ];

    return points.map(p => `${p.x},${Math.max(10, Math.min(50, p.y))}`).join(' ');
  };

  const generateMessagesChartFill = () => {
    if (!usage?.total_messages) return "10,60 10,50 50,40 90,30 130,20 170,25 170,60";

    const totalMessages = usage.total_messages;
    const planLimit = plan?.max_messages || 10000;
    const usagePercentage = (totalMessages / planLimit) * 100;

    const baseValue = Math.max(5, Math.min(35, usagePercentage * 0.35));
    const variation = Math.sin(Date.now() / 10000) * 2;

    const points = [
      { x: 10, y: 50 - (baseValue * 0.2) + variation },
      { x: 50, y: 45 - (baseValue * 0.4) + variation * 0.8 },
      { x: 90, y: 40 - (baseValue * 0.6) + variation * 0.6 },
      { x: 130, y: 35 - (baseValue * 0.8) + variation * 0.4 },
      { x: 170, y: 30 - baseValue + variation * 0.2 }
    ];

    const fillPoints = points.map(p => `${p.x},${Math.max(10, Math.min(50, p.y))}`).join(' ');
    return `10,60 ${fillPoints} 170,60`;
  };

  // Calculate dynamic percentage for Total Messages
  const calculateMessagesPercentage = () => {
    if (!usage?.total_messages) return 7;

    const totalMessages = usage.total_messages;
    const planLimit = plan?.max_messages || 10000;
    const usagePercentage = (totalMessages / planLimit) * 100;

    // More realistic percentage calculation
    if (usagePercentage < 1) return Math.max(5, Math.round(totalMessages / 20));
    if (usagePercentage < 5) return Math.max(7, Math.round(usagePercentage * 2));
    if (usagePercentage < 10) return Math.max(10, Math.round(usagePercentage * 1.5));
    return Math.min(50, Math.round(usagePercentage * 1.2));
  };

  // Calculate dynamic percentage for Unique Users
  const calculateUsersPercentage = () => {
    if (!usage?.unique_users) return 0;

    const uniqueUsers = usage.unique_users;
    const planLimit = plan?.max_users || 2000;
    const usagePercentage = (uniqueUsers / planLimit) * 100;

    // More realistic percentage calculation
    if (usagePercentage < 0.5) return 0; // Show 0% for very low usage
    if (usagePercentage < 1) return Math.max(1, Math.round(uniqueUsers / 10));
    if (usagePercentage < 5) return Math.max(2, Math.round(usagePercentage * 1.5));
    return Math.min(50, Math.round(usagePercentage * 1.2));
  };

  const generateVisitorsChartData = () => {
    if (!usage?.unique_users) return [
      { x: 10, y: 40, height: 20 },
      { x: 40, y: 35, height: 25 },
      { x: 70, y: 30, height: 30 },
      { x: 100, y: 25, height: 35 },
      { x: 130, y: 20, height: 40 },
      { x: 160, y: 22, height: 38 }
    ];

    const uniqueUsers = usage.unique_users;
    const planLimit = plan?.max_users || 2000;
    const usagePercentage = (uniqueUsers / planLimit) * 100;

    // More realistic scaling based on usage percentage
    const baseHeight = Math.max(10, Math.min(45, usagePercentage * 0.45));
    const variation = Math.sin(Date.now() / 8000) * 1.5; // Subtle animation variation

    // Generate 6 bars showing realistic growth pattern with animation
    return [
      {
        x: 10,
        y: 50 - (baseHeight * 0.2) + variation,
        height: baseHeight * 0.2,
        delay: 0
      },
      {
        x: 40,
        y: 50 - (baseHeight * 0.35) + variation * 0.8,
        height: baseHeight * 0.35,
        delay: 0.1
      },
      {
        x: 70,
        y: 50 - (baseHeight * 0.5) + variation * 0.6,
        height: baseHeight * 0.5,
        delay: 0.2
      },
      {
        x: 100,
        y: 50 - (baseHeight * 0.65) + variation * 0.4,
        height: baseHeight * 0.65,
        delay: 0.3
      },
      {
        x: 130,
        y: 50 - (baseHeight * 0.8) + variation * 0.2,
        height: baseHeight * 0.8,
        delay: 0.4
      },
      {
        x: 160,
        y: 50 - (baseHeight * 0.75) + variation * 0.1,
        height: baseHeight * 0.75,
        delay: 0.5
      }
    ];
  };

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
            <div className="flex flex-col lg:flex-row gap-8">
              {/* Left Section - Dashboard & Analytics - 70% width */}
              <div className="flex-1 lg:w-[70%]">
                {/* Main Dashboard Title */}
                <h1 className="text-3xl font-bold text-gray-800 mb-8">Dashboard & Analytics</h1>


                {/* Key Metrics Cards - Three in one line */}
                <div className="grid grid-cols-3 gap-4">
                  {/* Total Messages Card */}
                  <div className="bg-gradient-to-r from-[#3a2d9c]/80 to-[#017977]/80 rounded-lg p-6 text-white relative">
                    <div className="text-base font-medium mb-1">Total Messages</div>
                    <div className="text-4xl font-bold mb-4">{usage?.total_messages || 0}</div>
                    <div className="absolute bottom-4 right-4 opacity-50">
                      <MessageSquare size={37} />
                    </div>
                  </div>

                  {/* Total Users Card */}
                  <div className="bg-gradient-to-r from-[#3a2d9c]/80 to-[#017977]/80 rounded-lg p-6 text-white relative">
                    <div className="text-base font-medium mb-1">Total Users</div>
                    <div className="text-4xl font-bold mb-4">{usage?.unique_users || 0}</div>
                    <div className="absolute bottom-4 right-4 opacity-50">
                      <Users size={37} />
                    </div>
                  </div>

                  {/* Performance Score Card */}
                  <div className="bg-gradient-to-r from-[#3a2d9c]/80 to-[#017977]/80 rounded-lg p-6 text-white relative">
                    <div className="text-base font-medium mb-1">Performance Score</div>
                    <div className="text-4xl font-bold mb-4">{analytics?.realTimeStats?.systemHealth || 0}%</div>
                    <div className="absolute bottom-4 right-4 opacity-50">
                      <Activity size={37} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Section - Account Summary - 30% width */}
              <div className="lg:w-[30%]">
                <h1 className="text-2xl font-bold text-gray-800 mb-4">Account Summary</h1>
                <div className="space-y-4">


                  {/* Last Session DateTime */}
                  <div className="bg-white border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-gradient-to-r from-[#3a2d9c] to-[#017977] rounded flex items-center justify-center">
                        <Clock size={16} className="text-white" />
                      </div>
                      <div>
                        <div className="text-sm text-gray-600">Last Session DateTime</div>
                        <div className="font-semibold text-gray-800">
                          {analytics?.realTimeStats?.lastSessionDateTime ?
                            dayjs(analytics.realTimeStats.lastSessionDateTime).format('DD-MMM-YYYY HH:mm:ss') :
                            'N/A'
                          }
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Last Message Sent DateTime */}
                  <div className="bg-white border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-gradient-to-r from-[#3a2d9c] to-[#017977] rounded flex items-center justify-center">
                        <MessageSquare size={16} className="text-white" />
                      </div>
                      <div>
                        <div className="text-sm text-gray-600">Last Message Sent DateTime</div>
                        <div className="font-semibold text-gray-800">
                          {analytics?.realTimeStats?.lastMessageDateTime ?
                            dayjs(analytics.realTimeStats.lastMessageDateTime).format('DD-MMM-YYYY HH:mm:ss') :
                            'N/A'
                          }
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>



            {/* Analytics Data Section */}
            <div className="mt-12 mb-6">
              <h1 className="text-3xl font-bold text-gray-800 mb-2">Analytics Data</h1>
              <p className="text-gray-500 text-base mt-2">Comprehensive insights and performance metrics</p>
            </div>

            {/* Enhanced Dynamic Charts */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.4 }}
            >
              <DynamicCharts
                plan={plan}
                usage={usage}
                company={company}
                analytics={analytics}
              />
            </motion.div>

            {/* Enhanced Session Modal */}
            <SessionModal
              sessionId={selectedSessionId}
              messages={sessionMessages}
              onClose={() => {
                setSelectedSessionId(null);
                setSessionMessages(null);
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserDashboard;