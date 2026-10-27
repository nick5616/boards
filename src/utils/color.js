export const hslStr = (h, s, l) => `hsl(${h},${s}%,${l}%)`;
export const defaultColor = () => ({ h: 340, s: 55, l: 82 });

// ── Light or dark? ──────────────────────────────────────────────────────────
// WCAG relative luminance, so "dark" means what the eye sees: a yellow at 50%
// lightness is bright, a blue at 50% is dark, even though HSL calls them equal.
const INK = [42, 37, 32]; // #2a2520, the ink everything's drawn in
const PAPER = [255, 253, 248]; // #fffdf8

function hslToRgb(h, s, l) {
  s /= 100;
  l /= 100;
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
  return [f(0), f(8), f(4)].map((v) => Math.round(v * 255));
}

const lin = (v) => {
  const c = v / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};
const luminance = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
const contrast = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

// True when light text reads better on this colour than our dark ink does
export const isDark = (c) => {
  const bg = hslToRgb(c.h, c.s, c.l);
  return contrast(bg, PAPER) > contrast(bg, INK);
};

// Plain text on a board colour: our ink, or paper white on dark colours
export const textOn = (c) => (isDark(c) ? "#fffdf8" : "#2a2520");
export const softTextOn = (c) => (isDark(c) ? "rgba(255, 253, 248, 0.6)" : "rgba(42, 37, 32, 0.4)");

// A stamp's ink: a deep shade of the board colour, or a pale tint of it on dark colours
export const inkColor = (c) =>
  isDark(c) ? hslStr(c.h, Math.min(c.s, 60), Math.min(94, Math.max(86, c.l + 50))) : hslStr(c.h, c.s, Math.max(18, c.l - 48));

// Every 10° around the hue wheel
export const HUE_SWATCHES = Array.from({ length: 36 }, (_, i) => i * 10);
