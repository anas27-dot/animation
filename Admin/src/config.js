// During `npm run dev`, use local backend. Production build uses hosted API.
// To hit the live API from dev: set VITE_USE_LIVE_API=true in .env.local
export const useLive =
  import.meta.env.VITE_USE_LIVE_API === "true" ||
  (import.meta.env.PROD && import.meta.env.VITE_USE_LIVE_API !== "false");

// Configuration for backend URLs
export const config = {
    liveUrl: "https://chat-api-v4.0804.in/api",
    localUrl: "http://localhost:5000/api",
};

// Export the active base URL based on the toggle
export const API_BASE_URL = useLive ? config.liveUrl : config.localUrl;
