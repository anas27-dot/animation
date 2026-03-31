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
} from "lucide-react";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
dayjs.extend(relativeTime);

// --- Enhanced 3D Skeleton Loader Components ---
const CardSkeleton = () => (
  <div className="bg-white/90 backdrop-blur-sm rounded-2xl p-6 shadow-xl border border-gray-200/50 animate-pulse relative overflow-hidden group transform-gpu" style={{transformStyle: 'preserve-3d'}}>
    {/* 3D Shimmer Effect */}
    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 transform-gpu" style={{transform: 'translateZ(5px)'}}></div>
    
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
    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 transform-gpu" style={{transform: 'translateZ(5px)'}}></div>
    
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
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 transform-gpu" style={{transform: 'translateZ(5px)'}}></div>
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
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 relative overflow-hidden perspective-1000">
        {/* 3D Animated Background Elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {/* 3D Floating Orbs with Depth */}
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-gradient-to-br from-blue-200/40 to-indigo-200/40 rounded-full blur-3xl animate-pulse transform-gpu" style={{transform: 'translateZ(0) rotateX(15deg) rotateY(25deg)'}}></div>
          <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-gradient-to-tr from-purple-200/40 to-pink-200/40 rounded-full blur-3xl animate-pulse transform-gpu" style={{animationDelay: '1s', transform: 'translateZ(0) rotateX(-10deg) rotateY(-20deg)'}}></div>
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-gradient-to-r from-cyan-200/30 to-blue-200/30 rounded-full blur-3xl animate-pulse transform-gpu" style={{animationDelay: '2s', transform: 'translateZ(0) rotateX(5deg) rotateY(10deg)'}}></div>
          
          {/* 3D Floating Elements with Rotation */}
          <div className="absolute top-20 left-1/4 w-32 h-32 bg-gradient-to-br from-emerald-200/20 to-teal-200/20 rounded-full blur-2xl animate-bounce transform-gpu" style={{animationDuration: '3s', transform: 'translateZ(50px) rotateX(20deg) rotateY(30deg)'}}></div>
          <div className="absolute bottom-20 right-1/4 w-40 h-40 bg-gradient-to-br from-rose-200/20 to-pink-200/20 rounded-full blur-2xl animate-bounce transform-gpu" style={{animationDuration: '4s', animationDelay: '1s', transform: 'translateZ(30px) rotateX(-15deg) rotateY(-25deg)'}}></div>
          
          {/* 3D Geometric Shapes */}
          <div className="absolute top-1/3 right-1/3 w-24 h-24 bg-gradient-to-br from-yellow-200/20 to-orange-200/20 rounded-lg blur-xl animate-spin transform-gpu" style={{animationDuration: '8s', transform: 'translateZ(100px) rotateX(45deg) rotateY(45deg)'}}></div>
          <div className="absolute bottom-1/3 left-1/3 w-20 h-20 bg-gradient-to-br from-violet-200/20 to-purple-200/20 rounded-lg blur-xl animate-spin transform-gpu" style={{animationDuration: '6s', animationDirection: 'reverse', transform: 'translateZ(80px) rotateX(-30deg) rotateY(60deg)'}}></div>
          
          {/* 3D Grid Pattern with Depth */}
          <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.1)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.1)_1px,transparent_1px)] bg-[size:50px_50px] opacity-30 transform-gpu" style={{transform: 'translateZ(-50px) rotateX(60deg)'}}></div>
          
          {/* Floating Particles */}
          <div className="absolute top-1/4 left-1/2 w-2 h-2 bg-blue-400/60 rounded-full animate-ping transform-gpu" style={{animationDelay: '0.5s', transform: 'translateZ(200px)'}}></div>
          <div className="absolute top-3/4 right-1/4 w-1 h-1 bg-purple-400/60 rounded-full animate-ping transform-gpu" style={{animationDelay: '1.5s', transform: 'translateZ(150px)'}}></div>
          <div className="absolute bottom-1/4 left-1/3 w-1.5 h-1.5 bg-pink-400/60 rounded-full animate-ping transform-gpu" style={{animationDelay: '2.5s', transform: 'translateZ(100px)'}}></div>
        </div>

        <div className="relative max-w-7xl mx-auto p-4 md:p-6 lg:p-10 space-y-8 md:space-y-12 font-['Lato',sans-serif] transform-gpu">
          {/* 3D Enhanced Welcome Card with Advanced Animation */}
          <div className="group transform transition-all duration-1000 hover:scale-[1.02] hover:shadow-2xl hover:-translate-y-2 transform-gpu" style={{transformStyle: 'preserve-3d'}}>
            <div className="relative">
              {/* 3D Glowing Border Effect */}
              <div className="absolute -inset-1 bg-gradient-to-r from-blue-500/20 via-purple-500/20 to-indigo-500/20 rounded-2xl blur opacity-0 group-hover:opacity-100 transition-all duration-1000 transform-gpu" style={{transform: 'translateZ(-10px)'}}></div>
              {/* 3D Shadow Layer */}
              <div className="absolute inset-0 bg-gradient-to-br from-black/5 to-transparent rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-1000 transform-gpu" style={{transform: 'translateZ(-5px) translateY(8px)'}}></div>
              <div className="relative transform-gpu group-hover:rotateX(2deg) group-hover:rotateY(1deg) transition-transform duration-1000" style={{transformStyle: 'preserve-3d'}}>
                <WelcomeCard 
                  userName={company?.name || "User"}
                  performanceData={{
                    salesIncrease: Math.min(100, Math.max(0, Math.round((usage?.total_messages || 0) / 10))),
                    starSellerProgress: Math.min(100, Math.max(0, Math.round((usage?.unique_users || 0) / 2))),
                    totalMessages: usage?.total_messages || 0,
                    uniqueUsers: usage?.unique_users || 0
                  }}
                />
              </div>
            </div>
          </div>

          {/* 3D Enhanced User Details Card with Special Effects */}
          <div className="group transform transition-all duration-1000 hover:scale-[1.01] hover:shadow-2xl hover:-translate-y-1 transform-gpu" style={{transformStyle: 'preserve-3d'}}>
            <div className="relative">
              {/* 3D Animated Border */}
              <div className="absolute -inset-1 bg-gradient-to-r from-emerald-500/20 via-teal-500/20 to-cyan-500/20 rounded-2xl blur opacity-0 group-hover:opacity-100 transition-all duration-1000 transform-gpu" style={{transform: 'translateZ(-10px)'}}></div>
              {/* 3D Shadow Layer */}
              <div className="absolute inset-0 bg-gradient-to-br from-black/5 to-transparent rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-1000 transform-gpu" style={{transform: 'translateZ(-5px) translateY(6px)'}}></div>
              <div className="relative transform-gpu group-hover:rotateX(-1deg) group-hover:rotateY(2deg) transition-transform duration-1000" style={{transformStyle: 'preserve-3d'}}>
                <UserDetailsCard company={company} />
              </div>
            </div>
          </div>
          
          {/* 3D Enhanced Charts Section with Floating Effect */}
          <div className="group transform transition-all duration-1000 hover:scale-[1.01] hover:shadow-2xl hover:-translate-y-1 transform-gpu" style={{transformStyle: 'preserve-3d'}}>
            <div className="relative">
              {/* 3D Rotating Gradient Border */}
              <div className="absolute -inset-1 bg-gradient-to-r from-rose-500/20 via-pink-500/20 to-purple-500/20 rounded-2xl blur opacity-0 group-hover:opacity-100 transition-all duration-1000 transform-gpu" style={{transform: 'translateZ(-10px)'}}></div>
              {/* 3D Shadow Layer */}
              <div className="absolute inset-0 bg-gradient-to-br from-black/5 to-transparent rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-1000 transform-gpu" style={{transform: 'translateZ(-5px) translateY(6px)'}}></div>
              <div className="relative transform-gpu group-hover:rotateX(1deg) group-hover:rotateY(-1deg) transition-transform duration-1000" style={{transformStyle: 'preserve-3d'}}>
                <DynamicCharts 
                  plan={plan}
                  usage={usage}
                  company={company}
                />
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