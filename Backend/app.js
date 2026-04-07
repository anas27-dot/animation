/**
 * AI Chat Agent Backend - Express Application
 * 
 * Complete B2B AI Chat Platform with:
 * - Multi-LLM Support (OpenAI, Claude, Grok)
 * - RAG Pipeline with Vector Search
 * - SSE Streaming
 * - OTP Authentication
 * - Lead Capture & CRM Integration
 * - Human Handoff
 */

const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');
const logger = require('./config/logging');
const chatRoutes = require('./routes/chatRoutes');
const chatbotRoutes = require('./routes/chatbotRoutes');
const leadCaptureRoutes = require('./routes/leadCaptureRoutes');
const intelligentChatRoutes = require('./routes/intelligentChatRoutes');
const translateRoutes = require('./routes/translateRoutes');
const ttsRoutes = require('./routes/ttsRoutes');
const authRoutes = require('./routes/authRoutes');
const intentRoutes = require('./routes/intentRoutes');
const handoffRoutes = require('./routes/handoffRoutes');
const transcriptRoutes = require('./routes/transcriptRoutes');
const zohoRoutes = require('./routes/zohoRoutes');
const adminRoutes = require('./routes/adminRoutes');
const userRoutes = require('./routes/userRoutes');
const companyRoutes = require('./routes/companyRoutes');
const customizationRoutes = require('./routes/customizationRoutes');
const contextRoutes = require('./routes/contextRoutes');
const offerRoutes = require('./routes/offerRoutes');
const translationRoutes = require('./routes/translationRoutes');
const whatsAppOtpRoutes = require('./routes/whatsAppOtp');
const proposalRoutes = require('./routes/proposalRoutes');
const callingRoutes = require('./routes/callingRoutes');
const errorHandler = require('./middleware/errorHandler');


const app = express();

// Trust proxy for rate limiting
app.set('trust proxy', 1);

// ============================================
// CORS CONFIGURATIONS
// ============================================

// 1. Global/Chatbot CORS - Allow all origins for embedding across any domain
const chatCorsOptions = {
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key', 'X-Session-Id', 'X-Chatbot-Id'],
};

// 2. Dashboard CORS - Restrict to official dashboard domains only
const dashboardOrigins = [
  'http://localhost:3002',
  'http://localhost:5174',
  'https://troika-agent.0804.in',
  'https://omniagent.0804.in',
  'https://admin-omniagent.0804.in',
  'https://omni-dashboard.0804.in',
  'https://omniagentadmin.onrender.com',
  'https://omniagentui.onrender.com',
  process.env.ADMIN_DASHBOARD_URL,
  process.env.USER_DASHBOARD_URL
].filter(Boolean);

const isLocalDashboardOrigin = (origin) =>
  /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(String(origin).trim());

/** Match Origin header to whitelist (case-insensitive, trailing slash OK). */
function normalizeDashboardOrigin(raw) {
  if (!raw || typeof raw !== 'string') return null;
  const trimmed = raw.trim().replace(/\/$/, '').toLowerCase();
  try {
    const u = new URL(trimmed);
    return `${u.protocol}//${u.host}`;
  } catch {
    return trimmed;
  }
}

const dashboardOriginsNormalized = new Set(
  dashboardOrigins.map((o) => normalizeDashboardOrigin(o)).filter(Boolean),
);

const dashboardCorsOptions = {
  origin: (origin, callback) => {
    // allow requests with no origin (like mobile apps or curl)
    if (!origin) return callback(null, true);

    const n = normalizeDashboardOrigin(origin);
    if (n && dashboardOriginsNormalized.has(n)) {
      callback(null, true);
    } else if (process.env.NODE_ENV !== 'production' && isLocalDashboardOrigin(origin)) {
      // Vite may use 5173, 5174, 5175, etc. — allow any localhost port in dev
      callback(null, true);
    } else {
      logger.warn(`Dashboard CORS blocked request from unauthorized origin: ${origin}`);
      callback(new Error('Not allowed by Dashboard CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
};

const chatCors = cors(chatCorsOptions);
const dashboardCors = cors(dashboardCorsOptions);

// Basic security headers
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }, // Allow images/scripts from other origins
  contentSecurityPolicy: false, // Disable CSP for now as it might block chatbot features, can refine later
}));

// Body parsing middleware
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));

// Public chat background images (uploaded via admin, no S3 required)
app.use(
  '/uploads/chat-backgrounds',
  chatCors,
  express.static(path.join(__dirname, 'uploads', 'chat-backgrounds'), {
    maxAge: '7d',
  })
);

// Serve static files for chatbot embed loader
app.use('/chatbot-loader', chatCors, express.static('chatbot-loader', {
  setHeaders: (res, path) => {
    // Set appropriate headers for JavaScript files
    if (path.endsWith('.js')) {
      res.setHeader('Content-Type', 'application/javascript');
      res.setHeader('Cache-Control', 'public, max-age=3600'); // Cache for 1 hour
    }
    // Set appropriate headers for CSS files
    if (path.endsWith('.css')) {
      res.setHeader('Content-Type', 'text/css');
      res.setHeader('Cache-Control', 'public, max-age=3600'); // Cache for 1 hour
    }
  }
}));

// 3. Dynamic CORS (needs body/query for chatbotId)
const dynamicCors = require('./middleware/dynamicCors');
app.use(dynamicCors);

