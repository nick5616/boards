// The time-lapse engine: a camera that grabs one small picture every so often,
// plus a flipbook player and a movie-maker. Nothing here is a React thing, so
// the plant and art modules can borrow it. Frames are ~640px JPEGs on this
// computer's shelf (lib/localMedia); the caller keeps only their ids.
//
// A capture lives here at module level, not in a card, so it carries on while
// you wander to other boards (the live dock shows it and can stop it).
import { put, getBlob } from "./localMedia";

export const FRAME_MAX = 640; // longest side of a kept frame, px
export const MAX_FRAMES = 600; // a shelf-friendly ceiling (~25 MB)

// Interval and duration choices, in seconds / minutes
export const EVERY = [30, 60, 120, 300, 600, 1200, 1800];
export const FOR_MINS = [30, 60, 120, 240, 480, 720];
export const everyLabel = (s) => (s < 60 ? `${s}s` : `${s / 60}m`);
export const forLabel = (m) => (m < 60 ? `${m}m` : `${m / 60}h`);

// A <video> element's current picture, shrunk to a JPEG blob
export function grabFrame(video, max = FRAME_MAX, quality = 0.78) {
  const vw = video.videoWidth || 640;
  const vh = video.videoHeight || 480;
  const s = Math.min(1, max / Math.max(vw, vh));
  const c = document.createElement("canvas");
  c.width = Math.round(vw * s);
  c.height = Math.round(vh * s);
  c.getContext("2d").drawImage(video, 0, 0, c.width, c.height);
  return new Promise((r) => c.toBlob(r, "image/jpeg", quality));
}

// ── Captures in progress ────────────────────────────────────────────────────
// key (usually the module id) → { stream, video, timer, count, startedAt, endsAt, nextAt, ... }
const runs = new Map();
const listeners = new Set();
let version = 0;
const bump = () => {
  version++;
  listeners.forEach((l) => l());
};
export const subscribe = (l) => (listeners.add(l), () => listeners.delete(l));
export const snapshot = () => version; // for useSyncExternalStore
export const isCapturing = (key) => runs.has(key);
export const captureInfo = (key) => {
  const r = runs.get(key);
  return r && { count: r.count, startedAt: r.startedAt, endsAt: r.endsAt, nextAt: r.nextAt, every: r.every, error: r.error };
};

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// Friendly words for a camera that won't come on
export const cameraTrouble = (e) =>
  e?.name === "NotAllowedError" || e?.name === "SecurityError"
    ? "The camera is turned off for this page. Allow it in the address bar, then try again."
    : e?.name === "NotFoundError" || e?.name === "OverconstrainedError"
      ? "No camera found. Plug one in and try again."
      : "The camera is busy or won't start. Close whatever else is using it and try again.";

// Starts a capture: one frame now, then one every `every` seconds for `mins` minutes.
//   onFrame({ id, at })  - a frame was kept on the shelf
//   onEnd(why)           - finished ("done"), stopped ("stopped") or broke ("lost")
// Resolves { ok: true } or { ok: false, why } (the camera wouldn't come on).
export async function startCapture({ key, deviceId, every, mins, boardId, modId, onFrame, onEnd }) {
  stopCapture(key, "stopped");
  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: deviceId ? { deviceId: { exact: deviceId } } : { width: { ideal: 1280 } },
      audio: false,
    });
  } catch (e) {
    return { ok: false, why: cameraTrouble(e) };
  }
  // The camera needs a <video> to read pictures from; it never goes on the page
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.srcObject = stream;
  try {
    await video.play();
  } catch {
    /* some browsers only start once frames arrive; the wait below covers it */
  }
  for (let i = 0; i < 40 && !video.videoWidth; i++) await wait(100);
  const now = Date.now();
  const r = { stream, video, timer: null, count: 0, startedAt: now, endsAt: now + mins * 60000, nextAt: now, every, onEnd, error: null };
  runs.set(key, r);

  const snap = async () => {
    if (runs.get(key) !== r) return;
    // Let the exposure settle on the very first frame
    if (r.count === 0) await wait(600);
    try {
      const blob = await grabFrame(video);
      const id = blob && (await put(blob, { boardId, modId, meta: { timelapse: true } }));
      if (!id) throw new Error("shelf full");
      r.count++;
      onFrame?.({ id, at: Date.now() });
    } catch {
      r.error = "couldn't keep a frame on this computer";
    }
    r.nextAt = Date.now() + every * 1000;
    bump();
  };
  // The camera being unplugged or taken by another app ends it kindly
  stream.getVideoTracks()[0]?.addEventListener("ended", () => stopCapture(key, "lost"));

  const tick = async () => {
    if (runs.get(key) !== r) return;
    await snap();
    if (runs.get(key) !== r) return;
    if (Date.now() + every * 1000 > r.endsAt || r.count >= MAX_FRAMES) return stopCapture(key, "done");
    r.timer = setTimeout(tick, Math.max(0, r.nextAt - Date.now()));
  };
  bump();
  tick();
  return { ok: true };
}

