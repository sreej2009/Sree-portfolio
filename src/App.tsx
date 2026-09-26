import ScrollController from "@/animations/ScrollController";
import Canvas3D from "@/components/Canvas3D";
import Nav from "@/components/Nav";
import Intro from "@/sections/Intro";
import Services from "@/sections/Services";
import Skills from "@/sections/Skills";
import Work from "@/sections/Work";
import About from "@/sections/About";
import Contact from "@/sections/Contact";

export default function App() {
  return (
    <ScrollController>
      <Canvas3D />
      <Nav />
      <main className="content">
        <Intro />
        <Services />
        <Skills />
        <Work />
        <About />
        <Contact />
      </main>
    </ScrollController>
  );
}
