#!/usr/bin/env node
/**
 * Extracts a scroll-scrubbable WebP frame sequence from
 * public/assets/avatar/rider.webm.
 *
 * WHY NOT ffmpeg: this project's rider clip encodes alpha using the WebM
 * "AlphaMode" side-channel (a separate coded picture referenced via a
 * BlockAdditional element) -- a Chrome-specific extension that ffmpeg's
 * Matroska/VP9 demuxer does not decode. Verified directly: ffmpeg reports
 * the input stream as plain `yuv420p` (no alpha plane at all) despite
 * carrying the container's `alpha_mode: 1` tag as inert metadata, and every
 * WebP ffmpeg produced from it (lossy AND lossless, `yuva420p` forced or
 * not) came back fully opaque when alpha-sampled in a real browser. Chrome's
 * own media pipeline decodes this alpha correctly (already relied on by the
 * live <video> + VideoTexture path), so this script drives a real headless
 * Chromium instance to seek the source video and read frames off a 2D
 * canvas -- which reliably composites the true per-pixel alpha, and can
 * still write standard alpha WebP output via canvas.toBlob.
 *
 * Usage: npm run frames:extract
 * (re-run any time public/assets/avatar/rider.webm changes)
 */
import { createServer } from "node:http";
import { mkdir, writeFile, rm } from "node:fs/promises";
import { existsSync, statSync, createReadStream } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const SOURCE_VIDEO = path.join(ROOT, "public/assets/avatar/rider.webm");
const OUTPUT_DIR = path.join(ROOT, "public/assets/avatar/rider-frames");
const SERVER_PORT = 5899;

// 24fps: matches the source clip, and the task's own "evaluate 24-30fps"
// guidance -- this is a short intro, so smoothness matters more than
// squeezing the frame count down further.
const FPS = 24;

// Two resolutions: desktop and a smaller mobile one, per the "don't
// sacrifice desktop, but use a smaller resolution on mobile" requirement.
// Desktop is 512px wide -- the original 320px was visibly soft once the
// rider scales up large during the SREE reveal; 512 (vs. the 720x1280
// source) still keeps the whole sequence a reasonable size while giving
// enough detail at that larger on-screen size. Quality trimmed slightly
// from the 320px version's 0.82 to keep per-frame size in check at the
// larger resolution.
const VARIANTS = [
  { name: "desktop", width: 512, quality: 0.78 },
  { name: "mobile", width: 200, quality: 0.74 },
];

function mimeFor(filePath) {
  if (filePath.endsWith(".webm")) return "video/webm";
  if (filePath.endsWith(".html")) return "text/html";
  return "application/octet-stream";
}

/**
 * A static server that supports HTTP Range requests (206 Partial Content).
 *
 * THIS IS THE ACTUAL FIX for a bug that made every extracted frame
 * identical: a WebM's seek index ("Cues") is typically stored near the END
 * of the file, and Chrome needs to jump ahead and fetch it via a Range
 * request before it can report a real `seekable` range. A plain 200-only
 * static server (the previous version of this function) can't serve that
 * jump-ahead read, so Chrome was left with `video.seekable == [0, 0]` --
 * every `currentTime = t` assignment silently clamped back to 0, so every
 * "frame" this script captured was actually frame 0, just saved under 241
 * different filenames. Verified directly: without Range support,
 * `currentTime` reads back as exactly 0 after every seek attempt; with it,
 * seeks land at the requested time. The live app itself was never affected
 * by this -- Vite's dev server (and any real static host) already supports
 * Range requests -- this was purely a gap in this extraction tool's own
 * throwaway server.
 */
