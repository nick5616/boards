// Recipe tin: TheMealDB (test key 1, no signup, CORS on). The free key can only filter by
// ONE ingredient at a time, so "what can I make with a, b, c" asks for each and ranks
// meals by how many of the ingredients they use.
import { cachedJSON, DAY, HOUR } from "./apis";
import { uid } from "../utils/uid";
import { minsIn, parseNumber } from "./recipe";

const BASE = "https://www.themealdb.com/api/json/v1/1";
export const CREDIT = { text: "TheMealDB", url: "https://www.themealdb.com" };

const get = async (path, ttl = DAY) => (await cachedJSON(`${BASE}/${path}`, { ttl })).data?.meals ?? [];
const slim = (m) => ({ id: m.idMeal, name: m.strMeal, thumb: m.strMealThumb });

// ingredient words → API form ("chicken breast" → "chicken_breast")
const asIngredient = (s) => s.trim().toLowerCase().replace(/\s+/g, "_");

// Meals using at least one of the ingredients, most matches first.
// → [{ id, name, thumb, hits }]. An ingredient the API doesn't know just matches nothing.
export async function mealsWith(ingredients) {
  const list = [...new Set(ingredients.map((i) => i.trim()).filter(Boolean))].slice(0, 6);
  const found = await Promise.all(
    list.map((i) => get(`filter.php?i=${asIngredient(i)}`, 6 * HOUR).catch(() => []))
  );
  const byId = new Map();
  found.forEach((meals) =>
    meals.forEach((m) => {
      const hit = byId.get(m.idMeal) ?? { ...slim(m), hits: 0 };
      hit.hits += 1;
      byId.set(m.idMeal, hit);
    })
  );
  return [...byId.values()].sort((a, b) => b.hits - a.hits || a.name.localeCompare(b.name));
}

export const searchMeals = async (q) => (await get(`search.php?s=${encodeURIComponent(q.trim())}`, 6 * HOUR)).map(slim);

export async function randomMeal() {
  // never cached: a random pick should be new each time
  const res = await fetch(`${BASE}/random.php`);
  if (!res.ok) throw new Error(`${res.status}`);
  const m = (await res.json()).meals?.[0];
  return m ? slim(m) : null;
}

// The full meal → { id, name, thumb, area, category, source, youtube, ingredients: [{ q, u, name, raw }], steps: [text] }
export async function lookupMeal(id) {
  const m = (await get(`lookup.php?i=${id}`, 7 * DAY))[0];
  if (!m) return null;
  const ingredients = [];
  for (let n = 1; n <= 20; n++) {
    const name = (m[`strIngredient${n}`] ?? "").trim();
    if (!name) continue;
    ingredients.push({ name, measure: (m[`strMeasure${n}`] ?? "").trim() });
  }
  const steps = (m.strInstructions ?? "")
    .split(/\r?\n+/)
    .map((s) => s.trim().replace(/^(?:step\s*)?\d+[.):]\s*/i, ""))
    .filter((s) => s && !/^step\s*\d+$/i.test(s));
  return {
    ...slim(m),
    area: m.strArea ?? "",
    category: m.strCategory ?? "",
    source: m.strSource || "",
    youtube: m.strYoutube || "",
    ingredients,
    steps,
  };
}

// "1/2 cup" / "200g" / "2 large" → a Recipe-card ingredient { id, q, u, name }
const UNIT_RE = /^(g|gr|kg|oz|lb|lbs|ml|l|cups?|tbsp|tblsp|tbs|tsp|tablespoons?|teaspoons?)\b\.?\s*(.*)$/i;
const UNIT_MAP = { gr: "g", lbs: "lb", cups: "cup", tbs: "tbsp", tblsp: "tbsp", tablespoon: "tbsp", tablespoons: "tbsp", teaspoon: "tsp", teaspoons: "tsp" };
export function toRecipeIngredient({ name, measure }) {
  const m = measure.replace(/^\s+|\s+$/g, "");
  const num = m.match(/^(\d+\s+\d+\/\d+|\d+\/\d+|\d*[.,]?\d+)\s*(.*)$/);
  if (!num) return { id: uid(), q: null, u: "", name: m ? `${name} (${m})` : name };
  const q = parseNumber(num[1]);
  const rest = num[2];
  const u = rest.match(UNIT_RE);
  if (q != null && u) {
    const key = u[1].toLowerCase();
    return { id: uid(), q, u: UNIT_MAP[key] ?? key, name: u[2] ? `${name} (${u[2]})` : name };
  }
  // "2 large", "3 cloves": no known unit, keep the words with the name
  return { id: uid(), q: q ?? null, u: "", name: rest ? `${name} (${rest})` : name };
}

// A looked-up meal → the state of a Recipe card
export const recipeStateFor = (meal) => ({
  ingredients: meal.ingredients.map(toRecipeIngredient),
  steps: meal.steps.map((text) => ({ text, mins: minsIn(text) })),
  scale: 1,
  serves: 4,
  mode: "scale",
  system: "g",
});

// What a saved index card keeps: no photo data, just the link to the thumbnail
export const cardOf = (meal) => ({
  id: uid(),
  mealId: meal.id,
  name: meal.name,
  thumb: meal.thumb,
  area: meal.area,
  category: meal.category,
  at: Date.now(),
});

// Words from pantry item names that are worth asking about ("Heinz Baked Beans 415g" → "beans")
export function pantryWords(items) {
  const out = [];
  for (const it of items) {
    const words = it.name.toLowerCase().match(/[a-z]{3,}/g) ?? [];
    const last = words[words.length - 1];
    if (last && !["the", "and", "with", "free"].includes(last)) out.push(last);
  }
  return [...new Set(out)].slice(0, 12);
}

// Plain "pasta tonight" text for the home glance
export const dinnerSays = (state) => (state.tonight ? `🍳 ${state.tonight}` : null);
