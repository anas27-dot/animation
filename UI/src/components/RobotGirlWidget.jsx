import { useEffect, useLayoutEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useReducedMotion } from 'framer-motion';
import Lottie from 'lottie-react';
import skaterGirlJson from '../assets/skater-girl.json';
import { stripForEdgeTts, fetchFairyTtsBlob } from '../services/fairyTtsService.js';

const FAIRY_EDGE_TTS =
  typeof import.meta !== 'undefined' && import.meta.env?.VITE_FAIRY_EDGE_TTS === 'false'
    ? false
    : true;

/** Fallback lip-sync when Edge TTS is off. */
const MOUTH_OPEN_DELAY_MS = 160;
/** First prompt after load. */
const CAROUSEL_INTRO_MS = 1000;
/** Each line stays up long enough for Edge TTS + listen (from arm time). */
const CAROUSEL_BUBBLE_HOLD_MS = 7000;
/** Quiet flying between lines. */
const CAROUSEL_GAP_MS = 18000;
/** New flight target while moving (simple wander). */
const CAROUSEL_NEW_TARGET_MS = 9000;

/** Edge neural voice for fairy (overridable with VITE_FAIRY_TTS_VOICE). Backend: POST /api/tts/edge → audio/mpeg blob. */
const FAIRY_EDGE_VOICE =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_FAIRY_TTS_VOICE) ||
  'en-IN-NeerjaNeural';

const DEFAULT_MESSAGES = [
  "Let's talk business 🤝",
  "I've got answers 💡",
  '24×7 at your service ⚡',
  'Go on, test me! 😏',
  'What can I solve? ✅',
  'Psst... ask me! 🧠',
];

const SPRITE_DISPLAY_W = 130;
const SPRITE_DISPLAY_H = 130;
/** Bubble row above the Lottie — keeps avoid/roam math conservative. */
const BUBBLE_OVERHEAD_PX = 42;
const ROAM_EDGE_PAD_PX = 12;
const AVOID_EXTRA_PAD_PX = 10;

/** Roam inside a band at the bottom-right of the viewport (skate "stage"). */
function getBottomRightRoamRect() {
  if (typeof window === 'undefined') {
    return { left: 520, right: 1200, top: 520, bottom: 760 };
  }
  const w = window.innerWidth;
  const h = window.innerHeight;
  const pad = ROAM_EDGE_PAD_PX;
  const zoneW = Math.min(340, Math.max(200, w * 0.4));
  const zoneH = Math.min(240, Math.max(150, h * 0.34));
  return {
    left: Math.max(pad, w - zoneW - pad),
    right: w - pad,
    top: Math.max(pad, h - zoneH - pad),
    bottom: h - pad,
  };
}

function getRoamRect(roamBoundsRef, roamPlacement) {
  if (typeof window === 'undefined') {
    return { left: 40, right: 800, top: 72, bottom: 620 };
  }
  if (roamPlacement === 'bottomRight') {
    return getBottomRightRoamRect();
  }
  if (!roamBoundsRef?.current) {
    const w = window.innerWidth;
    const h = window.innerHeight;
    return {
      left: ROAM_EDGE_PAD_PX,
      right: w - ROAM_EDGE_PAD_PX,
      top: 72,
      bottom: h - 24,
    };
  }
  const r = roamBoundsRef.current.getBoundingClientRect();
  return {
    left: r.left + ROAM_EDGE_PAD_PX,
    right: r.right - ROAM_EDGE_PAD_PX,
    top: r.top + ROAM_EDGE_PAD_PX,
    bottom: r.bottom - ROAM_EDGE_PAD_PX,
  };
}

function getAvoidRect(avoidRef) {
  if (!avoidRef?.current) return null;
  const r = avoidRef.current.getBoundingClientRect();
  const p = AVOID_EXTRA_PAD_PX;
  return { left: r.left - p, top: r.top - p, right: r.right + p, bottom: r.bottom + p };
}

