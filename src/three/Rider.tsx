import { forwardRef, useImperativeHandle, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Group, Mesh, MeshBasicMaterial, MeshStandardMaterial, MathUtils } from "three";
import { INTRO_PHASES, scrollState } from "./scrollStore";
import { useRiderVideoTexture } from "./useRiderVideoTexture";
import { useRiderFrameSequence } from "./useRiderFrameSequence";

// Cubic (not quadratic) ease-in-out: holds a touch longer at the extremes
// and moves with more conviction through the middle, which reads as more
// deliberate/cinematic than a quadratic curve without being showy.
function easeInOut(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function easeOutCubic(t: number) {
  return 1 - Math.pow(1 - t, 3);
}

function mapRange(value: number, inMin: number, inMax: number, outMin: number, outMax: number) {
  const t = MathUtils.clamp((value - inMin) / (inMax - inMin), 0, 1);
  return outMin + t * (outMax - outMin);
}

const RIDER_HEIGHT = 2.6;

// The source clip is 24fps -- seeking to a currentTime inside the same
// ~41.7ms frame window redraws an identical decoded frame, so any seek
// finer than that is wasted decoder work (a major cause of the stutter:
// VP9 seeks aren't free, and firing one every render frame at 60fps starves
// the decoder before the previous seek even resolves). These thresholds
// sit just under one frame interval on desktop, and deliberately coarser on
// narrow/mobile viewports to cut seek frequency further on weaker hardware.
const VIDEO_FRAME_SECONDS = 1 / 24;
const SEEK_THRESHOLD_DESKTOP = VIDEO_FRAME_SECONDS * 0.9;
const SEEK_THRESHOLD_MOBILE = VIDEO_FRAME_SECONDS * 1.3;
const SEEK_DAMP_LAMBDA_DESKTOP = 12;
const SEEK_DAMP_LAMBDA_MOBILE = 7;
const MOBILE_BREAKPOINT_PX = 700;

// Rider transform (position/scale) and frame-sequence progress share this
// same damp lambda, so they never drift out of sync with each other. It's
// deliberately high (a short ~60-80ms settle) rather than the softer ~250ms
// a lambda of 4 would give: GSAP's ScrollTrigger `scrub: 1` already smooths
// the underlying scroll signal driving the text/blur in Intro.tsx, so a
// *second*, slower smoothing pass here on top of that -- as a lambda of 4
// previously did -- made the rider visibly lag half a beat behind the text
// and blur instead of moving as one continuous animation. This lambda only
// irons out Lenis's per-frame stepping noise; it shouldn't read as lag.
const RIDER_DAMP_LAMBDA = 16;
const FRAME_DAMP_LAMBDA = RIDER_DAMP_LAMBDA;

// Horizontal travel (world units): center -> left (welcome) -> right (SREE)
// -> further right while fading out into the portfolio sections.
const CENTER_X = 0;
const LEFT_X = -1.6;
const RIGHT_X = 1.6;
const EXIT_X = 2.7;

// Rider scale, in four stages. CameraRig (untouched, see its own file) keeps
// dollying the camera closer for the *entire* intro -- its `approachT` uses
// the raw, uncapped introProgress, not this file's `approachEnd` -- so by
// the time "I'M SREE" reveals, the camera is dramatically closer than it was
// when the rider's own approach animation finished. With scale pinned flat
// at 1 the whole time (the old behaviour), that continued dolly alone made
// the rider look roughly 1.9x bigger by the SREE reveal than right after
// "approaching" -- which is exactly the "way too large, covers the
// typography" bug. Compensated here by having the rider's own scale ease
// back down through the welcome->SREE window, offsetting the camera's
// continued approach so the on-screen size stays composed instead of
// growing unchecked. Tuned empirically against real screenshots, not
// derived to be pixel-exact -- adjust these four numbers first if the
// framing still looks off.
const INITIAL_SCALE = 0.62; // clearly a rider, not a blurry speck, at rest
const PEAK_SCALE = 1.3; // "approach" finishes large and prominent
const SREE_SCALE = 0.86; // eases back down so it doesn't swallow "I'M SREE"

function computeApproachScale(introT: number) {
  const { approachEnd, welcomeFadeInEnd, nameFadeInEnd } = INTRO_PHASES;
  if (introT <= approachEnd) {
    return MathUtils.lerp(INITIAL_SCALE, PEAK_SCALE, easeInOut(mapRange(introT, 0, approachEnd, 0, 1)));
  }
  if (introT <= welcomeFadeInEnd) {
    return PEAK_SCALE;
  }
  if (introT <= nameFadeInEnd) {
    return MathUtils.lerp(
      PEAK_SCALE,
      SREE_SCALE,
      easeInOut(mapRange(introT, welcomeFadeInEnd, nameFadeInEnd, 0, 1))
    );
  }
  return SREE_SCALE;
}

/**
 * Center -> left -> hold -> right -> hold, purely a function of
 * introProgress. `leftX`/`rightX` are pre-scaled for the current viewport
 * (see `travelScaleForAspect`) so the rider stays on-frame on narrow/tall
 * mobile screens instead of traveling fully off-screen.
 */
function computeBaseX(introT: number, leftX: number, rightX: number) {
  const { moveLeftStart, moveLeftEnd, moveRightStart, moveRightEnd } = INTRO_PHASES;
  if (introT <= moveLeftStart) {
    return CENTER_X;
  }
  if (introT <= moveLeftEnd) {
    return MathUtils.lerp(CENTER_X, leftX, easeInOut(mapRange(introT, moveLeftStart, moveLeftEnd, 0, 1)));
  }
  if (introT <= moveRightStart) {
    return leftX;
  }
  if (introT <= moveRightEnd) {
    return MathUtils.lerp(leftX, rightX, easeInOut(mapRange(introT, moveRightStart, moveRightEnd, 0, 1)));
  }
  return rightX;
}

/**
 * Desktop-tuned travel (aspect ~1.6+) stays full-size; narrower/taller
 * viewports (mobile) pull it closer to center. A PerspectiveCamera's
 * horizontal FOV narrows as aspect drops below 1 (vertical FOV is fixed),
 * so the same world-space X offset covers proportionally more of a
 * portrait screen's width -- without a low floor here the rider was
 * drifting far enough right during the SREE reveal to leave the visible
 * frustum on a phone-width viewport entirely.
 */
function travelScaleForAspect(aspect: number) {
  return MathUtils.clamp(aspect / 1.6, 0.32, 1);
}

/**
 * Separate, steeper falloff for overall rider SIZE (not travel distance) on
 * narrow/tall viewports. PEAK_SCALE/SREE_SCALE were tuned against the
 * desktop composition; on a portrait phone, `.intro__welcome`'s mobile
 * layout centers the text across nearly the full width (see index.css),
 * leaving much less horizontal room than desktop's side-by-side layout --
 * travelScaleForAspect's 0.52 floor wasn't enough on its own to keep the
 * rider clear of it. No effect on desktop, where aspect is already >=1.6.
 */
function sizeScaleForAspect(aspect: number) {
  return MathUtils.clamp(aspect / 1.6, 0.34, 1);
}

/**
 * The rider, in priority order:
 *   1. Preloaded WebP frame sequence (public/assets/avatar/rider-frames/,
 *      see useRiderFrameSequence) -- the primary path. Scroll maps directly
 *      to a frame index with no video decoder involved at all.
 *   2. Transparent WebM video (see useRiderVideoTexture), kept fully intact
 *      and isolated as a fallback for whenever frame assets aren't
 *      available -- it can be deleted later without touching anything else.
 *   3. The placeholder dark-chrome silhouette, if neither asset loads.
 *
 * To go live with a new clip: run `npm run frames:extract` (regenerates
 * the frame sequence from public/assets/avatar/rider.webm) -- nothing in
 * this file needs to change either way.
 *
 * Transform is driven entirely by the existing scroll architecture --
 * `scrollState.introProgress`/`riderAsideProgress`, written by Intro.tsx's
 * single ScrollTrigger -- so scrolling up/down naturally scrubs whichever
 * rider source is active forward/backward along with position/scale/
 * opacity/blur.
 */
const Rider = forwardRef<Group>(function Rider(_props, ref) {
  const innerRef = useRef<Group>(null);
  const bodyMeshRefs = useRef<Mesh[]>([]);
  const videoMeshRef = useRef<Mesh>(null);
  const frameMeshRef = useRef<Mesh>(null);
  useImperativeHandle(ref, () => innerRef.current as Group);

  const registerBody = useMemo(
    () => (mesh: Mesh | null) => {
      if (mesh && !bodyMeshRefs.current.includes(mesh)) bodyMeshRefs.current.push(mesh);
    },
    []
  );

  const frames = useRiderFrameSequence();
  const useFrames = frames.status === "ready" && frames.texture !== null && frames.frameCount > 1;

  const video = useRiderVideoTexture();
  const useVideo = !useFrames && video.status === "ready" && video.texture !== null;
  const mountElapsedRef = useRef<number | null>(null);
  const { size } = useThree();

  // Frame-sequence smoothing state (primary path). Kept in refs so
  // scrubbing never triggers a re-render or touches the texture/mesh --
  // `updateFrame` only ever redraws the one reused canvas.
  const targetFrameProgressRef = useRef(0);
  const smoothedFrameProgressRef = useRef(0);
  const lastDisplayedFrameIndexRef = useRef(-1);

  // Video-scrub smoothing state (fallback path, unchanged). Kept in refs
  // (never React state) so scrubbing never triggers a re-render, a new
  // VideoTexture, or a new material/mesh -- the texture is created exactly
  // once in useRiderVideoTexture and only ever mutated in place via
  // currentTime.
  const targetVideoTimeRef = useRef(0);
  const smoothedVideoTimeRef = useRef(0);
  const lastSeekedTimeRef = useRef(-1);

  useFrame((state, delta) => {
    if (!innerRef.current) return;

    const aspect = size.width / size.height;
    const travelScale = travelScaleForAspect(aspect);
    const sizeScale = sizeScaleForAspect(aspect);

    const introT = MathUtils.clamp(scrollState.introProgress, 0, 1);
    const asideT = MathUtils.clamp(scrollState.riderAsideProgress, 0, 1);

    // START -> FIRST SCROLL: medium-small/far/blurred, approaching the
    // camera. Depth still only animates during the initial approach (it
    // holds at 0.5 afterward) -- the scale curve is what compensates for
    // the camera's own continued dolly-in through welcome/SREE, see
    // computeApproachScale above.
    const approach = easeInOut(mapRange(introT, 0, INTRO_PHASES.approachEnd, 0, 1));
    // sizeScale dampens overall size on narrow/tall viewports --
    // PEAK_SCALE/SREE_SCALE were tuned against the desktop composition, and
    // without this a portrait mobile screen showed the rider growing large
    // enough to overlap the welcome text. No effect on desktop, where
    // sizeScale is already 1.
    const scale = computeApproachScale(introT) * sizeScale;
    const depth = MathUtils.lerp(-1.7, 0.5, approach);

    // Soft fade-in plays once, automatically, on load/mount -- this is the
    // opening state's entrance, not something gated behind the user
    // actually scrolling (unlike everything else here, which is scroll-
    // driven). Eased out (decelerating) rather than linear, so it reads as
    // settling into place instead of a generic linear fade. The scroll-
    // driven exit fade at the end is untouched below.
    if (mountElapsedRef.current === null) mountElapsedRef.current = state.clock.elapsedTime;
    const fadeIn = easeOutCubic(
      MathUtils.clamp((state.clock.elapsedTime - mountElapsedRef.current) / 1.4, 0, 1)
    );

    // LATER: drifts further right and fades out fully, handing off to
    // Services -- reuses the same riderAsideProgress the site already had.
    const asideEase = easeInOut(asideT);
    const baseX = computeBaseX(introT, LEFT_X * travelScale, RIGHT_X * travelScale);
    const targetX = MathUtils.lerp(baseX, EXIT_X * travelScale, asideEase);
    const targetScale = scale * MathUtils.lerp(1, 0.78, asideEase);

    innerRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.25) * 0.04;
    innerRef.current.position.x = MathUtils.damp(innerRef.current.position.x, targetX, RIDER_DAMP_LAMBDA, delta);
    innerRef.current.position.z = MathUtils.damp(innerRef.current.position.z, depth, RIDER_DAMP_LAMBDA, delta);
    innerRef.current.scale.setScalar(
      MathUtils.damp(innerRef.current.scale.x, targetScale, RIDER_DAMP_LAMBDA, delta)
    );

    const opacity = fadeIn * (1 - asideEase);
    for (const mesh of bodyMeshRefs.current) {
      (mesh.material as MeshStandardMaterial).opacity = opacity;
    }
    if (videoMeshRef.current) {
      (videoMeshRef.current.material as MeshBasicMaterial).opacity = opacity;
    }
    if (frameMeshRef.current) {
      (frameMeshRef.current.material as MeshBasicMaterial).opacity = opacity;
    }

    if (useFrames) {
      // Primary path: scroll progress -> smoothed progress -> exact frame
      // index -> already-decoded image -> the same reused canvas/texture.
      // No video decoder, no seeking, no per-frame allocation. Smoothed
      // with the same damp lambda as position/scale above, so the frame
      // and the physical rider motion stay visually in lockstep.
      targetFrameProgressRef.current = introT;
      if (lastDisplayedFrameIndexRef.current === -1) {
        smoothedFrameProgressRef.current = introT;
      } else {
        smoothedFrameProgressRef.current = MathUtils.damp(
          smoothedFrameProgressRef.current,
          targetFrameProgressRef.current,
          FRAME_DAMP_LAMBDA,
          delta
        );
      }
      const newIndex = Math.round(smoothedFrameProgressRef.current * (frames.frameCount - 1));
      if (newIndex !== lastDisplayedFrameIndexRef.current) {
        frames.updateFrame(newIndex);
        lastDisplayedFrameIndexRef.current = newIndex;
      }
    } else if (useVideo && video.video && video.duration) {
      // Fallback path (frame sequence unavailable): scroll-scrubbed WebM
      // playback, unchanged. The clip's currentTime chases a smoothed
      // target derived from introProgress, so scrolling down advances the
      // video and scrolling up reverses it -- with no jumping between
      // frames. This is the single loop driving the scrub (R3F's useFrame,
      // itself one requestAnimationFrame loop synced to the same
      // Lenis/GSAP-ticker-driven render cycle CameraRig and this component's
      // own position/scale logic already run on -- no second loop). Never
      // call play()/pause()/load() here -- only ever read `video.duration`
      // and write `currentTime`.
      const isMobile = size.width < MOBILE_BREAKPOINT_PX;
      const seekThreshold = isMobile ? SEEK_THRESHOLD_MOBILE : SEEK_THRESHOLD_DESKTOP;
      const dampLambda = isMobile ? SEEK_DAMP_LAMBDA_MOBILE : SEEK_DAMP_LAMBDA_DESKTOP;

      const safeDuration = Math.max(0.01, video.duration - 0.05);
      targetVideoTimeRef.current = introT * safeDuration;

      if (lastSeekedTimeRef.current === -1) {
        // First frame the video is ready: snap straight to the correct
        // position (e.g. the user may have already scrolled while it was
        // still loading) instead of visibly gliding in from frame 0.
        smoothedVideoTimeRef.current = targetVideoTimeRef.current;
      } else {
        // Frame-rate-independent exponential smoothing -- the same
        // `currentTime += (target - currentTime) * smoothingFactor` idea,
        // adjusted for variable frame delta so it feels identical at any
        // refresh rate. This is what actually removes the stutter: the
        // *target* fed to seeking is now itself smooth, instead of jumping
        // to the raw, unsmoothed scroll-derived value every frame.
        smoothedVideoTimeRef.current = MathUtils.damp(
          smoothedVideoTimeRef.current,
          targetVideoTimeRef.current,
          dampLambda,
          delta
        );
      }

      // Gate against our own last-requested time, never against
      // video.currentTime -- that value is maintained asynchronously by
      // the browser mid-seek and reading it back here would just
      // reintroduce the same thrashing this fix removes.
      if (Math.abs(smoothedVideoTimeRef.current - lastSeekedTimeRef.current) > seekThreshold) {
        video.video.currentTime = smoothedVideoTimeRef.current;
        lastSeekedTimeRef.current = smoothedVideoTimeRef.current;
      }
    }
  });

  return (
    <group ref={innerRef} position={[0, -0.4, 0.5]}>
      {useFrames ? (
        <mesh ref={frameMeshRef} position={[0, 1.3, 0.01]}>
          <planeGeometry args={[RIDER_HEIGHT * frames.aspect, RIDER_HEIGHT]} />
          <meshBasicMaterial
            map={frames.texture}
            transparent
            alphaTest={0.02}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
      ) : useVideo ? (
        <mesh ref={videoMeshRef} position={[0, 1.3, 0.01]}>
          <planeGeometry args={[RIDER_HEIGHT * video.aspect, RIDER_HEIGHT]} />
          <meshBasicMaterial
            map={video.texture}
            transparent
            alphaTest={0.02}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
      ) : (
        <RiderPlaceholder registerBody={registerBody} />
      )}
    </group>
  );
});

