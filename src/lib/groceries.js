import { uid } from "../utils/uid";

// Grocery helpers: which aisle a thing lives in, and reading a typed or pasted line.

export const AISLES = [
  { id: "produce", label: "Produce", icon: "🥬" },
  { id: "dairy", label: "Dairy & eggs", icon: "🥛" },
  { id: "bakery", label: "Bakery", icon: "🥖" },
  { id: "meat", label: "Meat & fish", icon: "🐟" },
  { id: "pantry", label: "Pantry", icon: "🥫" },
  { id: "frozen", label: "Frozen", icon: "🧊" },
  { id: "household", label: "Household", icon: "🧻" },
  { id: "other", label: "Other", icon: "🛒" },
];
export const AISLE_IDS = AISLES.map((a) => a.id);

// A small word table. Not clever: it looks for a known word in the line, and the
// aisle you pick by hand is remembered per word (state.learn) and wins next time.
const WORDS = {
  produce: "apple apples banana bananas lemon lemons lime limes orange oranges grapes berries strawberries blueberries avocado avocados tomato tomatoes potato potatoes onion onions garlic lettuce spinach kale carrot carrots celery cucumber pepper peppers broccoli cauliflower mushrooms mushroom zucchini corn herbs basil cilantro parsley ginger pear pears peach peaches mango melon salad squash cabbage",
  dairy: "milk cheese butter yogurt yoghurt cream eggs egg cheddar mozzarella parmesan sour kefir",
  bakery: "bread bagel bagels bun buns rolls tortilla tortillas pita croissant muffin muffins cake baguette donut donuts loaf",
  meat: "chicken beef pork steak bacon sausage sausages turkey ham fish salmon tuna shrimp mince lamb",
  pantry: "rice pasta flour sugar salt oil vinegar cereal oats beans lentils sauce soup stock broth coffee tea honey jam peanut nuts crackers chips snacks cookies spices cumin paprika ketchup mustard mayo noodles syrup chocolate canned",
  frozen: "frozen ice pizza fries nuggets popsicles",
  household: "soap detergent shampoo toothpaste tissues towels paper foil bags sponge sponges bleach cleaner batteries bulbs trash napkins wipes toilet laundry dish conditioner",
};
const TABLE = {};
for (const [aisle, list] of Object.entries(WORDS)) for (const w of list.split(" ")) TABLE[w] = aisle;

const words = (text) => text.toLowerCase().match(/[a-z]+/g) ?? [];

// The word that stands for an item when learning ("whole milk" -> "milk"): the last known word, else the last word
export const keyWord = (text) => {
  const ws = words(text);
  return [...ws].reverse().find((w) => TABLE[w]) ?? ws[ws.length - 1] ?? "";
};

export function guessAisle(text, learn = {}) {
  const ws = words(text);
  for (const w of [...ws].reverse()) if (learn[w]) return learn[w];
  // "frozen peas" is frozen even though peas could be pantry: frozen/ice wins when it's there
  if (ws.includes("frozen")) return "frozen";
  for (const w of [...ws].reverse()) if (TABLE[w]) return TABLE[w];
  return "other";
}

// "2 eggs", "2x eggs", "eggs x2", "3 cans tomatoes" -> { text, qty }
export function readLine(raw) {
  let s = String(raw ?? "").replace(/^[\s\-*•☐☑✓\[\]]+/, "").trim();
  if (!s) return null;
  let qty = 1;
  let m = s.match(/^(\d{1,3})\s*(?:x|×)?\s+(.+)$/i);
  if (m) {
    qty = parseInt(m[1], 10);
    s = m[2];
  } else if ((m = s.match(/^(.+?)\s*(?:x|×)\s*(\d{1,3})$/i))) {
    qty = parseInt(m[2], 10);
    s = m[1];
  }
  s = s.trim();
  return s ? { text: s, qty: Math.max(1, qty) } : null;
}

// Add (or bump, if it's already on the list) one line of a shopping list
export function addLine(state, line) {
  const got = readLine(line);
  if (!got) return state;
  const items = state.items ?? [];
  const same = items.find((i) => !i.done && i.text.toLowerCase() === got.text.toLowerCase());
  if (same) return { ...state, items: items.map((i) => (i === same ? { ...i, qty: (i.qty ?? 1) + got.qty } : i)) };
  return {
    ...state,
    items: [...items, { id: uid(), text: got.text, qty: got.qty, aisle: guessAisle(got.text, state.learn), done: false, at: Date.now() }],
  };
}

export const toBuy = (state) => (state.items ?? []).filter((i) => !i.done).length;
