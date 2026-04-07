import { useEffect, useRef } from 'react';

const HUES = [220, 250, 200];

function createSparkles(w, h) {
  return Array.from({ length: 40 }, () => ({
    x: Math.random() * w,
    y: Math.random() * h,
    size: 1 + Math.random() * 2,
    phase: Math.random() * Math.PI * 2,
    speed: 0.018 + Math.random() * 0.035,
  }));
}

function drawGrid(ctx, w, h) {
  ctx.strokeStyle = 'rgba(2,6,111,0.04)';
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  for (let x = 0; x <= w; x += 40) {
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
  }
  for (let y = 0; y <= h; y += 40) {
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
  }
  ctx.stroke();
}

function drawAurora(ctx, w, h, t) {
  /** A touch darker than before (lower L, slightly stronger peak) — same motion, richer read. */
  const sat = 76;
  const light = 50;
  const peakAlpha = 0.078;
  for (let i = 0; i < 3; i++) {
    const baseY = h * 0.35 + Math.sin(t * 0.5 + i * 1.2) * h * 0.1;
    const g = ctx.createLinearGradient(0, baseY - 80, 0, baseY + 80);
    g.addColorStop(0, `hsla(${HUES[i]}, ${sat}%, ${light}%, 0)`);
    g.addColorStop(0.5, `hsla(${HUES[i]}, ${sat}%, ${light}%, ${peakAlpha})`);
    g.addColorStop(1, `hsla(${HUES[i]}, ${sat}%, ${light}%, 0)`);
    ctx.beginPath();
    ctx.moveTo(0, baseY);
    for (let x = 0; x <= w; x += 16) {
      const y =
        baseY +
        Math.sin(x * 0.009 + t * 0.7 + i * 1.1) * 28 +
        Math.sin(x * 0.022 + t * 0.35) * 12;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(w, baseY + 120);
    ctx.lineTo(0, baseY + 120);
    ctx.closePath();
    ctx.fillStyle = g;
    ctx.fill();
  }
}

function drawCenterGlow(ctx, w, h, t, staticPulse) {
  const pulse =
    staticPulse !== undefined
      ? staticPulse
      : 0.5 + Math.sin(t * 1.4) * 0.18;
  const rg = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, 220);
  rg.addColorStop(0, `rgba(99, 102, 241, ${pulse * 0.09})`);
  rg.addColorStop(0.5, `rgba(26, 110, 245, ${pulse * 0.04})`);
  rg.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = rg;
  ctx.fillRect(0, 0, w, h);
}

function drawMouseGlow(ctx, w, h, mx, my) {
  if (mx < 0 || my < 0) return;
  const rg = ctx.createRadialGradient(mx, my, 0, mx, my, 130);
  rg.addColorStop(0, 'rgba(26, 110, 245, 0.09)');
  rg.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = rg;
  ctx.fillRect(0, 0, w, h);
}

function drawSparkles(ctx, w, h, sparkles) {
  for (const s of sparkles) {
    s.phase += s.speed;
    const alpha = (Math.sin(s.phase) * 0.5 + 0.5) * 0.45;
    if (s.phase > Math.PI * 4) {
      s.x = Math.random() * w;
      s.y = Math.random() * h;
      s.phase = Math.random() * Math.PI * 2;
    }
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = '#6366f1';
    ctx.shadowBlur = 5;
    ctx.shadowColor = '#6366f1';
    ctx.translate(s.x, s.y);
    for (let i = 0; i < 4; i++) {
      ctx.rotate(Math.PI / 2);
      ctx.fillRect(-s.size * 0.15, -s.size, s.size * 0.3, s.size * 2);
    }
    ctx.restore();
  }
}

