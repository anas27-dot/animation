import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import {
  Mail,
  Eye,
  Clock,
  User,
  ChevronDown,
  Filter,
  X,
  Download,
  Users,
  Search,
  Calendar,
  AlertCircle,
  RefreshCw,
  Check,
  Brain,
} from "lucide-react";
import api from "../services/api";
import { toast } from "react-toastify";
import { Dialog, Menu } from "@headlessui/react";
import Layout from "../components/Layout";
import { saveAs } from "file-saver";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import dayjs from "dayjs";
import { Popover, Box } from "@mui/material";

const isEmail = (v = "") => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

// Helper function to detect guest users
const isGuestUser = (msg) => {
  return !msg.email && !msg.phone && msg.session_id;
};

// Constants for production-ready configuration
const CONFIG = {
  MAX_CONCURRENT_REQUESTS: 5,
  REQUEST_DELAY_MS: 100,
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY_MS: 1000,
  CACHE_DURATION_MS: 5 * 60 * 1000, // 5 minutes
  DEBOUNCE_DELAY_MS: 300,
};

// Request queue management
class RequestQueue {
  constructor(maxConcurrent = CONFIG.MAX_CONCURRENT_REQUESTS) {
    this.queue = [];
    this.running = 0;
    this.maxConcurrent = maxConcurrent;
  }

  async add(requestFn) {
    return new Promise((resolve, reject) => {
      this.queue.push({ requestFn, resolve, reject });
      this.process();
    });
  }

  async process() {
    if (this.running >= this.maxConcurrent || this.queue.length === 0) {
      return;
    }

    this.running++;
    const { requestFn, resolve, reject } = this.queue.shift();

    try {
      const result = await requestFn();
      resolve(result);
    } catch (error) {
      reject(error);
    } finally {
      this.running--;
      this.process();
    }
  }
}

// Cache implementation
class SimpleCache {
  constructor(duration = CONFIG.CACHE_DURATION_MS) {
    this.cache = new Map();
    this.duration = duration;
  }

  get(key) {
    const item = this.cache.get(key);
    if (!item) return null;

    if (Date.now() - item.timestamp > this.duration) {
      this.cache.delete(key);
      return null;
    }

    return item.data;
  }

  set(key, data) {
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });
  }

  clear() {
    this.cache.clear();
  }
}

// Debounce utility
const debounce = (func, delay) => {
  let timeoutId;
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func.apply(null, args), delay);
  };
};

// Retry utility with exponential backoff
const retryWithBackoff = async (fn, attempts = CONFIG.RETRY_ATTEMPTS) => {
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === attempts - 1) throw error;
      await new Promise(resolve =>
        setTimeout(resolve, CONFIG.RETRY_DELAY_MS * Math.pow(2, i))
      );
    }
  }
};

// --- Skeleton Loader Components ---
const SkeletonRow = () => (
  <tr className="animate-pulse">
    <td className="w-20 md:w-32 lg:w-40 px-2 md:px-4 py-3 md:py-4 text-center">
      <div className="h-3 md:h-4 bg-gray-200 rounded w-16 md:w-20 mx-auto"></div>
      <div className="h-2 md:h-3 bg-gray-200 rounded w-12 md:w-16 mx-auto mt-1"></div>
    </td>
    <td className="w-24 md:w-32 lg:w-40 px-2 md:px-4 py-3 md:py-4 text-center">
      <div className="h-4 md:h-5 bg-gray-200 rounded-full w-12 md:w-16 mx-auto"></div>
      <div className="h-2 md:h-3 bg-gray-200 rounded w-8 md:w-12 mx-auto mt-1"></div>
    </td>
    <td className="px-2 md:px-4 py-3 md:py-4">
      <div className="h-3 md:h-4 bg-gray-200 rounded w-full"></div>
      <div className="h-3 md:h-4 bg-gray-200 rounded w-3/4 mt-1"></div>
    </td>
    <td className="w-20 md:w-32 lg:w-36 px-2 md:px-4 py-3 md:py-4 text-center">
      <div className="h-4 md:h-5 bg-gray-200 rounded-full w-12 md:w-16 mx-auto"></div>
    </td>
    <td className="w-16 md:w-20 lg:w-24 px-2 md:px-4 py-3 md:py-4 text-center">
      <div className="h-4 w-4 md:h-5 md:w-5 bg-gray-200 rounded-full mx-auto"></div>
    </td>
  </tr>
);

const TableSkeleton = ({ rows = 10 }) => (
  <div className="shadow-md rounded-lg table-container bg-white rounded-2xl">
    <table className="w-full text-xs md:text-sm lg:text-base text-left text-gray-700">
      <thead className="bg-gray-50 text-gray-700 uppercase text-xs md:text-sm font-semibold border-b border-gray-200">
        <tr>
          <th scope="col" className="w-20 md:w-32 lg:w-40 px-2 md:px-4 py-3 md:py-4 text-center">
            <div className="flex items-center justify-center gap-1">
              <Clock className="w-3 h-3 md:w-4 md:h-4" /> <span className="hidden sm:inline">Time</span>
            </div>
          </th>
          <th scope="col" className="w-24 md:w-32 lg:w-40 px-2 md:px-4 py-3 md:py-4 text-center">
            <div className="flex items-center justify-center gap-1">
              <User className="w-3 h-3 md:w-4 md:h-4" /> <span className="hidden sm:inline">Sender</span>
            </div>
          </th>
          <th scope="col" className="px-2 md:px-4 py-3 md:py-4">
            <span className="hidden sm:inline">Message</span>
            <span className="sm:hidden">Msg</span>
          </th>
          <th scope="col" className="w-20 md:w-32 lg:w-36 px-2 md:px-4 py-3 md:py-4 text-center">
            <div className="flex items-center justify-center gap-1">
              <Mail className="w-3 h-3 md:w-4 md:h-4" /> <span className="hidden sm:inline">Contact</span>
            </div>
          </th>
          <th scope="col" className="w-16 md:w-20 lg:w-24 px-2 md:px-4 py-3 md:py-4 text-center">
            Action
          </th>
        </tr>
      </thead>
      <tbody className="text-sm md:text-base divide-y divide-gray-700">
        {Array.from({ length: rows }).map((_, index) => (
          <SkeletonRow key={index} />
        ))}
      </tbody>
    </table>
  </div>
);
// --- End Skeleton Components ---

