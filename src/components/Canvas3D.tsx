import { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { PerspectiveCamera } from "@react-three/drei";
import Scene from "@/three/Scene";

/**
 * The single, persistent R3F Canvas for the whole app. Fixed to the
 * viewport behind all HTML content so the 3D scene never remounts or
 * scrolls with the page — only the HTML sections move over it.
 */
export default function Canvas3D() {
  return (
    <div className="canvas-layer" aria-hidden="true">
      <Canvas
        shadows
        dpr={[1, 1.75]}
        gl={{ antialias: true, powerPreference: "high-performance" }}
      >
        <PerspectiveCamera makeDefault fov={35} near={0.1} far={60} position={[0.6, 1.1, 8.5]} />
        <Suspense fallback={null}>
          <Scene />
        </Suspense>
      </Canvas>
    </div>
  );
}