function drawRipples(ctx, ripples) {
  for (let i = ripples.length - 1; i >= 0; i--) {
    const r = ripples[i];
    r.radius += 7;
    r.alpha -= 0.018;
    if (r.alpha <= 0) {
      ripples.splice(i, 1);
      continue;
    }
    ctx.beginPath();
    ctx.arc(r.x, r.y, r.radius, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(99,102,241,${r.alpha})`;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(r.x, r.y, r.radius * 0.65, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(6,182,212,${r.alpha * 0.7})`;
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}

/**
 * Fullscreen decorative canvas for the welcome screen only.
 * pointer-events: none — parent receives clicks; use onClickRef or rippleApiRef for ripples.
 */
export default function WelcomeBgCanvas({ onClickRef, rippleApiRef }) {
  const rippleApiRefResolved = onClickRef ?? rippleApiRef;
  const canvasRef = useRef(null);
  const mouseRef = useRef({ x: -999, y: -999 });
  const ripplesRef = useRef([]);
  const sparklesRef = useRef([]);
  const tRef = useRef(0);
  const wRef = useRef(0);
  const hRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const ctx = canvas.getContext('2d');
    const reduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const isTouch =
      typeof window !== 'undefined' && 'ontouchstart' in window;

    let raf = 0;

    const drawStatic = () => {
      const w = wRef.current;
      const h = hRef.current;
      if (w <= 0 || h <= 0) return;
      ctx.clearRect(0, 0, w, h);
      drawGrid(ctx, w, h);
      drawCenterGlow(ctx, w, h, 0, 0.5);
    };

    const resize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const W = parent.clientWidth;
      const H = parent.clientHeight;
      wRef.current = W;
      hRef.current = H;
      canvas.width = Math.floor(W * dpr);
      canvas.height = Math.floor(H * dpr);
      canvas.style.width = `${W}px`;
      canvas.style.height = `${H}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      sparklesRef.current = createSparkles(W, H);
      if (reduced) drawStatic();
    };

    resize();
    const parent = canvas.parentElement;
    const ro = parent ? new ResizeObserver(resize) : null;
    if (parent && ro) ro.observe(parent);
    window.addEventListener('resize', resize);

    const onMove = (e) => {
      if (isTouch || reduced) return;
      const rect = canvas.getBoundingClientRect();
      mouseRef.current = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
    };
    const onLeave = () => {
      mouseRef.current = { x: -999, y: -999 };
    };
    parent?.addEventListener('mousemove', onMove);
    parent?.addEventListener('mouseleave', onLeave);

    const triggerRipple = (pt) => {
      if (
        reduced ||
        !pt ||
        typeof pt.x !== 'number' ||
        typeof pt.y !== 'number'
      ) {
        return;
      }
      ripplesRef.current.push({ x: pt.x, y: pt.y, radius: 0, alpha: 0.85 });
    };
    if (rippleApiRefResolved) {
      rippleApiRefResolved.current = triggerRipple;
    }

    const loop = () => {
      const w = wRef.current;
      const h = hRef.current;
      if (w <= 0 || h <= 0) {
        raf = requestAnimationFrame(loop);
        return;
      }
      tRef.current += 0.016;
      const t = tRef.current;
      ctx.clearRect(0, 0, w, h);
      drawGrid(ctx, w, h);
      drawAurora(ctx, w, h, t);
      drawCenterGlow(ctx, w, h, t);
      if (!isTouch) {
        const { x, y } = mouseRef.current;
        drawMouseGlow(ctx, w, h, x, y);
      }
      drawSparkles(ctx, w, h, sparklesRef.current);
      drawRipples(ctx, ripplesRef.current);
      raf = requestAnimationFrame(loop);
    };

    if (reduced) {
      drawStatic();
    } else {
      raf = requestAnimationFrame(loop);
    }

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      ro?.disconnect();
      parent?.removeEventListener('mousemove', onMove);
      parent?.removeEventListener('mouseleave', onLeave);
      if (rippleApiRefResolved) rippleApiRefResolved.current = null;
    };
  }, [rippleApiRefResolved]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 0,
      }}
    />
  );
}
