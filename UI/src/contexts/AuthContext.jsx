import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import config from '../config';

const AuthContext = createContext(null);

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};

// Storage keys
const AUTH_STORAGE_KEY = 'chatbot_auth';
const PHONE_STORAGE_KEY = 'chatbot_user_phone';

// Token expiry constants
const DEFAULT_TOKEN_EXPIRY_HOURS = 24;

export const AuthProvider = ({ children, apiBase, chatbotId }) => {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [authToken, setAuthToken] = useState(null);
    const [userInfo, setUserInfo] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [resendCooldown, setResendCooldown] = useState(0);
    const [isInitialized, setIsInitialized] = useState(false);

    // Check for existing authentication on mount
    useEffect(() => {
        checkExistingAuth();
    }, []);

    const checkExistingAuth = useCallback(async () => {
        try {
            // Check sessionStorage first (primary), then localStorage (backup)
            let savedAuth = sessionStorage.getItem(AUTH_STORAGE_KEY);
            if (!savedAuth) {
                savedAuth = localStorage.getItem(AUTH_STORAGE_KEY);
                if (savedAuth) {
                    sessionStorage.setItem(AUTH_STORAGE_KEY, savedAuth);
                }
            }

            if (!savedAuth) {
                setIsAuthenticated(false);
                setLoading(false);
                setIsInitialized(true);
                return;
            }

            const authData = JSON.parse(savedAuth);
            const now = Date.now();

            console.log('🔍 [AUTH] Checking existing auth:', {
                hasToken: !!authData.token,
                hasExpiresAt: !!authData.expiresAt
            });

            // Calculate expiresAt if missing
            let expiresAt = authData.expiresAt;
            if (!expiresAt && authData.issuedAt) {
                expiresAt = authData.issuedAt + (24 * 60 * 60 * 1000);
                authData.expiresAt = expiresAt;
                sessionStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(authData));
                localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(authData));
            } else if (!expiresAt) {
                expiresAt = now + (24 * 60 * 60 * 1000);
                authData.issuedAt = now;
                authData.expiresAt = expiresAt;
                sessionStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(authData));
                localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(authData));
            }

            const isExpired = now >= expiresAt;

            if (isExpired) {
                console.warn('⏰ [AUTH] Token expired, clearing auth data');
                clearAuthData();
                setLoading(false);
                setIsInitialized(true);
                return;
            }

            // Token valid
            setAuthToken(authData.token);
            setUserInfo(authData.userInfo);
            setIsAuthenticated(true);
            sessionStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(authData));
        } catch (error) {
            console.error('❌ [AUTH] Error checking existing auth:', error);
            clearAuthData();
        } finally {
            setLoading(false);
            setIsInitialized(true);
        }
    }, [apiBase]);

    // Clear authentication data
    const clearAuthData = useCallback(() => {
        try {
            sessionStorage.removeItem(AUTH_STORAGE_KEY);
            localStorage.removeItem(AUTH_STORAGE_KEY);
            localStorage.removeItem(PHONE_STORAGE_KEY);
        } catch (error) {
            console.error('❌ [AUTH] Error clearing storage:', error);
        }
        setAuthToken(null);
        setUserInfo(null);
        setIsAuthenticated(false);
        setError(null);
    }, []);

    // Resend cooldown timer
    useEffect(() => {
        if (resendCooldown > 0) {
            const timer = setTimeout(() => {
                setResendCooldown(prev => prev - 1);
            }, 1000);
            return () => clearTimeout(timer);
        }
    }, [resendCooldown]);

    // Send OTP
    const sendOtp = useCallback(async (phone) => {
        try {
            setLoading(true);
            setError(null);

            const endpoint = `${apiBase}/whatsapp-otp/send`;
            const requestBody = {
                phone,
                chatbotId: config.chatbotId
            };

            console.log('📤 [AUTH] Sending OTP to:', phone);

            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-chatbot-id': config.chatbotId
                },
                body: JSON.stringify(requestBody)
            });

            const data = await response.json();

            // Handle rate limit (429) response
            if (response.status === 429) {
                let cooldownSeconds = 60;
                if (data.cooldownSeconds) {
                    cooldownSeconds = data.cooldownSeconds;
                } else if (data.resetTime) {
                    if (data.resetTime > Date.now()) {
                        cooldownSeconds = Math.ceil((data.resetTime - Date.now()) / 1000);
                    }
                }

                cooldownSeconds = Math.max(1, Math.min(300, cooldownSeconds));
                setResendCooldown(cooldownSeconds);

                const rateLimitError = new Error(data.message || 'Rate limit exceeded. Please wait before trying again.');
                rateLimitError.rateLimitData = {
                    attemptsRemaining: data.attemptsRemaining || 0,
                    resetTime: data.resetTime,
                    cooldownSeconds: cooldownSeconds,
                    message: data.message
                };
                throw rateLimitError;
            }

            if (!response.ok) {
                throw new Error(data.message || 'Failed to send OTP');
            }

            console.log('✅ [AUTH] OTP sent successfully');
            setResendCooldown(60);

            return data;
        } catch (error) {
            console.error('❌ [AUTH] Error sending OTP:', error);
            setError(error.message);
            throw error;
        } finally {
            setLoading(false);
        }
    }, [apiBase]);

    // Verify OTP — "The Switch": discard guest identity, use fresh auth session, then re-fetch by phone
    const verifyOtp = useCallback(async (argsOrOtp, phoneArg, nameArg) => {
        let otp, phone, name;
        if (typeof argsOrOtp === 'object' && argsOrOtp !== null) {
            ({ otp, phone, name } = argsOrOtp);
        } else {
            otp = argsOrOtp;
            phone = phoneArg;
            name = nameArg;
        }

        try {
            setLoading(true);
            setError(null);

            const endpoint = `${apiBase}/whatsapp-otp/verify`;

            // 1. 🚨 DISCARD GUEST IDENTITY: Generate a fresh authenticated Session ID (do not send old one for migration)
            const newSessionId = `auth_sess_${phone}_${Date.now()}`;

            const requestBody = {
                phone,
                otp,
                chatbotId: config.chatbotId,
                sessionId: newSessionId,
                name: name
            };

            const response = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || errorData.error || 'Invalid OTP');
            }

            const data = await response.json();
            if (!data.token || typeof data.token !== 'string') {
                throw new Error('Invalid token received from server');
            }

            const now = Date.now();
            const issuedAt = data.issuedAt || now;
            const expiresIn = data.expiresIn || (DEFAULT_TOKEN_EXPIRY_HOURS * 3600);
            const expiresAt = data.expiresAt || (now + (expiresIn * 1000));

            // 2. Clear LocalStorage of any Guest leftovers and set the new session ID
            localStorage.removeItem('chat_session_id');
            sessionStorage.removeItem('chat_session_id');
            localStorage.setItem('chat_session_id', newSessionId);
            sessionStorage.setItem('chat_session_id', newSessionId);

            const authData = {
                token: data.token.trim(),
                userInfo: data.userInfo ? { ...data.userInfo, phone, name } : { phone, name },
                issuedAt,
                expiresAt,
                createdAt: now,
                sessionId: newSessionId
            };

            sessionStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(authData));
            localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(authData));
            if (phone) localStorage.setItem(PHONE_STORAGE_KEY, String(phone));

            setAuthToken(data.token);
            setUserInfo(authData.userInfo);
            setIsAuthenticated(true);

            // 3. 🔄 FORCE RE-FETCH: Reload so the app pulls only messages for THIS phone (no guest history)
            window.location.reload();
            return data;
        } catch (error) {
            console.error('❌ [AUTH] Error verifying OTP:', error);
            setError(error.message);
            throw error;
        } finally {
            setLoading(false);
        }
    }, [apiBase]);

    // Update user info
    const updateUserInfo = useCallback((newInfo) => {
        console.log('📝 [AUTH] Updating user info:', newInfo);
        setUserInfo(prev => ({ ...prev, ...newInfo }));

        // Also update in storage
        try {
            let savedAuth = sessionStorage.getItem(AUTH_STORAGE_KEY);
            if (!savedAuth) {
                savedAuth = localStorage.getItem(AUTH_STORAGE_KEY);
            }
            if (savedAuth) {
                const authData = JSON.parse(savedAuth);
                authData.userInfo = { ...authData.userInfo, ...newInfo };
                sessionStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(authData));
                localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(authData));
            }
        } catch (error) {
            console.error('❌ [AUTH] Error updating user info in storage:', error);
        }
    }, []);

    // Resend OTP
    const resendOtp = useCallback(async (phone) => {
        if (resendCooldown > 0) {
            return;
        }

        try {
            await sendOtp(phone);
        } catch (error) {
            console.error('❌ [AUTH] Error resending OTP:', error);
        }
    }, [sendOtp, resendCooldown]);

    // Logout — Full reset so next person gets a fresh guest session
    const logout = useCallback(() => {
        console.log('🚪 [AUTH] Full Reset Logout');

        // 1. Clear State
        setAuthToken(null);
        setUserInfo(null);
        setIsAuthenticated(false);

        // 2. Clear Auth Tokens
        sessionStorage.removeItem(AUTH_STORAGE_KEY);
        localStorage.removeItem(AUTH_STORAGE_KEY);
        localStorage.removeItem(PHONE_STORAGE_KEY);

        // 3. 🚨 THE CRITICAL STEP: Clear the Session ID
        // This ensures the next person gets a BRAND NEW guest session
        localStorage.removeItem('chat_session_id');
        sessionStorage.removeItem('chat_session_id');

        // 4. Hard Reload to reset the app state and generate a new ephemeral session
        window.location.reload();
    }, []);

    // Check session validity periodically
    useEffect(() => {
        if (!isAuthenticated) return;

        const checkSessionValidity = () => {
            try {
                let savedAuth = sessionStorage.getItem(AUTH_STORAGE_KEY);
                if (!savedAuth) {
                    savedAuth = localStorage.getItem(AUTH_STORAGE_KEY);
                }
                if (!savedAuth) {
                    console.warn('⏰ [AUTH] No auth data found, logging out');
                    logout();
                    return;
                }

                const authData = JSON.parse(savedAuth);
                const now = Date.now();

                if (authData.expiresAt && now >= authData.expiresAt) {
                    console.warn('⏰ [AUTH] Token expired, auto-logout');
                    logout();
                    return;
                }
            } catch (error) {
                console.error('❌ [AUTH] Error checking session validity:', error);
                logout();
            }
        };

        checkSessionValidity();
        const interval = setInterval(checkSessionValidity, 30000);

        return () => clearInterval(interval);
    }, [isAuthenticated, logout]);

    const value = {
        isAuthenticated,
        authToken,
        userInfo,
        loading,
        error,
        resendCooldown,
        isInitialized,
        sendOtp,
        verifyOtp,
        logout,
        updateUserInfo,
        resendOtp,
        clearError: () => setError(null)
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};
