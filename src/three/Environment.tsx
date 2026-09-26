import { Environment as DreiEnvironment } from "@react-three/drei";
import { Color } from "three";

const FOG_COLOR = new Color("#08080a");

/**
 * Cinematic lighting rig: a warm champagne key light, a cool rim light for
 * separation, low ambient fill, and a dark reflective floor to ground the
 * rider. Fog keeps depth readable and mood dark without needing bloom/glow.
 */
export default function Environment() {
  return (
    <>
      <fog attach="fog" args={[FOG_COLOR, 6, 22]} />
      <color attach="background" args={[FOG_COLOR]} />

      <ambientLight intensity={0.15} color="#3a3a40" />

      {/* Warm champagne/gold key light, front-top */}
      <spotLight
        position={[3, 6, 5]}
        angle={0.35}
        penumbra={0.8}
        intensity={9}
        color="#e8c993"
        distance={20}
        decay={2}
        castShadow
        shadow-mapSize={[1024, 1024]}
      />

      {/* Cool rim light from behind for silhouette separation */}
      <pointLight position={[-4, 3, -5]} intensity={4} color="#6f7a8c" distance={16} decay={2} />

      {/* Subtle fill so the dark side never goes fully black */}
      <pointLight position={[0, 1, 4]} intensity={0.6} color="#8a7a5c" distance={10} decay={2} />

      {/* Reflective dark floor for subtle chrome reflections */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.4, 0]} receiveShadow>
        <planeGeometry args={[60, 60]} />
        <meshStandardMaterial color="#0c0c0e" metalness={0.6} roughness={0.35} />
      </mesh>

      {/* Soft studio IBL for believable chrome/metal reflections, no HDRI asset needed */}
      <DreiEnvironment preset="night" />
    </>
  );
}
