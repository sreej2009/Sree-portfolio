/**
 * Lightweight cross-tree bridge between DOM-driven GSAP ScrollTrigger updates
 * and the persistent R3F <Canvas>. ScrollTrigger callbacks live in the DOM
 * component tree (sections/*), while CameraRig/Rider read these values every
 * frame inside useFrame. A mutable singleton avoids extra state-management
 * dependencies and avoids React re-renders on every scroll tick.
 */
export const scrollState = {
  /** 0 -> 1 progress through the pinned Intro sequence. */
  introProgress: 0,
  /** 0 -> 1 progress of the rider sliding/fading out of frame. */
  riderAsideProgress: 0,
  /** 0 -> 1 progress across the entire scrollable document. */
  globalProgress: 0,
};

export type ScrollState = typeof scrollState;

/**
 * Shared timing for the cinematic intro choreography, as fractions of
 * `scrollState.introProgress` (0 -> 1). Both the DOM side (Intro.tsx driving
 * text/nav/blur) and the 3D side (Rider.tsx/CameraRig.tsx driving the rider
 * and camera) import these so every element of the sequence -- video scrub,
 * position, text, nav reveal -- stays synchronized from one source of truth.
 */
export const INTRO_PHASES = {
  /** Rider opacity fades in; the "SCROLL" cue fades out. */
  fadeInEnd: 0.06,
  /** Scale/depth/blur "approach" finishes; camera dolly-in completes. */
  approachEnd: 0.28,
  /** Rider travels from center to the left side of frame. */
  moveLeftStart: 0.28,
  moveLeftEnd: 0.44,
  /** "WELCOME TO MY CREATIVE WORLD" reveal, while rider holds at the left. */
  welcomeFadeInStart: 0.32,
  welcomeFadeInEnd: 0.42,
  welcomeFadeOutStart: 0.52,
  welcomeFadeOutEnd: 0.58,
  /** Rider travels from the left side to the right side of frame. */
  moveRightStart: 0.56,
  moveRightEnd: 0.74,
  /** "I'M SREE" reveal, while rider crosses to the right. */
  nameFadeInStart: 0.62,
  nameFadeInEnd: 0.76,
  /** Navigation reveals only once "I'M SREE" has fully appeared. */
  navRevealAt: 0.8,
  /** Rider drifts further right and fades out, handing off to Services. */
  asideStart: 0.85,
  nameFadeOutStart: 0.89,
  nameFadeOutEnd: 0.99,
} as const;
