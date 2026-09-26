export interface Service {
  id: string;
  index: string;
  title: string;
  description: string;
}

export const services: Service[] = [
  {
    id: "web-experiences",
    index: "01",
    title: "Interactive Web Experiences",
    description:
      "Cinematic, scroll-driven websites that blend real-time 3D with motion design — built to feel like a film, not a template.",
  },
  {
    id: "3d-development",
    index: "02",
    title: "Real-Time 3D Development",
    description:
      "Three.js and WebGL builds for brand sites, product configurators, and immersive storytelling, tuned for performance across devices.",
  },
  {
    id: "motion-design",
    index: "03",
    title: "Motion & Interaction Design",
    description:
      "GSAP-driven micro-interactions and scroll choreography that give every pixel intent — nothing moves without a reason.",
  },
  {
    id: "creative-dev",
    index: "04",
    title: "Creative Front-End Engineering",
    description:
      "Pixel-accurate, type-safe front ends that translate ambitious creative direction into production-ready, maintainable code.",
  },
];
