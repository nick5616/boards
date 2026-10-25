// Paint-chip maths: hex <-> rgb <-> lab, the nearest playful name, and colour harmonies.
// All local, no network: the name table below is the whole dictionary.

const NAMES = [
  // reds & pinks
  ["Vampire Velvet", "#6b0f1f"], ["Blood Orange Sorbet", "#d9442b"], ["Lipstick Smudge", "#c2244b"], ["Cherry Cola", "#5a1520"],
  ["Rosewater", "#f2c4ce"], ["Ballet Slipper", "#f4d9d6"], ["Bubblegum Tantrum", "#f06fa6"], ["Hot Pink Lie", "#e8247c"],
  ["Raspberry Beret", "#b3204f"], ["Poppy Field", "#e03a2e"], ["Fire Engine", "#cf1f26"], ["Garnet Gossip", "#7a1428"],
  ["Burgundy Whisper", "#6f1d2e"], ["Merlot Monday", "#581a2b"], ["Dusty Rose", "#c99a9c"], ["Salmon Nap", "#f3a08a"],
  ["Coral Reef Gossip", "#f2705c"], ["Strawberry Milk", "#f7b6c2"], ["Mauve Hour", "#b9879b"], ["Rouge Noir", "#4a0e1a"],
  ["Cranberry Toast", "#9c2743"], ["Peony Pout", "#e58fb0"], ["Brick Alley", "#9a3b2d"], ["Rust Belt", "#a8482a"],
  // oranges, yellows
  ["Pumpkin Spice Ghost", "#e8751a"], ["Marmalade", "#e98a1c"], ["Apricot Whim", "#f7b585"], ["Peach Fuzz Dream", "#fbc9a6"],
  ["Burnt Toast", "#9b5a2b"], ["Mustard Seed", "#d9a521"], ["Butter Mint", "#f6e7a1"], ["Lemon Drop", "#f6e24a"],
  ["Sunflower Nap", "#f4c320"], ["Honeycomb", "#e8b030"], ["Goldenrod Hour", "#d8a62e"], ["Cornsilk", "#f8eec6"],
  ["Cantaloupe", "#f5a96b"], ["Amber Lamp", "#c97b12"], ["Candle Wax", "#f3e9cf"], ["Saffron Thread", "#f0a30a"],
  // greens
  ["Moss Whisper", "#8a9a5b"], ["Forest Floor", "#2f4a2c"], ["Pine Needle", "#1f3d2b"], ["Sage Advice", "#a3b18a"],
  ["Mint Julep", "#a8e0c0"], ["Pistachio Cream", "#cfe3a9"], ["Lime Zest", "#b7d935"], ["Emerald City", "#0f9d6b"],
  ["Bottle Glass", "#1b5e45"], ["Fern Gully", "#4d8c4a"], ["Olive Branch", "#6b6b2a"], ["Eucalyptus", "#7fa393"],
  ["Spearmint Gum", "#7ed9b0"], ["Swamp Gossip", "#4a5a2e"], ["Seafoam Sigh", "#b6e3d4"], ["Cucumber Water", "#c9e4c5"],
  ["Hunter's Hat", "#355e3b"], ["Absinthe Fairy", "#a9c27a"], ["Jade Pendant", "#2f9a74"], ["Artichoke", "#7b8a5c"],
  // blues
  ["Midnight Library", "#1a1f3d"], ["Navy Secret", "#1e2a52"], ["Denim Day", "#4a6fa5"], ["Baby Blue Blanket", "#a9cdea"],
  ["Sky Without Plans", "#7ec8f0"], ["Cerulean Dream", "#2a7fc1"], ["Cobalt Mood", "#1f4fb0"], ["Ink Well", "#14213d"],
  ["Powder Room", "#c5d9ea"], ["Ocean Floor", "#17506b"], ["Teal Deal", "#1b8a8f"], ["Peacock Strut", "#0e6f7e"],
  ["Robin's Egg", "#8fd6d0"], ["Turquoise Tide", "#30c4c9"], ["Stormcloud", "#5a6b80"], ["Slate Rooftop", "#475569"],
  ["Periwinkle Promise", "#8e9be0"], ["Sapphire Swoon", "#1d3f9e"], ["Glacier Mint", "#bfe9ee"], ["Blue Jeans Gossip", "#3b5f8f"],
  // purples
  ["Bruised Plum", "#4b1f45"], ["Grape Soda", "#6d3a9c"], ["Lavender Fog", "#c5b7e0"], ["Lilac Lullaby", "#d3b8e3"],
  ["Amethyst Cave", "#8650b8"], ["Orchid Whisper", "#c78ac9"], ["Eggplant Opera", "#3d1a3f"], ["Violet Hour", "#7a3fb3"],
  ["Heliotrope", "#b36ae0"], ["Wisteria Porch", "#a58bd0"], ["Dark Magic", "#2a1233"], ["Thistle Down", "#d8bfd8"],
  ["Mulberry Stain", "#6e2c5a"], ["Fig Jam", "#5b2a4a"], ["Twilight Plum", "#5a3a6e"], ["Gothic Grape", "#3a1d4a"],
  // browns & tans
  ["Espresso Shot", "#3b2418"], ["Chocolate Truffle", "#4a2c20"], ["Cinnamon Stick", "#8a4b2a"], ["Caramel Drizzle", "#c0803a"],
  ["Latte Foam", "#d9c3a5"], ["Oatmeal Cookie", "#d8c4a0"], ["Sandcastle", "#e2cfa6"], ["Camel Coat", "#b98a54"],
  ["Mocha Mousse", "#7a5540"], ["Walnut Shell", "#5c4033"], ["Driftwood", "#a89580"], ["Taupe Tuesday", "#8b7d72"],
  ["Cocoa Dust", "#6b4a3a"], ["Gingerbread", "#a1622e"], ["Leather Satchel", "#8b5a3c"], ["Biscotti", "#e6d3b3"],
  ["Hazelnut", "#a67b5b"], ["Terracotta Pot", "#c0603f"], ["Clay Hands", "#b5704f"], ["Tobacco Road", "#6f4e37"],
  // creams, whites
  ["Bone China", "#f1ebdd"], ["Ivory Tower", "#f6f1e0"], ["Vanilla Bean", "#f3e8d0"], ["Pearl Button", "#efe9e4"],
  ["Eggshell Stare", "#f2ece0"], ["Cloud Nine", "#f4f6f8"], ["Paper Doll", "#faf8f5"], ["Champagne Flute", "#efdcc0"],
  ["Linen Closet", "#ebe3d5"], ["Marshmallow", "#fdf3ef"], ["Alabaster", "#f2f0e6"], ["Porcelain", "#f5efea"],
  // greys & blacks
  ["Vinyl Black", "#16151a"], ["Raven Wing", "#1c1a1f"], ["Charcoal Sketch", "#36393f"], ["Graphite", "#4b4e55"],
  ["Pavement", "#7d7f84"], ["Pigeon Grey", "#9ea1a6"], ["Silver Spoon", "#c4c6ca"], ["Fog Machine", "#d6d8db"],
  ["Ash Wednesday", "#b4b0aa"], ["Gunmetal", "#2f3640"], ["Licorice", "#1a1214"], ["Smoke Signal", "#8d8a8a"],
  ["Pewter Mug", "#8a8d8f"], ["Soot", "#2a2a2c"], ["Ghost Pepper Pale", "#e9e6ec"], ["Moonstone", "#cfd2da"],
  // metallics-ish and extras
  ["Rose Gold Hour", "#d9a58f"], ["Brass Doorknob", "#b5893b"], ["Copper Kettle", "#b4673a"], ["Antique Gold", "#a8873a"],
  ["Fuchsia Fever", "#c2188f"], ["Magenta Static", "#d02a8f"], ["Neon Flamingo", "#ff5fa2"], ["Tangerine Dream", "#ff8a1f"],
  ["Electric Lemon", "#f0f23a"], ["Aqua Fresh", "#30e0d0"], ["Ultraviolet", "#5b2bd6"], ["Cardinal Cloak", "#a3162a"],
];