export default Rider;

function RiderPlaceholder({ registerBody }: { registerBody: (mesh: Mesh | null) => void }) {
  return (
    <>
      {/* Torso */}
      <mesh ref={registerBody} castShadow position={[0, 0.9, 0]}>
        <capsuleGeometry args={[0.32, 0.75, 6, 12]} />
        <meshStandardMaterial color="#121214" metalness={0.85} roughness={0.22} transparent opacity={1} />
      </mesh>
      {/* Head */}
      <mesh ref={registerBody} castShadow position={[0, 1.72, 0]}>
        <sphereGeometry args={[0.24, 20, 20]} />
        <meshStandardMaterial color="#141416" metalness={0.8} roughness={0.25} transparent opacity={1} />
      </mesh>
      {/* Legs */}
      <mesh ref={registerBody} castShadow position={[-0.14, 0.05, 0]}>
        <capsuleGeometry args={[0.14, 0.85, 6, 10]} />
        <meshStandardMaterial color="#0e0e10" metalness={0.85} roughness={0.3} transparent opacity={1} />
      </mesh>
      <mesh ref={registerBody} castShadow position={[0.14, 0.05, 0]}>
        <capsuleGeometry args={[0.14, 0.85, 6, 10]} />
        <meshStandardMaterial color="#0e0e10" metalness={0.85} roughness={0.3} transparent opacity={1} />
      </mesh>
      {/* Contact shadow disc */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.85, 0]}>
        <circleGeometry args={[0.65, 32]} />
        <meshStandardMaterial color="#000000" transparent opacity={0.35} />
      </mesh>
    </>
  );
}