export function stopCapture(key, why = "stopped") {
  const r = runs.get(key);
  if (!r) return;
  runs.delete(key);
  clearTimeout(r.timer);
  r.stream.getTracks().forEach((t) => t.stop());
  r.video.srcObject = null;
  bump();
  r.onEnd?.(why);
}

// The cameras plugged in (names only appear once permission has been given)
export async function listCameras() {
  try {
    return (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === "videoinput");
  } catch {
    return [];
  }
}

// ── Playback & export ───────────────────────────────────────────────────────
// Frames as bitmaps, loaded off the shelf a few at a time (missing ones come back null)
export async function loadBitmaps(ids, onProgress) {
  const out = new Array(ids.length).fill(null);
  let done = 0;
  const lane = async (start) => {
    for (let i = start; i < ids.length; i += 4) {
      try {
        const blob = await getBlob(ids[i]);
        out[i] = blob ? await createImageBitmap(blob) : null;
      } catch {
        out[i] = null;
      }
      onProgress?.(++done / ids.length);
    }
  };
  await Promise.all([0, 1, 2, 3].map(lane));
  return out;
}

// Paints a frame onto a canvas, covering it (the frames are all one shape)
export function paintFrame(ctx, bmp, w, h) {
  const s = Math.max(w / bmp.width, h / bmp.height);
  const dw = bmp.width * s;
  const dh = bmp.height * s;
  ctx.drawImage(bmp, (w - dw) / 2, (h - dh) / 2, dw, dh);
}

export const canMakeMovie = () => typeof MediaRecorder !== "undefined" && !!HTMLCanvasElement.prototype.captureStream;

// Plays the frames into a canvas at `fps` and records it as a webm. It takes as long as
// the movie lasts (the recorder runs in real time). `after(ctx, w, h, i)` can draw on top
// of each frame (the rise line, a date stamp). Resolves a Blob, or null if cancelled.
export async function makeMovie(bitmaps, { fps = 8, after, onProgress, signal } = {}) {
  const frames = bitmaps.filter(Boolean);
  if (!frames.length || !canMakeMovie()) return null;
  const w = frames[0].width;
  const h = frames[0].height;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  const draw = (i) => {
    paintFrame(ctx, frames[i], w, h);
    after?.(ctx, w, h, i);
  };
  draw(0);
  const stream = c.captureStream(fps);
  const mime = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"].find((m) => MediaRecorder.isTypeSupported(m));
  const rec = new MediaRecorder(stream, mime ? { mimeType: mime, videoBitsPerSecond: 2_500_000 } : undefined);
  const chunks = [];
  rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  const finished = new Promise((r) => (rec.onstop = r));
  rec.start();
  for (let i = 0; i < frames.length; i++) {
    if (signal?.cancelled) break;
    draw(i);
    onProgress?.((i + 1) / frames.length);
    await wait(1000 / fps);
  }
  await wait(1000 / fps); // hold the last frame so it isn't cut off
  rec.stop();
  await finished;
  stream.getTracks().forEach((t) => t.stop());
  return signal?.cancelled ? null : new Blob(chunks, { type: "video/webm" });
}
