// Recipe maths and reading. An ingredient is { id, q, u, name }: q a number (or null for
// "salt, to taste"), u a canonical unit ("g" "kg" "oz" "lb" "ml" "l" "cup" "tbsp" "tsp" or "" for a count).
// A step is { text, mins } where mins comes from the words in it ("bulk ferment 4 hours").
import { uid } from "../utils/uid";

// ── Reading a pasted recipe ─────────────────────────────────────────────────
const FRAC = { "½": 0.5, "¼": 0.25, "¾": 0.75, "⅓": 1 / 3, "⅔": 2 / 3, "⅛": 0.125 };
const UNITS = {
  g: "g", gram: "g", grams: "g", gr: "g",
  kg: "kg", kilo: "kg", kilos: "kg", kilogram: "kg", kilograms: "kg",
  oz: "oz", ounce: "oz", ounces: "oz",
  lb: "lb", lbs: "lb", pound: "lb", pounds: "lb",
  ml: "ml", milliliter: "ml", milliliters: "ml", millilitre: "ml", millilitres: "ml",
  l: "l", liter: "l", liters: "l", litre: "l", litres: "l",
  cup: "cup", cups: "cup", c: "cup",
  tbsp: "tbsp", tbs: "tbsp", tablespoon: "tbsp", tablespoons: "tbsp", tbl: "tbsp",
  tsp: "tsp", teaspoon: "tsp", teaspoons: "tsp",
};
const NUM = "(?:\\d+\\s+\\d+\\/\\d+|\\d+\\/\\d+|\\d*[.,]?\\d+\\s*[½¼¾⅓⅔⅛]|[½¼¾⅓⅔⅛]|\\d*[.,]?\\d+)";
const LINE = new RegExp(`^\\s*(?:[-•*·▢☐]\\s*)?(${NUM})\\s*([a-zA-Z]+\\.?)?\\s*(?:of\\s+)?(.*)$`);

export function parseNumber(s) {
  s = s.trim();
  let m = s.match(/^(\d+)\s+(\d+)\/(\d+)$/);
  if (m) return +m[1] + m[2] / m[3];
  m = s.match(/^(\d+)\/(\d+)$/);
  if (m) return m[1] / m[2];
  m = s.match(/^(\d*[.,]?\d*)\s*([½¼¾⅓⅔⅛])$/);
  if (m) return (m[1] ? parseFloat(m[1].replace(",", ".")) : 0) + FRAC[m[2]];
  const n = parseFloat(s.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

// One line → an ingredient, or null if it doesn't start with an amount
export function parseIngredient(line) {
  const m = line.match(LINE);
  if (!m) return null;
  const q = parseNumber(m[1]);
  if (q == null) return null;
  let word = (m[2] ?? "").replace(/\.$/, "").toLowerCase();
  let rest = m[3].trim();
  let u = UNITS[word];
  if (!u) {
    // "2 eggs": that word is the ingredient, not a unit
    rest = `${m[2] ?? ""} ${rest}`.trim();
    u = "";
  }
  rest = rest.replace(/^of\s+/i, "").replace(/^[-,:]\s*/, "");
  if (!rest) return null;
  return { id: uid(), q, u, name: rest };
}

// "bulk ferment 4 hours", "bake 25-30 min", "rest 4:00" → minutes (null if no time in it)
export function minsIn(text) {
  const t = text.toLowerCase();
  let m = t.match(/(\d+(?:\.\d+)?)(?:\s*(?:-|–|to)\s*(\d+(?:\.\d+)?))?\s*(hours?|hrs?|h)\b/);
  if (m) return +(m[2] ?? m[1]) * 60;
  m = t.match(/(\d+(?:\.\d+)?)(?:\s*(?:-|–|to)\s*(\d+(?:\.\d+)?))?\s*(minutes?|mins?|m)\b/);
  if (m) return +(m[2] ?? m[1]);
  m = t.match(/\b(\d{1,2}):(\d\d)\b/); // h:mm
  if (m) return +m[1] * 60 + +m[2];
  return null;
}

const HEADER = /^(ingredients?|directions?|instructions?|method|steps?|preparation|for the [\w\s]+|notes?)\s*:?$/i;
export const stepOf = (text) => ({ text, mins: minsIn(text) });

// Free text → { title?, ingredients, steps }. Lines starting with an amount are ingredients;
// the rest are steps (a leading "1." or "Step 1:" is dropped). A first plain line before any
// ingredient becomes the title.
export function parseRecipe(text) {
  const lines = (text ?? "").split(/\n+/).map((l) => l.trim()).filter(Boolean);
  const ingredients = [];
  const steps = [];
  let title = null;
  for (const raw of lines) {
    if (HEADER.test(raw)) continue;
    const ing = !/^\d+[.)]\s+\D/.test(raw) && parseIngredient(raw);
    if (ing) {
      ingredients.push(ing);
      continue;
    }
    const body = raw.replace(/^(?:step\s*)?\d+[.):]\s*/i, "").replace(/^[-•*]\s*/, "");
    if (!ingredients.length && !steps.length && !title && body.length < 60 && !/[.!?]$/.test(body)) title = body;
    else steps.push(stepOf(body));
  }
  return { title, ingredients, steps };
}

