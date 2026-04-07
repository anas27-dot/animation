// During `npm run dev`, use local backend. Production build uses hosted API.
// To hit the live API from dev: set VITE_USE_LIVE_API=true in .env.local
export const useLive =
  import.meta.env.VITE_USE_LIVE_API === "true" ||
  (import.meta.env.PROD && import.meta.env.VITE_USE_LIVE_API !== "false");

// Configuration for backend URLs
// On Render: set VITE_API_BASE_URL to your API root including /api, e.g. https://your-api.onrender.com/api
const liveUrlEnv = import.meta.env.VITE_API_BASE_URL?.trim();
export const config = {
  liveUrl: (liveUrlEnv || "https://chat-api-v4.0804.in/api").replace(/\/$/, ""),
  localUrl: "http://localhost:5000/api",
};

// Export the active base URL based on the toggle
export const API_BASE_URL = useLive ? config.liveUrl : config.localUrl;