// NoSQL Injection Protection
app.use(mongoSanitize());

// Request logging
app.use((req, res, next) => {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info(`${req.method} ${req.path} ${res.statusCode} ${duration}ms`, {
      ip: req.ip,
      userAgent: req.get('user-agent')?.substring(0, 50),
    });
  });

  next();
});

// Health check endpoint (chatCorsRelaxed: true = chat routes use app-level CORS only, no 403 from dynamicCors)
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '3.0.0',
    chatCorsRelaxed: true,
  });
});



// API version prefix
const API_PREFIX = '/api';

// ============================================
// CORE ROUTES
// ============================================

// Chat routes (basic) - no dynamicCors; use app-level chatCors only so Nova UI can load messages
app.use(`${API_PREFIX}/chat`, chatRoutes);

// Chatbot management
app.use(`${API_PREFIX}/chatbot`, chatbotRoutes);

// Offer templates (mounted under chatbot for frontend compatibility)
app.use(`${API_PREFIX}/chatbot/offer-templates`, offerRoutes);

// Lead capture
app.use(`${API_PREFIX}/leads`, leadCaptureRoutes);

// ============================================
// UI-COMPATIBLE ROUTES (Nova Enterprise UI)
// ============================================

// Intelligent chat with SSE streaming
// Endpoint: POST /api/troika/intelligent-chat/stream
app.use(`${API_PREFIX}/troika/intelligent-chat`, intelligentChatRoutes);
app.use(`${API_PREFIX}/translate`, translateRoutes);
app.use(`${API_PREFIX}/tts`, ttsRoutes);

// Authentication routes (OTP)
// Endpoints: GET /api/chatbot/:id/auth-config, POST /api/chatbot/auth/*
app.use(`${API_PREFIX}/chatbot`, authRoutes);

// WhatsApp OTP routes
// Endpoints: POST /api/whatsapp-otp/send, POST /api/whatsapp-otp/verify, GET /api/whatsapp-otp/check-session
app.use(`${API_PREFIX}/whatsapp-otp`, whatsAppOtpRoutes);


// Intent routes (proposals, special actions)
// Endpoint: GET /api/intent/:chatbotId, POST /api/intent/send-proposal
app.use(`${API_PREFIX}/intent`, intentRoutes);

// Proposal routes (sidebar and intent-based)
// Endpoints: GET /api/proposal/:chatbotId, POST /api/proposal/send
app.use(`${API_PREFIX}/proposal`, proposalRoutes);

// Calling tool routes
// Endpoints: GET /api/calling/:chatbotId, PUT /api/calling/:chatbotId
app.use(`${API_PREFIX}/calling`, callingRoutes);

// Handoff routes (human agent transfer)
// Endpoints: GET /api/handoff/config/:id, POST /api/handoff/request
app.use(`${API_PREFIX}/handoff`, handoffRoutes);

// Transcript routes
// Endpoint: GET /api/transcript/:chatbotId
app.use(`${API_PREFIX}/transcript`, transcriptRoutes);

// Translation routes (Azure Translator API)
// Endpoints: GET /api/v1/translate/languages, POST /api/v1/translate/text, POST /api/v1/translate/transcript
app.use(`${API_PREFIX}/v1/translate`, translationRoutes);

// Zoho CRM / Lead capture routes
// Endpoints: GET /api/zoho/:chatbotId, POST /api/zoho/capture-lead
app.use(`${API_PREFIX}/zoho`, zohoRoutes);

// ============================================
// ADMIN & USER DASHBOARD ROUTES
// ============================================

// Admin routes
// Endpoints: POST /api/admin/login, GET /api/admin/stats, GET /api/admin/all
app.use(`${API_PREFIX}/admin`, dashboardCors, adminRoutes);

// User routes
// Endpoints: POST /api/user/login, GET /api/user/company, GET /api/user/analytics
app.use(`${API_PREFIX}/user`, dashboardCors, userRoutes);

// Company routes (Admin only)
// Endpoints: GET /api/companies, POST /api/companies, GET /api/company/all
app.use(`${API_PREFIX}/companies`, dashboardCors, companyRoutes);
app.use(`${API_PREFIX}/company`, dashboardCors, companyRoutes);

// Customization routes
// Endpoints: GET /api/customizations/:chatbotId, PUT /api/customizations/:chatbotId
app.use(`${API_PREFIX}/customizations`, dashboardCors, customizationRoutes);

// Context/Knowledge base routes
// Endpoints: POST /api/context/files/:chatbotId
app.use(`${API_PREFIX}/context`, dashboardCors, contextRoutes);

// Subscription routes (Admin)
// Endpoints: GET /api/subscriptions
app.use(`${API_PREFIX}/subscriptions`, dashboardCors, require('./routes/subscriptionRoutes'));

// Plan routes (Admin)
// Endpoints: GET /api/plans
app.use(`${API_PREFIX}/plans`, dashboardCors, require('./routes/planRoutes'));

// Suggestions routes
// Endpoints: GET /api/suggestions/:chatbotId, POST /api/suggestions/:chatbotId, PUT /api/suggestions/:chatbotId
app.use(`${API_PREFIX}/suggestions`, dashboardCors, require('./routes/suggestionsRoutes'));

// ============================================
// ERROR HANDLING
// ============================================

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Route not found',
    path: req.path,
    method: req.method,
  });
});

// Error handling middleware (must be last)
app.use(errorHandler);

module.exports = app;
