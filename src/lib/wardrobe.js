// The sewing-room maths behind Paper doll, Closet and Tape measure. Nothing here
// touches the page, so the modules stay about drawing and the sums stay testable.
import { uid } from "../utils/uid";

// ── Money & colour ───────────────────────────────────────────────────────────

// "$22.99", "1,200", "22.99 USD" → 22.99; anything without a number → null
export const priceNum = (s) => {
  if (s == null || s === "") return null;
  if (typeof s === "number") return s;
  const m = String(s).replace(/,/g, "").match(/\d+(?:\.\d+)?/);
  return m ? Number(m[0]) : null;
};
export const money = (n) => `$${n >= 100 ? Math.round(n) : n.toFixed(2).replace(/\.00$/, "")}`;

// A loose colour family, so "oxblood" and "wine" both filter as red
export function colorFamily(hex) {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min, l = (max + min) / 2;
  if (l < 0.14) return "black";
  if (l > 0.9 && d < 0.12) return "white";
  if (d < 0.1) return "grey";
  const h = (max === r ? ((g - b) / d + 6) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4) * 60;
  if (l < 0.3 && h > 10 && h < 50) return "brown";
  if (h < 15 || h >= 345) return l > 0.7 ? "pink" : "red";
  if (h < 45) return l < 0.45 ? "brown" : "orange";
  if (h < 70) return "yellow";
  if (h < 170) return "green";
  if (h < 255) return "blue";
  if (h < 300) return "purple";
  return "pink";
}
export const FAMILY_HEX = {
  black: "#1c1a1f", white: "#f4efe6", grey: "#9a9a9e", red: "#a3162a", pink: "#e79ab0", orange: "#e0802c",
  yellow: "#e8c53a", green: "#4f8a5b", blue: "#3f6aa8", purple: "#6b3fa0", brown: "#6b4a32",
};

// The main colour of a picture: an average of its middle, skipping white backdrops and see-through bits
export function dominantHex(src) {
  return new Promise((resolve) => {
    const img = new Image();
    if (!src.startsWith("data:")) img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const c = document.createElement("canvas");
        c.width = c.height = 24;
        const x = c.getContext("2d", { willReadFrequently: true });
        x.drawImage(img, img.width * 0.2, img.height * 0.2, img.width * 0.6, img.height * 0.6, 0, 0, 24, 24);
        const d = x.getImageData(0, 0, 24, 24).data;
        let R = 0, G = 0, B = 0, n = 0;
        for (let i = 0; i < d.length; i += 4) {
          if (d[i + 3] < 200 || (d[i] > 235 && d[i + 1] > 235 && d[i + 2] > 235)) continue;
          R += d[i]; G += d[i + 1]; B += d[i + 2]; n++;
        }
        resolve(n ? `#${[R, G, B].map((v) => Math.round(v / n).toString(16).padStart(2, "0")).join("")}` : null);
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

// ── Cutting a garment out of a photo ─────────────────────────────────────────

// Magic wand: wipes the pixels connected to (sx, sy) that look like the one clicked.
// tol 0-100. Edges get a soft fade so a white backdrop doesn't leave a hard halo.
export function wandClear(img, sx, sy, tol) {
  const { data, width: w, height: h } = img;
  const at = (x, y) => (y * w + x) * 4;
  const i0 = at(sx, sy);
  if (data[i0 + 3] === 0) return false;
  const [r0, g0, b0] = [data[i0], data[i0 + 1], data[i0 + 2]];
  const thr = tol * 3.5;
  const dist = (i) => Math.hypot(data[i] - r0, data[i + 1] - g0, data[i + 2] - b0);
  const seen = new Uint8Array(w * h);
  const stack = [sy * w + sx];
  seen[sy * w + sx] = 1;
  while (stack.length) {
    const p = stack.pop();
    const x = p % w, y = (p / w) | 0;
    data[p * 4 + 3] = 0;
    for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const q = ny * w + nx;
      if (seen[q] || data[q * 4 + 3] === 0 || dist(q * 4) > thr) continue;
      seen[q] = 1;
      stack.push(q);
    }
  }
  // Fade the rim: pixels touching the wiped area that are almost the same colour
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const p = y * w + x;
      if (seen[p] || data[p * 4 + 3] === 0) continue;
      const touch = (x > 0 && seen[p - 1]) || (x < w - 1 && seen[p + 1]) || (y > 0 && seen[p - w]) || (y < h - 1 && seen[p + w]);
      if (!touch) continue;
      const d = dist(p * 4);
      if (d < thr * 1.7) data[p * 4 + 3] = Math.round(data[p * 4 + 3] * Math.min(1, Math.max(0.15, (d - thr) / (thr * 0.7))));
    }
  }
  return true;
}

