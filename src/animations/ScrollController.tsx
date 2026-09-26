import { useEffect, type PropsWithChildren } from "react";
import Lenis from "lenis";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { scrollState } from "@/three/scrollStore";

gsap.registerPlugin(ScrollTrigger);

/**
 * App-wide scroll orchestration:
 *  - Lenis provides the smooth-scroll feel.
 *  - GSAP's ticker drives Lenis's rAF loop so both stay perfectly in sync.
 *  - ScrollTrigger is refreshed against Lenis's scroll events.
 *  - A single global progress ScrollTrigger keeps `scrollState.globalProgress`
 *    up to date for any ambient, whole-document-driven 3D behaviour.
 *
 * Section-specific ScrollTriggers (pinning, text reveals, card fade-ins)
 * live inside their own section components and clean up after themselves;
 * this controller only owns the app-wide concerns.
 */
export default function ScrollController({ children }: PropsWithChildren) {
  useEffect(() => {
    const lenis = new Lenis({
      duration: 1.15,
      easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      anchors: true,
    });

    lenis.on("scroll", ScrollTrigger.update);

    const tickerCallback = (time: number) => {
      lenis.raf(time * 1000);
    };
    gsap.ticker.add(tickerCallback);
    gsap.ticker.lagSmoothing(0);

    const globalTrigger = ScrollTrigger.create({
      trigger: document.documentElement,
      start: "top top",
      end: "bottom bottom",
      onUpdate: (self) => {
        scrollState.globalProgress = self.progress;
      },
    });

    return () => {
      gsap.ticker.remove(tickerCallback);
      lenis.destroy();
      globalTrigger.kill();
    };
  }, []);

  return <>{children}</>;
}
