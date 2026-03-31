import { useEffect, useState } from "react";
import {
  FileDown,
  Download,
  CheckCircle,
  AlertCircle,
  Clock,
  FileText
} from "lucide-react";
import api from "../services/api";
import { toast } from "react-toastify";
import Layout from "../components/Layout";

export default function DownloadReportPage() {
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadHistory, setDownloadHistory] = useState([]);
  const [companyName, setCompanyName] = useState("");
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
    fetchCompanyName();
    loadDownloadHistory();
  }, []);

  const fetchCompanyName = async () => {
    try {
      const res = await api.get("/user/company", {
        headers: { Authorization: `Bearer ${token}` },
      });
      setCompanyName(res.data.name || "");
    } catch (err) {
      console.error("Failed to fetch company name:", err);
    }
  };

  const loadDownloadHistory = () => {
    const history = JSON.parse(localStorage.getItem('reportDownloadHistory') || '[]');
    setDownloadHistory(history);
  };

  const saveDownloadHistory = (filename) => {
    const newEntry = {
      id: Date.now(),
      filename,
      timestamp: new Date().toISOString(),
      status: 'success'
    };
    
    const history = JSON.parse(localStorage.getItem('reportDownloadHistory') || '[]');
    history.unshift(newEntry);
    
    // Keep only last 10 downloads
    if (history.length > 10) {
      history.splice(10);
    }
    
    localStorage.setItem('reportDownloadHistory', JSON.stringify(history));
    setDownloadHistory(history);
  };

  const handleDownload = async () => {
    try {
      setIsDownloading(true);
      
      // Use the user-specific download endpoint (no admin required)
      const res = await api.get("/user/report/download", {
        headers: { Authorization: `Bearer ${token}` },
        responseType: "blob",
      });

      const blob = new Blob([res.data], { type: "application/pdf" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      const filename = `agent_report_${Date.now()}.pdf`;
      link.setAttribute("download", filename);
      document.body.appendChild(link);
      link.click();
      link.remove();

      saveDownloadHistory(filename);
      toast.success("Report downloaded successfully!");
    } catch (err) {
      console.error("Download error:", err);
      if (err.response?.status === 404) {
        toast.error("No chatbot found for this user");
      } else if (err.response?.status === 500) {
        toast.error("Failed to generate report. Please try again.");
      } else {
        toast.error("Failed to download report");
      }
    } finally {
      setIsDownloading(false);
    }
  };

  const clearDownloadHistory = () => {
    localStorage.removeItem('reportDownloadHistory');
    setDownloadHistory([]);
    toast.success("Report download history cleared!");
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
              <FileDown className="w-6 h-6" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-3xl font-bold text-gray-800 mb-2">
                Download Report
              </h2>
            </div>
          </div>
          <p className="text-gray-500 text-base leading-relaxed mb-4">
            Generate and download comprehensive PDF reports of your chatbot analytics, user interactions, and performance metrics.
          </p>
        </div>

        {/* Download Options and History - Side by Side */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Report Download */}
          <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm hover:shadow-md transition-all duration-300">
            <div className="flex items-center gap-4 mb-4">
              <div className="bg-gradient-to-r from-[#3a2d9c] to-[#017977] text-white p-3 rounded-2xl shadow-lg">
                <FileDown className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-800">Analytics Report</h3>
                <p className="text-sm text-gray-600">Download comprehensive PDF report</p>
              </div>
            </div>
            <p className="text-sm text-gray-500 mb-4">
              Generate a detailed PDF report containing your chatbot analytics, user interactions, performance metrics, and comprehensive data insights.
            </p>
            <button
              onClick={handleDownload}
              disabled={isDownloading}
              className="w-full px-6 py-3 bg-gradient-to-r from-[#3a2d9c] to-[#017977] text-white font-medium rounded-xl hover:from-[#2a1d7c] hover:to-[#015a58] focus:outline-none transition-all duration-300 shadow-md hover:shadow-lg disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isDownloading ? (
                <>
                  <Clock className="w-5 h-5 animate-spin" />
                  Generating Report...
                </>
              ) : (
                <>
                  <Download className="w-5 h-5" />
                  Download Report
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
                  <p className="text-sm text-gray-600">Recent report downloads</p>
                </div>
              </div>
              {downloadHistory.length > 0 && (
                <button
                  onClick={clearDownloadHistory}
                  className="px-4 py-2 text-sm text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-all duration-200"
                >
                  Clear History
                </button>
              )}
            </div>

            {downloadHistory.length === 0 ? (
              <div className="text-center py-8">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <FileText className="w-8 h-8 text-gray-400" />
                </div>
                <h4 className="text-lg font-semibold text-gray-600 mb-2">No Reports Downloaded Yet</h4>
                <p className="text-sm text-gray-500">Your report download history will appear here after you generate reports.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {downloadHistory.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-all duration-200"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gradient-to-r from-[#3a2d9c] to-[#017977] rounded-lg flex items-center justify-center">
                        <FileText className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <h4 className="font-medium text-gray-800">{item.filename}</h4>
                        <p className="text-sm text-gray-600">Report • {formatDate(item.timestamp)}</p>
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

            {downloadHistory.length > 0 && (
              <div className="mt-6 p-4 bg-blue-50 rounded-xl border border-blue-200">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-blue-600" />
                  <span className="text-sm text-blue-800">
                    Last download: {formatDate(downloadHistory[0]?.timestamp)}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Report Information */}
        <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center gap-4 mb-6">
            <div className="bg-gradient-to-r from-[#3a2d9c] to-[#017977] text-white p-3 rounded-2xl shadow-lg">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-gray-800">Report Details</h3>
              <p className="text-sm text-gray-600">What's included in your analytics report</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <h4 className="font-semibold text-gray-800 mb-3">Analytics Data</h4>
              <ul className="space-y-2 text-sm text-gray-600">
                <li className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-[#3a2d9c] rounded-full"></div>
                  User engagement metrics
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-[#3a2d9c] rounded-full"></div>
                  Message volume statistics
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-[#3a2d9c] rounded-full"></div>
                  Performance analytics
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-[#3a2d9c] rounded-full"></div>
                  Usage trends and patterns
                </li>
              </ul>
            </div>

            <div className="space-y-4">
              <h4 className="font-semibold text-gray-800 mb-3">Report Features</h4>
              <ul className="space-y-2 text-sm text-gray-600">
                <li className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-[#017977] rounded-full"></div>
                  Professional PDF format
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-[#017977] rounded-full"></div>
                  Detailed charts and graphs
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-[#017977] rounded-full"></div>
                  Export-ready for presentations
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-[#017977] rounded-full"></div>
                  Timestamped for record keeping
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
