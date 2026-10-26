import { dayKey } from "../../utils/date";
import { GLANCES } from "./glances";

// The bits of a board the home views surface: { next, ticket, status }, each a
// short line or null, gathered from the per-module glances.
export function boardFacts(board, me) {
  const today = dayKey();
  const rows = { next: [], ticket: [], status: [] };
  for (const [type, g] of Object.entries(GLANCES)) {
    const mods = board.modules.filter((m) => m.type === type);
    const line = mods.length ? g.say(mods, today, me) : null;
    if (line) rows[g.row].push(line);
  }
  return {
    next: rows.next[0] ?? null,
    ticket: rows.ticket[0] ?? null,
    status: rows.status.join(" · ") || null,
  };
}
