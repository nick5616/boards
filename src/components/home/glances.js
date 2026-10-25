import { dayDiff, keyToDate, untilLabel } from "../../utils/date";
import { dueCards } from "../modules/Flashcards";
import { isRecording } from "../../lib/tape";
import { barCount } from "../../lib/staff";
import { radioSnap } from "../../lib/radio";

// What each kind of module has to say on the home Glance. Each takes ALL of that
// type's modules on a board (so tickets can pick the soonest across them) and
// returns a short line or null. `row` is which line of the board's row it lands
// on; several on one row are joined with " · ".
// These live here, not on MODULES, because Flashcards (a component) is needed
// and constants/modules.js shouldn't import components.
export const GLANCES = {
  nextup: {
    row: "next",
    say: (mods) => mods.find((m) => m.state.items?.length)?.state.items[0]?.text ?? null,
  },
  tickets: {
    row: "ticket",
    say: (mods, today) => {
      const t = mods
        .flatMap((m) => m.state.items ?? [])
        .filter((t) => t.date >= today && dayDiff(new Date(), keyToDate(t.date)) <= 14)
        .sort((a, b) => a.date.localeCompare(b.date))[0];
      return t ? `🎟 ${t.text} · ${untilLabel(t.date)}` : null;
    },
  },
  timer: {
    row: "status",
    say: (mods) => (mods.some((m) => m.state.startedAt) ? "⏱ timer running" : null),
  },
  flashcards: {
    row: "status",
    say: (mods, today) => {
      const n = mods.reduce((t, m) => t + dueCards(m.state, today).length, 0);
      return n > 0 ? `🗂 ${n} card${n === 1 ? "" : "s"} due` : null;
    },
  },
  // (a live "🎹 playing" can't show here: a session isn't saved, only the kept phrases are)
  keys: {
    row: "status",
    say: (mods) => {
      const n = mods.reduce((t, m) => t + (m.state.phrases?.length ?? 0), 0);
      return n > 0 ? `🎹 ${n} phrase${n === 1 ? "" : "s"}` : null;
    },
  },
  metronome: {
    row: "status",
    say: (mods) => {
      const m = mods.find((m) => m.state.startedAt);
      return m ? `♩ metronome at ${m.state.bpm ?? 90}` : null;
    },
  },
  tape: {
    row: "status",
    say: (mods) => {
      if (mods.some((m) => isRecording(m.id))) return "📼 recording";
      const n = mods.reduce((t, m) => t + (m.state.takes?.length ?? 0), 0);
      return n > 0 ? `📼 ${n} take${n === 1 ? "" : "s"}` : null;
    },
  },
  staff: {
    row: "status",
    say: (mods) => {
      const n = mods.reduce((t, m) => t + barCount(m.state), 0);
      return n > 0 ? `🎼 ${n} bar${n === 1 ? "" : "s"}` : null;
    },
  },
  magnets: {
    row: "status",
    say: (mods) => {
      const n = mods.reduce((t, m) => t + (m.state.words?.length ?? 0), 0);
      return n > 0 ? `🧲 ${n} magnet${n === 1 ? "" : "s"}` : null;
    },
  },
  radio: {
    row: "status",
    say: (mods) => {
      const m = mods.find((m) => m.state.startedAt);
      if (!m) return null;
      // Name the song when we know it (the engine only knows the one that's playing)
      const { modId, song } = radioSnap();
      return song && modId === m.id ? `📻 ♪ ${song.title}` : `📻 on: ${m.state.station?.name ?? "static"}`;
    },
  },
  mirror: {
    row: "status",
    say: (mods) => {
      const n = mods.reduce((t, m) => t + (m.state.snaps?.length ?? 0), 0);
      return n > 0 ? `🪞 ${n} snap${n === 1 ? "" : "s"}` : null;
    },
  },
  photostrip: {
    row: "status",
    say: (mods) => {
      const n = mods.reduce((t, m) => t + (m.state.strips?.length ?? 0), 0);
      return n > 0 ? `🎞 ${n} strip${n === 1 ? "" : "s"}` : null;
    },
  },
};
