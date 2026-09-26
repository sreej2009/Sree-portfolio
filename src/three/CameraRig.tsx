import { useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { MathUtils, Vector3 } from "three";
import { scrollState } from "./scrollStore";

const START = new Vector3(0.6, 1.1, 8.5);
const APPROACH = new Vector3(0, 0.9, 3.4);
const AMBIENT = new Vector3(-0.4, 1.0, 5.4);

const LOOK_START = new Vector3(0, 0.6, 0);
const LOOK_APPROACH = new Vector3(0, 1.0, 0);

function easeInOut(t: number) {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

/**
 * Drives the persistent camera purely from `scrollState`, which is written
 * to by ScrollTrigger instances living in the DOM tree (see sections/Intro
 * and ScrollController). Keeping this read-only from the Three.js side
 * means the camera never fights the DOM-driven scroll animation.
 */
export default function CameraRig() {
  const { camera } = useThree();
  const lookTarget = useRef(new Vector3().copy(LOOK_START));

  useFrame((state, delta) => {
    const approachT = MathUtils.clamp(scrollState.introProgress, 0, 1);
    const asideT = MathUtils.clamp(scrollState.riderAsideProgress, 0, 1);

    // Cinematic dolly-in toward the rider across the pinned intro sequence,
    // then settle into a slightly pulled-back ambient position once the
    // rider has moved aside and the rest of the site begins.
    const dolly = new Vector3().lerpVectors(START, APPROACH, easeInOut(approachT));
    const settled = new Vector3().lerpVectors(dolly, AMBIENT, easeInOut(asideT));

    // Subtle pointer parallax, dampened, never distracting.
    const { pointer } = state;
    const parallaxX = pointer.x * 0.15;
    const parallaxY = pointer.y * 0.08;

    camera.position.x = MathUtils.damp(camera.position.x, settled.x + parallaxX, 3, delta);
    camera.position.y = MathUtils.damp(camera.position.y, settled.y + parallaxY, 3, delta);
    camera.position.z = MathUtils.damp(camera.position.z, settled.z, 3, delta);

    const look = new Vector3().lerpVectors(LOOK_START, LOOK_APPROACH, easeInOut(approachT));
    lookTarget.current.x = MathUtils.damp(lookTarget.current.x, look.x, 3, delta);
    lookTarget.current.y = MathUtils.damp(lookTarget.current.y, look.y, 3, delta);
    lookTarget.current.z = MathUtils.damp(lookTarget.current.z, look.z, 3, delta);

    camera.lookAt(lookTarget.current);

    // Slow idle breathing so the frame never looks perfectly static.
    camera.position.y += Math.sin(state.clock.elapsedTime * 0.18) * 0.015;
  });

  return null;
}
