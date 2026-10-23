import { dayKey, dayDiff, keyToDate } from "../../utils/date";

// The bits of a board the home views surface: its current sticky note and
// the soonest ticket in the next two weeks.
export function boardFacts(board) {
  const next = board.modules.find((m) => m.type === "nextup" && m.state.items?.length)?.state.items[0]?.text;
  const today = dayKey();
  const ticket = board.modules
    .filter((m) => m.type === "tickets")
    .flatMap((m) => m.state.items ?? [])
    .filter((t) => t.date >= today && dayDiff(new Date(), keyToDate(t.date)) <= 14)
    .sort((a, b) => a.date.localeCompare(b.date))[0];
  return { next, ticket };
}
