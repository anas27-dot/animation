import { useEffect, useState } from "react";
import api from "../services/api";
import { toast } from "react-toastify";
import SessionModal from "../components/SessionModal";
import Layout from "../components/Layout";
import WelcomeCard from "../components/WelcomeCard";
import DynamicCharts from "../components/DynamicCharts";
import UserDetailsCard from "../components/UserDetailsCard";

import {
  Mail,
  Globe,  
  Crown,
  Calendar,
  Clock3,
  BarChart3,
  MessageSquare,
  Users,
  Briefcase,
  UserCircle,
  Bot,
  SquareUserRound,
  CircleUser,
  TrendingUp,
  TrendingDown,
  ChevronDown,
  Settings,
  MoreHorizontal,
} from "lucide-react";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
dayjs.extend(relativeTime);

// --- Enhanced 3D Skeleton Loader Components ---
const CardSkeleton = () => (
  <div className="bg-white/90 backdrop-blur-sm rounded-2xl p-6 shadow-xl border border-gray-200/50 animate-pulse relative overflow-hidden group transform-gpu" style={{transformStyle: 'preserve-3d'}}>
    {/* 3D Shimmer Effect */}
    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-gray-200/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 transform-gpu" style={{transform: 'translateZ(5px)'}}></div>
    
    {/* 3D Shadow Layer */}
    <div className="absolute inset-0 bg-gradient-to-br from-black/5 to-transparent rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-1000 transform-gpu" style={{transform: 'translateZ(-2px) translateY(4px)'}}></div>
    
    <div className="flex items-center gap-3 mb-8 relative z-10 transform-gpu group-hover:rotateX(1deg) group-hover:rotateY(1deg) transition-transform duration-1000">
      <div className="w-10 h-10 bg-gradient-to-br from-gray-200 to-gray-300 rounded-xl animate-pulse transform-gpu" style={{transform: 'translateZ(10px)'}}></div>
      <div className="h-5 bg-gradient-to-r from-gray-200 to-gray-300 rounded-full w-1/2 animate-pulse transform-gpu" style={{transform: 'translateZ(10px)'}}></div>
    </div>
    <div className="space-y-6 relative z-10 transform-gpu group-hover:rotateX(-1deg) group-hover:rotateY(-1deg) transition-transform duration-1000">
      {[...Array(3)].map((_, i) => (
        <div key={i} className="flex items-start gap-4 animate-pulse transform-gpu" style={{animationDelay: `${i * 0.2}s`, transform: `translateZ(${5 + i * 2}px)`}}>
          <div className="w-10 h-10 bg-gradient-to-br from-gray-200 to-gray-300 rounded-xl"></div>
          <div className="flex-1 space-y-3">
            <div className="h-4 bg-gradient-to-r from-gray-200 to-gray-300 rounded-full w-1/4"></div>
            <div className="h-5 bg-gradient-to-r from-gray-200 to-gray-300 rounded-full w-3/4"></div>
          </div>
        </div>
      ))}
    </div>
  </div>
);

const MessageItemSkeleton = () => (
  <div className="bg-white/90 backdrop-blur-sm border border-gray-200/50 rounded-xl p-6 mb-6 shadow-lg animate-pulse relative overflow-hidden group transform-gpu" style={{transformStyle: 'preserve-3d'}}>
    {/* 3D Shimmer Effect */}
    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-gray-200/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 transform-gpu" style={{transform: 'translateZ(5px)'}}></div>
    
    {/* 3D Shadow Layer */}
    <div className="absolute inset-0 bg-gradient-to-br from-black/5 to-transparent rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-1000 transform-gpu" style={{transform: 'translateZ(-2px) translateY(3px)'}}></div>
    
    <div className="flex items-center gap-4 mb-4 relative z-10 transform-gpu group-hover:rotateX(1deg) group-hover:rotateY(1deg) transition-transform duration-1000">
      <div className="w-10 h-10 bg-gradient-to-br from-gray-200 to-gray-300 rounded-full animate-pulse transform-gpu" style={{transform: 'translateZ(8px)'}}></div>
      <div className="h-5 bg-gradient-to-r from-gray-200 to-gray-300 rounded-full w-24 animate-pulse transform-gpu" style={{transform: 'translateZ(8px)'}}></div>
    </div>
    <div className="space-y-3 relative z-10 transform-gpu group-hover:rotateX(-1deg) group-hover:rotateY(-1deg) transition-transform duration-1000">
      <div className="h-4 bg-gradient-to-r from-gray-200 to-gray-300 rounded-full w-full animate-pulse transform-gpu" style={{transform: 'translateZ(6px)'}}></div>
      <div className="h-4 bg-gradient-to-r from-gray-200 to-gray-300 rounded-full w-5/6 animate-pulse transform-gpu" style={{transform: 'translateZ(6px)'}}></div>
    </div>
  </div>
);