async function serveStatic(rootDir, port) {
  const server = createServer((req, res) => {
    const filePath = path.join(rootDir, decodeURIComponent((req.url || "/").split("?")[0]));
    let stat;
    try {
      stat = statSync(filePath);
      if (!stat.isFile()) throw new Error("not a file");
    } catch {
      res.writeHead(404);
      res.end();
      return;
    }

    const contentType = mimeFor(filePath);
    const range = req.headers.range;
    if (!range) {
      res.writeHead(200, {
        "Content-Type": contentType,
        "Content-Length": stat.size,
        "Accept-Ranges": "bytes",
      });
      createReadStream(filePath).pipe(res);
      return;
    }

    const match = /bytes=(\d*)-(\d*)/.exec(range);
    const start = match[1] ? parseInt(match[1], 10) : 0;
    const end = match[2] ? parseInt(match[2], 10) : stat.size - 1;
    const chunkEnd = Math.min(end, stat.size - 1);

    res.writeHead(206, {
      "Content-Type": contentType,
      "Content-Length": chunkEnd - start + 1,
      "Content-Range": `bytes ${start}-${chunkEnd}/${stat.size}`,
      "Accept-Ranges": "bytes",
    });
    createReadStream(filePath, { start, end: chunkEnd }).pipe(res);
  });
  await new Promise((resolve) => server.listen(port, resolve));
  return server;
}

