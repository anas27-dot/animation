import { useEffect, useState } from "react";
import api from "../services/api";
import { Clock, User, FileText, TrendingUp } from "lucide-react";

const CreditHistory = ({ companyId }) => {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchHistory = async () => {
    try {
      const token = localStorage.getItem("adminToken");
      const res = await api.get(`/company/${companyId}/credits/history`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      setHistory(res.data.data?.history || []);
    } catch (err) {
      console.error("Failed to fetch credit history:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (companyId) {
      fetchHistory();
    }
  }, [companyId]);

  if (loading)
    return <p className="text-gray-500 italic">Loading credit history...</p>;

  if (!history.length)
    return (
      <div className="text-center py-8">
        <FileText className="w-12 h-12 text-gray-400 mx-auto mb-3" />
        <p className="text-gray-500 italic">No credit history found.</p>
      </div>
    );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex justify-between items-center">
        <p className="text-sm text-gray-600">
          Showing {history.length} credit reset{history.length !== 1 && "s"}
        </p>
      </div>

      {/* History List */}
      <div className="border border-gray-200 rounded-lg overflow-y-auto max-h-[60vh] divide-y divide-gray-200 bg-white shadow-sm">
        {history.map((entry, index) => {
          const date = new Date(entry.created_at);
          const adminName = entry.admin_id?.name || entry.admin_email || "Unknown Admin";
          
          return (
            <div key={entry._id || index} className="p-4 hover:bg-gray-50 transition-colors">
              {/* Header Row */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="bg-blue-100 p-2 rounded-lg">
                    <TrendingUp className="w-4 h-4 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-800">
                      Credit Reset
                    </p>
                    <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                      <Clock className="w-3 h-3" />
                      {date.toLocaleString()}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-500 flex items-center gap-1 justify-end">
                    <User className="w-3 h-3" />
                    {adminName}
                  </p>
                  {entry.reason && (
                    <p className="text-xs text-gray-400 mt-1 italic">
                      "{entry.reason}"
                    </p>
                  )}
                </div>
              </div>

              {/* Previous State */}
              <div className="bg-gray-50 rounded-lg p-3 mb-2">
                <p className="text-xs font-medium text-gray-600 mb-2">Previous State:</p>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <p className="text-gray-500">Total</p>
                    <p className="font-semibold text-gray-700">
                      {entry.previous_total_credits.toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-500">Used</p>
                    <p className="font-semibold text-orange-600">
                      {entry.previous_used_credits.toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-500">Remaining</p>
                    <p className="font-semibold text-green-600">
                      {entry.previous_remaining_credits.toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>

              {/* New State */}
              <div className="bg-blue-50 rounded-lg p-3 border-l-4 border-blue-500">
                <p className="text-xs font-medium text-blue-700 mb-2">New State (After Reset):</p>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <p className="text-blue-600">Total</p>
                    <p className="font-bold text-blue-700">
                      {entry.new_total_credits.toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-blue-600">Used</p>
                    <p className="font-bold text-blue-700">
                      {entry.new_used_credits.toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-blue-600">Remaining</p>
                    <p className="font-bold text-blue-700">
                      {entry.new_remaining_credits.toLocaleString()}
                    </p>
                  </div>
                </div>
                <div className="mt-2 pt-2 border-t border-blue-200">
                  <p className="text-xs text-blue-700">
                    <span className="font-semibold">Credits Added:</span>{" "}
                    <span className="text-blue-800 font-bold">
                      +{entry.credits_added.toLocaleString()}
                    </span>
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default CreditHistory;

