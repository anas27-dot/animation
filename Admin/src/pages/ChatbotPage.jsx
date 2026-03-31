import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../services/api";
import { assignCompanyCredits, getCompanyCreditBalance, addCompanyCredits, removeCompanyCredits, fetchCompaniesWithChatbots } from "../services/api";
import { API_BASE_URL } from "../config";
import { toast } from "react-toastify";
import {
  Search,
  Copy,
  Rocket,
  Building,
  Link,
  Pencil,
  Check,
  Save,
  Brain,
  Loader2,
  Undo2,
} from "lucide-react";
import { useAuth } from "../context/AuthContext"; // 👈 1. Import useAuth

// --- Skeleton Components for Loading State ---
const StatSkeleton = () => (
  <div className="bg-white p-4 rounded-xl border border-gray-200/80">
    <div className="h-3 bg-gray-200 rounded-full w-24 mb-2 animate-pulse"></div>
    <div className="h-6 bg-gray-300 rounded-full w-20 animate-pulse"></div>
  </div>
);

const PlanDetailSkeleton = () => (
  <div>
    <div className="h-2.5 bg-gray-200 rounded-full w-16 mb-2 animate-pulse"></div>
    <div className="h-4 bg-gray-300 rounded-full w-20 animate-pulse"></div>
  </div>
);

const ChatbotCardSkeleton = () => (
  <div className="bg-white rounded-xl shadow-md p-6 lg:p-8 border border-gray-200/80">
    {/* Header Skeleton */}
    <div className="mb-8">
      <div className="h-6 bg-gray-300 rounded-full w-1/2 mb-3 animate-pulse"></div>
      <div className="flex items-center gap-x-6">
        <div className="h-4 bg-gray-200 rounded-full w-1/4 animate-pulse"></div>
        <div className="h-4 bg-gray-200 rounded-full w-1/3 animate-pulse"></div>
      </div>
    </div>
    {/* Stats Skeleton */}
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mb-8">
      <StatSkeleton />
      <StatSkeleton />
      <StatSkeleton />
      <StatSkeleton />
    </div>
    {/* Token Limit Skeleton */}
    <div className="mb-8">
      <div className="h-3 bg-gray-200 rounded-full w-32 mb-2 animate-pulse"></div>
      <div className="h-8 bg-gray-300 rounded-full w-48 animate-pulse"></div>
    </div>
    {/* Plan Details Skeleton */}
    <div className="mb-8">
      <div className="h-4 bg-gray-200 rounded-full w-32 mb-2 animate-pulse"></div>
      <div className="h-3 bg-gray-200 rounded-full w-48 mb-4 animate-pulse"></div>
      <div className="bg-white p-4 rounded-xl border border-gray-200/80">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4 text-sm">
          <PlanDetailSkeleton />
          <PlanDetailSkeleton />
          <PlanDetailSkeleton />
          <PlanDetailSkeleton />
          <PlanDetailSkeleton />
          <PlanDetailSkeleton />
        </div>
      </div>
    </div>
  </div>
);
// --- End Skeleton Components ---

const MODAL_TYPES = {
  NONE: null,
  PERSONA: "persona",
};

