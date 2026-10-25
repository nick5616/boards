import { dayKey, dayDiff, keyToDate } from "../../utils/date";
import { dueCards } from "../modules/Flashcards";

// The bits of a board the home views surface: its current sticky note, the
// soonest ticket in the next two weeks, flashcards waiting, a running timer.
export function boardFacts(board) {
  const next = board.modules.find((m) => m.type === "nextup" && m.state.items?.length)?.state.items[0]?.text;
  const today = dayKey();
  const ticket = board.modules
    .filter((m) => m.type === "tickets")
    .flatMap((m) => m.state.items ?? [])
    .filter((t) => t.date >= today && dayDiff(new Date(), keyToDate(t.date)) <= 14)
    .sort((a, b) => a.date.localeCompare(b.date))[0];
  const due = board.modules
    .filter((m) => m.type === "flashcards")
    .reduce((n, m) => n + dueCards(m.state, today).length, 0);
  const timing = board.modules.some((m) => m.type === "timer" && m.state.startedAt);
  return { next, ticket, due, timing };
}
