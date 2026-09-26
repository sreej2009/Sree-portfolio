export interface SkillGroup {
  id: string;
  category: string;
  items: string[];
}

export const skillGroups: SkillGroup[] = [
  {
    id: "languages",
    category: "Languages",
    items: ["TypeScript", "JavaScript (ES2023)", "GLSL", "HTML5", "CSS3"],
  },
  {
    id: "frameworks",
    category: "Frameworks & Libraries",
    items: ["React", "Three.js", "React Three Fiber", "Drei", "Next.js"],
  },
  {
    id: "motion",
    category: "Motion & Animation",
    items: ["GSAP", "ScrollTrigger", "Lenis", "Framer Motion"],
  },
  {
    id: "tooling",
    category: "Tooling & Workflow",
    items: ["Vite", "Git", "Figma", "Blender (basics)", "Performance Profiling"],
  },
];
