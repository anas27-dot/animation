import { useEffect, useRef, useState, useCallback } from 'react';
import { useReducedMotion } from 'framer-motion';

const SEEN_KEY = 'troika_seen';
const BG = '#060810';
const BLUE = '#1a6ef5';
const CYAN = '#0dd9f0';
const TEAL = '#0af5b8';
/** Circumference for SVG ring r=44 */
const RING_C = 2 * Math.PI * 44;

function readSeen() {
  try {
    return sessionStorage.getItem(SEEN_KEY) === '1';
  } catch {
    return false;
  }
}

/** Canvas rising particles + timed bursts (vanilla Canvas API). */
function PreloaderCanvas() {
  const ref = useRef(null);
  const poolRef = useRef([]);
  const burstPoolRef = useRef([]);

  const spawnBurst = useCallback((count, speedMul) => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const cx = w * 0.5;
    const cy = h * 0.45;
    for (let i = 0; i < count; i++) {
      const a = (Math.PI * 2 * i) / count + Math.random() * 0.4;
      const sp = (2.5 + Math.random() * 4) * speedMul;
      burstPoolRef.current.push({
        x: cx,
        y: cy,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 1.2,
        r: 1.2 + Math.random() * 2.2,
        life: 1,
        hue: Math.random() > 0.5 ? 'c' : 't',
      });
    }
  }, []);

  useEffect(() => {
    const t1 = window.setTimeout(() => spawnBurst(80, 1), 1800);
    const t2 = window.setTimeout(() => spawnBurst(120, 1.25), 3680);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [spawnBurst]);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return undefined;
    const ctx = canvas.getContext('2d');
    let raf = 0;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(window.innerWidth * dpr);
      canvas.height = Math.floor(window.innerHeight * dpr);
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);

    const baseCount = 46;
    if (poolRef.current.length === 0) {
      for (let i = 0; i < baseCount; i++) {
        poolRef.current.push({
          x: Math.random(),
          y: Math.random(),
          vy: 0.15 + Math.random() * 0.55,
          r: 0.6 + Math.random() * 1.6,
          a: 0.25 + Math.random() * 0.6,
        });
      }
    }

    const tick = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = BG;
      ctx.fillRect(0, 0, w, h);

      for (const p of poolRef.current) {
        p.y -= p.vy * (16 / 1000) * 1.2;
        if (p.y < -0.05) {
          p.y = 1.05;
          p.x = Math.random();
        }
        ctx.beginPath();
        ctx.fillStyle =
          p.r > 1.2
            ? `rgba(13, 217, 240, ${p.a})`
            : `rgba(26, 110, 245, ${p.a * 0.85})`;
        ctx.arc(p.x * w, p.y * h, p.r, 0, Math.PI * 2);
        ctx.fill();
      }

      burstPoolRef.current = burstPoolRef.current.filter((b) => {
        b.x += b.vx * 0.9;
        b.y += b.vy * 0.9;
        b.vy += 0.04;
        b.life -= 0.008;
        if (b.life <= 0) return false;
        const col =
          b.hue === 'c'
            ? `rgba(13, 217, 240, ${b.life * 0.95})`
            : `rgba(10, 245, 184, ${b.life * 0.9})`;
        ctx.beginPath();
        ctx.fillStyle = col;
        ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
        ctx.fill();
        return true;
      });

      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <canvas
      ref={ref}
      className="pointer-events-none fixed inset-0 z-[1]"
      aria-hidden
    />
  );
}

const PROGRESS_LABELS = [
  'INITIALIZING',
  'LOADING AGENTS',
  'CALIBRATING AI',
  'SYNCING',
  'READY',
];

function clamp01(t) {
  return Math.max(0, Math.min(1, t));
}

