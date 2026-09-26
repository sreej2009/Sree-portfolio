import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { AdditiveBlending, Points as ThreePoints } from "three";

const COUNT = 900;
const RADIUS = 9;

function generatePositions(count: number, radius: number) {
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const r = radius * Math.cbrt(Math.random());
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);

    positions[i * 3 + 0] = r * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta) * 0.6;
    positions[i * 3 + 2] = r * Math.cos(phi);
  }
  return positions;
}

/**
 * Slow-drifting ambient dust field. Kept subtle and desaturated (off-white /
 * champagne) — no neon, no glow blooms, just faint depth cues.
 */
export default function Particles() {
  const pointsRef = useRef<ThreePoints>(null);
  const positions = useMemo(() => generatePositions(COUNT, RADIUS), []);

  useFrame((state, delta) => {
    if (!pointsRef.current) return;
    pointsRef.current.rotation.y += delta * 0.015;
    pointsRef.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.05) * 0.03;
  });

  return (
    <points ref={pointsRef} position={[0, 0.5, -2]}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        size={0.02}
        color="#cbb98c"
        transparent
        opacity={0.35}
        sizeAttenuation
        blending={AdditiveBlending}
        depthWrite={false}
      />
    </points>
  );
}
