const cors = require('cors');
const Chatbot = require('../models/Chatbot');
const logger = require('../config/logging');

// 1. ADD YOUR LIVE DOMAINS HERE MANUALLY
// This ensures they work even if chatbotId is missing in GET requests
const HARDCODED_ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:3000',
  'https://zscricket.0804.in',
  'http://localhost:3002',
  'http://localhost:5174',
  'https://chat-api-v4.0804.in', // API domain
  // UI / Admin / User dashboards
  'https://troika-agent.0804.in',
  'https://omniagent.0804.in',
  'https://admin-omniagent.0804.in',
  'https://omni-dashboard.0804.in',
  'https://omniagentadmin.onrender.com',
  'https://omniagentui.onrender.com',
  'https://nexxgen.0804.in',
  'https://yourswellness.0804.in',
  'https://kishorrane.0804.in',
];

// Global allowed origins from env
const ENV_ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

// Combine them
const GLOBAL_ALLOWED_ORIGINS = [...new Set([...HARDCODED_ALLOWED_ORIGINS, ...ENV_ALLOWED_ORIGINS])];

/** Prefer originalUrl — req.path can be wrong after static/rewrite middleware on some hosts. */
function getRequestPath(req) {
  const raw = (req.originalUrl || req.url || req.path || '').toString();
  return raw.split('?')[0] || '';
}

/** Hosted OmniAgent dashboards on Render (always allow for API + CORS). */
function isOmniAgentRenderOrigin(cleanOrigin) {
  if (!cleanOrigin) return false;
  return /^https:\/\/(omniagentadmin|omniagentui)\.onrender\.com$/i.test(cleanOrigin);
}

function normalizeOrigin(origin) {
  if (!origin || typeof origin !== 'string') return null;
  const trimmed = origin.trim().replace(/\/$/, '').toLowerCase();
  // If value is a full URL with path (e.g. from Referer), use scheme + host only
  try {
    const u = new URL(trimmed);
    return `${u.protocol}//${u.host}`;
  } catch {
    return trimmed;
  }
}

// Helper to extract MongoDB ID from URL path
function extractChatbotIdFromPath(path) {
  if (!path) return null;
  // Look for 24-character hex string (MongoDB ID) in the path
  // Matches /api/chatbot/6969bc08018294f83e410083/config or /api/proposal/6969bc08018294f83e410083
  const match = path.match(/\/([0-9a-fA-F]{24})(\/|$)/);
  return match ? match[1] : null;
}

/** Routes that use dashboardCors — skip chatbot-domain gate so /api/admin/login never needs chatbotId. */
function isDashboardApiPath(p) {
  if (!p || typeof p !== 'string') return false;
  const prefixes = [
    '/api/admin',
    '/api/user',
    '/api/companies',
    '/api/company',
    '/api/customizations',
    '/api/context',
    '/api/subscriptions',
    '/api/plans',
    '/api/suggestions',
  ];
  return prefixes.some((prefix) => p === prefix || p.startsWith(`${prefix}/`));
}