// Back to text, for the edit box
const amountText = (i) => `${i.q == null ? "" : `${fmtNum(i.q)} `}${i.u ? `${i.u} ` : ""}`;
export const recipeText = ({ ingredients = [], steps = [] }) =>
  `${ingredients.map((i) => `${amountText(i)}${i.name}`.trim()).join("\n")}\n\n${steps.map((s, n) => `${n + 1}. ${s.text}`).join("\n")}`.trim();

// ── Maths ───────────────────────────────────────────────────────────────────
// Grams in a cup, by what it is. Flour packs differently by scoop, so these are
// honest averages, not gospel: weigh when it matters. First match wins.
const DENSITY = [
  [/whole.?wheat|wholemeal|rye/, 130],
  [/flour/, 125],
  [/brown sugar/, 213],
  [/powdered|icing|confectioner/, 120],
  [/sugar/, 200],
  [/butter/, 227],
  [/honey|syrup|molasses/, 340],
  [/oil/, 216],
  [/salt/, 288],
  [/yeast/, 192],
  [/cocoa/, 85],
  [/oat/, 90],
  [/rice/, 190],
  [/milk|buttermilk|cream|yogh?urt/, 245],
  [/water|stock|broth|juice|beer|wine/, 237],
  [/starter|levain|sourdough/, 240],
];
// Grams in one of a thing, when you count it instead of weighing it
const EACH = [[/egg/, 50]];
const G = { g: 1, kg: 1000, oz: 28.35, lb: 453.6 };
const CUPS = { cup: 1, tbsp: 1 / 16, tsp: 1 / 48, ml: 1 / 236.6, l: 1000 / 236.6 };

export const densityOf = (name) => DENSITY.find(([re]) => re.test(name.toLowerCase()))?.[1] ?? null;
const eachOf = (name) => EACH.find(([re]) => re.test(name.toLowerCase()))?.[1] ?? null;
export const isFlour = (name) => /flour/i.test(name);
// Wet things count toward hydration (water-like, and starter's water is ignored: keep it simple)
export const isLiquid = (name) => /\b(water|milk|buttermilk|juice|beer|wine|stock|broth)\b/i.test(name);

// Grams for an ingredient, or null when we can't tell (a pinch, "1 bay leaf")
export function toGrams(i) {
  if (i.q == null) return null;
  if (G[i.u]) return i.q * G[i.u];
  if (i.u === "") {
    const e = eachOf(i.name);
    return e ? i.q * e : null;
  }
  const d = CUPS[i.u] != null && densityOf(i.name);
  // Liquids we don't know the weight of are treated like water: 1 ml = 1 g
  if (i.u === "ml" || i.u === "l") return i.q * (i.u === "l" ? 1000 : 1) * (d ? (d / 236.6) : 1);
  return d ? i.q * CUPS[i.u] * d : null;
}

