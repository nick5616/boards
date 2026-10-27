// Pantry shelf logic: expiry states, barcode reading and the Open Food Facts lookup.
// The lookup runs from this browser straight to Open Food Facts (no key, CORS on).
import { cachedJSON, DAY } from "./apis";
import { dayKey, dayDiff, keyToDate, addDays } from "../utils/date";

export const SHELVES = [
  { id: "pantry", label: "Pantry", icon: "🥫" },
  { id: "fridge", label: "Fridge", icon: "🧊" },
  { id: "freezer", label: "Freezer", icon: "❄️" },
];
export const SOON_DAYS = 7;

// "expired" and "soon" only mean something with a date; anything else is just "ok" / "nodate"
export function statusOf(item, now = new Date()) {
  if (!item.expires) return "nodate";
  const d = dayDiff(now, keyToDate(item.expires));
  if (d < 0) return "expired";
  if (d <= SOON_DAYS) return "soon";
  return "ok";
}

export const shelfItems = (state) => (state.items ?? []).filter((i) => !i.doneAt);
export const donePile = (state) => (state.items ?? []).filter((i) => i.doneAt).sort((a, b) => b.doneAt - a.doneAt);

// Things to use up this week (expired ones still count: they're yours to deal with)
export function useUpList(state, now = new Date()) {
  return shelfItems(state)
    .filter((i) => ["soon", "expired"].includes(statusOf(i, now)))
    .sort((a, b) => a.expires.localeCompare(b.expires));
}

export const useUpCount = (mods, now = new Date()) => mods.reduce((t, m) => t + useUpList(m.state, now).length, 0);

export const inDays = (n, now = new Date()) => dayKey(addDays(now, n));

export function expiryWords(item, now = new Date()) {
  if (!item.expires) return "no date";
  const d = dayDiff(now, keyToDate(item.expires));
  if (d < -1) return `expired ${-d}d ago`;
  if (d === -1) return "expired yesterday";
  if (d === 0) return "use today";
  if (d === 1) return "use by tomorrow";
  if (d <= SOON_DAYS) return `use within ${d}d`;
  if (d < 60) return `${Math.round(d / 7)}w left`;
  return `${Math.round(d / 30)}mo left`;
}

// Which shelf a product probably lives on, from Open Food Facts category tags
function shelfFor(tags = []) {
  const t = tags.join(" ");
  if (/frozen/.test(t)) return "freezer";
  if (/dairies|fresh|meats|fishes|yogurts|cheeses|eggs/.test(t)) return "fridge";
  return "pantry";
}

// Digits a person typed or a scanner read → a clean code, or null
export const cleanCode = (s) => {
  const d = String(s ?? "").replace(/\D/g, "");
  return d.length >= 8 && d.length <= 14 ? d : null;
};

// → { code, name, brand, qty, grade, img, shelf } or null when Open Food Facts hasn't heard of it
export async function lookupBarcode(code) {
  const url = `https://world.openfoodfacts.org/api/v2/product/${code}.json?fields=product_name,brands,quantity,nutriscore_grade,image_small_url,categories_tags`;
  const { data } = await cachedJSON(url, { ttl: 30 * DAY });
  const p = data?.product;
  if (data?.status === 0 || !p || !p.product_name) return null;
  const brand = (p.brands ?? "").split(",")[0].trim();
  return {
    code,
    name: p.product_name.trim(),
    brand,
    qty: (p.quantity ?? "").trim(),
    grade: /^[a-e]$/.test(p.nutriscore_grade ?? "") ? p.nutriscore_grade : "",
    img: p.image_small_url ?? "",
    shelf: shelfFor(p.categories_tags),
  };
}

// ── Barcodes ─────────────────────────────────────────────────────────────────
export const canScan = () => typeof window !== "undefined" && "BarcodeDetector" in window;

let detector = null;
const getDetector = () =>
  (detector ??= new window.BarcodeDetector({ formats: ["ean_13", "ean_8", "upc_a", "upc_e", "code_128"] }));

// A video frame, image, canvas or bitmap → the first digits-looking code in it, or null
export async function readBarcode(source) {
  if (!canScan()) return null;
  try {
    const found = await getDetector().detect(source);
    for (const f of found) {
      const c = cleanCode(f.rawValue);
      if (c) return c;
    }
  } catch { /* an odd frame; just try the next one */ }
  return null;
}

export async function readBarcodeFromFile(file) {
  try {
    const bmp = await createImageBitmap(file);
    const code = await readBarcode(bmp);
    bmp.close?.();
    return code;
  } catch {
    return null;
  }
}
