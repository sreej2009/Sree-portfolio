import CameraRig from "./CameraRig";
import Environment from "./Environment";
import Particles from "./Particles";
import Rider from "./Rider";

/**
 * All persistent 3D content. Rendered once inside the single app-wide
 * <Canvas> (see components/Canvas3D) and never unmounted as HTML sections
 * scroll over/around it.
 */
export default function Scene() {
  return (
    <>
      <CameraRig />
      <Environment />
      <Particles />
      <Rider />
    </>
  );
}
