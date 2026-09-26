import { useEffect, useRef, useState } from "react";
import { LinearFilter, RGBAFormat, SRGBColorSpace, VideoTexture } from "three";

export type RiderVideoStatus = "loading" | "ready" | "error";

export interface RiderVideoState {
  status: RiderVideoStatus;
  texture: VideoTexture | null;
  aspect: number;
  /** The raw element, paused, so callers can scrub it via `currentTime`. */
  video: HTMLVideoElement | null;
  /** Finite clip duration once known, otherwise null. */
  duration: number | null;
}

const RIDER_VIDEO_SRC = `${import.meta.env.BASE_URL}assets/avatar/rider.webm`;
const LOAD_TIMEOUT_MS = 8000;
const DEFAULT_ASPECT = 9 / 16;

function canPlayTransparentWebm(video: HTMLVideoElement) {
  return (
    video.canPlayType('video/webm; codecs="vp9"') !== "" ||
    video.canPlayType('video/webm; codecs="vp8"') !== ""
  );
}

/**
 * Loads public/assets/avatar/rider.webm (VP8/VP9 WebM with alpha) as a
 * THREE.VideoTexture that the caller scrubs manually via `video.currentTime`
 * -- this hook never leaves the video playing.
 *
 * The video is primed with a single muted play()+pause() cycle (required by
 * some browsers before a paused video's frame can be uploaded to WebGL),
 * then immediately reset to frame 0 and left paused. Nothing here loops or
 * autoplays after that -- Rider.tsx drives `currentTime` frame-by-frame from
 * scroll progress. Confirmed empirically (not just assumed): three.js's
 * VideoTexture uses `requestVideoFrameCallback` to re-upload a frame, and
 * that callback fires correctly on manual seeks of a paused video too, so
 * this scrub approach works without ever calling play() again.
 *
 * Safari/iOS cannot decode WebM at all, so this resolves to `status:
 * "error"` there by design -- Rider.tsx falls back to the placeholder
 * silhouette rather than breaking the page. The same fallback covers the
 * "no file yet" case during development.
 *
 * Dropping the final asset in at that exact path is the only step needed
 * to go from placeholder to real video -- this hook and Rider.tsx don't
 * change.
 */
export function useRiderVideoTexture(): RiderVideoState {
  const [state, setState] = useState<RiderVideoState>({
    status: "loading",
    texture: null,
    aspect: DEFAULT_ASPECT,
    video: null,
    duration: null,
  });
  const textureRef = useRef<VideoTexture | null>(null);

  useEffect(() => {
    let settled = false;
    let timeoutId: number | undefined;
    const video = document.createElement("video");

    video.muted = true;
    video.defaultMuted = true;
    video.loop = false;
    video.playsInline = true;
    video.setAttribute("webkit-playsinline", "true");
    video.preload = "auto";
    // Kept attached to the DOM (off-screen, non-interactive) -- some
    // browsers are unreliable about video decode/texture updates for an
    // element that's never connected.
    video.style.position = "fixed";
    video.style.width = "1px";
    video.style.height = "1px";
    video.style.opacity = "0";
    video.style.pointerEvents = "none";
    video.setAttribute("aria-hidden", "true");
    video.tabIndex = -1;

    const cleanupVideo = () => {
      video.removeEventListener("error", fail);
      video.removeEventListener("loadeddata", handleLoaded);
      window.clearTimeout(timeoutId);
      video.pause();
      video.removeAttribute("src");
      video.load();
      if (video.parentNode) video.parentNode.removeChild(video);
    };

    function fail() {
      if (settled) return;
      settled = true;
      cleanupVideo();
      setState({ status: "error", texture: null, aspect: DEFAULT_ASPECT, video: null, duration: null });
    }

    function handleLoaded() {
      if (settled) return;
      // Prime the decoder with a real play()+pause() cycle -- some browsers
      // won't upload a video frame to WebGL until playback has started at
      // least once -- then hand control over to scroll-driven scrubbing.
      video
        .play()
        .then(() => {
          if (settled) return;
          video.pause();
          video.currentTime = 0;
          settled = true;
          window.clearTimeout(timeoutId);

          const texture = new VideoTexture(video);
          texture.colorSpace = SRGBColorSpace;
          texture.format = RGBAFormat;
          texture.minFilter = LinearFilter;
          texture.magFilter = LinearFilter;
          texture.generateMipmaps = false;
          textureRef.current = texture;

          const aspect =
            video.videoWidth > 0 && video.videoHeight > 0
              ? video.videoWidth / video.videoHeight
              : DEFAULT_ASPECT;
          const duration = Number.isFinite(video.duration) ? video.duration : null;
          setState({ status: "ready", texture, aspect, video, duration });
        })
        .catch(fail);
    }

    // Bail before issuing any network request if the browser can't
    // possibly decode this container/codec (e.g. Safari/iOS).
    if (!canPlayTransparentWebm(video)) {
      fail();
      return () => {
        settled = true;
      };
    }

    video.addEventListener("error", fail);
    video.addEventListener("loadeddata", handleLoaded);
    document.body.appendChild(video);
    video.src = RIDER_VIDEO_SRC;
    video.load();
    timeoutId = window.setTimeout(fail, LOAD_TIMEOUT_MS);

    return () => {
      settled = true;
      cleanupVideo();
      if (textureRef.current) {
        textureRef.current.dispose();
        textureRef.current = null;
      }
    };
  }, []);

  return state;
}