// Crops a canvas to what's left visible, with a little breathing room; null when nothing is
export function trimmed(canvas, pad = 3) {
  const { width: w, height: h } = canvas;
  const d = canvas.getContext("2d", { willReadFrequently: true }).getImageData(0, 0, w, h).data;
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (d[(y * w + x) * 4 + 3] < 12) continue;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  }
  if (x1 < 0) return null;
  x0 = Math.max(0, x0 - pad); y0 = Math.max(0, y0 - pad);
  x1 = Math.min(w - 1, x1 + pad); y1 = Math.min(h - 1, y1 + pad);
  const out = document.createElement("canvas");
  out.width = x1 - x0 + 1;
  out.height = y1 - y0 + 1;
  out.getContext("2d").drawImage(canvas, x0, y0, out.width, out.height, 0, 0, out.width, out.height);
  return out;
}

// A transparent PNG small enough to sit in one doc: shrinks until it fits
export function pngFor(canvas) {
  let out = "";
  for (const max of [620, 460, 340]) {
    const k = Math.min(1, max / Math.max(canvas.width, canvas.height));
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(canvas.width * k));
    c.height = Math.max(1, Math.round(canvas.height * k));
    c.getContext("2d").drawImage(canvas, 0, 0, c.width, c.height);
    out = c.toDataURL("image/png");
    if (out.length < 700_000) break;
  }
  return out;
}

// ── The doll ─────────────────────────────────────────────────────────────────

// Half-widths (from the middle line) at shoulder, bust, waist, hip. A plain mannequin, no details.
export const SHAPES = {
  slim: { label: "Slim", sh: 36, bu: 26, wa: 21, hi: 28 },
  curvy: { label: "Curvy", sh: 38, bu: 33, wa: 22, hi: 39 },
  round: { label: "Round", sh: 42, bu: 38, wa: 36, hi: 40 },
  broad: { label: "Broad", sh: 46, bu: 36, wa: 29, hi: 32 },
  tall: { label: "Long", sh: 38, bu: 29, wa: 24, hi: 33, stretch: 1.04 },
};
export const SKINS = ["#f6d9c0", "#e8b894", "#c98f63", "#a56b45", "#7a4a30", "#4f2f21"];

