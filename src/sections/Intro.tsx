import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { INTRO_PHASES, scrollState } from "@/three/scrollStore";

gsap.registerPlugin(ScrollTrigger);

// Moderate cinematic soft-focus at rest, not heavy fog -- 16px read as
// excessive, especially stacked on top of a then-320px source image. Now
// that the desktop frame sequence is 512px wide, a lighter blur still
// reads as an intentional focus-pull rather than making a low-res source
// look even softer.
const MAX_BLUR_PX = 9;

function mapRange(value: number, inMin: number, inMax: number, outMin: number, outMax: number) {
  const t = (value - inMin) / (inMax - inMin);
  const clamped = Math.min(1, Math.max(0, t));
  return outMin + clamped * (outMax - outMin);
}

// Classic smoothstep: eases both ends of a 0->1 ramp so text arrives/leaves
// with a deceleration instead of the constant-velocity feel of a raw linear
// fade -- a small change that reads as "cinematic ease" rather than a
// generic CSS-transition fade.
function smoothstep(t: number) {
  const c = Math.min(1, Math.max(0, t));
  return c * c * (3 - 2 * c);
}

function easedRamp(value: number, inMin: number, inMax: number) {
  return smoothstep(mapRange(value, inMin, inMax, 0, 1));
}

function easeOutCubic(t: number) {
  return 1 - Math.pow(1 - t, 3);
}

/**
 * The cinematic opening sequence: rider poster-frame -> approach/focus ->
 * moves left for the welcome line -> travels right for the name reveal ->
 * nav reveal -> hand-off into the portfolio sections. This section pins
 * itself for the whole sequence and is the single ScrollTrigger driving
 * everything -- CameraRig/Rider (via `scrollState`), the welcome/name text,
 * the canvas blur, and the site nav (queried directly as a DOM singleton,
 * same as how this component already drives text on its own refs). Every
 * value here is a pure function of `progress`, so scrolling back up
 * reverses the whole sequence -- including un-revealing the nav -- with no
 * separate "reverse" logic needed.
 */
export default function Intro() {
  const sectionRef = useRef<HTMLElement>(null);
  const welcomeRef = useRef<HTMLParagraphElement>(null);
  const nameRef = useRef<HTMLHeadingElement>(null);
  const cueRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!sectionRef.current) return;

    // Singletons owned by sibling components (App.tsx renders Nav and
    // Canvas3D alongside this section, not inside it) -- queried once by
    // stable class name rather than threaded through as props/context.
    const navEl = document.querySelector<HTMLElement>(".nav");
    const canvasLayerEl = document.querySelector<HTMLElement>(".canvas-layer");
    let navRevealed = false;

    const ctx = gsap.context(() => {
      // yPercent handles the permanent vertical-centering offset (paired
      // with `top: 50%` in CSS); the animated `y` below layers a pixel
      // rise-in on top without fighting it, since GSAP composes both into
      // one transform.
      gsap.set(welcomeRef.current, { autoAlpha: 0, y: 24, yPercent: -50 });
      gsap.set(nameRef.current, { autoAlpha: 0, y: 32 });
      if (navEl) gsap.set(navEl, { autoAlpha: 0, y: -10, pointerEvents: "none" });

      function applyProgress(progress: number) {
        scrollState.introProgress = progress;
        scrollState.riderAsideProgress = mapRange(progress, INTRO_PHASES.asideStart, 1, 0, 1);

        // Smoothstep-eased ramps (not raw linear) so text arrives and
        // leaves with a cinematic deceleration -- same timing windows as
        // before, just a more deliberate curve between them.
        const welcomeIn = easedRamp(progress, INTRO_PHASES.welcomeFadeInStart, INTRO_PHASES.welcomeFadeInEnd);
        const welcomeOut = easedRamp(progress, INTRO_PHASES.welcomeFadeOutStart, INTRO_PHASES.welcomeFadeOutEnd);
        gsap.set(welcomeRef.current, {
          autoAlpha: welcomeIn - welcomeOut,
          y: 18 * (1 - welcomeIn),
        });

        const nameIn = easedRamp(progress, INTRO_PHASES.nameFadeInStart, INTRO_PHASES.nameFadeInEnd);
        const nameOut = easedRamp(progress, INTRO_PHASES.nameFadeOutStart, INTRO_PHASES.nameFadeOutEnd);
        gsap.set(nameRef.current, {
          autoAlpha: nameIn - nameOut,
          y: 24 * (1 - nameIn) - 12 * nameOut,
        });

        gsap.set(cueRef.current, {
          autoAlpha: 1 - easedRamp(progress, 0, INTRO_PHASES.fadeInEnd),
        });

        // Cinematic blur, strongest at the very start, cleared entirely
        // (not just blur(0px)) once the rider has finished approaching so
        // the browser drops the compositing cost for the rest of the site.
        // Eased like a camera focus pull -- decelerating as it locks onto
        // sharp focus, rather than clearing at a constant linear rate.
        if (canvasLayerEl) {
          const focusPull = easeOutCubic(mapRange(progress, 0, INTRO_PHASES.approachEnd, 0, 1));
          const blurAmount = MAX_BLUR_PX * (1 - focusPull);
          canvasLayerEl.style.filter = blurAmount > 0.3 ? `blur(${blurAmount}px)` : "";
        }

        // Nav reveals only once "I'M SREE" has fully landed, and reverses
        // the same way if the user scrolls back up past that point --
        // triggered once per direction change, not re-tweened every tick.
        if (navEl) {
          const shouldShowNav = progress >= INTRO_PHASES.navRevealAt;
          if (shouldShowNav !== navRevealed) {
            navRevealed = shouldShowNav;
            gsap.to(navEl, {
              autoAlpha: shouldShowNav ? 1 : 0,
              y: shouldShowNav ? 0 : -10,
              duration: shouldShowNav ? 0.85 : 0.5,
              ease: shouldShowNav ? "power3.out" : "power2.in",
              overwrite: true,
            });
            navEl.classList.toggle("nav--interactive", shouldShowNav);
          }
        }
      }

      // Establish the correct opening state immediately (blur, nav-hidden,
      // scroll cue) rather than relying on ScrollTrigger to fire onUpdate
      // before the user's first scroll.
      applyProgress(0);

      ScrollTrigger.create({
        trigger: sectionRef.current,
        start: "top top",
        end: "+=450%",
        pin: true,
        scrub: 1,
        anticipatePin: 1,
        onUpdate: (self) => applyProgress(self.progress),
      });
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section ref={sectionRef} className="intro" id="intro">
      <div className="intro__stage">
        <p ref={welcomeRef} className="intro__welcome">
          WELCOME TO MY CREATIVE WORLD
        </p>
        <h1 ref={nameRef} className="intro__name">
          I&rsquo;M SREE
        </h1>
      </div>
      <div ref={cueRef} className="intro__cue">
        <span>Scroll</span>
        <span className="intro__cue-line" />
      </div>
    </section>
  );
}
