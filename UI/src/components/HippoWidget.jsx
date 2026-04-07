import { useEffect, useRef, useState, useCallback } from 'react';
import { useReducedMotion } from 'framer-motion';

const MESSAGES = [
  "Let's talk business 🤝",
  "I've got answers 💡",
  '24×7 at your service ⚡',
  'Go on, test me! 😏',
  'What can I solve? ✅',
  'Psst... ask me! 🧠',
];

function HippoWidgetInner() {
  const hippoRef = useRef(null);
  const posRef = useRef({
    x: typeof window !== 'undefined' ? window.innerWidth - 160 : 0,
    y: typeof window !== 'undefined' ? window.innerHeight - 180 : 0,
  });
  const velRef = useRef({ vx: 0, vy: 0 });
  const targetRef = useRef({ x: 200, y: 200 });
  const rafRef = useRef(null);
  const pausingRef = useRef(false);
  const roamTimerRef = useRef(null);
  const lastFpRef = useRef(0);

  const [facingLeft, setFacingLeft] = useState(false);
  const [bubbleText, setBubbleText] = useState(MESSAGES[0]);
  const [showBubble, setShowBubble] = useState(false);
  const [footprints, setFootprints] = useState([]);
  const [jumping, setJumping] = useState(false);
  const msgIdxRef = useRef(0);

  const newTarget = useCallback(() => {
    const margin = 90;
    targetRef.current = {
      x: margin + Math.random() * (window.innerWidth - margin * 2 - 110),
      y: 70 + Math.random() * (window.innerHeight - 220),
    };
  }, []);

  const scheduleRoam = useCallback(() => {
    const delay = 2800 + Math.random() * 3200;
    roamTimerRef.current = setTimeout(() => {
      if (Math.random() < 0.35) {
        pausingRef.current = true;
        setShowBubble(true);
        setTimeout(() => {
          pausingRef.current = false;
          setShowBubble(false);
          newTarget();
          scheduleRoam();
        }, 2200);
      } else {
        setShowBubble(false);
        newTarget();
        scheduleRoam();
      }
    }, delay);
  }, [newTarget]);

  useEffect(() => {
    const iv = setInterval(() => {
      msgIdxRef.current = (msgIdxRef.current + 1) % MESSAGES.length;
      setShowBubble(false);
      setTimeout(() => {
        setBubbleText(MESSAGES[msgIdxRef.current]);
        if (pausingRef.current) setShowBubble(true);
      }, 350);
    }, 4000);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    const t1 = setTimeout(() => {
      setShowBubble(true);
      pausingRef.current = true;
    }, 1200);
    const t2 = setTimeout(() => {
      pausingRef.current = false;
      setShowBubble(false);
      newTarget();
      scheduleRoam();
    }, 3500);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(roamTimerRef.current);
    };
  }, [newTarget, scheduleRoam]);

  useEffect(() => {
    const loop = (ts) => {
      const { x, y } = posRef.current;
      const { vx, vy } = velRef.current;
      const { x: tx, y: ty } = targetRef.current;

      let nx = x;
      let ny = y;
      let nvx = vx;
      let nvy = vy;

      if (!pausingRef.current) {
        const dx = tx - x;
        const dy = ty - y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist > 10) {
          nvx = (vx + (dx / dist) * 1.3) * 0.87;
          nvy = (vy + (dy / dist) * 1.3) * 0.87;

          const spd = Math.sqrt(nvx * nvx + nvy * nvy);
          const MAX = 3.8;
          if (spd > MAX) {
            nvx = (nvx / spd) * MAX;
            nvy = (nvy / spd) * MAX;
          }

          nx = Math.max(10, Math.min(window.innerWidth - 115, x + nvx));
          ny = Math.max(56, Math.min(window.innerHeight - 120, y + nvy));

          if (nvx < -0.4) setFacingLeft(true);
          else if (nvx > 0.4) setFacingLeft(false);

          if (spd > 1.8) setShowBubble(false);

          if (spd > 1 && ts - lastFpRef.current > 290) {
            lastFpRef.current = ts;
            const id = Date.now();
            setFootprints((prev) => [
              ...prev,
              {
                id,
                x: nx + 12 + Math.random() * 55,
                y: ny + 70,
              },
            ]);
            setTimeout(() => setFootprints((prev) => prev.filter((f) => f.id !== id)), 1400);
          }
        } else {
          nvx *= 0.6;
          nvy *= 0.6;
          if (Math.sqrt(nvx * nvx + nvy * nvy) < 0.3) setShowBubble(true);
        }
      } else {
        nvx *= 0.75;
        nvy *= 0.75;
      }

      posRef.current = { x: nx, y: ny };
      velRef.current = { vx: nvx, vy: nvy };

      if (hippoRef.current) {
        hippoRef.current.style.left = `${Math.round(nx)}px`;
        hippoRef.current.style.top = `${Math.round(ny)}px`;
      }

      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  const handleClick = () => {
    setBubbleText('Hehe! 🤭');
    setShowBubble(true);
    setJumping(true);
    setTimeout(() => setJumping(false), 520);
    setTimeout(() => {
      setBubbleText(MESSAGES[msgIdxRef.current]);
      if (pausingRef.current) setShowBubble(true);
    }, 2000);
  };

  return (
    <>
      {footprints.map((fp) => (
        <div
          key={fp.id}
          style={{
            position: 'fixed',
            left: fp.x,
            top: fp.y,
            width: 10,
            height: 5,
            borderRadius: '50%',
            background: 'rgba(2,6,111,0.07)',
            pointerEvents: 'none',
            zIndex: 9998,
            animation: 'hippoFpFade 1.4s ease-out forwards',
          }}
        />
      ))}

      <div
        ref={hippoRef}
        onClick={handleClick}
        style={{
          position: 'fixed',
          zIndex: 9999,
          cursor: 'pointer',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          userSelect: 'none',
          pointerEvents: 'auto',
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
            marginBottom: '5px',
            position: 'relative',
            boxShadow: '0 4px 14px rgba(2,6,111,0.22)',
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
              bottom: -6,
              left: '50%',
              transform: 'translateX(-50%)',
              width: 0,
              height: 0,
              borderLeft: '5px solid transparent',
              borderRight: '5px solid transparent',
              borderTop: '7px solid #02066F',
              display: 'block',
            }}
          />
        </div>

        <div
          style={{
            transform: `${facingLeft ? 'scaleX(-1)' : 'scaleX(1)'} ${jumping ? 'translateY(-20px)' : 'translateY(0)'}`,
            transition: jumping ? 'transform 0.12s' : 'transform 0.18s ease',
            filter: 'drop-shadow(0 8px 14px rgba(2,6,111,0.18))',
            animation: 'hippoBob 0.45s ease-in-out infinite',
          }}
        >
          <svg width="94" height="72" viewBox="0 0 94 72" fill="none" xmlns="http://www.w3.org/2000/svg">
            <style>{`
              @keyframes hippoBob   { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-4px)} }
              @keyframes hippoLeg   { 0%,100%{transform:rotate(-10deg)} 50%{transform:rotate(14deg)} }
              @keyframes hippoEar   { 0%,100%{transform:rotate(0)} 45%{transform:rotate(-14deg)} 75%{transform:rotate(10deg)} }
              @keyframes hippoTail  { 0%,100%{transform:rotate(0)} 50%{transform:rotate(30deg)} }
              @keyframes hippoEye   { 0%,88%,100%{transform:scaleY(1)} 91%,96%{transform:scaleY(0.06)} }
              @keyframes hippoFpFade{ 0%{opacity:0.5} 100%{opacity:0;transform:scale(2)} }
              .hleg-fl{transform-origin:50% 0%;animation:hippoLeg 0.45s ease-in-out infinite}
              .hleg-fr{transform-origin:50% 0%;animation:hippoLeg 0.45s ease-in-out infinite 0.22s}
              .hleg-bl{transform-origin:50% 0%;animation:hippoLeg 0.45s ease-in-out infinite 0.11s}
              .hleg-br{transform-origin:50% 0%;animation:hippoLeg 0.45s ease-in-out infinite 0.33s}
              .hear-l{transform-origin:50% 90%;animation:hippoEar 2.2s ease-in-out infinite}
              .hear-r{transform-origin:50% 90%;animation:hippoEar 2.2s ease-in-out infinite 0.5s alternate-reverse}
              .htail  {transform-origin:95% 50%;animation:hippoTail 1.2s ease-in-out infinite}
              .heye   {transform-origin:64px 25px;animation:hippoEye 5s ease-in-out infinite}
            `}</style>
            <ellipse cx="49" cy="70" rx="25" ry="3.5" fill="rgba(2,6,111,0.07)" />
            <g className="htail">
              <path
                d="M15 43 Q5 37 9 27 Q12 19 7 14"
                stroke="#02066F"
                strokeWidth="2.5"
                strokeLinecap="round"
                fill="none"
              />
              <circle cx="7" cy="13" r="3" fill="#1a6ef5" />
            </g>
            <ellipse cx="51" cy="45" rx="29" ry="18" fill="#02066F" />
            <ellipse cx="45" cy="37" rx="14" ry="7" fill="rgba(255,255,255,0.07)" />
            <ellipse cx="51" cy="52" rx="16" ry="9" fill="#1a4af5" opacity="0.4" />
            <g className="hleg-fl">
              <rect x="27" y="56" width="10" height="13" rx="5" fill="#02066F" />
            </g>
            <g className="hleg-fr">
              <rect x="41" y="58" width="10" height="11" rx="5" fill="#02066F" />
            </g>
            <g className="hleg-bl">
              <rect x="56" y="58" width="10" height="11" rx="5" fill="#02066F" />
            </g>
            <g className="hleg-br">
              <rect x="69" y="56" width="10" height="13" rx="5" fill="#02066F" />
            </g>
            <ellipse cx="70" cy="29" rx="20" ry="16" fill="#02066F" />
            <ellipse cx="64" cy="21" rx="10" ry="6" fill="rgba(255,255,255,0.08)" />
            <g className="hear-l">
              <ellipse cx="57" cy="14" rx="6" ry="8" fill="#02066F" />
              <ellipse cx="57" cy="15" rx="3.5" ry="5" fill="#1a6ef5" opacity="0.35" />
            </g>
            <g className="hear-r">
              <ellipse cx="78" cy="13" rx="6" ry="8" fill="#02066F" />
              <ellipse cx="78" cy="14" rx="3.5" ry="5" fill="#1a6ef5" opacity="0.35" />
            </g>
            <ellipse cx="85" cy="33" rx="9" ry="7" fill="#1a4af5" />
            <circle cx="83" cy="31.5" r="1.5" fill="rgba(0,0,0,0.3)" />
            <circle cx="88" cy="31.5" r="1.5" fill="rgba(0,0,0,0.3)" />
            <g className="heye">
              <circle cx="64" cy="25" r="6" fill="white" />
              <circle cx="65" cy="26" r="3.5" fill="#02066F" />
              <circle cx="66.5" cy="24" r="1.5" fill="white" />
            </g>
            <circle cx="76" cy="23" r="4.5" fill="white" />
            <circle cx="77" cy="24" r="2.5" fill="#02066F" />
            <circle cx="78" cy="22.5" r="1" fill="white" />
            <path
              d="M61 37 Q69 43 79 38"
              stroke="rgba(255,255,255,0.4)"
              strokeWidth="1.8"
              strokeLinecap="round"
              fill="none"
            />
          </svg>
        </div>
      </div>
    </>
  );
}

export default function HippoWidget() {
  const reduced = useReducedMotion();
  if (reduced) return null;
  return <HippoWidgetInner />;
}
