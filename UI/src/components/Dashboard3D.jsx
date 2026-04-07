import React, { useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Html } from '@react-three/drei';
import gsap from 'gsap';

function DataBox({ position = [0, 0.5, 0], label = 'Widget' }) {
  const ref = useRef();
  const [hovered, setHovered] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);

  return (
    <mesh
      ref={ref}
      position={position}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
        setShowTooltip(true);
        gsap.to(ref.current.scale, { x: 1.15, y: 1.15, z: 1.15, duration: 0.28, ease: 'power2.out' });
      }}
      onPointerOut={(e) => {
        e.stopPropagation();
        setHovered(false);
        setShowTooltip(false);
        gsap.to(ref.current.scale, { x: 1, y: 1, z: 1, duration: 0.4, ease: 'power3.out' });
      }}
      onClick={(e) => {
        e.stopPropagation();
        if (!ref.current) return;
        gsap.to(ref.current.material.color, { r: 0.05, g: 0.6, b: 0.95, duration: 0.45 });
        gsap.to(ref.current.scale, { x: 1.35, y: 1.35, z: 1.35, duration: 0.28, yoyo: true, repeat: 1 });
      }}
    >
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial attach="material" color={hovered ? '#ffd166' : '#0066cc'} />
      {showTooltip && (
        <Html distanceFactor={10} position={[0, 0.85, 0]} center>
          <div
            style={{
              background: 'rgba(0,0,0,0.75)',
              color: '#fff',
              padding: '6px 8px',
              borderRadius: 6,
              fontSize: 12,
              pointerEvents: 'none',
            }}
          >
            {label}
          </div>
        </Html>
      )}
    </mesh>
  );
}

export default function Dashboard3D() {
  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <Canvas camera={{ position: [0, 4, 8], fov: 50 }}>
        <ambientLight intensity={0.6} />
        <directionalLight intensity={0.9} position={[5, 10, 7]} />
        <OrbitControls enablePan enableRotate enableZoom />

        {/* simple ground */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]}>
          <planeGeometry args={[30, 30]} />
          <meshStandardMaterial color="#f3f4f6" />
        </mesh>

        {/* grid of data boxes */}
        {Array.from({ length: 9 }).map((_, i) => {
          const row = Math.floor(i / 3) - 1;
          const col = (i % 3) - 1;
          return <DataBox key={i} position={[col * 1.8, 0.5, row * 1.8]} label={`Widget ${i + 1}`} />;
        })}
      </Canvas>
    </div>
  );
}