// Smooth closed curve through points (Catmull-Rom turned into bezier segments)
function smooth(pts) {
  const n = pts.length;
  let d = `M${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += `C${c1.map((v) => v.toFixed(1))} ${c2.map((v) => v.toFixed(1))} ${p2.map((v) => v.toFixed(1))}`;
  }
  return d + "Z";
}

// Body outline for a shape, in a 200 x 330 box with the middle at x = 100
export function bodyPath({ sh, bu, wa, hi }) {
  const right = [[7, 54], [9, 63], [sh, 72], [bu + 3, 100], [wa, 134], [hi, 170], [hi - 4, 202], [hi - 10, 240], [23, 280], [20, 294]];
  const inner = [[11, 294], [10, 262], [8, 238], [3, 204], [0, 192]];
  const R = [...right, ...inner];
  const L = [...right].reverse().map(([x, y]) => [-x, y]);
  const Li = [...inner].reverse().map(([x, y]) => [-x, y]);
  // Walk down the right side, up the left; the crotch point is shared
  const pts = [...R, ...Li.slice(1), ...L].map(([x, y]) => [100 + x, y]);
  return smooth(pts);
}

// ── Size charts ──────────────────────────────────────────────────────────────

export const MEASURES = [
  { id: "bust", label: "Bust" },
  { id: "underbust", label: "Underbust" },
  { id: "waist", label: "Waist" },
  { id: "hips", label: "Hips" },
  { id: "shoulder", label: "Shoulder" },
  { id: "sleeve", label: "Sleeve" },
  { id: "inseam", label: "Inseam" },
  { id: "height", label: "Height" },
];
const ALIASES = [
  [/under/i, "underbust"], [/bust|chest/i, "bust"], [/waist/i, "waist"], [/hip/i, "hips"],
  [/shoulder/i, "shoulder"], [/sleeve|arm/i, "sleeve"], [/inseam|leg/i, "inseam"], [/height/i, "height"],
];
const measureOf = (word) => ALIASES.find(([re]) => re.test(word))?.[1] ?? null;

const NUM = /^\d+(?:\.\d+)?$/;
const RANGE = /^(\d+(?:\.\d+)?)-(\d+(?:\.\d+)?)$/;

// A shop's size chart, pasted any old way:
//   "S 32-34 26-28 36-38"          one row per size, columns bust / waist / hips
//   "Size  Bust  Waist  Hips"     (optionally) a header line naming the columns
// → { unit, cols: ["bust", ...], rows: [{ size, ranges: [[lo, hi] | null, ...] }] }
export function parseChart(text) {
  const clean = String(text ?? "")
    .replace(/[“”″"]/g, "")
    .replace(/(\d)\s*(?:[-–—]|to)\s*(\d)/gi, "$1-$2")
    .replace(/(\d)\s*(?:cm|in(?:ches)?)\b/gi, "$1");
  let cols = null;
  const rows = [];
  for (const line of clean.split(/\n+/)) {
    const toks = line.split(/[\t|,;\s]+/).filter(Boolean).filter((t) => !/^size$/i.test(t));
    if (!toks.length) continue;
    if (!toks.some((t) => /\d/.test(t))) {
      const named = toks.map(measureOf).filter(Boolean);
      if (named.length >= 2) cols = named;
      continue;
    }
    const lead = toks.findIndex((t) => /^\d/.test(t));
    // A label, then numbers. A plain number up front is a label too (e.g. dress size 4) when more follow.
    const labelEnd = lead > 0 ? lead : toks.length > 2 || RANGE.test(toks[1] ?? "") ? 1 : 0;
    if (!labelEnd) continue;
    const size = toks.slice(0, labelEnd).join(" ");
    const ranges = toks.slice(labelEnd).map((t) => {
      const r = t.match(RANGE);
      if (r) return [Math.min(+r[1], +r[2]), Math.max(+r[1], +r[2])];
      return NUM.test(t) ? [+t, +t] : null;
    });
    if (ranges.filter(Boolean).length) rows.push({ size, ranges });
  }
  if (!rows.length) return null;
  const width = Math.max(...rows.map((r) => r.ranges.length));
  const base = ["bust", "waist", "hips"];
  const names = Array.from({ length: width }, (_, i) => cols?.[i] ?? base[i] ?? null);
  const highs = rows.flatMap((r) => r.ranges.filter(Boolean).map((x) => x[1])).sort((a, b) => a - b);
  const unit = /\bcm\b/i.test(text) ? "cm" : /\b(in|inch|inches)\b|"/i.test(text) ? "in" : highs[highs.length >> 1] > 60 ? "cm" : "in";
  return { unit, cols: names, rows };
}

// A paste that looks like a size chart: at least two rows with at least two numbers each
export const looksLikeChart = (text) => {
  const c = parseChart(text);
  return !!c && c.rows.length >= 2 && c.rows.filter((r) => r.ranges.filter(Boolean).length >= 2).length >= 2;
};

export const toUnit = (v, from, to) => (from === to ? v : from === "in" ? v * 2.54 : v / 2.54);

// Which size fits each measurement, and the best size overall.
// vals are in `unit`; the chart can be in the other one.
export function fitChart(chart, vals, unit) {
  if (!chart) return null;
  const tol = chart.unit === "in" ? 0.5 : 1.25; // a single number on a chart means "about this"
  const gap = (v, [lo, hi]) => (v < lo - (lo === hi ? tol : 0) ? lo - v : v > hi + (lo === hi ? tol : 0) ? v - hi : 0);
  const cols = chart.cols
    .map((id, c) => ({ id, c, v: id && vals[id] != null && vals[id] !== "" ? toUnit(Number(vals[id]), unit, chart.unit) : null }))
    .filter((x) => x.v != null && !Number.isNaN(x.v));
  if (!cols.length) return { cols: [], best: null, between: null };
  // For each measurement: the distance to every size's range, and the closest size (ties go larger, for comfort)
  const per = cols.map(({ id, c, v }) => {
    const gaps = chart.rows.map((r) => (r.ranges[c] ? gap(v, r.ranges[c]) : null));
    let pick = -1;
    gaps.forEach((g, i) => g != null && (pick < 0 || g <= gaps[pick]) && (pick = i));
    return { id, c, v, gaps, pick, inside: gaps.map((g) => g === 0) };
  });
  const total = chart.rows.map((_, i) => per.reduce((t, p) => t + (p.gaps[i] ?? 99), 0));
  let best = 0;
  total.forEach((t, i) => t <= total[best] && (best = i));
  const picks = per.map((p) => p.pick);
  const lo = Math.min(...picks), hi = Math.max(...picks);
  const between = lo === hi ? null : { lo, hi, parts: per.map((p) => ({ id: p.id, size: chart.rows[p.pick].size })) };
  return { cols: per, best, between, total };
}
export const sayBetween = (chart, b) =>
  `Between ${chart.rows[b.lo].size} and ${chart.rows[b.hi].size}: ` +
  b.parts.map((p) => `${p.id} says ${p.size}`).join(", ") +
  `. Stretchy fabric, take ${chart.rows[b.lo].size}; stiff or boned, take ${chart.rows[b.hi].size}.`;

// ── Closet pieces ────────────────────────────────────────────────────────────

export const CATS = [
  { id: "tops", label: "Tops" },
  { id: "bottoms", label: "Bottoms" },
  { id: "dresses", label: "Dresses" },
  { id: "outer", label: "Coats" },
  { id: "shoes", label: "Shoes" },
  { id: "extras", label: "Extras" },
];

export const newPiece = (fields = {}) => ({
  id: uid(), name: "", cat: "tops", hex: "#6b0f1f", cost: null, bought: null, imageId: null, wears: [], at: Date.now(), ...fields,
});

// A guess at a category from words in the name
export function catFor(name = "") {
  const t = name.toLowerCase();
  if (/dress|gown|jumpsuit|romper/.test(t)) return "dresses";
  if (/coat|jacket|blazer|cape|cardigan|parka|trench/.test(t)) return "outer";
  if (/boot|shoe|heel|sneaker|sandal|loafer|flat/.test(t)) return "shoes";
  if (/pant|jean|skirt|short|trouser|legging/.test(t)) return "bottoms";
  if (/glove|choker|necklace|belt|scarf|bag|hat|earring|ring|tights|sock/.test(t)) return "extras";
  return "tops";
}

// Pastes become pieces: one per line / link / picture
export function piecesFrom(p) {
  if (p.kind === "image") return (p.imageIds ?? []).map((imageId) => newPiece({ name: "new thing", imageId }));
  if (p.kind === "link") return p.links.map((l) => newPiece({ name: l.title, cat: catFor(l.title), url: l.url }));
  return p.lines.map((l) => newPiece({ name: l, cat: catFor(l) }));
}

export const lastWorn = (it) => (it.wears?.length ? it.wears.reduce((a, b) => (a > b ? a : b)) : null);
