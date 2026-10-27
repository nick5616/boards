// Corkboard cards: where a new one lands, and how pastes become cards.
import { uid } from "../utils/uid";

export const CARD_W = 148;
export const CARD_H = 104; // roughly; cards grow with their words, this is just for finding room
export const CARD_COLORS = ["#fffdf5", "#fff0a0", "#ffd3de", "#cfe6fb", "#d3efc4"];
export const STRING_COLORS = ["#c9302c", "#2f6fbd", "#3c8a4a", "#2a2520"];

// The first free slot on a loose grid, reading left to right
export function freeSpot(cards, cols = 2) {
  for (let i = 0; i < 200; i++) {
    const x = 16 + (i % cols) * (CARD_W + 14) + (Math.floor(i / cols) % 2) * 8;
    const y = 22 + Math.floor(i / cols) * (CARD_H + 14);
    if (!cards.some((c) => Math.abs(c.x - x) < CARD_W * 0.7 && Math.abs(c.y - y) < CARD_H * 0.7)) return { x, y };
  }
  return { x: 16, y: 22 };
}

export function newCard(cards, text = "") {
  return { id: uid(), text, color: CARD_COLORS[cards.length % 2 === 0 ? 0 : 1], ...freeSpot(cards) };
}

// Each line (or the whole paragraph) pinned up as its own card
export function withCards(state, texts) {
  const cards = [...(state.cards ?? [])];
  for (const t of texts) cards.push(newCard(cards, t));
  return { ...state, cards };
}
