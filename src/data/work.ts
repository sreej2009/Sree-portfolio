export interface WorkItem {
  id: string;
  index: string;
  title: string;
  category: string;
  year: string;
}

export const workItems: WorkItem[] = [
  {
    id: "project-one",
    index: "01",
    title: "Aurora — Immersive Product Site",
    category: "3D Web Experience",
    year: "2025",
  },
  {
    id: "project-two",
    index: "02",
    title: "Monolith — Studio Portfolio",
    category: "Creative Direction & Dev",
    year: "2024",
  },
  {
    id: "project-three",
    index: "03",
    title: "Halcyon — Scroll Narrative",
    category: "WebGL & Motion",
    year: "2024",
  },
  {
    id: "project-four",
    index: "04",
    title: "Verge — Brand Configurator",
    category: "Real-Time 3D",
    year: "2023",
  },
];
