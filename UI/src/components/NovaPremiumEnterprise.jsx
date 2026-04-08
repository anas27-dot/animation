import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { motion, AnimatePresence, LayoutGroup, useReducedMotion, useAnimationControls } from 'framer-motion';
import { createPortal } from 'react-dom';
import { FileText, Download, ExternalLink, BarChart3, TrendingUp, PieChart, Paperclip, X, Image as ImageIcon, User, LogOut, Search } from 'lucide-react';
import { getSvgIcon } from '../services/svgIcons.jsx';
import WelcomeBgCanvas from './WelcomeBgCanvas';
import RobotGirlWidget from './RobotGirlWidget';
import PDFAttachment from './PDFAttachment';
import ChartMessage from './ChartMessage';
import ImageAttachment from './ImageAttachment';
import { BarChart, Bar, LineChart, Line, PieChart as RechartsPieChart, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { useTranslation } from '../context/TranslationContext';
import { useAuth } from '../contexts/AuthContext';
import T from './T';
import OmniAgentLogo from '../Omniwhiteborder.jpg';
import config from '../config';
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import {
  getProposalConfig,
  getIntentConfig,
  sendProposal,
  sendIntentProposal,
  isPositiveResponse,
  isNegativeResponse,
} from '../services/proposalService';
import {
  getEmailConfig,
  getEmailIntentConfig,
  sendEmail,
  validateEmail,
  getCustomNavigationItems,
} from '../services/emailService';
import { getCalendlyConfig } from '../services/calendlyService';
import { getCallingConfig, initiateCall, checkConfirmation as checkCallingConfirmation } from '../services/callingService';


// ============================================
// CONFIGURATION
// ============================================
const API_CONFIG = {
  get BASE_URL() { return config.apiBaseUrl },
  get CHATBOT_ID() { return config.chatbotId || '' },
  STREAM_ENDPOINT: '/troika/intelligent-chat/stream',
  ENABLE_TTS: config.enableTTS,
};

/** Shell + welcome entrance (ms from config-ready). Wired with `useAnimationControls` + `useEffect`. */
const MOUNT_ENTRANCE_MS = {
  sidebar: 100,
  header: 350,
  main: 500,
  headline: 700,
  phrases: 1100,
  quickActions: 1400,
};
/** Composer card between headline and phrase line. */
const MOUNT_ENTRANCE_COMPOSER_MS = 900;
/** Wait after last sidebar item starts so spring motion can settle before welcome area animates. */
/** Welcome main column stagger (typewriter → input → quick actions); keep in sync with chat-bg zoom effect below. */
const WELCOME_INTRO_STAGGER_SEC = 0.26;
/** Settle time after a welcome “pop” spring before chaining (matches welcomeSpring feel). */
const CHAT_BG_WELCOME_ZOOM_SPRING_SETTLE_SEC = 0.72;
/** Slow zoom-in on the hero BG after welcome pops finish (Ken Burns–style, not a snap). */
const CHAT_BG_ZOOM_IN_DURATION_SEC = 20;
/** Target scale once welcome intro has fully settled (slight zoom-in on the photo). */
const CHAT_BG_WELCOME_ZOOM_IN_END_SCALE = 1.12;
/**
 * “Pro” chat scroll: adaptive exponential smoothing — gentle when close to bottom,
 * a bit quicker when a long reply jump leaves us far behind (no hard step caps).
 */
const CHAT_SCROLL_SMOOTH_EPS_PX = 0.65;
/** Larger = react more slowly when far below (less “jump” during fast streams). */
const CHAT_SCROLL_ADAPTIVE_REF_PX = 560;
const CHAT_STREAM_SCROLL_GAIN_MIN = 0.017;
const CHAT_STREAM_SCROLL_GAIN_MAX = 0.068;
const CHAT_SCROLL_OTHER_GAIN_MIN = 0.085;
const CHAT_SCROLL_OTHER_GAIN_MAX = 0.26;
/** First welcome send: small lift from final slot reads as middle → bottom (not a long drop from top). */
const USER_BUBBLE_FLYIN_INITIAL = {
  opacity: 0.62,
  y: '-9vh',
  x: '-5vw',
  scale: 0.94,
};
/** Slower tween; soft ease-out so it settles rather than falls. */
const USER_BUBBLE_FLYIN_TRANSITION = {
  type: 'tween',
  duration: 2.45,
  ease: [0.33, 0.94, 0.4, 1],
};
/** Prompts when header nav buttons are used — backend RAG answers like normal chat. */
const HEADER_KB_PROMPTS = {
  about:
    'About us: Summarize the company (who you are, mission, background, differentiators) using only information from your knowledge base and uploaded documents. If something is not in those materials, say it is not available there.',
  services:
    'Services: List and describe what the company offers using only your knowledge base and uploaded documents. If a topic is not documented, say so.',
  contact:
    'Contact: Share how to reach the company (addresses, phone, email, hours, support channels) using only your knowledge base and uploaded documents. If something is not documented, say so.',
};

/** Snappy — buttons, toggles, quick micro-interactions */
const SPRING_SNAPPY = { type: 'spring', stiffness: 700, damping: 28, mass: 0.4 };
/** Natural — message bubbles, cards, panels entering */
const SPRING_NATURAL = { type: 'spring', stiffness: 420, damping: 24, mass: 0.6 };
/** Gentle — overlays, view transitions, large surface reveals */
const SPRING_GENTLE = { type: 'spring', stiffness: 220, damping: 22, mass: 0.8 };

function useMotionSprings() {
  const prefersReduced = useReducedMotion();
  return useMemo(
    () => ({
      snappy: prefersReduced ? { type: 'tween', duration: 0 } : SPRING_SNAPPY,
      natural: prefersReduced ? { type: 'tween', duration: 0 } : SPRING_NATURAL,
      gentle: prefersReduced ? { type: 'tween', duration: 0 } : SPRING_GENTLE,
      prefersReduced,
    }),
    [prefersReduced],
  );
}

// Supported Languages
const SUPPORTED_LANGUAGES = [
  { name: 'English', native: 'English' },
  { name: 'Hindi', native: 'हिन्दी' },
  { name: 'Marathi', native: 'मराठी' },
  { name: 'Gujrati', native: 'ગુજરાતી' },
  { name: 'Tamil', native: 'தமிழ்' },
  { name: 'Telugu', native: 'తెలుగు' },
  { name: 'Kannada', native: 'ಕನ್ನಡ' }
];

// ============================================
// THEME CONFIGURATION
// ============================================
const theme = {
  bg: 'bg-slate-50',
  sidebar: 'bg-white',
  card: 'bg-white',
  cardHover: 'hover:bg-slate-50',
  border: 'border-slate-200',
  borderLight: 'border-slate-100',
  text: 'text-[#02066F]',
  textSecondary: 'text-slate-500',
  textMuted: 'text-slate-400',
  input: 'bg-slate-50',
  button: 'bg-[#02066F] text-white hover:bg-[#031880]',
  buttonSecondary: 'bg-slate-100 hover:bg-slate-200 text-slate-700',
  /* border-transparent: same 1px box model as ai bubble (border-slate-200) so padding lines up */
  userBubble: 'bg-[#02066F] text-white border border-transparent',
  aiBubble: 'bg-[#F3F4F6] border border-slate-200 text-[#111827]',
  accent: 'bg-[#02066F]',
};

/** Timestamp / like row under a bubble (user + bot) */
const MESSAGE_META_ROW_CLASS = 'flex items-center gap-2 mt-1 flex-wrap';
/** Space after each full message row (bubble + meta) — keep compact between turns */
const MESSAGE_THREAD_GAP_CLASS = 'mb-4';
/** Same avatar↔bubble gap user & bot (replaces mixed mr-4/ml-4 vs skeleton mr-3) */
const MESSAGE_ROW_FLEX_CLASS = 'flex items-start gap-3';

// Helper function to generate initials from branding text
const getBrandingInitials = (chatbotConfig) => {
  const brandingText = chatbotConfig?.sidebar_branding?.branding_company || "Troika Tech";
  return brandingText.charAt(0).toUpperCase();
};

// ============================================
// HELPER: PRODUCT NAME MAPPING
// "Swara" -> "calling" (matches "AI Calling Agent")
// ============================================
const mapKeywordToCategory = (keyword) => {
  if (!keyword) return '';
  const k = keyword.toLowerCase();
  // Map "Swara", "Voice", "Calling" -> calling (matches "AI Calling Agent")
  if (k.includes('swara') || k.includes('voice') || k.includes('call')) return 'calling';
  // Map "Omni", "Chat", "Text" -> chat
  if (k.includes('omni') || k.includes('chat') || k.includes('text')) return 'chat';
  return k; // Return original if no mapping found
};

// ============================================
// HELPER: HISTORY SCANNER (Strict User-Only)
// ============================================
const findContextInHistory = (messages) => {
  const recentMsgs = (messages || []).slice(-5).reverse(); // Newest first

  for (const msg of recentMsgs) {
    // 🛑 CRITICAL FIX: Ignore AI messages.
    // Only infer context if the USER explicitly mentioned the product.
    if (!msg.isUser) continue;

    const text = (typeof msg.content === 'string' ? msg.content : '').toLowerCase();
    if (text.includes('swara') || text.includes('voice') || text.includes('calling agent')) return 'Swara';
    if (text.includes('omni') || text.includes('chat agent')) return 'OmniAgent';
  }
  return null;
};

/** Whitespace-separated word count — suggestions start after this many words (not character count). */
function countWords(text) {
  return String(text || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}

/** Infer optional suggestion context bucket from recent messages (billing / support / onboarding). */
function inferChatContext(messages) {
  const text = (messages || [])
    .slice(-8)
    .map((m) => (typeof m.content === 'string' ? m.content : ''))
    .join(' ')
    .toLowerCase();
  if (/\b(bill|invoice|payment|pay|balance|receipt|subscription|refund)\b/.test(text)) return 'billing';
  if (/\b(order|complaint|support|ticket|agent|help)\b/.test(text)) return 'support';
  if (/\b(start|setup|onboard|demo|account|getting started|begin)\b/.test(text)) return 'onboarding';
  return null;
}

// ============================================
// HELPER: VERIFY CONTEXT IS REAL (NOT HALLUCINATED)
// ============================================
const isKeywordGrounded = (keyword, messages) => {
  if (!keyword) return false;
  const cleanKw = keyword.toLowerCase().trim();

  // 1. If the keyword is purely generic (like "proposal"), it's never "grounded" enough to auto-select
  if (isGenericKeyword(cleanKw)) return false;

  // 2. Scan last 5 USER messages to see if they actually mentioned this product
  // We ignore AI messages to prevent the bot from biasing the selection
  const recentUserMsgs = (messages || []).slice(-5).filter(m => m.isUser);

  return recentUserMsgs.some(msg => {
    const text = (typeof msg.content === 'string' ? msg.content : '').toLowerCase();

    // Direct match
    if (text.includes(cleanKw)) return true;

    // Category match (e.g. if keyword is "calling", did user say "swara"?)
    if (cleanKw === 'calling' && (text.includes('swara') || text.includes('voice'))) return true;
    if (cleanKw === 'chat' && (text.includes('omni') || text.includes('text'))) return true;

    return false;
  });
};

// ============================================
// HELPER: FORCE SELECTION GUARD
// ============================================
const isGenericKeyword = (kw) => {
  if (!kw || typeof kw !== 'string') return true;
  const k = kw.toLowerCase().trim();
  return ['proposal', 'quote', 'email', 'whatsapp', 'wa'].includes(k) || k.length < 2;
};

const shouldForceTemplateSelection = ({ isNewChat, templates, intentContextData, userMessage }) => {
  if (!templates || templates.length <= 1) return false;
  // If verified specific keyword exists (e.g. "Swara"), trust it - don't force
  if (intentContextData?.requested_template_keyword) {
    const kw = intentContextData.requested_template_keyword.toLowerCase().trim();
    if (!isGenericKeyword(kw)) {
      return false; // Specific keyword (Swara, OmniAgent, etc.) -> Don't force selection
    }
  }
  // If new chat, force selection (AI might have hallucinated)
  if (isNewChat) return true;
  // No keyword at all
  if (!intentContextData?.requested_template_keyword) return true;
  return false;
};

// Helper: Classify confirmation locally first, then fallback to AI
const classifyConfirmation = async (text) => {
  const lower = (text || '').toLowerCase().trim();

  // ⚡ LOCAL CHECK: Handle simple answers immediately (instant, no API)
  const positives = ['yes', 'y', 'yeah', 'yep', 'sure', 'ok', 'okay', '1', 'correct', 'confirm', 'haan', 'haanji', 'bilkul', 'sahi hai', 'bhejo', 'ha', 'haa', 'ho', 'hoy', 'barobar', 'pathva', 'ama', 'amam', 'seri', 'avunu', 'sare', 'howdu', 'sari', 'kalsi', 'barabar', 'moklo'];
  const negatives = ['no', 'n', 'nope', 'nah', 'cancel', 'stop', '2', 'wrong', 'exit', 'nahi', 'na', 'mat bhejo', 'rahne do', 'galat hai', 'nako', 'naahi', 'chukicha', 'venda', 'illai', 'vaddu', 'kadu', 'beda', 'illa', 'raho do'];

  if (positives.includes(lower)) {
    console.log(`🧠 [Local Classification] "${text}" -> POSITIVE`);
    return { status: 'POSITIVE' };
  }
  if (negatives.includes(lower)) {
    console.log(`🧠 [Local Classification] "${text}" -> NEGATIVE`);
    return { status: 'NEGATIVE' };
  }

  // Fallback to API for complex sentences
  try {
    const token = localStorage.getItem('token') || localStorage.getItem('auth_token');
    const response = await fetch(`${config.apiBaseUrl}/chat/classify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      },
      body: JSON.stringify({ message: text })
    });

    if (!response.ok) return { status: 'AMBIGUOUS' };

    const data = await response.json();
    console.log(`🧠 [AI Classification] "${text}" -> ${data.status}`);
    return data;
  } catch (error) {
    console.error('Classification failed:', error);
    return { status: 'AMBIGUOUS' };
  }
};

// Helper: Translate text to user's language
const translateFlowText = async (text, detectedLanguage) => {
  try {
    // If no language detected or English, return original
    if (!detectedLanguage || !detectedLanguage.language || detectedLanguage.language.toLowerCase() === 'english') {
      return text;
    }

    const token = localStorage.getItem('token') || localStorage.getItem('auth_token');
    const response = await fetch(`${config.apiBaseUrl}/chat/translate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      },
      body: JSON.stringify({
        text,
        targetLanguage: detectedLanguage.language,
        targetScript: detectedLanguage.script || 'Latin'
      })
    });

    if (!response.ok) {
      console.warn('Translation failed, using original text');
      return text;
    }

    const data = await response.json();
    console.log(`🌐 [Translation] "${text.substring(0, 30)}..." -> ${detectedLanguage.language}: "${data.translatedText.substring(0, 30)}..."`);
    return data.translatedText;
  } catch (error) {
    console.error('Translation error:', error);
    return text; // Fallback to original
  }
};

// Helper: Levenshtein Distance for fuzzy matching
const editDistance = (s1, s2) => {
  s1 = s1.toLowerCase();
  s2 = s2.toLowerCase();
  const costs = [];
  for (let i = 0; i <= s1.length; i++) {
    let lastValue = i;
    for (let j = 0; j <= s2.length; j++) {
      if (i === 0) costs[j] = j;
      else {
        if (j > 0) {
          let newValue = costs[j - 1];
          if (s1.charAt(i - 1) !== s2.charAt(j - 1)) {
            newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
          }
          costs[j - 1] = lastValue;
          lastValue = newValue;
        }
      }
    }
    if (i > 0) costs[s2.length] = lastValue;
  }
  return costs[s2.length];
};

// Helper: Similarity score (0 to 1)
const getSimilarity = (s1, s2) => {
  let longer = s1;
  let shorter = s2;
  if (s1.length < s2.length) {
    longer = s2;
    shorter = s1;
  }
  const longerLength = longer.length;
  if (longerLength === 0) return 1.0;
  return (longerLength - editDistance(longer, shorter)) / parseFloat(longerLength);
};

// Helper: Word-level fuzzy match
const isFuzzyMatch = (text, keyword, threshold = 0.6) => {
  if (!text || !keyword) return false;
  const normalizedText = text.toLowerCase();
  const normalizedKeyword = keyword.toLowerCase();

  // ONLY use direct substring match for Multi-Word Phrases
  if (normalizedKeyword.includes(' ')) {
    if (normalizedText.includes(normalizedKeyword)) return true;
  }

  // Word-level fuzzy match
  // Split by non-word characters (handles punctuation better)
  const words = normalizedText.split(/[\s\W]+/);
  return words.some(word => getSimilarity(word, normalizedKeyword) >= threshold);
};

// ============================================
// ICONS (Apple SF Symbols style)
// ============================================
// ============================================
// WELCOME TYPEWRITER TEXT COMPONENT
// ============================================

const PREMIUM_TROIKA_ROTATING_PREFIXES = [
  'Sell & Manage',
  'Close Deals',
  'Convert Visitors',
  'Delight Clients',
];

const DEFAULT_PREMIUM_LINE1 = ['TRION', 'SmartSites'];
const DEFAULT_PREMIUM_LINE2_WORDS = ['Sell', '&', 'Manage', 'Customers', '24×7'];

/** Hero headline: word stagger, cursor, then rotating line (branding + admin “Welcome Rotating Text” / fallback). */
function PremiumTroikaHeadline({
  line1DelaySec = 0,
  line2DelaySec = 0,
  /** Admin “Welcome Message” (above input) — when enabled, drives hero line 1 instead of sidebar branding. */
  welcomeText,
  welcomeTextEnabled = false,
  brandingCompany,
  brandingText,
  rotatingWelcomeEnabled = false,
  rotatingWelcomePhrases,
  rotatingWelcomeIntervalSec = 2.5,
} = {}) {
  const prefersReduced = useReducedMotion();
  const configPhrases = useMemo(() => {
    if (!Array.isArray(rotatingWelcomePhrases)) return [];
    return rotatingWelcomePhrases
      .map((p) => String(p || '').trim())
      .filter(Boolean);
  }, [rotatingWelcomePhrases]);

  const useAdminRotating = rotatingWelcomeEnabled === true && configPhrases.length > 0;
  const rotateEveryMs = Math.max(
    800,
    Math.round(1000 * (Number(rotatingWelcomeIntervalSec) > 0 ? Number(rotatingWelcomeIntervalSec) : 2.5)),
  );

  const line1Words = useMemo(() => {
    if (welcomeTextEnabled && String(welcomeText || '').trim()) {
      const firstLine = String(welcomeText).trim().split('\n')[0];
      const words = firstLine.split(/\s+/).filter(Boolean);
      if (words.length) return words;
    }
    const a = String(brandingCompany || '').trim();
    const b = String(brandingText || '').trim();
    if (a && b) return [a, b];
    if (a) return [a];
    return DEFAULT_PREMIUM_LINE1;
  }, [welcomeTextEnabled, welcomeText, brandingCompany, brandingText]);

  const line2Words = useMemo(() => {
    if (useAdminRotating && configPhrases[0]) {
      return configPhrases[0].split(/\s+/).filter(Boolean);
    }
    return DEFAULT_PREMIUM_LINE2_WORDS;
  }, [useAdminRotating, configPhrases]);

  const rotateCycleLen = useAdminRotating
    ? configPhrases.length
    : PREMIUM_TROIKA_ROTATING_PREFIXES.length;

  const [phase, setPhase] = useState('enter'); // enter | cursor | rotate
  const [rotateIndex, setRotateIndex] = useState(0);

  const spring = prefersReduced
    ? { duration: 0 }
    : { type: 'spring', stiffness: 400, damping: 28 };

  const line1WordDelay = (i) => (prefersReduced ? 0 : line1DelaySec + i * 0.07);
  const line2WordDelay = (i) => (prefersReduced ? 0 : line2DelaySec + i * 0.07);

  useEffect(() => {
    setRotateIndex(0);
  }, [useAdminRotating, configPhrases.join('|'), rotateCycleLen]);

  useEffect(() => {
    if (prefersReduced) {
      setPhase('rotate');
      return;
    }
    if (phase !== 'enter') return;
    const ms = Math.round(
      line2DelaySec * 1000 + Math.max(0, line2Words.length - 1) * 70 + 480,
    );
    const t = window.setTimeout(() => setPhase('cursor'), ms);
    return () => window.clearTimeout(t);
  }, [phase, prefersReduced, line2DelaySec, line2Words.length]);

  useEffect(() => {
    if (prefersReduced || phase !== 'cursor') return;
    const t = window.setTimeout(() => setPhase('rotate'), 2000);
    return () => window.clearTimeout(t);
  }, [phase, prefersReduced]);

  useEffect(() => {
    if (phase !== 'rotate' || prefersReduced || rotateCycleLen < 1) return;
    const ms = useAdminRotating ? rotateEveryMs : 2800;
    const id = window.setInterval(() => {
      setRotateIndex((i) => (i + 1) % rotateCycleLen);
    }, ms);
    return () => window.clearInterval(id);
  }, [phase, prefersReduced, rotateCycleLen, useAdminRotating, rotateEveryMs]);

  const rotatingDisplayText = useAdminRotating
    ? configPhrases[rotateIndex % configPhrases.length]
    : PREMIUM_TROIKA_ROTATING_PREFIXES[rotateIndex % PREMIUM_TROIKA_ROTATING_PREFIXES.length];

  return (
    <div className="premium-troika-headline w-full max-w-[780px] px-2">
      <h1
        className="flex flex-wrap justify-center gap-x-2 gap-y-1 text-center font-bold text-[#1a1a2e]"
        style={{ fontSize: 'clamp(24px,4vw,32px)' }}
      >
        {line1Words.map((w, i) => (
          <motion.span
            key={`l1-${i}-${w}`}
            initial={{ opacity: 0, y: 20, filter: 'blur(4px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            transition={{ ...spring, delay: line1WordDelay(i) }}
          >
            {w}
          </motion.span>
        ))}
      </h1>
      <h2
        className="mt-1 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-center font-bold text-[#02066F]"
        style={{ fontSize: 'clamp(18px,3vw,24px)' }}
      >
        {phase === 'rotate' ? (
          <>
            <AnimatePresence mode="wait">
              <motion.span
                key={rotatingDisplayText}
                initial={prefersReduced ? false : { opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={prefersReduced ? undefined : { opacity: 0, y: 10 }}
                transition={
                  prefersReduced
                    ? { duration: 0 }
                    : { type: 'spring', stiffness: 400, damping: 28 }
                }
                className={useAdminRotating ? 'inline-block text-center' : 'inline-block'}
              >
                {rotatingDisplayText}
              </motion.span>
            </AnimatePresence>
            {!useAdminRotating ? (
              <>
                <span className="inline"> Customers 24×7</span>
                <span className="typing-cursor inline opacity-90">|</span>
              </>
            ) : (
              <span className="typing-cursor inline opacity-90">|</span>
            )}
          </>
        ) : (
          <>
            {line2Words.map((w, i) => (
              <motion.span
                key={`l2-${i}-${w}`}
                initial={{ opacity: 0, y: 20, filter: 'blur(4px)' }}
                animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                transition={{ ...spring, delay: line2WordDelay(i) }}
              >
                {w}
              </motion.span>
            ))}
            {phase === 'cursor' ? <span className="typing-cursor inline">|</span> : null}
          </>
        )}
      </h2>
    </div>
  );
}

// ============================================
// ICONS
// ============================================

const Icons = {
  send: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
    </svg>
  ),
  mic: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
    </svg>
  ),
  attach: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
    </svg>
  ),
  settings: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
  search: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  ),
  plus: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
    </svg>
  ),
  chevronRight: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
    </svg>
  ),
  check: (
    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
    </svg>
  ),
  moon: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
    </svg>
  ),
  sun: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  ),
  analytics: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  ),
  clock: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  document: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  ),
  download: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
    </svg>
  ),
  calendar: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  ),
  shield: (
    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
      <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
    </svg>
  ),
  bot: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" />
    </svg>
  ),
  stop: (
    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
      <rect x="6" y="6" width="12" height="12" rx="2" />
    </svg>
  ),
  phone: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
    </svg>
  ),
  whatsapp: (
    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.742.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893A11.821 11.821 0 0020.885 3.488" />
    </svg>
  ),
  email: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  ),
  language: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
    </svg>
  ),
  chevronDown: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  ),
  more: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 12.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 18.75a.75.75 0 110-1.5.75.75 0 010 1.5z" />
    </svg>
  ),
  star: (
    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
    </svg>
  ),
  menu: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  ),
  close: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  ),
};

// ============================================
// SSE STREAMING HOOK
// ============================================
function useStreamingChat({ apiBase, chatbotId, sessionId, conversationId, phone, userInfo, isAuthenticated, authToken, onConnected, onComplete, onError, onProposalIntentDetected, onEmailIntentDetected, onCallingIntentDetected }) {
  const { currentLanguage } = useTranslation();
  const [streamingResponse, setStreamingResponse] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState(null);
  const abortControllerRef = useRef(null);
  const audioQueueRef = useRef([]);
  const isPlayingAudioRef = useRef(false);
  const currentAudioRef = useRef(null);

  // Convert file to Base64
  const fileToBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        // Remove the data:image/jpeg;base64, prefix to get just the Base64 string
        const base64 = reader.result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = error => reject(error);
    });
  };

  // Audio playback function - ensures sequential playback of all chunks
  const playNextAudio = useCallback(() => {
    if (isPlayingAudioRef.current) {
      return; // Already playing, will be called again when current audio ends
    }

    // Sort queue by sequence number to ensure correct playback order
    if (audioQueueRef.current.length > 1) {
      audioQueueRef.current.sort((a, b) => (a.sequence || 0) - (b.sequence || 0));
    }

    if (audioQueueRef.current.length === 0) {
      isPlayingAudioRef.current = false;
      return;
    }

    isPlayingAudioRef.current = true;
    const audioData = audioQueueRef.current.shift();

    try {
      // Decode base64 audio
      const audioBuffer = Uint8Array.from(atob(audioData.chunk), c => c.charCodeAt(0));
      const audioBlob = new Blob([audioBuffer], { type: 'audio/mpeg' });
      const audioUrl = URL.createObjectURL(audioBlob);

      const audio = new Audio(audioUrl);
      currentAudioRef.current = audio;

      audio.onended = () => {
        URL.revokeObjectURL(audioUrl);
        currentAudioRef.current = null;
        isPlayingAudioRef.current = false;
        // Play next in queue after a small delay
        setTimeout(() => playNextAudio(), 50);
      };

      audio.onerror = (error) => {
        console.error('Audio play error:', error);
        URL.revokeObjectURL(audioUrl);
        currentAudioRef.current = null;
        isPlayingAudioRef.current = false;
        // Continue with next chunk even on error
        setTimeout(() => playNextAudio(), 50);
      };

      audio.play().catch((error) => {
        console.error('Audio play promise rejection:', error);
        URL.revokeObjectURL(audioUrl);
        currentAudioRef.current = null;
        isPlayingAudioRef.current = false;
        // Continue with next chunk even on play error
        setTimeout(() => playNextAudio(), 50);
      });
    } catch (error) {
      console.error('Audio processing error:', error);
      isPlayingAudioRef.current = false;
      // Continue with next chunk even on processing error
      setTimeout(() => playNextAudio(), 50);
    }
  }, []);

  const sendMessage = useCallback(async (query, conversationId, attachment = null) => {
    if (!apiBase || !chatbotId) {
      console.error('Missing apiBase or chatbotId');
      return;
    }

    if (isStreaming) {
      console.warn('Already streaming');
      return;
    }

    setStreamingResponse('');
    setError(null);
    setIsStreaming(true);

    // 🕵️‍♂️ TOKEN HUNTER: Aggressively look for the token
    // 1. Try Context First (most reliable - from AuthContext)
    let token = authToken;

    // 2. Check sessionStorage for chatbot_auth (AuthContext storage key)
    if (!token) {
      try {
        const sessionAuth = sessionStorage.getItem('chatbot_auth');
        if (sessionAuth) {
          const authData = JSON.parse(sessionAuth);
          token = authData.token;
        }
      } catch (e) {
        console.log('No sessionStorage token found');
      }
    }

    // 3. Check localStorage for chatbot_auth (backup)
    if (!token) {
      try {
        const localAuth = localStorage.getItem('chatbot_auth');
        if (localAuth) {
          const authData = JSON.parse(localAuth);
          token = authData.token;
        }
      } catch (e) {
        console.log('No localStorage token found');
      }
    }

    // 4. Fall back to other common storage keys
    if (!token) {
      token = localStorage.getItem('token') ||
        localStorage.getItem('auth_token') ||
        localStorage.getItem('troika_auth_token');
    }

    // 5. Check nested objects if simple keys fail
    if (!token) {
      try {
        const storedUser = JSON.parse(localStorage.getItem('userInfo') || localStorage.getItem('user') || '{}');
        token = storedUser.token || storedUser.accessToken;
      } catch (e) {
        console.log('No nested token found');
      }
    }

    console.log('🚀 [API] Sending Message. Token attached:', !!token, 'isAuthenticated:', isAuthenticated, 'authToken from context:', !!authToken);

    // Clear audio queue for new message
    audioQueueRef.current = [];
    isPlayingAudioRef.current = false;
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current = null;
    }

    abortControllerRef.current = new AbortController();

    try {
      console.log('📤 [MSG] Sending message with:', {
        sessionId,
        phone,
        conversationId,
        attachment: attachment ? attachment.type : null
      });

      // Prepare message content for Vision API
      let messageContent;

      if (attachment && attachment.type === 'image') {
        // Convert image file to Base64
        const base64Image = await fileToBase64(attachment.file);

        // Create Vision API content array
        messageContent = [
          {
            type: "text",
            text: query || "Analyze this image" // Use query or default prompt
          },
          {
            type: "image_url",
            image_url: {
              url: `data:${attachment.file.type};base64,${base64Image}`
            }
          }
        ];
      } else {
        // Regular text message
        messageContent = query;
      }

      const response = await fetch(`${apiBase}${API_CONFIG.STREAM_ENDPOINT}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Chatbot-Id': chatbotId,
          // ✅ CRITICAL: Attach the token if we found one
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          chatbotId,
          query: messageContent, // Now can be text or Vision content array
          sessionId,
          conversationId,
          phone,
          enableTTS: API_CONFIG.ENABLE_TTS,
          voice: 'en-US-JennyNeural',
          language: currentLanguage,
          attachment: attachment ? {
            type: attachment.type,
            fileName: attachment.fileName,
            fileSize: attachment.fileSize
          } : null
        }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        // Provide more user-friendly error messages for common status codes
        switch (response.status) {
          case 400:
            errorMessage = 'Bad request - please check your input';
            break;
          case 401:
            errorMessage = 'Authentication required - please check your credentials';
            break;
          case 403:
            errorMessage = 'Access forbidden - you may not have permission';
            break;
          case 404:
            errorMessage = 'Service not found - please try again later';
            break;
          case 429:
            errorMessage = 'Too many requests - please wait and try again';
            break;
          case 500:
            errorMessage = 'Server error - please try again later';
            break;
          case 502:
          case 503:
          case 504:
            errorMessage = 'Service temporarily unavailable - please try again later';
            break;
        }
        throw new Error(errorMessage);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let fullResponse = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Process complete SSE events
        while (buffer.includes('\n\n')) {
          const eventEnd = buffer.indexOf('\n\n');
          const eventData = buffer.substring(0, eventEnd);
          buffer = buffer.substring(eventEnd + 2);

          // Parse SSE event
          const lines = eventData.split('\n');
          let eventType = '';
          let data = '';


          for (const line of lines) {
            if (line.startsWith('event:')) {
              eventType = line.substring(6).trim();
            } else if (line.startsWith('data:')) {
              data = line.substring(5).trim();
            }
          }

          if (!eventType || !data) {
            // Only log skip if it looks like a meaningful event was attempted
            if (lines.length > 0 && lines[0].trim() !== '') {
              console.log('⚠️ [SSE] Skipping incomplete event block:', { eventType, dataLength: data?.length, rawLines: lines });
            }
            continue;
          }

          console.log(`📥 [SSE] Parsed event: ${eventType}`, { dataLength: data.length });

          try {
            const parsed = JSON.parse(data);

            switch (eventType) {
              case 'text':
                const content = parsed.content || parsed.token || '';
                fullResponse += content;
                setStreamingResponse(fullResponse);
                break;
              case 'audio':
                const audioChunk = parsed.chunk;
                const sequence = parsed.sequence || 0;
                if (audioChunk) {
                  // Add chunk to queue with sequence number
                  audioQueueRef.current.push({ chunk: audioChunk, sequence });
                  console.log(`Audio chunk queued: sequence ${sequence}, queue length: ${audioQueueRef.current.length}`);
                  // Trigger playback if not already playing
                  if (!isPlayingAudioRef.current) {
                    playNextAudio();
                  }
                }
                break;
              case 'proposal_intent_detected':
                // Tool call detected - trigger proposal confirmation flow
                console.log('🎯 [Tool Call] Proposal intent detected via LLM tool call');
                console.log('🎯 [Tool Call] Event data:', parsed);
                onProposalIntentDetected?.(parsed);
                break;
              case 'email_intent_detected':
                console.log('🎯 [Tool Call] Email intent detected via LLM tool call');
                console.log('🎯 [Tool Call] Event data:', parsed);
                onEmailIntentDetected?.(parsed);
                break;
              case 'calling_intent_detected':
                // Tool call detected - trigger calling confirmation flow
                console.log('🎯 [Tool Call] Calling intent detected via LLM tool call');
                console.log('🎯 [Tool Call] Event data:', parsed);
                onCallingIntentDetected?.(parsed);
                break;
              case 'connected':
                if (parsed.conversationId) {
                  onConnected?.(parsed);
                }
                break;
              case 'done':
              case 'complete':
                setIsStreaming(false);
                onComplete?.({ fullAnswer: parsed.fullAnswer || fullResponse, ...parsed });
                break;
              case 'error':
                console.error('SSE Error event:', parsed);

                // ✅ Parse the error properly - handle nested message objects
                let errorObj = parsed;
                if (typeof parsed === 'string') {
                  try { errorObj = JSON.parse(parsed); } catch (e) { errorObj = { message: parsed }; }
                }

                // Handle nested message object (e.g., {error: 'MESSAGE_LIMIT_REACHED', message: '...'})
                if (errorObj?.message && typeof errorObj.message === 'object') {
                  errorObj = errorObj.message;
                }

                // ✅ CHECK FOR LIMIT ERROR
                if (errorObj?.error === 'MESSAGE_LIMIT_REACHED' || errorObj?.code === 'MESSAGE_LIMIT_REACHED') {
                  console.log('🔒 [LIMIT] Message limit reached, showing auth banner');
                  // Pass special flag to onError callback
                  onError?.({ ...errorObj, isLimitError: true });
                  setIsStreaming(false);
                  return;
                }

                // Default error handling
                const errorMessage = errorObj?.message || errorObj?.error || 'Stream error from server';
                setError(errorMessage);
                setIsStreaming(false);
                onError?.(errorObj);
                break;
              case 'suggestions':
                // Handle suggestions if needed
                break;
            }
          } catch (e) {
            // Non-JSON data, skip
          }
        }
      }

      // Stream ended
      if (isStreaming) {
        setIsStreaming(false);
        onComplete?.({ fullAnswer: fullResponse });
      }

    } catch (err) {
      if (err.name === 'AbortError') {
        console.log('Stream aborted');
      } else {
        console.error('Stream error:', err);
        console.error('Error type:', err.name);
        console.error('Error message:', err.message);
        console.error('Error stack:', err.stack);
        setError(err.message || 'Network or processing error');
        onError?.(err);
      }
      setIsStreaming(false);
    }
  }, [apiBase, chatbotId, sessionId, conversationId, phone, isStreaming, onComplete, onError, currentLanguage, authToken, isAuthenticated, onProposalIntentDetected, onEmailIntentDetected, onCallingIntentDetected]);

  const stopStreaming = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    // Stop current audio if playing
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current = null;
    }
    // Clear audio queue
    audioQueueRef.current = [];
    isPlayingAudioRef.current = false;
    setIsStreaming(false);
  }, []);

  // Wrapper function to accept attachment parameter
  const sendMessageWithAttachment = useCallback(async (query, conversationId, attachment = null) => {
    return sendMessage(query, conversationId, attachment);
  }, [sendMessage]);

  return { streamingResponse, isStreaming, error, sendMessage: sendMessageWithAttachment, stopStreaming };
}

// ============================================
// COMPONENTS
// ============================================


// Skeleton row while conversation messages load
const SkeletonBubble = ({ isUser = false, width = '70%' }) => {
  const { natural } = useMotionSprings();
  const skeletonShellRef = useRef(null);
  return (
    <motion.div
      ref={skeletonShellRef}
      className={`${MESSAGE_ROW_FLEX_CLASS} ${MESSAGE_THREAD_GAP_CLASS} ${isUser ? 'justify-end' : 'justify-start'}`}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={natural}
      style={{ willChange: 'transform, opacity' }}
      onAnimationComplete={() => {
        if (skeletonShellRef.current) skeletonShellRef.current.style.willChange = 'auto';
      }}
    >
      {!isUser && (
        <div className="w-9 h-9 rounded-full bg-slate-200 flex-shrink-0 animate-pulse motion-reduce:animate-none" />
      )}
      <div
        className="rounded-2xl bg-slate-200 animate-pulse motion-reduce:animate-none"
        style={{ width, height: '52px', borderRadius: '18px' }}
      />
      {isUser && (
        <div className="w-9 h-9 rounded-full bg-slate-200 flex-shrink-0 animate-pulse motion-reduce:animate-none" />
      )}
    </motion.div>
  );
};

// Conversation Item
const ConversationItem = ({ conversation, isActive, onClick }) => {
  const { snappy, natural } = useMotionSprings();
  return (
    <motion.button
      type="button"
      onClick={onClick}
      className={`block w-full text-left px-3 md:px-4 py-2 border-b ${theme.borderLight} flex-shrink-0 relative overflow-hidden ${isActive ? 'bg-slate-50' : theme.cardHover
        }`}
      whileHover={{ x: 3, backgroundColor: 'rgba(2, 6, 111, 0.04)' }}
      whileTap={{ scale: 0.98 }}
      transition={snappy}
      style={{ willChange: 'transform' }}
    >
      {isActive && (
        <motion.div
          layoutId="activeConvIndicator"
          className="absolute left-0 top-1 bottom-1 w-0.5 bg-[#02066F] rounded-full"
          transition={natural}
          style={{ willChange: 'transform' }}
        />
      )}
      <div className="flex items-center gap-4">
        <div className="relative">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${isActive ? theme.accent + ' text-white' : 'bg-slate-100 text-slate-600'
            }`}>
            <span className="text-sm font-semibold">{conversation.initials}</span>
          </div>
          {isActive && (
            <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-white flex items-center justify-center">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <span className={`font-semibold text-sm ${theme.text}`}>{conversation.title}</span>
            <span className={`text-xs ${theme.textMuted} whitespace-nowrap min-w-fit px-1`}>{conversation.time}</span>
          </div>
          <p className={`text-sm ${theme.textSecondary} truncate`}>{conversation.preview}</p>
        </div>
        {conversation.unread && (
          <div className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0 mt-2" />
        )}
      </div>
    </motion.button>
  );
};

// Sidebar row matching ConversationItem layout (primary shortcuts: email, WhatsApp, proposal, Calendly)
const SidebarActionListItem = ({ icon, label, description, onClick }) => {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`block w-full text-left px-3 md:px-4 py-2 border-b ${theme.borderLight} flex-shrink-0 relative ${theme.cardHover}`}
    >
      <div className="flex items-center gap-4">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${theme.accent} text-white`}>
          <span className="flex items-center justify-center [&>svg]:w-5 [&>svg]:h-5">{icon}</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <span className={`font-semibold text-sm ${theme.text}`}><T>{label}</T></span>
          </div>
          <p className={`text-sm ${theme.textSecondary} truncate`}><T>{description}</T></p>
        </div>
      </div>
    </button>
  );
};

// Order Status Card
const OrderStatusCard = ({ order }) => {
  const t = theme;
  return (
    <div className={`mt-4 ${t.card} rounded-2xl border ${t.border} overflow-hidden`}>
      <div className={`px-5 py-4 border-b ${t.borderLight}`}>
        <div className="flex items-center justify-between">
          <div>
            <p className={`text-xs ${t.textMuted} font-medium uppercase tracking-wide`}>Order Status</p>
            <p className={`text-lg font-semibold ${t.text} mt-1`}>{order.id}</p>
          </div>
          <div className={`px-3 py-1.5 rounded-full text-xs font-semibold ${order.status === 'Delivered' ? 'bg-emerald-500/10 text-emerald-600' :
            order.status === 'In Transit' ? 'bg-blue-500/10 text-blue-600' :
              'bg-amber-500/10 text-amber-600'
            }`}>
            {order.status}
          </div>
        </div>
      </div>

      <div className="px-5 py-4">
        <div className="relative mb-6">
          <div className="h-1 bg-slate-100 rounded-full">
            <div className="h-1 bg-[#02066F] rounded-full transition-all duration-1000" style={{ width: `${order.progress}%` }} />
          </div>
          <div className="flex justify-between mt-3">
            {['Confirmed', 'Processing', 'Shipped', 'Delivered'].map((step, i) => (
              <div key={step} className="flex flex-col items-center">
                <div className={`w-3 h-3 rounded-full border-2 ${order.progress >= (i + 1) * 25
                  ? 'bg-[#02066F] border-[#02066F]'
                  : 'bg-white border-slate-300'
                  }`} />
                <span className={`text-xs mt-2 ${order.progress >= (i + 1) * 25 ? t.text + ' font-medium' : t.textMuted
                  }`}>{step}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 bg-slate-50 rounded-xl">
            <p className={`text-xs ${t.textMuted} font-medium uppercase tracking-wide`}>Estimated Delivery</p>
            <p className={`text-sm font-semibold ${t.text} mt-1`}>{order.eta}</p>
          </div>
          <div className="p-4 bg-slate-50 rounded-xl">
            <p className={`text-xs ${t.textMuted} font-medium uppercase tracking-wide`}>Carrier</p>
            <p className={`text-sm font-semibold ${t.text} mt-1`}>{order.carrier}</p>
          </div>
        </div>
      </div>

      <div className={`px-5 py-4 bg-slate-50 border-t ${t.borderLight}`}>
        <button className={`w-full py-3 ${t.button} text-sm font-semibold rounded-xl transition-colors`}>
          View Full Details
        </button>
      </div>
    </div>
  );
};

// Appointment Card
const AppointmentCard = ({ appointment }) => {
  const t = theme;
  return (
    <div className={`mt-4 ${t.card} rounded-2xl border ${t.border} overflow-hidden`}>
      <div className={`px-5 py-4 border-b ${t.borderLight}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center">
              {Icons.calendar}
            </div>
            <div>
              <p className={`font-semibold ${t.text}`}>{appointment.title}</p>
              <p className={`text-sm ${t.textSecondary}`}>{appointment.type}</p>
            </div>
          </div>
          <div className="px-3 py-1.5 bg-blue-500/10 text-blue-600 rounded-full text-xs font-semibold">
            Confirmed
          </div>
        </div>
      </div>

      <div className="px-5 py-4 grid grid-cols-3 gap-4">
        <div>
          <p className={`text-xs ${t.textMuted} font-medium uppercase tracking-wide`}>Date</p>
          <p className={`text-sm font-semibold ${t.text} mt-1`}>{appointment.date}</p>
        </div>
        <div>
          <p className={`text-xs ${t.textMuted} font-medium uppercase tracking-wide`}>Time</p>
          <p className={`text-sm font-semibold ${t.text} mt-1`}>{appointment.time}</p>
        </div>
        <div>
          <p className={`text-xs ${t.textMuted} font-medium uppercase tracking-wide`}>Duration</p>
          <p className={`text-sm font-semibold ${t.text} mt-1`}>{appointment.duration}</p>
        </div>
      </div>

      <div className={`px-5 py-4 bg-slate-50 border-t ${t.borderLight} flex gap-3`}>
        <button className={`flex-1 py-3 ${t.buttonSecondary} text-sm font-semibold rounded-xl transition-colors`}>
          Reschedule
        </button>
        <button className={`flex-1 py-3 ${t.button} text-sm font-semibold rounded-xl transition-colors`}>
          Join Meeting
        </button>
      </div>
    </div>
  );
};

// Document Card
const DocumentCard = ({ document }) => {
  const t = theme;
  return (
    <div className={`mt-4 ${t.card} rounded-2xl border ${t.border} p-4`}>
      <div className="flex items-center gap-4">
        <div className={`w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center ${t.textSecondary}`}>
          {Icons.document}
        </div>
        <div className="flex-1 min-w-0">
          <p className={`font-semibold ${t.text} truncate`}>{document.name}</p>
          <p className={`text-sm ${t.textSecondary}`}>{document.size} • {document.type}</p>
        </div>
        <button className={`w-10 h-10 rounded-xl ${t.buttonSecondary} flex items-center justify-center transition-colors`}>
          {Icons.download}
        </button>
      </div>
    </div>
  );
};

// PDF Attachment and Chart Message components are now imported from separate files

// Message Actions Component (Like, Dislike, Copy, etc.)
const MessageActions = ({ message, feedback, onLike, onDislike, onCopy, onPrevResponse, onNextResponse, hasChatBackground = false }) => {
  const [copied, setCopied] = useState(false);
  const { snappy } = useMotionSprings();
  const themeStyles = theme;
  const timeClass = hasChatBackground
    ? 'text-xs text-slate-900 font-medium [text-shadow:0_1px_2px_rgba(255,255,255,0.95),0_0_10px_rgba(255,255,255,0.5)]'
    : `text-xs ${themeStyles.textMuted}`;
  const btnIcon = 'inline-flex items-center justify-center transition-colors [padding:0] [margin:0] [border:none] [background:transparent] [line-height:1] cursor-pointer';
  const iconIdle = hasChatBackground
    ? `${btnIcon} text-slate-900 [filter:drop-shadow(0_1px_1px_rgba(255,255,255,0.9))] hover:text-[#02066F]`
    : `${btnIcon} text-[#6B7280] hover:text-[#02066F]`;
  const iconPicked = hasChatBackground
    ? `${btnIcon} text-[#02066F] [filter:drop-shadow(0_1px_1px_rgba(255,255,255,0.85))]`
    : `${btnIcon} text-[#02066F]`;

  // Handle copy to clipboard
  const handleCopy = () => {
    const textToCopy = message.responses?.[message.activeResponseIndex || 0]?.text || message.content || '';
    navigator.clipboard.writeText(textToCopy).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    });
    if (onCopy) onCopy();
  };

  const responses = message.responses || [{ text: message.content || '' }];
  const activeIndex = message.activeResponseIndex || 0;
  const hasMultipleResponses = responses.length > 1;

  const messageFeedback = feedback || 'none'; // 'like', 'dislike', or 'none'

  return (
    <div className="flex items-center gap-2 -mt-1 flex-wrap">
      {/* Timestamp */}
      <span className={`${timeClass} shrink-0`}>{message.time || 'Just now'}</span>

      {/* Action Buttons */}
      <div className="flex items-center gap-2">
        {/* Like Button - Show only if not disliked */}
        {messageFeedback !== 'dislike' && (
          <motion.button
            type="button"
            onClick={onLike}
            className={messageFeedback === 'like' ? iconPicked : iconIdle}
            title="Like"
            whileTap={{ scale: 1.4 }}
            transition={snappy}
            style={{ willChange: 'transform' }}
          >
            <svg className="w-4 h-4" fill={messageFeedback === 'like' ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
            </svg>
          </motion.button>
        )}

        {/* Dislike Button - Show only if not liked */}
        {messageFeedback !== 'like' && (
          <motion.button
            type="button"
            onClick={onDislike}
            className={messageFeedback === 'dislike' ? iconPicked : iconIdle}
            title="Dislike"
            whileTap={{ scale: 1.4 }}
            transition={snappy}
            style={{ willChange: 'transform' }}
          >
            <svg className="w-4 h-4" fill={messageFeedback === 'dislike' ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14H5.236a2 2 0 01-1.789-2.894l3.5-7A2 2 0 018.736 3h4.018a2 2 0 01.485.06l3.76.94m-7 10v5a2 2 0 002 2h.096c.5 0 .905-.405.905-.904 0-.715.211-1.413.608-2.008L17 13V4m-7 10h2m5-10h2a2 2 0 012 2v6a2 2 0 01-2 2h-2.5" />
            </svg>
          </motion.button>
        )}

        <motion.button
          type="button"
          onClick={handleCopy}
          className={iconIdle}
          title="Copy message"
          style={{ willChange: 'transform' }}
        >
          <AnimatePresence mode="wait" initial={false}>
            {copied ? (
              <motion.span
                key="check"
                className="inline-flex"
                initial={{ scale: 0, rotate: -45 }}
                animate={{ scale: 1, rotate: 0 }}
                exit={{ scale: 0 }}
                transition={snappy}
              >
                <span className="text-[#2DA44E] text-xs leading-none" aria-hidden>✓</span>
              </motion.span>
            ) : (
              <motion.span
                key="copy"
                className="inline-flex"
                initial={{ scale: 1 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
                transition={snappy}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </motion.span>
            )}
          </AnimatePresence>
        </motion.button>
      </div>

      {/* Response Navigation */}
      {hasMultipleResponses && (
        <div
          className={
            hasChatBackground
              ? 'flex items-center gap-2 px-2 py-1 rounded-lg bg-white/70 backdrop-blur-sm border border-white/50'
              : 'flex items-center gap-2 px-2 py-1 rounded-lg bg-slate-100'
          }
        >
          <button
            onClick={onPrevResponse}
            disabled={activeIndex === 0}
            className={`w-6 h-6 rounded flex items-center justify-center transition-colors disabled:opacity-40 disabled:cursor-not-allowed hover:text-[#02066F] ${hasChatBackground ? 'text-slate-900 hover:bg-white/80 [filter:drop-shadow(0_1px_1px_rgba(255,255,255,0.85))]' : 'hover:bg-white text-[#6B7280]'}`}
            title="Previous response"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <span
            className={`text-xs font-medium min-w-[2.5rem] text-center ${hasChatBackground ? 'text-slate-900 [text-shadow:0_1px_2px_rgba(255,255,255,0.9)]' : 'text-[#6B7280]'}`}
          >
            {activeIndex + 1} / {responses.length}
          </span>
          <button
            onClick={onNextResponse}
            disabled={activeIndex === responses.length - 1}
            className={`w-6 h-6 rounded flex items-center justify-center transition-colors disabled:opacity-40 disabled:cursor-not-allowed hover:text-[#02066F] ${hasChatBackground ? 'text-slate-900 hover:bg-white/80 [filter:drop-shadow(0_1px_1px_rgba(255,255,255,0.85))]' : 'hover:bg-white text-[#6B7280]'}`}
            title="Next response"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
};

const AnimatedStreamingText = ({ text, isStreaming }) => {
  const [displayText, setDisplayText] = React.useState('');
  const processedRef = React.useRef(0);
  const queueRef = React.useRef('');
  const timerRef = React.useRef(null);

  // When new text arrives, queue only the truly new characters
  React.useEffect(() => {
    if (!text) {
      processedRef.current = 0;
      queueRef.current = '';
      setDisplayText('');
      return;
    }
    // processedRef tracks how many chars of `text` we have
    // already put into the queue — no stale closure possible
    const newChars = text.slice(processedRef.current);
    if (newChars.length > 0) {
      queueRef.current += newChars;
      processedRef.current = text.length;
    }
  }, [text]);

  // Drip timer — runs independently, drains queue char by char
  React.useEffect(() => {
    const drip = () => {
      if (queueRef.current.length > 0) {
        const chunkSize = queueRef.current.length > 50 ? 2 : 1;
        const next = queueRef.current.slice(0, chunkSize);
        queueRef.current = queueRef.current.slice(chunkSize);
        setDisplayText(prev => prev + next);
      }
      timerRef.current = setTimeout(drip, 12);
    };
    timerRef.current = setTimeout(drip, 12);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  // Full reset when new conversation starts
  React.useEffect(() => {
    if (text === '') {
      setDisplayText('');
      queueRef.current = '';
      processedRef.current = 0;
    }
  }, [text]);

  const hasTable = displayText.includes('|') && displayText.includes('---');

  return (
    <ReactMarkdown
        remarkPlugins={hasTable ? [remarkGfm] : []}
        rehypePlugins={[rehypeRaw]}
        components={{
          p: ({node, ...props}) => (
            <p className="text-[15px] leading-relaxed" {...props} />
          ),
          li: ({node, ...props}) => (
            <li className="text-[15px] leading-relaxed" {...props} />
          ),
          h3: ({node, ...props}) => (
            <h3 className="font-semibold text-base mb-1 mt-2" {...props} />
          ),
          strong: ({node, ...props}) => (
            <strong className="font-semibold" {...props} />
          ),
        }}
      >
        {displayText}
      </ReactMarkdown>
  );
};

// Message Component
const Message = ({
  message,
  isUser,
  isStreaming,
  onCopy,
  onPrevResponse,
  onNextResponse,
  chatbotConfig,
  messageFeedback,
  onLike,
  onDislike,
  hasChatBackground = false,
  flyInFromComposer = false,
  onFlyInComplete,
}) => {
  const t = theme;
  const springs = useMotionSprings();
  const aiBubbleVariants = {
    hidden: { opacity: 0, y: 14, scale: 0.97, filter: 'blur(2px)' },
    visible: {
      opacity: 1,
      y: 0,
      scale: 1,
      filter: 'blur(0px)',
      transition: { ...springs.natural, opacity: { duration: springs.prefersReduced ? 0 : 0.18 } },
    },
  };
  const aiBubbleRowRef = useRef(null);
  const userFlyRowRef = useRef(null);
  const userTimeClass = hasChatBackground
    ? 'text-xs text-slate-900 font-medium [text-shadow:0_1px_2px_rgba(255,255,255,0.95),0_0_10px_rgba(255,255,255,0.5)]'
    : `text-xs ${t.textMuted}`;

  const renderContent = () => {
    // Get active response text if responses array exists
    let content = message.responses?.[message.activeResponseIndex || 0]?.text || message.content || '';

    // Handle Vision API content stored as JSON strings or direct arrays/objects
    if (typeof content === 'string' && content.trim().startsWith('[')) {
      try {
        content = JSON.parse(content);
      } catch (e) {
        // If parsing fails, keep as string
        content = content;
      }
    }

    // Now handle the parsed content (could be array, object, or string)
    if (Array.isArray(content)) {
      // Vision API format: [{ type: "text", text: ... }, { type: "image_url", image_url: { url: ... } }]
      const textPart = content.find(item => item.type === 'text');
      content = textPart ? textPart.text : 'Image analysis request';
    } else if (typeof content === 'object' && content !== null) {
      content = content.text || content.content || 'Content';
    }

    const activeResponseText = content;

    // Check if message has an attachment
    if (message.attachment) {
      const { type, fileName, fileUrl, fileSize } = message.attachment;
      return (
        <div className="space-y-2">
          {activeResponseText && <p className="text-[15px] leading-relaxed whitespace-pre-wrap">{activeResponseText}</p>}
          {type === 'pdf' && <PDFAttachment fileName={fileName} fileUrl={fileUrl} fileSize={fileSize} />}
          {type === 'image' && <ImageAttachment fileName={fileName} fileUrl={fileUrl} />}
        </div>
      );
    }

    if (message.type === 'pdf' && message.file) {
      return (
        <div className="space-y-2">
          {activeResponseText && <p className="text-[15px] leading-relaxed whitespace-pre-wrap">{activeResponseText}</p>}
          <PDFAttachment {...message.file} />
        </div>
      );
    }

    if (message.type === 'chart' && message.chart) {
      return (
        <div className="space-y-2">
          {activeResponseText && <p className="text-[15px] leading-relaxed whitespace-pre-wrap mb-3">{activeResponseText}</p>}
          <ChartMessage {...message.chart} />
        </div>
      );
    }

    if (message.type === 'multi') {
      return (
        <div className="space-y-3">
          {activeResponseText && <p className="text-[15px] leading-relaxed whitespace-pre-wrap">{activeResponseText}</p>}
          {message.files?.map((file, index) => (
            <PDFAttachment key={index} {...file} />
          ))}
          {message.chart && <ChartMessage {...message.chart} />}
        </div>
      );
    }

    // Default text message - use ReactMarkdown for bot messages, plain text for user messages
    if (isUser) {
      return <p className="text-[15px] leading-relaxed whitespace-pre-wrap m-0">{activeResponseText}</p>;
    } else {
      if (isStreaming) {
        return (
          <div className="markdown-content [&>*:last-child]:mb-0" style={{ transition: 'opacity 0.1s ease' }}>
            <AnimatedStreamingText text={typeof activeResponseText === 'string' ? activeResponseText : ''} isStreaming={isStreaming} />
          </div>
        );
      }
      // Check if response contains table markdown to determine if we need remark-gfm
      const hasTable = activeResponseText.includes('|') && activeResponseText.includes('---');

      return (
        <div className="markdown-content [&>*:last-child]:mb-0">
          <ReactMarkdown
            remarkPlugins={hasTable ? [remarkGfm] : []}
            rehypePlugins={[rehypeRaw]}
            components={{
              h1: ({ children }) => <h1 className="text-2xl font-bold mb-3">{children}</h1>,
              h2: ({ children }) => <h2 className="text-xl font-bold mb-3">{children}</h2>,
              h3: ({ children }) => <h3 className="text-lg font-semibold mb-2">{children}</h3>,

              table: ({ children }) => (
                <table className="ai-table">{children}</table>
              ),
              thead: ({ children }) => <thead>{children}</thead>,
              tbody: ({ children }) => <tbody>{children}</tbody>,
              tr: ({ children }) => <tr>{children}</tr>,
              th: ({ children }) => <th>{children}</th>,
              td: ({ children }) => <td>{children}</td>,

              p: ({ children }) => <p className="text-[15px] leading-relaxed">{children}</p>,
              strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
              em: ({ children }) => <em className="italic">{children}</em>,
              ul: ({ children }) => <ul className="list-disc ml-4 space-y-1">{children}</ul>,
              ol: ({ children }) => <ol className="list-decimal ml-4 space-y-1">{children}</ol>,
              li: ({ children }) => <li className="text-[15px] leading-relaxed">{children}</li>,
              code: ({ inline, children }) => inline ?
                <code className="bg-slate-100 px-2 py-1 rounded text-sm font-mono">{children}</code> :
                <code className="block bg-slate-100 p-3 rounded text-sm font-mono whitespace-pre-wrap">{children}</code>,
              blockquote: ({ children }) => <blockquote className="border-l-4 border-slate-300 pl-4 italic text-slate-700">{children}</blockquote>,
            }}
          >
            {activeResponseText}
          </ReactMarkdown>
        </div>
      );
    }
  };

  const userFlyMotion = isUser && flyInFromComposer;
  const rowClassName = `${MESSAGE_ROW_FLEX_CLASS} ${isUser ? 'justify-end' : 'justify-start'} ${MESSAGE_THREAD_GAP_CLASS} ${userFlyMotion || !isUser ? '' : 'animate-fadeIn'}`;

  const streamingCursor = isStreaming && !message.type && (
    <motion.span
      className="mt-1.5 inline-block h-4 w-px shrink-0 rounded-full bg-[#1F3A5F] align-text-bottom"
      aria-hidden
      animate={{
        opacity: [1, 0.15, 1],
        scaleY: [1, 0.85, 1],
        boxShadow: [
          '0 0 0px rgba(2, 6, 111, 0)',
          '0 0 6px rgba(2, 6, 111, 0.7)',
          '0 0 0px rgba(2, 6, 111, 0)',
        ],
      }}
      transition={{
        duration: springs.prefersReduced ? 0 : 0.9,
        repeat: springs.prefersReduced ? 0 : Infinity,
        ease: 'easeInOut',
      }}
      style={{ willChange: 'transform, opacity' }}
    />
  );

  const bubbleCard = isUser ? (
    <motion.div
      layoutId={flyInFromComposer ? 'userBubbleCard' : undefined}
      className={`px-5 py-4 rounded-2xl ${t.userBubble} rounded-br-md`}
      transition={springs.snappy}
      style={{ willChange: 'transform, opacity' }}
    >
      <div className="min-w-0 flow-root">
        {renderContent()}
        {streamingCursor}
      </div>
      {message.orderCard && <OrderStatusCard order={message.orderCard} />}
      {message.appointment && <AppointmentCard appointment={message.appointment} />}
      {message.document && <DocumentCard document={message.document} />}
    </motion.div>
  ) : (
    <motion.div
      className={`px-5 pt-4 pb-2.5 rounded-2xl ${t.aiBubble} rounded-bl-md rainbow-border-animated`}
      initial={{ scaleX: 0.96 }}
      animate={{ scaleX: 1 }}
      style={{ transformOrigin: '0% 50%', willChange: 'transform, opacity' }}
      transition={{ ...springs.snappy, delay: springs.prefersReduced ? 0 : 0.04 }}
    >
      <div className="min-w-0 flow-root">
        {renderContent()}
        {streamingCursor}
      </div>
      {message.orderCard && <OrderStatusCard order={message.orderCard} />}
      {message.appointment && <AppointmentCard appointment={message.appointment} />}
      {message.document && <DocumentCard document={message.document} />}
    </motion.div>
  );

  const rowInner = (
    <>
      {!isUser && (
        <img
          src={chatbotConfig?.assistant_logo_url || OmniAgentLogo}
          alt="AI Assistant"
          className="w-9 h-9 rounded-full object-cover flex-shrink-0"
          onError={(e) => {
            e.target.src = OmniAgentLogo; // Fallback to default logo if URL fails
          }}
        />
      )}

      <div className={`max-w-[65%] min-w-0`}>
        {bubbleCard}

        {isUser ? (
          <div className="flex items-center gap-2 mt-2 flex-wrap justify-end">
            <span className={userTimeClass}>{message.time}</span>
            <span
              className={
                hasChatBackground
                  ? 'text-[#1a7f37] [filter:drop-shadow(0_1px_1px_rgba(255,255,255,0.9))]'
                  : 'text-[#2DA44E]'
              }
            >
              {Icons.check}
            </span>
          </div>
        ) : (
          <MessageActions
            message={message}
            feedback={messageFeedback[message.id]}
            onLike={() => onLike(message.id)}
            onDislike={() => onDislike(message.id)}
            onCopy={onCopy}
            onPrevResponse={onPrevResponse}
            onNextResponse={onNextResponse}
            hasChatBackground={hasChatBackground}
          />
        )}
      </div>

      {isUser && (
        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center flex-shrink-0">
          <User className="w-5 h-5 text-slate-600" />
        </div>
      )}
    </>
  );

  if (userFlyMotion) {
    return (
      <motion.div
        ref={userFlyRowRef}
        className={rowClassName}
        initial={USER_BUBBLE_FLYIN_INITIAL}
        animate={{ opacity: 1, y: 0, x: 0, scale: 1 }}
        transition={USER_BUBBLE_FLYIN_TRANSITION}
        onAnimationComplete={() => {
          if (userFlyRowRef.current) userFlyRowRef.current.style.willChange = 'auto';
          onFlyInComplete?.();
        }}
        style={{ willChange: 'transform, opacity' }}
      >
        {rowInner}
      </motion.div>
    );
  }

  if (!isUser) {
    return (
      <motion.div
        ref={aiBubbleRowRef}
        className={rowClassName}
        variants={aiBubbleVariants}
        initial="hidden"
        animate="visible"
        style={{ willChange: 'transform, opacity' }}
        onAnimationComplete={() => {
          if (aiBubbleRowRef.current) aiBubbleRowRef.current.style.willChange = 'auto';
        }}
      >
        {rowInner}
      </motion.div>
    );
  }

  return <div className={rowClassName}>{rowInner}</div>;
};

// AI Thinking — Framer orbital dots + container enter/exit
const AIThinking = ({ logoUrl }) => {
  const springs = useMotionSprings();
  const aiThinkingContainerRef = useRef(null);
  const containerVariants = {
    hidden: { opacity: 0, y: 10, scale: 0.95 },
    visible: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: springs.natural,
    },
    exit: {
      opacity: 0,
      y: -6,
      scale: 0.95,
      transition: { duration: springs.prefersReduced ? 0 : 0.18, ease: 'easeIn' },
    },
  };

  return (
    <motion.div
      ref={aiThinkingContainerRef}
      className={`${MESSAGE_ROW_FLEX_CLASS} ${MESSAGE_THREAD_GAP_CLASS}`}
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      style={{ willChange: 'transform, opacity' }}
      onAnimationComplete={() => {
        if (aiThinkingContainerRef.current) aiThinkingContainerRef.current.style.willChange = 'auto';
      }}
    >
      <div className="relative flex-shrink-0">
        <motion.div
          className="absolute inset-0 rounded-full bg-[#02066F]/20"
          animate={
            springs.prefersReduced
              ? { scale: 1, opacity: 0 }
              : { scale: [1, 1.35, 1], opacity: [0.5, 0, 0.5] }
          }
          transition={{ duration: 2, repeat: springs.prefersReduced ? 0 : Infinity, ease: 'easeOut' }}
          style={{ willChange: 'transform, opacity' }}
        />
        <img
          src={logoUrl || OmniAgentLogo}
          alt=""
          className="w-9 h-9 rounded-full object-cover"
          onError={(e) => { e.target.src = OmniAgentLogo; }}
        />
      </div>

      <div className="bg-[#F3F4F6] border border-slate-200 rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-1.5">
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            className="block w-2 h-2 rounded-full bg-[#02066F]/50"
            animate={
              springs.prefersReduced
                ? { y: 0, opacity: 0.6, scale: 1 }
                : {
                    y: [-6, 0, -6],
                    opacity: [0.4, 1, 0.4],
                    scale: [0.85, 1.1, 0.85],
                  }
            }
            transition={{
              duration: 1.1,
              delay: i * 0.15,
              repeat: springs.prefersReduced ? 0 : Infinity,
              ease: 'easeInOut',
            }}
            style={{ willChange: 'transform, opacity' }}
          />
        ))}
      </div>
    </motion.div>
  );
};

// Quick Action
const QuickAction = ({ icon, label, description, onClick, className = '' }) => {
  const t = theme;
  const { snappy, natural } = useMotionSprings();
  return (
    <motion.button
      type="button"
      onClick={onClick}
      className={`quick-action-card flex items-start gap-4 p-4 bg-[#f0f0f0] rounded-xl border border-[#3c84e3] text-left group ${className}`}
      whileHover={{
        scale: 1.025,
        y: -2,
      }}
      whileTap={{ scale: 0.975, y: 0 }}
      transition={natural}
      style={{ willChange: 'transform' }}
    >
      <motion.div
        className="w-10 h-10 rounded-xl bg-[#02066F] flex items-center justify-center text-white"
        whileHover={{ rotate: -4, scale: 1.1 }}
        transition={snappy}
        style={{ willChange: 'transform' }}
      >
        {icon}
      </motion.div>
      <div className="flex-1">
        <span className={`text-sm font-semibold ${t.text}`}><T>{label}</T></span>
        <p className="text-xs text-[#4e5154] mt-0.5"><T>{description}</T></p>
      </div>
      <motion.span
        className={t.textMuted}
        whileHover={{ x: 3 }}
        transition={snappy}
        style={{ willChange: 'transform' }}
      >
        {Icons.chevronRight}
      </motion.span>
    </motion.button>
  );
};

// Settings Panel — mount only when open; exit via AnimatePresence parent
const SettingsPanel = ({ onClose }) => {
  const t = theme;
  const { gentle } = useMotionSprings();

  return (
    <motion.div
      className="fixed inset-0 z-50 flex justify-end"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      style={{ willChange: 'opacity' }}
    >
      <motion.div
        className="absolute inset-0 bg-[#02066F]/20 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        onClick={onClose}
        style={{ willChange: 'opacity' }}
      />
      <motion.div
        className={`relative w-96 ${t.sidebar} border-l ${t.border} h-full overflow-y-auto`}
        initial={{ x: '100%', opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: '100%', opacity: 0 }}
        transition={{ ...gentle }}
        style={{ willChange: 'transform, opacity' }}
      >
        <div className={`px-6 py-5 border-b ${t.borderLight} flex items-center justify-between`}>
          <h2 className={`font-semibold ${t.text}`}><T>Settings</T></h2>
          <button onClick={onClose} className={`w-8 h-8 rounded-lg ${t.buttonSecondary} flex items-center justify-center`}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* API Configuration */}
          <div>
            <h3 className={`text-xs font-semibold ${t.textMuted} uppercase tracking-wider mb-3`}><T>API Configuration</T></h3>
            <div className={`${t.card} rounded-xl border ${t.border} p-4 space-y-3`}>
              <div>
                <label className={`text-xs ${t.textMuted} font-medium`}><T>API Base URL</T></label>
                <input
                  type="text"
                  defaultValue={API_CONFIG.BASE_URL}
                  className={`w-full mt-1 px-3 py-2 ${t.input} border ${t.border} rounded-lg text-sm ${t.text}`}
                  readOnly
                />
              </div>
              <div>
                <label className={`text-xs ${t.textMuted} font-medium`}><T>Chatbot ID</T></label>
                <input
                  type="text"
                  defaultValue={API_CONFIG.CHATBOT_ID || 'Not configured'}
                  className={`w-full mt-1 px-3 py-2 ${t.input} border ${t.border} rounded-lg text-sm ${t.text}`}
                  readOnly
                />
              </div>
            </div>
          </div>
        </div>

        <div className={`p-6 border-t ${t.borderLight}`}>
          <p className={`text-xs ${t.textMuted} text-center`}>Troika Tech v3.0.1</p>
        </div>
      </motion.div>
    </motion.div>
  );
};

// ============================================
// MAIN APPLICATION
// ============================================
// Generate initial unique conversation ID
const generateUniqueConversationId = () => `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

// Flow Translations
const FLOW_TRANSLATIONS = {
  'English': {
    channel_selection: 'How would you like to receive the proposal?\n\n1. WhatsApp\n2. Email\n\nPlease type 1 or 2, or say "WhatsApp" or "Email".',
    proposal_confirmation: 'Would you like me to send the proposal to your WhatsApp number?',
    email_confirmation: 'Would you like to receive this via email?',
    calling_confirmation: 'Would you like me to connect you via a call?',
    auth_required: 'Please authenticate with your phone number to receive the proposal.',
  },
  'Hindi': {
    channel_selection: 'Aap proposal kaise prapt karna chahenge?\n\n1. WhatsApp\n2. Email\n\nKrupaya 1 ya 2 type karein, ya khein "WhatsApp" ya "Email".',
    proposal_confirmation: 'Kya aap chahenge ki main aapke WhatsApp number par proposal bhej doon?',
    email_confirmation: 'Kya aap ise email ke madhyam se prapt karna chahenge?',
    calling_confirmation: 'Kya aap chahenge ki main aapko call ke madhyam se connect karoon?',
    auth_required: 'Proposal prapt karne ke liye krupaya apne phone number ke saath authenticate karein.',
  },
  // Add other languages here as needed
};

// Helper to get translated string - defaults to English if language/key missing
const getFlowString = (language, key, defaultText = '') => {
  const langKey = FLOW_TRANSLATIONS[language] ? language : 'English';
  return FLOW_TRANSLATIONS[langKey][key] || defaultText || FLOW_TRANSLATIONS['English'][key];
};

export default function NovaPremiumEnterprise() {
  const uiSprings = useMotionSprings();
  const shellSidebarControls = useAnimationControls();
  const shellHeaderControls = useAnimationControls();
  const shellMainControls = useAnimationControls();
  const welcomeComposerControls = useAnimationControls();
  const welcomeQuickActionsControls = useAnimationControls();
  const [welcomeAfterSidebarIntro, setWelcomeAfterSidebarIntro] = useState(false);
  const shellMountTimelineDoneRef = useRef(false);

  const { currentLanguage, changeLanguage, t: translate } = useTranslation();

  // Authentication state
  const { sendOtp, verifyOtp, loading: authLoading, error: authError, resendCooldown, userInfo, isAuthenticated, logout, updateUserInfo, authToken } = useAuth();

  const [authPhone, setAuthPhone] = useState('');
  const [authOtp, setAuthOtp] = useState('');
  const [authName, setAuthName] = useState('');
  const [showAuthForm, setShowAuthForm] = useState(false);
  const [authErrorBanner, setAuthErrorBanner] = useState(false);
  const [messageCount, setMessageCount] = useState(0);
  /** Triggers one-shot fly-in from composer for the matching user message id. */
  const [userBubbleFlyInId, setUserBubbleFlyInId] = useState(null);
  const clearUserBubbleFlyIn = useCallback(() => {
    setUserBubbleFlyInId(null);
  }, []);
  const MESSAGE_LIMIT = 1;

  // Generate unique ID for initial conversation
  const initialConversationId = generateUniqueConversationId();

  const [activeConversation, setActiveConversation] = useState(0);
  const [conversations, setConversations] = useState([
    {
      id: initialConversationId,
      initials: 'T', // Default initial, will be updated when config loads
      title: 'Active Chat',
      preview: 'Ready to chat',
      time: 'Now',
      unread: false,
    }
  ]);
  const [activeConversationId, setActiveConversationId] = useState(initialConversationId);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [isAIProcessing, setIsAIProcessing] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [headerLangDropdownOpen, setHeaderLangDropdownOpen] = useState(false);
  const [langDropdownOpen, setLangDropdownOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const sidebarMobileRef = useRef(null);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });
  const [sidebarSearch, setSidebarSearch] = useState('');
  const [recentChatsOpen, setRecentChatsOpen] = useState(false);
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [logoutDropdownOpen, setLogoutDropdownOpen] = useState(false);
  const [sendAnimKey, setSendAnimKey] = useState(0);
  const [justSent, setJustSent] = useState(false);
  const [welcomeComposerFocused, setWelcomeComposerFocused] = useState(false);
  const [chatInputFocused, setChatInputFocused] = useState(false);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const [headerNavActiveKey, setHeaderNavActiveKey] = useState(null);
  const [headerNavHoverKey, setHeaderNavHoverKey] = useState(null);
  const [newConvRipples, setNewConvRipples] = useState([]);
  /** false on mobile (≤768px) so inner sidebar strip does not mount with x:-100% before matchMedia runs. */
  const [shellSidebarSlideEnabled, setShellSidebarSlideEnabled] = useState(() =>
    typeof window !== 'undefined' ? !window.matchMedia('(max-width: 768px)').matches : true,
  );
  const [messageFeedback, setMessageFeedback] = useState({}); // {messageId: 'like' | 'dislike'}
  const [isConfigLoaded, setIsConfigLoaded] = useState(false);

  // Proposal & Intent State
  const [proposalConfig, setProposalConfig] = useState(null);
  const [intentConfig, setIntentConfig] = useState(null);
  const [proposalConfirmationPending, setProposalConfirmationPending] = useState(false);
  const [templateSelectionPending, setTemplateSelectionPending] = useState(false);
  const [proposalQuestionTime, setProposalQuestionTime] = useState(null);
  const [showProposalModal, setShowProposalModal] = useState(false);
  const [sendingProposal, setSendingProposal] = useState(false);

  // Placeholder state for Email and Calling configs
  const [emailConfig, setEmailConfig] = useState(null);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [selectedEmailTemplate, setSelectedEmailTemplate] = useState(null);
  const [emailInput, setEmailInput] = useState('');
  const [emailError, setEmailError] = useState('');
  const [sendingEmail, setSendingEmail] = useState(false);
  const [showPremiumModal, setShowPremiumModal] = useState(false);
  const [showCalendlyModal, setShowCalendlyModal] = useState(false);
  const [calendlyLoading, setCalendlyLoading] = useState(true);
  const [calendlyConfig, setCalendlyConfig] = useState(null);

  // Email Intent State (similar to proposal intent)
  const [emailIntentConfig, setEmailIntentConfig] = useState(null);
  const [emailConfirmationPending, setEmailConfirmationPending] = useState(false);
  const [emailTemplateSelectionPending, setEmailTemplateSelectionPending] = useState(false);
  const [emailQuestionTime, setEmailQuestionTime] = useState(null);

  // Calling flow states
  const [callingConfig, setCallingConfig] = useState(null);
  const [callingConfirmationPending, setCallingConfirmationPending] = useState(false);
  const [callingQuestionTime, setCallingQuestionTime] = useState(null);
  const [isInitiatingCall, setIsInitiatingCall] = useState(false);

  // Channel Selection State (for unified proposal flow when both WhatsApp and Email are enabled)
  const [channelSelectionPending, setChannelSelectionPending] = useState(false);
  const [selectedChannel, setSelectedChannel] = useState(null); // 'whatsapp' or 'email'
  const channelSelectionTriggeredRef = useRef(false); // Ref to prevent duplicate triggers

  // Intent context from backend (product name, etc.) - populated when proposal/email intent is detected
  const [intentContextData, setIntentContextData] = useState(null);

  // Custom Navigation Items State
  const [customNavItems, setCustomNavItems] = useState([]);

  // Handle like/dislike feedback
  const handleLike = (messageId) => {
    setMessageFeedback(prev => ({
      ...prev,
      [messageId]: prev[messageId] === 'like' ? 'none' : 'like'
    }));
  };

  const handleDislike = (messageId) => {
    setMessageFeedback(prev => ({
      ...prev,
      [messageId]: prev[messageId] === 'dislike' ? 'none' : 'dislike'
    }));
  };

  // Search debouncing
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(sidebarSearch);
    }, 500);
    return () => clearTimeout(timer);
  }, [sidebarSearch]);

  // Core Chat State & Refs
  const [messages, setMessages] = useState([]);
  const messagesRef = useRef(messages);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);
  const [inputValue, setInputValue] = useState('');
  const [showActions, setShowActions] = useState(true);
  const [selectedFile, setSelectedFile] = useState(null);
  const fileInputRef = useRef(null);
  const [sessionId, setSessionId] = useState(null); // Initialize as null, will be set properly after auth check

  // Initialize session ID properly after auth context is ready
  React.useEffect(() => {
    if (sessionId === null) { // Only initialize if not already set
      if (isAuthenticated && userInfo?.phone) {
        // For authenticated users, use a consistent session ID based on phone
        // This ensures the same user always has the same session across conversations
        const authSessionId = `auth_session_${userInfo.phone}`;
        console.log('🔄 [INIT] Using consistent authenticated session ID:', authSessionId, 'for phone:', userInfo.phone);
        setSessionId(authSessionId);
      } else {
        // For guests, create ephemeral session ID
        const guestSessionId = `guest_session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        console.log('🔄 [INIT] Creating guest session ID:', guestSessionId);
        setSessionId(guestSessionId);
      }
    }
  }, [isAuthenticated, userInfo, sessionId]);

  // Debug: Track authentication state changes
  React.useEffect(() => {
    console.log('🔐 [AUTH STATE] Changed:', {
      isAuthenticated,
      userInfo,
      phone: userInfo?.phone,
      sessionId
    });
  }, [isAuthenticated, userInfo, sessionId]);

  const suggestionDebounceRef = useRef(null);
  /** Dev-only: log “empty suggestions” once per page load (avoids spam on every keystroke). */
  const suggestionEmptyListDevLoggedRef = useRef(false);
  const [chatSuggestions, setChatSuggestions] = useState([]);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1);

  const applySuggestion = useCallback((value) => {
    setInputValue(value);
    setChatSuggestions([]);
    setActiveSuggestionIndex(-1);
  }, []);

  const handleSuggestionKeyDown = useCallback(
    (e) => {
      if (e.key === 'Escape') {
        if (chatSuggestions.length) {
          setChatSuggestions([]);
          setActiveSuggestionIndex(-1);
          e.preventDefault();
          return true;
        }
        return false;
      }
      if (chatSuggestions.length > 0) {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          setActiveSuggestionIndex((i) => Math.min(i + 1, chatSuggestions.length - 1));
          return true;
        }
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          setActiveSuggestionIndex((i) => Math.max(i - 1, -1));
          return true;
        }
        if (e.key === 'Enter' && !e.shiftKey && activeSuggestionIndex >= 0) {
          e.preventDefault();
          applySuggestion(chatSuggestions[activeSuggestionIndex]);
          return true;
        }
        if (e.key === 'Tab' && activeSuggestionIndex >= 0) {
          e.preventDefault();
          applySuggestion(chatSuggestions[activeSuggestionIndex]);
          return true;
        }
      }
      return false;
    },
    [chatSuggestions, activeSuggestionIndex, applySuggestion]
  );

  useEffect(() => {
    const prefix = inputValue.trim();
    if (countWords(prefix) < 2) {
      setChatSuggestions([]);
      setActiveSuggestionIndex(-1);
      return;
    }
    if (suggestionDebounceRef.current) clearTimeout(suggestionDebounceRef.current);
    suggestionDebounceRef.current = setTimeout(async () => {
      if (!API_CONFIG.CHATBOT_ID) return;
      const ctx = inferChatContext(messagesRef.current);
      const params = new URLSearchParams({
        prefix,
        chatbotId: API_CONFIG.CHATBOT_ID,
        userId: sessionId || '',
      });
      if (ctx) {
        params.set('context', ctx);
        params.set('topic', ctx);
      }
      try {
        const url = `${API_CONFIG.BASE_URL}/chat/suggestions?${params}`;
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          const list = Array.isArray(data.suggestions) ? data.suggestions : [];
          setChatSuggestions(list);
          setActiveSuggestionIndex(-1);
          if (
            import.meta.env.DEV &&
            list.length === 0 &&
            !suggestionEmptyListDevLoggedRef.current
          ) {
            suggestionEmptyListDevLoggedRef.current = true;
            const id = API_CONFIG.CHATBOT_ID;
            console.warn(
              '[suggestions] 0 results: Redis has no KB/popular lines for this bot yet (or prefix matched nothing). ' +
                'Fix: POST /api/chat/suggestions/reseed-kb/' +
                id +
                ' with OPENAI_API_KEY + Mongo KB content, then refresh. (This message shows once per load.)'
            );
          }
        } else if (import.meta.env.DEV) {
          const errText = await res.text().catch(() => '');
          console.warn('[suggestions] HTTP', res.status, errText || res.statusText, url);
          setChatSuggestions([]);
        }
      } catch (e) {
        if (import.meta.env.DEV) {
          console.warn('[suggestions] fetch failed:', e?.message || e, API_CONFIG.BASE_URL);
        }
        setChatSuggestions([]);
      }
    }, 300);
    return () => {
      if (suggestionDebounceRef.current) clearTimeout(suggestionDebounceRef.current);
    };
  }, [inputValue, sessionId]);

  const recordSuggestionQuery = useCallback((query) => {
    const q = (query || '').trim();
    if (q.length < 2 || !API_CONFIG.CHATBOT_ID || !sessionId) return;
    void fetch(`${API_CONFIG.BASE_URL}/chat/suggestions/record`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: q,
        chatbotId: API_CONFIG.CHATBOT_ID,
        userId: sessionId,
      }),
    }).catch(() => {});
  }, [sessionId]);

  const [chatbotConfig, setChatbotConfig] = useState({
    assistant_logo_url: null,
    assistant_display_name: 'Troika Tech Services',
    sidebar_branding: {
      enabled: false,
      branding_logo_url: null,
      branding_logo_link: null,
      branding_text: 'OmniAgent',
      branding_company: 'Troika Tech'
    },
    header_logo_url: null,
    header_logo_link: null,
    welcome_text: 'Welcome to Troika Tech Services',
    welcome_text_enabled: false, // Default to false (hidden) until explicitly enabled
    welcome_rotating_two_lines: true,
    tab_title: null,
    favicon_url: null,
    input_placeholders_enabled: false,
    input_placeholders: [],
    input_placeholder_speed: 2.5,
    input_placeholder_animation: 'fade', // or typewriter
    header_text: '',
    header_enabled: false,
    header_nav_enabled: true,
    header_nav_items: [],
    whatsapp_mode: 'redirect',
    call_mode: 'redirect',
    chat_background: {
      enabled: false,
      image_url: '',
      opacity: 10,
      style: 'watermark',
    },
  });

  const chatBodyBackgroundLayers = useMemo(() => {
    const bg = chatbotConfig.chat_background;
    if (!bg?.enabled || !String(bg.image_url || '').trim()) return null;
    const o = Math.min(80, Math.max(5, Number(bg.opacity) || 10));
    const overlay = 1 - o / 100;
    const st = bg.style || 'watermark';
    const size = st === 'watermark' ? '300px' : st === 'pattern' ? '200px' : 'cover';
    const repeat = st === 'pattern' ? 'repeat' : 'no-repeat';
    const url = String(bg.image_url).trim();
    const blurPx = ((80 - o) / 75) * 8;
    const useBlur = blurPx >= 0.5;
    return {
      blurLayer: {
        backgroundImage: `url(${url})`,
        backgroundSize: size,
        backgroundRepeat: repeat,
        backgroundPosition: 'center',
        filter: useBlur ? `blur(${blurPx}px)` : 'none',
      },
      overlayLayer: {
        backgroundImage: `linear-gradient(rgba(255,255,255,${overlay}), rgba(255,255,255,${overlay}))`,
      },
    };
  }, [chatbotConfig.chat_background]);

  const hasChatBackground = useMemo(() => {
    const bg = chatbotConfig.chat_background;
    return !!(bg?.enabled && String(bg?.image_url || '').trim());
  }, [chatbotConfig.chat_background]);

  const resolvedHeaderNavItems = useMemo(() => {
    if (chatbotConfig?.header_nav_enabled === false) return [];
    const custom = chatbotConfig?.header_nav_items;
    if (Array.isArray(custom) && custom.length > 0) {
      return custom
        .map((x) => ({
          label: String(x?.label || '').trim(),
          prompt: String(x?.prompt || '').trim(),
        }))
        .filter((x) => x.label && x.prompt);
    }
    return [
      { label: 'About us', prompt: HEADER_KB_PROMPTS.about },
      { label: 'Services', prompt: HEADER_KB_PROMPTS.services },
      { label: 'Contact', prompt: HEADER_KB_PROMPTS.contact },
    ];
  }, [chatbotConfig?.header_nav_enabled, chatbotConfig?.header_nav_items]);

  // A user has access if they are logged in OR if the auth system is completely turned off
  const hasFullAccess = isAuthenticated || !chatbotConfig?.authentication_enabled;

  // Fetch chatbot configuration on load
  useEffect(() => {
    const fetchConfig = async () => {
      if (!API_CONFIG.CHATBOT_ID) {
        console.log('⚠️ No CHATBOT_ID configured, using default settings');
        setIsConfigLoaded(true);
        return;
      }

      try {
        console.log('📡 [Config] Fetching for:', API_CONFIG.CHATBOT_ID);
        const response = await fetch(`${API_CONFIG.BASE_URL}/chatbot/${API_CONFIG.CHATBOT_ID}/config`);

        if (response.ok) {
          const result = await response.json();
          if (result.success && result.data) {
            console.log('✅ [Config] Loaded successfully:', result.data);
            console.log('🔐 [AUTH] authentication_enabled from config:', result.data.settings?.authentication?.isEnabled);

            // Map API response to state structure
            setChatbotConfig({
              assistant_logo_url: result.data.assistant_logo_url || null,
              assistant_display_name: result.data.assistant_display_name || 'Troika Tech Services',
              sidebar_branding: {
                enabled: result.data.sidebar_branding?.enabled || false,
                branding_logo_url: result.data.sidebar_branding?.branding_logo_url || null,
                branding_logo_link: result.data.sidebar_branding?.branding_logo_link || null,
                branding_text: result.data.sidebar_branding?.branding_text || 'OmniAgent',
                branding_company: result.data.sidebar_branding?.branding_company || 'Troika Tech'
              },
              header_logo_url: result.data.header_logo_url || null,
              header_logo_link: result.data.header_logo_link || null,
              welcome_text: result.data.welcome_text || 'Welcome to Troika Tech Services',
              // Only enable if explicitly set to true, otherwise default to false (hidden)
              welcome_text_enabled: result.data.welcome_text_enabled === true,
              welcome_rotating_two_lines: result.data.welcome_rotating_two_lines !== false,
              tab_title: result.data.tab_title || null,
              favicon_url: result.data.favicon_url || null,
              input_placeholders_enabled: result.data.input_placeholders_enabled || false,
              input_placeholders: result.data.input_placeholders || [],
              input_placeholder_speed: result.data.input_placeholder_speed || 2.5,
              input_placeholder_animation: result.data.input_placeholder_animation || 'fade',
              whatsapp_enabled: result.data.whatsapp_enabled === true,
              whatsapp_number: result.data.whatsapp_number || '',
              call_enabled: result.data.call_enabled === true,
              call_number: result.data.call_number || '',
              call_text: result.data.call_text || 'Call Us',
              header_text: result.data.header_text || '',
              header_enabled: result.data.header_enabled ?? true,
              header_nav_enabled: result.data.header_nav_enabled !== false,
              header_nav_items: Array.isArray(result.data.header_nav_items) ? result.data.header_nav_items : [],
              whatsapp_mode: result.data.settings?.sidebar?.whatsapp?.mode || 'redirect',
              call_mode: result.data.settings?.sidebar?.call?.mode || 'redirect',
              authentication_enabled: result.data.settings?.authentication?.isEnabled || false,
              skater_girl: (() => {
                const sg = result.data.skater_girl || result.data.settings?.skater_girl || {};
                return {
                  enabled: sg.enabled !== false,
                  messages: Array.isArray(sg.messages) && sg.messages.length > 0
                    ? sg.messages
                    : ["Let's talk business 🤝", "I've got answers 💡", "24×7 at your service ⚡", "Go on, test me! 😏", "What can I solve? ✅", "Psst... ask me! 🧠"],
                };
              })(),
              chat_background: (() => {
                const cb = result.data.chat_background || result.data.settings?.chat_background;
                return {
                  enabled: cb?.enabled === true,
                  image_url: cb?.image_url || '',
                  opacity: typeof cb?.opacity === 'number' ? cb.opacity : 10,
                  style: ['cover', 'watermark', 'pattern'].includes(cb?.style) ? cb.style : 'watermark',
                };
              })(),
            });

            // Update skater girl visibility based on config
            const sgConfig = result.data.skater_girl || result.data.settings?.skater_girl;
            if (sgConfig && sgConfig.enabled === false) {
              setShowSkater(false);
            }
          } else {
            console.warn('⚠️ [Config] Unexpected response shape (still showing UI with defaults):', result);
          }
        } else {
          console.warn('⚠️ [Config] Failed to fetch:', response.status, response.statusText);
        }
      } catch (error) {
        console.error('❌ [Config] Error:', error);
      } finally {
        // Critical: shell entrance + welcome animations are gated on isConfigLoaded.
        // If the API is down (500) or offline, we still unlock the UI with built-in defaults.
        setIsConfigLoaded(true);
      }
    };

    fetchConfig();
  }, []);

  // Fetch proposal, intent, and email configurations
  useEffect(() => {
    const fetchAllConfigs = async () => {
      if (!API_CONFIG.CHATBOT_ID) return;

      try {
        // Fetch all configs in parallel
        const [proposalData, intentData, emailData, emailIntentData, customNavData, calendlyData] = await Promise.all([
          getProposalConfig(API_CONFIG.CHATBOT_ID),
          getIntentConfig(API_CONFIG.CHATBOT_ID),
          getEmailConfig(API_CONFIG.CHATBOT_ID),
          getEmailIntentConfig(API_CONFIG.CHATBOT_ID),
          getCustomNavigationItems(API_CONFIG.CHATBOT_ID),
          getCalendlyConfig(API_CONFIG.CHATBOT_ID),
        ]);

        setProposalConfig(proposalData);
        setIntentConfig(intentData);
        setEmailConfig(emailData);
        setEmailIntentConfig(emailIntentData);
        setCalendlyConfig(calendlyData);

        // Fetch calling config separately as it's a new route
        const callingData = await getCallingConfig(API_CONFIG.BASE_URL, API_CONFIG.CHATBOT_ID);
        setCallingConfig(callingData);

        // Set custom navigation items (only active ones, sorted by order)
        if (customNavData?.enabled && customNavData?.items) {
          const activeItems = customNavData.items
            .filter(item => item.is_active)
            .sort((a, b) => (a.order || 0) - (b.order || 0));
          setCustomNavItems(activeItems);
        }

        console.log('✅ [Configs] All configs loaded:', {
          proposal: proposalData,
          intent: intentData,
          email: emailData,
          calling: callingData,
          emailEnabled: emailData?.enabled,
          emailTemplates: emailData?.templates?.length || 0,
          customNavItems: customNavData?.items?.length || 0,
          callingEnabled: callingData?.enabled,
        });
      } catch (error) {
        console.error('❌ [Configs] Error fetching configs:', error);
      }
    };

    fetchAllConfigs();
  }, [API_CONFIG.CHATBOT_ID]);


  // Fetch conversations history - Defined as useCallback to be usable in other effects/helpers
  const fetchConversations = useCallback(async (searchQuery = '') => {
    if (!sessionId) return;

    try {
      // 🎯 Build URL: If authenticated, pass the phone number to merge history
      let url = `${API_CONFIG.BASE_URL}/chat/conversations/${sessionId}`;
      const params = new URLSearchParams();
      if (searchQuery) params.append('search', searchQuery);
      if (isAuthenticated && userInfo?.phone) {
        params.append('phone', userInfo.phone);
      }

      const sessionResponse = await fetch(`${url}?${params.toString()}`, {
        headers: {
          'x-chatbot-id': API_CONFIG.CHATBOT_ID
        }
      });
      let allConversations = [];

      if (sessionResponse.ok) {
        const sessionResult = await sessionResponse.json();
        if (sessionResult.success && sessionResult.conversations) {
          allConversations = [...sessionResult.conversations];
        }
      }

      // 2. If authenticated, also fetch conversations for this phone number
      if (isAuthenticated && userInfo?.phone) {
        const authSearchParam = searchQuery ? `&search=${encodeURIComponent(searchQuery)}` : '';
        const historyResponse = await fetch(
          `${API_CONFIG.BASE_URL}/whatsapp-otp/conversations?phone=${userInfo.phone}&chatbotId=${API_CONFIG.CHATBOT_ID}${authSearchParam}`
        );

        if (historyResponse.ok) {
          const historyResult = await historyResponse.json();
          if (historyResult.success && historyResult.conversations) {
            // MERGE: Add conversations from history that aren't already in the list
            const existingIds = new Set(allConversations.map(c => c.id || c.sessionId));

            historyResult.conversations.forEach(historyChat => {
              const chatId = historyChat.id || historyChat.sessionId;
              if (!existingIds.has(chatId)) {
                allConversations.push(historyChat);
              }
            });
          }
        }
      }

      if (allConversations.length > 0) {
        // Sort by last message time (descending)
        allConversations.sort((a, b) => {
          const timeA = new Date(a.lastMessageAt || 0).getTime();
          const timeB = new Date(b.lastMessageAt || 0).getTime();
          return timeB - timeA;
        });

        // Format and set state
        const formattedConversations = allConversations.map(c => ({
          ...c,
          id: c.id || c.sessionId,
          title: c.title || 'Conversation',
          preview: c.preview || '',
          unread: false,
          initials: 'T' // Will be updated by useEffect when config loads
        }));

        setConversations(formattedConversations);
      }
    } catch (error) {
      console.error('❌ [Conversations] Error fetching history:', error);
    }
  }, [sessionId, isAuthenticated, userInfo]);

  // Close logout dropdown when authentication status changes
  useEffect(() => {
    console.log('🔐 [AUTH] Authentication status changed:', isAuthenticated);
    if (!isAuthenticated) {
      console.log('🔐 [AUTH] User is no longer authenticated, closing logout dropdown');
      setLogoutDropdownOpen(false);
    }
  }, [isAuthenticated]);

  // ✅ FIX: Auto-clear error banner if Auth gets disabled
  useEffect(() => {
    if (chatbotConfig?.authentication_enabled === false) {
      setAuthErrorBanner(false);
    }
  }, [chatbotConfig?.authentication_enabled]);

  // Initial fetch & polling
  useEffect(() => {
    fetchConversations(debouncedSearch);
    // Refresh conversations list periodically (every 30 seconds)
    const interval = setInterval(() => fetchConversations(debouncedSearch), 30000);
    return () => clearInterval(interval);
  }, [fetchConversations, debouncedSearch]);

  // Handle Tab Title and Favicon
  useEffect(() => {
    if (chatbotConfig.tab_title) {
      document.title = chatbotConfig.tab_title;
    }

    if (chatbotConfig.favicon_url) {
      let link = document.querySelector("link[rel~='icon']");
      if (!link) {
        link = document.createElement('link');
        link.rel = 'icon';
        document.getElementsByTagName('head')[0].appendChild(link);
      }
      link.href = chatbotConfig.favicon_url;
    }
  }, [chatbotConfig.tab_title, chatbotConfig.favicon_url]);

  // ✅ CONSTANT Input Box Placeholder (Always Active, Not Affected by Toggle)
  // Fixed placeholder for input box - always "Ask me anything..."
  const [constantInputPlaceholder, setConstantInputPlaceholder] = useState('Ask me anything...');

  // Translate constant input placeholder when language changes
  useEffect(() => {
    const translateConstantPlaceholder = async () => {
      if (currentLanguage === 'English') {
        setConstantInputPlaceholder('Ask me anything...');
        return;
      }

      try {
        // Use the translate function from component scope (already available)
        const translated = await translate('Ask me anything...');
        setConstantInputPlaceholder(translated);
      } catch (err) {
        // Fallback to English if translation fails
        setConstantInputPlaceholder('Ask me anything...');
      }
    };

    translateConstantPlaceholder();
  }, [currentLanguage, translate]);

  const languageButtonRef = useRef(null);
  const langDropdownMotionRef = useRef(null);
  const headerLangDropdownMotionRef = useRef(null);

  // State for translated placeholders
  const [placeholders, setPlaceholders] = useState({
    search: 'Search conversations',
    message: 'Type your message...',
    askAnything: 'Ask me anything...',
    phone: '(555) 123-4567',
    otp: '000000',
    authRequired: 'Authentication Required',
    limitReached: "You've reached the message limit. Please authenticate to continue.",
    authenticate: 'Authenticate'
  });

  // Update placeholders when language changes
  useEffect(() => {
    const updatePlaceholders = async () => {
      if (currentLanguage === 'English') {
        setPlaceholders({
          search: 'Search conversations',
          message: 'Type your message...',
          askAnything: 'Ask me anything...',
          phone: '(555) 123-4567',
          otp: '000000',
          authRequired: 'Authentication Required',
          limitReached: "You've reached the message limit. Please authenticate to continue.",
          authenticate: 'Authenticate'
        });
        return;
      }

      try {
        // ✅ FIX: Placeholder should only change if Auth is actually ON
        const shouldShowAuthPlaceholder = chatbotConfig?.authentication_enabled && !isAuthenticated && messageCount >= MESSAGE_LIMIT;
        if (shouldShowAuthPlaceholder) console.log('🔐 [AUTH] Setting auth placeholder:', { authEnabled: chatbotConfig?.authentication_enabled, authenticated: isAuthenticated, count: messageCount });
        const messageToTranslate = shouldShowAuthPlaceholder
          ? "Please authenticate to continue chatting..."
          : "Type your message...";

        const [search, message, askAnything, phone, otp, authReq, limitLog, authBtn] = await Promise.all([
          translate('Search conversations'),
          translate(messageToTranslate),
          translate('Ask me anything...'),
          translate('(555) 123-4567'),
          translate('000000'),
          translate('Authentication Required'),
          translate("You've reached the message limit. Please authenticate to continue."),
          translate('Authenticate')
        ]);

        setPlaceholders({
          search,
          message,
          askAnything,
          phone,
          otp,
          authRequired: authReq,
          limitReached: limitLog,
          authenticate: authBtn
        });
      } catch (err) {
        console.error('Error updating placeholders:', err);
      }
    };

    updatePlaceholders();
  }, [currentLanguage, translate]);

  // ✅ Computed placeholder for input box (Always uses constant placeholder)
  const computedPlaceholder = useMemo(() => {
    // Don't show placeholder until config is loaded
    if (!isConfigLoaded) {
      return '';
    }

    // Handle auth placeholder case (when auth is required and limit reached)
    const shouldShowAuthPlaceholder = chatbotConfig?.authentication_enabled && !isAuthenticated && messageCount >= MESSAGE_LIMIT;
    if (shouldShowAuthPlaceholder) {
      return placeholders.message; // This will be "Please authenticate to continue chatting..." when translated
    }

    // ✅ Always use constant input box placeholder: "Ask me anything..." (not affected by toggle)
    return constantInputPlaceholder;
  }, [
    isConfigLoaded,
    chatbotConfig?.authentication_enabled,
    isAuthenticated,
    messageCount,
    constantInputPlaceholder,
    placeholders.message
  ]);

  // Calculate greeting dynamically based on IST time
  const [currentGreeting, setCurrentGreeting] = useState('');

  // Function to get IST hour
  const getISTHour = () => {
    const now = new Date();
    // IST is UTC+5:30
    const istOffset = 5.5 * 60 * 60 * 1000; // 5.5 hours in milliseconds
    const istTime = new Date(now.getTime() + istOffset);
    return istTime.getUTCHours();
  };

  // Function to calculate greeting based on IST
  const calculateGreeting = () => {
    const hour = getISTHour();
    let greeting;

    if (hour >= 5 && hour < 12) {
      greeting = 'Good Morning'; // 5:00 AM - 11:59 AM IST
    } else if (hour >= 12 && hour < 17) {
      greeting = 'Good Afternoon'; // 12:00 PM - 4:59 PM IST
    } else if (hour >= 17 && hour < 21) {
      greeting = 'Good Evening'; // 5:00 PM - 8:59 PM IST
    } else {
      greeting = 'Hi'; // 9:00 PM - 4:59 AM IST (NEVER use "Good Night" for greetings!)
    }

    return greeting;
  };

  // Update greeting on component mount and every minute
  useEffect(() => {
    const updateGreeting = () => {
      setCurrentGreeting(calculateGreeting());
    };

    updateGreeting();

    // Update greeting every minute
    const interval = setInterval(updateGreeting, 60000); // 60 seconds

    return () => clearInterval(interval);
  }, []);


  const messagesEndRef = useRef(null);
  const welcomeBgRippleRef = useRef(null);
  const messagesScrollRef = useRef(null);
  const userScrolledUpRef = React.useRef(false);

  const lastUserMessageRef = useRef(null);
  const messagesContextIdRef = useRef(null); // Tracks which conversation the current 'messages' state belongs to



  const [authStep, setAuthStep] = useState('name'); // 'name', 'phone', 'otp'



  // Debug: Log auth form state changes
  useEffect(() => {
    console.log('🔍 Auth form state:', showAuthForm, 'Message count:', messageCount, 'Authenticated:', isAuthenticated);
  }, [showAuthForm, messageCount, isAuthenticated]);

  const isOmniEmbedded = useMemo(
    () =>
      typeof window !== 'undefined' &&
      !!(window.__OMNIAGENT_CONFIG__?.embedMode ?? window.__OMNIAGENT_CONFIG__),
    [],
  );

  /** Standalone app only: `body.sidebar-open` freezes page scroll (breaks host sites when embedded). */
  useEffect(() => {
    if (sidebarOpen && !isOmniEmbedded) {
      document.body.classList.add('sidebar-open');
    } else {
      document.body.classList.remove('sidebar-open');
    }

    return () => {
      document.body.classList.remove('sidebar-open');
    };
  }, [sidebarOpen, isOmniEmbedded]);

  /** Portaled welcome skater (z 9999) stacks after #root; reset scroll + rely on higher drawer z-index so top menu is visible. */
  useEffect(() => {
    if (!sidebarOpen) return;
    const root = sidebarMobileRef.current;
    if (!root) return;
    root.scrollTop = 0;
    const inner = root.querySelector(':scope > .flex-1');
    if (inner) inner.scrollTop = 0;
  }, [sidebarOpen]);

  // Function to generate chat title from first user message
  const generateChatTitle = (message) => {
    const content = message.toLowerCase();

    // Define keyword patterns and their corresponding titles
    const titlePatterns = [
      // Order/Tracking related
      { keywords: ['track', 'order', 'status', 'delivery', 'shipping', 'package'], title: 'Order Tracking' },
      { keywords: ['order', 'buy', 'purchase', 'price', 'cost'], title: 'Purchase Inquiry' },

      // Account/Services related
      { keywords: ['account', 'profile', 'settings', 'login', 'password'], title: 'Account Management' },
      { keywords: ['help', 'support', 'assist', 'problem', 'issue'], title: 'Customer Support' },

      // Meeting/Scheduling related
      { keywords: ['meeting', 'schedule', 'appointment', 'call', 'consultation'], title: 'Meeting Scheduling' },
      { keywords: ['book', 'reserve', 'appointment'], title: 'Booking Request' },

      // Information/Document related
      { keywords: ['document', 'invoice', 'receipt', 'statement'], title: 'Document Request' },
      { keywords: ['information', 'info', 'details', 'about'], title: 'Information Request' },

      // General inquiries
      { keywords: ['how', 'what', 'when', 'where', 'why'], title: 'General Inquiry' },
      { keywords: ['contact', 'reach', 'phone', 'email'], title: 'Contact Information' },
    ];

    // Check for keyword matches
    for (const pattern of titlePatterns) {
      if (pattern.keywords.some(keyword => content.includes(keyword))) {
        return pattern.title;
      }
    }

    // If no specific pattern matches, create a title from the first few words
    const words = message.split(' ').slice(0, 4).join(' ');
    const cleanTitle = words.charAt(0).toUpperCase() + words.slice(1).toLowerCase();

    // Limit title length
    return cleanTitle.length > 25 ? cleanTitle.substring(0, 25) + '...' : cleanTitle;
  };



  const handleAuthSubmit = async () => {
    console.log('🔐 Authentication submit:', authStep, { phone: authPhone, otp: authOtp });

    try {
      if (authStep === 'name') {
        // Validate name
        if (!authName || authName.trim().length < 2) {
          alert('Please enter a valid name (at least 2 characters)');
          return;
        }

        // Move to phone collection step
        setAuthStep('phone');
        console.log('✅ Name collected, showing phone step');
      } else if (authStep === 'phone') {
        // Validate phone number
        if (!authPhone || authPhone.length < 10) {
          alert('Please enter a valid phone number');
          return;
        }

        // Send OTP via WhatsApp
        await sendOtp(authPhone);
        setAuthStep('otp');
        setAuthOtp('');
        console.log('✅ OTP sent, showing OTP step');
      } else if (authStep === 'otp') {
        // Validate OTP
        if (!authOtp || authOtp.length !== 6) {
          alert('Please enter a valid 6-digit OTP');
          return;
        }

        // Verify OTP and complete authentication
        await verifyOtp({
          otp: authOtp,
          phone: authPhone,
          name: authName,
          sessionId: sessionId
        });

        // Update user info with the collected name
        updateUserInfo({ name: authName.trim() });

        // Update session ID to use authenticated session for all future messages
        // Use consistent session ID based on phone
        console.log('✅ Authentication complete');

        setShowAuthForm(false);
        setAuthStep('name'); // Reset for next time
        setAuthName('');
        setAuthPhone('');
        setAuthOtp('');
      }
    } catch (error) {
      console.error('❌ Authentication error:', error);
      // Error is already set in AuthContext and displayed in UI
      setAuthErrorBanner(error.message);
    }
  };

  // Handle verify OTP
  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    try {
      if (!authOtp || authOtp.length !== 6) {
        setAuthErrorBanner('Please enter a valid 6-digit OTP');
        return;
      }

      const success = await verifyOtp({
        phone: authPhone,
        otp: authOtp,
        name: authName, // Pass the user's name
        sessionId: sessionId // Pass the current session ID to link guest session to verified user
      });

      if (success) {
        setShowAuthForm(false);
        setAuthOtp('');
        setAuthName(''); // Clear name after successful verification
        setAuthErrorBanner(false);
      }
    } catch (error) {
      console.error('OTP Verification error:', error);
      setAuthErrorBanner(error.message || 'Verification failed');
    }
  };


  const t = theme;

  // Utility to parse charts from AI response
  const parseChartFromResponse = (response) => {
    // Look for pattern: [chart:type:title:{"name":val,...}]
    const chartRegex = /\[chart:(\w+):([^:]+):({[^}]+})\]/;
    const match = response.match(chartRegex);

    if (match) {
      try {
        const [fullMatch, chartType, title, dataStr] = match;
        // Basic cleanup of data string (handle single quotes if any)
        const jsonStr = dataStr.replace(/'/g, '"');
        const dataObj = JSON.parse(jsonStr);
        const chartData = Object.entries(dataObj).map(([name, value]) => ({ name, value }));

        return {
          cleanText: response.replace(fullMatch, '').trim(),
          chart: {
            type: chartType,
            title,
            data: chartData
          }
        };
      } catch (e) {
        console.error('Failed to parse chart data:', e);
      }
    }

    return { cleanText: response, chart: null };
  };

  // Streaming hook
  // If user says "proposal on WhatsApp" / "proposal on email", skip channel selection and route directly.
  const detectPreferredProposalChannel = (userMessage) => {
    if (!userMessage || typeof userMessage !== 'string') return null;
    const m = userMessage.toLowerCase();

    // WhatsApp signals
    if (
      isFuzzyMatch(m, 'whatsapp') ||
      m.includes("what'sapp") ||
      m.includes("what’sapp") ||
      m.includes('what app') ||
      /\bwa\b/.test(m)
    ) return 'whatsapp';

    // Email signals
    if (
      isFuzzyMatch(m, 'email') ||
      isFuzzyMatch(m, 'mail') ||
      m.includes('gmail')
    ) return 'email';

    return null;
  };

  const {
    streamingResponse,
    isStreaming,
    sendMessage: sendStreamingMessage,
    stopStreaming,
  } = useStreamingChat({
    apiBase: API_CONFIG.BASE_URL,
    chatbotId: API_CONFIG.CHATBOT_ID,
    sessionId,
    conversationId: activeConversationId,
    phone: userInfo?.phone,
    userInfo, // ✅ Pass userInfo to the hook
    isAuthenticated, // ✅ Pass isAuthenticated to the hook
    authToken, // ✅ Pass authToken to the hook
    onConnected: ({ conversationId }) => {
      if (conversationId) {
        console.log('🔗 [Sync] Received conversationId from backend:', conversationId);
        setActiveConversationId(conversationId);
        messagesContextIdRef.current = conversationId;
      }
    },
    onComplete: (data) => {
      const fullAnswer = data.fullAnswer || '';
      const { cleanText, chart } = parseChartFromResponse(fullAnswer);

      // Only create a message if there's actual content
      // If tool call was detected and no text was generated, skip creating empty message
      if (!cleanText || cleanText.trim().length === 0) {
        console.log('⚠️ [onComplete] Empty response, skipping message creation (likely tool call only)');
        // Clear last user message ref even if no message is created
        lastUserMessageRef.current = null;
        return;
      }

      // New message - create with responses array structure
      const userMsg = lastUserMessageRef.current;
      const aiMsg = {
        id: Date.now() + Math.random().toString(36).substr(2, 9),
        content: cleanText,
        isUser: false,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        model: data.model || 'gpt-4o-mini',
        tags: data.tags || [],
        responses: [{
          id: `resp_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
          text: cleanText,
          timestamp: Date.now()
        }],
        activeResponseIndex: 0,
        userMessageId: userMsg?.id,
        userMessageText: userMsg?.content,
        type: chart ? 'chart' : null,
        chart: chart
      };
      setMessages(prev => [...prev, aiMsg]);
      messagesContextIdRef.current = activeConversationId;

      // Clear last user message ref
      lastUserMessageRef.current = null;

      // Refresh conversations to update title and preview immediately
      setTimeout(() => fetchConversations(), 500);

    },
    onProposalIntentDetected: (data) => {
      // Handle proposal intent detected via tool call (unified flow)
      console.log('🎯 [Proposal Intent] Tool call detected:', data);

      // Force clear calling pending just in case it accidentally got set (e.g. "calling agent" triggered both)
      setCallingConfirmationPending(false);

      const whatsappEnabled = intentConfig?.enabled;
      const emailEnabled = emailIntentConfig?.enabled;

      // Capture context from backend (prioritize NEW args - don't merge stale product keywords)
      try {
        if (data.toolCall?.function?.arguments) {
          const args = JSON.parse(data.toolCall.function.arguments);
          setIntentContextData((prev) => {
            // Prioritize the NEW args from backend. Don't recover stale keywords.
            return { ...prev, ...args, _originalUserMessage: data.userMessage };
          });
          if (args.requested_template_keyword) {
            console.log('✅ [Context] Backend identified product:', args.requested_template_keyword);
          }
        }
      } catch (e) { console.error(e); }

      // RESET ALL OTHER FLOWS if a new intent is detected
      // This ensures that if a user switches context (e.g., from Email to WhatsApp), the new flow takes over.
      if (proposalConfirmationPending || templateSelectionPending || emailConfirmationPending || emailTemplateSelectionPending || channelSelectionPending || callingConfirmationPending) {
        console.log('🔄 [Intent] New intent detected, resetting previous flow states');
        setProposalConfirmationPending(false);
        setTemplateSelectionPending(false);
        setEmailConfirmationPending(false);
        setEmailTemplateSelectionPending(false);
        setChannelSelectionPending(false);
        setCallingConfirmationPending(false);
        channelSelectionTriggeredRef.current = false;
        // We do NOT return here; we proceed to start the new flow.
      }

      // Scenario 4: Neither enabled - do nothing
      if (!whatsappEnabled && !emailEnabled) {
        console.log('📭 [Proposal Intent] No channels enabled, skipping');
        return;
      }

      // Scenario 3: Both enabled - ask for channel selection
      if (whatsappEnabled && emailEnabled) {
        const preferredChannel = detectPreferredProposalChannel(data?.userMessage);

        if (preferredChannel === 'whatsapp') {
          console.log('📱 [Proposal Intent] Both enabled, user asked for WhatsApp - skipping channel selection');
          // Mirror the "Only WhatsApp enabled" branch
          if (isAuthenticated && userInfo?.phone) {
            setProposalConfirmationPending(true);
            setProposalQuestionTime(Date.now());

            const detectedLang = data.detectedLanguage?.language || 'English';
            const detectedLangObj = data.detectedLanguage || { language: 'English', script: 'Latin' };
            console.log('🗣️ [Flow] Using language for proposal confirmation:', detectedLang);

            setTimeout(async () => {
              const originalText = intentConfig.confirmation_prompt_text || 'Would you like to receive the proposal?';
              const translatedText = await translateFlowText(originalText, detectedLangObj);
              const finalText = translatedText !== originalText ? translatedText : getFlowString(detectedLang, 'proposal_confirmation', originalText);

              const confirmationMsg = {
                id: Date.now() + Math.random().toString(36).substr(2, 9),
                content: finalText,
                isUser: false,
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                detectedLanguageObj: detectedLangObj
              };
              setMessages(prev => [...prev, confirmationMsg]);
            }, 500);
          } else {
            const detectedLangObj = data.detectedLanguage || { language: 'English', script: 'Latin' };
            setTimeout(async () => {
              const originalAuthText = 'Please authenticate with your phone number to receive the proposal.';
              const translatedAuthText = await translateFlowText(originalAuthText, detectedLangObj);

              const authMsg = {
                id: Date.now() + Math.random().toString(36).substr(2, 9),
                content: translatedAuthText,
                isUser: false,
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                detectedLanguageObj: detectedLangObj
              };
              setMessages(prev => [...prev, authMsg]);
            }, 500);
          }
          return;
        }

        if (preferredChannel === 'email') {
          console.log('📧 [Proposal Intent] Both enabled, user asked for Email - skipping channel selection');
          setEmailConfirmationPending(true);
          setEmailQuestionTime(Date.now());

          const detectedLang = data.detectedLanguage?.language || 'English';
          const detectedLangObj = data.detectedLanguage || { language: 'English', script: 'Latin' };
          console.log('🗣️ [Flow] Using language for email confirmation:', detectedLang);

          setTimeout(async () => {
            const originalText = emailIntentConfig.confirmation_prompt_text || 'Would you like to receive this via email?';
            const translatedText = await translateFlowText(originalText, detectedLangObj);
            const finalText = translatedText !== originalText ? translatedText : getFlowString(detectedLang, 'email_confirmation', originalText);

            const confirmationMsg = {
              id: Date.now() + Math.random().toString(36).substr(2, 9),
              content: finalText,
              isUser: false,
              time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              detectedLanguageObj: detectedLangObj
            };
            setMessages(prev => [...prev, confirmationMsg]);
          }, 500);
          return;
        }

        console.log('🔀 [Proposal Intent] Both channels enabled, asking for selection');
        channelSelectionTriggeredRef.current = true; // Mark as triggered to prevent duplicate
        setChannelSelectionPending(true);

        // Determine language for flow question
        const detectedLang = data.detectedLanguage?.language || 'English';
        const detectedLangObj = data.detectedLanguage || { language: 'English', script: 'Latin' };
        console.log('🗣️ [Flow] Using language for channel selection:', detectedLang);

        setTimeout(async () => {
          const originalQuestion = 'How would you like to receive the proposal?';
          const translatedQuestion = await translateFlowText(originalQuestion, detectedLangObj);

          // Add options list (these remain in English/numbers for clarity)
          const fullMessage = `${translatedQuestion}\n\n1. WhatsApp\n2. Email\n\nPlease type 1 or 2, or say "WhatsApp" or "Email".`;

          const channelMsg = {
            id: Date.now() + Math.random().toString(36).substr(2, 9),
            content: fullMessage,
            isUser: false,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            type: 'channel_selection',
            detectedLanguageObj: detectedLangObj // Store for next step
          };
          setMessages(prev => [...prev, channelMsg]);
          // Reset the ref after message is added
          setTimeout(() => { channelSelectionTriggeredRef.current = false; }, 100);
        }, 500);
        return;
      }

      // Scenario 1: Only WhatsApp enabled - direct to WhatsApp flow
      if (whatsappEnabled && !emailEnabled) {
        console.log('📱 [Proposal Intent] Only WhatsApp enabled, direct flow');
        if (isAuthenticated && userInfo?.phone) {
          setProposalConfirmationPending(true);
          setProposalQuestionTime(Date.now());

          setProposalQuestionTime(Date.now());

          // Determine language for flow question
          const detectedLang = data.detectedLanguage?.language || 'English';
          const detectedLangObj = data.detectedLanguage || { language: 'English', script: 'Latin' };
          console.log('🗣️ [Flow] Using language for proposal confirmation:', detectedLang);

          setTimeout(async () => {
            const originalText = intentConfig.confirmation_prompt_text || 'Would you like to receive the proposal?';
            const translatedText = await translateFlowText(originalText, detectedLangObj);

            // Use translated text if available, fallback to getFlowString logic if needed (though translateFlowText handles fallback)
            const finalText = translatedText !== originalText ? translatedText : getFlowString(detectedLang, 'proposal_confirmation', originalText);

            const confirmationMsg = {
              id: Date.now() + Math.random().toString(36).substr(2, 9),
              content: finalText,
              isUser: false,
              time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              detectedLanguageObj: detectedLangObj // Store for future flow steps
            };
            setMessages(prev => [...prev, confirmationMsg]);
          }, 500);
        } else {
          // Auth required message translation
          const detectedLang = data.detectedLanguage?.language || 'English';
          const detectedLangObj = data.detectedLanguage || { language: 'English', script: 'Latin' };

          setTimeout(async () => {
            const originalAuthText = 'Please authenticate with your phone number to receive the proposal.';
            const translatedAuthText = await translateFlowText(originalAuthText, detectedLangObj);

            const authMsg = {
              id: Date.now() + Math.random().toString(36).substr(2, 9),
              content: translatedAuthText,
              isUser: false,
              time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              detectedLanguageObj: detectedLangObj
            };
            setMessages(prev => [...prev, authMsg]);
          }, 500);
        }
        return;
      }

      // Scenario 2: Only Email enabled - direct to Email flow
      if (!whatsappEnabled && emailEnabled) {
        console.log('📧 [Proposal Intent] Only Email enabled, direct flow');
        setEmailConfirmationPending(true);
        setEmailQuestionTime(Date.now());

        const detectedLang = data.detectedLanguage?.language || 'English';
        const detectedLangObj = data.detectedLanguage || { language: 'English', script: 'Latin' };
        console.log('🗣️ [Flow] Using language for email confirmation:', detectedLang);

        setTimeout(async () => {
          const originalText = emailIntentConfig.confirmation_prompt_text || 'Would you like to receive this via email?';
          const translatedText = await translateFlowText(originalText, detectedLangObj);
          const finalText = translatedText !== originalText ? translatedText : getFlowString(detectedLang, 'email_confirmation', originalText);

          const confirmationMsg = {
            id: Date.now() + Math.random().toString(36).substr(2, 9),
            content: finalText,
            isUser: false,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            detectedLanguageObj: detectedLangObj,
          };
          setMessages(prev => [...prev, confirmationMsg]);
        }, 500);
      }
    },
    onEmailIntentDetected: (data) => {
      console.log('🎯 [Email Intent] Tool call detected:', data);

      // 🛑 GUARD: If we are already asking for email input, IGNORE this new intent trigger
      // This prevents the loop when the user types their email address.
      if (emailTemplateSelectionPending || (messages.length > 0 && messages[messages.length - 1]?.type === 'email_input')) {
        console.log('🛡️ [Email Intent] Already in email flow - ignoring duplicate trigger.');
        return;
      }

      const whatsappEnabled = intentConfig?.enabled;
      const emailEnabled = emailIntentConfig?.enabled;

      // Capture context from backend + Recover "Swara" from previous intent when switching flows (e.g. proposal→email)
      try {
        if (data.toolCall?.function?.arguments) {
          const args = JSON.parse(data.toolCall.function.arguments);
          setIntentContextData((prev) => {
            const newKw = args.requested_template_keyword;
            const prevKw = prev?.requested_template_keyword;
            if ((!newKw || isGenericKeyword(newKw)) && prevKw && !isGenericKeyword(prevKw)) {
              console.log('♻️ [Context] Recovering from previous intent:', prevKw);
              args.requested_template_keyword = prevKw;
            }
            return { ...args, _originalUserMessage: data.userMessage };
          });
          if (args.requested_template_keyword) {
            console.log('✅ [Context] Backend identified product:', args.requested_template_keyword);
          }
        }
      } catch (e) { console.error(e); }

      // RESET ALL OTHER FLOWS if a new intent is detected
      // This ensures that if a user switches context (e.g., from WhatsApp to Email), the new flow takes over.
      if (proposalConfirmationPending || templateSelectionPending || emailConfirmationPending || emailTemplateSelectionPending || channelSelectionPending || callingConfirmationPending) {
        console.log('🔄 [Intent] New intent detected, resetting previous flow states');
        setProposalConfirmationPending(false);
        setTemplateSelectionPending(false);
        setEmailConfirmationPending(false);
        setEmailTemplateSelectionPending(false);
        setChannelSelectionPending(false);
        setCallingConfirmationPending(false);
        channelSelectionTriggeredRef.current = false;
        // We do NOT return here; we proceed to start the new flow.
      }

      // If both enabled, prefer direct routing based on user message (same rule as proposal)
      if (whatsappEnabled && emailEnabled) {
        const preferredChannel = detectPreferredProposalChannel(data?.userMessage);

        if (preferredChannel === 'email') {
          console.log('📧 [Email Intent] Both enabled, user asked for Email - skipping channel selection');
          setEmailConfirmationPending(true);
          setEmailQuestionTime(Date.now());

          const detectedLang = data.detectedLanguage?.language || 'English';
          const detectedLangObj = data.detectedLanguage || { language: 'English', script: 'Latin' };
          console.log('🗣️ [Flow] Using language for email confirmation:', detectedLang);

          setTimeout(async () => {
            const originalText = emailIntentConfig.confirmation_prompt_text || 'Would you like to receive this via email?';
            const translatedText = await translateFlowText(originalText, detectedLangObj);
            const finalText = translatedText !== originalText ? translatedText : getFlowString(detectedLang, 'email_confirmation', originalText);

            const confirmationMsg = {
              id: Date.now() + Math.random().toString(36).substr(2, 9),
              content: finalText,
              isUser: false,
              time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              detectedLanguageObj: detectedLangObj // Store for future flow steps
            };
            setMessages(prev => [...prev, confirmationMsg]);
          }, 500);
          return;
        }

        if (preferredChannel === 'whatsapp') {
          console.log('📱 [Email Intent] Both enabled, user actually asked for WhatsApp - skipping channel selection');
          // Mirror the WhatsApp branch (requires auth/phone)
          if (isAuthenticated && userInfo?.phone) {
            setProposalConfirmationPending(true);
            setProposalQuestionTime(Date.now());

            const detectedLang = data.detectedLanguage?.language || 'English';
            const detectedLangObj = data.detectedLanguage || { language: 'English', script: 'Latin' };
            console.log('🗣️ [Flow] Using language for proposal confirmation:', detectedLang);

            setTimeout(async () => {
              const originalText = intentConfig.confirmation_prompt_text || 'Would you like to receive the proposal?';
              const translatedText = await translateFlowText(originalText, detectedLangObj);
              const finalText = translatedText !== originalText ? translatedText : getFlowString(detectedLang, 'proposal_confirmation', originalText);

              const confirmationMsg = {
                id: Date.now() + Math.random().toString(36).substr(2, 9),
                content: finalText,
                isUser: false,
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                detectedLanguageObj: detectedLangObj // Store for future flow steps
              };
              setMessages(prev => [...prev, confirmationMsg]);
            }, 500);
          } else {
            const detectedLangObj = data.detectedLanguage || { language: 'English', script: 'Latin' };
            setTimeout(async () => {
              const originalAuthText = 'Please authenticate with your phone number to receive the proposal.';
              const translatedAuthText = await translateFlowText(originalAuthText, detectedLangObj);

              const authMsg = {
                id: Date.now() + Math.random().toString(36).substr(2, 9),
                content: translatedAuthText,
                isUser: false,
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                detectedLanguageObj: detectedLangObj
              };
              setMessages(prev => [...prev, authMsg]);
            }, 500);
          }
          return;
        }

        console.log('🔀 [Email Intent] Both channels enabled, no explicit channel detected - proposal handler will ask selection');
        return;
      }

      // If only email enabled, go directly to email flow
      if (emailEnabled && !whatsappEnabled) {
        console.log('📧 [Email Intent] Only Email enabled, direct flow');
        setEmailConfirmationPending(true);
        setEmailQuestionTime(Date.now());

        // Determine language for flow question
        const detectedLang = data.detectedLanguage?.language || 'English';
        const detectedLangObj = data.detectedLanguage || { language: 'English', script: 'Latin' };
        console.log('🗣️ [Flow] Using language for email confirmation:', detectedLang);

        setTimeout(async () => {
          const originalText = emailIntentConfig.confirmation_prompt_text || 'Would you like to receive this via email?';
          const translatedText = await translateFlowText(originalText, detectedLangObj);

          const finalText = translatedText !== originalText ? translatedText : getFlowString(detectedLang, 'email_confirmation', originalText);

          const confirmationMsg = {
            id: Date.now() + Math.random().toString(36).substr(2, 9),
            content: finalText,
            isUser: false,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            detectedLanguageObj: detectedLangObj // Store for future flow steps
          };
          setMessages(prev => [...prev, confirmationMsg]);
        }, 500);
      }
    },
    onCallingIntentDetected: (data) => {
      console.log('🎯 [Calling Intent] Tool call detected:', data);

      // 🛑 GUARD: If we are already handling a proposal or email, IGNORE the calling intent
      // This prevents double-triggering when the user asks for a "calling agent proposal"
      if (proposalConfirmationPending || emailConfirmationPending || templateSelectionPending || emailTemplateSelectionPending || channelSelectionPending) {
        console.log('🛡️ [Calling Intent] Ignored - higher priority flow active.');
        return;
      }

      if (!callingConfig?.enabled) {
        console.log('🔇 [Calling Intent] Calling tool not enabled, skipping');
        return;
      }

      // RESET ALL OTHER FLOWS if a new intent is detected
      // This ensures that if a user switches context (e.g., from Picking a Template to Asking for a Call), 
      // the new flow takes over immediately.
      if (proposalConfirmationPending || templateSelectionPending || emailConfirmationPending || emailTemplateSelectionPending || channelSelectionPending || callingConfirmationPending) {
        console.log('🔄 [Calling Intent] New intent detected, resetting previous flow states');
        setProposalConfirmationPending(false);
        setTemplateSelectionPending(false);
        setEmailConfirmationPending(false);
        setEmailTemplateSelectionPending(false);
        setChannelSelectionPending(false);
        setCallingConfirmationPending(false);
        channelSelectionTriggeredRef.current = false;
      }

      setCallingConfirmationPending(true);
      setCallingQuestionTime(Date.now());

      // Determine language for flow question
      const detectedLang = data.detectedLanguage?.language || 'English';
      const detectedLangObj = data.detectedLanguage || { language: 'English', script: 'Latin' };
      console.log('🗣️ [Flow] Using language for calling confirmation:', detectedLang);

      setTimeout(async () => {
        const originalText = callingConfig.flow_question || 'Would you like to speak with our expert?';
        const translatedText = await translateFlowText(originalText, detectedLangObj);

        const finalText = translatedText !== originalText ? translatedText : getFlowString(detectedLang, 'calling_confirmation', originalText);

        const confirmationMsg = {
          id: Date.now() + Math.random().toString(36).substr(2, 9),
          content: finalText,
          isUser: false,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          detectedLanguageObj: detectedLangObj // Store for future flow steps
        };
        setMessages(prev => [...prev, confirmationMsg]);
      }, 500);
    },
    onError: (err) => {
      console.error('Chat error:', err);

      // ✅ Check if this is a limit error that should show auth banner
      if (err?.isLimitError || err?.error === 'MESSAGE_LIMIT_REACHED' || err?.code === 'MESSAGE_LIMIT_REACHED') {
        console.log('🔒 [LIMIT] Showing auth banner for limit error');
        setAuthErrorBanner(true);
        setIsStreaming(false);
        return;
      }

      // Default error handling for other errors
      let errorMessage = 'Unknown error';
      if (typeof err === 'string') {
        errorMessage = err;
      } else if (err?.message) {
        errorMessage = typeof err.message === 'string' ? err.message : (err.message.message || err.message.error || 'Unknown error');
      } else if (err?.error) {
        errorMessage = typeof err.error === 'string' ? err.error : 'Unknown error';
      }

      console.error('Error details:', errorMessage);

      const errorMsg = {
        id: Date.now() + Math.random().toString(36).substr(2, 9),
        content: `I apologize, but I encountered an error processing your request. ${errorMessage ? `Details: ${errorMessage}` : ''} Please try again.`,
        isUser: false,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages(prev => [...prev, errorMsg]);
    },
  });


  // Handle conversation selection with message loading
  const handleConversationSelect = async (conversationId) => {
    console.log('🔄 STEP 1: Selecting conversation:', conversationId);
    console.log('📝 Current messages before switch:', messages.length);

    // Set active conversation
    setActiveConversationId(conversationId);

    // Sync activeConversation index for backward compatibility
    const index = conversations.findIndex(c => (c.id || c.sessionId) === conversationId);
    if (index !== -1) setActiveConversation(index);

    // Clear current messages to show loading state
    setMessages([]);

    // Show loading
    setMessagesLoading(true);

    let loadedCount = 0;
    try {
      console.log('🔄 STEP 2: Fetching from API...');

      // Fetch chat history from backend
      const response = await fetch(`${API_CONFIG.BASE_URL}/chat/messages/${conversationId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'x-chatbot-id': API_CONFIG.CHATBOT_ID
        },
      });

      console.log('🔄 STEP 3: Response status:', response.status);

      if (response.ok) {
        const data = await response.json();

        console.log('🔄 STEP 4: Data received:', data);
        console.log('🔄 STEP 5: Messages count:', data.messages?.length || 0);

        // Load messages into state
        if (data.messages && data.messages.length > 0) {
          messagesContextIdRef.current = conversationId;
          setMessages(data.messages);
          loadedCount = data.messages.length;
          console.log('✅ Messages loaded successfully');
        } else {
          console.log('⚠️ No messages found - check if they were saved');
          messagesContextIdRef.current = conversationId;
          setMessages([]);
        }
      } else {
        console.error('❌ Failed to fetch messages, response status:', response.status);
        const errorText = await response.text();
        console.error('❌ Error response:', errorText);
        setMessages([]);
      }
    } catch (error) {
      console.error('❌ Error loading conversation:', error);
      setMessages([]);
    } finally {
      setMessagesLoading(false);
      console.log('🏁 Finished loading conversation, total messages loaded:', loadedCount);
    }
  };

  // Handle sidebar proposal button click
  const handleSidebarProposalSend = async (templateId) => {
    if (!templateId) return;

    try {
      setSendingProposal(true);
      setShowProposalModal(false);

      console.log('📤 [Proposal] Sending from sidebar:', templateId);

      const result = await sendProposal(API_CONFIG.CHATBOT_ID, userInfo.phone, { templateId });

      if (result.success) {
        toast.success(result.message || 'Proposal sent successfully via WhatsApp!');

        // Add a bot message to chat confirmation
        const confirmationMsg = {
          id: Date.now() + Math.random().toString(36).substr(2, 9),
          content: result.message || 'I have sent the proposal to your WhatsApp number.',
          isUser: false,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };
        setMessages(prev => [...prev, confirmationMsg]);
      } else {
        toast.error(result.message || 'Failed to send proposal. Please try again.');
      }
    } catch (error) {
      console.error('❌ [Proposal] Error sending from sidebar:', error);
      toast.error('An error occurred while sending the proposal.');
    } finally {
      setSendingProposal(false);
    }
  };

  // Handle sidebar email button click
  const handleEmailButtonClick = () => {
    // ✅ CRITICAL: If mode is premium_modal, show it immediately (even if not authenticated)
    if (emailConfig?.mode === 'premium_modal') {
      setShowPremiumModal(true);
      return;
    }

    if (!hasFullAccess) {
      toast.error('Please verify your phone number to send emails');
      return;
    }

    if (!emailConfig?.enabled) {
      toast.error('Email feature is not enabled for this chatbot');
      return;
    }

    if (!emailConfig.templates || emailConfig.templates.length === 0) {
      toast.error('No email templates available');
      return;
    }

    // Open email modal
    setShowEmailModal(true);
  };

  const handleSidebarQuickActionClick = (action) => {
    if (action.isProposal && action.action === 'get_quote') {
      if (!isAuthenticated || !userInfo?.phone) {
        toast.error('Please verify your phone number to send proposals');
        return;
      }

      if (!proposalConfig || !proposalConfig.templates) {
        toast.error('Proposal templates not loaded. Please refresh the page.');
        return;
      }

      const templatesCount = proposalConfig.templates.length;
      if (templatesCount > 1) {
        setShowProposalModal(true);
      } else if (templatesCount === 1) {
        handleSidebarProposalSend(proposalConfig.templates[0]?.id);
      } else {
        toast.error('No proposal templates available');
      }
    } else if (action.isEmail && action.action === 'send_email') {
      handleEmailButtonClick();
    } else if (action.isCalendly) {
      if (calendlyConfig?.mode === 'redirect') {
        if (calendlyConfig.url) {
          setCalendlyLoading(true);
          setShowCalendlyModal(true);
        } else {
          toast.error('Calendly URL is not configured');
        }
      } else {
        setShowPremiumModal(true);
      }
    } else if (action.isCustomNav && action.redirectUrl) {
      const url = action.redirectUrl;
      if (url.startsWith('tel:') || url.startsWith('mailto:')) {
        window.location.href = url;
      } else if (url.startsWith('/')) {
        window.location.href = url;
      } else {
        window.open(url, '_blank', 'noopener,noreferrer');
      }
    } else if (action.action && typeof action.action === 'string') {
      handleSend(action.action);
    }
  };

  const sidebarPrimaryActions = [
    ...(emailConfig?.enabled && (hasFullAccess || emailConfig.mode === 'premium_modal')
      ? [{
        key: 'email',
        icon: Icons.email,
        label: 'Email',
        description: 'Send an email',
        action: 'send_email',
        isEmail: true,
      }]
      : []),
    ...(hasFullAccess && proposalConfig?.enabled
      ? [{
        key: 'proposal',
        icon: Icons.document,
        label: 'Proposal',
        description: 'Request a proposal',
        action: 'get_quote',
        isProposal: true,
      }]
      : []),
    ...(hasFullAccess && calendlyConfig?.enabled
      ? [{
        key: 'calendly',
        icon: Icons.calendar,
        label: calendlyConfig.display_text || 'Schedule',
        description: 'Book a meeting',
        action: 'open_calendly',
        isCalendly: true,
      }]
      : []),
  ];

  const sidebarSocialActions = [
    ...(hasFullAccess
      ? customNavItems.map((item, idx) => {
        const IconSvg = getSvgIcon(item.icon_name);
        return {
          // Index ensures uniqueness when multiple items share the same URL or lack id
          key: `nav-${idx}-${item.id ?? item.redirect_url ?? 'link'}`,
          icon: IconSvg,
          label: item.display_text,
          description: item.display_text,
          action: item.redirect_url,
          isCustomNav: true,
          redirectUrl: item.redirect_url,
        };
      })
      : []),
  ];

  const quickActions = [
    { icon: Icons.analytics, label: 'View Analytics', description: 'See company performance trends', action: 'Show me my analytics' },
    { icon: Icons.document, label: 'Review Documents', description: 'Access recent PDF reports', action: 'Show me my recent documents' },
    { icon: Icons.clock, label: 'Order', description: 'Check your recent order status', action: 'I would like to track my recent order' },
    { icon: Icons.calendar, label: 'Schedule Meeting', description: 'Book a consultation call', action: 'I would like to schedule a meeting' },
  ];

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)');
    const apply = () => setShellSidebarSlideEnabled(!mq.matches);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);

  useEffect(() => {
    if (!isConfigLoaded) return;

    const reduced = uiSprings.prefersReduced;
    const sidebarXHidden = shellSidebarSlideEnabled && !reduced ? '-100%' : 0;

    void shellSidebarControls.set({ x: sidebarXHidden });
    void shellHeaderControls.set({ y: reduced ? 0 : -40, opacity: reduced ? 1 : 0 });
    void shellMainControls.set({ opacity: reduced ? 1 : 0, scale: reduced ? 1 : 0.98 });

    if (reduced) {
      setWelcomeAfterSidebarIntro(true);
      shellMountTimelineDoneRef.current = true;
      return;
    }

    setWelcomeAfterSidebarIntro(false);
    shellMountTimelineDoneRef.current = false;

    const sprSidebar = { type: 'spring', stiffness: 280, damping: 24 };
    const sprHeader = { type: 'spring', stiffness: 300, damping: 25, mass: 0.8 };
    const sprMain = { type: 'spring', stiffness: 300, damping: 25, mass: 0.8 };

    void shellSidebarControls.start({
      x: 0,
      transition: { ...sprSidebar, delay: MOUNT_ENTRANCE_MS.sidebar / 1000 },
    });
    void shellHeaderControls.start({
      y: 0,
      opacity: 1,
      transition: { ...sprHeader, delay: MOUNT_ENTRANCE_MS.header / 1000 },
    });
    void shellMainControls.start({
      opacity: 1,
      scale: 1,
      transition: { ...sprMain, delay: MOUNT_ENTRANCE_MS.main / 1000 },
    });

    const mainReadyId = window.setTimeout(() => {
      setWelcomeAfterSidebarIntro(true);
      shellMountTimelineDoneRef.current = true;
    }, MOUNT_ENTRANCE_MS.main);

    return () => {
      window.clearTimeout(mainReadyId);
    };
  }, [isConfigLoaded, uiSprings.prefersReduced, shellSidebarSlideEnabled]);

  /** Welcome input: show empty card first, then "Ask me anything" after card entrance completes. */
  const [welcomeAskPlaceholderVisible, setWelcomeAskPlaceholderVisible] = useState(false);
  const welcomeInputCardAnimTrackedRef = useRef(false);

  const isEmptyWelcomeUIMain =
    !messagesLoading &&
    (messages.length === 0 || messages.filter((m) => m.isUser).length === 0);

  const inputBoxRef = useRef(null);
  /** Full welcome column (headline + composer + quick actions) — skater roams here, not on the composer. */
  const [skaterFall, setSkaterFall] = useState(false);
  const [showSkater, setShowSkater] = useState(false);

  const handleSkaterFallComplete = useCallback(() => {
    setShowSkater(false);
    setSkaterFall(false);
    const el = inputBoxRef.current;
    if (el) {
      el.classList.add('skater-impact-shake');
      window.setTimeout(() => {
        el.classList.remove('skater-impact-shake');
      }, 400);
    }
  }, []);

  useEffect(() => {
    if (isEmptyWelcomeUIMain && chatbotConfig?.skater_girl?.enabled !== false) {
      setShowSkater(true);
      setSkaterFall(false);
    }
  }, [isEmptyWelcomeUIMain, chatbotConfig?.skater_girl?.enabled]);

  useEffect(() => {
    if (!isEmptyWelcomeUIMain) {
      welcomeInputCardAnimTrackedRef.current = false;
      setWelcomeAskPlaceholderVisible(false);
      return;
    }
    if (!isConfigLoaded) {
      welcomeInputCardAnimTrackedRef.current = false;
      setWelcomeAskPlaceholderVisible(false);
      return;
    }
    if (uiSprings.prefersReduced) {
      welcomeInputCardAnimTrackedRef.current = true;
      setWelcomeAskPlaceholderVisible(true);
      return;
    }
    welcomeInputCardAnimTrackedRef.current = false;
    setWelcomeAskPlaceholderVisible(false);
    const ms = MOUNT_ENTRANCE_COMPOSER_MS + 650;
    const id = window.setTimeout(() => {
      welcomeInputCardAnimTrackedRef.current = true;
      setWelcomeAskPlaceholderVisible(true);
    }, ms);
    return () => window.clearTimeout(id);
  }, [isEmptyWelcomeUIMain, isConfigLoaded, uiSprings.prefersReduced]);

  useEffect(() => {
    if (!isConfigLoaded || !isEmptyWelcomeUIMain) return;

    const reduced = uiSprings.prefersReduced;
    const welcomeCardSpring = { type: 'spring', stiffness: 540, damping: 26, mass: 0.58 };

    void welcomeComposerControls.set({
      opacity: reduced ? 1 : 0,
      y: reduced ? 0 : 20,
      scale: reduced ? 1 : 0.96,
    });
    void welcomeQuickActionsControls.set({
      opacity: reduced ? 1 : 0,
      y: reduced ? 0 : 20,
      scale: reduced ? 1 : 0.96,
    });

    if (reduced) {
      if (shellMountTimelineDoneRef.current) {
        setWelcomeAfterSidebarIntro(true);
      }
      return;
    }

    void welcomeComposerControls.start({
      opacity: 1,
      y: 0,
      scale: 1,
      transition: {
        ...welcomeCardSpring,
        delay: MOUNT_ENTRANCE_COMPOSER_MS / 1000,
      },
    });
    void welcomeQuickActionsControls.start({
      opacity: 1,
      y: 0,
      scale: 1,
      transition: {
        ...welcomeCardSpring,
        delay: MOUNT_ENTRANCE_MS.quickActions / 1000,
      },
    });

    if (shellMountTimelineDoneRef.current) {
      setWelcomeAfterSidebarIntro(true);
    }
  }, [isConfigLoaded, isEmptyWelcomeUIMain, uiSprings.prefersReduced]);

  /** Chat BG: stay at normal scale during pops; after they finish, slow zoom-in (not during pop, not instant). */
  const [chatBgWelcomeZoomComplete, setChatBgWelcomeZoomComplete] = useState(false);
  /**
   * Ken Burns zoom reached end scale (or never ran). When false, keep motion blur mounted even on thread
   * so sending a message mid-zoom doesn’t swap to static and kill the animation.
   */
  const [chatBgKenBurnsFinished, setChatBgKenBurnsFinished] = useState(true);
  const chatBgPrevWelcomeZoomGateRef = useRef(false);
  useEffect(() => {
    if (!hasChatBackground) return;
    const gate = chatBgWelcomeZoomComplete;
    if (!gate) {
      chatBgPrevWelcomeZoomGateRef.current = false;
    } else if (!chatBgPrevWelcomeZoomGateRef.current && isEmptyWelcomeUIMain) {
      setChatBgKenBurnsFinished(false);
    }
    chatBgPrevWelcomeZoomGateRef.current = gate;
  }, [hasChatBackground, chatBgWelcomeZoomComplete, isEmptyWelcomeUIMain]);

  useEffect(() => {
    if (!hasChatBackground) return;

    if (!isEmptyWelcomeUIMain) {
      return;
    }

    setChatBgWelcomeZoomComplete(false);

    const welcomePopReady = welcomeAfterSidebarIntro && isConfigLoaded;
    if (!welcomePopReady) return;

    const stagger = WELCOME_INTRO_STAGGER_SEC;
    const hasTw = Boolean(activeConversationId && messages.length === 0);
    const stepAfterTextarea = hasTw ? 2 : 1;
    const textareaDelay = hasTw ? stagger : 0;
    const spring = CHAT_BG_WELCOME_ZOOM_SPRING_SETTLE_SEC;
    const tPlaceholder = textareaDelay + spring;

    let quickEndSec = 0;
    if (showActions && !activeConversationId && messages.length === 0) {
      quickEndSec = stagger * (stepAfterTextarea + quickActions.length) + spring;
    }

    const runZoom = () => setChatBgWelcomeZoomComplete(true);

    if (!welcomeAskPlaceholderVisible) {
      if (quickEndSec > 0) {
        const id = window.setTimeout(runZoom, quickEndSec * 1000);
        return () => window.clearTimeout(id);
      }
      return;
    }

    const sendStart = 0.1 + 2 * 0.2;
    const toolbarEndSec = tPlaceholder + sendStart + spring;
    const delayMs = Math.max(quickEndSec, toolbarEndSec) * 1000;
    const id = window.setTimeout(runZoom, delayMs);
    return () => window.clearTimeout(id);
  }, [
    hasChatBackground,
    isEmptyWelcomeUIMain,
    welcomeAfterSidebarIntro,
    isConfigLoaded,
    welcomeAskPlaceholderVisible,
    showActions,
    activeConversationId,
    messages.length,
    quickActions.length,
  ]);

  /** Smooth “feed” scroll: adaptive gain so long replies glide up professionally. */
  useEffect(() => {
    if (!messagesScrollRef.current) return;
    const panel = messagesScrollRef.current;
    if (!panel) return;
    if (userScrolledUpRef.current) return;

    const hasUserThread = messages.some((m) => m.isUser);
    if (!hasUserThread) {
      panel.scrollTop = panel.scrollHeight;
      return;
    }

    let rafId = null;
    const maxScroll = () => Math.max(0, panel.scrollHeight - panel.clientHeight);
    const inLiveTokenStream = isStreaming && streamingResponse.length > 0;
    const streamActive = isStreaming;

    const tick = () => {
      rafId = null;
      // Re-check every frame — user may scroll up while animation is running
      if (userScrolledUpRef.current) return;
      const target = maxScroll();
      const cur = panel.scrollTop;
      const diff = target - cur;

      if (Math.abs(diff) <= CHAT_SCROLL_SMOOTH_EPS_PX) {
        panel.scrollTop = target;
        if (streamActive) {
          rafId = requestAnimationFrame(tick);
        }
        return;
      }

      const far = 1 - Math.exp(-Math.abs(diff) / CHAT_SCROLL_ADAPTIVE_REF_PX);
      const gmin = inLiveTokenStream ? CHAT_STREAM_SCROLL_GAIN_MIN : CHAT_SCROLL_OTHER_GAIN_MIN;
      const gmax = inLiveTokenStream ? CHAT_STREAM_SCROLL_GAIN_MAX : CHAT_SCROLL_OTHER_GAIN_MAX;
      const k = gmin + (gmax - gmin) * far;

      panel.scrollTop = cur + diff * k;
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);

    return () => {
      if (rafId != null) cancelAnimationFrame(rafId);
    };
  }, [messages, streamingResponse, isStreaming]);

  // Auto-save messages to backend when messages change and streaming is complete
  useEffect(() => {
    const saveMessages = async () => {
      // Only save if we have messages, a conversation ID, and streaming is complete
      // ALSO ensure that the current messages state actually belongs to the active conversation
      if (messages.length > 0 &&
        activeConversationId &&
        !isStreaming &&
        activeConversationId === messagesContextIdRef.current) {
        try {
          console.log('💾 Auto-saving messages to backend...');
          const saveResponse = await fetch(`${API_CONFIG.BASE_URL}/chat/messages`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-chatbot-id': API_CONFIG.CHATBOT_ID
            },
            body: JSON.stringify({
              conversationId: activeConversationId,
              messages: messages,
              sessionId,
              phone: userInfo?.phone,
              chatbotId: API_CONFIG.CHATBOT_ID
            }),
          });

          if (saveResponse.ok) {
            console.log('✅ Messages auto-saved successfully');
          } else {
            console.warn('⚠️ Failed to auto-save messages:', saveResponse.statusText);
          }
        } catch (saveError) {
          console.error('❌ Error auto-saving messages:', saveError);
        }
      }
    };

    // Debounce the save to avoid too many requests
    const timeoutId = setTimeout(saveMessages, 2000);
    return () => clearTimeout(timeoutId);
  }, [messages, activeConversationId, isStreaming]);





  const handleAuthClose = () => {
    setShowAuthForm(false);
    setAuthStep('phone');
    setAuthPhone('');
    setAuthOtp('');
  };



  // Handle navigation between responses
  const handlePrevResponse = useCallback((messageId) => {
    setMessages(prev => prev.map(m => {
      if (m.id === messageId && m.responses && m.activeResponseIndex > 0) {
        return { ...m, activeResponseIndex: m.activeResponseIndex - 1 };
      }
      return m;
    }));
  }, []);

  const handleNextResponse = useCallback((messageId) => {
    setMessages(prev => prev.map(m => {
      if (m.id === messageId && m.responses && m.activeResponseIndex < m.responses.length - 1) {
        return { ...m, activeResponseIndex: m.activeResponseIndex + 1 };
      }
      return m;
    }));
  }, []);

  // Handle copy message
  const handleCopyMessage = useCallback((messageId) => {
    const message = messages.find(m => m.id === messageId);
    if (!message) return;
    const textToCopy = message.responses?.[message.activeResponseIndex || 0]?.text || message.content || '';
    navigator.clipboard.writeText(textToCopy);
  }, [messages]);

  // Close language dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      // Use both the container class and check if the click is within the portal
      const isDropdownClick = event.target.closest('.language-selector-container') ||
        event.target.closest('.language-dropdown-portal') ||
        event.target.closest('.lang-dropdown-panel');
      const isLogoutDropdownClick = event.target.closest('.logout-dropdown-container');

      if (headerLangDropdownOpen && !isDropdownClick) {
        setHeaderLangDropdownOpen(false);
      }
      if (langDropdownOpen && !isDropdownClick) {
        setLangDropdownOpen(false);
      }
      if (logoutDropdownOpen && isAuthenticated && !isLogoutDropdownClick) {
        setLogoutDropdownOpen(false);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [headerLangDropdownOpen, langDropdownOpen, logoutDropdownOpen]);

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const fileType = file.type;
    const fileName = file.name;
    const fileSize = (file.size / 1024).toFixed(1) + ' KB';

    // Create object URL for preview
    const fileUrl = URL.createObjectURL(file);

    let attachmentType = 'file';
    if (fileType === 'application/pdf') {
      attachmentType = 'pdf';
    } else if (fileType.startsWith('image/')) {
      attachmentType = 'image';
    }

    setSelectedFile({
      file,
      type: attachmentType,
      fileName,
      fileUrl,
      fileSize
    });

    // Reset input value so same file can be uploaded again
    if (event.target) {
      event.target.value = '';
    }
  };

  const cancelChatFlows = useCallback(() => {
    setChannelSelectionPending(false);
    setProposalConfirmationPending(false);
    setTemplateSelectionPending(false);
    setEmailConfirmationPending(false);
    setEmailTemplateSelectionPending(false);
    setCallingConfirmationPending(false);
    setSelectedChannel(null);
    setSelectedEmailTemplate(null);
    setProposalQuestionTime(null);
    setEmailQuestionTime(null);
    setCallingQuestionTime(null);
  }, []);

  const handleSend = async (text = inputValue, sendOptions = {}) => {
    userScrolledUpRef.current = false;
    if (!text.trim() && !selectedFile) return;

    if (isEmptyWelcomeUIMain && showSkater) {
      setSkaterFall(true);
    }

    const displayText =
      typeof sendOptions.displayText === 'string' && sendOptions.displayText.trim()
        ? sendOptions.displayText.trim()
        : text;

    // Check if authentication is required (after 1 messages)
    const authEnabled = chatbotConfig?.authentication_enabled;
    if (authEnabled && !isAuthenticated && messageCount >= MESSAGE_LIMIT) {
      console.log('🔒 Authentication required - showing error banner');
      setAuthErrorBanner(true);
      return;
    }

    if (text.trim()) {
      recordSuggestionQuery(text.trim());
    }

    // Capture current state values
    const currentAttachment = selectedFile ? {
      type: selectedFile.type,
      fileName: selectedFile.fileName,
      fileUrl: selectedFile.fileUrl,
      fileSize: selectedFile.fileSize
    } : null;

    // Add user message to chat first (Unified for all flows). Visible text uses displayText (e.g. header nav short labels).
    const userMsg = {
      id: Date.now() + Math.random().toString(36).substr(2, 9),
      content: displayText,
      isUser: true,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      attachment: currentAttachment
    };

    const isFirstUserMessage = messages.filter(msg => msg.isUser).length === 0;

    setSendAnimKey((k) => k + 1);
    setJustSent(true);
    window.setTimeout(() => setJustSent(false), 280);

    setMessages(prev => [...prev, userMsg]);
    if (isFirstUserMessage) {
      setUserBubbleFlyInId(userMsg.id);
    }

    // Store user message reference for bot response
    lastUserMessageRef.current = {
      id: userMsg.id,
      content: displayText,
    };

    // Update conversation title if this is the first user message
    if (isFirstUserMessage && text.trim()) {
      const newTitle = generateChatTitle(displayText);
      setConversations(prev =>
        prev.map(conv =>
          conv.id === activeConversationId || conv.id === activeConversation
            ? { ...conv, title: newTitle }
            : conv
        )
      );
    }

    // Prepare for processing
    const normalizedText = text.toLowerCase().trim();
    const tempFile = selectedFile; // Capture for streaming call

    // If user interrupts any active flow with an invalid reply, cancel the flow immediately.
    const cancelAllFlows = () => {
      setChannelSelectionPending(false);
      setProposalConfirmationPending(false);
      setTemplateSelectionPending(false);
      setEmailConfirmationPending(false);
      setEmailTemplateSelectionPending(false);
      setCallingConfirmationPending(false);
      setSelectedChannel(null);
      setSelectedEmailTemplate(null);
      setProposalQuestionTime(null);
      setEmailQuestionTime(null);
      setCallingQuestionTime(null);
    };

    // Clear input state immediately
    setInputValue('');
    setSelectedFile(null);
    setShowActions(false);
    setMessageCount(prev => prev + 1);

    // Handle calling intent confirmation flow
    if (callingConfirmationPending) {
      console.log('🎯 [Calling Intent] User response:', normalizedText);

      // If user explicitly switches to email while in Calling confirmation, route directly to email flow
      const mentionsEmail = isFuzzyMatch(normalizedText, 'email') || isFuzzyMatch(normalizedText, 'mail') || normalizedText.includes('gmail');
      if (mentionsEmail && emailIntentConfig?.enabled) {
        console.log('🔄 [Calling Intent] User asked for email instead - switching to email flow');
        cancelAllFlows();
        setSelectedChannel('email');
        setEmailConfirmationPending(true);
        setEmailQuestionTime(Date.now());

        let detectedLangObj = { language: 'English', script: 'Latin' };
        for (let i = messages.length - 1; i >= 0; i--) {
          if (messages[i]?.detectedLanguageObj) {
            detectedLangObj = messages[i].detectedLanguageObj;
            break;
          }
        }
        const detectedLang = detectedLangObj.language || 'English';

        setTimeout(async () => {
          const originalText = emailIntentConfig.confirmation_prompt_text || 'Would you like to receive this via email?';
          const translatedText = await translateFlowText(originalText, detectedLangObj);
          const finalText = translatedText !== originalText ? translatedText : getFlowString(detectedLang, 'email_confirmation', originalText);

          const confirmationMsg = {
            id: Date.now() + Math.random().toString(36).substr(2, 9),
            content: finalText,
            isUser: false,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            detectedLanguageObj: detectedLangObj
          };
          setMessages(prev => [...prev, confirmationMsg]);
        }, 0);
        return;
      }

      // If user explicitly switches to WhatsApp (Proposal) while in Calling confirmation
      const mentionsWhatsApp = isFuzzyMatch(normalizedText, 'whatsapp') || isFuzzyMatch(normalizedText, 'proposal') || normalizedText.includes('quote');
      if (mentionsWhatsApp && intentConfig?.enabled) {
        console.log('🔄 [Calling Intent] User asked for WhatsApp instead - switching to proposal flow');
        cancelAllFlows();
        setSelectedChannel('whatsapp');

        if (isAuthenticated && userInfo?.phone) {
          setProposalConfirmationPending(true);
          setProposalQuestionTime(Date.now());

          let detectedLangObj = { language: 'English', script: 'Latin' };
          for (let i = messages.length - 1; i >= 0; i--) {
            if (messages[i]?.detectedLanguageObj) {
              detectedLangObj = messages[i].detectedLanguageObj;
              break;
            }
          }
          const detectedLang = detectedLangObj.language || 'English';

          setTimeout(async () => {
            const originalText = intentConfig.confirmation_prompt_text || 'Would you like me to send the proposal to your WhatsApp number?';
            const translatedText = await translateFlowText(originalText, detectedLangObj);
            const finalText = translatedText !== originalText ? translatedText : getFlowString(detectedLang, 'proposal_confirmation', originalText);

            const confirmationMsg = {
              id: Date.now() + Math.random().toString(36).substr(2, 9),
              content: finalText,
              isUser: false,
              time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              detectedLanguageObj: detectedLangObj
            };
            setMessages(prev => [...prev, confirmationMsg]);
          }, 0);
        } else {
          // Authentication required message logic (simplified for flow)
          const authMsg = {
            id: Date.now() + Math.random().toString(36).substr(2, 9),
            content: 'Please authenticate with your phone number to receive the proposal on WhatsApp.',
            isUser: false,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          };
          setMessages(prev => [...prev, authMsg]);
        }
        return;
      }
      // Use AI for robust Yes/No detection
      setIsAIProcessing(true);
      classifyConfirmation(text).then(async (classification) => {
        setIsAIProcessing(false);
        const { status } = classification;
        console.log('📞 [Calling Intent] Classified:', status);

        if (status === 'POSITIVE') {
          console.log('📞 [Calling Intent] Positive confirmation detected');

          // Ensure user is authenticated
          if (!isAuthenticated || !userInfo?.phone) {
            // Get language context
            let langObj = { language: 'English', script: 'Latin' };
            for (let i = messages.length - 1; i >= 0; i--) {
              if (messages[i]?.detectedLanguageObj) {
                langObj = messages[i].detectedLanguageObj;
                break;
              }
            }

            const authMsg = {
              id: Date.now() + Math.random().toString(36).substr(2, 9),
              content: 'Please authenticate with your phone number to proceed with the call.',
              isUser: false,
              time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              detectedLanguageObj: langObj
            };
            setMessages(prev => [...prev, authMsg]);

            translateFlowText('Please authenticate with your phone number to proceed with the call.', langObj).then(translated => {
              setMessages(prev => prev.map(m => m.id === authMsg.id ? { ...m, content: translated } : m));
            });

            setCallingConfirmationPending(false);
            return;
          }

          setIsInitiatingCall(true);
          setCallingConfirmationPending(false);

          // Notify user about initiation
          // Get language context
          let langObj = { language: 'English', script: 'Latin' };
          for (let i = messages.length - 1; i >= 0; i--) {
            if (messages[i]?.detectedLanguageObj) {
              langObj = messages[i].detectedLanguageObj;
              break;
            }
          }

          const initiatingMsg = {
            id: Date.now() + Math.random().toString(36).substr(2, 9),
            content: 'Connecting you now...',
            isUser: false,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            detectedLanguageObj: langObj
          };
          setMessages(prev => [...prev, initiatingMsg]);

          translateFlowText('Connecting you now...', langObj).then(translated => {
            setMessages(prev => prev.map(m => m.id === initiatingMsg.id ? { ...m, content: translated } : m));
          });

          try {
            const result = await initiateCall(API_CONFIG.BASE_URL, API_CONFIG.CHATBOT_ID, userInfo.phone);
            if (result.success) {
              console.log('✅ [Calling Intent] Call initiated successfully');
            } else {
              console.error('❌ [Calling Intent] Call initiation failed:', result.message);
              // Get language context
              let langObj = { language: 'English', script: 'Latin' };
              for (let i = messages.length - 1; i >= 0; i--) {
                if (messages[i]?.detectedLanguageObj) {
                  langObj = messages[i].detectedLanguageObj;
                  break;
                }
              }

              const failureMsg = {
                id: Date.now() + Math.random().toString(36).substr(2, 9),
                content: `Sorry, I couldn't initiate the call. ${result.message || 'Please try again later.'}`,
                isUser: false,
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                detectedLanguageObj: langObj
              };
              setMessages(prev => [...prev, failureMsg]);

              translateFlowText(`Sorry, I couldn't initiate the call. ${result.message || 'Please try again later.'}`, langObj).then(translated => {
                setMessages(prev => prev.map(m => m.id === failureMsg.id ? { ...m, content: translated } : m));
              });
            }
          } catch (callErr) {
            console.error('❌ [Calling Intent] Error initiating call:', callErr);
          } finally {
            setIsInitiatingCall(false);
          }
          return;
        } else if (status === 'NEGATIVE') {
          console.log('🚫 [Calling Intent] Negative confirmation detected');
          setCallingConfirmationPending(false);

          // Get language context
          let langObj = { language: 'English', script: 'Latin' };
          for (let i = messages.length - 1; i >= 0; i--) {
            if (messages[i]?.detectedLanguageObj) {
              langObj = messages[i].detectedLanguageObj;
              break;
            }
          }

          const cancelMsg = {
            id: Date.now() + Math.random().toString(36).substr(2, 9),
            content: 'No problem! Let me know if you need anything else.',
            isUser: false,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            detectedLanguageObj: langObj
          };
          setMessages(prev => [...prev, cancelMsg]);

          translateFlowText('No problem! Let me know if you need anything else.', langObj).then(translated => {
            setMessages(prev => prev.map(m => m.id === cancelMsg.id ? { ...m, content: translated } : m));
          });
          return;
        } else {
          // REMOVED AGGRESSIVE BLOCKING: "looksLikeChoiceAttempt" logic removed.
          // If the intent is not clear YES/NO, we assume it's a question or interruption and CANCEL the flow.

          /* 
          // OLD LOGIC (Aggressive Blocking):
          const isQuestion = /^(what|how|who|where|tell|show|explain|when|price|cost|service|query|help)/i.test(normalizedText) || normalizedText.includes('?') || normalizedText.split(' ').length >= 3;
          const looksLikeChoiceAttempt = !isQuestion && normalizedText.length < 20 && normalizedText.split(' ').length <= 2;

          if (looksLikeChoiceAttempt) {
            console.log('📞 [Calling Intent] Ambiguous choice, prompting for Yes/No');
            // ... (retry code)
            return;
          }
          */

          // NEW LOGIC: Fall through effectively means "Cancel Flow and Process as Normal Message"
          // AMBIGUOUS - Explicitly dispatch to AI response
          console.log('📞 [Calling Intent] Ambiguous input - Canceling flow and dispatching AI response');
          setCallingConfirmationPending(false);

          if (activeConversationId) {
            sendStreamingMessage(text, activeConversationId, tempFile);
          } else {
            createConversationAndSendMessage(text);
          }
          return;
        }
      });
      return;
    }

    // Handle channel selection flow (when both WhatsApp and Email are enabled)
    if (channelSelectionPending) {
      console.log('🔀 [Channel Selection] User response:', normalizedText);

      // Check if user selected WhatsApp (Fuzzy Match)
      // Matches "1", "1wala", "I choose 1", "option 1", "whatsapp", "wa"
      const isWhatsApp = normalizedText.includes('1') ||
        normalizedText === 'whatsapp' ||
        normalizedText === 'wa' ||
        isFuzzyMatch(normalizedText, 'whatsapp');

      // Check if user selected Email (Fuzzy Match)
      // Matches "2", "2wala", "option 2", "email", "mail"
      const isEmail = normalizedText.includes('2') ||
        normalizedText === 'email' ||
        normalizedText === 'mail' ||
        isFuzzyMatch(normalizedText, 'email') ||
        isFuzzyMatch(normalizedText, 'mail');

      if (isWhatsApp) {
        console.log('📱 [Channel Selection] User selected WhatsApp');
        setChannelSelectionPending(false);
        setSelectedChannel('whatsapp');

        // Check if user is authenticated for WhatsApp
        if (isAuthenticated && userInfo?.phone) {
          setProposalConfirmationPending(true);
          setProposalQuestionTime(Date.now());

          // Get language from the most recent message with detectedLanguageObj
          let langObj = { language: 'English', script: 'Latin' };
          for (let i = messages.length - 1; i >= 0; i--) {
            if (messages[i]?.detectedLanguageObj) {
              langObj = messages[i].detectedLanguageObj;
              break;
            }
          }

          setTimeout(async () => {
            const originalText = intentConfig?.confirmation_prompt_text || 'Would you like me to send the proposal to your WhatsApp number?';
            const translatedText = await translateFlowText(originalText, langObj);

            const confirmationMsg = {
              id: Date.now() + Math.random().toString(36).substr(2, 9),
              content: translatedText,
              isUser: false,
              time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              detectedLanguageObj: langObj
            };
            setMessages(prev => [...prev, confirmationMsg]);
          }, 0);
        } else {
          // Get language from the most recent message with detectedLanguageObj
          let langObj = { language: 'English', script: 'Latin' };
          for (let i = messages.length - 1; i >= 0; i--) {
            if (messages[i]?.detectedLanguageObj) {
              langObj = messages[i].detectedLanguageObj;
              break;
            }
          }

          setTimeout(async () => {
            const originalAuthText = 'Please authenticate with your phone number to receive the proposal via WhatsApp.';
            const translatedAuthText = await translateFlowText(originalAuthText, langObj);

            const authMsg = {
              id: Date.now() + Math.random().toString(36).substr(2, 9),
              content: translatedAuthText,
              isUser: false,
              time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              detectedLanguageObj: langObj
            };
            setMessages(prev => [...prev, authMsg]);
          }, 0);
        }
        return;
      }

      if (isEmail) {
        console.log('📧 [Channel Selection] User selected Email');
        setChannelSelectionPending(false);
        setSelectedChannel('email');

        // Start email confirmation flow
        setEmailConfirmationPending(true);
        setEmailQuestionTime(Date.now());

        // Get language from the most recent message with detectedLanguageObj
        let langObj = { language: 'English', script: 'Latin' };
        for (let i = messages.length - 1; i >= 0; i--) {
          if (messages[i]?.detectedLanguageObj) {
            langObj = messages[i].detectedLanguageObj;
            break;
          }
        }

        setTimeout(async () => {
          const originalText = emailIntentConfig?.confirmation_prompt_text || 'Would you like to receive this via email?';
          const translatedText = await translateFlowText(originalText, langObj);

          const confirmationMsg = {
            id: Date.now() + Math.random().toString(36).substr(2, 9),
            content: translatedText,
            isUser: false,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            detectedLanguageObj: langObj
          };
          setMessages(prev => [...prev, confirmationMsg]);
        }, 0);
        return;
      }

      // REMOVED AGGRESSIVE BLOCKING: "looksLikeChoiceAttempt" logic removed.
      /*
      const isQuestion = /^(what|how|who|where|tell|show|explain|when|price|cost|service|query|help)/i.test(normalizedText) || normalizedText.includes('?') || normalizedText.split(' ').length >= 3;
      const looksLikeChoiceAttempt = !isQuestion && normalizedText.length < 20 && normalizedText.split(' ').length <= 2;

      if (looksLikeChoiceAttempt) {
        console.log('🔀 [Channel Selection] Invalid choice, prompting for correction');
        // ... (retry code)
        return;
      }
      */

      // Assume interruption and explicitly dispatch to AI
      console.log('🔀 [Channel Selection] No match found - Canceling flow and dispatching AI response');
      cancelAllFlows();

      if (activeConversationId) {
        sendStreamingMessage(text, activeConversationId, tempFile);
      } else {
        createConversationAndSendMessage(text);
      }
      return;
    }

    // Handle proposal confirmation flow
    if (proposalConfirmationPending) {
      console.log('🔍 [Proposal Confirmation] User response:', {
        text: normalizedText,
        intentConfig: intentConfig,
        prompt_for_template_choice: intentConfig?.prompt_for_template_choice,
        templatesCount: proposalConfig?.templates?.length,
        templates: proposalConfig?.templates,
      });

      // If user explicitly switches to email while in WhatsApp confirmation, route directly to email flow
      const mentionsEmail = isFuzzyMatch(normalizedText, 'email') || isFuzzyMatch(normalizedText, 'mail') || normalizedText.includes('gmail');
      if (mentionsEmail && emailIntentConfig?.enabled) {
        console.log('🔄 [Proposal Confirmation] User asked for email instead - switching to email flow');
        cancelAllFlows();
        setSelectedChannel('email');
        setEmailConfirmationPending(true);
        setEmailQuestionTime(Date.now());

        // Determine language for flow question from previous messages
        let detectedLangObj = { language: 'English', script: 'Latin' };
        for (let i = messages.length - 1; i >= 0; i--) {
          if (messages[i]?.detectedLanguageObj) {
            detectedLangObj = messages[i].detectedLanguageObj;
            break;
          }
        }
        const detectedLang = detectedLangObj.language || 'English';

        setTimeout(async () => {
          const originalText = emailIntentConfig.confirmation_prompt_text || 'Would you like to receive this via email?';
          const translatedText = await translateFlowText(originalText, detectedLangObj);
          const finalText = translatedText !== originalText ? translatedText : getFlowString(detectedLang, 'email_confirmation', originalText);

          const confirmationMsg = {
            id: Date.now() + Math.random().toString(36).substr(2, 9),
            content: finalText,
            isUser: false,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            detectedLanguageObj: detectedLangObj
          };
          setMessages(prev => [...prev, confirmationMsg]);
        }, 0);
        return;
      }

      // If user explicitly asks for a call, switch to calling flow
      const mentionsCalling = isFuzzyMatch(normalizedText, 'call') || normalizedText.includes('talk') || normalizedText.includes('speak') || normalizedText.includes('expert');
      if (mentionsCalling && callingConfig?.enabled) {
        console.log('🔄 [Proposal Confirmation] User asked for call instead - switching to calling flow');
        cancelAllFlows();
        setCallingConfirmationPending(true);
        setCallingQuestionTime(Date.now());

        let detectedLangObj = { language: 'English', script: 'Latin' };
        for (let i = messages.length - 1; i >= 0; i--) {
          if (messages[i]?.detectedLanguageObj) {
            detectedLangObj = messages[i].detectedLanguageObj;
            break;
          }
        }
        const detectedLang = detectedLangObj.language || 'English';

        setTimeout(async () => {
          const originalText = callingConfig.flow_question || 'Would you like to speak with our expert?';
          const translatedText = await translateFlowText(originalText, detectedLangObj);
          const finalText = translatedText !== originalText ? translatedText : getFlowString(detectedLang, 'calling_confirmation', originalText);

          const confirmationMsg = {
            id: Date.now() + Math.random().toString(36).substr(2, 9),
            content: finalText,
            isUser: false,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            detectedLanguageObj: detectedLangObj
          };
          setMessages(prev => [...prev, confirmationMsg]);
        }, 0);
        return;
      }
      // Use AI for robust Yes/No detection
      setIsAIProcessing(true); // Show typing indicator
      classifyConfirmation(text).then(async (classification) => {
        setIsAIProcessing(false);
        const { status } = classification;
        console.log('Classified as:', status);

        if (status === 'POSITIVE') {
          setProposalConfirmationPending(false);

          let availableTemplates = proposalConfig?.templates || [];
          if (intentConfig?.template_choice_allowlist && intentConfig.template_choice_allowlist.length > 0) {
            availableTemplates = (proposalConfig?.templates || []).filter((t) =>
              intentConfig.template_choice_allowlist.includes(t.id) ||
              intentConfig.template_choice_allowlist.includes(t._id)
            );
          }

          // --- 🧠 STRICT SMART MATCHING ---
          let templateNameToSend = null;

          // 1. Get Candidate Keyword from Backend
          let candidateKeyword = intentContextData?.requested_template_keyword;

          // 2. VERIFY: Is this keyword grounded in user text?
          // This stops "WhatsApp" triggers from auto-selecting "Chat Agent"
          const isGrounded = isKeywordGrounded(candidateKeyword, messages);

          // 3. If Backend sent a guess that isn't in user text, discard it and try history
          if (!candidateKeyword || isGenericKeyword(candidateKeyword) || !isGrounded) {
            console.log('⚠️ [Smart Match] Keyword ungrounded (AI Guess). Scanning history...');
            candidateKeyword = findContextInHistory(messages);
          }

          if (candidateKeyword && availableTemplates.length > 0) {
            const cleanKw = candidateKeyword.toLowerCase().replace(/\b(proposal|email|whatsapp|quote|want|buy)\b/g, '').trim();
            const categoryKw = mapKeywordToCategory(cleanKw);

            const match = availableTemplates.find(t => {
              const tName = (t.template_name || t.display_name || '').toLowerCase();
              return tName.includes(cleanKw) || (categoryKw && tName.includes(categoryKw));
            });

            if (match) {
              templateNameToSend = match.template_name || match.display_name;
              console.log('✅ [WhatsApp] Auto-selected template:', templateNameToSend);
            }
          }
          // --- END SMART MATCHING ---

          // 4. Force Selection if NO valid match found (Handles "Send WhatsApp Proposal" new chat)
          const forceSelection = !templateNameToSend && availableTemplates.length > 1;

          if (forceSelection) {
            setTemplateSelectionPending(true);
            const templateList = availableTemplates.map((t, idx) =>
              `${idx + 1}. ${t.display_name}`
            ).join('\n');

            let langObj = { language: 'English', script: 'Latin' };
            for (let i = messages.length - 1; i >= 0; i--) {
              if (messages[i]?.detectedLanguageObj) { langObj = messages[i].detectedLanguageObj; break; }
            }

            setTimeout(async () => {
              const originalPrompt = intentConfig.template_choice_prompt_text || 'Which proposal would you like me to send?';
              const translatedPrompt = await translateFlowText(originalPrompt, langObj);

              const templatePrompt = {
                id: Date.now().toString(),
                content: `${translatedPrompt}\n\n${templateList}\n\nPlease type the number or name.`,
                isUser: false,
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                type: 'template_selection',
                templates: availableTemplates,
                detectedLanguageObj: langObj
              };
              setMessages(prev => [...prev, templatePrompt]);
            }, 0);
            return;
          }

          // If we have a template (from smart match) or only 1 template, SEND IT
          if (!templateNameToSend && availableTemplates.length === 1) {
            templateNameToSend = availableTemplates[0].template_name || availableTemplates[0].display_name;
          }
          if (templateNameToSend) {
            const phone = isAuthenticated ? userInfo?.phone : null;
            if (!phone) {
              let langObj = { language: 'English', script: 'Latin' };
              for (let i = messages.length - 1; i >= 0; i--) {
                if (messages[i]?.detectedLanguageObj) { langObj = messages[i].detectedLanguageObj; break; }
              }
              const errorMsg = {
                id: Date.now() + Math.random().toString(36).substr(2, 9),
                content: 'Please verify your phone number to send proposals.',
                isUser: false,
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                detectedLanguageObj: langObj
              };
              setMessages(prev => [...prev, errorMsg]);
              translateFlowText('Please verify your phone number to send proposals.', langObj).then(translated => {
                setMessages(prev => prev.map(m => m.id === errorMsg.id ? { ...m, content: translated } : m));
              });
              return;
            }
            try {
              await sendIntentProposal(API_CONFIG.CHATBOT_ID, phone, { templateName: templateNameToSend });
              let langObj = { language: 'English', script: 'Latin' };
              for (let i = messages.length - 1; i >= 0; i--) {
                if (messages[i]?.detectedLanguageObj) { langObj = messages[i].detectedLanguageObj; break; }
              }
              const successMsg = {
                id: Date.now() + Math.random().toString(36).substr(2, 9),
                content: intentConfig?.success_message || '✅ Proposal sent to your WhatsApp number!',
                isUser: false,
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                detectedLanguageObj: langObj
              };
              setMessages(prev => [...prev, successMsg]);
              translateFlowText(intentConfig?.success_message || '✅ Proposal sent to your WhatsApp number!', langObj).then(translatedSuccess => {
                setMessages(prev => prev.map(m => m.id === successMsg.id ? { ...m, content: translatedSuccess } : m));
              });
              if (intentConfig?.toast_message) {
                translateFlowText(intentConfig.toast_message, langObj).then(translatedToast => {
                  toast.success(translatedToast);
                });
              }
            } catch (error) {
              let langObj = { language: 'English', script: 'Latin' };
              for (let i = messages.length - 1; i >= 0; i--) {
                if (messages[i]?.detectedLanguageObj) { langObj = messages[i].detectedLanguageObj; break; }
              }
              const errorMsg = {
                id: Date.now() + Math.random().toString(36).substr(2, 9),
                content: `Failed to send proposal: ${error.message}`,
                isUser: false,
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                detectedLanguageObj: langObj
              };
              setMessages(prev => [...prev, errorMsg]);
            }
            return;
          }

          // No template matched - show the list
          setTemplateSelectionPending(true);
          const templateList = availableTemplates.map((t, idx) =>
            `${idx + 1}. ${t.display_name}${t.description ? ` - ${t.description}` : ''}`
          ).join('\n');
          let langObj = { language: 'English', script: 'Latin' };
          for (let i = messages.length - 1; i >= 0; i--) {
            if (messages[i]?.detectedLanguageObj) { langObj = messages[i].detectedLanguageObj; break; }
          }
          setTimeout(async () => {
            const originalPrompt = intentConfig.template_choice_prompt_text || 'Which proposal would you like me to send?';
            const translatedPrompt = await translateFlowText(originalPrompt, langObj);
            const templatePrompt = {
              id: Date.now() + Math.random().toString(36).substr(2, 9),
              content: `${translatedPrompt}\n\n${templateList}\n\nPlease type the number or name of the proposal you want.`,
              isUser: false,
              time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              type: 'template_selection',
              templates: availableTemplates,
              detectedLanguageObj: langObj
            };
            setMessages(prev => [...prev, templatePrompt]);
          }, 0);
          return;
        } else if (status === 'NEGATIVE') {
          setProposalConfirmationPending(false);

          // Get language context
          let langObj = { language: 'English', script: 'Latin' };
          for (let i = messages.length - 1; i >= 0; i--) {
            if (messages[i]?.detectedLanguageObj) {
              langObj = messages[i].detectedLanguageObj;
              break;
            }
          }

          const declineMsg = {
            id: Date.now() + Math.random().toString(36).substr(2, 9),
            content: 'No problem! How else can I help you?',
            isUser: false,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            detectedLanguageObj: langObj
          };
          setMessages(prev => [...prev, declineMsg]);

          // Translate decline message
          translateFlowText('No problem! How else can I help you?', langObj).then(translated => {
            setMessages(prev => prev.map(m => m.id === declineMsg.id ? { ...m, content: translated } : m));
          });
          // Continue with normal chat flow
        } else {
          // REMOVED AGGRESSIVE BLOCKING: "looksLikeChoiceAttempt" logic removed.
          /*
          const isQuestion = /^(what|how|who|where|tell|show|explain|when|price|cost|service|query|help)/i.test(normalizedText) || normalizedText.includes('?') || normalizedText.split(' ').length >= 3;
          const looksLikeChoiceAttempt = !isQuestion && normalizedText.length < 20 && normalizedText.split(' ').length <= 2;

          if (looksLikeChoiceAttempt) {
            console.log('🔍 [Proposal Confirmation] Ambiguous choice, prompting for Yes/No');
            // ... (retry code)
            return;
          }
          */

          // AMBIGUOUS - Explicitly dispatch to AI response
          console.log('🔍 [Proposal Confirmation] Ambiguous input - Canceling flow and dispatching AI response');
          cancelAllFlows();
          if (activeConversationId) {
            sendStreamingMessage(text, activeConversationId, tempFile);
          } else {
            createConversationAndSendMessage(text);
          }
        }
      });
      return; // Stop here, async logic handles the rest
    }

    // Handle email confirmation flow
    // Handle email confirmation flow
    if (emailConfirmationPending) {
      // If user explicitly switches to WhatsApp (Proposal) while in Email confirmation
      const mentionsWhatsApp = isFuzzyMatch(normalizedText, 'whatsapp') || isFuzzyMatch(normalizedText, 'proposal') || normalizedText.includes('quote');
      if (mentionsWhatsApp && intentConfig?.enabled) {
        console.log('🔄 [Email Confirmation] User asked for WhatsApp instead - switching to proposal flow');
        cancelAllFlows();
        setSelectedChannel('whatsapp');

        if (isAuthenticated && userInfo?.phone) {
          setProposalConfirmationPending(true);
          setProposalQuestionTime(Date.now());

          let detectedLangObj = { language: 'English', script: 'Latin' };
          for (let i = messages.length - 1; i >= 0; i--) {
            if (messages[i]?.detectedLanguageObj) {
              detectedLangObj = messages[i].detectedLanguageObj;
              break;
            }
          }
          const detectedLang = detectedLangObj.language || 'English';

          setTimeout(async () => {
            const originalText = intentConfig.confirmation_prompt_text || 'Would you like me to send the proposal to your WhatsApp number?';
            const translatedText = await translateFlowText(originalText, detectedLangObj);
            const finalText = translatedText !== originalText ? translatedText : getFlowString(detectedLang, 'proposal_confirmation', originalText);

            const confirmationMsg = {
              id: Date.now() + Math.random().toString(36).substr(2, 9),
              content: finalText,
              isUser: false,
              time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              detectedLanguageObj: detectedLangObj
            };
            setMessages(prev => [...prev, confirmationMsg]);
          }, 0);
        } else {
          const authMsg = {
            id: Date.now() + Math.random().toString(36).substr(2, 9),
            content: 'Please authenticate with your phone number to receive the proposal on WhatsApp.',
            isUser: false,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          };
          setMessages(prev => [...prev, authMsg]);
        }
        return;
      } const mentionsCalling = isFuzzyMatch(normalizedText, 'call') || normalizedText.includes('talk') || normalizedText.includes('speak') || normalizedText.includes('expert');
      if (mentionsCalling && callingConfig?.enabled) {
        console.log('🔄 [Email Confirmation] User asked for call instead - switching to calling flow');
        cancelAllFlows();
        setCallingConfirmationPending(true);
        setCallingQuestionTime(Date.now());

        let detectedLangObj = { language: 'English', script: 'Latin' };
        for (let i = messages.length - 1; i >= 0; i--) {
          if (messages[i]?.detectedLanguageObj) {
            detectedLangObj = messages[i].detectedLanguageObj;
            break;
          }
        }
        const detectedLang = detectedLangObj.language || 'English';

        setTimeout(async () => {
          const originalText = callingConfig.flow_question || 'Would you like to speak with our expert?';
          const translatedText = await translateFlowText(originalText, detectedLangObj);
          const finalText = translatedText !== originalText ? translatedText : getFlowString(detectedLang, 'calling_confirmation', originalText);

          const confirmationMsg = {
            id: Date.now() + Math.random().toString(36).substr(2, 9),
            content: finalText,
            isUser: false,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            detectedLanguageObj: detectedLangObj
          };
          setMessages(prev => [...prev, confirmationMsg]);
        }, 0);
        return;
      }
      // Use AI for robust Yes/No detection
      setIsAIProcessing(true);
      classifyConfirmation(text).then(async (classification) => {
        setIsAIProcessing(false);
        const { status } = classification;
        console.log('📧 [Email Confirmation] Classified:', status);

        if (status === 'POSITIVE') {
          setEmailConfirmationPending(false);

          let availableTemplates = emailConfig?.templates || [];
          if (emailIntentConfig?.template_choice_allowlist && emailIntentConfig.template_choice_allowlist.length > 0) {
            availableTemplates = emailConfig.templates.filter(t =>
              emailIntentConfig.template_choice_allowlist.includes(t._id) ||
              emailIntentConfig.template_choice_allowlist.includes(t.id)
            );
          }

          // --- 🧠 SMART CONTEXT RETRIEVAL ---
          let contextKeyword = intentContextData?.requested_template_keyword;
          if (!contextKeyword || isGenericKeyword(contextKeyword)) {
            console.log('⚠️ [Smart Context] Backend keyword missing/generic. Scanning history...');
            contextKeyword = findContextInHistory(messages);
          }

          // --- 🧠 SMART MATCHING ---
          let matchedTemplate = null;
          if (contextKeyword && availableTemplates.length > 0) {
            console.log('🔍 [Email Match] Using keyword:', contextKeyword);
            const cleanKw = (contextKeyword || '').toLowerCase().replace(/\b(proposal|email|whatsapp|quote|want|buy)\b/g, '').trim();
            const categoryKw = mapKeywordToCategory(cleanKw); // "swara" -> "calling"

            if (cleanKw.length > 1) {
              matchedTemplate = availableTemplates.find(t => {
                const tName = (t.template_name || t.display_name || '').toLowerCase();
                // 1. Direct Match (e.g. "Calling" in "AI Calling Agent")
                if (tName.includes(cleanKw)) return true;
                // 2. Mapped Category Match ("swara" -> "calling" -> "AI Calling Agent")
                if (categoryKw && tName.includes(categoryKw)) return true;
                return false;
              });
            }
          }

          if (matchedTemplate) {
            console.log('✅ [Email] Auto-selected template:', matchedTemplate.display_name || matchedTemplate.template_name);
            setSelectedEmailTemplate(matchedTemplate);

            // --- ⚡ EMAIL ADDRESS DETECTION ---
            // 1. AI-extracted email from chat (e.g. "patilurvi10@gmail.com")
            // 2. Logged-in user's email
            const extractedEmail = intentContextData?.email;
            const userEmail = isAuthenticated ? userInfo?.email : null;
            const targetEmail = extractedEmail || userEmail; // Prioritize explicitly mentioned email

            if (targetEmail && validateEmail(targetEmail)) {
              console.log('📧 [Email] Found target email, sending immediately:', targetEmail);
              try {
                await handleEmailSend(matchedTemplate._id || matchedTemplate.id, targetEmail);
                setEmailTemplateSelectionPending(false);
                setSelectedEmailTemplate(null);
              } catch (err) {
                // handleEmailSend shows toast/error; add retry prompt
                const emailPrompt = {
                  id: Date.now() + Math.random().toString(36).substr(2, 9),
                  content: 'Please enter your email address.',
                  isUser: false,
                  time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                  type: 'email_input',
                };
                setMessages(prev => [...prev, emailPrompt]);
              }
              return;
            }

            // If NO email found, ask for it
            let langObj = { language: 'English', script: 'Latin' };
            for (let i = messages.length - 1; i >= 0; i--) {
              if (messages[i]?.detectedLanguageObj) { langObj = messages[i].detectedLanguageObj; break; }
            }
            const emailPrompt = {
              id: Date.now() + Math.random().toString(36).substr(2, 9),
              content: 'Please enter your email address.',
              isUser: false,
              time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              type: 'email_input',
              detectedLanguageObj: langObj
            };
            setMessages(prev => [...prev, emailPrompt]);
            return;
          }
          // --- END SMART MATCHING ---

          // If no match found, show list (fallback)
          if (!matchedTemplate) {
            console.log('🛑 [Email] No context match found. Showing list.');
          }
          const isNewChat = messages.length <= 2;
          const forceSelection = shouldForceTemplateSelection({
            isNewChat,
            templates: availableTemplates,
            intentContextData,
            userMessage: intentContextData?._originalUserMessage
          });
          const needsTemplateSelection = emailIntentConfig?.prompt_for_template_choice && availableTemplates.length > 1;
          const showTemplateList = needsTemplateSelection || forceSelection;

          if (showTemplateList) {
            setEmailTemplateSelectionPending(true);
            const templateList = availableTemplates.map((t, idx) =>
              `${idx + 1}. ${t.template_name || t.display_name || 'Template'}${t.subject ? ` - ${t.subject}` : ''}`
            ).join('\n');

            // Get detected language from previous context if available
            // We can check the last message or use a stored ref to detected language
            // For now, let's try to get it from the last AI message if it has metadata, or default to English
            // But since we are in a callback here within handleSend, we might not have direct access to the latest detected language from the stream event
            // However, we are in 'handleSend' which doesn't know about language.
            // Wait! 'emailConfirmationPending' was triggered by 'onEmailIntentDetected' which HAD the language.
            // We should store that language when the intent is detected! 

            // Let's assume we can retrieve it from the last message which was the confirmation question
            const lastAiMsg = messages[messages.length - 1];
            // Just use a default for now, retrieving it is complex without state. 
            // Better approach: When onEmailIntentDetected ran, it knew the language.
            // We can look at the last message to see if we stored it there? 
            // Actually, let's just use the translate helper properly by first finding the language.

            // Hack: we'll try to find language from the last message if we attached it
            const contextLanguage = messages.length > 0 ? (messages[messages.length - 1].language || 'English') : 'English';
            // Note: we need to ensure confirmation msg stores language. I'll updated the handlers above to store it.

            setTimeout(async () => {
              const originalPrompt = emailIntentConfig.template_choice_prompt_text || 'Which email template would you like me to send?';
              // Since we don't have the language object easily here, we'll try to reconstruct or fetch it
              // For now, let's fetch language from context or last user message language.
              // A better way is to rely on the backend to tell us, but we are client side.

              // Let's rely on the fact that if we are here, the user just spoke.
              // But we need the language of the USER. 
              // We'll use a hack to get language from the confirmation message which we will update to store language metadata.

              // NOTE: This assumes we update the confirmation messages to store 'detectedLanguageObj'.
              let languageObj = { language: 'English', script: 'Latin' };

              // Search backwards for the most recent message with detectedLanguageObj
              for (let i = messages.length - 1; i >= 0; i--) {
                if (messages[i]?.detectedLanguageObj) {
                  languageObj = messages[i].detectedLanguageObj;
                  break;
                }
              }

              const translatedPrompt = await translateFlowText(originalPrompt, languageObj);

              const templatePrompt = {
                id: Date.now() + Math.random().toString(36).substr(2, 9),
                content: `${translatedPrompt}\n\n${templateList}\n\nPlease type the number or name.`,
                isUser: false,
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                type: 'email_template_selection',
                templates: availableTemplates,
                detectedLanguageObj: languageObj // Pass it forward
              };
              setMessages(prev => [...prev, templatePrompt]);
            }, 0);
            return;
          } else {
            // Send email immediately - use context keyword to match template
            try {
              const email = isAuthenticated ? userInfo?.email : null;
              if (!email) {
                // Get language context from the most recent message with detectedLanguageObj
                let langObj = { language: 'English', script: 'Latin' };
                for (let i = messages.length - 1; i >= 0; i--) {
                  if (messages[i]?.detectedLanguageObj) {
                    langObj = messages[i].detectedLanguageObj;
                    break;
                  }
                }

                const errorMsg = {
                  id: Date.now() + Math.random().toString(36).substr(2, 9),
                  content: 'Please check your email configuration.',
                  isUser: false,
                  time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                  detectedLanguageObj: langObj
                };
                setMessages(prev => [...prev, errorMsg]);

                translateFlowText('Please check your email configuration.', langObj).then(translated => {
                  setMessages(prev => prev.map(m => m.id === errorMsg.id ? { ...m, content: translated } : m));
                });
                return;
              }

              // Smart matching for fallback path (Backend -> History backup)
              let templateIdToSend = null;
              let ctxKw = intentContextData?.requested_template_keyword;
              if (!ctxKw || isGenericKeyword(ctxKw)) ctxKw = findContextInHistory(messages);
              if (ctxKw && availableTemplates.length > 0) {
                const cleanKw = (ctxKw || '').toLowerCase().replace(/\b(proposal|email|whatsapp|quote|want|buy)\b/g, '').trim();
                const categoryKw = mapKeywordToCategory(cleanKw);
                if (cleanKw.length > 1) {
                  const match = availableTemplates.find(t => {
                    const tName = (t.template_name || t.display_name || '').toLowerCase();
                    return tName.includes(cleanKw) || (categoryKw && tName.includes(categoryKw));
                  });
                  if (match) {
                    templateIdToSend = match._id || match.id;
                    console.log('📤 [Email] Matched template:', templateIdToSend);
                  }
                }
              }
              if (!templateIdToSend && !emailIntentConfig?.prompt_for_template_choice) {
                templateIdToSend = emailIntentConfig?.email_template_id || null;
              }
              if (!templateIdToSend && availableTemplates.length > 0) {
                templateIdToSend = availableTemplates[0]._id || availableTemplates[0].id;
              }

              console.log('Sending email with template:', templateIdToSend);
              const success = await sendEmail(API_CONFIG.CHATBOT_ID, email, templateIdToSend, {}, emailIntentConfig);

              if (success) {
                // Get language context from the most recent message with detectedLanguageObj
                let langObj = { language: 'English', script: 'Latin' };
                for (let i = messages.length - 1; i >= 0; i--) {
                  if (messages[i]?.detectedLanguageObj) {
                    langObj = messages[i].detectedLanguageObj;
                    break;
                  }
                }

                const originalSuccessMsg = emailIntentConfig?.success_message || '✅ Email sent successfully!';

                // Optimistically add message then update with translation
                const successMsg = {
                  id: Date.now() + Math.random().toString(36).substr(2, 9),
                  content: originalSuccessMsg,
                  isUser: false,
                  time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                  detectedLanguageObj: langObj
                };
                setMessages(prev => [...prev, successMsg]);

                translateFlowText(originalSuccessMsg, langObj).then(translated => {
                  setMessages(prev => prev.map(m => m.id === successMsg.id ? { ...m, content: translated } : m));

                  if (emailIntentConfig?.toast_message) {
                    translateFlowText(emailIntentConfig.toast_message, langObj).then(translatedToast => {
                      toast.success(translatedToast);
                    });
                  }
                });
              }
            } catch (error) {
              // Get language context
              let langObj = { language: 'English', script: 'Latin' };
              for (let i = messages.length - 1; i >= 0; i--) {
                if (messages[i]?.detectedLanguageObj) {
                  langObj = messages[i].detectedLanguageObj;
                  break;
                }
              }

              const errorMsg = {
                id: Date.now() + Math.random().toString(36).substr(2, 9),
                content: `Failed to send email: ${error.message}`,
                isUser: false,
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                detectedLanguageObj: langObj
              };
              setMessages(prev => [...prev, errorMsg]);

              translateFlowText(`Failed to send email: ${error.message}`, langObj).then(translated => {
                setMessages(prev => prev.map(m => m.id === errorMsg.id ? { ...m, content: translated } : m));
              });
            }
            return;
          }
        } else if (status === 'NEGATIVE') {
          setEmailConfirmationPending(false);
          const declineMsg = {
            id: Date.now() + Math.random().toString(36).substr(2, 9),
            content: 'Okay, no email will be sent. How else can I help?',
            isUser: false,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          };
          setMessages(prev => [...prev, declineMsg]);
        } else {
          // REMOVED AGGRESSIVE BLOCKING: "looksLikeChoiceAttempt" logic removed.
          /*
          const isQuestion = ...
          const looksLikeChoiceAttempt = ...
          if (looksLikeChoiceAttempt) { ... }
          */

          // AMBIGUOUS - Explicitly dispatch to AI response
          console.log('📧 [Email Confirmation] Ambiguous input - Canceling flow and dispatching AI response');
          cancelAllFlows();
          if (activeConversationId) {
            sendStreamingMessage(text, activeConversationId, tempFile);
          } else {
            createConversationAndSendMessage(text);
          }
        }
      });
      return;
    }

    // Handle email template selection (when no template is selected yet)
    if (emailTemplateSelectionPending && !selectedEmailTemplate) {
      // Check if user is selecting a template (when multiple templates exist)
      let availableTemplates = emailConfig?.templates || [];
      if (emailIntentConfig?.template_choice_allowlist && emailIntentConfig.template_choice_allowlist.length > 0) {
        availableTemplates = emailConfig.templates.filter(t =>
          emailIntentConfig.template_choice_allowlist.includes(t._id) ||
          emailIntentConfig.template_choice_allowlist.includes(t.id)
        );
      }

      // If multiple templates exist and prompt_for_template_choice is enabled, check for template selection
      const needsTemplateSelection = emailIntentConfig?.prompt_for_template_choice && availableTemplates.length > 1;

      if (needsTemplateSelection) {
        // Try to match user input to a template by number or name
        // FUZZY MATCH: Look for any standalone number in the text (e.g. "I want 1", "1wala")
        const numberMatch = normalizedText.match(/(\d+)/);
        let matchedTemplate = null;

        if (numberMatch) {
          const index = parseInt(numberMatch[1]) - 1;
          if (index >= 0 && index < availableTemplates.length) {
            matchedTemplate = availableTemplates[index];
          }
        }

        if (!matchedTemplate) {
          // Try direct includes match first
          matchedTemplate = availableTemplates.find(t => {
            const templateName = (t.template_name || t.display_name || '').toLowerCase();
            return templateName.includes(normalizedText) || normalizedText.includes(templateName);
          });

          // If no direct includes match, try fuzzy matching
          if (!matchedTemplate) {
            let highestScore = 0;
            availableTemplates.forEach(t => {
              const templateName = (t.template_name || t.display_name || '').toLowerCase();
              const subject = (t.subject || '').toLowerCase();
              const score = Math.max(
                getSimilarity(normalizedText, templateName),
                getSimilarity(normalizedText, subject)
              );
              if (score > highestScore && score > 0.6) { // Lower threshold for templates
                highestScore = score;
                matchedTemplate = t;
              }
            });
          }
        }

        if (matchedTemplate) {
          // Template selected - now ask for email
          setSelectedEmailTemplate(matchedTemplate);
          const emailPrompt = {
            id: Date.now() + Math.random().toString(36).substr(2, 9),
            content: 'Please enter your email address to receive the email.',
            isUser: false,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            type: 'email_input',
          };
          setMessages(prev => [...prev, emailPrompt]);
          return;
        } else {
          // REMOVED AGGRESSIVE BLOCKING: "looksLikeChoiceAttempt" logic removed.
          /*
          const isQuestion = ...
          const looksLikeChoiceAttempt = ...
          if (looksLikeChoiceAttempt) { ... }
          */
          // Template not found - assume interruption or new query, explicitly dispatch to AI
          console.log('⚠️ [Email Template Selection] Template not found - Canceling flow and dispatching AI response');
          cancelAllFlows();
          if (activeConversationId) {
            sendStreamingMessage(text, activeConversationId, tempFile);
          } else {
            createConversationAndSendMessage(text);
          }
          return;
        }
      } else {
        // Single template or selection disabled - but this shouldn't happen here since template would already be selected
        // This is a fallback - treat as template not found error
        const errorMsg = {
          id: Date.now() + Math.random().toString(36).substr(2, 9),
          content: 'Template selection error. Please try again.',
          isUser: false,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };
        setMessages(prev => [...prev, errorMsg]);
        setEmailTemplateSelectionPending(false);
        return;
      }
    }

    // Handle email input (when template is already selected - from list pick OR smart match skip)
    const waitingForEmailInput = selectedEmailTemplate && (
      emailTemplateSelectionPending ||
      (messages.length > 0 && messages[messages.length - 1]?.type === 'email_input')
    );
    if (waitingForEmailInput) {
      const trimmedEmail = text.trim();

      const wantsCancel = ['cancel', 'skip', 'nevermind', 'skip it', 'no thanks', 'never mind'].some(
        (k) => normalizedText === k || normalizedText.trim() === k
      ) || isFuzzyMatch(normalizedText, 'cancel') || isFuzzyMatch(normalizedText, 'skip');
      if (wantsCancel && !trimmedEmail.includes('@')) {
        cancelAllFlows();
        const declineMsg = {
          id: Date.now() + Math.random().toString(36).substr(2, 9),
          content: 'Okay, no email will be sent. How else can I help?',
          isUser: false,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };
        setMessages(prev => [...prev, declineMsg]);
        return;
      }

      // Check if it's a valid email
      if (validateEmail(trimmedEmail)) {
        const templateId = selectedEmailTemplate._id || selectedEmailTemplate.id;
        try {
          await handleEmailSend(templateId, trimmedEmail);
          setEmailTemplateSelectionPending(false);
          setSelectedEmailTemplate(null);
        } catch (err) {
          let langObj = { language: 'English', script: 'Latin' };
          for (let i = messages.length - 1; i >= 0; i--) {
            if (messages[i]?.detectedLanguageObj) { langObj = messages[i].detectedLanguageObj; break; }
          }
          const fallback = `Couldn't send the email. Please check the address and try again, or say "cancel" to skip.`;
          const errorMsg = {
            id: Date.now() + Math.random().toString(36).substr(2, 9),
            content: err?.message ? `Couldn't send: ${err.message}. Please check the address and try again, or say "cancel" to skip.` : fallback,
            isUser: false,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            type: 'email_input',
            detectedLanguageObj: langObj,
          };
          setMessages(prev => [...prev, errorMsg]);
          translateFlowText(errorMsg.content, langObj).then(translated => {
            setMessages(prev => prev.map(m => m.id === errorMsg.id ? { ...m, content: translated } : m));
          });
          // Keep emailTemplateSelectionPending & selectedEmailTemplate so user can retry
        }
        // 🛑 CRITICAL: Stop here. Do not let this message go to the LLM.
        return;
      }

      // Any other input while waiting for email: always ask to retry or cancel (never cancel flow and send to AI).
      // This keeps the flow from "stopping" when user types a name, partial email, or accidental message.
      console.log('📧 [Email Input] Invalid or unclear input - Prompting for valid email or cancel');
      let langObj = { language: 'English', script: 'Latin' };
      for (let i = messages.length - 1; i >= 0; i--) {
        if (messages[i]?.detectedLanguageObj) { langObj = messages[i].detectedLanguageObj; break; }
      }
      const original = 'Please enter a valid email address (e.g. you@example.com)';
      const retryMsg = {
        id: Date.now() + Math.random().toString(36).substr(2, 9),
        content: original,
        isUser: false,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        type: 'email_input',
        detectedLanguageObj: langObj,
      };
      setMessages(prev => [...prev, retryMsg]);
      translateFlowText(original, langObj).then(translated => {
        setMessages(prev => prev.map(m => m.id === retryMsg.id ? { ...m, content: translated } : m));
      });
      return;
    }

    // Handle template selection
    if (templateSelectionPending) {
      // Get available templates based on allowlist (same logic as confirmation)
      let availableTemplates = proposalConfig?.templates || [];
      if (intentConfig?.template_choice_allowlist && intentConfig.template_choice_allowlist.length > 0) {
        availableTemplates = (proposalConfig?.templates || []).filter((t) =>
          intentConfig.template_choice_allowlist.includes(t.id) ||
          intentConfig.template_choice_allowlist.includes(t._id)
        );
      }

      console.log('🔍 [Template Selection] User input:', text, 'Available templates:', availableTemplates);

      // Try to match user input to a template by number or name
      // FUZZY MATCH: Check if user typed a number (e.g. "I pick 1", "1wala")
      const numberMatch = normalizedText.match(/(\d+)/);
      let selectedTemplate = null;

      if (numberMatch) {
        const index = parseInt(numberMatch[1]) - 1;
        if (index >= 0 && index < availableTemplates.length) {
          selectedTemplate = availableTemplates[index];
          console.log('✅ [Template Selection] Matched by number:', index, selectedTemplate);
        }
      }

      // If not matched by number, try by name (only in available templates)
      if (!selectedTemplate) {
        // Try direct includes match first
        selectedTemplate = availableTemplates.find(t => {
          const displayName = t.display_name.toLowerCase();
          const templateName = t.template_name?.toLowerCase() || '';
          return displayName.includes(normalizedText) ||
            normalizedText.includes(displayName) ||
            templateName.includes(normalizedText) ||
            normalizedText.includes(templateName);
        });

        // If no direct includes match, try fuzzy matching
        if (!selectedTemplate) {
          let highestScore = 0;
          availableTemplates.forEach(t => {
            const displayName = t.display_name.toLowerCase();
            const templateName = t.template_name?.toLowerCase() || '';
            const score = Math.max(
              getSimilarity(normalizedText, displayName),
              getSimilarity(normalizedText, templateName)
            );
            if (score > highestScore && score > 0.6) { // Lower threshold for templates as they might be longer
              highestScore = score;
              selectedTemplate = t;
            }
          });
        }

        if (selectedTemplate) {
          console.log('✅ [Template Selection] Matched by name (Fuzzy):', selectedTemplate);
        }
      }

      if (selectedTemplate) {
        setTemplateSelectionPending(false);
        try {
          const phone = isAuthenticated ? userInfo?.phone : null;
          if (!phone) {
            const errorMsg = {
              id: Date.now() + Math.random().toString(36).substr(2, 9),
              content: 'Please verify your phone number to send proposals.',
              isUser: false,
              time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            };
            setMessages(prev => [...prev, errorMsg]);
            return;
          }

          await sendIntentProposal(API_CONFIG.CHATBOT_ID, phone, {
            templateName: selectedTemplate.template_name || selectedTemplate.display_name,
          });

          const successMsg = {
            id: Date.now() + Math.random().toString(36).substr(2, 9),
            content: intentConfig?.success_message || '✅ Proposal sent to your WhatsApp number!',
            isUser: false,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          };
          setMessages(prev => [...prev, successMsg]);

          if (intentConfig?.toast_message) {
            toast.success(intentConfig.toast_message);
          }
        } catch (error) {
          const errorMsg = {
            id: Date.now() + Math.random().toString(36).substr(2, 9),
            content: `Failed to send proposal: ${error.message}`,
            isUser: false,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          };
          setMessages(prev => [...prev, errorMsg]);
        }
        return;
      } else {
        // REMOVED AGGRESSIVE BLOCKING: "looksLikeChoiceAttempt" logic removed.
        /*
        const isQuestion = ...
        const looksLikeChoiceAttempt = ...
        if (looksLikeChoiceAttempt) { ... }
        */
        // Template not found - assume interruption, explicitly dispatch to AI
        console.log('⚠️ [Template Selection] Template not found - Canceling flow and dispatching AI response');
        cancelAllFlows();

        if (activeConversationId) {
          sendStreamingMessage(text, activeConversationId, tempFile);
        } else {
          createConversationAndSendMessage(text);
        }
        return;
      }
    }

    // Note: Proposal intent detection is now handled via LLM tool calls
    // Real mode - send to backend
    console.log('📤 Sending message:', {
      text: text?.substring(0, 50),
      activeConversationId,
      sessionId
    });

    // Check if chatbot is configured
    if (!API_CONFIG.CHATBOT_ID) {
      // Demo mode - simulate response
      setTimeout(() => {
        let content = "I'm running in demo mode. Please configure VITE_CHATBOT_ID in your environment to connect to the backend.";
        let response = {
          id: Date.now() + Math.random().toString(36).substr(2, 9),
          content: content,
          isUser: false,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };

        const lowerText = text.toLowerCase();

        if (lowerText.includes('track') || lowerText.includes('order')) {
          content = "Here's your order status (demo mode):";
          response.content = content;
          response.orderCard = {
            id: 'ORD-2024-78543',
            status: 'In Transit',
            progress: 75,
            eta: 'December 30, 2024',
            carrier: 'Premium Express',
          };
        } else if (lowerText.includes('analytics') || lowerText.includes('chart')) {
          content = "Here is your performance report for the last quarter:";
          response.content = content;
          response.type = 'chart';
          response.chart = {
            type: 'bar',
            title: 'Revenue Overview (Demo)',
            data: [
              { name: 'Oct', value: 45000 },
              { name: 'Nov', value: 52000 },
              { name: 'Dec', value: 68000 },
              { name: 'Jan', value: 61000 }
            ]
          };
        } else if (lowerText.includes('document') || lowerText.includes('pdf')) {
          content = "I've found your latest transaction report:";
          response.content = content;
          response.type = 'pdf';
          response.file = {
            fileName: 'Monthly_Statement_Dec_2024.pdf',
            fileUrl: '#',
            fileSize: '1.2 MB'
          };
        } else if (lowerText.includes('schedule') || lowerText.includes('meeting')) {
          content = "Here's your appointment (demo mode):";
          response.content = content;
          response.appointment = {
            title: 'Strategy Consultation',
            type: 'Video Conference',
            date: 'December 30, 2024',
            time: '2:00 PM IST',
            duration: '45 minutes',
          };
        } else if (lowerText.includes('hello') || lowerText.includes('hi') || lowerText === 'hey') {
          content = `${currentGreeting}! Welcome to Troika Tech Services. I'm here to assist you with your analytics, documents, tracking, and any inquiries you may have.`;
          response.content = content;
        }

        // Add responses array structure
        response.responses = [{
          id: `resp_${response.id}_1`,
          text: content,
          timestamp: Date.now()
        }];
        response.activeResponseIndex = 0;
        response.userMessageId = userMsg.id;
        response.userMessageText = text;

        setMessages(prev => [...prev, response]);
      }, 1500);
    } else {
      if (activeConversationId) {
        // Existing conversation - send message normally
        sendStreamingMessage(text, activeConversationId, tempFile);
      } else {
        // No active conversation - this is the first message, create conversation first
        console.log('🎯 First message in new conversation - creating conversation...');
        createConversationAndSendMessage(text);
      }
    }
  };

  /** Header center nav (About / Services / Contact): full prompt to RAG, short label in the user bubble */
  const handleHeaderNavKnowledge = (prompt, shortLabel) => {
    if (!prompt?.trim() || isStreaming || isAIProcessing) return;
    setHeaderNavActiveKey(shortLabel || prompt);
    cancelChatFlows();
    void handleSend(prompt, {
      displayText: shortLabel || prompt,
    });
  };

  const handleEmailSend = async (templateId, recipientEmail) => {
    const trimmedEmail = recipientEmail.trim();

    if (!trimmedEmail) {
      setEmailError('Please enter your email');
      return;
    }

    if (!validateEmail(trimmedEmail)) {
      setEmailError('Please enter a valid email address');
      return;
    }

    if (!templateId) {
      setEmailError('Template ID is missing. Please select a template.');
      return;
    }

    console.log('📧 [Email Send] Starting email send:', {
      templateId,
      recipientEmail: trimmedEmail,
      selectedTemplate: selectedEmailTemplate,
      selectedTemplateId: selectedEmailTemplate?._id || selectedEmailTemplate?.id,
      selectedTemplateName: selectedEmailTemplate?.template_name,
      templatesAvailable: emailConfig?.templates?.length || 0,
      allTemplates: emailConfig?.templates?.map(t => ({
        _id: t._id,
        id: t.id,
        name: t.template_name
      })),
    });

    setSendingEmail(true);
    setEmailError('');

    try {
      await sendEmail(API_CONFIG.CHATBOT_ID, templateId, trimmedEmail);

      // Use success message from email intent config if available, otherwise use default
      const successMessage = emailIntentConfig?.success_message || `✅ Email sent successfully to ${trimmedEmail}!`;
      const toastMessage = emailIntentConfig?.toast_message || 'Email sent successfully! ✅';

      toast.success(toastMessage);

      // Add success message to chat
      const template = emailConfig?.templates?.find(t => t._id === templateId || t.id === templateId);
      const templateName = template?.template_name || template?.display_name || 'Email';
      const successMsg = {
        id: Date.now() + Math.random().toString(36).substr(2, 9),
        content: emailIntentConfig?.success_message?.includes('{email}')
          ? emailIntentConfig.success_message.replace('{email}', trimmedEmail)
          : (emailIntentConfig?.success_message || `✅ ${templateName} has been emailed to ${trimmedEmail}.`),
        isUser: false,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages(prev => [...prev, successMsg]);

      // Reset state
      setEmailInput('');
      setSelectedEmailTemplate(null);
      setShowEmailModal(false);
    } catch (error) {
      console.error('Error sending email:', error);
      setEmailError(error.message || 'Failed to send email. Please try again.');
      toast.error(error.message || 'Failed to send email');
    } finally {
      setSendingEmail(false);
    }
  };

  // Create conversation and send first message
  const createConversationAndSendMessage = async (text) => {
    try {
      console.log('🏗️ Creating conversation for first message...');

      // Create conversation on backend
      const response = await fetch(`${API_CONFIG.BASE_URL}/chat/conversation`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId,
          title: 'New Conversation'
        }),
      });

      if (response.ok) {
        const data = await response.json();
        console.log('✅ Conversation created:', data.conversationId);

        const realConversationId = data.conversationId;

        // Update UI state with the real conversation
        const newConversation = {
          id: realConversationId,
          initials: getBrandingInitials(chatbotConfig) || 'T',
          title: data.title || 'New Conversation',
          preview: text?.substring(0, 30) || 'Ready to chat',
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          unread: false,
        };

        setConversations(prev => [newConversation, ...prev]);
        setActiveConversation(0);
        setActiveConversationId(realConversationId);
        messagesContextIdRef.current = realConversationId;

        // Now send the message to the newly created conversation
        sendStreamingMessage(text, realConversationId, selectedFile);
      } else {
        console.error('❌ Failed to create conversation:', response.statusText);
        // Revert to welcome state
        setShowActions(true);
      }
    } catch (error) {
      console.error('❌ Error creating conversation:', error);
      // Revert to welcome state
      setShowActions(true);
    }
  };

  return (
    <div
      className={`omni-chat-shell h-screen w-screen ${t.bg} flex overflow-hidden transition-colors duration-300${
        sidebarOpen ? ' sidebar-open' : ''
      }`}
    >
      <style>{`
        * {
          font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', sans-serif;
          -webkit-font-smoothing: antialiased;
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes slideIn {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
        @keyframes spinHalf {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes dot-bounce {
          0%, 80%, 100% { opacity: 0.3; transform: translateY(0); }
          40% { opacity: 1; transform: translateY(-4px); }
        }
        @keyframes text-slide-in {
          0% { 
            opacity: 0; 
            transform: translateY(10px) scale(0.95); 
            filter: blur(2px);
          }
          100% { 
            opacity: 1; 
            transform: translateY(0) scale(1); 
            filter: blur(0);
          }
        }
        .animate-fadeIn { animation: fadeIn 0.4s ease-out; }
        .animate-slideIn { animation: slideIn 0.3s ease-out; }
        .animate-spin-half { animation: spinHalf 1s linear infinite; }
        .rotating-text-item {
          display: inline-block;
          animation: text-slide-in 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
        }
        .rotating-dots .dot {
          display: inline-block;
          animation: dot-bounce 1.4s infinite ease-in-out;
          font-size: 1.5rem;
          font-weight: bold;
          line-height: 1;
        }
        .rotating-dots .dot:nth-child(1) { animation-delay: 0s; }
        .rotating-dots .dot:nth-child(2) { animation-delay: 0.2s; }
        .rotating-dots .dot:nth-child(3) { animation-delay: 0.4s; }
        .scrollbar-thin::-webkit-scrollbar { width: 6px; }
        .scrollbar-thin::-webkit-scrollbar-track { background: transparent; }
        .scrollbar-thin::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 3px; }
        /* Hide visible sidebar scrollbar (keep scroll behavior). */
        .sidebar-mobile,
        .sidebar-mobile > .flex-1 {
          scrollbar-width: none;
          -ms-overflow-style: none;
        }
        .sidebar-mobile::-webkit-scrollbar,
        .sidebar-mobile > .flex-1::-webkit-scrollbar {
          width: 0 !important;
          height: 0 !important;
          display: none !important;
        }
        
        /* Welcome Screen Styles — parent main pane handles height; stack centers children */
        .welcome-screen-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          width: 100%;
          max-width: 780px;
          margin: 0 auto;
          padding: 0 0 24px;
          box-sizing: border-box;
          min-height: 0;
        }

        .welcome-center-stack {
          flex: 0 1 auto;
        }

        .welcome-center-stack-inner {
          margin: 0;
          padding: 0;
        }

        /* ===== WELCOME TYPEWRITER - STABLE CENTERED ===== */
        .welcome-typewriter-container {
          display: flex;
          justify-content: center;
          align-items: center;
          margin-top: 0;
          margin-bottom: 24px;
          padding-top: 0;
          padding-bottom: 0;
          min-height: 88px;
          width: 100%;
        }

        /* Sized to content (no scrollbar); capped by parent width */
        .welcome-typewriter-text {
          font-size: 32px;
          font-weight: 700;
          margin: 0;
          width: max-content;
          max-width: 100%;
          text-align: center;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
        }

        .welcome-typewriter-text.welcome-typewriter--stacked {
          flex-direction: column;
        }

        .welcome-typewriter-text.welcome-typewriter--inline {
          flex-direction: row;
          flex-wrap: nowrap;
          align-items: center;
          justify-content: center;
        }

        .welcome-typewriter-text.welcome-typewriter--inline .welcome-fixed-line {
          width: auto;
          flex-shrink: 0;
          text-align: center;
        }

        .welcome-typewriter-text.welcome-typewriter--inline .welcome-rotating-line {
          flex: 0 1 auto;
        }

        .welcome-fixed-line {
          width: 100%;
          text-align: center;
        }

        .welcome-rotating-line {
          text-align: center;
          display: flex;
          justify-content: center;
          align-items: center;
          white-space: nowrap;
          overflow: visible;
        }

        .welcome-fixed-part {
          color: #1a1a2e;
          display: inline-block;
        }

        .welcome-typing-wrapper {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          white-space: nowrap;
        }

        .welcome-typing-part {
          color: #02066F;
          display: inline;
          white-space: nowrap;
        }

        .typing-cursor {
          color: #02066F;
          animation: cursor-blink 0.7s infinite;
        }

        @keyframes cursor-blink {
          0%, 50% { opacity: 1; }
          51%, 100% { opacity: 0; }
        }

        /* Animation Types for Welcome Typewriter */
        .welcome-typewriter-text.animation-fade .welcome-typing-part {
          animation: welcome-fade 0.5s ease-in-out;
        }
        
        @keyframes welcome-fade {
          from { opacity: 0; transform: translateY(5px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .welcome-typewriter-text.animation-slide .welcome-typing-part {
          animation: welcome-slide 0.5s ease-in-out;
        }

        @keyframes welcome-slide {
          from { opacity: 0; transform: translateX(-10px); }
          to { opacity: 1; transform: translateX(0); }
        }
        
        @property --angle {
          syntax: '<angle>';
          initial-value: 0deg;
          inherits: false;
        }

        @keyframes borderSpin {
          to {
            --angle: 360deg;
          }
        }

        .manus-input-gradient-shell {
          width: 100%;
          min-width: 0;
          max-width: 780px;
          padding: 2px;
          border-radius: 22px;
          box-sizing: border-box;
          background: conic-gradient(from var(--angle), #f97316, #06b6d4, #6366f1, #f97316);
          animation: borderSpin 6s linear infinite;
          opacity: 0.88;
          transition: opacity 0.25s ease, box-shadow 0.25s ease;
        }

        .manus-input-gradient-shell:focus-within {
          opacity: 1;
          box-shadow: 0 0 0 4px rgba(99, 102, 241, 0.12);
        }

        .manus-input-gradient-shell--reduced {
          animation: none;
          opacity: 1;
        }

        .manus-input-gradient-shell--reduced:focus-within {
          box-shadow: 0 0 0 4px rgba(99, 102, 241, 0.12);
        }

        .manus-input-box-large {
          width: 100% !important;
          min-width: 0 !important;
          max-width: 780px !important;
          min-height: 110px;
          height: auto;
          max-height: none;
          background: #ffffff;
          border-radius: 20px;
          padding: 16px 20px 12px 20px;
          box-sizing: border-box !important;
          display: flex;
          flex-direction: column;
          justify-content: flex-start;
          position: relative;
          z-index: 1;
          border: none;
        }

        .new-conversation-premium {
          position: relative;
          overflow: hidden;
        }

        .new-conversation-premium::after {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(
            105deg,
            transparent 0%,
            transparent 38%,
            rgba(255, 255, 255, 0.38) 50%,
            transparent 62%,
            transparent 100%
          );
          background-size: 220% 100%;
          animation: newConvShimmer 3s linear infinite;
          pointer-events: none;
        }

        @keyframes newConvShimmer {
          0% {
            background-position: 200% 0;
          }
          100% {
            background-position: -200% 0;
          }
        }

        .premium-troika-headline {
          margin-bottom: 1.25rem;
        }

        @media (prefers-reduced-motion: reduce) {
          .new-conversation-premium::after {
            animation: none;
            opacity: 0;
          }
        }

        .manus-input-textarea-wrap {
          width: 100%;
          flex: 1 1 auto;
          min-height: 0;
          display: flex;
          flex-direction: column;
          justify-content: flex-end;
        }
        
        .manus-textarea-large {
          flex: 0 1 auto;
          align-self: stretch;
          border: none;
          outline: none;
          resize: none;
          font-size: 16px;
          background: transparent;
          line-height: 1.4;
          width: 100%;
          min-height: 2.8em;
          field-sizing: content;
        }
        
        .manus-textarea-large::placeholder {
          color: #9ca3af;
          opacity: 1;
        }
        
        .manus-input-actions-bar {
          display: flex;
          flex-direction: row;
          justify-content: space-between;
          align-items: center;
          width: 100%;
          gap: 8px;
          flex-shrink: 0;
          margin-top: 0;
        }

        .manus-input-actions-bar button {
          box-sizing: border-box;
          width: 34px;
          height: 34px;
          min-height: 0;
          min-width: 0;
          border-radius: 50%;
          border: none;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: background 0.2s;
          transform: none !important;
          flex-shrink: 0;
          margin-bottom: 0;
        }

        .manus-input-actions-bar button svg {
          width: 16px;
          height: 16px;
          transform: none !important;
        }

        .manus-input-box-large * {
          transform-style: flat;
        }
        
        .quick-actions-section-welcome {
          margin-top: 24px;
          width: 100%;
          min-width: 0;
          max-width: 780px;
          box-sizing: border-box;
        }

        /* Welcome content width matches input */
        .welcome-content {
          width: 100%;
          min-width: 0;
          max-width: 780px;
          box-sizing: border-box;
        }

        /* USER message - compact, right aligned, fits content */
        .message-row.user [class*="max-w-[65%]"],
        [class*="justify-end"] [class*="max-w-[65%]"] {
          max-width: 70% !important;  /* Limit width for user messages */
          width: fit-content !important;  /* Only as wide as content */
        }

        /* BOT message - wide, left aligned, matches input */
        .message-row.assistant [class*="max-w-[65%]"],
        [class*="justify-start"] [class*="max-w-[65%]"] {
          max-width: 780px !important;  /* Wide to match input */
          width: fit-content !important;  /* Fill available space */
        }

        /* Bot message bubble - expand to full container width */
        .bot-message,
        .assistant-message,
        .message-bubble.bot {
          max-width: 100% !important;  /* Fill the container */
          width: fit-content;
          min-width: 200px;
        }

        /* Make sure both message area and input have same parent width */
        .messages-area,
        .chat-input-wrapper,
        .messages-container,
        .chat-input-container {
          max-width: 780px;
          width: 100%;
          margin: 0 auto;
        }

        /* Main column (excluding sidebar): allow flex child to fill viewport height */
        .main-content-mobile {
          min-height: 0;
        }

        .messages-container-mobile.welcome-mode {
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          min-height: 0;
          padding-left: 10px;
          padding-right: 10px;
          box-sizing: border-box;
        }

        /* Markdown content styling */
        .markdown-content {
          line-height: 1.6;
        }

        .markdown-content h1,
        .markdown-content h2,
        .markdown-content h3,
        .markdown-content h4,
        .markdown-content h5,
        .markdown-content h6 {
          font-weight: 600;
          margin-top: 16px;
          margin-bottom: 8px;
          line-height: 1.3;
        }

        .markdown-content h1 { font-size: 24px; }
        .markdown-content h2 { font-size: 20px; }
        .markdown-content h3 { font-size: 18px; }
        .markdown-content h4 { font-size: 16px; }
        .markdown-content h5 { font-size: 14px; }
        .markdown-content h6 { font-size: 13px; }

        .markdown-content p {
          margin-bottom: 12px;
        }

        /* Flush trailing margin on nested markdown blocks (not only direct children). */
        .markdown-content *:last-child {
          margin-bottom: 0 !important;
        }

        .markdown-content ul,
        .markdown-content ol {
          margin: 12px 0;
          padding-left: 24px;
        }

        .markdown-content li {
          margin-bottom: 6px;
        }

        .markdown-content strong {
          font-weight: 600;
        }

        .markdown-content em {
          font-style: italic;
        }

        .markdown-content code {
          background: #f1f5f9;
          padding: 2px 6px;
          border-radius: 4px;
          font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
          font-size: 14px;
        }

        .markdown-content pre {
          background: #f1f5f9;
          padding: 12px;
          border-radius: 6px;
          overflow-x: auto;
          margin: 12px 0;
        }

        .markdown-content pre code {
          background: transparent;
          padding: 0;
          border-radius: 0;
        }

        .markdown-content blockquote {
          border-left: 4px solid #e2e8f0;
          padding-left: 16px;
          margin: 16px 0;
          color: #64748b;
          font-style: italic;
        }

        .markdown-content hr {
          border: none;
          border-top: 1px solid #e2e8f0;
          margin: 24px 0;
        }

        /* ========== UNIVERSAL RESPONSIVE BASE ========== */
        /* Ensure consistent box-sizing across all devices */
        *, *::before, *::after {
          box-sizing: border-box;
        }

        /* Smooth transitions for better UX */


        /* Touch-friendly minimum sizes for interactive elements */
        button, .action-card-mobile, .language-selector-sidebar button {
          min-height: 44px; /* iOS Human Interface Guidelines minimum */
          min-width: 44px;
        }

        /* Welcome manus row: must stay inside the white box (global 44px min would overflow fixed-height shells) */
        .manus-input-actions-bar button {
          min-height: 0;
          min-width: 0;
        }

        /* Thread bottom bar: keep attach/mic/send aligned (global 44px min shifts icons vs input row) */
        .chat-input-mobile > button {
          min-height: 0;
          min-width: 0;
          align-self: center;
        }

        /* Better text scaling for different devices */
        html {
          font-size: 16px;
        }

        /* High DPI display support */
        @media (-webkit-min-device-pixel-ratio: 2), (min-resolution: 192dpi) {
          /* Slight adjustments for high-DPI displays */
          .manus-input-box-large,
          .manus-input-box-mobile {
            border-width: 1px;
          }
        }

        /* ========== MOBILE RESPONSIVE FIXES ========== */
        /* Only applies to screens 768px and below */

        @media screen and (max-width: 768px) {

          /* ============================================
             MOBILE ONLY FIXES - DO NOT AFFECT DESKTOP
             ============================================ */

          /* ===== FULL SCREEN WHITE BACKGROUND ===== */
          html, body, #root {
            background: #ffffff !important;
            margin: 0 !important;
            padding: 0 !important;
            overflow-x: hidden !important;
          }

          /* ===== REMOVE FLOATING CARD EFFECT ===== */
          .omni-chat-shell.h-screen.w-screen {
            background: #ffffff !important;
            border-radius: 0 !important;
            box-shadow: none !important;
            margin: 0 !important;
            width: 100vw !important;
            height: 100dvh !important;
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
          }

          /* ===== SIDEBAR - HIDDEN BY DEFAULT ===== */
          .sidebar-mobile,
          .w-80.bg-white.border-r {
            position: fixed !important;
            top: 0 !important;
            bottom: 0 !important;
            left: 0 !important;
            width: 100vw !important;  /* Full width on mobile */
            max-width: 100vw !important;
            height: 100dvh !important; /* Use dynamic viewport height */
            background: #ffffff !important;
            z-index: 10050 !important;
            transform: translateX(-100%) !important;  /* Hidden off-screen */
            transition: transform 0.3s ease-in-out !important;
            box-shadow: none !important;
            overflow-y: auto !important;
            overflow-x: hidden !important;
            display: flex !important;
            flex-direction: column !important;
          }
          
          /* Ensure sidebar content fills height properly */
          .sidebar-mobile {
            min-height: 100dvh !important;
          }
          .sidebar-mobile > .flex-1 {
            flex: 1 1 auto !important;
            min-height: 0 !important;
            overflow-y: auto !important;
          }

          /* ===== SIDEBAR OPEN STATE ===== */
          .sidebar-mobile.open,
          .sidebar-open .sidebar-mobile,
          .sidebar-open .w-80.bg-white.border-r {
            transform: translateX(0) !important;  /* Slide in */
            box-shadow: 4px 0 20px rgba(0, 0, 0, 0.15) !important;
          }

          /* ===== DARK OVERLAY WHEN SIDEBAR OPEN ===== */
          .sidebar-overlay {
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            right: 0 !important;
            bottom: 0 !important;
            width: 100vw !important;
            max-width: 100vw !important;
            height: 100vh !important;
            height: 100dvh !important;
            background: rgba(0, 0, 0, 0.5) !important;
            z-index: 10040 !important;
            opacity: 0 !important;
            visibility: hidden !important;
            transition: opacity 0.3s ease !important;
            pointer-events: none !important;
            margin: 0 !important;
            padding: 0 !important;
          }

          .sidebar-overlay.visible,
          .sidebar-open .sidebar-overlay {
            opacity: 1 !important;
            visibility: visible !important;
            pointer-events: auto !important;
          }

          /* ===== MAIN CONTENT - FULL WIDTH ===== */
          .main-content-mobile,
          .flex-1.flex.flex-col {
            width: 100vw !important;
            max-width: 100vw !important;
            margin-left: 0 !important;
            margin-right: 0 !important;
            padding-left: 0 !important;
            padding-right: 0 !important;
            position: relative !important;
            overflow-x: hidden !important;
          }
          
          /* Ensure parent container fills full width */
          .h-screen.w-screen {
            width: 100vw !important;
            max-width: 100vw !important;
            overflow-x: hidden !important;
          }

          /* ===== PREVENT SCROLL WHEN SIDEBAR OPEN ===== */
          body.sidebar-open {
            overflow: hidden !important;
            position: fixed !important;
            width: 100vw !important;
            max-width: 100vw !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          
          /* Prevent horizontal scroll and gaps */
          html, body {
            width: 100% !important;
            max-width: 100vw !important;
            overflow-x: hidden !important;
            margin: 0 !important;
            padding: 0 !important;
          }

          /* ===== MAIN CHAT HEADER — width/background; padding also from Tailwind ===== */
          .chat-header-mobile {
            box-sizing: border-box !important;
            width: 100% !important;
            min-height: 76.8px !important;
            background: #ffffff !important;
          }

          /* ===== HAMBURGER MENU BUTTON ===== */
          .hamburger-btn {
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            padding: 8px !important;
            z-index: 100 !important;
          }

          /* ===== WELCOME SCREEN FIXES ===== */
          .messages-container-mobile.welcome-mode {
            padding: 0 10px 16px !important;
            padding-top: 0 !important;
            display: flex !important;
            flex-direction: column !important;
            align-items: center !important;
            justify-content: center !important;
            flex: 1 1 auto !important;
            min-height: 0 !important;
            /* Opaque white hid WelcomeBgCanvas (aurora/wave) on phones; shell/html stay white */
            background: transparent !important;
          }

          /* Let configured chat background photo show through (welcome + thread) */
          .messages-container-mobile.chat-bg-active {
            background: transparent !important;
          }

          /* ===== INPUT BOX - PROPER WIDTH ===== */
          .manus-input-gradient-shell,
          .manus-input-box-large,
          .manus-input-box-mobile {
            width: 100% !important;
            max-width: 780px !important;
            min-width: unset !important;
            margin: 0 0 16px 0 !important;
          }

          /*
           * Phones: keep the same spinning conic idea as desktop, but thinner ring + softer hues +
           * slower spin so it stays lively without the heavy rainbow stripe look.
           */
          .manus-input-gradient-shell.manus-input-box-mobile {
            padding: 1px !important;
            border-radius: 18px !important;
            background: conic-gradient(
              from var(--angle),
              #94a3b8,
              #7dd3fc,
              #818cf8,
              #38bdf8,
              #94a3b8
            ) !important;
            animation: borderSpin 12s linear infinite !important;
            opacity: 1 !important;
            box-shadow: 0 1px 3px rgba(15, 23, 42, 0.07) !important;
          }
          .manus-input-gradient-shell.manus-input-box-mobile:focus-within {
            box-shadow:
              0 0 0 3px rgba(99, 102, 241, 0.14),
              0 4px 14px rgba(2, 6, 111, 0.07) !important;
          }
          .manus-input-gradient-shell.manus-input-box-mobile.manus-input-gradient-shell--reduced {
            animation: none !important;
            opacity: 1 !important;
          }
          .manus-input-gradient-shell.manus-input-box-mobile .manus-input-box-large {
            border-radius: 17px !important;
            box-shadow: none !important;
          }

          /* ===== QUICK ACTION CARDS ===== */
          .quick-actions-section-welcome {
            width: 100% !important;
            max-width: 780px !important;
            min-width: unset !important;
            margin: 0 !important;
          }

          .quick-actions-section-welcome .grid {
            display: flex !important;
            flex-direction: column !important;
            gap: 10px !important;
          }

          /* ===== CLOSE BUTTON IN SIDEBAR ===== */
          .sidebar-close-btn {
            position: absolute !important;
            top: 12px !important;
            right: 12px !important;
            padding: 8px !important;
            background: #f1f5f9 !important;
            border-radius: 50% !important;
            border: none !important;
            cursor: pointer !important;
            z-index: 10 !important;
          }
          
          /* Fix icon centering in mobile view only */
          @media screen and (max-width: 768px) {
            .sidebar-close-btn {
              display: flex !important;
              align-items: center !important;
              justify-content: center !important;
              width: 32px !important;
              height: 32px !important;
              padding: 0 !important;
            }
            
            .sidebar-close-btn svg,
            .sidebar-close-btn .w-5 {
              width: 20px !important;
              height: 20px !important;
              margin: 0 !important;
              padding: 0 !important;
            }
          }

          .sidebar-close-btn:hover {
            background: #e2e8f0 !important;
          }

          /* ===== HIDE "How may I assist you?" TEXT ===== */
          .quick-actions-section-welcome > p:first-child,
          .quick-actions-section-welcome > .text-sm.text-slate-500 {
            display: none !important;
          }

          /* ===== ICONS IN INPUT BOX - SMALLER & ROUND ===== */
          .manus-input-actions-bar button {
            width: 36px !important;
            height: 36px !important;
            min-height: 0 !important;
            min-width: 0 !important;
            border-radius: 50% !important;
            padding: 0 !important;
          }

          .manus-input-actions-bar button svg {
            width: 18px !important;
            height: 18px !important;
          }

        }

        /* ========== RESPONSIVE UTILITIES ========== */
        /* Hide mobile-only elements by default */
        .mobile-only {
          display: none !important;
        }

        /* Show mobile-only elements on tablets and below */
        @media (max-width: 991px) {
          .mobile-only {
            display: block !important;
          }
        }

        /* Hide tablet-only elements by default */
        .tablet-only {
          display: none !important;
        }

        /* Show tablet-only elements on tablets */
        @media (min-width: 768px) and (max-width: 991px) {
          .tablet-only {
            display: block !important;
          }
        }

        /* Hide desktop-only elements on mobile/tablet */
        .desktop-only {
          display: none !important;
        }

        /* Show desktop-only elements on desktop and up */
        @media (min-width: 992px) {
          .desktop-only {
            display: block !important;
          }
        }

        /* ===== DESKTOP STYLES REMAIN UNCHANGED ===== */
        /* Everything above 768px stays as is */
        @media screen and (min-width: 769px) {
          /* Desktop sidebar always visible - restore original */
          .sidebar-mobile,
          .w-80.bg-white.border-r {
            transform: translateX(0) !important;
            position: relative !important;
            width: 320px !important;
            max-width: 320px !important;
            height: 100vh !important;
            min-height: 100vh !important;
            top: auto !important;
            bottom: auto !important;
            left: auto !important;
            right: auto !important;
            overflow-y: auto !important;
            overflow-x: hidden !important;
          }

          .sidebar-overlay {
            display: none !important;
          }
          
          /* Reset any mobile-specific styles for desktop */
          .sidebar-mobile {
            width: 320px !important;
            max-width: 320px !important;
            position: relative !important;
            height: 100vh !important;
            min-height: 100vh !important;
          }
          
          /* Reset flex properties that might affect desktop */
          .sidebar-mobile > .flex-1 {
            flex: 1 1 auto !important;
            min-height: 0 !important;
          }

          .hamburger-btn {
            display: none !important;
          }
        }

        /* ========== DESKTOP - Language in header only, NOT sidebar ========== */
        @media (min-width: 769px) {
          /* Language stays in header on desktop */
          .chat-header .language-selector-container {
            display: flex !important;
          }

          /* Hide language from sidebar on desktop - extra specificity */
          .sidebar .language-section,
          .sidebar .language-selector-sidebar,
          .w-80.bg-white .language-section,
          .w-80.bg-white .language-selector-sidebar,
          .sidebar-mobile .language-section,
          .sidebar-mobile .language-selector-sidebar {
            display: none !important;
            visibility: hidden !important;
          }

          /* Hide "How may I assist you?" text on desktop */
          .quick-actions-section-welcome > p,
          .quick-actions-section-welcome > .text-sm.text-slate-500,
          p[class*="text-sm"][class*="text-secondary"] {
            display: none !important;
          }

          /* FIX: Proper container handling for both modes */
          .messages-container-mobile {
            width: 100% !important;
            display: flex !important;
            flex-direction: column !important;
            align-items: center !important;  /* Always center horizontally */
          }

          /* Welcome mode - fill main column below header; flex parent centers content */
          .messages-container-mobile.welcome-mode {
            justify-content: center !important;
            align-items: center !important;
            flex: 1 1 auto !important;
            min-height: 0 !important;
            padding: 0 10px 24px !important;
            padding-top: 0 !important;
          }

          /* Chat mode - proper scrolling container */
          .messages-container-mobile:not(.welcome-mode) {
            justify-content: flex-start !important;
            flex: 1 !important;  /* Take available height */
            min-height: 0 !important;  /* Allow shrinking */
            padding: 12px 12px 12px !important;
            overflow-y: auto !important;  /* Enable scrolling */
            max-height: calc(100vh - 200px) !important;  /* Leave room for input */
            scroll-padding-top: 8px;
          }

          /* Message bubbles always centered */
          .message-bubble-mobile,
          .max-w-3xl.mx-auto {
            width: 100% !important;
            max-width: 780px !important;
            margin: 0 auto !important;
          }

          /* Ensure proper scrolling in chat mode */
          .flex-1.overflow-y-auto {
            flex: 1 !important;
            min-height: 0 !important;
            display: flex !important;
            flex-direction: column !important;
          }

          /* Prevent layout collapse */
          .py-6.scrollbar-thin {
            flex: 1 !important;
            min-height: 0 !important;
            display: flex !important;
            flex-direction: column !important;
          }

          /* Desktop centering - both X and Y axes */
          .messages-container-mobile.welcome-mode,
          .messages-container.welcome-mode {
            display: flex !important;
            flex-direction: column !important;
            justify-content: center !important;  /* Y-axis center */
            align-items: center !important;      /* X-axis center */
            flex: 1 1 auto !important;
            min-height: 0 !important;
            padding: 0 10px 24px !important;
            padding-top: 0 !important;
          }

          /* Welcome screen container */
          .welcome-screen-container {
            display: flex !important;
            flex-direction: column !important;
            align-items: center !important;
            justify-content: center !important;
            width: 100% !important;
            max-width: 780px !important;
            margin-top: 0 !important;
            padding-top: 0 !important;
            padding-left: 0 !important;
            padding-right: 0 !important;
          }

          /* Remove any margin that might offset centering */
          .message-bubble-mobile,
          .max-w-3xl {
            margin: 0 !important;
          }

          /* Input box and cards centered */
          .manus-input-box-large,
          .quick-actions-section-welcome {
            margin-left: auto !important;
            margin-right: auto !important;
          }
        }

        /* ========== SMALL DEVICES (phones, 576px and up) ========== */
        @media screen and (min-width: 576px) and (max-width: 767px) {
          /* Slightly larger elements for small tablets/phones */
          .manus-input-box-mobile {
            min-height: 110px !important;
            height: auto !important;
            max-height: none !important;
            padding: 14px 16px 12px 16px !important;
          }

          .action-card-mobile {
            padding: 14px 16px !important;
          }

          .chat-header-mobile {
            padding: 12px 16px !important;
          }

          .messages-container-mobile:not(.welcome-mode) {
            padding: 12px 10px 12px !important;
          }

          .messages-container-mobile.welcome-mode {
            padding: 0 10px 16px !important;
            padding-top: 0 !important;
          }
        }

        /* ========== MEDIUM DEVICES (tablets, 768px and up) ========== */
        @media screen and (min-width: 768px) and (max-width: 991px) {
          /* Tablet-specific adjustments */
          .manus-input-box-large {
            width: 100% !important;
            max-width: 780px !important;
            margin: 0 auto 20px auto !important;
            min-height: 110px !important;
            height: auto !important;
            max-height: none !important;
          }

          .quick-actions-section-welcome {
            width: 100% !important;
            max-width: 780px !important;
            margin: 0 auto !important;
          }

          .messages-container-mobile:not(.welcome-mode) {
            padding: 26px 16px 20px !important;
          }

          .messages-container-mobile.welcome-mode {
            padding: 0 10px 20px !important;
            padding-top: 0 !important;
            justify-content: center !important;
          }

          /* Tablet: typewriter block grows with content */
          .welcome-typewriter-text {
            font-size: 24px;
            width: max-content;
            max-width: 100%;
          }

          .welcome-typewriter-container {
            margin-bottom: 24px;
            padding: 0;
          }

          /* Sidebar adjustments for tablets */
          .sidebar-mobile {
            width: 300px !important;
            max-width: 300px !important;
          }
        }

        /* ========== LARGE DEVICES (desktops, 992px and up) ========== */
        @media screen and (min-width: 992px) and (max-width: 1199px) {
          /* Desktop adjustments */
          .manus-input-box-large {
            width: 100% !important;
            max-width: 780px !important;
            margin: 0 auto 24px auto !important;
          }

          .quick-actions-section-welcome {
            width: 100% !important;
            max-width: 780px !important;
            margin: 0 auto !important;
          }

          .messages-container-mobile.welcome-mode {
            padding: 0 10px 24px !important;
            padding-top: 0 !important;
            justify-content: center !important;
          }
        }

        /* ========== EXTRA LARGE DEVICES (large desktops, 1200px and up) ========== */
        @media screen and (min-width: 1200px) {
          /* Large desktop optimizations */
          .manus-input-box-large {
            width: 100% !important;
            max-width: 780px !important;
            margin: 0 auto 24px auto !important;
            min-height: 120px !important;
            height: auto !important;
            max-height: none !important;
          }

          .quick-actions-section-welcome {
            width: 100% !important;
            max-width: 780px !important;
            margin: 0 auto !important;
          }

          .messages-container-mobile.welcome-mode {
            padding: 0 10px 28px !important;
            padding-top: 0 !important;
            justify-content: center !important;
          }

          /* Enhanced sidebar for large screens */
          .sidebar-mobile {
            width: 320px !important;
            max-width: 320px !important;
          }
        }

        /* ========== EXTRA SMALL DEVICES (phones < 576px) ========== */
        @media screen and (max-width: 575px) {
          .manus-input-box-mobile {
            min-height: 100px !important;
            height: auto !important;
            max-height: none !important;
            padding: 12px 12px 10px 12px !important;
          }

          .action-card-mobile {
            padding: 12px !important;
          }

          .chat-header-mobile {
            padding: 10px 12px !important;
          }

          .messages-container-mobile {
            padding: 12px 8px !important;
          }
        }

        /* ========== ORIENTATION SPECIFIC ADJUSTMENTS ========== */
        /* Portrait orientation optimizations */
        @media screen and (orientation: portrait) and (max-width: 768px) {
          .manus-input-box-mobile {
            min-height: 104px !important;
            height: auto !important;
            max-height: none !important;
          }

          .messages-container-mobile {
            padding: 16px 12px !important;
          }
        }

        /* Landscape orientation optimizations */
        @media screen and (orientation: landscape) and (max-height: 500px) {
          .manus-input-box-mobile {
            min-height: 92px !important;
            height: auto !important;
            max-height: none !important;
            padding: 10px 10px 8px 10px !important;
          }

          .messages-container-mobile {
            padding: 12px 8px !important;
          }

          .action-card-mobile {
            padding: 10px 12px !important;
          }

          .chat-header-mobile {
            padding: 8px 12px !important;
          }
        }

        /* ========== DEVICE TYPE SPECIFICATIONS ========== */
        /* iPad and tablet specific */
        @media screen and (min-width: 768px) and (max-width: 1024px) {
          .manus-input-box-large {
            min-height: 108px !important;
            height: auto !important;
            max-height: none !important;
          }

          .sidebar-mobile {
            width: 320px !important;
            max-width: 320px !important;
          }
        }

        /* Large tablets and small laptops */
        @media screen and (min-width: 1024px) and (max-width: 1366px) {
          .manus-input-box-large {
            width: 100% !important;
            max-width: 780px !important;
          }

          .quick-actions-section-welcome {
            width: 100% !important;
            max-width: 780px !important;
          }
        }

        /* ========== ACCESSIBILITY & USABILITY ========== */
        /* Reduced motion preference support */
        @media (prefers-reduced-motion: reduce) {
          *, *::before, *::after {
            transition: none !important;
            animation: none !important;
          }
        }

        /* High contrast mode support */
        @media (prefers-contrast: high) {
          .manus-input-box-large,
          .manus-input-box-mobile {
            border-width: 2px !important;
          }

          .action-card-mobile {
            border: 1px solid #000 !important;
          }
        }

        /* ========== COMPREHENSIVE RESPONSIVE SYSTEM ========== */

        /* 1. Mobile Styles (< 768px) */
        @media screen and (max-width: 768px) {
          html, body, #root {
            overflow-x: hidden !important;
            width: 100vw !important;
            margin: 0 !important;
            padding: 0 !important;
          }

          /* Force hide desktop elements */
          .desktop-only { display: none !important; }
          .mobile-only { display: block !important; }

          /* Sidebar Mobile */
          .sidebar-mobile {
            width: 100vw !important;
            max-width: 100vw !important;
            z-index: 10050 !important;
          }

          /* Main Content Area - ENSURE PERFECT CENTERING */
          .main-content-mobile {
            width: 100vw !important;
            max-width: 100vw !important;
            margin: 0 !important;
            padding: 0 !important;
            overflow-x: hidden !important;
            display: flex !important;
            flex-direction: column !important;
            position: relative !important;
            min-height: 0 !important;
            flex: 1 1 auto !important;
          }
          
          /* Ensure no gap on right side when sidebar is open */
          body.sidebar-open .main-content-mobile,
          .sidebar-open .main-content-mobile {
            width: 100vw !important;
            max-width: 100vw !important;
            margin-right: 0 !important;
            padding-right: 0 !important;
          }

          /* Welcome Screen Container - TRULY CENTERED */
          .welcome-screen-container {
            width: 100% !important;
            max-width: 780px !important;
            padding: 0 !important;
            padding-top: 0 !important;
            margin: 0 auto !important;
            margin-top: 0 !important;
            display: flex !important;
            flex-direction: column !important;
            align-items: center !important;
            justify-content: center !important;
            min-height: 0 !important;
            box-sizing: border-box !important;
          }

          /* Inner wrapper should take full width but center its content */
          .welcome-center-stack-inner,
          .welcome-screen-container > div {
            width: 100% !important;
            max-width: 100% !important;
            display: flex !important;
            flex-direction: column !important;
            align-items: center !important;
            justify-content: center !important;
            padding: 0 !important;
            padding-top: 0 !important;
            margin-top: 0 !important;
            box-sizing: border-box !important;
          }

          /* Typewriter Mobile - PERFECTLY CENTERED & SLIGHTLY BIGGER */
          .welcome-typewriter-container {
            width: 100% !important;
            max-width: 100% !important;
            margin-top: 0 !important;
            margin-bottom: 24px !important;
            padding-top: 0 !important;
            padding-bottom: 0 !important;
            display: flex !important;
            justify-content: center !important;
            align-items: center !important;
          }

          .welcome-typewriter-text {
            width: max-content !important;
            max-width: 100% !important;
            display: flex !important;
            flex-direction: column !important;
            align-items: center !important;
            justify-content: center !important;
            text-align: center !important;
            line-height: 1.4 !important;
            white-space: normal !important;
            margin: 0 auto !important;
          }

          .welcome-typewriter-text.welcome-typewriter--inline {
            flex-direction: row !important;
            flex-wrap: nowrap !important;
          }

          .welcome-typewriter-text.welcome-typewriter--inline .welcome-fixed-line {
            width: auto !important;
            flex-shrink: 0 !important;
          }

          .welcome-fixed-line {
            width: 100% !important;
            display: flex !important;
            justify-content: center !important;
            align-items: center !important;
          }

          .welcome-rotating-line {
            display: flex !important;
            justify-content: center !important;
            align-items: center !important;
            white-space: nowrap !important;
            overflow: visible !important;
          }

          .welcome-fixed-part {
            font-size: 20px !important;
            margin-right: 0 !important;
            margin-bottom: 0 !important;
            font-weight: 500 !important;
            color: #1a1a2e !important;
          }

          /* Keep cursor with text; rotating phrase stays one line */
          .welcome-typing-wrapper {
            display: inline-flex !important;
            justify-content: center !important;
            align-items: center !important;
            flex-shrink: 0 !important;
            flex-wrap: nowrap !important;
            white-space: nowrap !important;
          }

          .welcome-typing-part {
            display: inline !important;
            width: auto !important;
            color: #02066F !important;
            font-size: 22px !important;
            font-weight: 700 !important;
            white-space: nowrap !important;
            text-align: center !important;
          }

          .typing-cursor {
            display: inline-block !important;
            margin-left: 2px !important;
            font-size: 22px !important;
            color: #02066F !important;
            vertical-align: middle !important;
          }

          /* Input Box Mobile - FORCE CENTERED & WIDER */
          .manus-input-box-large,
          .manus-input-box-mobile {
            width: 100% !important;
            max-width: 100% !important;
            min-width: unset !important;
            margin: 0 auto 24px auto !important;
            box-sizing: border-box !important;
            padding: 12px 16px 12px 16px !important;
            height: auto !important;
            min-height: 100px !important;
            max-height: none !important;
            display: flex !important;
            flex-direction: column !important;
            align-self: center !important;
            transform: none !important;
          }

          /* Bottom Input Bar Fix */
          .chat-input-mobile {
            width: 100% !important;
            padding: 8px 12px !important;
            gap: 8px !important;
          }

          .chat-input-container-mobile {
            padding: 12px 16px !important;
            width: 100% !important;
            box-sizing: border-box !important;
            padding-bottom: calc(env(safe-area-inset-bottom) + 2rem) !important;
          }

          /* Authentication Banner Fix */
          .auth-banner-mobile,
          [class*="bg-gradient-to-r"][class*="from-red-50"] {
            margin: 12px 16px !important;
            padding: 12px !important;
            width: calc(100% - 32px) !important;
            box-sizing: border-box !important;
          }

          [class*="bg-gradient-to-r"][class*="from-red-50"] .flex {
            flex-wrap: wrap !important;
            gap: 12px !important;
          }

          [class*="bg-gradient-to-r"][class*="from-red-50"] .flex > div:first-child {
            width: 100% !important;
          }

          [class*="bg-gradient-to-r"][class*="from-red-50"] button {
            width: 100% !important;
            text-align: center !important;
            padding: 10px !important;
          }

          /* Message Bubbles - Ensure they use full width */
          .message-bubble-mobile {
            width: 100% !important;
            max-width: 100% !important;
            padding: 0 8px !important;
            margin: 0 !important;
            box-sizing: border-box !important;
          }

          /* USER message - allow it to grow more */
          .message-row.user [class*="max-w-[65%]"],
          [class*="justify-end"] [class*="max-w-[65%]"] {
            max-width: 80% !important;
            width: auto !important;
          }

          /* BOT message - allow it to grow more */
          .message-row.assistant [class*="max-w-[65%]"],
          [class*="justify-start"] [class*="max-w-[65%]"] {
            max-width: 85% !important;
            width: auto !important;
          }

          /* Messages Container scrolling area */
          .messages-container-mobile:not(.welcome-mode) {
            padding: 12px 0 !important;
            width: 100% !important;
            max-width: 100vw !important;
            overflow-x: hidden !important;
          }

          .active-chat-mode {
            padding-left: 0 !important;
            padding-right: 0 !important;
          }

          /* Messages Container */
          .messages-container-mobile {
            padding: 0 !important;
            width: 100% !important;
            max-width: 100vw !important;
            box-sizing: border-box !important;
            overflow-x: hidden !important;
          }

          .messages-container-mobile > div {
            width: 100% !important;
            max-width: 100% !important;
            padding: 8px 8px !important;
            box-sizing: border-box !important;
          }

          /* Quick Actions - Single Column on Mobile */
          .quick-actions-mobile {
            display: flex !important;
            flex-direction: column !important;
            gap: 10px !important;
            width: 100% !important;
            margin: 0 auto !important;
          }

          .action-card-mobile {
            width: 100% !important;
            padding: 12px 16px !important;
          }
        }

        /* Mobile Quick Contact Section Styles */
        @media screen and (max-width: 768px) {
          /* Mobile Quick Contact Section */
          .flex.items-center.gap-3.mb-6.md\\:hidden {
            display: flex !important;
            flex-direction: row !important;
            gap: 12px !important;
            margin-bottom: 24px !important;
          }

          /* WhatsApp Button Styles */
          .bg-\\[\\#25D366\\] {
            background-color: #25D366 !important;
            color: white !important;
            font-size: 12px !important;
            font-weight: 600 !important;
            padding: 10px 12px !important;
            border-radius: 12px !important;
            transition: opacity 0.2s ease !important;
            box-shadow: 0 2px 8px rgba(37, 211, 102, 0.2) !important;
          }

          .bg-\\[\\#25D366\\]:hover {
            opacity: 0.9 !important;
          }

          /* Call Button Styles */
          .bg-\\[\\#02066F\\] {
            background-color: #02066F !important;
            color: white !important;
            font-size: 12px !important;
            font-weight: 600 !important;
            padding: 10px 12px !important;
            border-radius: 12px !important;
            transition: opacity 0.2s ease !important;
            box-shadow: 0 2px 8px rgba(2, 6, 111, 0.2) !important;
          }

          .bg-\\[\\#02066F\\]:hover {
            opacity: 0.9 !important;
          }

          /* Icon Scaling */
          .scale-110 {
            transform: scale(1.1) !important;
          }
        }

        /* Hide mobile buttons on desktop */
        @media screen and (min-width: 769px) {
          .md\\:hidden {
            display: none !important;
          }
        }

        /* 2. Tablet Styles (769px - 1024px) */
        @media screen and (min-width: 769px) and (max-width: 1024px) {
          .manus-input-box-large {
            width: 90% !important;
            max-width: 780px !important;
          }

          .welcome-typewriter-text {
            font-size: 24px !important;
          }
        }

        /* ===== DESKTOP SPECIFIC ===== */
        @media screen and (min-width: 1025px) {
          .welcome-typewriter-text {
            width: max-content;
            max-width: 100%;
          }
        }

        /* ===== SMALL SCREEN FIX ===== */
        @media screen and (max-width: 480px) {
          .welcome-typewriter-text,
          .welcome-fixed-part,
          .welcome-typing-part {
            font-size: 14px !important;
          }
        }

        /* 3. Accessibility */
        @media (prefers-reduced-motion: reduce) {
          *,
          *::before,
          *::after {
            transition: none !important;
            animation: none !important;
          }
        }
      `}</style>

      <AnimatePresence>
        {settingsOpen && (
          <SettingsPanel key="settings-panel" onClose={() => setSettingsOpen(false)} />
        )}
      </AnimatePresence>

      {/* Proposal Modal */}
      {showProposalModal && proposalConfig?.templates && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-md w-full mx-4 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-semibold text-gray-800">Select Proposal Template</h3>
              <button
                onClick={() => setShowProposalModal(false)}
                className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors"
              >
                <X className="w-4 h-4 text-gray-600" />
              </button>
            </div>

            <div className="space-y-3">
              {proposalConfig.templates.map((template) => (
                <button
                  key={template.id}
                  onClick={() => {
                    handleSidebarProposalSend(template.id);
                  }}
                  className="w-full p-4 text-left border-2 border-slate-200 rounded-xl hover:border-green-500 hover:bg-green-50 transition-all"
                >
                  <div className="font-semibold text-gray-800">{template.display_name}</div>
                  {template.description && (
                    <div className="text-sm text-gray-500 mt-1">{template.description}</div>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Premium Modal */}
      {showPremiumModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full mx-4 relative">
            <button
              onClick={() => setShowPremiumModal(false)}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors"
            >
              <X className="w-5 h-5 text-gray-600" />
            </button>

            <div className="flex flex-col items-center text-center">
              {/* Crown Icon with Gradient Background */}
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-purple-600 to-orange-500 flex items-center justify-center mb-6 shadow-lg">
                <svg className="w-10 h-10 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
              </div>

              {/* Title */}
              <h2 className="text-2xl font-semibold text-pink-600 mb-4">Premium Feature</h2>

              {/* Description */}
              <p className="text-gray-600 text-base leading-relaxed">
                You can access this feature with a paid subscription.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Email Modal */}
      {showEmailModal && emailConfig?.templates && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-200">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-gray-800">Send Email</h2>
                <button
                  onClick={() => {
                    setShowEmailModal(false);
                    setSelectedEmailTemplate(null);
                    setEmailInput('');
                    setEmailError('');
                  }}
                  className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors"
                >
                  <X className="w-4 h-4 text-gray-600" />
                </button>
              </div>
            </div>

            <div className="p-6">
              {!selectedEmailTemplate && emailConfig.templates && emailConfig.templates.length > 1 ? (
                // Template selection (multiple templates)
                <div className="space-y-3">
                  <p className="text-sm text-gray-600 mb-4">Select an email template:</p>
                  {emailConfig.templates.map((template) => (
                    <button
                      key={template._id || template.id}
                      onClick={() => {
                        console.log('📧 [Email Modal] Template selected:', {
                          template,
                          _id: template._id,
                          id: template.id,
                          template_name: template.template_name,
                        });
                        setSelectedEmailTemplate(template);
                      }}
                      className="w-full p-4 text-left border-2 border-slate-200 rounded-xl hover:border-orange-500 hover:bg-orange-50 transition-all"
                    >
                      <div className="font-semibold text-gray-800">{template.template_name || template.display_name}</div>
                      {template.email_subject && (
                        <div className="text-sm text-gray-500 mt-1">{template.email_subject}</div>
                      )}
                    </button>
                  ))}
                </div>
              ) : (
                // Email input form (single template or after selection)
                <div className="space-y-4">
                  {selectedEmailTemplate && (
                    <div className="p-3 bg-slate-50 rounded-lg">
                      <div className="text-sm font-medium text-gray-700">Template:</div>
                      <div className="text-sm text-gray-600 mt-1">
                        {selectedEmailTemplate.template_name || selectedEmailTemplate.display_name}
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Email Address *
                    </label>
                    <input
                      type="email"
                      value={emailInput}
                      onChange={(e) => {
                        setEmailInput(e.target.value);
                        setEmailError('');
                      }}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter' && !sendingEmail) {
                          // Ensure we have a selected template when multiple exist
                          if (emailConfig.templates.length > 1 && !selectedEmailTemplate) {
                            setEmailError('Please select a template first.');
                            return;
                          }

                          const templateToUse = selectedEmailTemplate || emailConfig.templates[0];
                          const templateId = templateToUse?._id || templateToUse?.id;

                          if (!templateId) {
                            setEmailError('Template ID is missing. Please select a template.');
                            return;
                          }

                          handleEmailSend(templateId, emailInput);
                        }
                      }}
                      placeholder="Enter your email address"
                      className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:outline-none focus:border-orange-500 transition-colors"
                      autoFocus
                    />
                    {emailError && (
                      <p className="mt-2 text-sm text-red-600">{emailError}</p>
                    )}
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={() => {
                        // Ensure we have a selected template when multiple exist
                        if (emailConfig.templates.length > 1 && !selectedEmailTemplate) {
                          setEmailError('Please select a template first.');
                          return;
                        }

                        const templateToUse = selectedEmailTemplate || emailConfig.templates[0];
                        const templateId = templateToUse?._id || templateToUse?.id;

                        console.log('📧 [Email Modal] Send button clicked:', {
                          selectedTemplate: selectedEmailTemplate,
                          templateToUse,
                          templateId,
                          templateName: templateToUse?.template_name,
                          emailInput,
                          templatesCount: emailConfig.templates.length,
                          allTemplateIds: emailConfig.templates.map(t => ({ _id: t._id, id: t.id, name: t.template_name })),
                        });

                        if (!templateId) {
                          setEmailError('Template ID is missing. Please select a template.');
                          return;
                        }

                        handleEmailSend(templateId, emailInput);
                      }}
                      disabled={sendingEmail || !emailInput.trim()}
                      className="flex-1 px-4 py-3 bg-gradient-to-r from-orange-600 to-red-600 text-white font-semibold rounded-xl hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {sendingEmail ? (
                        <>
                          <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Sending...
                        </>
                      ) : (
                        <>
                          {Icons.email}
                          Send Email
                        </>
                      )}
                    </button>
                    {emailConfig.templates.length > 1 && (
                      <button
                        onClick={() => {
                          setSelectedEmailTemplate(null);
                          setEmailInput('');
                          setEmailError('');
                        }}
                        disabled={sendingEmail}
                        className="px-4 py-3 bg-slate-100 text-gray-700 font-semibold rounded-xl hover:bg-slate-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Back
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Hidden File Input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileUpload}
        className="hidden"
        accept=".pdf,image/*"
      />

      {(() => {
        const omniMobileDrawer = (
          <>
            <div
              className={`sidebar-overlay ${sidebarOpen ? 'visible' : ''}`}
              onClick={() => setSidebarOpen(false)}
            />

            <motion.div
              ref={sidebarMobileRef}
              className={`w-80 ${t.sidebar} border-r ${t.border} flex flex-col sidebar-mobile ${sidebarOpen ? 'open' : ''}`}
              style={{ willChange: 'transform' }}
            >
        <motion.div
          className="flex h-full min-h-0 flex-1 flex-col"
          initial={
            shellSidebarSlideEnabled && !uiSprings.prefersReduced ? { x: '-100%' } : { x: 0 }
          }
          animate={
            shellSidebarSlideEnabled && !uiSprings.prefersReduced
              ? shellSidebarControls
              : { x: 0, transition: { duration: 0 } }
          }
        >
          <div className="flex min-h-0 flex-1 flex-col">
            <div
              className={`relative shrink-0 px-4 py-4 border-b ${t.borderLight}`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  {chatbotConfig?.sidebar_branding?.enabled && chatbotConfig?.sidebar_branding?.branding_logo_url ? (
                    <a
                      href={chatbotConfig.sidebar_branding.branding_logo_link || '#'}
                      target={chatbotConfig.sidebar_branding.branding_logo_link ? '_blank' : undefined}
                      rel={chatbotConfig.sidebar_branding.branding_logo_link ? 'noopener noreferrer' : undefined}
                      className="block flex-shrink-0"
                    >
                      <img
                        src={chatbotConfig.sidebar_branding.branding_logo_url}
                        alt={chatbotConfig.sidebar_branding.branding_text || 'AI Assistant'}
                        className="w-10 h-10 rounded-xl object-cover"
                        onError={(e) => {
                          e.target.src = OmniAgentLogo;
                        }}
                      />
                    </a>
                  ) : (
                    <img src={OmniAgentLogo} alt="OmniAgent" className="w-10 h-10 rounded-xl object-cover flex-shrink-0" />
                  )}
                  <div className="min-w-0">
                    <h1 className={`font-semibold text-sm ${t.text} truncate`}>
                      <T>{chatbotConfig?.sidebar_branding?.branding_company || 'Troika Tech'}</T>
                    </h1>
                    <p className={`text-xs ${t.textMuted} truncate`}>
                      {(() => {
                        const shouldShowAuth = chatbotConfig?.authentication_enabled && !isAuthenticated && messageCount >= MESSAGE_LIMIT;
                        return shouldShowAuth ? <T>Authentication Required</T> : <T>{chatbotConfig?.sidebar_branding?.branding_text || 'Enterprise'}</T>;
                      })()}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setSidebarOpen(false)}
                  className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 hover:bg-slate-200 transition-colors flex-shrink-0 ml-3 md:hidden"
                  aria-label="Close sidebar"
                >
                  <X className="w-4 h-4 text-gray-500" />
                </button>
              </div>
            </div>

            <div className="shrink-0">
              <div className="px-4 pt-4 pb-3">
                <motion.button
                  type="button"
                  className={`new-conversation-premium relative w-full overflow-hidden py-3 text-sm font-semibold rounded-xl transition-colors flex items-center justify-center gap-2 ${hasFullAccess
                    ? `${t.button} hover:opacity-95`
                    : 'bg-[#02066F] text-white cursor-not-allowed'
                    }`}
                  disabled={!hasFullAccess}
                  onClick={(e) => {
                    if (!hasFullAccess) return;
                    const rect = e.currentTarget.getBoundingClientRect();
                    const rid = `${Date.now()}-${Math.random()}`;
                    setNewConvRipples((prev) => [...prev, { id: rid, x: e.clientX - rect.left, y: e.clientY - rect.top }]);
                    window.setTimeout(() => {
                      setNewConvRipples((prev) => prev.filter((x) => x.id !== rid));
                    }, 520);

                    console.log('🆕 Starting new conversation (Full State Reset)...');
                    setActiveConversationId(generateUniqueConversationId());
                    setActiveConversation(0);
                    messagesContextIdRef.current = null;
                    setMessages([]);
                    setMessagesLoading(false);
                    setShowActions(true);
                    setIntentContextData(null);
                    setProposalConfirmationPending(false);
                    setEmailConfirmationPending(false);
                    setCallingConfirmationPending(false);
                    setTemplateSelectionPending(false);
                    setEmailTemplateSelectionPending(false);
                    setChannelSelectionPending(false);
                    setSelectedChannel(null);
                    setSelectedEmailTemplate(null);
                    setTimeout(() => {
                      const input = document.querySelector('input[type="text"], textarea');
                      if (input) input.focus();
                    }, 100);
                  }}
                  whileHover={
                    hasFullAccess && !uiSprings.prefersReduced
                    ? {
                        scale: 1.03,
                        y: -2,
                        boxShadow: '0 8px 24px rgba(2,6,111,0.35)',
                      }
                    : undefined
                  }
                  whileTap={hasFullAccess && !uiSprings.prefersReduced ? { scale: 0.95 } : undefined}
                  transition={uiSprings.snappy}
                >
                  {newConvRipples.map((ripple) => (
                    <motion.span
                      key={ripple.id}
                      className="pointer-events-none absolute rounded-full bg-white"
                      style={{
                        left: ripple.x,
                        top: ripple.y,
                        width: 10,
                        height: 10,
                        marginLeft: -5,
                        marginTop: -5,
                      }}
                      initial={{ scale: 0, opacity: 0.3 }}
                      animate={{ scale: 2.5, opacity: 0 }}
                      transition={{ duration: uiSprings.prefersReduced ? 0 : 0.5, ease: 'easeOut' }}
                    />
                  ))}
                  <span className="relative z-[1] flex items-center justify-center gap-2">
                    {Icons.plus}
                    <T>New Conversation</T>
                  </span>
                </motion.button>
              </div>
              {(chatbotConfig.whatsapp_enabled || chatbotConfig.call_enabled) && (
              <div className="flex items-center gap-3 mb-4 px-4 md:px-6 md:mb-6 md:hidden">
                {chatbotConfig.whatsapp_enabled && (
                <button
                  onClick={() => {
                    if (chatbotConfig.whatsapp_mode === 'premium_modal') {
                      setShowPremiumModal(true);
                      return;
                    }
                    const number = chatbotConfig.whatsapp_number?.replace(/\D/g, '');
                    if (number) window.open(`https://wa.me/${number}`, '_blank');
                  }}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-[#25D366] text-white text-xs font-semibold hover:opacity-90 transition-all shadow-sm"
                >
                  <span className="scale-110">{Icons.whatsapp}</span>
                  <span><T>WhatsApp</T></span>
                </button>
                )}
                {chatbotConfig.call_enabled && (
                <button
                  onClick={() => {
                    if (chatbotConfig.call_mode === 'premium_modal') {
                      setShowPremiumModal(true);
                      return;
                    }
                    const number = chatbotConfig.call_number?.replace(/\D/g, '');
                    if (number) window.location.href = `tel:${number}`;
                  }}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-[#02066F] text-white text-xs font-semibold hover:opacity-90 transition-all shadow-sm"
                >
                  <span className="scale-110">{Icons.phone}</span>
                  <span>{chatbotConfig.call_text || 'Call Us'}</span>
                </button>
                )}
              </div>
              )}
              {resolvedHeaderNavItems.length > 0 && (
                <div className="border-t border-slate-100 md:hidden">
                  <div className="px-2 py-1 md:px-4 md:py-2 flex-shrink-0">
                    <p className={`text-xs font-semibold uppercase tracking-wider ${t.textMuted}`}><T>Main Menu</T></p>
                  </div>
                  <div className="flex flex-col [&>button:last-child]:border-b-0">
                    {resolvedHeaderNavItems.map(({ label, prompt }, idx) => (
                      <button
                        key={`sidebar-nav-${label}-${idx}`}
                        type="button"
                        disabled={isStreaming || isAIProcessing}
                        onClick={() => {
                          handleHeaderNavKnowledge(prompt, label);
                          setSidebarOpen(false);
                        }}
                        className={`block w-full text-left px-3 md:px-4 py-2 text-sm font-semibold transition-colors ${t.text} ${t.cardHover} border-b ${t.borderLight} disabled:pointer-events-none disabled:opacity-45`}
                      >
                        <T>{label}</T>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="shrink-0 px-2 pb-2 md:px-4">
              <button
                type="button"
                onClick={() => setRecentChatsOpen((open) => !open)}
                aria-expanded={recentChatsOpen}
                className={`flex w-full items-center justify-between gap-2 rounded-xl border ${t.border} px-3 py-2.5 text-left ${t.input} ${t.cardHover} transition-colors`}
              >
                <span className={`text-sm font-semibold ${t.text}`}><T>Recent chats</T></span>
                <span className={`${t.textMuted} shrink-0 transition-transform duration-200 ${recentChatsOpen ? 'rotate-180' : ''}`}>
                  {Icons.chevronDown}
                </span>
              </button>
            </div>

            <div className="relative flex min-h-0 w-full min-w-0 flex-1 flex-col">
              {sidebarPrimaryActions.length > 0 && (
                <div className="relative z-0 shrink-0 [&>div:last-child>button]:border-b-0">
                  <div className="px-2 py-1 md:px-4 md:py-2 flex-shrink-0">
                    <p className={`text-xs font-semibold ${t.textMuted} uppercase tracking-wider`}><T>Shortcuts</T></p>
                  </div>
                  {sidebarPrimaryActions.map((action) => (
                    <div key={action.key}>
                      <SidebarActionListItem
                        icon={action.icon}
                        label={action.label}
                        description={action.description}
                        onClick={() => handleSidebarQuickActionClick(action)}
                      />
                    </div>
                  ))}
                </div>
              )}
              {recentChatsOpen && (
                <div
                  className={`absolute inset-0 z-20 flex flex-col rounded-none ${t.sidebar}`}
                >
                  <div className="shrink-0 border-b border-slate-200/80 px-3 py-2 md:px-4 md:py-3">
                    <div className="relative">
                      <input
                        type="text"
                        placeholder={placeholders.search}
                        value={sidebarSearch}
                        onChange={(e) => setSidebarSearch(e.target.value)}
                        className={`w-full rounded-xl border ${t.border} px-4 py-2.5 pl-10 text-sm ${t.input} ${t.text} transition-all focus:outline-none focus:ring-2 focus:ring-blue-500/20`}
                      />
                      <span className={`pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 ${t.textMuted}`}>{Icons.search}</span>
                    </div>
                  </div>
                  <div className="flex min-h-0 flex-1 flex-col overflow-y-auto scrollbar-thin">
                    {conversations.length === 0 ? (
                      <p className={`px-3 py-3 text-center text-xs ${t.textMuted} md:px-4`}><T>No conversations yet</T></p>
                    ) : (
                      <LayoutGroup>
                        {conversations.map((conv) => (
                          <ConversationItem
                            key={conv.id}
                            conversation={{
                              ...conv,
                              title: <T>{conv.title}</T>,
                              preview: <T>{conv.preview}</T>,
                              initials: getBrandingInitials(chatbotConfig) || conv.initials
                            }}
                            isActive={activeConversationId === conv.id}
                            onClick={() => {
                              handleConversationSelect(conv.id);
                              setRecentChatsOpen(false);
                            }}
                          />
                        ))}
                      </LayoutGroup>
                    )}
                  </div>
                </div>
              )}
            </div>

            {sidebarSocialActions.length > 0 && (
              <div className="px-2 py-2 md:px-4 md:py-3 border-t border-slate-200/50">
                <div className="mb-1 md:mb-2">
                  <p className={`text-xs font-semibold ${t.textMuted} uppercase tracking-wider`}><T>Socials</T></p>
                </div>
                <div className="flex gap-1">
                  {sidebarSocialActions.map((action) => (
                    <div key={action.key} className="min-w-0 flex-1">
                      <button
                        type="button"
                        onClick={() => handleSidebarQuickActionClick(action)}
                        className={`flex w-full flex-col items-center gap-1 p-1.5 md:p-2 rounded-lg ${t.cardHover} transition-colors group min-w-0`}
                      >
                        <div className={`w-5 h-5 md:w-6 md:h-6 rounded-md ${t.accent} flex items-center justify-center group-hover:scale-105 transition-transform`}>
                          <span className="text-white flex items-center justify-center [&>svg]:w-4 [&>svg]:h-4">{action.icon}</span>
                        </div>
                        <p className={`text-xs font-medium ${t.text} text-center leading-tight`}>
                          <T>{action.label}</T>
                        </p>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Language selector - HIDDEN for OpenAI-only multilingual system */}
            <div className="language-section sidebar-language-selector block md:hidden px-2 py-2 md:px-4 md:py-4 border-t border-slate-100" style={{ display: 'none' }}>
              <p className="text-xs text-slate-400 mb-2"><T>Language</T></p>
              <div className="language-selector-sidebar">
                <button
                  ref={languageButtonRef}
                  className="flex items-center gap-2 w-full px-3 py-2 bg-slate-100 hover:bg-slate-200 rounded-xl text-sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    setHeaderLangDropdownOpen(false);
                    if (!langDropdownOpen && languageButtonRef.current) {
                      const rect = languageButtonRef.current.getBoundingClientRect();
                      setDropdownPosition({
                        top: rect.bottom + 4,
                        left: rect.left
                      });
                    }
                    setLangDropdownOpen(!langDropdownOpen);
                  }}
                >
                  <span className="text-slate-500">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
                    </svg>
                  </span>
                  <span className="font-medium text-[#02066F]">
                    {SUPPORTED_LANGUAGES.find(l => l.name === currentLanguage)?.native || currentLanguage}
                  </span>
                  <span className="text-slate-400 ml-auto">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                    </svg>
                  </span>
                </button>

                <AnimatePresence>
                  {langDropdownOpen && (
                    <motion.div
                      ref={langDropdownMotionRef}
                      key="lang-dropdown"
                      initial={{ opacity: 0, scale: 0.88, y: -8 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.88, y: -8 }}
                      transition={
                        uiSprings.prefersReduced
                          ? { duration: 0 }
                          : {
                              type: 'spring',
                              stiffness: 700,
                              damping: 28,
                              mass: 0.4,
                            }
                      }
                      className="lang-dropdown-panel mt-2 origin-top-left bg-white border border-slate-200 rounded-xl shadow-lg z-[9999] overflow-hidden"
                      style={{
                        transformOrigin: 'top left',
                        willChange: 'transform, opacity',
                      }}
                      onAnimationComplete={() => {
                        if (langDropdownMotionRef.current) {
                          langDropdownMotionRef.current.style.willChange = 'auto';
                        }
                      }}
                    >
                      {SUPPORTED_LANGUAGES.map((lang) => (
                        <button
                          key={lang.name}
                          className="w-full px-3 py-2 text-left hover:bg-slate-50 text-sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            changeLanguage(lang.name);
                            setLangDropdownOpen(false);
                          }}
                        >
                          {lang.native}
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            <div
              className={`px-2 py-3 md:px-4 md:py-4 border-t ${t.borderLight} pb-[calc(env(safe-area-inset-bottom)+0.5rem)] mt-auto flex-shrink-0`}
            >
              <div className="logout-dropdown-container relative">
                <div className="flex items-center gap-2 md:gap-3 px-2 py-2 md:px-3 md:py-3 rounded-xl transition-colors">
                  <div
                    className={`w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center ${isAuthenticated
                      ? 'bg-gradient-to-br from-emerald-500 to-teal-600 cursor-pointer hover:shadow-lg transition-all duration-200'
                      : 'bg-gradient-to-br from-slate-200 to-slate-300'
                      }`}
                    onClick={() => isAuthenticated && setLogoutDropdownOpen(!logoutDropdownOpen)}
                  >
                    <User className={`w-4 h-4 md:w-5 md:h-5 ${isAuthenticated ? 'text-white' : 'text-slate-600'}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs md:text-sm font-semibold ${t.text}`}>
                      {isAuthenticated ? (userInfo?.name || userInfo?.phone || <T>User</T>) : <T>User</T>}
                    </p>
                    <p className={`text-xs ${t.textMuted}`}>
                      {isAuthenticated ? (userInfo?.phone || <T>Authenticated</T>) : <T>Guest</T>}
                    </p>
                  </div>
                </div>

                {logoutDropdownOpen && isAuthenticated && (
                  <div className={`logout-dropdown-container absolute bottom-full left-0 mb-2 w-full ${t.card} border ${t.border} rounded-xl shadow-lg z-50`}>
                    <button
                      onClick={() => {
                        console.log('🔴 [LOGOUT] Logout button clicked');
                        console.log('🧹 [LOGOUT] Clearing chat messages');
                        setMessages([]);
                        setConversations([]);
                        setDebouncedSearch('');
                        setSidebarSearch('');
                        console.log('🚪 [LOGOUT] Calling logout function');
                        logout();
                        console.log('✅ [LOGOUT] Logout function completed, closing dropdown');
                        setLogoutDropdownOpen(false);
                      }}
                      className={`w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-red-50 hover:text-red-600 rounded-xl transition-colors`}
                    >
                      <LogOut className="w-4 h-4" />
                      <span className="text-sm font-medium"><T>Logout</T></span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
          </>
        );
        return typeof document !== 'undefined' && isOmniEmbedded
          ? createPortal(omniMobileDrawer, document.body)
          : omniMobileDrawer;
      })()}

      {/* Main — chat background photo only in the area below the header (header stays solid white) */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col main-content-mobile">
        {/* Header */}
        <motion.div
          className={`chat-header-mobile box-border flex min-h-[76.8px] w-full shrink-0 items-center border-b ${t.border} bg-white px-4 py-3 sm:px-6 md:px-8`}
          initial={uiSprings.prefersReduced ? false : { y: -40, opacity: 0 }}
          animate={shellHeaderControls}
          style={{ willChange: 'transform, opacity' }}
        >
          <div className="flex w-full items-center justify-between gap-2 sm:gap-4">
            <div className="flex min-w-0 shrink-0 items-center gap-4">
              {chatbotConfig?.header_logo_url ? (
                <a href={chatbotConfig.header_logo_link || '#'} target="_blank" rel="noopener noreferrer">
                  <img src={chatbotConfig.header_logo_url} alt="Header Logo" className="h-[3.5rem] max-w-[140px] object-contain" />
                </a>
              ) : (
                <img src={OmniAgentLogo} alt="OmniAgent" className="w-11 h-11 rounded-full object-cover" />
              )}
              <div>
                <h2 className={`font-semibold ${t.text}`}>
                  <T>{(chatbotConfig.header_enabled && chatbotConfig.header_text) ? chatbotConfig.header_text : (chatbotConfig.assistant_display_name || 'Troika Tech Services')}</T>
                </h2>
                <div className="hidden md:flex items-center gap-2">
                  <span className="inline-flex shrink-0 items-center justify-center p-2 -m-2">
                    {API_CONFIG.CHATBOT_ID ? (
                      <motion.span
                        className="h-2 w-2 shrink-0 rounded-full bg-[#2DA44E] will-change-[box-shadow]"
                        animate={
                          uiSprings.prefersReduced
                            ? { boxShadow: '0 0 0 0 rgba(45, 164, 78, 0)' }
                            : {
                                boxShadow: [
                                  '0 0 0 0 rgba(45, 164, 78, 0.45)',
                                  '0 0 0 7px rgba(45, 164, 78, 0)',
                                  '0 0 0 0 rgba(45, 164, 78, 0)',
                                ],
                              }
                        }
                        transition={{
                          duration: uiSprings.prefersReduced ? 0 : 2.4,
                          repeat: uiSprings.prefersReduced ? 0 : Infinity,
                          ease: 'easeInOut',
                        }}
                      />
                    ) : (
                      <span className="h-2 w-2 shrink-0 rounded-full bg-amber-500" />
                    )}
                  </span>
                  <span className={`text-xs ${t.textMuted}`}>
                    {API_CONFIG.CHATBOT_ID ? <T>Online</T> : <T>Demo Mode</T>}
                  </span>
                </div>
              </div>
            </div>

            {resolvedHeaderNavItems.length > 0 && (
              <LayoutGroup>
              <nav
                className="hidden min-w-0 flex-1 items-center justify-end gap-2 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] sm:gap-4 md:gap-6 [&::-webkit-scrollbar]:hidden pr-1 md:pr-2 md:flex"
                aria-label="Company"
              >
                {resolvedHeaderNavItems.map(({ label, prompt }, idx) => (
                  <button
                    key={`${label}-${idx}`}
                    type="button"
                    disabled={isStreaming || isAIProcessing}
                    onClick={() => handleHeaderNavKnowledge(prompt, label)}
                    onMouseEnter={() => setHeaderNavHoverKey(label)}
                    onMouseLeave={() => setHeaderNavHoverKey((k) => (k === label ? null : k))}
                    className={`nav-link-premium relative shrink-0 rounded-lg px-2 py-1.5 text-xs font-semibold transition-colors hover:bg-slate-100 disabled:pointer-events-none disabled:opacity-45 sm:text-sm ${t.text} opacity-90 hover:opacity-100`}
                  >
                    {headerNavActiveKey === label && (
                      <motion.span
                        layoutId="navUnderline"
                        className="pointer-events-none absolute bottom-0 left-1 right-1 h-0.5 rounded-full bg-[#02066F]"
                        transition={uiSprings.natural}
                        style={{ willChange: 'transform' }}
                      />
                    )}
                    {headerNavActiveKey !== label && headerNavHoverKey === label && (
                      <motion.span
                        className="pointer-events-none absolute bottom-0 left-1 right-1 h-0.5 rounded-full bg-indigo-400/55"
                        initial={{ opacity: 0, scaleX: 0.85 }}
                        animate={{ opacity: 1, scaleX: 1 }}
                        transition={uiSprings.snappy}
                        layout={false}
                      />
                    )}
                    <T>{label}</T>
                  </button>
                ))}
              </nav>
              </LayoutGroup>
            )}

            <div className="flex shrink-0 items-center gap-2">
              {/* Hamburger Menu Button - Mobile Only (right side) */}
              <button
                className="hamburger-btn mobile-only"
                onClick={() => setSidebarOpen(true)}
                aria-label="Open menu"
              >
                {Icons.menu}
              </button>
              {/* Language Selector - HIDDEN for OpenAI-only multilingual system */}
              <div className="relative header-language-selector hidden md:block" style={{ display: 'none' }}>
                <button
                  ref={languageButtonRef}
                  onClick={(e) => {
                    e.stopPropagation();
                    setLangDropdownOpen(false); // Close sidebar dropdown
                    if (!headerLangDropdownOpen && languageButtonRef.current) {
                      const rect = languageButtonRef.current.getBoundingClientRect();
                      setDropdownPosition({
                        top: rect.bottom + 4,
                        left: rect.right - 117 // Position from right edge of button
                      });
                    }
                    setHeaderLangDropdownOpen(!headerLangDropdownOpen);
                  }}
                  className={`flex items-center gap-2 px-3 py-2 ${t.buttonSecondary} rounded-xl text-sm ${t.text} transition-colors`}
                >
                  <span className={t.textSecondary}>{Icons.language}</span>
                  <span className="font-medium">
                    {SUPPORTED_LANGUAGES.find(l => l.name === currentLanguage)?.native || currentLanguage}
                  </span>
                  <span className={t.textMuted}>{Icons.chevronDown}</span>
                </button>
                {createPortal(
                  <AnimatePresence>
                    {headerLangDropdownOpen && (
                      <motion.div
                        ref={headerLangDropdownMotionRef}
                        key="header-lang-dropdown"
                        initial={{ opacity: 0, scale: 0.88, y: -8 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.88, y: -8 }}
                        transition={
                          uiSprings.prefersReduced
                            ? { duration: 0 }
                            : {
                                type: 'spring',
                                stiffness: 700,
                                damping: 28,
                                mass: 0.4,
                              }
                        }
                        className="language-dropdown-portal"
                        style={{
                          position: 'fixed',
                          top: dropdownPosition.top,
                          left: dropdownPosition.left,
                          width: '117px',
                          zIndex: 99999,
                          backgroundColor: 'white',
                          borderRadius: '12px',
                          boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
                          border: '1px solid #e5e7eb',
                          overflow: 'hidden',
                          transformOrigin: 'top right',
                          willChange: 'transform, opacity',
                        }}
                        onAnimationComplete={() => {
                          if (headerLangDropdownMotionRef.current) {
                            headerLangDropdownMotionRef.current.style.willChange = 'auto';
                          }
                        }}
                      >
                        {SUPPORTED_LANGUAGES.map((lang) => (
                          <button
                            key={lang.name}
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              changeLanguage(lang.name);
                              setHeaderLangDropdownOpen(false);
                            }}
                            className={`w-full text-left px-4 text-sm ${t.text} hover:bg-slate-50 transition-colors ${currentLanguage === lang.name ? 'bg-blue-50 text-blue-700' : ''
                              }`}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              width: '100%',
                              height: '44px',
                              padding: '0 16px',
                              border: 'none',
                              background: 'none',
                              textAlign: 'left',
                              cursor: 'pointer'
                            }}
                          >
                            {lang.native}
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>,
                  document.body
                )}
              </div>

              {/* WhatsApp Button - Hidden on Mobile */}
              {chatbotConfig.whatsapp_enabled && (
              <motion.button
                type="button"
                onClick={() => {
                  if (chatbotConfig.whatsapp_mode === 'premium_modal') {
                    setShowPremiumModal(true);
                    return;
                  }
                  const number = chatbotConfig.whatsapp_number?.replace(/\D/g, '');
                  if (number) window.open(`https://wa.me/${number}`, '_blank');
                }}
                className={`w-10 h-10 rounded-xl ${t.buttonSecondary} hidden md:flex items-center justify-center transition-colors hover:bg-green-100`}
                title="WhatsApp"
                whileHover={
                  uiSprings.prefersReduced ? undefined : { scale: 1.08, y: -2, boxShadow: '0 6px 16px rgba(37, 211, 102, 0.25)' }
                }
                whileTap={uiSprings.prefersReduced ? undefined : { scale: 0.96 }}
                transition={uiSprings.snappy}
              >
                <span className="text-green-600">{Icons.whatsapp}</span>
              </motion.button>
              )}

              {/* Call Button - Hidden on Mobile */}
              {chatbotConfig.call_enabled && (
              <motion.button
                type="button"
                onClick={() => {
                  if (chatbotConfig.call_mode === 'premium_modal') {
                    setShowPremiumModal(true);
                    return;
                  }
                  const number = chatbotConfig.call_number?.replace(/\D/g, '');
                  if (number) window.location.href = `tel:${number}`;
                }}
                className={`w-10 h-10 rounded-xl ${t.buttonSecondary} hidden md:flex items-center justify-center transition-colors hover:bg-blue-100`}
                title="Call"
                whileHover={
                  uiSprings.prefersReduced ? undefined : { scale: 1.08, y: -2, boxShadow: '0 6px 16px rgba(2, 6, 111, 0.2)' }
                }
                whileTap={uiSprings.prefersReduced ? undefined : { scale: 0.96 }}
                transition={uiSprings.snappy}
              >
                <span className="text-[#02066F]">{Icons.phone}</span>
              </motion.button>
              )}
            </div>
          </div>
        </motion.div>

        {/* Blurred BG + overlay: only below header (fills remaining column height) */}
        <motion.div
          className={`flex min-h-0 min-w-0 flex-1 flex-col ${hasChatBackground ? 'chat-bg-main-region relative overflow-hidden' : ''}`}
          initial={uiSprings.prefersReduced ? false : { opacity: 0, scale: 0.98 }}
          animate={shellMainControls}
          style={{ willChange: 'transform, opacity', position: 'relative' }}
          onClick={
            isEmptyWelcomeUIMain
              ? (e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  welcomeBgRippleRef.current?.({
                    x: e.clientX - rect.left,
                    y: e.clientY - rect.top,
                  });
                }
              : undefined
          }
        >
        {isEmptyWelcomeUIMain && <WelcomeBgCanvas onClickRef={welcomeBgRippleRef} />}
        {hasChatBackground && chatBodyBackgroundLayers && (
          <>
            {isEmptyWelcomeUIMain || !chatBgKenBurnsFinished ? (
              <motion.div
                aria-hidden
                className="pointer-events-none absolute inset-0"
                style={{
                  ...chatBodyBackgroundLayers.blurLayer,
                  transformOrigin: 'center center',
                }}
                initial={false}
                animate={{
                  scale: chatBgWelcomeZoomComplete ? CHAT_BG_WELCOME_ZOOM_IN_END_SCALE : 1,
                }}
                transition={{
                  duration: chatBgWelcomeZoomComplete ? CHAT_BG_ZOOM_IN_DURATION_SEC : 0,
                  ease: [0.22, 0.04, 0.16, 0.99],
                }}
                onAnimationComplete={() => {
                  if (chatBgWelcomeZoomComplete) setChatBgKenBurnsFinished(true);
                }}
              />
            ) : (
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0"
                style={{
                  ...chatBodyBackgroundLayers.blurLayer,
                  backgroundAttachment: 'fixed',
                  ...(chatBgWelcomeZoomComplete
                    ? {
                        transform: `scale(${CHAT_BG_WELCOME_ZOOM_IN_END_SCALE})`,
                        transformOrigin: 'center center',
                      }
                    : {}),
                }}
              />
            )}
            <div aria-hidden className="pointer-events-none absolute inset-0" style={chatBodyBackgroundLayers.overlayLayer} />
          </>
        )}
        <div className={hasChatBackground ? 'relative z-[2] flex min-h-0 min-w-0 flex-1 flex-col' : 'flex min-h-0 min-w-0 flex-1 flex-col'}>

        {/* Authentication Required Banner */}
        {/* ✅ FIX: STRICT CHECK FOR AUTH ENABLED */}
        {(() => {
          const shouldShow = chatbotConfig?.authentication_enabled === true && !isAuthenticated && messageCount >= MESSAGE_LIMIT && !showAuthForm;
          if (shouldShow) console.log('🔐 [AUTH] Showing auth required banner:', { authEnabled: chatbotConfig?.authentication_enabled, authenticated: isAuthenticated, count: messageCount, showForm: showAuthForm });
          return shouldShow;
        })() && (
            <div className="mx-8 mt-6 mb-4">
              <div className="bg-gradient-to-r from-red-50 to-orange-50 border border-red-200 rounded-xl p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                      <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-red-800">{placeholders.authRequired}</h3>
                      <p className="text-sm text-red-600">{placeholders.limitReached}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowAuthForm(true)}
                    className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors"
                  >
                    {placeholders.authenticate}
                  </button>
                </div>
              </div>
            </div>
          )}

        {/* Messages */}
        <div
          ref={messagesScrollRef}
          onScroll={() => {
            const panel = messagesScrollRef.current;
            if (!panel) return;
            const distanceFromBottom =
              panel.scrollHeight - panel.scrollTop - panel.clientHeight;
            setShowScrollToBottom(distanceFromBottom > 120);
            if (distanceFromBottom > 80) {
              userScrolledUpRef.current = true;
            } else {
              userScrolledUpRef.current = false;
            }
          }}
          className={`scrollbar-thin messages-container-mobile flex-1 min-h-0 ${messages.filter((msg) => msg.isUser).length === 0 &&
            chatSuggestions.length > 0 &&
            countWords(inputValue) >= 2
              ? 'overflow-visible'
              : 'overflow-y-auto'
            } ${messages.filter((msg) => msg.isUser).length === 0
            ? 'welcome-mode flex flex-col items-center justify-center px-0 py-0'
            : 'px-4 pb-4 pt-4 scroll-pt-2'
            } ${hasChatBackground ? 'chat-bg-active' : ''}`}
        >
          <div
            className={`message-bubble-mobile w-full ${messages.filter((msg) => msg.isUser).length === 0 ? 'max-w-[780px] mx-auto flex flex-col items-center justify-center' : 'max-w-3xl mx-auto flex min-h-full flex-col'
              }`}
          >
            {/* Show loading state when fetching conversation messages */}
            {messagesLoading ? (
              <motion.div
                key="conversation-skeleton"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="w-full max-w-3xl mx-auto p-4 space-y-2 py-8"
                style={{ willChange: 'opacity' }}
              >
                <SkeletonBubble width="60%" />
                <SkeletonBubble isUser width="45%" />
                <SkeletonBubble width="75%" />
                <SkeletonBubble isUser width="30%" />
                <SkeletonBubble width="50%" />
              </motion.div>
            ) : (
              <AnimatePresence mode="wait" initial={false}>
              {(messages.length === 0 || messages.filter(msg => msg.isUser).length === 0) ? (
              <motion.div
                key="welcome"
                className="welcome-screen-container welcome-screen-mobile welcome-center-stack"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.01, filter: 'blur(4px)' }}
                transition={{ ...uiSprings.gentle }}
                style={{ willChange: 'transform, opacity', position: 'relative' }}
              >
                {(() => {
                  const welcomeSpring = { type: 'spring', stiffness: 540, damping: 26, mass: 0.58 };
                  const welcomePopReady = welcomeAfterSidebarIntro && isConfigLoaded;
                  const toolbarAfterPlaceholderSec = 0.1;
                  const inputToolbarStaggerSec = 0.2;
                  const inputToolPop = {
                    initial: { opacity: 0, scale: 0.9, y: 12 },
                    animate: { opacity: 1, scale: 1, y: 0 },
                  };
                  const welcomeToolbarPopReady = welcomePopReady && welcomeAskPlaceholderVisible;
                  const inputToolTransition = (i) =>
                    welcomeToolbarPopReady
                      ? {
                          ...welcomeSpring,
                          delay: toolbarAfterPlaceholderSec + i * inputToolbarStaggerSec,
                        }
                      : { duration: 0 };
                  const headlineLine1DelaySec = MOUNT_ENTRANCE_MS.headline / 1000;
                  const headlineLine2DelaySec = MOUNT_ENTRANCE_MS.phrases / 1000;

                  return (
                <div className="welcome-center-stack-inner relative z-[1] flex w-full flex-col items-center justify-center">
                  {messages.length === 0 && (
                    <div className="w-full flex justify-center">
                      <PremiumTroikaHeadline
                        line1DelaySec={headlineLine1DelaySec}
                        line2DelaySec={headlineLine2DelaySec}
                        welcomeText={chatbotConfig.welcome_text}
                        welcomeTextEnabled={chatbotConfig.welcome_text_enabled === true}
                        brandingCompany={chatbotConfig.sidebar_branding?.branding_company}
                        brandingText={chatbotConfig.sidebar_branding?.branding_text}
                        rotatingWelcomeEnabled={chatbotConfig.input_placeholders_enabled === true}
                        rotatingWelcomePhrases={chatbotConfig.input_placeholders}
                        rotatingWelcomeIntervalSec={chatbotConfig.input_placeholder_speed}
                      />
                    </div>
                  )}

                  {/* Large Manus-style Input Box — mount timeline composer @ MOUNT_ENTRANCE_COMPOSER_MS */}
                  <motion.div
                    className="w-full max-w-full"
                    animate={{ scale: welcomeComposerFocused ? 1.01 : 1 }}
                    transition={uiSprings.snappy}
                    style={{ willChange: 'transform' }}
                  >
                  <motion.div
                    ref={inputBoxRef}
                    className={`manus-input-gradient-shell manus-input-box-mobile relative w-full max-w-full ${uiSprings.prefersReduced ? 'manus-input-gradient-shell--reduced' : ''}`}
                    initial={{ opacity: 0, y: 20, scale: 0.96 }}
                    animate={welcomeComposerControls}
                  >
                  <motion.div
                    layoutId="userBubbleCard"
                    className="manus-input-box-large relative w-full max-w-full"
                    initial={false}
                  >
                    <div className="manus-input-textarea-wrap">
                      <textarea
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (handleSuggestionKeyDown(e)) return;
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            if (inputValue.trim() && !isStreaming) {
                              handleSend();
                            }
                          }
                        }}
                        onFocus={() => setWelcomeComposerFocused(true)}
                        onBlur={() => setWelcomeComposerFocused(false)}
                        placeholder={
                          welcomeAskPlaceholderVisible ? computedPlaceholder : ''
                        }
                        className="manus-textarea-large manus-textarea-mobile"
                        disabled={isStreaming}
                        rows={2}
                        autoComplete="off"
                      />
                    </div>
                    <div className="manus-input-actions-bar">
                      <div className="flex min-w-0 flex-1 items-center gap-2">
                        <motion.div
                          className="shrink-0"
                          initial={inputToolPop.initial}
                          animate={
                            welcomeToolbarPopReady ? inputToolPop.animate : inputToolPop.initial
                          }
                          transition={inputToolTransition(0)}
                        >
                          <button
                            className={`w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center transition-colors hover:bg-slate-100 text-slate-500`}
                            onClick={() => fileInputRef.current?.click()}
                            type="button"
                            title="Attach file (PDF or Image)"
                          >
                            <motion.span
                              className="inline-flex [&>svg]:block"
                              whileHover={uiSprings.prefersReduced ? undefined : { rotate: -20 }}
                              transition={uiSprings.snappy}
                            >
                              {Icons.attach}
                            </motion.span>
                          </button>
                        </motion.div>

                        {selectedFile && (
                          <div className="flex items-center gap-2 px-3 py-1 bg-slate-100 rounded-lg border border-slate-200 animate-fadeIn max-w-[200px]">
                            {selectedFile.type === 'pdf' ? <FileText className="w-4 h-4 text-red-500" /> : <ImageIcon className="w-4 h-4 text-blue-500" />}
                            <span className="text-xs font-medium truncate text-slate-700">{selectedFile.fileName}</span>
                            <button
                              onClick={() => setSelectedFile(null)}
                              className="p-0.5 hover:bg-slate-200 rounded-full transition-colors"
                            >
                              <X className="w-3 h-3 text-slate-500" />
                            </button>
                          </div>
                        )}
                      </div>

                      <div className="flex shrink-0 items-center gap-2">
                        <motion.div
                          className="shrink-0"
                          initial={inputToolPop.initial}
                          animate={
                            welcomeToolbarPopReady ? inputToolPop.animate : inputToolPop.initial
                          }
                          transition={inputToolTransition(1)}
                        >
                          <motion.button
                            type="button"
                            className={`w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center transition-colors hover:bg-slate-100 text-slate-500`}
                            onClick={() => {/* Handle mic */ }}
                            whileHover={
                              uiSprings.prefersReduced
                                ? undefined
                                : { scale: 1.25, color: '#02066F' }
                            }
                            transition={uiSprings.snappy}
                          >
                            {Icons.mic}
                          </motion.button>
                        </motion.div>

                        <motion.div
                          className="shrink-0"
                          initial={inputToolPop.initial}
                          animate={
                            welcomeToolbarPopReady ? inputToolPop.animate : inputToolPop.initial
                          }
                          transition={inputToolTransition(2)}
                        >
                          <motion.button
                            type="button"
                            onClick={() => handleSend()}
                            disabled={
                              isStreaming ||
                              isAIProcessing ||
                              (!inputValue.trim() && !selectedFile) ||
                              (chatbotConfig?.authentication_enabled && !isAuthenticated && messageCount >= MESSAGE_LIMIT)
                            }
                            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all shadow-sm ${(inputValue.trim() || selectedFile) && !isStreaming
                              ? 'bg-[#02066F] text-white hover:bg-[#031880]'
                              : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                              } disabled:opacity-60 disabled:pointer-events-none`}
                            whileHover={{ scale: (inputValue.trim() || selectedFile) && !isStreaming ? 1.08 : 1 }}
                            transition={uiSprings.snappy}
                            style={{ willChange: 'transform' }}
                          >
                            <motion.span
                              key={sendAnimKey}
                              className="inline-flex"
                              initial={{ x: 0, y: 0, opacity: 1, rotate: 0 }}
                              animate={
                                justSent
                                  ? { x: 0, y: -6, opacity: 0, rotate: 45 }
                                  : { x: 0, y: 0, opacity: 1, rotate: 0 }
                              }
                              whileTap={
                                uiSprings.prefersReduced || justSent
                                  ? undefined
                                  : { scale: 0.8, rotate: 45 }
                              }
                              transition={{
                                duration: uiSprings.prefersReduced ? 0 : 0.22,
                                ease: 'easeOut',
                              }}
                              style={{ willChange: 'transform, opacity' }}
                            >
                              {Icons.send}
                            </motion.span>
                          </motion.button>
                        </motion.div>
                      </div>
                    </div>
                    {chatSuggestions.length > 0 && countWords(inputValue) >= 2 && (
                      <ul
                        className="absolute left-0 right-0 top-full z-[200] mt-2 max-h-48 overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 shadow-lg"
                        role="listbox"
                      >
                        {chatSuggestions.map((s, idx) => (
                          <li key={`${s}-${idx}`}>
                            <button
                              type="button"
                              role="option"
                              aria-selected={idx === activeSuggestionIndex}
                              className={`flex w-full items-start gap-2 px-3 py-2 text-left text-sm text-slate-800 hover:bg-slate-50 ${idx === activeSuggestionIndex ? 'bg-slate-100' : ''}`}
                              onMouseDown={(ev) => {
                                ev.preventDefault();
                                applySuggestion(s);
                              }}
                            >
                              <Search className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden />
                              <span className="min-w-0 flex-1">{s}</span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </motion.div>
                  </motion.div>
                  </motion.div>

                  {/* Quick Action Suggestions - ONLY on first welcome screen, NOT on new conversation */}
                  {showActions && !isStreaming && !activeConversationId && messages.length === 0 && (
                    <motion.div
                      className="quick-actions-section-welcome grid w-full max-w-full grid-cols-2 gap-3 quick-actions-mobile"
                      initial={{ opacity: 0, y: 20, scale: 0.96 }}
                      animate={welcomeQuickActionsControls}
                    >
                      <p className={`col-span-2 text-sm ${t.textSecondary} mb-3 font-medium`}>
                        <T>How may I assist you?</T>
                      </p>
                      {quickActions.map((action) => (
                        <div key={action.label} className="min-w-0">
                          <QuickAction
                            icon={action.icon}
                            label={action.label}
                            description={action.description}
                            onClick={() => handleSend(action.action)}
                            className="action-card-mobile"
                          />
                        </div>
                      ))}
                    </motion.div>
                  )}
                </div>
                  );
                })()}
              </motion.div>
            ) : (
              <motion.div
                key="chat"
                className="w-full max-w-3xl mx-auto flex min-h-full flex-col"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: uiSprings.prefersReduced ? 0 : 0.22, ease: 'easeOut' }}
                style={{ willChange: 'transform, opacity' }}
              >
                {/* Pin thread to bottom when few messages; spacer collapses when history fills the view */}
                <div className="w-full min-h-0 flex-1" aria-hidden="true" />
                <AnimatePresence initial={false}>
                  {messages.map((msg) => (
                    <Message
                      key={msg.id}
                      message={msg}
                      chatbotConfig={chatbotConfig}
                      isUser={msg.isUser}
                      isStreaming={false}
                      hasChatBackground={hasChatBackground}
                      flyInFromComposer={msg.isUser && msg.id === userBubbleFlyInId}
                      onFlyInComplete={clearUserBubbleFlyIn}
                      onCopy={() => handleCopyMessage(msg.id)}
                      onPrevResponse={() => handlePrevResponse(msg.id)}
                      onNextResponse={() => handleNextResponse(msg.id)}
                      messageFeedback={messageFeedback}
                      onLike={handleLike}
                      onDislike={handleDislike}
                    />
                  ))}
                </AnimatePresence>

                {/* Streaming response */}
                {isStreaming && streamingResponse && (
                  <Message
                    message={{ content: streamingResponse, time: 'Now' }}
                    isUser={false}
                    chatbotConfig={chatbotConfig}
                    isStreaming={true}
                    hasChatBackground={hasChatBackground}
                    messageFeedback={messageFeedback}
                    onLike={handleLike}
                    onDislike={handleDislike}
                  />
                )}

                {/* Loading indicator when streaming starts but no content yet */}
                <AnimatePresence mode="wait">
                  {isStreaming && !streamingResponse && (
                    <AIThinking key="ai-thinking-indicator" logoUrl={chatbotConfig?.assistant_logo_url} />
                  )}
                </AnimatePresence>

                <div ref={messagesEndRef} />
              </motion.div>
            )}
              </AnimatePresence>
            )}
          </div>
        </div>

        <AnimatePresence>
          {showScrollToBottom && messages.filter((m) => m.isUser).length > 0 && (
            <motion.button
              key="scroll-bottom-btn"
              type="button"
              aria-label="Scroll to latest messages"
              initial={{ opacity: 0, scale: 0.5, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.5, y: 10 }}
              transition={uiSprings.snappy}
              className="fixed bottom-24 right-4 z-30 flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-lg shadow-md text-[#02066F] md:bottom-28"
              style={{ willChange: 'transform, opacity' }}
              onClick={() => {
                const panel = messagesScrollRef.current;
                if (panel) {
                  panel.scrollTop = panel.scrollHeight;
                  setShowScrollToBottom(false);
                  userScrolledUpRef.current = false;
                }
              }}
            >
              ↓
            </motion.button>
          )}
        </AnimatePresence>

        {/* Auth Error Banner */}
        {/* ✅ FIX: STRICT CHECK FOR AUTH ENABLED */}
        {(() => {
          const shouldShow = chatbotConfig?.authentication_enabled === true && authErrorBanner;
          if (shouldShow) console.log('🔐 [AUTH] Showing auth error banner:', { authEnabled: chatbotConfig?.authentication_enabled, bannerState: authErrorBanner });
          return shouldShow;
        })() && (
            <div className="bg-amber-50 border-t border-amber-200 px-8 py-3">
              <div className="max-w-3xl mx-auto">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-full bg-amber-100 flex items-center justify-center">
                      <svg className="w-3 h-3 text-amber-600" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <span className="text-sm text-amber-800 font-medium">
                      Free preview ended. <button
                        onClick={() => {
                          setShowAuthForm(true);
                          setAuthErrorBanner(false);
                        }}
                        className="text-amber-900 underline hover:text-amber-700 font-semibold"
                      >
                        Authenticate to continue
                      </button>
                    </span>
                  </div>
                  <button
                    onClick={() => setAuthErrorBanner(false)}
                    className="text-amber-600 hover:text-amber-800 p-1"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          )}

        {/* Input - Hide when showing large input box (no user messages) */}
        {messages.filter(msg => msg.isUser).length > 0 && (
          <div
            className={`shrink-0 border-t ${t.border} px-8 py-5 chat-input-container-mobile pb-[env(safe-area-inset-bottom)] ${
              hasChatBackground ? 'bg-transparent backdrop-blur-md' : 'bg-white/80 backdrop-blur-xl'
            }`}
          >
            <div className="max-w-3xl mx-auto">
              {selectedFile && (
                <div className="flex items-center gap-2 p-2 bg-slate-50 border border-slate-200 rounded-xl mb-3 animate-fadeIn max-w-fit shadow-sm">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${selectedFile.type === 'pdf' ? 'bg-red-50 text-red-500' : 'bg-blue-50 text-blue-500'}`}>
                    {selectedFile.type === 'pdf' ? <FileText className="w-4 h-4" /> : <ImageIcon className="w-4 h-4" />}
                  </div>
                  <div className="flex flex-col min-w-0 pr-2">
                    <span className="text-xs font-semibold text-slate-700 truncate max-w-[150px]">{selectedFile.fileName}</span>
                    <span className="text-[10px] text-slate-500">{selectedFile.fileSize}</span>
                  </div>
                  <button
                    onClick={() => setSelectedFile(null)}
                    className="p-1.5 hover:bg-slate-200 rounded-lg transition-colors text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}
              <motion.div
                className={`chat-input-shell flex items-center gap-3 p-2 ${t.card} rounded-2xl border ${t.border} shadow-sm chat-input-mobile ${chatInputFocused ? 'input-focused' : ''}`}
                transition={{ duration: uiSprings.prefersReduced ? 0 : 0.2, ease: 'easeOut' }}
                style={{ willChange: 'transform, opacity' }}
              >
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className={`w-9 h-9 rounded-xl ${t.buttonSecondary} flex items-center justify-center transition-colors input-actions-mobile`}
                  title="Attach file"
                >
                  <motion.span
                    className="inline-flex [&>svg]:block"
                    whileHover={uiSprings.prefersReduced ? undefined : { rotate: -20 }}
                    transition={uiSprings.snappy}
                  >
                    {Icons.attach}
                  </motion.span>
                </button>

                <div className="flex-1 relative">
                  <input
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onFocus={() => setChatInputFocused(true)}
                    onBlur={() => setChatInputFocused(false)}
                    onKeyDown={(e) => {
                      if (handleSuggestionKeyDown(e)) return;
                      if (e.key === 'Enter' && !isStreaming) {
                        e.preventDefault();
                        handleSend();
                      }
                    }}
                    placeholder={computedPlaceholder}
                    className={`w-full px-2 py-3 bg-transparent ${t.text} placeholder-slate-400 focus:outline-none text-[15px] pr-16`}
                    disabled={isStreaming || (chatbotConfig?.authentication_enabled && !isAuthenticated && messageCount >= MESSAGE_LIMIT)}
                    autoComplete="off"
                  />
                  {chatSuggestions.length > 0 && countWords(inputValue) >= 2 && (
                    <ul
                      className="absolute left-0 right-0 bottom-full z-[60] mb-1 max-h-48 overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 shadow-lg"
                      role="listbox"
                    >
                      {chatSuggestions.map((s, idx) => (
                        <li key={`${s}-${idx}`}>
                          <button
                            type="button"
                            role="option"
                            aria-selected={idx === activeSuggestionIndex}
                            className={`flex w-full items-start gap-2 px-3 py-2 text-left text-sm text-slate-800 hover:bg-slate-50 ${idx === activeSuggestionIndex ? 'bg-slate-100' : ''}`}
                            onMouseDown={(ev) => {
                              ev.preventDefault();
                              applySuggestion(s);
                            }}
                          >
                            <Search className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden />
                            <span className="min-w-0 flex-1">{s}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}

                  {/* Message Counter */}
                  {chatbotConfig?.authentication_enabled && !isAuthenticated && (
                    <div className={`absolute right-2 top-1/2 -translate-y-1/2 text-xs font-medium px-2 py-1 rounded-full ${messageCount >= MESSAGE_LIMIT
                      ? 'bg-red-100 text-red-600'
                      : 'bg-blue-100 text-blue-600'
                      }`}>
                      {messageCount}/{MESSAGE_LIMIT}
                    </div>
                  )}
                </div>

                <motion.button
                  type="button"
                  className={`w-9 h-9 rounded-xl ${t.buttonSecondary} flex items-center justify-center transition-colors input-actions-mobile`}
                  whileHover={
                    uiSprings.prefersReduced ? undefined : { scale: 1.25, color: '#02066F' }
                  }
                  transition={uiSprings.snappy}
                >
                  {Icons.mic}
                </motion.button>

                {isStreaming ? (
                  <button
                    onClick={stopStreaming}
                    className={`w-10 h-10 shrink-0 rounded-xl flex items-center justify-center transition-all text-white input-actions-mobile ${t.button}`}
                  >
                    {Icons.stop}
                  </button>
                ) : (
                  <motion.button
                    type="button"
                    onClick={() => handleSend()}
                    disabled={
                      isStreaming ||
                      isAIProcessing ||
                      (!inputValue.trim() && !selectedFile) ||
                      (chatbotConfig?.authentication_enabled && !isAuthenticated && messageCount >= MESSAGE_LIMIT)
                    }
                    className={`w-10 h-10 shrink-0 rounded-xl flex items-center justify-center transition-all input-actions-mobile disabled:opacity-60 disabled:pointer-events-none ${(inputValue.trim() || selectedFile) && (!chatbotConfig?.authentication_enabled || isAuthenticated || messageCount < MESSAGE_LIMIT)
                      ? 'bg-[#02066F] text-white hover:bg-[#031880] shadow-sm'
                      : 'bg-slate-100 text-slate-400'
                      }`}
                    whileHover={{
                      scale:
                        (inputValue.trim() || selectedFile) &&
                        (!chatbotConfig?.authentication_enabled || isAuthenticated || messageCount < MESSAGE_LIMIT)
                          ? 1.08
                          : 1,
                    }}
                    transition={uiSprings.snappy}
                    style={{ willChange: 'transform' }}
                  >
                    <motion.span
                      key={sendAnimKey}
                      className="inline-flex"
                      initial={{ x: 0, y: 0, opacity: 1, rotate: 0 }}
                      animate={
                        justSent
                          ? { x: 0, y: -6, opacity: 0, rotate: 45 }
                          : { x: 0, y: 0, opacity: 1, rotate: 0 }
                      }
                      whileTap={
                        uiSprings.prefersReduced || justSent
                          ? undefined
                          : { scale: 0.8, rotate: 45 }
                      }
                      transition={{
                        duration: uiSprings.prefersReduced ? 0 : 0.22,
                        ease: 'easeOut',
                      }}
                      style={{ willChange: 'transform, opacity' }}
                    >
                      {Icons.send}
                    </motion.span>
                  </motion.button>
                )}
              </motion.div>

              <div
                className={`flex items-center justify-center gap-6 md:mt-4 text-xs ${
                  hasChatBackground ? 'text-slate-700 [text-shadow:0_1px_2px_rgba(255,255,255,0.85)]' : t.textMuted
                }`}
              >
                <span className="hidden md:flex items-center gap-1.5">
                  {Icons.shield}
                  <T>Enterprise-grade Security</T>
                </span>
                <span className="hidden md:inline"><T>Troika Tech v3.0</T></span>
                {chatbotConfig?.authentication_enabled && !isAuthenticated && messageCount < MESSAGE_LIMIT && (
                  <span className="text-blue-600">
                    {MESSAGE_LIMIT - messageCount} <T>messages remaining</T>
                  </span>
                )}
              </div>
            </div>
          </div>
        )}
        </div>
        </motion.div>
      </div>

      {/* Authentication Modal */}
      {showAuthForm && createPortal(
        <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center z-[9999] p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-gray-200 animate-in fade-in-0 zoom-in-95 duration-200">
            {/* Header */}
            <div className="px-8 pt-8 pb-6 border-b border-gray-100">
              <div className="flex items-center justify-center mb-4">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 text-center">
                {authStep === 'name' ? <T>Tell us your name</T> :
                  authStep === 'phone' ? <T>Verify your phone number</T> :
                    <T>Enter verification code</T>}
              </h2>
              <p className="text-gray-600 text-center mt-2">
                {authStep === 'name'
                  ? <T>Let's get started! Please enter your name</T>
                  : authStep === 'phone'
                    ? <T>{`You've reached the ${MESSAGE_LIMIT} message limit. Verify your phone to continue.`}</T>
                    : <T>We sent a 6-digit code to your phone number</T>
                }
              </p>
            </div>

            {/* Content */}
            <div className="px-8 py-6">
              <div className="space-y-6">
                {authStep === 'name' ? (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-3">
                      <T>Your name</T>
                    </label>
                    <input
                      type="text"
                      placeholder="Enter your full name"
                      value={authName}
                      onChange={(e) => setAuthName(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-center text-lg"
                      maxLength={50}
                      disabled={authLoading}
                    />
                    {authError && (
                      <p className="text-xs text-red-600 mt-2 text-center">
                        {authError}
                      </p>
                    )}
                  </div>
                ) : authStep === 'phone' ? (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-3">
                      <T>Phone number</T>
                    </label>
                    <input
                      type="tel"
                      placeholder={placeholders.phone}
                      value={authPhone}
                      onChange={(e) => setAuthPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-center text-lg font-mono tracking-wider"
                      maxLength={10}
                      disabled={authLoading}
                    />
                    {authError && (
                      <p className="text-xs text-red-600 mt-2 text-center">
                        {authError}
                      </p>
                    )}
                  </div>
                ) : (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-3">
                      <T>Verification code</T>
                    </label>
                    <input
                      type="text"
                      placeholder={placeholders.otp}
                      value={authOtp}
                      onChange={(e) => setAuthOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-center text-lg font-mono tracking-wider"
                      maxLength={6}
                      disabled={authLoading}
                    />
                    {authError && (
                      <p className="text-xs text-red-600 mt-2 text-center">
                        {authError}
                      </p>
                    )}
                    {resendCooldown > 0 && (
                      <p className="text-xs text-gray-500 mt-2 text-center">
                        Resend OTP in {resendCooldown}s
                      </p>
                    )}
                  </div>
                )}

                <div className="flex gap-3">
                  <button
                    onClick={handleAuthClose}
                    className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors"
                    disabled={authLoading}
                  >
                    <T>Cancel</T>
                  </button>
                  <button
                    onClick={handleAuthSubmit}
                    className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={authLoading || (authStep === 'phone' && resendCooldown > 0)}
                  >
                    {authLoading ? (
                      <span className="flex items-center justify-center gap-2">
                        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        {authStep === 'name' ? 'Processing...' : authStep === 'phone' ? 'Sending...' : 'Verifying...'}
                      </span>
                    ) : (
                      authStep === 'name' ? <T>Continue</T> : authStep === 'phone' ? <T>Send code</T> : <T>Verify</T>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Proposal Modal */}
      {showProposalModal && proposalConfig?.templates && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-md w-full mx-4 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-semibold text-gray-800">Select Proposal Template</h3>
              <button
                onClick={() => setShowProposalModal(false)}
                className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors"
              >
                <X className="w-4 h-4 text-gray-600" />
              </button>
            </div>

            <div className="space-y-3">
              {proposalConfig.templates.map((template) => (
                <button
                  key={template.id}
                  onClick={() => {
                    handleSidebarProposalSend(template.id);
                  }}
                  className="w-full p-4 text-left border-2 border-slate-200 rounded-xl hover:border-green-500 hover:bg-green-50 transition-all"
                >
                  <div className="font-semibold text-gray-800">{template.display_name}</div>
                  {template.description && (
                    <div className="text-sm text-gray-500 mt-1">{template.description}</div>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Premium Feature Modal */}
      {
        showPremiumModal && createPortal(
          <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center z-[9999] p-4">
            <div className="bg-white rounded-2xl max-w-sm w-full shadow-2xl border border-gray-100 animate-in fade-in-0 zoom-in-95 duration-200 relative p-8 text-center">
              {/* Close Button */}
              <button
                onClick={() => setShowPremiumModal(false)}
                className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-full hover:bg-gray-100"
              >
                <X className="w-5 h-5" />
              </button>

              {/* Icon */}
              <div className="w-16 h-16 bg-gradient-to-br from-fuchsia-500 to-orange-400 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg">
                <span className="text-white transform scale-125">
                  {Icons.star}
                </span>
              </div>

              {/* Content */}
              <h3 className="text-xl font-bold text-fuchsia-600 mb-3">Premium Feature</h3>
              <p className="text-gray-600 text-sm leading-relaxed mb-2">
                You can access this feature with a paid subscription.
              </p>
            </div>
          </div>,
          document.body
        )
      }

      {/* Calendly Popup Modal */}
      {showCalendlyModal && calendlyConfig?.url && createPortal(
        <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center z-[9999] p-4">
          <div className="bg-white rounded-2xl w-full max-w-4xl h-[80vh] shadow-2xl border border-gray-100 flex flex-col animate-in fade-in-0 zoom-in-95 duration-200">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="text-lg font-semibold text-gray-800">
                {calendlyConfig.display_text || 'Schedule Meeting'}
              </h3>
              <button
                onClick={() => setShowCalendlyModal(false)}
                className="p-2 bg-gray-100 hover:bg-gray-200 rounded-full transition-colors"
              >
                <X className="w-5 h-5 text-gray-600" />
              </button>
            </div>

            {/* Iframe Content */}
            <div className="flex-1 w-full relative bg-gray-50 rounded-b-2xl overflow-hidden">
              {calendlyLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-50 z-10">
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                    <span className="text-gray-500 text-sm font-medium">Loading Scheduler...</span>
                  </div>
                </div>
              )}
              <iframe
                src={calendlyConfig.url}
                title="Calendly Scheduler"
                className="w-full h-full border-0"
                allow="camera; microphone; autoplay; fullscreen"
                onLoad={() => setCalendlyLoading(false)}
              />
            </div>
          </div>
        </div>,
        document.body
      )}

      {showSkater && !sidebarOpen && (isEmptyWelcomeUIMain || skaterFall) && (
        <RobotGirlWidget
          roamPlacement="bottomRight"
          avoidRef={inputBoxRef}
          triggerFall={skaterFall}
          onFallComplete={handleSkaterFallComplete}
          messages={chatbotConfig?.skater_girl?.messages}
        />
      )}

    </div>
  );
}
