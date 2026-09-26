import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

/**
 * Shared "fade + rise into place" reveal used by every content section
 * (Services, Skills, Work, About, Contact). Kept as one helper so the
 * cinematic pacing stays consistent site-wide.
 *
 * Returns the gsap.Context so callers can `.revert()` it on unmount.
 */
export function createRevealContext(scope: HTMLElement, selector = "[data-reveal]") {
  return gsap.context(() => {
    const targets = gsap.utils.toArray<HTMLElement>(selector);

    targets.forEach((el, i) => {
      gsap.fromTo(
        el,
        { autoAlpha: 0, y: 36 },
        {
          autoAlpha: 1,
          y: 0,
          duration: 1.1,
          ease: "power3.out",
          delay: (i % 4) * 0.06,
          scrollTrigger: {
            trigger: el,
            start: "top 85%",
            toggleActions: "play none none reverse",
          },
        }
      );
    });
  }, scope);
}