function widgetHitBox(x, y) {
  return {
    left: x,
    top: y,
    right: x + SPRITE_DISPLAY_W,
    bottom: y + BUBBLE_OVERHEAD_PX + SPRITE_DISPLAY_H,
  };
}

function intersectsRect(a, b) {
  return !(a.right <= b.left || a.left >= b.right || a.bottom <= b.top || a.top >= b.bottom);
}

function clampToRoam(x, y, roam) {
  const minY = roam.top;
  const maxY = roam.bottom - BUBBLE_OVERHEAD_PX - SPRITE_DISPLAY_H;
  const minX = roam.left;
  const maxX = roam.right - SPRITE_DISPLAY_W;
  return {
    x: Math.max(minX, Math.min(maxX, x)),
    y: Math.max(minY, Math.min(maxY, y)),
  };
}

function sampleTarget(roam, avoid) {
  const minY = roam.top;
  const maxY = roam.bottom - BUBBLE_OVERHEAD_PX - SPRITE_DISPLAY_H;
  const minX = roam.left;
  const maxX = roam.right - SPRITE_DISPLAY_W;
  if (maxY < minY + 16 || maxX < minX + 16) {
    return { x: minX, y: Math.max(roam.top, minY) };
  }
  for (let i = 0; i < 40; i++) {
    const tx = minX + Math.random() * (maxX - minX);
    const ty = minY + Math.random() * (maxY - minY);
    if (!avoid || !intersectsRect(widgetHitBox(tx, ty), avoid)) {
      return { x: tx, y: ty };
    }
  }
  if (avoid) {
    const aboveY = avoid.top - BUBBLE_OVERHEAD_PX - SPRITE_DISPLAY_H - 14;
    if (aboveY >= minY && aboveY <= maxY) {
      const tx = minX + Math.random() * (maxX - minX);
      return { x: tx, y: aboveY };
    }
    const leftX = avoid.left - SPRITE_DISPLAY_W - 14;
    if (leftX >= minX && leftX <= maxX) {
      const ty = minY + Math.random() * (maxY - minY);
      return { x: leftX, y: ty };
    }
    const rightX = avoid.right + 14;
    if (rightX <= maxX && rightX >= minX) {
      const ty = minY + Math.random() * (maxY - minY);
      return { x: rightX, y: ty };
    }
  }
  return { x: (minX + maxX) / 2, y: (minY + maxY) / 2 };
}

function resolvePosition(x, y, roam, avoid) {
  let p = clampToRoam(x, y, roam);
  if (!avoid) return p;
  let guard = 0;
  while (intersectsRect(widgetHitBox(p.x, p.y), avoid) && guard++ < 28) {
    const box = widgetHitBox(p.x, p.y);
    const cx = (box.left + box.right) / 2;
    const cy = (box.top + box.bottom) / 2;
    const acx = (avoid.left + avoid.right) / 2;
    const acy = (avoid.top + avoid.bottom) / 2;
    let dx = cx - acx;
    let dy = cy - acy;
    const len = Math.hypot(dx, dy) || 1;
    p = {
      x: p.x + (dx / len) * 14,
      y: p.y + (dy / len) * 14,
    };
    p = clampToRoam(p.x, p.y, roam);
  }
  if (intersectsRect(widgetHitBox(p.x, p.y), avoid)) {
    return sampleTarget(roam, avoid);
  }
  return p;
}

