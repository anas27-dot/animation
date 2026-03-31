import React, { createContext, useContext, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

// Create the context
const AuthContext = createContext(null);

// Create the provider component
export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [role, setRole] = useState(null);
  const navigate = useNavigate();

  // Utility function to clear all auth data
  const clearAuthData = () => {
    console.log("Clearing all auth data");
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    localStorage.removeItem("role");
    setToken(null);
    setUser(null);
    setRole(null);
  };

  // On initial app load, check localStorage for existing session
  useEffect(() => {
    console.log("AuthContext: Checking localStorage for existing session");
    
    const storedToken = localStorage.getItem("token");
    const storedUser = localStorage.getItem("user");
    const storedRole = localStorage.getItem("role");

    console.log("Stored values:", { storedToken, storedUser, storedRole });

    // Check if all values exist and are not "undefined" string
    if (storedToken && storedUser && storedRole && 
        storedUser !== "undefined" && storedUser !== "null" &&
        storedToken !== "undefined" && storedToken !== "null" &&
        storedRole !== "undefined" && storedRole !== "null") {
      try {
        console.log("Valid auth data found, setting state");
        setToken(storedToken);
        setUser(JSON.parse(storedUser));
        setRole(storedRole);
        console.log("Auth state restored successfully");
      } catch (error) {
        console.error("Error parsing stored user data:", error);
        // Clear invalid data from localStorage
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        localStorage.removeItem("role");
        console.log("Cleared invalid localStorage data");
      }
    } else {
      console.log("No valid auth data found in localStorage");
      // Clear any invalid data if we have partial data
      if (storedUser === "undefined" || storedUser === "null" ||
          storedToken === "undefined" || storedToken === "null" ||
          storedRole === "undefined" || storedRole === "null") {
        console.log("Clearing corrupted localStorage data");
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        localStorage.removeItem("role");
      }
    }
  }, []);

  // Login function
  const login = (authData) => {
    console.log("Login function called with authData:", authData);
    
    // Validate authData
    if (!authData) {
      console.error("No authData provided to login function");
      return;
    }

    // Handle API response structure - data might be nested in 'data' property
    let userData = authData;
    if (authData.data && typeof authData.data === 'object') {
      userData = authData.data;
      console.log("Using nested data from API response:", userData);
    }

    const { token, role, user } = userData;

    // Validate required fields
    if (!token || !role || !user) {
      console.error("Missing required fields in authData:", { token, role, user });
      console.error("Available fields in userData:", Object.keys(userData));
      return;
    }

    console.log("Setting auth state with:", { token, role, user });

    // Set state
    setToken(token);
    setRole(role);
    setUser(user);

    // Set localStorage
    localStorage.setItem("token", token);
    localStorage.setItem("role", role);
    localStorage.setItem("user", JSON.stringify(user));

    console.log("Auth data saved to localStorage");

    // Navigate to the correct dashboard
    if (role === "admin") {
      console.log("Navigating to admin dashboard");
      navigate("/dashboard/overview");
    } else {
      console.log("Navigating to user dashboard");
      navigate("/user/dashboard");
    }
  };

  // Logout function
  const logout = () => {
    console.log("Logging out user");
    clearAuthData();
    navigate("/");
  };

  // Check if user is authenticated
  const isAuthenticated = () => {
    return !!(token && user && role);
  };

  // The value provided to consuming components
  const value = {
    user,
    token,
    role,
    login,
    logout,
    isAuthenticated,
    clearAuthData,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// Create a custom hook to use the auth context easily
export const useAuth = () => {
  return useContext(AuthContext);
};