const ManageChatbotsPage = () => {
  const navigate = useNavigate();
  const [chatbots, setChatbots] = useState([]);
  const [selected, setSelected] = useState(null);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(MODAL_TYPES.NONE);
  const [loading, setLoading] = useState(true);
  const [availablePlans, setAvailablePlans] = useState([]);
  const [editingCreditsFor, setEditingCreditsFor] = useState(null);
  const [newCredits, setNewCredits] = useState("");
  const [companyCredits, setCompanyCredits] = useState({}); // { companyId: { total, used, remaining } }
  // Add/Remove credit modal state
  const [showAddCreditModal, setShowAddCreditModal] = useState(false);
  const [showRemoveCreditModal, setShowRemoveCreditModal] = useState(false);
  const [selectedCompanyForCredit, setSelectedCompanyForCredit] = useState(null);
  const [creditAmount, setCreditAmount] = useState("");
  const [creditDuration, setCreditDuration] = useState("");
  const [processingCredit, setProcessingCredit] = useState(false);

  // Persona modal state
  const [personaLoading, setPersonaLoading] = useState(false);
  const [personaSaving, setPersonaSaving] = useState(false);
  const [personaDraft, setPersonaDraft] = useState("");
  const [personaOriginal, setPersonaOriginal] = useState("");

  const { token } = useAuth(); // 👈 2. Get token from context

  const fetchAllData = async (showLoading = true) => {
    if (!token) return; // Don't fetch if no token
    if (showLoading) setLoading(true);

    try {
      // Fetch companies with chatbots and plans in parallel
      const [companiesResponse, plansResponse] = await Promise.all([
        fetchCompaniesWithChatbots().catch(err => {
          console.warn("Failed to fetch companies with chatbots:", err);
          return { data: { data: [] } };
        }),
        api.get("/plans", {
          headers: { Authorization: `Bearer ${token}` },
        }).catch(err => {
          console.warn("Plans endpoint not available:", err);
          return { data: { plans: [] } };
        }),
      ]);

      const companies = companiesResponse.data?.data || companiesResponse.data || [];
      console.log('🏢 Fetched companies with chatbots:', companies);

      // Flatten all chatbots from all companies
      const allChatbots = [];
      companies.forEach(company => {
        if (company.chatbots && Array.isArray(company.chatbots)) {
          company.chatbots.forEach(chatbot => {
            allChatbots.push({
              ...chatbot,
              company_id: company._id,
              company_name: company.name,
              company_url: company.url,
            });
          });
        }
      });

      console.log('🤖 All chatbots flattened:', allChatbots);
      setChatbots(allChatbots);

      // Fetch company credit balances for all unique companies
      const companyIds = [...new Set(
        companies
          .map(company => company._id ? String(company._id) : null)
          .filter(Boolean)
      )];

      console.log('📊 Fetching credits for company IDs:', companyIds);

      const creditPromises = companyIds.map(async (companyId) => {
        try {
          const creditRes = await getCompanyCreditBalance(companyId);
          const creditsData = creditRes.data?.data || creditRes.data || {};
          console.log(`✅ Credits fetched for company ${companyId}:`, creditsData);
          // Normalize property names for consistency
          const normalizedCredits = {
            total_credits: creditsData.total_credits || creditsData.total || 0,
            used_credits: creditsData.used_credits || creditsData.used || 0,
            remaining_credits: creditsData.remaining_credits || creditsData.remaining || 0,
            expiresAt: creditsData.expiresAt, // Include expiration date
          };
          return { companyId, credits: normalizedCredits };
        } catch (err) {
          console.error(`❌ Failed to fetch credits for company ${companyId}:`, err);
          return { companyId, credits: { total_credits: 0, used_credits: 0, remaining_credits: 0 } };
        }
      });
      const creditResults = await Promise.all(creditPromises);
      const creditsMap = {};
      creditResults.forEach(({ companyId, credits }) => {
        // Normalize company ID to string for consistent lookups
        creditsMap[String(companyId)] = credits;
      });
      console.log('💾 Setting company credits map:', creditsMap);
      setCompanyCredits(creditsMap);

      setAvailablePlans(plansResponse.data.plans || []);
    } catch (err) {
      console.error("Failed to fetch data:", err);
      toast.error("Failed to load dashboard data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, [token]); // 👈 3. Re-run when token is available

  // Refresh credits when modal closes (after add/remove)
  useEffect(() => {
    if (!showAddCreditModal && !showRemoveCreditModal && selectedCompanyForCredit === null) {
      // Credits were just added/removed, refresh the data
      const timer = setTimeout(() => {
        fetchAllData(false);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [showAddCreditModal, showRemoveCreditModal, selectedCompanyForCredit]);

  const handleUpdateCredits = async (companyId) => {
    if (!companyId) {
      toast.error("Company ID is missing. Cannot update credits.");
      return;
    }

    try {
      const credits = parseInt(newCredits, 10);
      if (isNaN(credits) || credits < 0) {
        toast.error("Please enter a valid credit amount");
        return;
      }

      await assignCompanyCredits(String(companyId), credits, "Admin credit adjustment");

      // Update local state - credits are reset, so used = 0, remaining = total
      setCompanyCredits((prev) => ({
        ...prev,
        [companyId]: {
          total: credits,
          used: 0, // Reset to 0
          remaining: credits // Remaining = total after reset
        }
      }));

      toast.success("Credits updated successfully!");
      setEditingCreditsFor(null);
      setNewCredits("");
    } catch (err) {
      console.error("Failed to update credits:", err);
      toast.error("Failed to update credits. Please try again.");
    }
  };

  const handleAddCredits = async () => {
    if (!selectedCompanyForCredit) {
      toast.error("Company ID is missing.");
      return;
    }

    const credits = parseInt(creditAmount, 10) || 0;
    const duration = parseInt(creditDuration, 10) || 0;

    // Must have either credits or duration
    if (credits <= 0 && duration <= 0) {
      toast.error("Please enter either credits to add or duration in days");
      return;
    }

    // Validate credits if provided
    if (credits > 0 && isNaN(credits)) {
      toast.error("Please enter a valid credit amount");
      return;
    }

    // Validate duration if provided
    if (duration > 0 && isNaN(duration)) {
      toast.error("Please enter a valid duration in days");
      return;
    }

    setProcessingCredit(true);
    try {
      // Only send duration if it's provided and valid
      const durationValue = (duration && String(duration).trim() !== '' && parseInt(duration) > 0) ? duration : undefined;
      const result = await addCompanyCredits(String(selectedCompanyForCredit), credits, durationValue, 'Credits added by admin');

      // Update local state with new credit values - normalize company ID to string
      const normalizedCompanyId = String(selectedCompanyForCredit);
      const newCredits = {
        total_credits: result.data.data.total_credits || result.data.data.total || 0,
        used_credits: result.data.data.used_credits || result.data.data.used || 0,
        remaining_credits: result.data.data.remaining_credits || result.data.data.remaining || 0,
        expiresAt: result.data.data.expiresAt // Include expiration date
      };
      setCompanyCredits((prev) => ({
        ...prev,
        [normalizedCompanyId]: newCredits
      }));

      // Also refetch credits to ensure consistency
      const refreshCompanyId = normalizedCompanyId; // Store in closure for setTimeout
      setTimeout(async () => {
        try {
          const creditRes = await getCompanyCreditBalance(refreshCompanyId);
          const refreshedCredits = creditRes.data?.data || creditRes.data || {};
          setCompanyCredits((prevState) => ({
            ...prevState,
            [refreshCompanyId]: {
              total_credits: refreshedCredits.total_credits || refreshedCredits.total || 0,
              used_credits: refreshedCredits.used_credits || refreshedCredits.used || 0,
              remaining_credits: refreshedCredits.remaining_credits || refreshedCredits.remaining || 0,
              expiresAt: refreshedCredits.expiresAt,
            }
          }));
        } catch (err) {
          console.error('Failed to refresh credits:', err);
        }
      }, 1000); // Increased delay to 1 second

      toast.success(`${credits} credits added successfully!`);

      // Notify other components that credits have been updated
      window.dispatchEvent(new CustomEvent('creditsUpdated'));

      setShowAddCreditModal(false);
      setCreditAmount("");
      setCreditDuration("");
      setSelectedCompanyForCredit(null);
    } catch (err) {
      console.error("Failed to add credits:", err);
      toast.error(err.response?.data?.message || "Failed to add credits.");
    } finally {
      setProcessingCredit(false);
    }
  };

  const handleRemoveCredits = async () => {
    if (!selectedCompanyForCredit) {
      toast.error("Company ID is missing.");
      return;
    }

    const credits = parseInt(creditAmount, 10) || 0;
    const duration = parseInt(creditDuration, 10) || 0;

    // Must have either credits or duration
    if (credits <= 0 && duration <= 0) {
      toast.error("Please enter either credits to remove or duration to reduce");
      return;
    }

    // Validate credits if provided
    if (credits > 0) {
      if (isNaN(credits)) {
        toast.error("Please enter a valid credit amount");
        return;
      }

      const currentCredits = companyCredits[selectedCompanyForCredit] || { total_credits: 0, used_credits: 0, remaining_credits: 0 };
      const remainingCredits = currentCredits.remaining_credits || currentCredits.remaining || 0;
      if (credits > remainingCredits) {
        toast.error(`Cannot remove ${credits} credits. Only ${remainingCredits} credits remaining.`);
        return;
      }
    }

    // Validate duration reduction if provided
    if (duration > 0) {
      if (isNaN(duration)) {
        toast.error("Please enter a valid duration in days");
        return;
      }

      const currentCredits = companyCredits[selectedCompanyForCredit] || { total_credits: 0, used_credits: 0, remaining_credits: 0 };
      const currentExpiry = currentCredits.expiresAt;
      if (!currentExpiry) {
        toast.error("Cannot reduce duration - no expiration date is currently set.");
        return;
      }
      const expiryDate = new Date(currentExpiry);
      const reducedDate = new Date(expiryDate);
      reducedDate.setDate(expiryDate.getDate() - duration);

      if (reducedDate <= new Date()) {
        toast.error("Cannot reduce duration to a past date.");
        return;
      }
    }

    setProcessingCredit(true);
    try {
      // Only send duration if it's provided and valid
      const durationValue = (duration && String(duration).trim() !== '' && parseInt(duration) > 0) ? duration : undefined;
      const result = await removeCompanyCredits(String(selectedCompanyForCredit), credits, durationValue);

      // Update local state with new credit values - normalize company ID to string
      const normalizedCompanyId = String(selectedCompanyForCredit);
      const newCredits = {
        total_credits: result.data.data.total_credits || result.data.data.total || 0,
        used_credits: result.data.data.used_credits || result.data.data.used || 0,
        remaining_credits: result.data.data.remaining_credits || result.data.data.remaining || 0,
        expiresAt: result.data.data.expiresAt // Include expiration date
      };
      setCompanyCredits((prev) => ({
        ...prev,
        [normalizedCompanyId]: newCredits
      }));

      // Also refetch credits to ensure consistency
      setTimeout(async () => {
        try {
          const creditRes = await getCompanyCreditBalance(normalizedCompanyId);
          const refreshedCredits = creditRes.data?.data || creditRes.data || {};
          setCompanyCredits((prev) => ({
            ...prev,
            [normalizedCompanyId]: {
              total_credits: refreshedCredits.total_credits || refreshedCredits.total || 0,
              used_credits: refreshedCredits.used_credits || refreshedCredits.used || 0,
              remaining_credits: refreshedCredits.remaining_credits || refreshedCredits.remaining || 0,
            }
          }));
        } catch (err) {
          console.error('Failed to refresh credits:', err);
        }
      }, 1000); // Increased delay to 1 second

      toast.success(`${credits} credits removed successfully!`);

      // Notify other components that credits have been updated
      window.dispatchEvent(new CustomEvent('creditsUpdated'));

      setShowRemoveCreditModal(false);
      setCreditAmount("");
      setCreditDuration("");
      setSelectedCompanyForCredit(null);
    } catch (err) {
      console.error("Failed to remove credits:", err);
      toast.error(err.response?.data?.message || "Failed to remove credits.");
    } finally {
      setProcessingCredit(false);
    }
  };


  // PERSONA: open modal + fetch
  const openPersonaModal = async (chatbot) => {
    setSelected(chatbot);
    setShowModal(MODAL_TYPES.PERSONA);
    setPersonaLoading(true);
    setPersonaDraft("");
    setPersonaOriginal("");
    try {
      // 👉 API endpoint here
      const res = await api.get(`/chatbot/${chatbot._id}/persona`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const persona = res?.data?.persona ?? "";
      setPersonaDraft(persona);
      setPersonaOriginal(persona);
    } catch (err) {
      console.error("Failed to fetch persona:", err);
      toast.error("Couldn't fetch persona.");
    } finally {
      setPersonaLoading(false);
    }
  };

  // PERSONA: save
  const savePersona = async () => {
    if (!selected?._id) return;
    setPersonaSaving(true);
    try {
      // 👉 API endpoint here
      await api.put(
        `/chatbot/${selected._id}/persona`,
        { persona: personaDraft },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setPersonaOriginal(personaDraft);
      toast(<CustomSuccessToast text="Persona saved!" />);
    } catch (err) {
      console.error("Failed to save persona:", err);
      toast.error("Saving persona failed.");
    } finally {
      setPersonaSaving(false);
    }
  };

  const closeAnyModal = () => {
    setShowModal(MODAL_TYPES.NONE);
    setSelected(null);
  };

  const resetPersonaToFetched = () => setPersonaDraft(personaOriginal);

  return (
    <div className="min-h-screen p-4 sm:p-6 lg:p-8">
      <header className="flex flex-col sm:flex-row justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-[#1e3a8a] flex items-center gap-3">
          <Rocket className="text-[#1e3a8a]" />
          Manage Chatbots
        </h1>
        <div className="flex items-center gap-4 mt-4 sm:mt-0 w-full sm:w-auto">
          <div className="relative w-full sm:w-64">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              size={18}
            />
            <input
              type="text"
              placeholder="Search chatbots..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1e3a8a] shadow-sm"
            />
          </div>
        </div>
      </header>

      {/* --- 4. Conditional Rendering for Loading State --- */}
      {loading ? (
        <div className="space-y-8">
          <ChatbotCardSkeleton />
          <ChatbotCardSkeleton />
        </div>
      ) : (
        <div className="space-y-8">
          {chatbots.length > 0 ? (
            chatbots
              .filter((cb) =>
                cb.name.toLowerCase().includes(search.toLowerCase())
              )
              .map((cb) => {
                // Handle both string and ObjectId formats, convert to string for consistency
                const companyId = cb.company_id ? String(cb.company_id) : null;
                // Normalize company ID to string for consistent lookup
                const normalizedCompanyId = companyId ? String(companyId) : null;
                const credits = normalizedCompanyId ? (companyCredits[normalizedCompanyId] || { total_credits: 0, used_credits: 0, remaining_credits: 0 }) : { total_credits: 0, used_credits: 0, remaining_credits: 0 };

                return (
                  <div
                    key={cb._id}
                    className="bg-white rounded-xl shadow-lg p-6 lg:p-8 border border-gray-200 hover:shadow-xl transition-all duration-300"
                  >
                    <div className="mb-8">
                      <h2 className="text-xl font-bold text-[#1e3a8a]">
                        {cb.name}
                      </h2>
                      <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-sm mt-2">
                        <span className="flex items-center gap-1.5 text-gray-500">
                          <Building size={14} />
                          {cb.company_name}
                        </span>
                        <a
                          href={`https://${cb.company_url}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1.5 text-[#1e3a8a] hover:text-[#2563eb] hover:underline underline-offset-4 transition-colors"
                        >
                          <Link size={14} />
                          {cb.company_url}
                        </a>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                      <Stat
                        label="CREDITS USED"
                        value={new Intl.NumberFormat("en-IN").format(
                          credits.used_credits || credits.used || 0
                        )}
                      />
                      <Stat
                        label="TOTAL MESSAGES"
                        value={new Intl.NumberFormat("en-IN").format(
                          cb.total_messages || 0
                        )}
                      />
                      <Stat
                        label="UNIQUE USERS"
                        value={new Intl.NumberFormat("en-IN").format(
                          cb.unique_users || 0
                        )}
                      />
                      <Stat
                        label="REMAINING CREDITS"
                        value={new Intl.NumberFormat("en-IN").format(
                          credits.remaining_credits || credits.remaining || 0
                        )}
                      />
                    </div>

                    {/* Total Credits UI - Commented out */}
                    {/* <div className="mb-8">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <p className="text-sm text-gray-500">
                            Total Credits
                          </p>
                          {editingCreditsFor !== companyId && companyId && (
                            <button
                              onClick={() => {
                                setEditingCreditsFor(companyId);
                                setNewCredits(credits.total || "");
                              }}
                            >
                              <Pencil
                                size={12}
                                className="text-gray-400 hover:text-blue-600"
                              />
                            </button>
                          )}
                        </div>
                        {editingCreditsFor !== companyId && companyId && (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => {
                                setSelectedCompanyForCredit(companyId);
                                setShowAddCreditModal(true);
                                setCreditAmount("");
                                setCreditDuration("");
                              }}
                              className="px-3 py-1.5 text-xs font-medium bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors flex items-center gap-1"
                            >
                              <span>+</span> Add Credit
                            </button>
                            <button
                              onClick={() => {
                                setSelectedCompanyForCredit(companyId);
                                setShowRemoveCreditModal(true);
                                setCreditAmount("");
                                setCreditDuration("");
                              }}
                              className="px-3 py-1.5 text-xs font-medium bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors flex items-center gap-1"
                            >
                              <span>−</span> Remove Credit
                            </button>
                            <button
                              onClick={async () => {
                                // Refresh credit data for this company
                                try {
                                  const creditRes = await getCompanyCreditBalance(companyId);
                                  const creditsData = creditRes.data?.data || creditRes.data || {};
                                  const normalizedCredits = {
                                    total_credits: creditsData.total_credits || creditsData.total || 0,
                                    used_credits: creditsData.used_credits || creditsData.used || 0,
                                    remaining_credits: creditsData.remaining_credits || creditsData.remaining || 0,
                                    expiresAt: creditsData.expiresAt,
                                  };

                                  setCompanyCredits(prev => ({
                                    ...prev,
                                    [String(companyId)]: normalizedCredits
                                  }));

                                  toast.success("Credit data refreshed");
                                } catch (err) {
                                  console.error('Failed to refresh credits:', err);
                                  toast.error("Failed to refresh credit data");
                                }
                              }}
                              className="px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors flex items-center gap-1"
                              title="Refresh credit data"
                            >
                              <RefreshCw size={12} />
                            </button>
                          </div>
                        )}
                      </div>
                      {editingCreditsFor === companyId && companyId ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            value={newCredits}
                            onChange={(e) => setNewCredits(e.target.value)}
                            className="text-3xl font-bold text-gray-800 bg-slate-100 rounded-md p-1 w-full max-w-xs"
                            autoFocus
                          />
                          <button
                            onClick={() => handleUpdateCredits(companyId)}
                            className="p-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                          >
                            <Save size={20} />
                          </button>
                          <button
                            onClick={() => {
                              setEditingCreditsFor(null);
                              setNewCredits("");
                            }}
                            className="p-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
                          >
                            <span className="text-lg font-bold">&times;</span>
                          </button>
                        </div>
                      ) : (
                        <p className="text-3xl font-bold text-gray-800">
                          {new Intl.NumberFormat("en-IN").format(
                            credits.total || 0
                          )}
                        </p>
                      )}
                    </div> */}

                    {/* Credit Management Section - Prominent Add/Remove Buttons */}
                    {companyId && (
                      <div className="mb-8 bg-gray-50 rounded-lg p-4 border border-gray-200">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-semibold text-gray-700 mb-1">
                              Credit Management
                            </p>
                            <p className="text-xs text-gray-500">
                              Add or remove credits for this company
                            </p>
                          </div>
                          <div className="flex items-center gap-3">
                            <button
                              onClick={() => {
                                setSelectedCompanyForCredit(companyId);
                                setShowAddCreditModal(true);
                                setCreditAmount("");
                                setCreditDuration("");
                              }}
                              className="h-11 px-5 text-sm font-medium bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors flex items-center gap-2 shadow-sm whitespace-nowrap"
                            >
                              <span className="text-xl">+</span> Add Credit
                            </button>
                            <button
                              onClick={() => {
                                setSelectedCompanyForCredit(companyId);
                                setShowRemoveCreditModal(true);
                                setCreditAmount("");
                                setCreditDuration("");
                              }}
                              className="h-11 px-5 text-sm font-medium bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors flex items-center gap-2 shadow-sm whitespace-nowrap"
                            >
                              <span className="text-xl">−</span> Remove Credit
                            </button>
                            <button
                              onClick={() => openPersonaModal(cb)}
                              className="h-11 px-5 text-sm font-medium bg-[#1e3a8a] text-white rounded-md hover:bg-[#1e40af] transition-colors flex items-center gap-2 shadow-sm whitespace-nowrap"
                            >
                              <Brain size={20} /> Persona
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="mb-8">
                      <p className="font-semibold text-gray-800 mb-1">
                        Plan Details
                      </p>
                      <p className="text-sm text-gray-500 mb-4">
                        Overview of your subscription
                      </p>
                      <div className="bg-white p-4 rounded-xl border border-gray-200/80">
                        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-4 gap-4 text-sm">
                          <PlanDetail label="NAME" value={cb.name || 'N/A'} />
                          <PlanDetail label="DURATION" value={
                            (() => {
                              const companyId = cb.company_id ? String(cb.company_id) : null;
                              const expiresAt = companyCredits[companyId]?.expiresAt;
                              if (expiresAt) {
                                const expiresDate = new Date(expiresAt);
                                const now = new Date();
                                const daysRemaining = Math.max(0, Math.ceil((expiresDate - now) / (1000 * 60 * 60 * 24)));
                                return `${daysRemaining} days`;
                              } else {
                                return 'Unlimited';
                              }
                            })()
                          } />
                          <PlanDetail label="USERS USED" value={`${cb.unique_users} / Unlimited`} />
                          <PlanDetail label="EXPIRES" value={
                            (() => {
                              const companyId = cb.company_id ? String(cb.company_id) : null;
                              const expiresAt = companyCredits[companyId]?.expiresAt;
                              return expiresAt
                                ? new Date(expiresAt).toLocaleDateString('en-US')
                                : 'Never';
                            })()
                          } />
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between bg-slate-100 p-3 rounded-lg border border-slate-200 mb-8">
                      <code className="text-xs text-gray-600 break-all mr-4 overflow-x-auto whitespace-pre-wrap">
                        {(() => {
                          const apiBaseUrl = API_BASE_URL.replace(/\/api$/, '');
                          return `<script\n  src="${apiBaseUrl}/chatbot-loader/fullscreen-loader.js"\n  chatbot-id="${cb._id}"\n  api-base="${apiBaseUrl}/api"\n  bundle-url="${apiBaseUrl}/chatbot-loader/chatbot-fullscreen-bundle.js"\n></script>`;
                        })()}
                      </code>
                      <button
                        onClick={() => {
                          const apiBaseUrl = API_BASE_URL.replace(/\/api$/, '');
                          const script = `<script
  src="${apiBaseUrl}/chatbot-loader/fullscreen-loader.js"
  chatbot-id="${cb._id}"
  api-base="${apiBaseUrl}/api"
  bundle-url="${apiBaseUrl}/chatbot-loader/chatbot-fullscreen-bundle.js"
></script>`;
                          navigator.clipboard.writeText(script);
                          toast(<CustomSuccessToast text="Embed code copied" />);
                        }}
                        className="flex-shrink-0 px-4 py-2 bg-white text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50 text-sm font-medium flex items-center gap-2"
                      >
                        <Copy size={14} /> Copy
                      </button>
                    </div>

                  </div>
                );
              })
          ) : (
            <p className="text-red-500 p-6 text-center">No chatbots found.</p>
          )}
        </div>
      )}

      {/* Modals */}

      {/* Add Credit Modal */}
      {showAddCreditModal && selectedCompanyForCredit && (
        <AddCreditModal
          companyId={selectedCompanyForCredit}
          currentCredits={companyCredits[selectedCompanyForCredit]}
          creditAmount={creditAmount}
          creditDuration={creditDuration}
          setCreditAmount={setCreditAmount}
          setCreditDuration={setCreditDuration}
          onConfirm={handleAddCredits}
          onClose={() => {
            setShowAddCreditModal(false);
            setSelectedCompanyForCredit(null);
            setCreditAmount("");
            setCreditDuration("");
          }}
          processing={processingCredit}
        />
      )}

      {/* Remove Credit Modal */}
      {showRemoveCreditModal && selectedCompanyForCredit && (
        <RemoveCreditModal
          companyId={selectedCompanyForCredit}
          currentCredits={companyCredits[selectedCompanyForCredit]}
          creditAmount={creditAmount}
          creditDuration={creditDuration}
          setCreditAmount={setCreditAmount}
          setCreditDuration={setCreditDuration}
          onConfirm={handleRemoveCredits}
          onClose={() => {
            setShowRemoveCreditModal(false);
            setSelectedCompanyForCredit(null);
            setCreditAmount("");
            setCreditDuration("");
          }}
          processing={processingCredit}
        />
      )}


      {showModal === MODAL_TYPES.PERSONA && selected && (
        <PersonaModal
          chatbot={selected}
          loading={personaLoading}
          saving={personaSaving}
          value={personaDraft}
          onChange={setPersonaDraft}
          onCopy={() => {
            navigator.clipboard.writeText(personaDraft || "");
            toast(<CustomSuccessToast text="Persona copied" />);
          }}
          onReset={resetPersonaToFetched}
          onSave={savePersona}
          onClose={closeAnyModal}
          hasChanges={personaDraft !== personaOriginal}
        />
      )}
    </div>
  );
};

// --- Child Components ---
const CustomSuccessToast = ({ text }) => (
  <div className="flex items-center gap-3">
    <div className="flex-shrink-0 w-5 h-5 bg-gray-900 rounded-full flex items-center justify-center">
      <Check size={12} className="text-white" />
    </div>
    <span className="font-semibold text-sm text-gray-800">{text}</span>
  </div>
);

const Stat = ({ label, value }) => (
  <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-md hover:shadow-lg transition-shadow duration-300">
    <p className="text-xs text-gray-500 uppercase tracking-wider">{label}</p>
    <p className="text-xl font-bold text-gray-800 mt-1">{value}</p>
  </div>
);

const PlanDetail = ({ label, value }) => (
  <div>
    <p className="text-gray-500 text-xs uppercase tracking-wider">{label}</p>
    <p className="font-medium text-gray-800 mt-0.5">{value}</p>
  </div>
);

const ActionButton = ({
  children,
  onClick,
  color = "blue",
  disabled,
  variant = "solid",
}) => {
  const solidColors = {
    blue: "bg-[#1e3a8a] hover:bg-[#1e40af] text-white shadow-md",
    cyan: "bg-teal-500 hover:bg-teal-600 text-white shadow-md",
    violet: "bg-blue-600 hover:bg-blue-700 text-white shadow-md",
    purple: "bg-[#1e3a8a] hover:bg-[#1e40af] text-white shadow-md",
  };
  const outlineClass =
    "bg-white text-gray-700 border border-gray-300 hover:bg-blue-50 hover:border-[#1e3a8a]";
  const baseClass =
    "px-4 py-2 font-semibold rounded-lg flex items-center justify-center gap-2 transition-all duration-300";
  const styleClass = variant === "outline" ? outlineClass : solidColors[color];
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`${baseClass} ${styleClass} ${disabled ? "opacity-70 cursor-not-allowed" : ""
        }`}
    >
      {children}
    </button>
  );
};

const Modal = ({ title, children, onClose }) => (
  <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
    <div className="bg-white p-6 rounded-xl w-full max-w-3xl relative shadow-2xl border border-gray-200">
      <button
        onClick={onClose}
        className="absolute top-4 right-4 text-gray-500 hover:text-[#1e3a8a] text-2xl transition-colors"
      >
        &times;
      </button>
      <h3 className="text-xl font-semibold mb-4 text-[#1e3a8a]">{title}</h3>
      {children}
    </div>
  </div>
);

const RenewModal = ({
  availablePlans,
  selectedPlan,
  setSelectedPlan,
  onConfirm,
  onClose,
}) => (
  <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
    <div className="bg-white p-6 rounded-xl w-full max-w-sm relative shadow-2xl border border-gray-200">
      <button
        onClick={onClose}
        className="absolute top-2 right-2 text-gray-500 hover:text-[#1e3a8a] text-xl transition-colors"
      >
        &times;
      </button>
      <h3 className="text-xl font-semibold mb-4 text-[#1e3a8a]">Renew Plan</h3>
      <select
        value={selectedPlan}
        onChange={(e) => setSelectedPlan(e.target.value)}
        className="w-full p-2 border border-gray-300 rounded-lg mb-4 bg-white focus:ring-2 focus:ring-[#1e3a8a] shadow-sm"
      >
        <option disabled value="">
          Select a plan
        </option>
        {availablePlans.map((plan) => (
          <option key={plan._id} value={plan._id}>
            {plan.name} – ₹{plan.price} / {plan.duration_days} days (
            {plan.max_users} users)
          </option>
        ))}
      </select>
      <button
        onClick={onConfirm}
        className="w-full bg-[#1e3a8a] text-white py-2 rounded-lg hover:bg-[#1e40af] font-semibold shadow-md transition-colors"
      >
        Confirm Renew
      </button>
    </div>
  </div>
);

// --- Persona Modal ---
const PersonaModal = ({
  chatbot,
  loading,
  saving,
  value,
  onChange,
  onCopy,
  onReset,
  onSave,
  onClose,
  hasChanges,
}) => {
  const count = value?.length ?? 0;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white p-0 rounded-xl w-full max-w-4xl relative shadow-2xl border border-gray-200 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <Brain className="text-[#1e3a8a]" />
            <h3 className="text-lg font-semibold text-[#1e3a8a]">
              Set Persona — {chatbot?.name}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-[#1e3a8a] text-2xl transition-colors"
            aria-label="Close"
          >
            &times;
          </button>
        </div>

        <div className="p-6 space-y-4">
          {loading ? (
            <div className="flex items-center gap-2 text-gray-600">
              <Loader2 className="animate-spin" />
              <span>Loading persona…</span>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-600">
                  Tip: Write clear instructions, tone, do/don't rules, and any
                  company/product knowledge that must always be respected.
                </p>
                <span className="text-xs text-gray-500">{count} chars</span>
              </div>

              <textarea
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder="Describe this chatbot's persona, tone, goals, allowed topics, and rules…"
                className="w-full h-[50vh] resize-y leading-6 p-4 rounded-lg border border-gray-300 focus:ring-2 focus:ring-[#1e3a8a] font-mono text-sm bg-white shadow-sm"
              />

              <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
                <button
                  onClick={onCopy}
                  className="px-3 py-2 rounded-lg border border-gray-300 text-gray-700 bg-white hover:bg-blue-50 hover:border-[#1e3a8a] flex items-center gap-2 transition-colors"
                >
                  <Copy size={16} /> Copy
                </button>
                <button
                  onClick={onReset}
                  disabled={!hasChanges}
                  className={`px-3 py-2 rounded-lg border flex items-center gap-2 transition-colors ${hasChanges
                    ? "border-gray-300 text-gray-700 bg-white hover:bg-blue-50 hover:border-[#1e3a8a]"
                    : "border-gray-200 text-gray-400 bg-gray-50 cursor-not-allowed"
                    }`}
                >
                  <Undo2 size={16} /> Reset
                </button>
                <button
                  onClick={onSave}
                  disabled={saving}
                  className={`px-4 py-2 rounded-lg font-semibold flex items-center gap-2 transition-colors ${saving
                    ? "bg-[#1e3a8a]/70 text-white cursor-wait"
                    : "bg-[#1e3a8a] hover:bg-[#1e40af] text-white shadow-md"
                    }`}
                >
                  {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                  {saving ? "Saving…" : "Save Persona"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

// --- Add Credit Modal ---
const AddCreditModal = ({
  companyId,
  currentCredits,
  creditAmount,
  creditDuration,
  setCreditAmount,
  setCreditDuration,
  onConfirm,
  onClose,
  processing,
}) => {
  const remaining = currentCredits?.remaining_credits || currentCredits?.remaining || 0;
  const total = currentCredits?.total_credits || currentCredits?.total || 0;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white p-6 rounded-xl w-full max-w-md relative shadow-2xl border border-gray-200">
        <button
          onClick={onClose}
          className="absolute top-2 right-2 text-gray-500 hover:text-[#1e3a8a] text-xl transition-colors"
        >
          &times;
        </button>
        <h3 className="text-xl font-semibold mb-4 text-green-600 flex items-center gap-2">
          <span>+</span> Add Credits
        </h3>
        <div className="space-y-4">
          <div className="bg-gray-50 p-3 rounded-lg">
            <p className="text-sm text-gray-600">Current Credits</p>
            <p className="text-lg font-semibold text-gray-800">
              Total: {new Intl.NumberFormat("en-IN").format(total)} | Remaining: {new Intl.NumberFormat("en-IN").format(remaining)}
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Credits to Add <span className="text-gray-500 text-xs">(optional)</span>
            </label>
            <input
              type="number"
              value={creditAmount}
              onChange={(e) => setCreditAmount(e.target.value)}
              placeholder="Enter amount (leave empty to only extend duration)"
              min="0"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Duration (Days) <span className="text-gray-500 text-xs">(optional)</span>
            </label>
            <input
              type="number"
              min="0"
              value={creditDuration}
              onChange={(e) => setCreditDuration(e.target.value)}
              placeholder="Number of days to extend expiration (leave empty to only add credits)"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
            />
          </div>
          <div className="flex gap-2 pt-2">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              disabled={processing || (!creditAmount && !creditDuration) || (parseInt(creditAmount, 10) <= 0 && parseInt(creditDuration, 10) <= 0)}
              className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {processing ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Adding...
                </>
              ) : (
                "Add Credits"
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// --- Remove Credit Modal ---
const RemoveCreditModal = ({
  companyId,
  currentCredits,
  creditAmount,
  creditDuration,
  setCreditAmount,
  setCreditDuration,
  onConfirm,
  onClose,
  processing,
}) => {
  const remaining = currentCredits?.remaining_credits || currentCredits?.remaining || 0;
  const total = currentCredits?.total_credits || currentCredits?.total || 0;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white p-6 rounded-xl w-full max-w-md relative shadow-2xl border border-gray-200">
        <button
          onClick={onClose}
          className="absolute top-2 right-2 text-gray-500 hover:text-[#1e3a8a] text-xl transition-colors"
        >
          &times;
        </button>
        <h3 className="text-xl font-semibold mb-4 text-red-600 flex items-center gap-2">
          <span>−</span> Remove Credits
        </h3>
        <div className="space-y-4">
          <div className="bg-red-50 p-3 rounded-lg border border-red-200">
            <p className="text-sm text-gray-600">Current Credits</p>
            <p className="text-lg font-semibold text-gray-800">
              Total: {new Intl.NumberFormat("en-IN").format(total)} | Remaining: {new Intl.NumberFormat("en-IN").format(remaining)}
            </p>
            {remaining > 0 && (
              <p className="text-xs text-red-600 mt-1">
                You can remove up to {new Intl.NumberFormat("en-IN").format(remaining)} credits
              </p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Credits to Remove <span className="text-gray-500 text-xs">(optional)</span>
            </label>
            <input
              type="number"
              value={creditAmount}
              onChange={(e) => setCreditAmount(e.target.value)}
              placeholder="Enter amount (leave empty to only reduce duration)"
              min="0"
              max={remaining}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Reduce Duration (Days) <span className="text-gray-500 text-xs">(optional)</span>
            </label>
            <input
              type="number"
              min="0"
              value={creditDuration}
              onChange={(e) => setCreditDuration(e.target.value)}
              placeholder="Number of days to reduce from expiration (leave empty to only remove credits)"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
            />
          </div>
          <div className="flex gap-2 pt-2">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              disabled={processing || (!creditAmount && !creditDuration) || (parseInt(creditAmount, 10) <= 0 && parseInt(creditDuration, 10) <= 0) || (creditAmount && parseInt(creditAmount, 10) > remaining)}
              className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {processing ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Removing...
                </>
              ) : (
                "Remove Credits"
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ManageChatbotsPage;
