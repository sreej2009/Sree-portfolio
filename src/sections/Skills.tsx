import { useEffect, useRef } from "react";
import { createRevealContext } from "@/animations/sectionReveal";
import { skillGroups } from "@/data/skills";

export default function Skills() {
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!sectionRef.current) return;
    const ctx = createRevealContext(sectionRef.current);
    return () => ctx.revert();
  }, []);

  return (
    <section ref={sectionRef} className="section skills" id="skills">
      <div className="section__header" data-reveal>
        <span className="section__kicker">Skills</span>
        <h2 className="section__title">Tools of the Craft</h2>
      </div>

      <div className="skills__grid">
        {skillGroups.map((group) => (
          <div className="skills__group" key={group.id} data-reveal>
            <h3 className="skills__category">{group.category}</h3>
            <ul className="skills__items">
              {group.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