async function main() {
  if (!existsSync(SOURCE_VIDEO)) {
    console.error(`No source video at ${SOURCE_VIDEO} -- nothing to extract.`);
    process.exit(1);
  }

  console.log("Starting local static server for", path.join(ROOT, "public"));
  const server = await serveStatic(path.join(ROOT, "public"), SERVER_PORT);

  const browser = await chromium.launch({ args: ["--no-sandbox"] });
  const page = await browser.newPage();

  try {
    // Establish the right origin first (so the video's relative `src`
    // resolves), then replace the document -- same pattern used
    // throughout this project's own manual browser tests.
    await page.goto(`http://localhost:${SERVER_PORT}/`, { waitUntil: "load" }).catch(() => {});
    await page.setContent(
      `<!doctype html><html><body style="margin:0">
        <video id="v" src="/assets/avatar/rider.webm" muted playsinline></video>
      </body></html>`,
      { waitUntil: "load" }
    );

    const meta = await page.evaluate(
      () =>
        new Promise((resolve, reject) => {
          const v = document.getElementById("v");
          // Guard against the event having already fired before this
          // listener attaches (page.setContent's "load" wait can already
          // be enough time for a small video to finish loading) -- without
          // this check the promise never settles.
          if (v.readyState >= 2) {
            resolve({ duration: v.duration, width: v.videoWidth, height: v.videoHeight });
            return;
          }
          v.addEventListener(
            "loadeddata",
            () => resolve({ duration: v.duration, width: v.videoWidth, height: v.videoHeight }),
            { once: true }
          );
          v.addEventListener("error", () => reject(new Error("source video failed to load")), {
            once: true,
          });
        })
    );
    console.log(`Source video: ${meta.width}x${meta.height}, duration=${meta.duration.toFixed(3)}s`);

    // Chrome needs to fetch the WebM's seek index ("Cues", typically near
    // the end of the file) via a Range request before it reports a full
    // `seekable` range -- give it a moment to do that now that the server
    // actually supports Range requests, rather than finding out mid-loop.
    const seekableEnd = await page.evaluate(
      () =>
        new Promise((resolve) => {
          const v = document.getElementById("v");
          const deadline = Date.now() + 5000;
          function check() {
            const end = v.seekable.length > 0 ? v.seekable.end(v.seekable.length - 1) : 0;
            if (end >= v.duration - 1 || Date.now() > deadline) {
              resolve(end);
            } else {
              setTimeout(check, 100);
            }
          }
          check();
        })
    );
    console.log(`Seekable range ready up to ${seekableEnd.toFixed(3)}s`);
    if (seekableEnd < meta.duration - 1) {
      throw new Error(
        `Video never became fully seekable (seekable end=${seekableEnd.toFixed(2)}s, duration=${meta.duration.toFixed(
          2
        )}s). Aborting -- extracting now would silently produce duplicate frames.`
      );
    }

    const frameCount = Math.max(2, Math.round(meta.duration * FPS));
    const aspect = meta.width / meta.height;
    const dims = VARIANTS.map((v) => ({
      ...v,
      height: Math.round(v.width / aspect / 2) * 2,
    }));
    console.log(
      `Extracting ${frameCount} frames @ ${FPS}fps for: ` +
        dims.map((d) => `${d.name} (${d.width}x${d.height})`).join(", ")
    );

    for (const d of dims) {
      const dir = path.join(OUTPUT_DIR, d.name);
      await rm(dir, { recursive: true, force: true });
      await mkdir(dir, { recursive: true });
    }

    let written = 0;
    await page.exposeFunction("__saveFrame", async (variantName, frameIndex, base64) => {
      const buffer = Buffer.from(base64, "base64");
      const filename = `frame-${String(frameIndex + 1).padStart(4, "0")}.webp`;
      await writeFile(path.join(OUTPUT_DIR, variantName, filename), buffer);
      written++;
    });
    await page.exposeFunction("__reportProgress", (i) => {
      if (i % 20 === 0 || i === frameCount - 1) {
        console.log(`  frame ${i + 1}/${frameCount}`);
      }
    });

    await page.evaluate(
      async ({ frameCount, duration, dims }) => {
        function bufferToBase64(buf) {
          const bytes = new Uint8Array(buf);
          let binary = "";
          const chunk = 0x8000;
          for (let i = 0; i < bytes.length; i += chunk) {
            binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
          }
          return btoa(binary);
        }

        const v = document.getElementById("v");

        // Fail loudly and immediately if the video isn't actually
        // seekable across its full length -- silently proceeding here is
        // exactly what produced 241 duplicate frames last time (every
        // seek clamped back to 0 with no visible error).
        const seekableEnd = v.seekable.length > 0 ? v.seekable.end(v.seekable.length - 1) : 0;
        if (seekableEnd < duration - 1) {
          throw new Error(
            `Video is not fully seekable before extraction starts (seekable end=${seekableEnd.toFixed(
              2
            )}s, duration=${duration.toFixed(2)}s). Refusing to extract -- this would silently ` +
              `produce duplicate frames.`
          );
        }

        for (let i = 0; i < frameCount; i++) {
          const t = frameCount > 1 ? Math.min(duration - 0.02, (i / (frameCount - 1)) * duration) : 0;
          await new Promise((resolve) => {
            const onSeeked = () => {
              v.removeEventListener("seeked", onSeeked);
              resolve();
            };
            v.addEventListener("seeked", onSeeked);
            v.currentTime = t;
          });

          // Verify the seek actually landed near the requested time --
          // catches any regression of the "silently clamped to 0" bug
          // instead of writing 241 copies of the same frame again.
          if (Math.abs(v.currentTime - t) > 0.5) {
            throw new Error(
              `Seek to ${t.toFixed(2)}s did not take effect (currentTime is ${v.currentTime.toFixed(
                2
              )}s after 'seeked' fired) at frame index ${i}. Aborting instead of writing a wrong frame.`
            );
          }

          for (const d of dims) {
            const canvas = document.createElement("canvas");
            canvas.width = d.width;
            canvas.height = d.height;
            const ctx = canvas.getContext("2d", { alpha: true });
            ctx.clearRect(0, 0, d.width, d.height);
            ctx.drawImage(v, 0, 0, d.width, d.height);
            const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/webp", d.quality));
            const buf = await blob.arrayBuffer();
            // eslint-disable-next-line no-undef
            await window.__saveFrame(d.name, i, bufferToBase64(buf));
          }
          // eslint-disable-next-line no-undef
          window.__reportProgress(i);
        }
      },
      { frameCount, duration: meta.duration, dims }
    );

    const manifest = {
      count: frameCount,
      fps: FPS,
      variants: Object.fromEntries(dims.map((d) => [d.name, { width: d.width, height: d.height }])),
    };
    await writeFile(path.join(OUTPUT_DIR, "manifest.json"), JSON.stringify(manifest, null, 2));
    console.log(`Wrote ${written} frame files and manifest.json:`, manifest);
  } finally {
    await browser.close();
    server.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