export function hydrationOf(ingredients = []) {
  const flour = ingredients.filter((i) => isFlour(i.name)).reduce((t, i) => t + (toGrams(i) ?? 0), 0);
  if (!flour) return null;
  const wet = ingredients.filter((i) => isLiquid(i.name)).reduce((t, i) => t + (toGrams(i) ?? 0), 0);
  return Math.round((wet / flour) * 100);
}

// ── Showing amounts ─────────────────────────────────────────────────────────
export function fmtNum(n) {
  if (n >= 100) return String(Math.round(n));
  if (n >= 10) return String(Math.round(n * 10) / 10);
  return String(Math.round(n * 100) / 100);
}

const EIGHTHS = ["", "⅛", "¼", "⅜", "½", "⅝", "¾", "⅞"];
function fmtCups(c) {
  let whole = Math.floor(c);
  let e = Math.round((c - whole) * 8);
  if (e === 8) (whole++, (e = 0));
  if (!whole && !e) return "⅛";
  return `${whole || ""}${whole && e ? " " : ""}${EIGHTHS[e]}`;
}

// How an ingredient reads at a given scale, in grams or in cups.
// → { text, approx } (approx = a cup conversion, so show it with a ~)
export function show(i, factor, system) {
  if (i.q == null) return { text: "", approx: false };
  const q = i.q * factor;
  const g = toGrams({ ...i, q });
  const d = densityOf(i.name);
  if (system === "cups" && d && g != null) {
    const c = g / d;
    if (c >= 0.2) return { text: `${fmtCups(c)} cup${c > 1.05 ? "s" : ""}`, approx: i.u !== "cup" };
    if (c * 16 >= 0.75) return { text: `${fmtNum(Math.round(c * 16 * 2) / 2)} tbsp`, approx: i.u !== "tbsp" };
    return { text: `${fmtNum(Math.round(c * 48 * 4) / 4)} tsp`, approx: i.u !== "tsp" };
  }
  if (system === "g" && g != null && i.u !== "" && (i.u === "cup" || i.u === "tbsp" || i.u === "tsp" || i.u === "oz" || i.u === "lb")) {
    return { text: `${Math.round(g)} g`, approx: ["cup", "tbsp", "tsp"].includes(i.u) };
  }
  if (system === "g" && g != null && i.u === "" && eachOf(i.name)) return { text: fmtNum(q), approx: false };
  return { text: `${fmtNum(q)}${i.u ? ` ${i.u}` : ""}`, approx: false };
}

// Baker's percentages: flour = 100%, everything else against it. null if there's no flour.
export function bakersPct(ingredients, factor = 1) {
  const flour = ingredients.filter((i) => isFlour(i.name)).reduce((t, i) => t + (toGrams(i) ?? 0), 0) * factor;
  return flour ? { flour, of: (i) => (toGrams(i) != null ? ((toGrams(i) * factor) / flour) * 100 : null) } : null;
}
export const totalGrams = (ingredients) => ingredients.reduce((t, i) => t + (toGrams(i) ?? 0), 0);

// "4:00" for 240 minutes, "0:25" for 25
export const clockMins = (m) => `${Math.floor(m / 60)}:${String(Math.round(m % 60)).padStart(2, "0")}`;

// 1:05:09 or 4:09, counting down
export function clockLeft(ms) {
  const s = Math.floor(Math.max(0, ms) / 1000);
  const h = Math.floor(s / 3600);
  const m = String(Math.floor((s % 3600) / 60)).padStart(h ? 2 : 1, "0");
  return `${h ? `${h}:` : ""}${m}:${String(s % 60).padStart(2, "0")}`;
}
