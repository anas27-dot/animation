import { useEffect, useState } from "react";
import {
  Download,
  Users,
  Mail,
  Database,
  CheckCircle,
  AlertCircle,
  Clock
} from "lucide-react";
import api from "../services/api";
import { toast } from "react-toastify";
import Layout from "../components/Layout";
import { saveAs } from "file-saver";

export default function DownloadDataPage() {
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadHistory, setDownloadHistory] = useState([]);
  const [stats, setStats] = useState({
    totalEmails: 0,
    totalPhones: 0,
    totalSessions: 0,
    lastDownload: null
  });
  const token = localStorage.getItem("token");

  // Load Exo 2 font
  useEffect(() => {
    const link = document.createElement('link');
    link.href = 'https://fonts.googleapis.com/css2?family=Exo+2:wght@300;400;500;600;700;800;900&display=swap';
    link.rel = 'stylesheet';
    document.head.appendChild(link);
    
    return () => {
      if (document.head.contains(link)) {
        document.head.removeChild(link);
      }
    };
  }, []);

  useEffect(() => {
    fetchStats();
    loadDownloadHistory();
  }, []);

  const fetchStats = async () => {
    try {
      const [emailsRes, phonesRes, sessionsRes] = await Promise.all([
        api.get("/user/messages/unique-emails-and-phones", {
          headers: { Authorization: `Bearer ${token}` },
        }),
        api.get("/user/messages/unique-emails-and-phones", {
          headers: { Authorization: `Bearer ${token}` },
        }),
        api.get("/user/messages/unique-sessions", {
          headers: { Authorization: `Bearer ${token}` },
        })
      ]);

      setStats({
        totalEmails: emailsRes.data.emails?.length || 0,
        totalPhones: phonesRes.data.phoneNumbers?.length || 0,
        totalSessions: sessionsRes.data.sessions?.length || 0,
        lastDownload: localStorage.getItem('lastDownloadTime') || null
      });
    } catch (err) {
      console.error("Failed to fetch stats", err);
    }
  };

  const loadDownloadHistory = () => {
    const history = JSON.parse(localStorage.getItem('downloadHistory') || '[]');
    setDownloadHistory(history);
  };

  const saveDownloadHistory = (type, filename) => {
    const newEntry = {
      id: Date.now(),
      type,
      filename,
      timestamp: new Date().toISOString(),
      status: 'success'
    };
    
    const history = JSON.parse(localStorage.getItem('downloadHistory') || '[]');
    history.unshift(newEntry);
    
    // Keep only last 10 downloads
    if (history.length > 10) {
      history.splice(10);
    }
    
    localStorage.setItem('downloadHistory', JSON.stringify(history));
    localStorage.setItem('lastDownloadTime', new Date().toISOString());
    setDownloadHistory(history);
    setStats(prev => ({ ...prev, lastDownload: new Date().toISOString() }));
  };

  const downloadEmailsAndPhoneNumbersCSV = async () => {
    try {
      setIsDownloading(true);
      const response = await api.get(
        "/user/messages/download-emails-and-phone-numbers",
        {
          responseType: "blob",
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      const blob = new Blob([response.data], { type: "text/csv" });
      const filename = `emails_and_phone_numbers_${new Date().toISOString().split('T')[0]}.csv`;
      saveAs(blob, filename);
      
      saveDownloadHistory('Users Data', filename);
      toast.success("Users data downloaded successfully!");
    } catch (err) {
      toast.error("Failed to download users data");
      console.error(err);
    } finally {
      setIsDownloading(false);
    }
  };


  const downloadSessionsCSV = async () => {
    try {
      setIsDownloading(true);
      const response = await api.get(
        "/user/messages/download-sessions-csv",
        {
          responseType: "blob",
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      const blob = new Blob([response.data], { type: "text/csv" });
      const filename = `sessions_${new Date().toISOString().split('T')[0]}.csv`;
      saveAs(blob, filename);
      
      saveDownloadHistory('Sessions', filename);
      toast.success("Sessions data downloaded successfully!");
    } catch (err) {
      toast.error("Failed to download sessions data");
      console.error(err);
    } finally {
      setIsDownloading(false);
    }
  };

  const clearDownloadHistory = () => {
    const history = JSON.parse(localStorage.getItem('downloadHistory') || '[]');
    const filteredHistory = history.filter(item => item.type !== 'Users Data');
    localStorage.setItem('downloadHistory', JSON.stringify(filteredHistory));
    setDownloadHistory(filteredHistory);
    toast.success("Users Data download history cleared!");
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString();
  };

  return (
    <Layout>
      <div className="p-3 sm:p-4 md:p-6 bg-white min-h-screen font-['Exo_2',sans-serif]">
        {/* Enhanced Header */}
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-5">
            <div className="bg-gradient-to-r from-[#3a2d9c] to-[#017977] text-white p-3 rounded-2xl shadow-lg">
              <Download className="w-6 h-6" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-3xl font-bold text-gray-800 mb-2">
                Download Data
              </h2>
            </div>
          </div>
          <p className="text-gray-500 text-base leading-relaxed mb-4">
            Export your chatbot data in various formats. Download user information, message history, and session data for analysis and backup purposes.
          </p>
        </div>

        {/* Stats Cards */}
        <div className={`grid gap-6 mb-8 ${
          (stats.totalEmails > 0 && stats.totalPhones > 0) 
            ? 'grid-cols-1 md:grid-cols-3' 
            : (stats.totalEmails > 0 || stats.totalPhones > 0) 
            ? 'grid-cols-1 md:grid-cols-2' 
            : 'grid-cols-1'
        }`}>
          {stats.totalEmails > 0 && (
            <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm hover:shadow-md transition-all duration-300">
              <div className="flex items-center gap-4">
                <div className="bg-gradient-to-r from-[#3a2d9c] to-[#017977] text-white p-3 rounded-2xl shadow-lg">
                  <Mail className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-gray-800">{stats.totalEmails}</h3>
                  <p className="text-sm text-gray-600">Email Addresses</p>
                </div>
              </div>
            </div>
          )}

          {stats.totalPhones > 0 && (
            <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm hover:shadow-md transition-all duration-300">
              <div className="flex items-center gap-4">
                <div className="bg-gradient-to-r from-[#3a2d9c] to-[#017977] text-white p-3 rounded-2xl shadow-lg">
                  <Users className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-gray-800">{stats.totalPhones}</h3>
                  <p className="text-sm text-gray-600">Phone Numbers</p>
                </div>
              </div>
            </div>
          )}

          <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm hover:shadow-md transition-all duration-300">
            <div className="flex items-center gap-4">
              <div className="bg-gradient-to-r from-[#3a2d9c] to-[#017977] text-white p-3 rounded-2xl shadow-lg">
                <Database className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-2xl font-bold text-gray-800">{stats.totalSessions}</h3>
                <p className="text-sm text-gray-600">Guest Sessions</p>
              </div>
            </div>
          </div>
        </div>

        {/* Download Options and History - Side by Side */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Users Data Download */}
          <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm hover:shadow-md transition-all duration-300">
            <div className="flex items-center gap-4 mb-4">
              <div className="bg-gradient-to-r from-[#3a2d9c] to-[#017977] text-white p-3 rounded-2xl shadow-lg">
                <Users className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-800">Users Data</h3>
                <p className="text-sm text-gray-600">Download email addresses and phone numbers</p>
              </div>
            </div>
            <p className="text-sm text-gray-500 mb-4">
              Export all unique email addresses and phone numbers from your chatbot interactions in CSV format.
            </p>
            <button
              onClick={downloadEmailsAndPhoneNumbersCSV}
              disabled={isDownloading}
              className="w-full px-6 py-3 bg-gradient-to-r from-[#3a2d9c] to-[#017977] text-white font-medium rounded-xl hover:from-[#2a1d7c] hover:to-[#015a58] focus:outline-none transition-all duration-300 shadow-md hover:shadow-lg disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isDownloading ? (
                <>
                  <Clock className="w-5 h-5 animate-spin" />
                  Downloading...
                </>
              ) : (
                <>
                  <Download className="w-5 h-5" />
                  Download Users Data
                </>
              )}
            </button>
          </div>

          {/* Download History */}
          <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-4">
                <div className="bg-gradient-to-r from-[#3a2d9c] to-[#017977] text-white p-3 rounded-2xl shadow-lg">
                  <Clock className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-800">Download History</h3>
                  <p className="text-sm text-gray-600">Recent downloads and export history</p>
                </div>
              </div>
              {downloadHistory.filter(item => item.type === 'Users Data').length > 0 && (
                <button
                  onClick={clearDownloadHistory}
                  className="px-4 py-2 text-sm text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-all duration-200"
                >
                  Clear History
                </button>
              )}
            </div>

            {downloadHistory.filter(item => item.type === 'Users Data').length === 0 ? (
              <div className="text-center py-8">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Download className="w-8 h-8 text-gray-400" />
                </div>
                <h4 className="text-lg font-semibold text-gray-600 mb-2">No Downloads Yet</h4>
                <p className="text-sm text-gray-500">Your download history will appear here after you export data.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {downloadHistory
                  .filter(item => item.type === 'Users Data')
                  .map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-all duration-200"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-r from-[#3a2d9c] to-[#017977] rounded-lg flex items-center justify-center">
                          <Download className="w-5 h-5 text-white" />
                        </div>
                        <div>
                          <h4 className="font-medium text-gray-800">{item.filename}</h4>
                          <p className="text-sm text-gray-600">{item.type} • {formatDate(item.timestamp)}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle className="w-5 h-5 text-green-500" />
                        <span className="text-sm text-green-600 font-medium">Completed</span>
                      </div>
                    </div>
                  ))}
              </div>
            )}

            {stats.lastDownload && (
              <div className="mt-6 p-4 bg-blue-50 rounded-xl border border-blue-200">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-blue-600" />
                  <span className="text-sm text-blue-800">
                    Last download: {formatDate(stats.lastDownload)}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
