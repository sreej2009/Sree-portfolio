# Rider asset pipeline

Two ways the rider gets rendered, in priority order:

1. **Frame sequence** (primary) -- `rider-frames/desktop/` and
   `rider-frames/mobile/`, plus `rider-frames/manifest.json`. Scroll maps
   directly to a frame index; no video decoder involved. Generated from
   `rider.webm` below -- see `scripts/extract-rider-frames.mjs` at the repo
   root, run via `npm run frames:extract`.
2. **WebM video** (fallback) -- `rider.webm`, scroll-scrubbed via
   `currentTime`. Used automatically if the frame sequence is missing or
   fails to load. Kept fully isolated in `src/three/useRiderVideoTexture.ts`
   so it can be deleted later without touching anything else.

If neither loads, `src/three/Rider.tsx` shows the placeholder silhouette.

## Updating the rider clip

1. Replace `public/assets/avatar/rider.webm` with the new clip (WebM,
   VP8/VP9, real alpha channel -- background removed, not a green/black
   matte).
2. Run `npm run frames:extract` to regenerate the frame sequence from it.
3. Nothing in `src/three/` needs to change either way.

## Why frames instead of just scrubbing the WebM

Two independent problems with WebM `currentTime` scrubbing, found and
confirmed while building this:

- **ffmpeg can't extract this clip's alpha at all.** This project's alpha
  technique is a WebM "AlphaMode" side-channel (a separate coded picture
  referenced via a BlockAdditional element) -- a Chrome-specific extension.
  ffmpeg's demuxer only exposes the plain color stream (`yuv420p`, no alpha
  plane) for it; every frame ffmpeg produced from it, lossy or lossless,
  came back fully opaque when alpha-sampled in a real browser. That's why
  `scripts/extract-rider-frames.mjs` drives an actual headless Chromium
  instance instead -- Chrome's own media pipeline decodes this alpha
  correctly, and a 2D canvas `drawImage` from the `<video>` element
  composites it properly, unlike ffmpeg.
- **Even with alpha handled, VP9 seeking has real decoder latency.**
  Scroll-driven `currentTime` assignments -- even smoothed and throttled --
  can't fully hide the browser abandoning one in-flight seek for the next.
  A preloaded, already-decoded image swapped onto a canvas has none of that
  latency: it's a synchronous draw, not a seek-and-wait.

The WebM path is kept as a fallback (e.g. if someone ships a new
`rider.webm` without re-running the extraction script), not because it's
equally good.

## Format notes

- Frames are WebP with alpha, extracted at 24fps in two resolutions
  (desktop-width ~320px, mobile-width ~200px -- see `manifest.json`), which
  keeps the whole sequence to a few MB. `src/three/useRiderFrameSequence.ts`
  loads the first needed frame before going "ready" (no flash/blank
  frame), then preloads the rest in the background, nearest-to-current-
  scroll-position first.
- Safari/iOS can't decode the `rider.webm` fallback at all (no WebM
  support), but that only matters if the frame sequence is also missing --
  normally Safari/iOS use the frame sequence like everyone else, since
  WebP-with-alpha `<img>` decoding is universally supported.
