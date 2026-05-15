export const hslStr = (h, s, l) => `hsl(${h},${s}%,${l}%)`;
export const defaultColor = () => ({ h: 340, s: 55, l: 82 });
export const inkColor = (c) => hslStr(c.h, c.s, Math.max(18, c.l - 48));

// Every 10° around the hue wheel
export const HUE_SWATCHES = Array.from({ length: 36 }, (_, i) => i * 10);