function TroikaPreloader({ onComplete }) {
  const startRef = useRef(
    typeof performance !== 'undefined' ? performance.now() : 0
  );
  const [elapsed, setElapsed] = useState(0);
  const [done, setDone] = useState(false);
  useEffect(() => {
    if (done) return undefined;
    let raf = 0;
    const loop = (now) => {
      setElapsed(now - startRef.current);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [done]);

  const fadeOut = elapsed >= 4080;

  useEffect(() => {
    if (done) return;
    if (elapsed < 4880) return undefined;
    setDone(true);
    onComplete();
  }, [elapsed, done, onComplete]);

  const t = elapsed;
  const auroraOp = clamp01((t - 400) / 450);
  const nebulaOp = clamp01((t - 800) / 350);
  const scanOp = t >= 1000 ? 1 : 0;
  const scanY = t < 1000 ? -0.1 : clamp01((t - 1000) / 800);
  const shock1 = t >= 1800 && t < 2600 ? clamp01((t - 1800) / 500) : 0;
  const shock2 = t >= 3680 && t < 4500 ? clamp01((t - 3680) / 600) : 0;
  const logoVisible = t >= 2000;
  const logoSpring = logoVisible ? Math.min(1, (t - 2000) / 500) : 0;
  const logoScale = logoSpring < 1 ? 0.3 + (1.08 - 0.3) * logoSpring + Math.sin(logoSpring * Math.PI) * 0.06 : 1;
  const ringOffset = logoVisible
    ? Math.max(0, RING_C * (1 - Math.min(1, (t - 2000) / 650)))
    : RING_C;
  const bracketsOp = t >= 2200 ? Math.min(1, (t - 2200) / 400) : 0;
  const tagY = t >= 2400 ? Math.max(0, 1 - (t - 2400) / 350) : 1;
  const tagOp = t >= 2400 ? Math.min(1, (t - 2400) / 320) : 0;
  const omniT = t >= 2650 ? Math.min(1, (t - 2650) / 400) : 0;
  const omniScale = omniT < 1 ? 0.82 + 0.2 * (1 - (1 - omniT) ** 3) : 1;
  const omniOp = omniT;
  const progT = Math.max(0, t - 3100);
  const progFill = clamp01(progT / 900);
  const progLabelIdx = Math.min(
    PROGRESS_LABELS.length - 1,
    Math.floor(progFill * PROGRESS_LABELS.length)
  );
  const preloaderOp = fadeOut ? Math.max(0, 1 - (t - 4080) / 800) : 1;

  return (
    <div
      className="fixed inset-0 z-[99998] overflow-hidden"
      style={{
        background: BG,
        opacity: preloaderOp,
        pointerEvents: preloaderOp <= 0 ? 'none' : 'auto',
      }}
    >
      <PreloaderCanvas />

      <div
        className="pointer-events-none absolute inset-0 z-[2]"
        style={{
          opacity: auroraOp,
          background: `radial-gradient(ellipse 80% 55% at 50% 45%, ${BLUE}55 0%, transparent 62%), radial-gradient(ellipse 70% 60% at 50% 50%, ${CYAN}33 0%, transparent 58%)`,
        }}
      />

      <div
        className="pointer-events-none absolute inset-0 z-[3]"
        style={{
          opacity: nebulaOp * (0.55 + 0.15 * Math.sin(t / 420)),
          background: `radial-gradient(circle at 50% 48%, ${TEAL}66 0%, ${BLUE}22 28%, transparent 55%)`,
        }}
      />

      <div
        className="pointer-events-none absolute inset-0 z-[4]"
        style={{
          opacity: scanOp * 0.9,
          background: `linear-gradient(180deg, transparent ${Math.max(0, scanY * 100 - 18)}%, ${CYAN}88  ${scanY * 100}%, transparent ${Math.min(100, scanY * 100 + 16)}%)`,
        }}
      />

      {[0, 1].map((i) => {
        const s = i === 0 ? shock1 : shock2;
        if (s <= 0) return null;
        const scale = 0.4 + s * 2.8;
        return (
          <div
            key={`sw-${i}`}
            className="pointer-events-none absolute left-1/2 top-[44%] z-[5] h-[min(100vw,100vh)] w-[min(100vw,100vh)] rounded-full border-2"
            style={{
              borderColor: i === 0 ? `${CYAN}99` : `${TEAL}aa`,
              opacity: (1 - s) * 0.85,
              transform: `translate(-50%, -50%) scale(${scale})`,
            }}
          />
        );
      })}

      <div className="relative z-[10] flex min-h-full flex-col items-center justify-center px-6">
        <div
          className="relative flex flex-col items-center"
          style={{
            transform: logoVisible ? `scale(${logoScale})` : 'scale(0.3)',
            opacity: logoVisible ? 1 : 0,
            transition: 'none',
          }}
        >
          <svg width={100} height={100} viewBox="0 0 100 100" className="mb-0 block">
            <circle
              cx={50}
              cy={50}
              r={44}
              fill="none"
              stroke={`${CYAN}cc`}
              strokeWidth={2}
              strokeDasharray={RING_C}
              strokeDashoffset={ringOffset}
              strokeLinecap="round"
              transform="rotate(-90 50 50)"
            />
            <rect
              x={18}
              y={18}
              width={64}
              height={64}
              rx={14}
              fill="#0a1628"
            />
            <text
              x={50}
              y={58}
              textAnchor="middle"
              fill="#fff"
              className="text-[22px] font-bold"
              style={{ fontFamily: 'system-ui, sans-serif' }}
            >
              OA
            </text>
          </svg>
        </div>

        <div
          className="pointer-events-none fixed left-5 top-5 z-[12] h-10 w-10 border-l-2 border-t-2 border-cyan-400/50"
          style={{
            opacity: bracketsOp * 0.9,
            transform: `translate(${(1 - bracketsOp) * 8}px, ${(1 - bracketsOp) * 8}px)`,
          }}
        />
        <div
          className="pointer-events-none fixed right-5 top-10 h-10 w-10 border-r-2 border-t-2 border-cyan-400/50"
          style={{
            opacity: Math.max(0, bracketsOp - 0.1) * 0.9,
            transform: `translate(${-(1 - bracketsOp) * 8}px, ${(1 - bracketsOp) * 8}px)`,
          }}
        />
        <div
          className="pointer-events-none fixed bottom-10 left-8 h-10 w-10 border-b-2 border-l-2 border-cyan-400/50"
          style={{
            opacity: Math.max(0, bracketsOp - 0.22) * 0.9,
            transform: `translate(${(1 - bracketsOp) * 8}px, ${-(1 - bracketsOp) * 8}px)`,
          }}
        />
        <div
          className="pointer-events-none fixed bottom-6 right-6 h-10 w-10 border-b-2 border-r-2 border-cyan-400/50"
          style={{
            opacity: Math.max(0, bracketsOp - 0.34) * 0.9,
            transform: `translate(${-(1 - bracketsOp) * 8}px, ${-(1 - bracketsOp) * 8}px)`,
          }}
        />

        <p
          className="mt-6 text-center text-sm font-semibold tracking-wide text-cyan-200/90"
          style={{
            opacity: tagOp,
            transform: `translateY(${tagY * 16}px)`,
          }}
        >
          Troika Tech AI
        </p>
        <h1
          className="mt-1 text-center text-2xl font-bold tracking-tight text-white sm:text-3xl"
          style={{
            opacity: omniOp,
            transform: `scale(${omniScale})`,
          }}
        >
          OmniAgent
        </h1>

        <div className="mt-10 w-[min(340px,88vw)]">
          <div className="mb-2 flex justify-between text-[10px] font-semibold uppercase tracking-wider text-cyan-300/80">
            <span>{t >= 3100 ? PROGRESS_LABELS[progLabelIdx] : '\u00a0'}</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full"
              style={{
                width: `${t >= 3100 ? progFill * 100 : 0}%`,
                background: `linear-gradient(90deg, ${BLUE}, ${CYAN} 55%, ${TEAL})`,
                boxShadow: `0 0 12px ${CYAN}66`,
              }}
            />
          </div>
        </div>

      </div>
    </div>
  );
}

export default function PreloaderGate({ children }) {
  const reduced = useReducedMotion();
  const [showChildren, setShowChildren] = useState(false);

  useEffect(() => {
    if (!reduced || showChildren) return undefined;
    const id = window.setTimeout(() => {
      setShowChildren(true);
    }, 800);
    return () => window.clearTimeout(id);
  }, [reduced, showChildren]);

  const handlePreloaderComplete = useCallback(() => {
    setShowChildren(true);
  }, []);

  if (showChildren) {
    return children;
  }

  if (reduced) {
    return (
      <div
        className="fixed inset-0 z-[99998] flex flex-col items-center justify-center gap-4"
        style={{ background: BG }}
      >
        <div
          className="flex h-16 w-16 items-center justify-center rounded-2xl text-xl font-bold text-white"
          style={{ background: '#0a1628' }}
        >
          OA
        </div>
        <p className="text-sm font-medium text-white/80">Loading…</p>
      </div>
    );
  }

  return <TroikaPreloader onComplete={handlePreloaderComplete} />;
}