async function dynamicCors(req, res, next) {
  try {
    const pathOnly = getRequestPath(req);

    // Dashboard routes use dashboardCors on the router — never apply chatbot whitelist here.
    if (isDashboardApiPath(pathOnly)) {
      return next();
    }

    const origin = req.headers.origin || req.headers.referer;

    // If no origin (server-to-server, Postman, curl), pass through
    if (!origin) return next();

    const cleanOrigin = normalizeOrigin(origin);

    // Safety check: if origin parsing failed
    if (!cleanOrigin) {
      if (pathOnly === '/' || pathOnly === '/health') return next();
      logger.warn(`[CORS] Blocked invalid origin: ${origin}`);
      return res.status(403).json({ error: 'CORS Policy: Invalid origin' });
    }

    // Local dev: any localhost / 127.0.0.1 port (Vite picks 5173, 5174, 5175, …)
    if (
      process.env.NODE_ENV !== 'production' &&
      /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(cleanOrigin)
    ) {
      return cors({ origin: true, credentials: true })(req, res, next);
    }

    // Try to find chatbotId in Query, Body, Headers, or Path
    const chatbotId = req.query.chatbotId ||
      (req.body && typeof req.body === 'object' ? req.body.chatbotId : null) ||
      req.headers['x-chatbot-id'] ||
      extractChatbotIdFromPath(pathOnly);

    // 1. Start with Global Whitelist
    let allowedOrigins = [...GLOBAL_ALLOWED_ORIGINS];

    // 2. If Chatbot ID is present, fetch specific allowed domains
    if (chatbotId) {
      try {
        const chatbot = await Chatbot.findById(chatbotId).select('settings.allowedDomains');
        if (chatbot?.settings?.allowedDomains?.length) {
          const chatbotDomains = [];
          chatbot.settings.allowedDomains.forEach(d => {
            if (d.startsWith('http')) {
              chatbotDomains.push(normalizeOrigin(d));
            } else {
              // If no protocol specified, allow both http and https (useful for dev/localhost)
              chatbotDomains.push(normalizeOrigin(`https://${d}`));
              chatbotDomains.push(normalizeOrigin(`http://${d}`));
            }
          });
          allowedOrigins = [...allowedOrigins, ...chatbotDomains.filter(Boolean)];
        }
      } catch (err) {
        logger.error(`[CORS] Lookup error for chatbot ${chatbotId}:`, err.message);
        // Continue with global list if DB fails
      }
    }

    // 3. Check for Match
    const uniqueAllowed = [...new Set(allowedOrigins.map(normalizeOrigin))];

    const isAllowed = uniqueAllowed.some((allowed) => {
      if (!allowed) return false;
      return cleanOrigin === allowed;
    });

    if (isAllowed) {
      return cors({ origin: true, credentials: true })(req, res, next);
    }

    if (isOmniAgentRenderOrigin(cleanOrigin)) {
      return cors({ origin: true, credentials: true })(req, res, next);
    }

    // 4. DEVELOPMENT MODE FALLBACK
    // If we are in dev mode and it's an OPTIONS request, or no origins are configured, allow all
    if (process.env.NODE_ENV !== 'production' && (req.method === 'OPTIONS' || uniqueAllowed.length === 0)) {
      return cors({ origin: true, credentials: true })(req, res, next);
    }

    // 5. ALLOW OPTIONS PREFLIGHT (Production Fix)
    // Browser sends OPTIONS without body/chatbotId. Allow it so the actual request can proceed.
    if (req.method === 'OPTIONS') {
      return cors({ origin: true, credentials: true })(req, res, next);
    }

    // BLOCK
    logger.warn(`🚫 [CORS] Blocked ${req.method} ${pathOnly} from: ${cleanOrigin}. ChatbotId: ${chatbotId || 'N/A'}`);
    if (chatbotId) {
      logger.warn(`📜 [CORS] Allowed for chatbot ${chatbotId}: ${JSON.stringify(uniqueAllowed)}`);
    }

    // Add CORS headers even on 403 so the browser console can display the error detail
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');

    return res.status(403).json({
      error: 'CORS Policy: Origin not allowed',
      detail: `The origin '${cleanOrigin}' is not whitelisted for Chatbot ID '${chatbotId || 'N/A'}'.`,
      path: pathOnly,
      method: req.method,
      suggestion: 'Add this domain to the Allowed Domains in the Admin Dashboard.'
    });
  } catch (error) {
    const chatbotId = req.query?.chatbotId || req.body?.chatbotId || req.headers?.['x-chatbot-id'] || extractChatbotIdFromPath(getRequestPath(req));
    logger.error(`[CORS] Critical Middleware Failure: ${error.message}`, {
      stack: error.stack,
      url: req.url,
      method: req.method,
      chatbotId
    });
    return res.status(500).json({
      error: 'Internal Server Error (CORS)',
      message: error.message
    });
  }
}

module.exports = dynamicCors;