// "#abc" and "#aabbcc" (any case) → "#aabbcc"
export const normHex = (s) => {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(s.trim());
  if (!m) return null;
  const h = m[1].length === 3 ? [...m[1]].map((c) => c + c).join("") : m[1];
  return `#${h.toLowerCase()}`;
};

// Every hex colour mentioned in some pasted text (needs the # so plain words don't count)
export const hexesIn = (text) => [
  ...new Set([...text.matchAll(/#(?:[0-9a-f]{6}|[0-9a-f]{3})(?![0-9a-z])/gi)].map((m) => normHex(m[0]))),
];

export const toRgb = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
export const fromRgb = (rgb) =>
  `#${rgb.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("")}`;

// sRGB → XYZ (D65) → CIELAB
export function toLab(hex) {
  const [r, g, b] = toRgb(hex).map((v) => {
    const c = v / 255;
    return c > 0.04045 ? ((c + 0.055) / 1.055) ** 2.4 : c / 12.92;
  });
  const x = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047;
  const y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883;
  const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))];
}

const LABS = NAMES.map(([name, hex]) => ({ name, lab: toLab(hex) }));

// Nearest table colour by ΔE76 (plain distance in Lab)
export function nameFor(hex) {
  const [l, a, b] = toLab(hex);
  let best = LABS[0];
  let d = Infinity;
  for (const c of LABS) {
    const e = (c.lab[0] - l) ** 2 + (c.lab[1] - a) ** 2 + (c.lab[2] - b) ** 2;
    if (e < d) [best, d] = [c, e];
  }
  return best.name;
}

function toHsl(hex) {
  const [r, g, b] = toRgb(hex).map((v) => v / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (!d) return [0, 0, l];
  const s = d / (1 - Math.abs(2 * l - 1));
  const h = max === r ? ((g - b) / d + 6) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
}
function fromHsl([h, s, l]) {
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
  return fromRgb([f(0) * 255, f(8) * 255, f(4) * 255]);
}

// Friends for a colour, found by turning its hue around the wheel
export function harmonies(hex) {
  const [h, s, l] = toHsl(hex);
  const turn = (deg) => fromHsl([(h + deg + 360) % 360, s, l]);
  return [
    { id: "comp", label: "complementary", hexes: [turn(180)] },
    { id: "analog", label: "analogous", hexes: [turn(-30), turn(30)] },
    { id: "triad", label: "triad", hexes: [turn(120), turn(240)] },
  ];
}

// Text that reads on top of a colour
export const inkOn = (hex) => (toLab(hex)[0] > 60 ? "#2a2520" : "#faf8f5");
