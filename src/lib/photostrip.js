// Photo strips: up to four frames stacked on one white strip, like the booth at the mall.
// A strip is { id, frames: [{ imageId }], filter, at }. Frames are saved pictures of their own
// (so they stay crisp at any size); the single composited strip image is only made on demand.
import { uid } from "../utils/uid";
import { loadImage } from "./data";

export const FRAMES = 4;
const W = 360, H = 270, P = 20, FOOT = 44; // a frame, the white border around it, room for the date
const stamp = (at) => new Date(at).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });

export const newStrip = (imageIds, filter = "none", at = Date.now()) => ({
  id: uid(),
  frames: imageIds.map((imageId) => ({ imageId })),
  filter,
  at,
});

// Pasted or dropped pictures become strips of four; the last strip may be shorter
export const stripsFrom = (imageIds, filter) => {
  const out = [];
  for (let i = 0; i < imageIds.length; i += FRAMES) out.push(newStrip(imageIds.slice(i, i + FRAMES), filter));
  return out;
};

export const withStrips = (state, strips) => ({ ...state, strips: [...strips, ...(state.strips ?? [])] });

// Centre-crops any drawable (canvas, video, image) to the box, like a lens would
function drawCover(ctx, src, x, y, w, h) {
  const sw0 = src.videoWidth || src.naturalWidth || src.width;
  const sh0 = src.videoHeight || src.naturalHeight || src.height;
  let sw = sw0;
  let sh = sw0 / (w / h);
  if (sh > sh0) {
    sh = sh0;
    sw = sh0 * (w / h);
  }
  ctx.drawImage(src, (sw0 - sw) / 2, (sh0 - sh) / 2, sw, sh, x, y, w, h);
}

// One tall canvas: white strip, frames down the middle, the date written at the foot
export function composeStrip(sources, at) {
  const c = document.createElement("canvas");
  c.width = W + P * 2;
  c.height = P + sources.length * (H + P) + FOOT;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, c.width, c.height);
  sources.forEach((s, i) => drawCover(ctx, s, P, P + i * (H + P), W, H));
  ctx.fillStyle = "#8a8280";
  ctx.font = "13px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(stamp(at), c.width / 2, c.height - 16);
  return c;
}

const toImage = (src) =>
  new Promise((ok, no) => {
    const img = new Image();
    img.onload = () => ok(img);
    img.onerror = no;
    img.src = src;
  });

// A saved strip as one JPEG blob
export async function stripBlob(uid, strip) {
  const imgs = await Promise.all(strip.frames.map(async (f) => toImage(await loadImage(uid, f.imageId))));
  const c = composeStrip(imgs, strip.at);
  return new Promise((r) => c.toBlob(r, "image/jpeg", 0.9));
}
