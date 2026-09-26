import { useEffect, useRef } from "react";
import { createRevealContext } from "@/animations/sectionReveal";
import { services } from "@/data/services";

export default function Services() {
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!sectionRef.current) return;
    const ctx = createRevealContext(sectionRef.current);
    return () => ctx.revert();
  }, []);

  return (
    <section ref={sectionRef} className="section services" id="services">
      <div className="section__header" data-reveal>
        <span className="section__kicker">Services</span>
        <h2 className="section__title">What I Bring to the Table</h2>
      </div>

      <ul className="services__list">
        {services.map((service) => (
          <li className="services__item" key={service.id} data-reveal>
            <span className="services__index">{service.index}</span>
            <div className="services__body">
              <h3 className="services__title">{service.title}</h3>
              <p className="services__description">{service.description}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