export default function RobotGirlWidget({
  roamBoundsRef = null,
  /** `'bottomRight'` = skate in a zone at the screen's bottom-right; `'welcome'` = use `roamBoundsRef` (or full fallback). */
  roamPlacement = 'bottomRight',
  avoidRef = null,
  onFallComplete,
  triggerFall = false,
  messages: messagesProp,
} = {}) {
  const MESSAGES = Array.isArray(messagesProp) && messagesProp.length > 0 ? messagesProp : DEFAULT_MESSAGES;
  const reduced = useReducedMotion();
  const widgetRootRef = useRef(null);
  const lottieRef = useRef(null);
  const fallingRef = useRef(false);
  const posRef = useRef({
    x: typeof window !== 'undefined' ? window.innerWidth / 2 - SPRITE_DISPLAY_W / 2 : 0,
    y: typeof window !== 'undefined' ? window.innerHeight * 0.62 : 0,
  });
  const velRef = useRef({ vx: 0, vy: 0 });
  const targetRef = useRef({ x: 300, y: 300 });
  const rafRef = useRef(null);
  const pausingRef = useRef(false);
  const facingLeftRef = useRef(false);
  const msgIdxRef = useRef(0);

  const [bubbleText, setBubbleText] = useState(MESSAGES[0]);
  const [showBubble, setShowBubble] = useState(false);
  const [mouthTalking, setMouthTalking] = useState(false);
  const [facingLeft, setFacingLeft] = useState(false);
  const [jumping, setJumping] = useState(false);
  const [falling, setFalling] = useState(false);
  const [squishing, setSquishing] = useState(false);
  const [particles, setParticles] = useState([]);
  const [impactParticles, setImpactParticles] = useState([]);
  const particleIdRef = useRef(0);
  const impactParticleIdRef = useRef(0);
  const lastParticleTimeRef = useRef(0);
  const fallSquishTimeoutRef = useRef(0);
  const ttsEpochRef = useRef(0);
  const ttsAudioRef = useRef(null);
  const ttsMouthRef = useRef(null);
  const ttsDebounceRef = useRef(null);
  const showBubbleRef = useRef(false);
  const mouthTalkingRef = useRef(false);
  const carouselCancelRef = useRef(false);

  const setMouthTalkingSync = useCallback((valOrFn) => {
    if (typeof valOrFn === 'function') {
      setMouthTalking((prev) => {
        const next = valOrFn(prev);
        mouthTalkingRef.current = next;
        return next;
      });
    } else {
      mouthTalkingRef.current = valOrFn;
      setMouthTalking(valOrFn);
    }
  }, []);

  const stopTtsPlayback = useCallback(() => {
    if (lottieRef.current) {
      lottieRef.current.setSpeed(1.0);
    }
    ttsEpochRef.current += 1;
    if (ttsAudioRef.current) {
      try {
        ttsAudioRef.current.pause();
      } catch {
        /* ignore */
      }
      try {
        ttsAudioRef.current.src = '';
      } catch {
        /* ignore */
      }
      ttsAudioRef.current = null;
    }
    if (ttsMouthRef.current != null) {
      clearInterval(ttsMouthRef.current);
      ttsMouthRef.current = null;
    }
    setMouthTalkingSync(false);
  }, [setMouthTalkingSync]);

  const playTTS = useCallback(async (rawText, bubbleIdx) => {
    if (!FAIRY_EDGE_TTS) return;
    const text = typeof rawText === 'string' ? stripForEdgeTts(rawText) : '';
    if (!text) return;

    if (ttsAudioRef.current && ttsAudioRef.current._ttsText === text) {
      return;
    }

    const epoch = ttsEpochRef.current + 1;
    ttsEpochRef.current = epoch;

    if (ttsAudioRef.current) {
      try {
        ttsAudioRef.current.pause();
      } catch {
        /* ignore */
      }
      try {
        ttsAudioRef.current.src = '';
      } catch {
        /* ignore */
      }
      ttsAudioRef.current = null;
    }

    if (ttsMouthRef.current != null) {
      clearInterval(ttsMouthRef.current);
      ttsMouthRef.current = null;
    }
    setMouthTalkingSync(true);
    ttsMouthRef.current = window.setInterval(() => {
      setMouthTalkingSync((prev) => !prev);
    }, 350);

    try {
      const blob = await fetchFairyTtsBlob(text, { voice: FAIRY_EDGE_VOICE });

      if (ttsEpochRef.current !== epoch) return;

      if (!blob || blob.size === 0) {
        if (ttsMouthRef.current != null) {
          clearInterval(ttsMouthRef.current);
          ttsMouthRef.current = null;
        }
        setMouthTalkingSync(false);
        return;
      }

      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio._ttsText = text;
      ttsAudioRef.current = audio;

      audio.onended = () => {
        if (ttsEpochRef.current !== epoch) return;
        if (lottieRef.current) {
          lottieRef.current.setSpeed(1.0);
        }
        if (ttsMouthRef.current != null) {
          clearInterval(ttsMouthRef.current);
          ttsMouthRef.current = null;
        }
        setMouthTalkingSync(false);
        URL.revokeObjectURL(url);
        ttsAudioRef.current = null;
        if (
          bubbleIdx !== undefined &&
          msgIdxRef.current === bubbleIdx
        ) {
          setShowBubble(false);
          pausingRef.current = false;
        }
      };

      audio.onerror = () => {
        if (lottieRef.current) {
          lottieRef.current.setSpeed(1.0);
        }
        if (ttsMouthRef.current != null) {
          clearInterval(ttsMouthRef.current);
          ttsMouthRef.current = null;
        }
        setMouthTalkingSync(false);
        URL.revokeObjectURL(url);
        ttsAudioRef.current = null;
        if (
          bubbleIdx !== undefined &&
          msgIdxRef.current === bubbleIdx
        ) {
          setShowBubble(false);
          pausingRef.current = false;
        }
      };

      if (ttsEpochRef.current !== epoch) {
        URL.revokeObjectURL(url);
        if (ttsAudioRef.current === audio) ttsAudioRef.current = null;
        return;
      }

      if (ttsMouthRef.current != null) {
        clearInterval(ttsMouthRef.current);
        ttsMouthRef.current = null;
      }
      setMouthTalkingSync(true);

      audio
        .play()
        .then(() => {
          if (lottieRef.current) {
            lottieRef.current.setSpeed(1.8);
          }
        })
        .catch((err) => {
          console.warn('[TTS] play blocked:', err?.message || err);
          if (lottieRef.current) {
            lottieRef.current.setSpeed(1.0);
          }
          if (ttsMouthRef.current != null) {
            clearInterval(ttsMouthRef.current);
            ttsMouthRef.current = null;
          }
          setMouthTalkingSync(false);
          URL.revokeObjectURL(url);
          ttsAudioRef.current = null;
          if (
            bubbleIdx !== undefined &&
            msgIdxRef.current === bubbleIdx
          ) {
            setShowBubble(false);
            pausingRef.current = false;
          }
        });
    } catch (err) {
      if (ttsEpochRef.current !== epoch) return;
      if (ttsMouthRef.current != null) {
        clearInterval(ttsMouthRef.current);
        ttsMouthRef.current = null;
      }
      setMouthTalkingSync(false);
      if (err?.name !== 'AbortError') {
        console.warn('[TTS]', err?.message || err);
      }
    }
  }, [setMouthTalkingSync]);

  const newTarget = useCallback(() => {
    const roam = getRoamRect(roamBoundsRef, roamPlacement);
    const avoid = getAvoidRect(avoidRef);
    targetRef.current = sampleTarget(roam, avoid);
  }, [roamBoundsRef, roamPlacement, avoidRef]);

  /**
   * One linear schedule: intro → hold → fly → gap → next line…
   * No random roam bubbles, no idle-RAF bubbles, no competing timers.
   */
  useEffect(() => {
    if (reduced) return;
    carouselCancelRef.current = false;
    newTarget();

    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

    const run = async () => {
      const waitBubbleHoldOrAudioEnd = async () => {
        await sleep(CAROUSEL_BUBBLE_HOLD_MS);
        if (carouselCancelRef.current) return;
        if (!ttsAudioRef.current) {
          setShowBubble(false);
          pausingRef.current = false;
          newTarget();
        } else {
          await new Promise((resolve) => {
            const check = setInterval(() => {
              if (!ttsAudioRef.current || carouselCancelRef.current) {
                clearInterval(check);
                resolve();
              }
            }, 200);
          });
          if (carouselCancelRef.current) return;
          pausingRef.current = false;
          newTarget();
        }
      };

      await sleep(CAROUSEL_INTRO_MS);
      if (carouselCancelRef.current) return;
      pausingRef.current = true;
      msgIdxRef.current = 0;
      const firstIdx = msgIdxRef.current;
      setBubbleText(MESSAGES[firstIdx]);
      setShowBubble(true);

      await waitBubbleHoldOrAudioEnd();
      if (carouselCancelRef.current) return;

      for (;;) {
        if (carouselCancelRef.current) return;
        await sleep(CAROUSEL_GAP_MS);
        if (carouselCancelRef.current) return;
        msgIdxRef.current = (msgIdxRef.current + 1) % MESSAGES.length;
        pausingRef.current = true;
        const currentIdx = msgIdxRef.current;
        setBubbleText(MESSAGES[currentIdx]);
        setShowBubble(true);

        await waitBubbleHoldOrAudioEnd();
        if (carouselCancelRef.current) return;
      }
    };

    run();

    const wander = window.setInterval(() => {
      if (carouselCancelRef.current || pausingRef.current) return;
      newTarget();
    }, CAROUSEL_NEW_TARGET_MS);

    return () => {
      carouselCancelRef.current = true;
      window.clearInterval(wander);
      stopTtsPlayback();
    };
  }, [reduced, newTarget, stopTtsPlayback]);

  useEffect(() => {
    if (!triggerFall) return;

    stopTtsPlayback();
    carouselCancelRef.current = true;
    setShowBubble(false);
    setParticles([]);
    fallingRef.current = true;
    setFalling(true);

    let vy = -2;
    let rot = 0;
    let opacity = 1;
    let yOffset = 0;
    const gravity = 1.8;
    let cancelled = false;

    const fallLoop = window.setInterval(() => {
      if (cancelled) return;
      vy += gravity;
      yOffset += vy;
      rot += 12;
      opacity -= 0.03;

      const el = widgetRootRef.current;
      if (el) {
        el.style.transform = `translate(${Math.round(posRef.current.x)}px, ${Math.round(posRef.current.y + yOffset)}px) rotate(${rot}deg)`;
        el.style.opacity = String(Math.max(0, opacity));
      }

      if (yOffset > window.innerHeight * 0.5 || opacity <= 0) {
        window.clearInterval(fallLoop);
        const impactX = posRef.current.x + 65;
        const impactY = posRef.current.y + yOffset + BUBBLE_OVERHEAD_PX + 118;
        const burst = Array.from({ length: 20 }, (_, i) => {
          const angle = (i / 20) * Math.PI * 2;
          const speed = 3 + Math.random() * 5;
          return {
            id: ++impactParticleIdRef.current,
            x: impactX,
            y: impactY,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed - 3,
            size: Math.random() * 6 + 3,
            color: ['#1a6ef5', '#0dd9f0', '#fbbf24', '#f97316', '#a855f7', '#fff'][
              Math.floor(Math.random() * 6)
            ],
            opacity: 1,
            life: 1.0,
            decay: 0.025 + Math.random() * 0.02,
            shapeRound: Math.random() > 0.5,
          };
        });
        setImpactParticles(burst);
        setSquishing(true);
        if (fallSquishTimeoutRef.current) {
          window.clearTimeout(fallSquishTimeoutRef.current);
        }
        fallSquishTimeoutRef.current = window.setTimeout(() => {
          fallSquishTimeoutRef.current = 0;
          setSquishing(false);
          fallingRef.current = false;
          setFalling(false);
          const root = widgetRootRef.current;
          if (root) {
            root.style.opacity = '1';
            root.style.transform = `translate(${Math.round(posRef.current.x)}px, ${Math.round(posRef.current.y)}px)`;
          }
          if (!cancelled) {
            onFallComplete?.();
          }
        }, 120);
      }
    }, 16);

    return () => {
      cancelled = true;
      window.clearInterval(fallLoop);
      if (fallSquishTimeoutRef.current) {
        window.clearTimeout(fallSquishTimeoutRef.current);
        fallSquishTimeoutRef.current = 0;
      }
      fallingRef.current = false;
      setFalling(false);
      setSquishing(false);
      const el = widgetRootRef.current;
      if (el) el.style.opacity = '1';
    };
  }, [triggerFall, stopTtsPlayback, onFallComplete]);

  useEffect(() => {
    showBubbleRef.current = showBubble;
  }, [showBubble]);

  /** No TTS: simple timed open mouth. */
  useEffect(() => {
    if (reduced || FAIRY_EDGE_TTS) return;
    if (!showBubble) {
      setMouthTalkingSync(false);
      return;
    }
    setMouthTalkingSync(false);
    const id = setTimeout(() => setMouthTalkingSync(true), MOUTH_OPEN_DELAY_MS);
    return () => clearTimeout(id);
  }, [reduced, showBubble, bubbleText, setMouthTalkingSync]);

  /** Sync Edge TTS with current bubble; debounced to avoid React double-fire / multi-request spam. */
  useEffect(() => {
    if (reduced || !FAIRY_EDGE_TTS) {
      if (ttsDebounceRef.current) {
        clearTimeout(ttsDebounceRef.current);
        ttsDebounceRef.current = null;
      }
      return;
    }

    if (ttsDebounceRef.current) {
      clearTimeout(ttsDebounceRef.current);
      ttsDebounceRef.current = null;
    }

    if (!showBubble || !bubbleText) {
      stopTtsPlayback();
      return;
    }

    const carouselBubbleIdx =
      MESSAGES[msgIdxRef.current] === bubbleText
        ? msgIdxRef.current
        : undefined;

    const textSnapshot = bubbleText;
    const idxSnapshot = carouselBubbleIdx;

    ttsDebounceRef.current = window.setTimeout(() => {
      ttsDebounceRef.current = null;
      playTTS(textSnapshot, idxSnapshot);
    }, 80);

    return () => {
      if (ttsDebounceRef.current) {
        clearTimeout(ttsDebounceRef.current);
        ttsDebounceRef.current = null;
      }
      ttsEpochRef.current += 1;
    };
  }, [reduced, showBubble, bubbleText, playTTS, stopTtsPlayback]);

  useEffect(() => {
    return () => {
      if (ttsDebounceRef.current) {
        clearTimeout(ttsDebounceRef.current);
        ttsDebounceRef.current = null;
      }
      if (ttsMouthRef.current != null) {
        clearInterval(ttsMouthRef.current);
        ttsMouthRef.current = null;
      }
      stopTtsPlayback();
    };
  }, [stopTtsPlayback]);

  useEffect(() => {
    if (reduced) return;
    let rafId = 0;
    const tick = () => {
      rafId = requestAnimationFrame(tick);
      setParticles((prev) => {
        if (prev.length === 0) return prev;
        return prev
          .map((p) => {
            const life = p.life - p.decay;
            return {
              ...p,
              x: p.x + p.vx,
              y: p.y + p.vy,
              vy: p.vy + 0.15,
              life,
              opacity: Math.max(0, life),
            };
          })
          .filter((p) => p.life > 0);
      });
      setImpactParticles((prev) => {
        if (prev.length === 0) return prev;
        return prev
          .map((p) => {
            const life = p.life - p.decay;
            return {
              ...p,
              x: p.x + p.vx,
              y: p.y + p.vy,
              vy: p.vy + 0.2,
              vx: p.vx * 0.95,
              life,
              opacity: Math.max(0, life),
            };
          })
          .filter((p) => p.life > 0);
      });
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [reduced]);

  useEffect(() => {
    if (reduced) return;

    const loop = () => {
      if (fallingRef.current) {
        rafRef.current = requestAnimationFrame(loop);
        return;
      }

      const roam = getRoamRect(roamBoundsRef, roamPlacement);
      const avoid = getAvoidRect(avoidRef);
      const { x, y } = posRef.current;
      let { vx, vy } = velRef.current;
      const { x: tx, y: ty } = targetRef.current;

      let nx = x;
      let ny = y;
      let nvx = vx;
      let nvy = vy;

      if (!pausingRef.current) {
        const dx = tx - x;
        const dy = ty - y;
        const dist = Math.hypot(dx, dy);
        if (dist > 12) {
          const dirX = dx / dist;
          const dirY = dy / dist;
          nvx = (vx + dirX * 1.55) * 0.84;
          nvy = (vy + dirY * 1.55) * 0.84;
          const MAX = 5.2;
          const spd = Math.hypot(nvx, nvy);
          if (spd > MAX) {
            nvx = (nvx / spd) * MAX;
            nvy = (nvy / spd) * MAX;
          }
          nx = x + nvx;
          ny = y + nvy;
          if (Math.abs(nvx) > 0.45) {
            const wantLeft = nvx < 0;
            if (wantLeft !== facingLeftRef.current) {
              facingLeftRef.current = wantLeft;
              setFacingLeft(wantLeft);
            }
          }
        } else {
          nvx *= 0.58;
          nvy *= 0.58;
        }
      } else {
        nvx *= 0.72;
        nvy *= 0.72;
      }

      const resolved = resolvePosition(nx, ny, roam, avoid);
      nx = resolved.x;
      ny = resolved.y;

      const spd = Math.hypot(nvx, nvy);
      if (lottieRef.current && !mouthTalkingRef.current) {
        if (spd > 2) {
          lottieRef.current.setSpeed(2.0);
        } else if (spd > 0.55) {
          lottieRef.current.setSpeed(1.2);
        } else {
          lottieRef.current.setSpeed(0.65);
        }
      }

      posRef.current = { x: nx, y: ny };
      velRef.current = { vx: nvx, vy: nvy };

      const moveSpd = Math.hypot(nvx, nvy);
      const now = performance.now();
      if (
        !pausingRef.current &&
        moveSpd > 0.5 &&
        now - lastParticleTimeRef.current > 80
      ) {
        lastParticleTimeRef.current = now;
        const id = ++particleIdRef.current;
        const goingRight = nvx >= 0;
        const trailDir = goingRight ? 1 : -1;
        const wheelX = nx + (trailDir === 1 ? 10 : 110);
        const wheelY = ny + BUBBLE_OVERHEAD_PX + 118;
        const particle = {
          id,
          x: wheelX,
          y: wheelY,
          vx: (Math.random() - 0.5) * 3 - trailDir * 1.5,
          vy: -(Math.random() * 3 + 1),
          size: Math.random() * 4 + 2,
          color: ['#1a6ef5', '#0dd9f0', '#a855f7', '#fbbf24', '#f97316'][
            Math.floor(Math.random() * 5)
          ],
          opacity: 1,
          life: 1.0,
          decay: 0.04 + Math.random() * 0.03,
        };
        setParticles((prev) => [...prev.slice(-19), particle]);
      }

      const el = widgetRootRef.current;
      if (el) {
        el.style.transform = `translate(${Math.round(nx)}px, ${Math.round(ny)}px)`;
      }

      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [reduced, roamBoundsRef, roamPlacement, avoidRef]);

  useLayoutEffect(() => {
    if (reduced || fallingRef.current) return;
    const roam = getRoamRect(roamBoundsRef, roamPlacement);
    const avoid = getAvoidRect(avoidRef);
    const t = sampleTarget(roam, avoid);
    posRef.current.x = t.x;
    posRef.current.y = t.y;
    velRef.current = { vx: 0, vy: 0 };
    const el = widgetRootRef.current;
    if (el) {
      el.style.transform = `translate(${Math.round(posRef.current.x)}px, ${Math.round(posRef.current.y)}px)`;
    }
  }, [reduced, roamBoundsRef, roamPlacement, avoidRef]);

  const handleClick = () => {
    stopTtsPlayback();
    setBubbleText('Hehe! 🤭');
    setShowBubble(true);
    playTTS('Hehe!');
    setJumping(true);
    setTimeout(() => setJumping(false), 520);
    setTimeout(() => {
      setBubbleText(MESSAGES[msgIdxRef.current]);
      if (!pausingRef.current) setShowBubble(false);
    }, 2000);
  };

  if (reduced) return null;

  const ui = (
    <>
      {particles.map((p) => (
        <div
          key={p.id}
          style={{
            position: 'fixed',
            left: p.x,
            top: p.y,
            width: p.size,
            height: p.size,
            borderRadius: '50%',
            background: p.color,
            opacity: p.opacity,
            pointerEvents: 'none',
            zIndex: 9998,
            boxShadow: `0 0 ${p.size * 2}px ${p.color}`,
            transform: 'translate(-50%, -50%)',
          }}
        />
      ))}
      {impactParticles.map((p) => (
        <div
          key={`imp-${p.id}`}
          style={{
            position: 'fixed',
            left: p.x,
            top: p.y,
            width: p.size,
            height: p.size,
            borderRadius: p.shapeRound ? '50%' : '2px',
            background: p.color,
            opacity: p.opacity,
            pointerEvents: 'none',
            zIndex: 9998,
            boxShadow: `0 0 ${p.size * 3}px ${p.color}`,
            transform: 'translate(-50%, -50%)',
          }}
        />
      ))}
      <div
        ref={widgetRootRef}
        style={{
          position: 'fixed',
          left: 0,
          top: 0,
          zIndex: 9999,
          pointerEvents: 'none',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          overflow: 'visible',
          willChange: 'transform',
        }}
      >
        <div
          style={{
            pointerEvents: falling ? 'none' : 'auto',
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            userSelect: 'none',
            transform: `translateY(${jumping ? -20 : 0}px)`,
            transition: jumping ? 'none' : 'transform 0.3s ease',
          }}
        >
          <div
            style={{
              background: '#02066F',
              color: '#fff',
              fontSize: '10.5px',
              fontWeight: 600,
              padding: '5px 12px',
              borderRadius: '12px',
              whiteSpace: 'nowrap',
              marginBottom: 0,
              position: 'relative',
              zIndex: 2,
              boxShadow: '0 4px 14px rgba(2,6,111,0.25)',
              opacity: showBubble ? 1 : 0,
              transform: showBubble ? 'scale(1) translateY(0)' : 'scale(0.85) translateY(4px)',
              transition: 'opacity 0.3s, transform 0.4s cubic-bezier(0.34,1.56,0.64,1)',
              pointerEvents: 'none',
            }}
          >
            {bubbleText}
            <span
              style={{
                position: 'absolute',
                bottom: -5,
                left: '50%',
                transform: 'translateX(-50%)',
                width: 0,
                height: 0,
                borderLeft: '5px solid transparent',
                borderRight: '5px solid transparent',
                borderTop: '6px solid #02066F',
                display: 'block',
              }}
            />
          </div>
          <div
            onClick={handleClick}
            style={{
              width: '130px',
              height: '130px',
              cursor: 'pointer',
              flexShrink: 0,
              overflow: 'visible',
              transform: squishing
                ? `scaleX(${facingLeft ? -1.4 : 1.4}) scaleY(0.6)`
                : `${facingLeft ? 'scaleX(-1)' : 'scaleX(1)'} scaleY(1)`,
              transformOrigin: 'center center',
              transition: squishing ? 'transform 0.08s ease-out' : 'transform 0.15s ease',
            }}
          >
            <Lottie
              lottieRef={lottieRef}
              animationData={skaterGirlJson}
              loop={true}
              autoplay={true}
              initialSegment={[91, 120]}
              onDOMLoaded={() => {
                lottieRef.current?.goToAndPlay(91, true);
              }}
              style={{
                width: '130px',
                height: '130px',
                display: 'block',
                filter: 'drop-shadow(0 6px 16px rgba(2,6,111,0.2))',
              }}
              rendererSettings={{
                preserveAspectRatio: 'xMidYMid meet',
                progressiveLoad: false,
                clearCanvas: true,
                hideOnTransparent: false,
              }}
            />
          </div>
        </div>
      </div>
    </>
  );

  return typeof document !== 'undefined' ? createPortal(ui, document.body) : null;
}
