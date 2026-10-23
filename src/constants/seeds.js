import { newModule } from "./modules";
import { uid } from "../utils/uid";
import { dayKey, addDays } from "../utils/date";

// Starter content for a brand-new account (existing accounts are migrated instead)
export const seedBoards = () => {
  const note = (text) => ({ id: uid(), text, createdAt: Date.now() });
  const tracker = newModule("tracker", { x: 0, y: 0 });
  const nextup = newModule("nextup", { x: 360, y: 20 }, {
    state: { items: [note("Suzuki book 1, #7"), note("#8 — slow, with drone")], done: [] },
  });
  const tickets = newModule("tickets", { x: 600, y: 0 }, {
    state: { items: [{ ...note("Symphony concert"), date: dayKey(addDays(new Date(), 12)) }] },
  });
  const wishlist = newModule("wishlist", { x: 0, y: 320 }, {
    state: { items: [note("Shoulder rest"), note("Trial lesson")], done: [] },
  });
  return [
    {
      title: "Violin",
      color: { h: 30, s: 60, l: 80 },
      stampId: "music",
      layout: "bleed",
      status: "active",
      modules: [tracker, nextup, tickets, wishlist],
      mobileOrder: [tracker.id, nextup.id, tickets.id, wishlist.id],
    },
    {
      title: "Spanish",
      color: { h: 50, s: 80, l: 78 },
      stampId: "book",
      layout: "bubble",
      status: "someday",
      modules: [newModule("tracker", { x: 0, y: 0 }), newModule("nextup", { x: 360, y: 20 })],
    },
  ];
};
