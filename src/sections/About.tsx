import { useEffect, useRef } from "react";
import { createRevealContext } from "@/animations/sectionReveal";

const stats = [
  { label: "Years Crafting", value: "6+" },
  { label: "Shipped Experiences", value: "30+" },
  { label: "Frameworks Mastered", value: "Handful, deeply" },
];

export default function About() {
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!sectionRef.current) return;
    const ctx = createRevealContext(sectionRef.current);
    return () => ctx.revert();
  }, []);

  return (
    <section ref={sectionRef} className="section about" id="about">
      <div className="section__header" data-reveal>
        <span className="section__kicker">About</span>
        <h2 className="section__title">The Person Behind the Pixels</h2>
      </div>

      <div className="about__content">
        <p className="about__paragraph" data-reveal>
          I&rsquo;m Sree, a creative developer who builds at the intersection of
          engineering and motion — where a scroll feels directed, a camera
          feels intentional, and an interface feels like it was crafted, not
          assembled.
        </p>
        <p className="about__paragraph" data-reveal>
          My work leans on real-time 3D, careful pacing, and restraint: less
          noise, more presence. Every project starts as a story before it
          becomes a site.
        </p>

        <dl className="about__stats">
          {stats.map((stat) => (
            <div className="about__stat" key={stat.label} data-reveal>
              <dt>{stat.label}</dt>
              <dd>{stat.value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