const DashboardSkeleton = () => (
  <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 relative overflow-hidden perspective-1000">
    {/* 3D Animated Background Elements */}
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <div className="absolute -top-40 -right-40 w-80 h-80 bg-gradient-to-br from-blue-200/40 to-indigo-200/40 rounded-full blur-3xl animate-pulse transform-gpu" style={{transform: 'translateZ(0) rotateX(15deg) rotateY(25deg)'}}></div>
      <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-gradient-to-tr from-purple-200/40 to-pink-200/40 rounded-full blur-3xl animate-pulse transform-gpu" style={{animationDelay: '1s', transform: 'translateZ(0) rotateX(-10deg) rotateY(-20deg)'}}></div>
      <div className="absolute top-20 left-1/4 w-32 h-32 bg-gradient-to-br from-emerald-200/20 to-teal-200/20 rounded-full blur-2xl animate-bounce transform-gpu" style={{animationDuration: '3s', transform: 'translateZ(50px) rotateX(20deg) rotateY(30deg)'}}></div>
      <div className="absolute bottom-20 right-1/4 w-40 h-40 bg-gradient-to-br from-rose-200/20 to-pink-200/20 rounded-full blur-2xl animate-bounce transform-gpu" style={{animationDuration: '4s', animationDelay: '1s', transform: 'translateZ(30px) rotateX(-15deg) rotateY(-25deg)'}}></div>
      
      {/* 3D Geometric Shapes */}
      <div className="absolute top-1/3 right-1/3 w-24 h-24 bg-gradient-to-br from-yellow-200/20 to-orange-200/20 rounded-lg blur-xl animate-spin transform-gpu" style={{animationDuration: '8s', transform: 'translateZ(100px) rotateX(45deg) rotateY(45deg)'}}></div>
      <div className="absolute bottom-1/3 left-1/3 w-20 h-20 bg-gradient-to-br from-violet-200/20 to-purple-200/20 rounded-lg blur-xl animate-spin transform-gpu" style={{animationDuration: '6s', animationDirection: 'reverse', transform: 'translateZ(80px) rotateX(-30deg) rotateY(60deg)'}}></div>
    </div>
    
    <div className="relative max-w-7xl mx-auto p-4 md:p-6 lg:p-10 space-y-8 md:space-y-12 transform-gpu">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="transform transition-all duration-700 hover:scale-105 transform-gpu" style={{transformStyle: 'preserve-3d'}}>
          <CardSkeleton />
        </div>
        <div className="transform transition-all duration-700 hover:scale-105 transform-gpu" style={{animationDelay: '0.2s', transformStyle: 'preserve-3d'}}>
          <CardSkeleton />
        </div>
        <div className="transform transition-all duration-700 hover:scale-105 transform-gpu" style={{animationDelay: '0.4s', transformStyle: 'preserve-3d'}}>
          <CardSkeleton />
        </div>
      </div>
      <div className="bg-white/90 backdrop-blur-sm rounded-2xl p-8 shadow-xl border border-gray-200/50 animate-pulse relative overflow-hidden group transform-gpu" style={{transformStyle: 'preserve-3d'}}>
        {/* 3D Shimmer Effect */}
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-gray-200/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 transform-gpu" style={{transform: 'translateZ(5px)'}}></div>
        {/* 3D Shadow Layer */}
        <div className="absolute inset-0 bg-gradient-to-br from-black/5 to-transparent rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-1000 transform-gpu" style={{transform: 'translateZ(-2px) translateY(6px)'}}></div>
        <div className="relative z-10 transform-gpu group-hover:rotateX(1deg) group-hover:rotateY(1deg) transition-transform duration-1000">
          <div className="h-8 bg-gradient-to-r from-gray-200 to-gray-300 rounded-full w-1/3 mb-8 animate-pulse transform-gpu" style={{transform: 'translateZ(10px)'}}></div>
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
  const [company, setCompany] = useState(null);
  const [plan, setPlan] = useState(null);
  const [usage, setUsage] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [sessionFilter, setSessionFilter] = useState("");
  const [allSessions, setAllSessions] = useState([]);
  const [totalPages, setTotalPages] = useState(1);
  const [sessionMessages, setSessionMessages] = useState(null);
  const [selectedSessionId, setSelectedSessionId] = useState(null);
  const [viewMode, setViewMode] = useState("email"); // default to 'session'
  const [allEmails, setAllEmails] = useState([]);

  const limit = 10;

  const token = localStorage.getItem("token");

  if (!token) {
    window.location.href = "/";
  }

  // Load Lato font from Google Fonts
  useEffect(() => {
    const link = document.createElement('link');
    link.href = 'https://fonts.googleapis.com/css2?family=Lato:wght@300;400;700;900&display=swap';
    link.rel = 'stylesheet';
    document.head.appendChild(link);
    
    return () => {
      // Cleanup on unmount
      if (document.head.contains(link)) {
        document.head.removeChild(link);
      }
    };
  }, []);

  const fetchSubscription = async (chatbotId) => {
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const res = await api.get(`/chatbot/${chatbotId}/subscription`, {
        headers,
      });

      if (!res.data || !res.data.end_date) {
        toast.error("Subscription not found");
        return;
      }

      setPlan(res.data);
    } catch (err) {
      toast.error("Failed to fetch subscription");
      console.error("Failed to fetch subscription:", err);
    }
  };

  const fetchData = async () => {
    try {
      const headers = { Authorization: `Bearer ${token}` };

      const [companyRes, usageRes] = await Promise.all([
        api.get("/user/company", { headers }),
        api.get("/user/usage", { headers }),
      ]);

      const companyData = companyRes.data;
      console.log("👉 Company Response:", companyData);
      setCompany(companyData);
      setUsage(usageRes.data);

      const chatbotId = companyData.chatbot_id;

      if (chatbotId) {
        await fetchSubscription(chatbotId); // ✅ Fetch plan
      } else {
        toast.error("❌ No chatbot ID found for this user.");
        setPlan(null); // Prevent crashing
      }
    } catch (err) {
      toast.error("Failed to load dashboard data");
      console.error("fetchData error:", err);
      setPlan(null); // Ensure no crash
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async () => {
    try {
      let url = `/user/messages?page=${page}&limit=${limit}`;

      if (viewMode === "session" && sessionFilter) {
        url += `&session_id=${sessionFilter}`;
      } else if (viewMode === "email" && sessionFilter) {
        url += `&email=${sessionFilter}`;
      }

      const res = await api.get(url, {
        headers: { Authorization: `Bearer ${token}` },
      });

      setMessages(res.data.messages);
      setTotalPages(res.data.totalPages || 1);
    } catch (err) {
      toast.error("Failed to fetch messages");
      console.error(err);
    }
  };

  const fetchFilterOptions = async () => {
    try {
      const headers = { Authorization: `Bearer ${token}` };

      const [sessionRes, emailRes] = await Promise.all([
        api.get("/user/messages/unique-sessions", { headers }),
        api.get("/user/messages/unique-emails-and-phones", { headers }),
      ]);

      setAllSessions(sessionRes.data.sessions);
      console.log("Fetched emails:", emailRes.data.emails);
      console.log("Fetched phone numbers:", emailRes.data.phoneNumbers);

      setAllEmails(emailRes.data.emails || []);
    } catch (err) {
      console.error("Failed to fetch filter options", err);
    }
  };

  const openSessionModal = async (sessionId) => {
    setSelectedSessionId(sessionId);
    try {
      const res = await api.get(
        `/user/messages?session_id=${sessionId}&limit=1000`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      setSessionMessages(res.data.messages || []);
    } catch (err) {
      console.error("Error fetching session messages:", err);
    }
  };

  useEffect(() => {
    fetchData();
    fetchFilterOptions();
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

  const handleLogout = () => {
    localStorage.clear();
    window.location.href = "/login";
  };
  
  // 👇 UPDATED: Replaced spinner with skeleton loader
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
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-red-50 to-pink-50 flex items-center justify-center relative overflow-hidden perspective-1000">
          {/* 3D Animated Background Elements */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute -top-40 -right-40 w-80 h-80 bg-gradient-to-br from-red-200/40 to-pink-200/40 rounded-full blur-3xl animate-pulse transform-gpu" style={{transform: 'translateZ(0) rotateX(15deg) rotateY(25deg)'}}></div>
            <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-gradient-to-tr from-rose-200/40 to-pink-200/40 rounded-full blur-3xl animate-pulse transform-gpu" style={{animationDelay: '1s', transform: 'translateZ(0) rotateX(-10deg) rotateY(-20deg)'}}></div>
            <div className="absolute top-20 left-1/4 w-32 h-32 bg-gradient-to-br from-red-200/20 to-pink-200/20 rounded-full blur-2xl animate-bounce transform-gpu" style={{animationDuration: '3s', transform: 'translateZ(50px) rotateX(20deg) rotateY(30deg)'}}></div>
            
            {/* 3D Geometric Shapes */}
            <div className="absolute top-1/3 right-1/3 w-24 h-24 bg-gradient-to-br from-red-200/20 to-pink-200/20 rounded-lg blur-xl animate-spin transform-gpu" style={{animationDuration: '8s', transform: 'translateZ(100px) rotateX(45deg) rotateY(45deg)'}}></div>
            <div className="absolute bottom-1/3 left-1/3 w-20 h-20 bg-gradient-to-br from-rose-200/20 to-pink-200/20 rounded-lg blur-xl animate-spin transform-gpu" style={{animationDuration: '6s', animationDirection: 'reverse', transform: 'translateZ(80px) rotateX(-30deg) rotateY(60deg)'}}></div>
          </div>
          
          <div className="text-center p-8 bg-white/90 backdrop-blur-sm rounded-2xl shadow-2xl border border-red-200/50 max-w-md mx-4 relative z-10 transform transition-all duration-700 hover:scale-105 hover:shadow-3xl transform-gpu" style={{transformStyle: 'preserve-3d'}}>
            {/* 3D Glowing Border Effect */}
            <div className="absolute -inset-1 bg-gradient-to-r from-red-500/20 via-pink-500/20 to-rose-500/20 rounded-2xl blur opacity-0 hover:opacity-100 transition-opacity duration-1000 transform-gpu" style={{transform: 'translateZ(-10px)'}}></div>
            {/* 3D Shadow Layer */}
            <div className="absolute inset-0 bg-gradient-to-br from-black/5 to-transparent rounded-2xl opacity-0 hover:opacity-100 transition-opacity duration-1000 transform-gpu" style={{transform: 'translateZ(-5px) translateY(8px)'}}></div>
            
            <div className="relative transform-gpu hover:rotateX(2deg) hover:rotateY(1deg) transition-transform duration-1000" style={{transformStyle: 'preserve-3d'}}>
              <div className="w-16 h-16 bg-gradient-to-br from-red-100 to-pink-100 rounded-full flex items-center justify-center mx-auto mb-6 animate-pulse transform-gpu" style={{transform: 'translateZ(10px)'}}>
                <div className="w-8 h-8 bg-gradient-to-br from-red-500 to-pink-500 rounded-full animate-bounce transform-gpu" style={{transform: 'translateZ(15px)'}}></div>
              </div>
              <h2 className="text-2xl font-bold text-gray-800 mb-4 animate-pulse transform-gpu" style={{transform: 'translateZ(8px)'}}>Oops! Something went wrong</h2>
              <p className="text-red-600 text-lg mb-6 animate-pulse transform-gpu" style={{animationDelay: '0.5s', transform: 'translateZ(6px)'}}>Failed to load data. Please try again.</p>
              <button 
                onClick={() => window.location.reload()} 
                className="px-6 py-3 bg-gradient-to-r from-red-500 to-pink-500 text-white rounded-xl font-semibold hover:from-red-600 hover:to-pink-600 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105 animate-pulse transform-gpu"
                style={{animationDelay: '1s', transform: 'translateZ(12px)'}}
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

  return (
    <Layout chatbotId={company?.chatbot_id}>
      <div className="min-h-screen bg-gray-900 relative overflow-hidden">
        {/* Dark Background Pattern */}
        <div className="absolute inset-0 bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900"></div>
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:20px_20px]"></div>

        <div className="relative max-w-7xl mx-auto p-6 space-y-8 font-['Lato',sans-serif]">
          {/* Dark Header Section */}
          <div className="bg-gray-800 rounded-2xl p-6 shadow-2xl border border-gray-700">
            <div className="flex flex-col lg:flex-row items-center justify-between gap-6">
              {/* Left Side - Title and Breadcrumbs */}
              <div className="flex-1">
                <h1 className="text-3xl font-bold text-white mb-2">Dashboard</h1>
                <div className="text-sm text-gray-400">
                  <span className="text-gray-500">HOME</span> <span className="mx-2">&gt;</span> <span className="text-gray-300">DASHBOARD</span>
                </div>
              </div>

              {/* Middle - Company Selector */}
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-3 bg-gray-700 rounded-xl px-4 py-3 border border-gray-600">
                  <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-sm">
                    {company?.name?.charAt(0) || 'C'}
                  </div>
                  <div>
                    <div className="text-white font-semibold">{company?.name || 'Company Name'}</div>
                    <div className="text-xs text-gray-400">Select company</div>
                  </div>
                  <ChevronDown className="w-4 h-4 text-gray-400" />
                </div>
              </div>

              {/* Right Side - Key Metrics and Actions */}
              <div className="flex items-center gap-6">
                {/* Earnings Card */}
                <div className="bg-gray-700 rounded-xl p-4 border border-gray-600">
                  <div className="text-2xl font-bold text-green-400">${((usage?.total_messages || 0) * 0.5).toFixed(1)}k</div>
                  <div className="text-sm text-gray-400">Earnings</div>
                  <div className="flex items-center gap-1 mt-1">
                    <TrendingUp className="w-3 h-3 text-green-400" />
                    <span className="text-xs text-green-400">+12.5%</span>
                  </div>
                </div>

                {/* Sales Card */}
                <div className="bg-gray-700 rounded-xl p-4 border border-gray-600">
                  <div className="text-2xl font-bold text-blue-400">{usage?.unique_users || 0}</div>
                  <div className="text-sm text-gray-400">Sales</div>
                  <div className="flex items-center gap-1 mt-1">
                    <TrendingUp className="w-3 h-3 text-green-400" />
                    <span className="text-xs text-green-400">+8.2%</span>
                  </div>
        </div>

                {/* New Report Button */}
                <button className="bg-cyan-500 hover:bg-cyan-600 text-white px-6 py-3 rounded-xl font-semibold transition-colors duration-200 flex items-center gap-2">
                  <BarChart3 className="w-4 h-4" />
                  NEW REPORT
                </button>

                {/* Settings Icon */}
                <button className="p-3 bg-gray-700 hover:bg-gray-600 rounded-xl border border-gray-600 transition-colors duration-200">
                  <Settings className="w-5 h-5 text-gray-300" />
                </button>
              </div>
            </div>
          </div>

          {/* KPI Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Visits Card */}
            <div className="bg-gray-800 rounded-2xl p-6 border border-gray-700 hover:border-cyan-500/50 transition-colors duration-300">
              <div className="flex items-center justify-between mb-4">
                <div className="text-3xl font-bold text-white">{(usage?.total_messages || 0) * 0.8}</div>
                <BarChart3 className="w-8 h-8 text-cyan-400" />
              </div>
              <div className="text-gray-400 mb-2">Visits</div>
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-green-400" />
                <span className="text-green-400 font-semibold">31.5%</span>
                <span className="text-gray-500 text-sm">vs last month</span>
              </div>
            </div>

            {/* Purchases Card */}
            <div className="bg-gray-800 rounded-2xl p-6 border border-gray-700 hover:border-cyan-500/50 transition-colors duration-300">
              <div className="flex items-center justify-between mb-4">
                <div className="text-3xl font-bold text-white">${((usage?.total_messages || 0) * 0.3).toFixed(1)}k</div>
                <Briefcase className="w-8 h-8 text-cyan-400" />
              </div>
              <div className="text-gray-400 mb-2">Purchases</div>
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-green-400" />
                <span className="text-green-400 font-semibold">51.5%</span>
                <span className="text-gray-500 text-sm">vs last month</span>
              </div>
            </div>

            {/* Customers Card */}
            <div className="bg-gray-800 rounded-2xl p-6 border border-gray-700 hover:border-cyan-500/50 transition-colors duration-300">
              <div className="flex items-center justify-between mb-4">
                <div className="text-3xl font-bold text-white">{usage?.unique_users || 0}</div>
                <Users className="w-8 h-8 text-cyan-400" />
              </div>
              <div className="text-gray-400 mb-2">Customers</div>
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-green-400" />
                <span className="text-green-400 font-semibold">20%</span>
                <span className="text-gray-500 text-sm">vs last month</span>
              </div>
            </div>

            {/* Total Sales Card with Breakdown */}
            <div className="bg-gray-800 rounded-2xl p-6 border border-gray-700 hover:border-cyan-500/50 transition-colors duration-300">
              <div className="flex items-center justify-between mb-4">
                <div className="text-3xl font-bold text-white">${((usage?.total_messages || 0) * 0.15).toFixed(2)}</div>
                <div className="flex items-center gap-2">
                  <MoreHorizontal className="w-5 h-5 text-gray-400" />
                </div>
              </div>
              <div className="text-gray-400 mb-4">Total sales</div>
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp className="w-4 h-4 text-green-400" />
                <span className="text-green-400 font-semibold">2.6%</span>
                <span className="text-gray-500 text-sm">vs last month</span>
              </div>
              
              {/* Breakdown */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-400">Online Store</span>
                  <div className="flex items-center gap-2">
                    <span className="text-white font-semibold">${((usage?.total_messages || 0) * 0.1).toFixed(2)}</span>
                    <TrendingUp className="w-3 h-3 text-green-400" />
                    <span className="text-xs text-green-400">3.2%</span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-400">Facebook</span>
                  <div className="flex items-center gap-2">
                    <span className="text-white font-semibold">${((usage?.total_messages || 0) * 0.05).toFixed(2)}</span>
                    <TrendingDown className="w-3 h-3 text-red-400" />
                    <span className="text-xs text-red-400">7.0%</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Total Visitors Card with Chart */}
            <div className="bg-gray-800 rounded-2xl p-6 border border-gray-700 hover:border-cyan-500/50 transition-colors duration-300">
              <div className="flex items-center justify-between mb-4">
                <div className="text-3xl font-bold text-white">{Math.floor((usage?.unique_users || 0) * 1.2)}</div>
                <div className="flex items-center gap-2">
                  <MoreHorizontal className="w-5 h-5 text-gray-400" />
                </div>
              </div>
              <div className="text-gray-400 mb-4">Total visitors</div>
              <div className="flex items-center gap-2 mb-4">
                <TrendingDown className="w-4 h-4 text-red-400" />
                <span className="text-red-400 font-semibold">9.6%</span>
                <span className="text-gray-500 text-sm">vs last month</span>
              </div>
              
              {/* Mini Chart */}
              <div className="mt-4">
                <div className="text-xs text-gray-400 mb-2">VISITORS OVER TIME</div>
                <div className="flex items-end gap-1 h-16">
                  {[20, 35, 25, 40, 30, 45, 38].map((height, i) => (
                    <div
                      key={i}
                      className="bg-cyan-400 rounded-t flex-1"
                      style={{ height: `${height}%` }}
                    ></div>
                  ))}
                </div>
                <div className="text-xs text-gray-500 mt-1">0 - 20k</div>
              </div>
            </div>

            {/* Repeat Customer Card with Chart */}
            <div className="bg-gray-800 rounded-2xl p-6 border border-gray-700 hover:border-cyan-500/50 transition-colors duration-300">
              <div className="flex items-center justify-between mb-4">
                <div className="text-3xl font-bold text-white">5.43%</div>
                <div className="flex items-center gap-2">
                  <MoreHorizontal className="w-5 h-5 text-gray-400" />
                </div>
              </div>
              <div className="text-gray-400 mb-4">Repeat customer</div>
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp className="w-4 h-4 text-green-400" />
                <span className="text-green-400 font-semibold">2.6%</span>
                <span className="text-gray-500 text-sm">vs last month</span>
          </div>
          
              {/* Mini Line Chart */}
              <div className="mt-4">
                <div className="text-xs text-gray-400 mb-2">CUSTOMERS</div>
                <div className="h-16 relative">
                  <svg className="w-full h-full" viewBox="0 0 200 60">
                    <path
                      d="M10,50 Q50,20 100,30 T190,25"
                      stroke="#3B82F6"
                      strokeWidth="2"
                      fill="none"
                    />
                    <path
                      d="M10,45 Q50,15 100,25 T190,20"
                      stroke="#00BCD4"
                      strokeWidth="2"
                      fill="none"
                    />
                  </svg>
                </div>
                <div className="text-xs text-gray-500 mt-1">0 - 10</div>
              </div>
            </div>
          </div>

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
    </Layout>
  );
};

export default UserDashboard;