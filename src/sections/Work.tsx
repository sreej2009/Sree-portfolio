import { useEffect, useRef } from "react";
import { createRevealContext } from "@/animations/sectionReveal";
import { workItems } from "@/data/work";

export default function Work() {
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!sectionRef.current) return;
    const ctx = createRevealContext(sectionRef.current);
    return () => ctx.revert();
  }, []);

  return (
    <section ref={sectionRef} className="section work" id="work">
      <div className="section__header" data-reveal>
        <span className="section__kicker">Selected Work</span>
        <h2 className="section__title">A Few Recent Studies</h2>
      </div>

      <ul className="work__list">
        {workItems.map((item) => (
          <li className="work__item" key={item.id} data-reveal>
            <span className="work__index">{item.index}</span>
            <div className="work__frame" />
            <div className="work__meta">
              <h3 className="work__title">{item.title}</h3>
              <span className="work__category">
                {item.category} &middot; {item.year}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
