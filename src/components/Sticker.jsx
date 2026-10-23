// Kid-Pix-ish stickers. Shape, color and tilt are derived from a seed (an entry
// id), so a given log always looks the same on every device.

const SHAPES = {
  star: "M12 1.5l3.1 6.6 7.2.9-5.3 5 1.4 7.1L12 17.6l-6.4 3.5L7 14l-5.3-5 7.2-.9z",
  heart: "M12 21s-8.5-5.2-9.6-10.6C1.6 6.3 4.3 3.5 7.4 3.5c2 0 3.5 1.1 4.6 2.7 1.1-1.6 2.6-2.7 4.6-2.7 3.1 0 5.8 2.8 5 6.9C20.5 15.8 12 21 12 21z",
  flower: "M12 8.2a3.4 3.4 0 1 1 3.4-3.4A3.4 3.4 0 1 1 18.8 12a3.4 3.4 0 1 1-3.4 3.4A3.4 3.4 0 1 1 12 18.8a3.4 3.4 0 1 1-3.4-3.4A3.4 3.4 0 1 1 5.2 12a3.4 3.4 0 1 1 3.4-3.4A3.4 3.4 0 1 1 12 8.2z",
  blob: "M12 2.5c4.8 0 9.5 3.4 9.5 9.1 0 5.4-4.4 9.9-9.8 9.9C6.3 21.5 2.5 17.7 2.5 12.4 2.5 6.6 7 2.5 12 2.5z",
  burst: "M12 1l2.2 4.6 4.9-1.5-1.5 4.9L22.2 12l-4.6 2.2 1.5 4.9-4.9-1.5L12 23l-2.2-4.4-4.9 1.5 1.5-4.9L1.8 12l4.6-2.2-1.5-4.9 4.9 1.5z",
};
const SHAPE_KEYS = Object.keys(SHAPES);
export const STICKER_COLORS = ["#ff5d8f", "#ffb703", "#3a86ff", "#8ac926", "#9b5de5", "#ff7f11", "#00bbf9", "#f15bb5"];

export const hash = (s = "") => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
};

export default function Sticker({ seed = "", size = 24, color, shape, className = "" }) {
  const h = hash(seed);
  const key = shape ?? SHAPE_KEYS[h % SHAPE_KEYS.length];
  const fill = color ?? STICKER_COLORS[(h >>> 4) % STICKER_COLORS.length];
  const rot = ((h >>> 9) % 40) - 20;
  return (
    <svg
      className={`sticker ${className}`}
      viewBox="0 0 24 24"
      width={size}
      height={size}
      style={{ transform: `rotate(${rot}deg)` }}
      aria-hidden="true"
    >
      <path d={SHAPES[key]} fill={fill} stroke="#2a2520" strokeWidth="1.3" strokeLinejoin="round" />
      {key === "blob" && (
        <g fill="#2a2520">
          <circle cx="9" cy="10.5" r="1.1" />
          <circle cx="15" cy="10.5" r="1.1" />
          <path d="M8.5 14.2c1.8 2 5.2 2 7 0" stroke="#2a2520" strokeWidth="1.2" fill="none" strokeLinecap="round" />
        </g>
      )}
      {key !== "blob" && <ellipse cx="9" cy="8" rx="2" ry="1.2" fill="#fff" opacity=".55" />}
    </svg>
  );
}
