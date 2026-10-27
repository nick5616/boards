// The flipbook's pages. Each frame is a 256 x 192 picture where every pixel is paper (0) or
// one of three inks (1 black, 2 red, 3 blue), kept in the module's state as a short string:
// runs of one colour, run-length coded, then base64. A line doodle comes to a KB or two, a
// blank frame to a few bytes, so a whole flipbook fits in the board's database copy.
//
// A run is one byte, ink in the top 2 bits and the length (1-63) below; a longer run has 0
// there and its length follows as a varint (7 bits a byte, high bit = more to come).

export const W = 256;
export const H = 192;
export const INKS = ["", "#1d1b1a", "#e0352b", "#2c5fd8"]; // 0 is paper
export const PAPER = "#fbfaf4";
export const MAX_FRAMES = 99;
export const MAX_CHARS = 200_000; // what the whole book may take in the database
// Flipnote-ish speeds 1-8, in frames per second
export const SPEEDS = [0.5, 1, 2, 4, 6, 12, 20, 30];
export const PENS = [1, 2, 4]; // pen widths; the eraser is three times as wide

// Doodle chat: a note is a strip as wide as a frame, kept with the latest few on the module
export const CH = 96;
export const MAX_CHAT = 30;

export const blank = (n = W * H) => new Uint8Array(n);

export function encode(px) {
  const out = [];
  for (let i = 0; i < px.length; ) {
    const v = px[i];
    let n = 1;
    while (i + n < px.length && px[i + n] === v) n++;
    i += n;
    if (n < 64) out.push((v << 6) | n);
    else {
      out.push(v << 6);
      for (; n >= 128; n >>>= 7) out.push((n & 127) | 128);
      out.push(n);
    }
  }
  let s = "";
  for (const b of out) s += String.fromCharCode(b);
  return btoa(s);
}

export const BLANK = encode(blank());
export const BLANK_NOTE = encode(blank(W * CH));

// Decoded pictures, by their string (ones that haven't changed are decoded once). size = how many pixels.
const cache = new Map();
export function decode(str, size = W * H) {
  if (!str) return blank(size);
  const key = `${size}:${str}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const px = blank(size);
  try {
    const bin = atob(str);
    let at = 0;
    for (let i = 0; i < bin.length && at < px.length; ) {
      const b = bin.charCodeAt(i++);
      const v = b >> 6;
      let n = b & 63;
      if (!n) {
        for (let shift = 0; i < bin.length; shift += 7) {
          const c = bin.charCodeAt(i++);
          n |= (c & 127) << shift;
          if (!(c & 128)) break;
        }
      }
      if (v) px.fill(v, at, Math.min(px.length, at + n));
      at += n;
    }
  } catch {
    /* a damaged frame shows blank rather than breaking the book */
  }
  if (cache.size > 400) cache.delete(cache.keys().next().value);
  cache.set(key, px);
  return px;
}

// Ink a dot of width w at (x, y): a square for the thin pens, round for the wide ones. ink 0 rubs out.
function dot(px, x, y, w, ink) {
  const r = w / 2;
  const x0 = Math.round(x - r), y0 = Math.round(y - r);
  const round = w > 3;
  const h = px.length / W;
  for (let yy = y0; yy < y0 + w; yy++) {
    if (yy < 0 || yy >= h) continue;
    for (let xx = x0; xx < x0 + w; xx++) {
      if (xx < 0 || xx >= W) continue;
      if (round && (xx + 0.5 - x) ** 2 + (yy + 0.5 - y) ** 2 > r * r) continue;
      px[yy * W + xx] = ink;
    }
  }
}

// A straight line of dots from one point to the next, so a fast stroke has no gaps
export function line(px, [x0, y0], [x1, y1], w, ink) {
  const steps = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0)));
  for (let i = 0; i <= steps; i++) dot(px, x0 + ((x1 - x0) * i) / steps, y0 + ((y1 - y0) * i) / steps, w, ink);
}

const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const PAL = INKS.map((c, i) => (i ? rgb(c) : rgb(PAPER)));
const ONION = [210, 214, 236]; // the frame before, faint, so you can line the next one up

// Paint a frame (and, faintly under it, the one before) into a canvas W wide and as tall as the picture
export function paint(canvas, px, under) {
  const g = canvas.getContext("2d");
  const img = g.createImageData(W, px.length / W);
  const d = img.data;
  for (let i = 0; i < px.length; i++) {
    const c = px[i] ? PAL[px[i]] : under?.[i] ? ONION : PAL[0];
    d[i * 4] = c[0];
    d[i * 4 + 1] = c[1];
    d[i * 4 + 2] = c[2];
    d[i * 4 + 3] = 255;
  }
  g.putImageData(img, 0, 0);
}

export const bookChars = (frames) => frames.reduce((t, f) => t + (f?.length ?? 0), 0);
