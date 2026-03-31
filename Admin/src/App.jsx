import React from "react";
// MODIFIED: Removed BrowserRouter as Router, as it's provided by a parent file
import { Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import LoginPage from "./pages/LoginPage";
import DashboardLayout from "./pages/DashboardLayout";
import OverviewPage from "./pages/OverviewPage";
import CompaniesPage from "./pages/CompaniesPage";
import ChatbotPage from "./pages/ChatbotPage";
import ManageAdminsPage from "./pages/ManageAdminsPage";
import ManageUsersPage from "./pages/ManageUsersPage";
import UserDashboard from "./pages/UserDashboard";
import ProtectedRoute from "./components/ProtectedRoute";
import { ToastContainer } from "react-toastify";
import MessageHistoryPage from "./pages/MessageHistoryPage";
import DownloadDataPage from "./pages/DownloadDataPage";
import DownloadReportPage from "./pages/DownloadReportPage";
import EnquiriesPage from "./pages/EnquiresPage";
import ClientConfigPage from "./pages/ClientConfigPage";
import LeadsPage from "./pages/LeadsPage";
import CollectedLeadsPage from "./pages/CollectedLeadsPage";
import AnalyticsPage from "./pages/AnalyticsPage";
import ApiTest from "./components/ApiTest";
import "./App.css";
import CustomizePage from "./pages/CustomizePage";
import ManageChatbotUIPage from "./pages/ManageChatbotUIPage";
import ManageSidebarPage from "./pages/ManageSidebarPage";
import AccountDeactivatedPage from "./pages/AccountDeactivatedPage";
import DailyEmailPage from "./pages/DailyEmailPage";
import ClientOffersPage from "./pages/ClientOffersPage";
import CreditHistoryPage from "./pages/CreditHistoryPage";
import UserCreditHistoryPage from "./pages/UserCreditHistoryPage";

function App() {
  // REMOVED: The <Router> component was removed from here.
  // The AuthProvider is now the top-level component in this file.
  return (
    <AuthProvider>
      <ToastContainer position="top-center" autoClose={3000} />
      <Routes>
        <Route path="/" element={<LoginPage />} />
        <Route path="/api-test" element={<ApiTest />} />
        <Route path="/account-deactivated" element={<AccountDeactivatedPage />} />

        {/* Admin routes */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute role="admin">
              <DashboardLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="overview" replace />} />
          <Route path="overview" element={<OverviewPage />} />
          <Route path="companies" element={<CompaniesPage />} />
          <Route path="chatbots" element={<ChatbotPage />} />
          <Route path="users" element={<ManageUsersPage />} />
          <Route path="config" element={<ClientConfigPage />} />
          <Route path="manage-chatbot-ui" element={<ManageChatbotUIPage />} />
          <Route path="client-offers" element={<ClientOffersPage />} />
          <Route path="credit-history" element={<CreditHistoryPage />} />
          <Route path="manage-sidebar" element={<ManageSidebarPage />} />
          <Route path="daily-email" element={<DailyEmailPage />} />
          <Route
            path="manage-admins"
            element={
              <ProtectedRoute role="admin" superAdminOnly={true}>
                <ManageAdminsPage />
              </ProtectedRoute>
            }
          />
          <Route path="customize/:chatbotId" element={<CustomizePage />} />
        </Route>

        {/* User routes */}
        <Route
          path="/user/dashboard"
          element={
            <ProtectedRoute role="user">
              <UserDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/user/message-history"
          element={
            <ProtectedRoute role="user">
              <MessageHistoryPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/user/download-data"
          element={
            <ProtectedRoute role="user">
              <DownloadDataPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/user/download-report"
          element={
            <ProtectedRoute role="user">
              <DownloadReportPage />
            </ProtectedRoute>
          }
        />
        {/* <Route
          path="/user/leads"
          element={
            <ProtectedRoute role="user">
              <LeadsPage />
            </ProtectedRoute>
          }
        /> */}
        <Route
          path="/user/collected-leads"
          element={
            <ProtectedRoute role="user">
              <CollectedLeadsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/user/enquiries/:chatbotId"
          element={
            <ProtectedRoute role="user">
              <EnquiriesPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/user/analytics"
          element={
            <ProtectedRoute role="user">
              <AnalyticsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/user/credit-history"
          element={
            <ProtectedRoute role="user">
              <UserCreditHistoryPage />
            </ProtectedRoute>
          }
        />

        {/* Catch-all route - must be last */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  );
}

export default App;
