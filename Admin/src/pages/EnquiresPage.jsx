import React, { useEffect, useMemo, useState } from "react";
import Layout from "../components/Layout";
import { User2, Mail, Phone, MessageSquare } from "lucide-react";
import api from "../services/api";
import { toast } from "react-toastify";
import { useAuth } from "../context/AuthContext";

// Skeleton Loader Components
const EnquirySkeleton = () => (
  <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm animate-pulse">
    <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-2">
      <div className="flex items-center gap-2 mb-2 sm:mb-0">
        <div className="w-4 h-4 bg-gray-200 rounded"></div>
        <div className="h-4 bg-gray-200 rounded w-24"></div>
        <div className="h-4 bg-gray-200 rounded w-16"></div>
      </div>
      <div className="h-4 bg-gray-200 rounded w-20"></div>
    </div>
    <div className="space-y-2 mb-4">
      <div className="h-4 bg-gray-200 rounded w-full"></div>
      <div className="h-4 bg-gray-200 rounded w-3/4"></div>
    </div>
    <div className="flex items-center gap-4 text-sm text-gray-500">
      <div className="flex items-center gap-1">
        <div className="w-4 h-4 bg-gray-200 rounded"></div>
        <div className="h-3 bg-gray-200 rounded w-20"></div>
      </div>
      <div className="flex items-center gap-1">
        <div className="w-4 h-4 bg-gray-200 rounded"></div>
        <div className="h-3 bg-gray-200 rounded w-16"></div>
      </div>
    </div>
  </div>
);

export default function EnquiriesPage() {
  const { user: ctxUser } = useAuth();
  const [queries, setQueries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all"); // all | read | unread

  const resolveUserId = () => {
    // 1) From AuthContext
    const ctxId = ctxUser?.id || ctxUser?._id;
    if (ctxId) return ctxId;

    // 2) Fallback: from localStorage (same shape as your AuthProvider)
    try {
      const raw = localStorage.getItem("user");
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return parsed?.id || parsed?._id || null;
    } catch {
      return null;
    }
  };

  useEffect(() => {
    let cancelled = false;

    const fetchQueries = async () => {
      const userId = resolveUserId();
      if (!userId) {
        toast.error("No user found. Please log in again.");
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const res = await api.get("/enquiry", { params: { userId } });
        if (!cancelled) setQueries(Array.isArray(res.data) ? res.data : []);
      } catch (err) {
        const msg =
          err?.response?.data?.error ||
          err?.response?.data?.message ||
          "Failed to fetch enquiries.";
        toast.error(msg);
        if (!cancelled) setQueries([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchQueries();
    return () => {
      cancelled = true;
    };
  }, [ctxUser]); // refetch if context user changes

  const markAsRead = async (id) => {
    try {
      await api.put(`/enquiry/${id}/read`);
      setQueries((prev) =>
        prev.map((q) => (q._id === id ? { ...q, read: true } : q))
      );
    } catch {
      toast.error("Failed to mark as read.");
    }
  };

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    return queries.filter((q) => {
      const matchesSearch =
        !s ||
        q?.name?.toLowerCase?.().includes(s) ||
        q?.email?.toLowerCase?.().includes(s) ||
        q?.question?.toLowerCase?.().includes(s);
      const matchesFilter =
        filter === "all" ? true : filter === "read" ? q?.read : !q?.read;
      return matchesSearch && matchesFilter;
    });
  }, [queries, search, filter]);

  const total = queries.length;
  const read = queries.filter((q) => q?.read).length;
  const unread = total - read;

  return (
    <Layout>
      <div className="ml-64 px-6 py-8 min-h-screen bg-[#f7f8fc] text-gray-800 font-[Inter,sans-serif]">
        {/* Search + Filter */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-6 bg-white p-4 rounded-lg shadow-sm">
          <input
            type="text"
            placeholder="Search enquiries..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full md:w-2/3 px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <select
            className="border px-3 py-2 rounded-md border-gray-300 text-sm"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="all">All Enquiries</option>
            <option value="unread">Unread</option>
            <option value="read">Read</option>
          </select>
        </div>

        {/* Stats Summary */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-6">
          <div className="bg-white rounded-lg shadow text-center py-4">
            <p className="text-3xl font-bold text-blue-600">{total}</p>
            <p className="text-gray-500 text-sm">Total Enquiries</p>
          </div>
          <div className="bg-white rounded-lg shadow text-center py-4">
            <p className="text-3xl font-bold text-orange-500">{unread}</p>
            <p className="text-gray-500 text-sm">Unread</p>
          </div>
          <div className="bg-white rounded-lg shadow text-center py-4">
            <p className="text-3xl font-bold text-green-600">{read}</p>
            <p className="text-gray-500 text-sm">Read</p>
          </div>
        </div>

        {/* Enquiries List */}
        {loading ? (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <EnquirySkeleton key={i} />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-gray-600">No enquiries found.</p>
        ) : (
          <div className="space-y-4">
            {filtered.map((q) => (
              <div
                key={q?._id}
                className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-2">
                  <div className="flex items-center gap-2 text-blue-600 font-semibold">
                    <User2 size={16} />
                    {q?.name || "Anonymous"}
                    {q?.tags?.map?.((tag, i) => (
                      <span
                        key={`${q?._id}-tag-${i}`}
                        className="ml-2 text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                  {!q?.read && (
                    <button
                      onClick={() => markAsRead(q?._id)}
                      className="flex items-center gap-1 border border-blue-500 text-blue-500 px-3 py-1 rounded text-sm hover:bg-blue-50"
                    >
                      <MessageSquare size={14} />
                      Mark as Read
                    </button>
                  )}
                </div>
                <div className="flex items-center text-sm text-gray-500 gap-2 mb-2">
                  <Mail size={14} />
                  {q?.email || "No email provided"}
                </div>
                {/* Phone */}{" "}
                <div className="flex items-center text-sm text-gray-500 gap-2 mb-2">
                  <Phone size={14} /> {q?.phone || "No phone provided"}{" "}
                </div>
                <p className="text-sm text-gray-700">{q?.question}</p>
                <p className="text-xs text-gray-400 mt-2">
                  {q?.createdAt ? new Date(q.createdAt).toLocaleString() : ""}
                </p>
              </div>
            ))}
          </div>
        )}

        {/* Pagination (static placeholder) */}
        <div className="flex items-center justify-between mt-8 text-sm text-gray-600">
          <span>
            Showing 1 to {filtered.length} of {filtered.length} enquiries
          </span>
          <div className="space-x-2">
            <button className="px-3 py-1 rounded border bg-white hover:bg-gray-100">
              &lt; Previous
            </button>
            <span>Page 1 of 1</span>
            <button className="px-3 py-1 rounded border bg-white hover:bg-gray-100">
              Next &gt;
            </button>
          </div>
        </div>
      </div>
    </Layout>
  );
}
