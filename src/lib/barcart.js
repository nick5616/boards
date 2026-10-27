// Bar cart: TheCocktailDB (test key 1, no signup, CORS on). Same shape as TheMealDB, and the
// free key also filters by ONE ingredient at a time, so we ask for each bottle on the cart
// and rank drinks by how many of those bottles they use.
import { cachedJSON, DAY, HOUR } from "./apis";

const BASE = "https://www.thecocktaildb.com/api/json/v1/1";
export const CREDIT = { text: "TheCocktailDB", url: "https://www.thecocktaildb.com" };

// What goes on the cart: [api name, label, group]
export const BOTTLES = [
  ["Gin", "gin", "spirit"], ["Vodka", "vodka", "spirit"], ["Light rum", "white rum", "spirit"], ["Dark rum", "dark rum", "spirit"],
  ["Tequila", "tequila", "spirit"], ["Bourbon", "bourbon", "spirit"], ["Scotch", "scotch", "spirit"], ["Brandy", "brandy", "spirit"],
  ["Triple sec", "triple sec", "liqueur"], ["Amaretto", "amaretto", "liqueur"], ["Campari", "campari", "liqueur"], ["Kahlua", "coffee liqueur", "liqueur"],
  ["Dry Vermouth", "dry vermouth", "liqueur"], ["Sweet Vermouth", "sweet vermouth", "liqueur"], ["Angostura bitters", "bitters", "liqueur"],
  ["Lime juice", "lime juice", "mixer"], ["Lemon juice", "lemon juice", "mixer"], ["Sugar syrup", "simple syrup", "mixer"], ["Orange juice", "orange juice", "mixer"],
  ["Soda water", "soda water", "mixer"], ["Tonic water", "tonic", "mixer"], ["Ginger beer", "ginger beer", "mixer"], ["Cranberry juice", "cranberry", "mixer"],
  ["Mint", "mint", "mixer"], ["Lime", "limes", "mixer"], ["Egg white", "egg white", "mixer"],
];
export const GROUPS = [
  { id: "spirit", label: "spirits" },
  { id: "liqueur", label: "liqueurs & bitters" },
  { id: "mixer", label: "mixers & fresh" },
];
export const labelOf = (apiName) => BOTTLES.find((b) => b[0].toLowerCase() === apiName.toLowerCase())?.[1] ?? apiName.toLowerCase();

const get = async (path, ttl = DAY) => (await cachedJSON(`${BASE}/${path}`, { ttl })).data?.drinks;
const slim = (d) => ({ id: d.idDrink, name: d.strDrink, thumb: d.strDrinkThumb });

// The free key's "filter by ingredient" gives back a single drink, so instead we read the
// drinks by first letter (search.php?f=, up to 25 each, ~600 in all) once, keep a slim copy
// in this browser for a week, and match your bottles against that. Not every drink in the
// book, but a good shelf of them; searching by name asks the API directly.
const INDEX_KEY = "boards-kitchen:cocktails-v1";
const LETTERS = "abcdefghijklmnopqrstuvwxyz".split("");
let memo = null;

const fullOf = (d) => {
  const ingredients = [];
  for (let n = 1; n <= 15; n++) {
    const name = (d[`strIngredient${n}`] ?? "").trim();
    if (name) ingredients.push({ name, measure: (d[`strMeasure${n}`] ?? "").trim() });
  }
  return {
    ...slim(d),
    glass: d.strGlass ?? "",
    alcoholic: d.strAlcoholic ?? "",
    method: (d.strInstructions ?? "").trim(),
    ingredients,
  };
};

export async function loadIndex() {
  if (memo) return memo;
  try {
    const hit = JSON.parse(localStorage.getItem(INDEX_KEY) || "null");
    if (hit && Date.now() - hit.at < 7 * DAY && hit.drinks?.length) return (memo = hit.drinks);
  } catch { /* fine */ }
  const drinks = [];
  for (let i = 0; i < LETTERS.length; i += 7) {
    const batch = await Promise.all(
      LETTERS.slice(i, i + 7).map((l) =>
        fetch(`${BASE}/search.php?f=${l}`).then((r) => (r.ok ? r.json() : null)).catch(() => null)
      )
    );
    batch.forEach((b) => (b?.drinks ?? []).forEach((d) => drinks.push({ ...fullOf(d), method: fullOf(d).method.slice(0, 600) })));
  }
  if (!drinks.length) {
    try { // offline: an old copy beats nothing
      const old = JSON.parse(localStorage.getItem(INDEX_KEY) || "null");
      if (old?.drinks?.length) return (memo = old.drinks);
    } catch { /* fine */ }
    throw new Error("couldn't read the cocktail book");
  }
  try { localStorage.setItem(INDEX_KEY, JSON.stringify({ at: Date.now(), drinks })); } catch { /* too big; it just won't be kept */ }
  return (memo = drinks);
}

const FREE = /^(ice|water|ice cubes?|crushed ice|salt|sugar)$/i;
const isFree = (name) => FREE.test(name);
const NOT_BOOZE = /^non alcoholic/i;

// Drinks that use at least one of your bottles → [{ id, name, thumb, hits, missing }], the ones you
// can make outright first, then the most of your bottles. mocktails: alcohol-free drinks only.
export async function drinksWith(bottles, mocktails = false) {
  const have = new Set(bottles.map((b) => b.toLowerCase()));
  const index = await loadIndex();
  return index
    .filter((d) => !mocktails || NOT_BOOZE.test(d.alcoholic))
    .map((d) => {
      const hits = d.ingredients.filter((i) => have.has(i.name.toLowerCase())).length;
      const missing = d.ingredients.filter((i) => !have.has(i.name.toLowerCase()) && !isFree(i.name)).length;
      return { id: d.id, name: d.name, thumb: d.thumb, hits, missing };
    })
    .filter((d) => d.hits > 0)
    .sort((a, b) => a.missing - b.missing || b.hits - a.hits || a.name.localeCompare(b.name))
    .filter((d, _, all) => d.missing <= 3 || all.length < 12);
}

// No bottles ticked, mocktail filter on: just the alcohol-free list
export async function mocktailList() {
  return (await loadIndex()).filter((d) => NOT_BOOZE.test(d.alcoholic)).map(({ id, name, thumb }) => ({ id, name, thumb }));
}

export async function searchDrinks(q) {
  return ((await get(`search.php?s=${encodeURIComponent(q.trim())}`, 6 * HOUR)) ?? []).map(slim);
}

export async function randomDrink(mocktails = false) {
  if (mocktails) {
    const list = await mocktailList();
    return list.length ? list[Math.floor(Math.random() * list.length)] : null;
  }
  const res = await fetch(`${BASE}/random.php`); // never cached
  if (!res.ok) throw new Error(`${res.status}`);
  const d = (await res.json()).drinks?.[0];
  return d ? slim(d) : null;
}

// → { id, name, thumb, glass, alcoholic, method, ingredients: [{ name, measure }] }
export async function lookupDrink(id) {
  const d = (await get(`lookup.php?i=${id}`, 7 * DAY))?.[0];
  return d ? fullOf(d) : null;
}

// Do I have this ingredient on the cart? ("Lime juice" vs a ticked "Lime juice"; water and ice are free)
export const haveIt = (name, ticked) =>
  isFree(name) || ticked.some((t) => t.toLowerCase() === name.toLowerCase());

export const missingFor = (drink, ticked) => drink.ingredients.filter((i) => !haveIt(i.name, ticked));
