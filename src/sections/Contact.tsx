import { useEffect, useRef } from "react";
import { createRevealContext } from "@/animations/sectionReveal";

const socials = [
  { label: "Email", href: "mailto:hello@sree.dev" },
  { label: "LinkedIn", href: "#" },
  { label: "GitHub", href: "#" },
  { label: "Instagram", href: "#" },
];

export default function Contact() {
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!sectionRef.current) return;
    const ctx = createRevealContext(sectionRef.current);
    return () => ctx.revert();
  }, []);

  return (
    <section ref={sectionRef} className="section contact" id="contact">
      <div className="section__header" data-reveal>
        <span className="section__kicker">Contact</span>
        <h2 className="section__title">Let&rsquo;s Build Something Cinematic</h2>
      </div>

      <p className="contact__lead" data-reveal>
        Have a project in mind? I&rsquo;m always open to conversations about
        ambitious, well-crafted web experiences.
      </p>

      <a className="contact__cta" href="mailto:hello@sree.dev" data-reveal>
        hello@sree.dev
      </a>

      <ul className="contact__socials" data-reveal>
        {socials.map((social) => (
          <li key={social.label}>
            <a href={social.href}>{social.label}</a>
          </li>
        ))}
      </ul>

      <footer className="contact__footer" data-reveal>
        <span>&copy; {new Date().getFullYear()} Sree. All rights reserved.</span>
      </footer>
    </section>
  );
}
