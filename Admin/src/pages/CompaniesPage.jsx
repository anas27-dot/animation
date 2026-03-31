// src/pages/CompaniesPage.js

import { useState, useEffect } from "react";
import api from "../services/api";
import CompanyTable from "../components/CompanyTable";
import AddCompanyModal from "../components/AddCompanyModal";
import CompanyModal from "../components/CompanyModal"; // The "Edit" modal
import EmailTemplateModal from "../components/EmailTemplateModal";
import { Search, Plus, FileText } from "lucide-react";

const CompaniesPage = () => {
  const [companies, setCompanies] = useState([]);
  const [search, setSearch] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [editingCompany, setEditingCompany] = useState(null);
  const defaultTemplate = {
    subject: "Your company account is ready: {Company Name}",
    body: `<p>Hi {User Name},</p>
<p>Your company account has been created successfully.</p>
<p><strong>Company details:</strong><br/>
- Company Name: {Company Name}<br/>
- Domain: {Domain}<br/>
- Email (login): {Email}<br/>
- Username: {User Name}<br/>
- Phone: {Phone No}</p>
<p><strong>Account security:</strong><br/>
- Temporary Password: {Password}<br/>
- Please sign in and change your password right away.</p>
<p><strong>Next steps:</strong><br/>
- Sign in at: {Login URL or portal link}<br/>
- Support: {Support Email or Phone}</p>
<p>Thanks,<br/>{Your Team/Brand}</p>`,
  };
  const [emailTemplate, setEmailTemplate] = useState(defaultTemplate);
  // Load saved template once
  useEffect(() => {
    const saved = localStorage.getItem("companyEmailTemplate");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.subject && parsed.body) {
          setEmailTemplate(parsed);
        }
      } catch {
        // ignore parse errors and fallback to default
      }
    }
  }, []);

  // Persist template when it changes
  useEffect(() => {
    if (emailTemplate?.subject && emailTemplate?.body) {
      localStorage.setItem("companyEmailTemplate", JSON.stringify(emailTemplate));
    }
  }, [emailTemplate]);

  const fetchCompanies = async () => {
    // This ensures the skeleton shows on manual refresh, not just initial load
    if (!loading) setLoading(true);

    try {
      // API interceptor will handle authentication automatically
      const res = await api.get("/company/all");
      
      // Backend returns: { success: true, data: [...] }
      // Handle both response structures
      const companiesData = res.data?.data || res.data?.companies || res.data || [];
      setCompanies(Array.isArray(companiesData) ? companiesData : []);
      
      console.log("Companies fetched:", companiesData);
    } catch (err) {
      console.error("Failed to fetch companies:", err);
      console.error("Error details:", err.response?.data);
      setCompanies([]); // Set empty array on error
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Fetch companies on component mount
    fetchCompanies();
  }, []);

  const filtered = companies.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  // 5. The main page no longer needs a separate loading spinner.
  // The skeleton loader inside CompanyTable will handle the loading UI.

  return (
    <>
      <div className="p-4 md:p-6">
        {/* --- ADDED: Enhanced Page Header --- */}
        <header className="flex flex-col sm:flex-row justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-[#1e3a8a] self-start sm:self-center">
            Manage Companies
          </h1>
          <div className="flex items-center gap-3 sm:gap-4 mt-4 sm:mt-0 w-full sm:w-auto flex-wrap justify-end">
            <div className="relative w-full sm:w-64">
              <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                size={18}
              />
              <input
                type="text"
                placeholder="Search companies..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1e3a8a] shadow-sm"
              />
            </div>
            <button
              onClick={() => setShowTemplateModal(true)}
              className="flex items-center justify-center gap-2 w-full sm:w-auto px-4 py-2 border border-[#1e3a8a] text-[#1e3a8a] font-semibold rounded-lg bg-white hover:bg-blue-50 transition-colors shadow-sm"
            >
              <FileText size={18} />
              Email Template
            </button>
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center justify-center gap-2 w-full sm:w-auto px-4 py-2 bg-[#1e3a8a] text-white font-semibold rounded-lg hover:bg-[#1e40af] transition-colors shadow-md"
            >
              <Plus size={18} />
              Add Company
            </button>
          </div>
        </header>
        {/* --- END: Enhanced Page Header --- */}

        <CompanyTable
          companies={filtered}
          refresh={fetchCompanies}
          onEditCompany={setEditingCompany}
          loading={loading} // 👈 6. Pass loading prop to activate the skeleton
        />
      </div>

      {/* Modals remain at the top level for proper stacking */}
      {showAddModal && (
        <AddCompanyModal
          onClose={() => setShowAddModal(false)}
          onSuccess={fetchCompanies}
          emailTemplate={emailTemplate}
        />
      )}

      {showTemplateModal && (
        <EmailTemplateModal
          onClose={() => setShowTemplateModal(false)}
          template={emailTemplate}
          onSave={(tpl) => {
            setEmailTemplate(tpl);
            setShowTemplateModal(false);
          }}
          onReset={() => setEmailTemplate(defaultTemplate)}
        />
      )}

      {editingCompany && (
        <CompanyModal
          company={editingCompany}
          onClose={() => setEditingCompany(null)}
          refresh={fetchCompanies}
        />
      )}
    </>
  );
};

export default CompaniesPage;