export default function MessageHistoryPage() {
  // Core state
  const [messages, setMessages] = useState([]);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);

  // Filter states
  const [emailFilter, setEmailFilter] = useState("");
  const [phoneFilter, setPhoneFilter] = useState("");
  const [guestFilter, setGuestFilter] = useState(false);
  const [guestUserFilter, setGuestUserFilter] = useState(""); // Renamed from separateSessionFilter
  const [showGuests, setShowGuests] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [customStartDate, setCustomStartDate] = useState(null);
  const [customEndDate, setCustomEndDate] = useState(null);
  const [isDateRange, setIsDateRange] = useState(false);
  const [dateAnchorEl, setDateAnchorEl] = useState(null);

  // Data states
  const [allEmails, setAllEmails] = useState([]);
  const [allPhoneNumbers, setAllPhoneNumbers] = useState([]);
  const [allSessions, setAllSessions] = useState([]);

  // Modal states
  const [selectedChat, setSelectedChat] = useState(null);
  const [selectedSessionId, setSelectedSessionId] = useState(null); // Store session ID for guests
  const [isSelectedChatGuest, setIsSelectedChatGuest] = useState(false); // Track if selected chat is a guest
  const [chatHistory, setChatHistory] = useState([]);
  const [pdfDownloaded, setPdfDownloaded] = useState(false); // Track PDF download success

  // Loading states
  const [loadingMessages, setLoadingMessages] = useState(true);
  const [loadingChat, setLoadingChat] = useState(false);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [loadingEmails, setLoadingEmails] = useState(false);

  // Error states
  const [error, setError] = useState(null);
  const [sessionError, setSessionError] = useState(null);

  // Refs for cleanup and optimization
  const abortControllerRef = useRef(null);
  const requestQueueRef = useRef(new RequestQueue());
  const cacheRef = useRef(new SimpleCache());
  const debouncedFetchRef = useRef(null);

  const token = localStorage.getItem("token");

  // Helper function to get guest number from session ID
  const getGuestNumber = useCallback((sessionId) => {
    if (!sessionId) return null;
    const session = allSessions.find(s => s.id === sessionId && s.is_guest);
    return session ? session.guest_number : null;
  }, [allSessions]);

  // Helper function to get guest display name
  const getGuestDisplayName = useCallback((msg) => {
    if (!isGuestUser(msg)) return null;
    const guestNumber = getGuestNumber(msg.session_id);
    if (!guestNumber) {
      console.log("⚠️ No guest number found for session:", msg.session_id?.substring(0, 8), "Available sessions:", allSessions.length);
    }
    return guestNumber ? `Guest ${guestNumber}` : 'Guest';
  }, [getGuestNumber, allSessions.length]);

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

  // Memoized dependencies to prevent unnecessary re-renders
  const filterDependencies = useMemo(() => ({
    page,
    emailFilter,
    phoneFilter,
    guestFilter,
    guestUserFilter,
    showGuests,
    searchTerm,
    dateFilter,
    customStartDate,
    customEndDate
  }), [page, emailFilter, phoneFilter, guestFilter, guestUserFilter, showGuests, searchTerm, dateFilter, customStartDate, customEndDate]);

  // Debounced fetch function to prevent rapid API calls
  const debouncedFetchMessages = useCallback(
    debounce(() => {
      fetchMessages();
    }, CONFIG.DEBOUNCE_DELAY_MS),
    [filterDependencies]
  );

  // Main effect for fetching data
  useEffect(() => {
    // Cancel any ongoing requests
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    // Clear previous errors
    setError(null);
    setSessionError(null);

    // Fetch data with proper error handling
    const fetchData = async () => {
      try {
        await Promise.allSettled([
          fetchMessages(),
          fetchEmailsAndPhoneNumbers(),
          fetchSessions()
        ]);
      } catch (err) {
        console.error('Error in fetchData:', err);
        setError('Failed to load data. Please try again.');
      }
    };

    fetchData();

    // Cleanup function
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [filterDependencies]);

  // Separate effect for debounced search
  useEffect(() => {
    if (searchTerm) {
      debouncedFetchMessages();
    }
  }, [searchTerm, debouncedFetchMessages]);

  // Cleanup effect to prevent memory leaks
  useEffect(() => {
    return () => {
      // Cancel any ongoing requests
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      // Clear cache on unmount
      cacheRef.current.clear();

      // Clear any pending debounced calls
      if (debouncedFetchRef.current) {
        clearTimeout(debouncedFetchRef.current);
      }
    };
  }, []);

  const fetchMessages = async () => {
    try {
      setLoadingMessages(true);

      // If searching, fetch all messages first, then paginate on client side
      if (searchTerm.trim()) {
        // For search, we need to fetch all messages and filter client-side
        let url = `/user/messages`;
        // Add parameters for fetching all messages
        const params = new URLSearchParams();
        params.append('limit', '1000'); // Fetch more messages for search
        params.append('page', '1');

        // Enable email filter
        if (emailFilter) {
          params.append('email', emailFilter);
        }

        // Enable phone filter
        if (phoneFilter) {
          params.append('phone', phoneFilter);
        }

        // Enable guest filter
        if (guestFilter) {
          params.append('is_guest', 'true');
        }

        // Enable session filter
        if (guestUserFilter) {
          params.append('session_id', guestUserFilter);
        }

        url += `?${params.toString()}`;

        const res = await api.get(url, {
          headers: { Authorization: `Bearer ${token}` },
        });

        // Handle nested response structure
        const messageData = res.data.data || res.data;
        let allMessages = messageData.messages || [];

        // Debug: Log first few messages to understand data structure
        console.log("API Response structure:", {
          rawResponse: res.data,
          messageData,
          firstFewMessages: allMessages.slice(0, 3)
        });

        // Filter by guest status
        if (!showGuests) {
          allMessages = allMessages.filter(msg => !isGuestUser(msg));
        }

        // Filter by search term
        allMessages = allMessages.filter(msg =>
          msg.content.toLowerCase().includes(searchTerm.toLowerCase())
        );

        // Client-side date filtering
        if (dateFilter) {
          const selectedDate = new Date(dateFilter);
          allMessages = allMessages.filter(msg => {
            const msgDate = new Date(msg.timestamp);
            return msgDate.toDateString() === selectedDate.toDateString();
          });
        }

        if (customStartDate && customEndDate) {
          const start = customStartDate.toDate();
          const end = customEndDate.toDate();
          end.setHours(23, 59, 59, 999); // Include the entire end date
          allMessages = allMessages.filter(msg => {
            const msgDate = new Date(msg.timestamp);
            return msgDate >= start && msgDate <= end;
          });
        }

        // Client-side pagination for search results
        const startIndex = (page - 1) * 20;
        const endIndex = startIndex + 20;
        const paginatedMessages = allMessages.slice(startIndex, endIndex);

        setMessages(paginatedMessages);
        setTotalPages(Math.ceil(allMessages.length / 20) || 1);
      } else {
        // Check if date filters are active - if so, use client-side pagination
        if (dateFilter || (customStartDate && customEndDate)) {
          // Fetch all messages for client-side filtering and pagination
          let url = `/user/messages`;
          // Add parameters for fetching all messages for date filtering
          const params = new URLSearchParams();
          params.append('limit', '1000'); // Fetch more messages for date filtering
          params.append('page', '1');

          // Enable email filter
          if (emailFilter) {
            params.append('email', emailFilter);
          }

          // Enable phone filter
          if (phoneFilter) {
            params.append('phone', phoneFilter);
          }

          // Enable guest filter
          if (guestFilter) {
            params.append('is_guest', 'true');
          }

          // Enable guest user filter
          if (guestUserFilter) {
            params.append('session_id', guestUserFilter);
          }

          url += `?${params.toString()}`;
          // ...existing code...

          const res = await api.get(url, {
            headers: { Authorization: `Bearer ${token}` },
          });

          // Handle nested response structure
          const messageData = res.data.data || res.data;
          let allMessages = messageData.messages || [];

          // Debug: Log first few messages to understand data structure
          console.log("API Response structure (date filter):", {
            rawResponse: res.data,
            messageData,
            firstFewMessages: allMessages.slice(0, 3)
          });

          // Filter by guest status
          if (!showGuests) {
            allMessages = allMessages.filter(msg => !isGuestUser(msg));
          }

          // Client-side date filtering
          if (dateFilter) {
            const selectedDate = new Date(dateFilter);
            allMessages = allMessages.filter(msg => {
              const msgDate = new Date(msg.timestamp);
              return msgDate.toDateString() === selectedDate.toDateString();
            });
          }

          if (customStartDate && customEndDate) {
            const start = customStartDate.toDate();
            const end = customEndDate.toDate();
            end.setHours(23, 59, 59, 999); // Include the entire end date
            allMessages = allMessages.filter(msg => {
              const msgDate = new Date(msg.timestamp);
              return msgDate >= start && msgDate <= end;
            });
          }

          // Client-side pagination
          const startIndex = (page - 1) * 20;
          const endIndex = startIndex + 20;
          const paginatedMessages = allMessages.slice(startIndex, endIndex);

          setMessages(paginatedMessages);
          setTotalPages(Math.ceil(allMessages.length / 20) || 1);
        } else {
          // Normal server-side pagination when no date filters
          let url = `/user/messages`;
          // Add pagination parameters
          const params = new URLSearchParams();
          params.append('page', page);
          params.append('limit', '20');

          // Enable email filter
          if (emailFilter) {
            params.append('email', emailFilter);
          }

          // Enable phone filter
          if (phoneFilter) {
            params.append('phone', phoneFilter);
          }

          // Enable guest filter
          if (guestFilter) {
            params.append('is_guest', 'true');
          }

          // Enable guest user filter
          if (guestUserFilter) {
            params.append('session_id', guestUserFilter);
          }

          url += `?${params.toString()}`;
          // ...existing code...

          const res = await api.get(url, {
            headers: { Authorization: `Bearer ${token}` },
          });

          // Handle nested response structure
          const messageData = res.data.data || res.data;
          let filteredMessages = messageData.messages || [];

          // Debug: Log first few messages to understand data structure
          console.log("API Response structure (normal):", {
            rawResponse: res.data,
            messageData,
            firstFewMessages: filteredMessages.slice(0, 3)
          });

          // Filter by guest status
          if (!showGuests) {
            filteredMessages = filteredMessages.filter(msg => !isGuestUser(msg));
          }

          setMessages(filteredMessages);
          setTotalPages(messageData.totalPages || 1);
        }
      }
    } catch (err) {
      console.error("Failed to fetch messages:", err);
      console.error("Error details:", {
        message: err.message,
        response: err.response?.data,
        status: err.response?.status
      });
      toast.error("Failed to fetch messages");
      setError(err.message || "Failed to fetch messages");
    } finally {
      setLoadingMessages(false);
    }
  };

  const fetchEmailsAndPhoneNumbers = useCallback(async () => {
    // Check cache first
    const cacheKey = 'emails-and-phones';
    const cachedData = cacheRef.current.get(cacheKey);
    if (cachedData) {
      setAllEmails(cachedData.emails || []);
      setAllPhoneNumbers(cachedData.phoneNumbers || []);
      return;
    }

    try {
      setLoadingEmails(true);

      const res = await retryWithBackoff(async () => {
        return api.get("/user/messages/unique-emails-and-phones-from-messages", {
          headers: { Authorization: `Bearer ${token}` },
          signal: abortControllerRef.current?.signal,
        });
      });

      // Handle nested response structure
      const emailData = res.data.data || res.data;
      console.log("📊 Emails/Phones response:", res.data);
      console.log("📊 Extracted data:", emailData);
      console.log("📊 Extracted emails:", emailData.emails?.length || 0, emailData.emails);
      console.log("📊 Extracted phone numbers:", emailData.phoneNumbers?.length || 0, emailData.phoneNumbers);

      // Filter out empty/null values
      const emails = (emailData.emails || []).filter(email => email && email.trim() !== '');
      const phoneNumbers = (emailData.phoneNumbers || []).filter(phone => phone && phone.toString().trim() !== '');

      // Cache the results
      cacheRef.current.set(cacheKey, { emails, phoneNumbers });

      setAllEmails(emails);
      setAllPhoneNumbers(phoneNumbers);

      console.log("✅ Contacts loaded successfully:", {
        emailsCount: emails.length,
        phonesCount: phoneNumbers.length
      });
    } catch (err) {
      console.error("❌ Failed to fetch emails and phone numbers:", err);
      console.error("Error details:", {
        message: err.message,
        response: err.response?.data,
        status: err.response?.status
      });
      setError('Failed to load contact data. Please try again.');
    } finally {
      setLoadingEmails(false);
    }
  }, [token]);

  const fetchSessions = useCallback(async () => {
    // Check cache first
    const cacheKey = 'sessions';
    const cachedSessions = cacheRef.current.get(cacheKey);
    if (cachedSessions) {
      setAllSessions(cachedSessions);
      return;
    }

    try {
      setLoadingSessions(true);
      setSessionError(null);

      // Fetch all sessions from the dedicated endpoint with retry logic
      const res = await retryWithBackoff(async () => {
        return api.get("/user/sessions", {
          headers: { Authorization: `Bearer ${token}` },
          signal: abortControllerRef.current?.signal,
        });
      });

      const sessionData = res.data.data || res.data;
      const sessionsRaw = sessionData.sessions || [];

      if (sessionsRaw.length === 0) {
        setAllSessions([]);
        return;
      }

      console.log(`📊 Processing ${sessionsRaw.length} total sessions (no limit applied)`);

      // Process ALL sessions - backend already returns messages for each session
      const processSessionsInBatches = async (sessions) => {
        const batchSize = CONFIG.MAX_CONCURRENT_REQUESTS;
        const results = [];

        for (let i = 0; i < sessions.length; i += batchSize) {
          const batch = sessions.slice(i, i + batchSize);

          const batchPromises = batch.map((session, batchIndex) => {
            const globalIndex = i + batchIndex;

            // Backend already returns messages for each session - use them directly!
            const msgs = session.messages || [];
            const isGuest = !session.phone && !session.email && !session.name;
            const firstTimestamp = msgs.length > 0 ? new Date(msgs[0].timestamp).getTime() : Date.now();

            // Only log for first few sessions to reduce console spam
            if (globalIndex < 5) {
              console.log(`Session processed ${session.session_id}:`, {
                msgCount: msgs.length,
                isGuest: isGuest,
                phone: session.phone,
                firstTimestamp: new Date(firstTimestamp).toISOString()
              });
            }

            return Promise.resolve({
              id: session.session_id,
              name: session.phone ? `Phone: ${session.phone}` : session.email ? `Email: ${session.email}` : (session.name ? `User: ${session.name}` : `Session: ${session.session_id}`),
              phone: session.phone,
              email: session.email,
              is_guest: isGuest,
              firstTimestamp: firstTimestamp,
            });
          });

          const batchResults = await Promise.allSettled(batchPromises);
          const successfulResults = batchResults
            .filter(result => result.status === 'fulfilled')
            .map(result => result.value)
            .filter(session => session.id);

          results.push(...successfulResults);
        }

        return results;
      };

      const sessions = await processSessionsInBatches(sessionsRaw);

      // 🎯 Add guest numbering based on timestamp (chronological order)
      // Filter guest sessions and sort by their first message timestamp
      const guestSessions = sessions.filter(s => s.is_guest);
      const nonGuestSessions = sessions.filter(s => !s.is_guest);

      // Sort guest sessions by timestamp (earliest first)
      guestSessions.sort((a, b) => a.firstTimestamp - b.firstTimestamp);

      // Assign guest numbers sequentially
      const numberedGuestSessions = guestSessions.map((session, index) => ({
        ...session,
        guest_number: index + 1,
        name: `Guest ${index + 1}`
      }));

      // Combine numbered guest sessions with non-guest sessions
      const allSessionsWithNumbers = [...numberedGuestSessions, ...nonGuestSessions];

      // Cache the results
      cacheRef.current.set(cacheKey, allSessionsWithNumbers);
      setAllSessions(allSessionsWithNumbers);

      console.log("📊 All sessions fetched:", allSessionsWithNumbers.length, "Guest sessions:", numberedGuestSessions.length);
      console.log("📊 Guest session details:", numberedGuestSessions.map(s => ({ id: s.id.substring(0, 8), number: s.guest_number, name: s.name })));
    } catch (err) {
      console.error("Failed to fetch sessions from /user/sessions", err);
      setSessionError('Failed to load sessions. Please try again.');
      setAllSessions([]);
    } finally {
      setLoadingSessions(false);
    }
  }, [token]);

  const openChatModal = async (contact) => {
    if (!contact) return; // safety

    setSelectedChat(contact);
    setLoadingChat(true);

    // Determine if this is a guest session
    const isGuest = contact.includes('Session:');
    let sessionId = null;

    if (isGuest) {
      sessionId = contact.replace('Session: ', '');
      setSelectedSessionId(sessionId);
      setIsSelectedChatGuest(true);
    } else {
      setSelectedSessionId(null);
      setIsSelectedChatGuest(false);
    }

    try {
      // Test basic API connectivity
      const testUrl = `/user/messages`;
      const testRes = await api.get(testUrl, { headers: { Authorization: `Bearer ${token}` } });

      // Build URL with proper parameters for the existing endpoint
      const params = new URLSearchParams();
      params.append('limit', '1000'); // Fetch more messages for chat history
      params.append('page', '1');

      if (isGuest) {
        // Handle guest session
        params.append('session_id', sessionId);
        console.log("Filtering by session_id:", sessionId);
      } else {
        // Handle regular email/phone
        const key = isEmail(contact) ? "email" : "phone";
        const value = isEmail(contact) ? contact.toLowerCase() : contact;
        params.append(key, value);
        console.log(`Filtering by ${key}:`, value);
      }

      const url = `/user/messages?${params.toString()}`;
      console.log("Fetching chat history for contact:", contact);
      console.log("Constructed URL:", url);
      console.log("URLSearchParams entries:", Array.from(params.entries()));

      const res = await api.get(url, { headers: { Authorization: `Bearer ${token}` } });

      // Handle the response structure as documented
      if (res.data.success && res.data.data) {
        const msgs = (res.data.data.messages ?? [])
          .slice()
          .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

        console.log(`Found ${msgs.length} messages for contact:`, contact);
        setChatHistory(msgs);
      } else {
        console.warn("Unexpected response structure:", res.data);
        setChatHistory([]);
      }
    } catch (err) {
      console.error("Error fetching chat history:", err);
      console.error("Error response:", err.response?.data);
      console.error("Error status:", err.response?.status);
      console.error("Error headers:", err.response?.headers);

      if (err.response?.status === 400) {
        const errorMessage = err.response?.data?.message || "Invalid request parameters";
        const errorDetails = err.response?.data?.details || [];
        console.error("Backend error message:", errorMessage);
        console.error("Backend error details:", errorDetails);
        console.error("Full error response:", err.response?.data);

        // Log each detail item individually
        if (Array.isArray(errorDetails)) {
          errorDetails.forEach((detail, index) => {
            console.error(`Error detail ${index}:`, detail);
          });
        }
        toast.error(`Bad Request: ${errorMessage}`);
      } else if (err.response?.status === 404) {
        toast.error("No messages found for this contact.");
      } else {
        toast.error("Failed to load chat history. Please try again.");
      }

      // Try fallback approach - fetch all messages and filter client-side
      console.log("Attempting fallback: fetch all messages and filter client-side");
      try {
        // First try with minimal parameters
        console.log("Testing basic API call with minimal parameters...");
        const basicUrl = `/user/messages`;
        const basicRes = await api.get(basicUrl, { headers: { Authorization: `Bearer ${token}` } });

        if (basicRes.data.success && basicRes.data.data) {
          console.log("Basic API call successful, now filtering client-side");
          let allMessages = basicRes.data.data.messages || [];

          // Filter client-side based on contact type
          if (contact.includes('Session:')) {
            const sessionId = contact.replace('Session: ', '');
            allMessages = allMessages.filter(msg => msg.session_id === sessionId);
          } else if (isEmail(contact)) {
            allMessages = allMessages.filter(msg => msg.email === contact.toLowerCase());
          } else {
            // Try different phone number formats for filtering
            const phoneFormats = [
              contact,
              `+91${contact}`,
              `+91-${contact}`,
              `91${contact}`,
              contact.replace(/(\d{5})(\d{5})/, '$1-$2'),
            ];

            allMessages = allMessages.filter(msg =>
              phoneFormats.includes(msg.phone) || msg.phone === contact
            );
          }

          const msgs = allMessages
            .slice()
            .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

          console.log(`Fallback: Found ${msgs.length} messages for contact:`, contact);
          setChatHistory(msgs);
          toast.success(`Found ${msgs.length} messages using fallback method`);
        } else {
          console.log("Basic API call failed, trying with parameters...");
          // If basic call fails, try with parameters
          const fallbackUrl = `/user/messages?limit=1000&page=1`;
          const fallbackRes = await api.get(fallbackUrl, { headers: { Authorization: `Bearer ${token}` } });

          if (fallbackRes.data.success && fallbackRes.data.data) {
            let allMessages = fallbackRes.data.data.messages || [];

            // Filter client-side based on contact type
            if (contact.includes('Session:')) {
              const sessionId = contact.replace('Session: ', '');
              allMessages = allMessages.filter(msg => msg.session_id === sessionId);
            } else if (isEmail(contact)) {
              allMessages = allMessages.filter(msg => msg.email === contact.toLowerCase());
            } else {
              // Try different phone number formats for filtering
              const phoneFormats = [
                contact,
                `+91${contact}`,
                `+91-${contact}`,
                `91${contact}`,
                contact.replace(/(\d{5})(\d{5})/, '$1-$2'),
              ];

              allMessages = allMessages.filter(msg =>
                phoneFormats.includes(msg.phone) || msg.phone === contact
              );
            }

            const msgs = allMessages
              .slice()
              .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

            console.log(`Fallback with params: Found ${msgs.length} messages for contact:`, contact);
            setChatHistory(msgs);
            toast.success(`Found ${msgs.length} messages using fallback method`);
          } else {
            setChatHistory([]);
          }
        }
      } catch (fallbackErr) {
        console.error("Fallback also failed:", fallbackErr);
        console.error("Fallback error details:", fallbackErr.response?.data);
        setChatHistory([]);
      }
    } finally {
      setLoadingChat(false);
    }
  };

  const closeModal = () => {
    setSelectedChat(null);
    setSelectedSessionId(null);
    setIsSelectedChatGuest(false);
    setChatHistory([]);
    setPdfDownloaded(false);
  };

  const downloadChatPDF = async () => {
    if (!selectedChat) return;

    try {
      let url;
      let filename;

      if (isSelectedChatGuest && selectedSessionId) {
        // Guest session PDF download
        url = `/user/messages/session/${encodeURIComponent(selectedSessionId)}/pdf`;

        // Try to find guest number for filename
        const session = allSessions.find(s => s.id === selectedSessionId && s.is_guest);
        filename = session?.guest_number
          ? `chat_Guest_${session.guest_number}.pdf`
          : `chat_guest_session.pdf`;
      } else {
        // Regular email/phone PDF download
        const isMail = isEmail(selectedChat);
        url = isMail
          ? `/user/messages/${encodeURIComponent(selectedChat.toLowerCase())}/pdf`
          : `/user/messages/phone/${encodeURIComponent(selectedChat)}/pdf`;

        const safeName = selectedChat.replace(/[^a-zA-Z0-9+@.]/g, "_");
        filename = `chat_${safeName}.pdf`;
      }

      const res = await api.get(url, {
        responseType: "blob",
        headers: { Authorization: `Bearer ${token}` },
      });

      const blob = new Blob([res.data], { type: "application/pdf" });
      saveAs(blob, filename);

      // Show success state for 5 seconds
      setPdfDownloaded(true);
      setTimeout(() => {
        setPdfDownloaded(false);
      }, 5000);
    } catch (err) {
      toast.error("Failed to download chat PDF");
      console.error(err);
    }
  };


  const handleSearch = () => {
    setSearchTerm(searchInput.trim());
    setPage(1); // Reset to first page when searching
  };

  const clearSearch = () => {
    setSearchTerm("");
    setSearchInput("");
    setPage(1);
  };

  const handleDateFilter = () => {
    if (isDateRange && customStartDate && customEndDate) {
      // Use custom date range
      setDateFilter("");
      setPage(1);
      setDateAnchorEl(null);
      fetchMessages();
    } else if (!isDateRange && dateFilter) {
      // Use single date
      setCustomStartDate(null);
      setCustomEndDate(null);
      setPage(1);
      setDateAnchorEl(null);
      fetchMessages();
    } else {
      toast.error("Please select a date or date range");
    }
  };

  const clearDateFilter = () => {
    setDateFilter("");
    setCustomStartDate(null);
    setCustomEndDate(null);
    setIsDateRange(false);
    setPage(1);
    setDateAnchorEl(null);
    fetchMessages();
  };

  const handleDatePickerOpen = (event) => {
    setDateAnchorEl(event.currentTarget);
  };

  const handleDatePickerClose = () => {
    setDateAnchorEl(null);
  };

  const getDateRangeText = () => {
    if (isDateRange && customStartDate && customEndDate) {
      return `${customStartDate.format('DD/MM/YYYY')} - ${customEndDate.format('DD/MM/YYYY')}`;
    } else if (!isDateRange && dateFilter) {
      return dayjs(dateFilter).format('DD/MM/YYYY');
    }
    return "Filter by Date";
  };

  const handleFilterSelection = (filterType, value) => {
    if (filterType === "email") {
      setEmailFilter(value);
      setPhoneFilter("");
      setGuestFilter(false);
      setGuestUserFilter("");
    } else if (filterType === "phone") {
      setPhoneFilter(value);
      setEmailFilter("");
      setGuestFilter(false);
      setGuestUserFilter("");
    } else if (filterType === "guest") {
      setGuestFilter(value);
      setEmailFilter("");
      setPhoneFilter("");
      setGuestUserFilter("");
    } else if (filterType === "guestUser") {
      setGuestUserFilter(value);
      setEmailFilter("");
      setPhoneFilter("");
      setGuestFilter(false);
    }
    setPage(1);
  };

  return (
    <Layout>
      <div className="p-3 sm:p-4 md:p-6 bg-white min-h-screen font-['Exo_2',sans-serif]">
        {/* Enhanced Header */}
        <div className="mb-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="bg-gradient-to-r from-[#1e3a8a] to-[#2563eb] text-white p-2 rounded-xl shadow-md">
              <Mail className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-2xl font-bold text-[#1e3a8a]">
                Message History
              </h2>
            </div>
          </div>
          <p className="text-gray-500 text-sm leading-relaxed">
            View and manage all your message conversations in one place. Track user interactions, analyze engagement patterns, and export conversation data effortlessly.
          </p>
        </div>

        {/* Error Display */}
        {(error || sessionError) && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-6 mb-8">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-6 h-6 text-red-500" />
              <div>
                <h3 className="text-lg font-semibold text-red-800">Error Loading Data</h3>
                <p className="text-sm text-red-600 mt-1">
                  {error || sessionError}
                </p>
                <button
                  onClick={() => {
                    setError(null);
                    setSessionError(null);
                    cacheRef.current.clear();
                    fetchMessages();
                    fetchEmailsAndPhoneNumbers();
                    fetchSessions();
                  }}
                  className="mt-3 inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors"
                >
                  <RefreshCw className="w-4 h-4" />
                  Retry
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Enhanced Filter Container */}
        <div className="bg-white border border-gray-200 rounded-xl p-4 mb-4 shadow-sm">
          <div className="flex flex-wrap items-center gap-3">
            {/* Filter by Contact */}
            <Menu as="div" className="relative inline-block text-left">
              <Menu.Button className="inline-flex cursor-pointer items-center justify-between gap-2 px-4 py-2 rounded-lg bg-white border border-gray-300 text-gray-700 font-medium hover:bg-gray-50 focus:outline-none transition-all duration-200 shadow-sm hover:shadow-md">
                <div className="flex items-center gap-2">
                  <Filter className="w-4 h-4 flex-shrink-0" />
                  <span className="text-sm whitespace-nowrap">
                    {emailFilter || phoneFilter || guestFilter ? (emailFilter || phoneFilter || "Guest Messages") : "Filter by Contact"}
                  </span>
                </div>
                <ChevronDown className="w-4 h-4 flex-shrink-0" />
              </Menu.Button>

              <Menu.Items className="absolute left-0 top-full mt-2 min-w-[250px] origin-top-left bg-white border border-gray-200 rounded-lg shadow-xl focus:outline-none z-[10000]">
                <div className="py-2 max-h-80 overflow-y-auto">
                  <Menu.Item>
                    {({ active }) => (
                      <button
                        onClick={() => {
                          setEmailFilter("");
                          setPhoneFilter("");
                          setGuestFilter(false);
                          setGuestUserFilter("");
                          setPage(1);
                        }}
                        className={`w-full text-left px-4 py-2 text-sm ${!emailFilter && !phoneFilter && !guestFilter
                          ? "bg-[#3a2d9c] text-white"
                          : active
                            ? "bg-gray-100"
                            : ""
                          }`}
                      >
                        All Contacts
                      </button>
                    )}
                  </Menu.Item>
                  {allEmails.map((email, idx) => (
                    <Menu.Item key={`email-${idx}`}>
                      {({ active }) => (
                        <button
                          onClick={() => handleFilterSelection("email", email)}
                          className={`w-full text-left px-4 py-2 text-sm ${emailFilter === email
                            ? "bg-[#3a2d9c] text-white"
                            : active
                              ? "bg-gray-100"
                              : ""
                            }`}
                        >
                          <div className="flex items-center gap-2">
                            <Mail className="w-3 h-3" />
                            <span className="truncate">{email}</span>
                          </div>
                        </button>
                      )}
                    </Menu.Item>
                  ))}
                  {allPhoneNumbers.map((phone, idx) => (
                    <Menu.Item key={`phone-${idx}`}>
                      {({ active }) => (
                        <button
                          onClick={() => handleFilterSelection("phone", phone)}
                          className={`w-full text-left px-4 py-2 text-sm ${phoneFilter === phone
                            ? "bg-[#3a2d9c] text-white"
                            : active
                              ? "bg-gray-100"
                              : ""
                            }`}
                        >
                          <div className="flex items-center gap-2">
                            <User className="w-3 h-3" />
                            <span>{phone}</span>
                          </div>
                        </button>
                      )}
                    </Menu.Item>
                  ))}
                  <Menu.Item>
                    {({ active }) => (
                      <button
                        onClick={() => handleFilterSelection("guest", true)}
                        className={`w-full text-left px-4 py-2 text-sm ${guestFilter
                          ? "bg-[#3a2d9c] text-white"
                          : active
                            ? "bg-gray-100"
                            : ""
                          }`}
                      >
                        <div className="flex items-center gap-2">
                          <Users className="w-3 h-3" />
                          <span>All Guest Messages</span>
                        </div>
                      </button>
                    )}
                  </Menu.Item>
                </div>
              </Menu.Items>
            </Menu>

            {/* Filter by Guest User */}
            <Menu as="div" className="relative inline-block text-left">
              <Menu.Button className="inline-flex cursor-pointer items-center justify-between gap-2 px-4 py-2 rounded-lg bg-white border border-gray-300 text-gray-700 font-medium hover:bg-gray-50 focus:outline-none transition-all duration-200 shadow-sm hover:shadow-md">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 flex-shrink-0" />
                  <span className="text-sm whitespace-nowrap">
                    {guestUserFilter ? (() => {
                      const selectedSession = allSessions.find(s => s.id === guestUserFilter);
                      return selectedSession?.guest_number ? selectedSession.name : "Guest User";
                    })() : "Filter by Guest"}
                  </span>
                </div>
                <ChevronDown className="w-4 h-4 flex-shrink-0" />
              </Menu.Button>

              <Menu.Items className="absolute left-0 top-full mt-2 min-w-[200px] origin-top-left bg-white border border-gray-200 rounded-lg shadow-xl focus:outline-none z-[10000]">
                <div className="py-2 max-h-80 overflow-y-auto">
                  <Menu.Item>
                    {({ active }) => (
                      <button
                        onClick={() => {
                          setGuestUserFilter("");
                          setPage(1);
                        }}
                        className={`w-full text-left px-4 py-2 text-sm ${!guestUserFilter
                          ? "bg-[#3a2d9c] text-white"
                          : active
                            ? "bg-gray-100"
                            : ""
                          }`}
                      >
                        All Guests
                      </button>
                    )}
                  </Menu.Item>
                  {allSessions.filter(s => s.is_guest && s.guest_number).map((session, idx) => (
                    <Menu.Item key={`guest-user-${idx}`}>
                      {({ active }) => (
                        <button
                          onClick={() => handleFilterSelection("guestUser", session.id)}
                          className={`w-full text-left px-4 py-2 text-sm ${guestUserFilter === session.id
                            ? "bg-[#3a2d9c] text-white"
                            : active
                              ? "bg-gray-100"
                              : ""
                            }`}
                        >
                          {session.name}
                        </button>
                      )}
                    </Menu.Item>
                  ))}
                </div>
              </Menu.Items>
            </Menu>

            {/* Date Filter */}
            <button
              onClick={handleDatePickerOpen}
              className="inline-flex cursor-pointer items-center justify-between gap-2 px-4 py-2 rounded-lg bg-white border border-gray-300 text-gray-700 font-medium hover:bg-gray-50 focus:outline-none transition-all duration-200 shadow-sm hover:shadow-md"
            >
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 flex-shrink-0" />
                <span className="text-sm whitespace-nowrap">
                  {getDateRangeText()}
                </span>
              </div>
              <ChevronDown className="w-4 h-4 flex-shrink-0" />
            </button>

            {/* Clear Date Filter Button */}
            {(dateFilter || (customStartDate && customEndDate)) && (
              <button
                onClick={clearDateFilter}
                className="p-2 rounded-lg text-sm font-medium bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 transition-all flex items-center gap-1 cursor-pointer"
                title="Clear date filter"
              >
                <X className="w-4 h-4" />
              </button>
            )}

            <Popover
              open={Boolean(dateAnchorEl)}
              anchorEl={dateAnchorEl}
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

                  {/* Date Range Toggle */}
                  <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isDateRange}
                      onChange={(e) => {
                        setIsDateRange(e.target.checked);
                        if (!e.target.checked) {
                          setCustomStartDate(null);
                          setCustomEndDate(null);
                        } else {
                          setDateFilter("");
                        }
                      }}
                      className="w-4 h-4 text-[#3a2d9c] border-gray-300 rounded focus:ring-[#3a2d9c]"
                    />
                    Date Range
                  </label>

                  {!isDateRange ? (
                    <DatePicker
                      label="Select Date"
                      value={dateFilter ? dayjs(dateFilter) : null}
                      onChange={(newValue) => setDateFilter(newValue ? newValue.format('YYYY-MM-DD') : '')}
                      maxDate={dayjs()}
                      format="DD/MM/YYYY"
                      slotProps={{
                        textField: {
                          size: 'small',
                          fullWidth: true,
                        },
                      }}
                    />
                  ) : (
                    <>
                      <DatePicker
                        label="Start Date"
                        value={customStartDate}
                        onChange={(newValue) => setCustomStartDate(newValue)}
                        maxDate={customEndDate || dayjs()}
                        format="DD/MM/YYYY"
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
                        format="DD/MM/YYYY"
                        slotProps={{
                          textField: {
                            size: 'small',
                            fullWidth: true,
                          },
                        }}
                      />
                    </>
                  )}

                  <div className="flex gap-2 mt-2">
                    <button
                      onClick={handleDatePickerClose}
                      className="flex-1 px-4 py-2 rounded-lg text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 transition-all"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleDateFilter}
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

        {/* Search Bar */}
        <div className="bg-white border border-gray-200 rounded-xl p-4 mb-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-r from-[#3a2d9c] to-[#017977] text-white p-2 rounded-xl shadow-md">
              <Search className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <input
                    type="text"
                    placeholder="Type any word to search in messages..."
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                    className="w-full pl-10 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-800 placeholder-gray-500 focus:ring-2 focus:ring-[#3a2d9c]/50 focus:border-[#3a2d9c]/50 focus:bg-white transition-all duration-200"
                  />
                </div>
                <button
                  onClick={handleSearch}
                  disabled={!searchInput.trim()}
                  className="px-4 py-2 bg-gradient-to-r from-[#3a2d9c] to-[#017977] text-white font-medium text-sm rounded-lg hover:from-[#2a1d7c] hover:to-[#015a58] focus:outline-none transition-all duration-300 shadow-sm hover:shadow-md disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Search
                </button>
                {searchTerm && (
                  <button
                    onClick={clearSearch}
                    className="px-4 py-2 bg-gradient-to-r from-red-500 to-red-600 text-white font-medium text-sm rounded-lg hover:from-red-600 hover:to-red-700 focus:outline-none transition-all duration-300 shadow-sm hover:shadow-md"
                  >
                    Clear
                  </button>
                )}
              </div>
              {searchTerm && (
                <div className="mt-2 flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                  <span className="text-xs text-gray-600">
                    Showing messages containing "{searchTerm}"
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Enhanced Table Container */}
        <>
          {loadingMessages ? (
            <TableSkeleton />
          ) : (
            <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden relative z-10">
              <div className="table-container">
                <table className="w-full text-xs md:text-sm lg:text-base text-left text-gray-800">
                  <thead className="bg-gradient-to-r from-[#3a2d9c] to-[#017977] text-white uppercase text-xs md:text-sm font-semibold">
                    <tr>
                      <th scope="col" className="w-24 md:w-32 lg:w-40 px-2 md:px-4 py-3 md:py-4 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <User className="w-4 h-4 md:w-5 md:h-5" />
                          <span className="hidden sm:inline">Sender</span>
                        </div>
                      </th>
                      <th scope="col" className="px-2 md:px-4 py-3 md:py-4">
                        <div className="flex items-center gap-1">
                          <Mail className="w-4 h-4 md:w-5 md:h-5" />
                          <span className="hidden sm:inline">Message</span>
                          <span className="sm:hidden">Msg</span>
                        </div>
                      </th>
                      <th scope="col" className="w-20 md:w-32 lg:w-36 px-2 md:px-4 py-3 md:py-4 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Mail className="w-4 h-4 md:w-5 md:h-5" />
                          <span className="hidden sm:inline">Contact</span>
                        </div>
                      </th>
                      <th scope="col" className="w-20 md:w-32 lg:w-40 px-2 md:px-4 py-3 md:py-4 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Calendar className="w-4 h-4 md:w-5 md:h-5" />
                          <span className="hidden sm:inline">Date</span>
                        </div>
                      </th>
                      <th scope="col" className="w-16 md:w-20 lg:w-24 px-2 md:px-4 py-3 md:py-4 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Eye className="w-4 h-4 md:w-5 md:h-5" />
                          <span className="hidden sm:inline">Action</span>
                        </div>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="text-sm md:text-base divide-y divide-gray-200">
                    {messages.map((msg, idx) => {
                      const isGuest = isGuestUser(msg);
                      const contact = msg.email || msg.phone || (isGuest ? `Session: ${msg.session_id}` : 'Unknown');

                      // Debug logging for first few messages
                      if (idx < 3) {
                        console.log(`Message ${idx}:`, {
                          email: msg.email,
                          phone: msg.phone,
                          session_id: msg.session_id,
                          isGuest,
                          contact,
                          fullMessage: msg
                        });
                      }
                      return (
                        <tr
                          key={idx}
                          onClick={() => openChatModal(contact)}
                          className="hover:bg-gradient-to-r hover:from-gray-50 hover:to-gray-100 cursor-pointer transition-all duration-300 group"
                        >
                          <td className="w-24 md:w-32 lg:w-40 px-2 md:px-4 py-3 md:py-4 text-center">
                            <div className="flex flex-col items-center gap-1 md:gap-2">
                              {msg.sender === 'bot' ? (
                                <>
                                  <Brain className="w-5 h-5 md:w-6 md:h-6 text-[#3a2d9c]" />
                                  <span className="text-gray-600 text-xs md:text-sm font-medium">agent</span>
                                </>
                              ) : (
                                <>
                                  <User className="w-5 h-5 md:w-6 md:h-6 text-green-600" />
                                  <span className="text-gray-600 text-xs md:text-sm font-medium">user</span>
                                </>
                              )}
                            </div>
                          </td>
                          <td className="px-2 md:px-4 py-3 md:py-4">
                            <div className="text-gray-600 group-hover:text-gray-800 transition-colors duration-200 text-xs md:text-sm lg:text-base line-clamp-2 md:line-clamp-3 prose prose-sm max-w-none">
                              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                {msg.content}
                              </ReactMarkdown>
                            </div>
                          </td>
                          <td className="w-20 md:w-32 lg:w-36 px-2 md:px-4 py-3 md:py-4 text-center">
                            {isGuest ? (
                              <span className="inline-flex items-center gap-1 text-[#3a2d9c] bg-gradient-to-r from-purple-100 to-teal-100 px-2 py-1 rounded-full text-xs md:text-sm font-medium shadow-sm">
                                <Users className="w-3 h-3 md:w-4 md:h-4" />
                                <span className="hidden sm:inline">{getGuestDisplayName(msg)}</span>
                              </span>
                            ) : (
                              <div className="flex flex-col items-center gap-1">
                                <span className="inline-flex items-center gap-1 text-[#3a2d9c] bg-gradient-to-r from-purple-100 to-teal-100 px-2 py-1 rounded-full text-xs md:text-sm font-medium shadow-sm">
                                  {isEmail(contact) ? (
                                    <Mail className="w-3 h-3 md:w-4 md:h-4" />
                                  ) : (
                                    <User className="w-3 h-3 md:w-4 md:h-4" />
                                  )}
                                  <span className="hidden sm:inline">
                                    {isEmail(contact) ? 'Email' : 'Phone'}
                                  </span>
                                </span>
                                <span className="text-xs text-gray-600 truncate max-w-[120px]" title={contact}>
                                  {contact}
                                </span>
                              </div>
                            )}
                          </td>
                          <td className="w-20 md:w-32 lg:w-40 px-2 md:px-4 py-3 md:py-4 text-center text-gray-600">
                            <div className="text-xs md:text-sm">
                              {new Date(msg.timestamp).toLocaleDateString("en-US", {
                                month: "long",
                                day: "numeric",
                                year: "numeric",
                              })}
                            </div>
                            <div className="text-xs md:text-sm text-gray-400">
                              at {new Date(msg.timestamp).toLocaleTimeString("en-US", {
                                hour: "2-digit",
                                minute: "2-digit",
                                hour12: true,
                              })}
                            </div>
                          </td>
                          <td className="w-16 md:w-20 lg:w-24 px-2 md:px-4 py-3 md:py-4 text-center">
                            <button
                              onClick={(e) => {
                                e.stopPropagation(); // avoid double triggering row click
                                openChatModal(contact);
                              }}
                              className="text-[#3a2d9c] cursor-pointer hover:text-[#2a1d7c] hover:scale-110 transition-all duration-200 p-1 md:p-2 rounded-lg hover:bg-purple-50"
                              title="View full chat"
                            >
                              <Eye className="w-4 h-4 md:w-5 md:h-5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                {/* Enhanced Pagination */}
                <div className="flex flex-col sm:flex-row justify-between items-center px-4 md:px-6 py-4 md:py-6 bg-gradient-to-r from-[#3a2d9c] to-[#017977] text-sm md:text-base text-white gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                    <span className="font-medium text-sm md:text-base">
                      Showing {messages.length} messages
                    </span>
                  </div>

                  <div className="flex items-center gap-4">
                    <span className="text-white font-medium text-sm md:text-base">
                      Page {page} of {totalPages}
                    </span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setPage((p) => Math.max(p - 1, 1))}
                        disabled={page === 1}
                        className={`px-4 md:px-6 py-2 md:py-3 rounded-xl font-medium transition-all duration-200 text-sm md:text-base ${page === 1
                          ? "bg-white/20 text-white/50 cursor-not-allowed"
                          : "bg-white/20 hover:bg-white/30 text-white shadow-md hover:shadow-lg"
                          }`}
                      >
                        <span className="hidden sm:inline">Previous</span>
                        <span className="sm:hidden">Prev</span>
                      </button>
                      <button
                        onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
                        disabled={page === totalPages}
                        className={`px-4 md:px-6 py-2 md:py-3 rounded-xl font-medium transition-all duration-200 text-sm md:text-base ${page === totalPages
                          ? "bg-white/20 text-white/50 cursor-not-allowed"
                          : "bg-white/20 hover:bg-white/30 text-white shadow-md hover:shadow-lg"
                          }`}
                      >
                        Next
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>

        {/* Enhanced Chat Modal */}
        <Dialog
          open={!!selectedChat}
          onClose={closeModal}
          className="fixed z-50 inset-0 overflow-y-auto"
        >
          <div className="flex items-center justify-center min-h-screen bg-black/60 backdrop-blur-md p-3 sm:p-4">
            <Dialog.Panel className="bg-gradient-to-br from-gray-800 via-gray-900 to-gray-800 backdrop-blur-xl w-full max-w-3xl rounded-2xl sm:rounded-3xl shadow-2xl border border-gray-600/50 overflow-hidden relative">
              {/* Animated Background Elements */}
              <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 via-purple-500/5 to-pink-500/5 opacity-50"></div>
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500"></div>

              {/* Enhanced Modal Header */}
              <div className="relative bg-gradient-to-r from-gray-700/90 via-gray-600/90 to-gray-700/90 backdrop-blur-sm px-4 sm:px-6 py-4 sm:py-5 border-b border-gray-600/50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
                    <div className="relative flex-shrink-0">
                      <div className="bg-gradient-to-br from-indigo-500 to-purple-600 text-white p-2 sm:p-3 rounded-xl sm:rounded-2xl shadow-xl group-hover:shadow-2xl transition-all duration-300">
                        {selectedChat?.includes('Session:') ? (
                          <Users className="text-white w-5 h-5 sm:w-6 sm:h-6" />
                        ) : (
                          <Mail className="text-white w-5 h-5 sm:w-6 sm:h-6" />
                        )}
                      </div>
                      <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl sm:rounded-2xl blur opacity-30 group-hover:opacity-50 transition-opacity duration-300"></div>
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-lg sm:text-xl font-bold text-white mb-1 truncate">Chat History</h3>
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse flex-shrink-0"></div>
                        <p className="text-xs sm:text-sm text-gray-300 truncate font-medium">
                          {selectedChat?.includes('Session:') ? (() => {
                            const sessionId = selectedChat.replace('Session: ', '');
                            const session = allSessions.find(s => s.id === sessionId && s.is_guest);
                            return session?.guest_number ? `Guest ${session.guest_number}` : selectedChat;
                          })() : selectedChat}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
                    <button
                      onClick={downloadChatPDF}
                      className={`group p-2 sm:p-3 rounded-lg sm:rounded-xl transition-all duration-300 hover:scale-110 hover:shadow-lg ${pdfDownloaded
                        ? 'text-green-400 bg-green-900/30'
                        : 'text-gray-400 hover:text-blue-400 hover:bg-blue-900/30'
                        }`}
                      title={pdfDownloaded ? "Downloaded!" : "Download Chat PDF"}
                    >
                      {pdfDownloaded ? (
                        <Check className="w-4 h-4 sm:w-5 sm:h-5 animate-pulse" />
                      ) : (
                        <Download className="w-4 h-4 sm:w-5 sm:h-5 group-hover:scale-110 transition-transform duration-200" />
                      )}
                    </button>
                    <button
                      onClick={closeModal}
                      className="group p-2 sm:p-3 text-gray-400 hover:text-red-400 hover:bg-red-900/30 rounded-lg sm:rounded-xl transition-all duration-300 hover:scale-110 hover:shadow-lg"
                      title="Close"
                    >
                      <X className="w-4 h-4 sm:w-5 sm:h-5 group-hover:scale-110 transition-transform duration-200" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Enhanced Chat Messages */}
              <div className="relative p-4 sm:p-6 space-y-4 sm:space-y-6 max-h-[65vh] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800">
                {loadingChat ? (
                  <div className="flex justify-center items-center py-16">
                    <div className="flex flex-col items-center gap-4">
                      <div className="relative">
                        <div className="animate-spin rounded-full h-12 w-12 border-4 border-indigo-600/30 border-t-indigo-600"></div>
                        <div className="absolute inset-0 animate-ping rounded-full h-12 w-12 border-2 border-indigo-600/20"></div>
                      </div>
                      <p className="text-sm text-gray-400 font-medium">Loading chat history...</p>
                    </div>
                  </div>
                ) : (
                  chatHistory.map((msg, idx) => (
                    <div
                      key={idx}
                      className={`group max-w-[85%] rounded-3xl p-5 text-sm shadow-xl transition-all duration-300 hover:shadow-2xl hover:scale-[1.02] ${msg.sender === "user"
                        ? "ml-auto bg-gradient-to-r from-indigo-500 via-purple-600 to-pink-500 text-white rounded-tr-lg"
                        : "bg-gradient-to-r from-gray-700 via-gray-600 to-gray-700 text-gray-200 rounded-tl-lg border border-gray-600/50"
                        }`}
                    >
                      {/* Message Header */}
                      <div className="flex items-center gap-3 mb-3">
                        <div className={`w-3 h-3 rounded-full shadow-lg ${msg.sender === "user" ? "bg-white/80" : "bg-indigo-400"
                          }`}></div>
                        <p className="text-xs font-bold opacity-90 tracking-wide uppercase">
                          {msg.sender === "user" ? "You" : msg.sender}
                        </p>
                        <div className="flex-1 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent"></div>
                      </div>

                      {/* Message Content */}
                      <div className="whitespace-pre-wrap leading-relaxed text-base mb-4 font-medium prose prose-sm prose-invert max-w-none">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {msg.content}
                        </ReactMarkdown>
                      </div>

                      {/* Message Timestamp */}
                      <div className="flex justify-end">
                        <p className={`text-xs px-3 py-1 rounded-full font-medium ${msg.sender === "user"
                          ? "bg-white/20 text-white/80"
                          : "bg-gray-600/50 text-gray-400"
                          }`}>
                          {new Date(msg.timestamp).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  ))
                )}

                {/* Empty State */}
                {!loadingChat && chatHistory.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <div className="w-20 h-20 bg-gradient-to-br from-gray-600 to-gray-700 rounded-full flex items-center justify-center mb-4">
                      <Mail className="w-8 h-8 text-gray-400" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-300 mb-2">No Messages Found</h3>
                    <p className="text-sm text-gray-500">This conversation appears to be empty.</p>
                  </div>
                )}
              </div>
            </Dialog.Panel>
          </div>
        </Dialog>
      </div>
    </Layout>
  );
}
