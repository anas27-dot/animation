import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import ClipLoader from "react-spinners/ClipLoader";

/**
 * A component to protect routes based on user authentication and roles.
 * It handles loading states, role-based access, and super admin checks.
 *
 * @param {object} props
 * @param {React.ReactNode} props.children - The component to render if authorized.
 * @param {string} props.role - The required role ('admin' or 'user').
 * @param {boolean} [props.superAdminOnly=false] - If true, only allows users with the isSuperAdmin flag.
 */
const ProtectedRoute = ({ children, role: requiredRole, superAdminOnly = false }) => {
  // Use the AuthContext to get the current authentication state.
  // This is more reliable than reading directly from localStorage.
  const { user, token, role: userRole } = useAuth();
  const location = useLocation();

  // 1. Handle the initial loading state.
  // When the app first loads, the AuthContext needs a moment to check localStorage.
  // During this time, 'user' will be null. We show a loader to prevent a flicker.
  if (user === null) {
    return (
      <div className="flex justify-center items-center h-screen">
        <ClipLoader size={50} color={"#1E40AF"} />
      </div>
    );
  }

  // 2. Check if the user is logged in.
  // If there's no token or user object, they are not authenticated.
  if (!token || !user) {
    // Redirect to the login page. We save the location they were trying to access
    // so we can send them back there after they log in.
    return <Navigate to="/" state={{ from: location }} replace />;
  }

  // 3. Check if the user has the required role.
  if (requiredRole && userRole !== requiredRole) {
    // If their role doesn't match, send them to the login page.
    return <Navigate to="/" replace />;
  }

  // 4. If this is a super admin route, perform an additional check.
  if (superAdminOnly && !user.isSuperAdmin) {
    // If they are an admin but not a SUPER admin, redirect them to a safe default page.
    // This prevents regular admins from seeing the "Manage Admins" page.
    return <Navigate to="/dashboard/overview" replace />;
  }

  // 5. If all checks pass, render the child component.
  return children;
};

export default ProtectedRoute;
