import { dayDiff, keyToDate, untilLabel } from "../../utils/date";
import { dueCards } from "../modules/Flashcards";
import { isRecording } from "../../lib/tape";
import { barCount } from "../../lib/staff";
import { radioSnap } from "../../lib/radio";
import { slipOfTheDay } from "../modules/Highlights";
import { nextDue, unitsDone } from "../modules/Syllabus";
import { todayMarks, phaseOf, PHASE_NAME } from "../../lib/pomodoro";
import { isCapturing } from "../../lib/timelapse";
import { agoLabel } from "../../utils/date";
import { weekMiles } from "../modules/Route";
import { capsuleSays } from "../modules/Capsule";
import { routineSays } from "../modules/Routine";
import { thirstyPlants, sowThisWeek } from "../../lib/garden";
import { isDrawing } from "../../lib/gesture";
import { streakOf } from "../modules/Sketchbook";
import { openChores } from "../modules/Chores";
import { toBuy } from "../../lib/groceries";
import { money, balanceOf } from "../modules/Piggy";
import { initiativeNow } from "../modules/Initiative";
import { glanceLine, needsRefill } from "../../lib/meds";
import { wordOfDay, isTorn, streakOf as kanjiStreak } from "../../lib/words";
// @pack:words
import { memorized, crateNext } from "../../lib/music";
// @pack:music
import { glanceFor as tvGlance } from "../../lib/screen";
import { glanceFor as bookGlance } from "../../lib/paperback";
import { glanceFor as gameGlance } from "../../lib/backlog";
// @pack:screen
import { glanceLine as chessGlance } from "../../lib/chesspuzzle";
import { glanceLine as triviaGlance } from "../../lib/trivia";
import { glanceLine as almanacGlance } from "../../lib/almanac";
// @pack:games
import { glanceFor as baroGlance } from "../../lib/barometer";
import { glanceFor as skyGlance } from "../../lib/stargazer";
import { glanceFor as fieldGlance } from "../../lib/fieldguide";
import { glanceFor as tideGlance } from "../../lib/tides";
// @pack:sky
import { passportGlance, walletGlance, daysOffGlance, errandsGlance } from "../../lib/travel";
// @pack:travel
import { useUpCount } from "../../lib/pantry";
// @pack:kitchen
import { toRead } from "../../lib/catalog";
import { paperSays } from "../modules/Paper";
import { latestPR } from "../../lib/lifting";
import { glanceOf } from "../../lib/worldclock";
// @pack:desk
// @pack:live

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
    say: (mods, today, me) => {
      const n = mods.reduce((t, m) => t + dueCards(m.state, today, me).length, 0);
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
  books: {
    row: "status",
    say: (mods) => {
      const b = mods.flatMap((m) => m.state.books ?? []).filter((b) => b.status === "reading").sort((a, b) => (b.at ?? 0) - (a.at ?? 0))[0];
      return b ? `📖 ${b.title}${b.pages ? ` p.${b.page ?? 0}/${b.pages}` : ""}` : null;
    },
  },
  highlights: {
    row: "status",
    say: (mods, today) => {
      const s = slipOfTheDay(mods.flatMap((m) => m.state.slips ?? []), today);
      return s ? `❝ ${s.text.length > 60 ? s.text.slice(0, 58) + "…" : s.text}` : null;
    },
  },
  focus: {
    row: "status",
    say: (mods) => {
      const m = mods.find((m) => m.state.startedAt);
      if (m) return `🍅 ${PHASE_NAME[phaseOf(m.state)]} on`;
      const n = mods.reduce((t, m) => t + todayMarks(m.state).length, 0);
      return n > 0 ? `🍅 ${n} focus round${n === 1 ? "" : "s"} today` : null;
    },
  },
  syllabus: {
    row: "status",
    say: (mods) => {
      const { done, total } = mods.reduce((t, m) => ((x) => ({ done: t.done + x.done, total: t.total + x.total }))(unitsDone(m.state)), { done: 0, total: 0 });
      if (!total) return null;
      const next = mods.map((m) => nextDue(m.state)).filter(Boolean).sort((a, b) => a.due.localeCompare(b.due))[0];
      return `📚 ${Math.round((done / total) * 100)}%${next ? ` · next ${untilLabel(next.due)}` : ""}`;
    },
  },
  timelapse: {
    row: "status",
    say: (mods) => {
      if (mods.some((m) => isCapturing(m.id))) return "📷 time-lapse running";
      const n = mods.reduce((t, m) => t + (m.state.frames?.length ?? 0), 0);
      return n > 0 ? `📷 ${n} frame${n === 1 ? "" : "s"}` : null;
    },
  },
  bakes: {
    row: "status",
    say: (mods) => {
      const at = Math.max(0, ...mods.flatMap((m) => (m.state.bakes ?? []).map((b) => b.at)));
      return at ? `🍞 last bake ${agoLabel(at)}` : null;
    },
  },
  paperdoll: {
    row: "status",
    say: (mods) => {
      const n = mods.reduce((t, m) => t + (m.state.looks ?? []).filter((l) => l.layers?.length).length, 0);
      return n > 0 ? `👗 ${n} outfit${n === 1 ? "" : "s"}` : null;
    },
  },
  closet: {
    row: "status",
    say: (mods) => {
      const n = mods.reduce((t, m) => t + (m.state.items?.length ?? 0), 0);
      return n > 0 ? `🧥 ${n} in the closet` : null;
    },
  },
  // Measurements are personal: nothing shows unless the person turned it on in the module
  measure: {
    row: "status",
    say: (mods) => {
      const m = mods.find((m) => m.state.glance && Object.values(m.state.vals ?? {}).some((v) => v !== "" && v != null));
      if (!m) return null;
      const v = m.state.vals;
      const bits = ["bust", "waist", "hips"].filter((k) => v[k]).map((k) => v[k]);
      return bits.length ? `📏 ${bits.join(" / ")} ${m.state.unit ?? "in"}` : "📏 measured";
    },
  },
  route: {
    row: "status",
    say: (mods) => {
      const mi = mods.reduce((t, m) => t + weekMiles(m.state.runs), 0);
      return mi > 0 ? `🏃 ${mi.toFixed(1)} mi this week` : null;
    },
  },
  shoes: {
    row: "status",
    say: (mods) => {
      const m = mods[0];
      return m && m.state.miles > 0 ? `👟 ${Math.round(m.state.miles)}/${m.state.retireAt ?? 400} mi` : null;
    },
  },
  capsule: { row: "status", say: (mods) => capsuleSays(mods) },
  routine: { row: "status", say: (mods) => routineSays(mods) },
  plants: {
    row: "status",
    say: (mods) => {
      const names = mods.flatMap((m) => thirstyPlants(m.state).map((p) => p.name || "a plant"));
      if (!names.length) return null;
      return `🪴 ${names.length} thirsty: ${names.slice(0, 2).join(", ")}${names.length > 2 ? "…" : ""}`;
    },
  },
  garden: {
    row: "status",
    say: (mods) => {
      const jobs = mods.flatMap((m) => sowThisWeek(m.state));
      return jobs.length ? `🌱 ${jobs[0].what} ${jobs[0].seed.name}${jobs.length > 1 ? ` +${jobs.length - 1}` : ""}` : null;
    },
  },
  propagate: {
    row: "status",
    say: (mods) => {
      const n = mods.reduce((t, m) => t + (m.state.cuttings ?? []).filter((c) => c.roots >= 2.5).length, 0);
      return n > 0 ? `🫙 ${n} cutting${n === 1 ? "" : "s"} ready to pot` : null;
    },
  },
  gesture: {
    row: "status",
    say: (mods) => {
      const running = mods.find((m) => isDrawing(m.id));
      if (running) return "✏️ drawing";
      const n = mods.reduce((t, m) => t + (m.state.images?.length ?? 0), 0);
      return n > 0 ? `✏️ ${n} reference${n === 1 ? "" : "s"}` : null;
    },
  },
  sketchbook: {
    row: "status",
    say: (mods) => {
      const pages = mods.flatMap((m) => m.state.pages ?? []);
      const streak = streakOf(pages);
      return streak > 1 ? `📓 ${streak}-day streak` : pages.length ? `📓 ${pages.length} page${pages.length === 1 ? "" : "s"}` : null;
    },
  },
  // the typewriter keeps today's count in its own state (it can't see the board's Notes from here)
  typewriter: {
    row: "status",
    say: (mods, today) => {
      const m = mods[0];
      if (!m) return null;
      const n = m.state.nday === today ? m.state.n ?? 0 : 0;
      return `⌨️ ${n.toLocaleString()}/${(m.state.goal ?? 500).toLocaleString()} words today`;
    },
  },
  corkboard: {
    row: "status",
    say: (mods) => {
      const n = mods.reduce((t, m) => t + (m.state.cards?.length ?? 0), 0);
      return n > 0 ? `📌 ${n} card${n === 1 ? "" : "s"}` : null;
    },
  },
  chores: {
    row: "status",
    say: (mods) => {
      const n = mods.reduce((t, m) => t + openChores(m.state), 0);
      return n > 0 ? `🎡 ${n} chore${n === 1 ? "" : "s"} to do` : null;
    },
  },
  groceries: {
    row: "status",
    say: (mods) => {
      const n = mods.reduce((t, m) => t + toBuy(m.state), 0);
      return n > 0 ? `🛒 ${n} to buy` : null;
    },
  },
  piggy: {
    row: "status",
    say: (mods) => {
      const m = mods.find((m) => m.state.pigs?.length);
      const p = m?.state.pigs[0];
      return p ? `🐷 ${money(balanceOf(p), m.state.cur)} of ${money(p.goal, m.state.cur)}` : null;
    },
  },
  initiative: {
    row: "status",
    say: (mods) => {
      const now = mods.map((m) => initiativeNow(m.state)).find(Boolean);
      return now ? `⚔ round ${now.round} · ${now.name}'s turn` : null;
    },
  },
  // Names stay off the home screen when the cabinet is set to hide them
  meds: {
    row: "status",
    say: (mods) => [glanceLine(mods), needsRefill(mods) && "💊 refill soon"].filter(Boolean).join(" · ") || null,
  },
  wordday: {
    row: "status",
    say: (mods) => {
      const m = mods.find((x) => !isTorn(x.state));
      return m ? `📖 word of the day: ${wordOfDay(m.state).word}` : null;
    },
  },
  phrasebook: {
    row: "status",
    say: (mods) => {
      const n = mods.reduce((a, m) => a + (m.state.phrases?.length ?? 0), 0);
      return n ? `🗣 ${n} phrase${n === 1 ? "" : "s"} in the phrasebook` : null;
    },
  },
  kanji: {
    row: "status",
    say: (mods) => {
      const best = Math.max(0, ...mods.map((m) => streakOf(m.state.days)));
      return best ? `🈶 ${best}-day kanji streak` : null;
    },
  },
  poems: {
    row: "status",
    say: (mods) => {
      const n = mods.reduce((a, m) => a + (m.state.favs?.length ?? 0), 0);
      return n ? `📜 ${n} favorite poem${n === 1 ? "" : "s"}` : null;
    },
  },
  // @pack:words
  lyrics: {
    row: "status",
    say: (mods) => {
      const m = mods.find((m) => m.state.song);
      if (!m) return null;
      const { got, total } = memorized(m.state);
      return total ? `🎤 memorized ${got}/${total} lines of ${m.state.song.title}` : null;
    },
  },
  crate: {
    row: "status",
    say: (mods) => {
      const next = mods.map((m) => crateNext(m.state)).find(Boolean);
      return next ? `🎵 next up: ${next.title}` : null;
    },
  },
  scrobbles: {
    row: "status",
    say: (mods) => {
      const m = mods.find((m) => m.state.onRepeat?.artist);
      return m ? `🎧 on repeat: ${m.state.onRepeat.artist}` : null;
    },
  },
  // @pack:music
  tvguide: {
    row: "status",
    say: (mods) => tvGlance(mods.map((m) => m.state.items ?? [])),
  },
  paperback: {
    row: "status",
    say: (mods) => bookGlance(mods.map((m) => m.state)),
  },
  backlog: {
    row: "status",
    say: (mods) => gameGlance(mods.map((m) => m.state)),
  },
  // @pack:screen
  chesspuzzle: { row: "status", say: (mods) => chessGlance(mods) },
  trivia: { row: "status", say: (mods) => triviaGlance(mods) },
  almanac: { row: "status", say: (mods) => almanacGlance(mods) },
  // @pack:games
  barometer: {
    row: "status",
    say: (mods) => mods.map((m) => baroGlance(m.state)).find(Boolean) ?? null,
  },
  stargazer: {
    row: "status",
    say: (mods) => mods.map((m) => skyGlance(m.state)).find(Boolean) ?? null,
  },
  fieldguide: {
    row: "status",
    say: (mods) => fieldGlance(mods),
  },
  tides: {
    row: "status",
    say: (mods) => mods.map((m) => tideGlance(m.state)).find(Boolean) ?? null,
  },
  // @pack:sky
  passport: { row: "status", say: (mods) => mods.map((m) => passportGlance(m.state)).find(Boolean) ?? null },
  wallet: { row: "status", say: (mods) => mods.map((m) => walletGlance(m.state)).find(Boolean) ?? null },
  daysoff: { row: "next", say: (mods) => mods.map((m) => daysOffGlance(m.state)).find(Boolean) ?? null },
  errands: { row: "status", say: (mods) => mods.map((m) => errandsGlance(m.state)).find(Boolean) ?? null },
  // @pack:travel
  pantry: {
    row: "status",
    say: (mods) => {
      const n = useUpCount(mods);
      return n > 0 ? `🥫 ${n} thing${n === 1 ? "" : "s"} to use up this week` : null;
    },
  },
  recipetin: {
    row: "status",
    say: (mods) => {
      const t = mods.find((m) => m.state.tonight)?.state.tonight;
      return t ? `🍳 tonight: ${t}` : null;
    },
  },
  // @pack:kitchen
  catalog: {
    row: "status",
    say: (mods) => {
      const n = mods.reduce((t, m) => t + toRead(m.state).length, 0);
      return n ? `🗂 ${n} to read` : null;
    },
  },
  paper: {
    row: "status",
    say: (mods) => {
      const t = paperSays(mods);
      return t ? `📰 ${t.length > 60 ? `${t.slice(0, 57)}…` : t}` : null;
    },
  },
  lifting: {
    row: "status",
    say: (mods) => {
      const log = mods.flatMap((m) => m.state.log ?? []).sort((a, b) => b.at - a.at);
      const pr = latestPR(log, mods.find((m) => m.state.log?.length)?.state.unit);
      return pr ? `🏋 PR: ${pr}` : null;
    },
  },
  worldclock: {
    row: "status",
    say: (mods) => {
      const line = glanceOf(mods.find((m) => m.state.people?.length)?.state.people);
      return line ? `🕰 ${line}` : null;
    },
  },
  // @pack:desk
  drawit: {
    row: "status",
    say: (mods) => {
      const n = mods.reduce((t, m) => t + (m.state.games?.length ?? 0), 0);
      return n > 0 ? `🎨 ${n} game${n === 1 ? "" : "s"} played` : null;
    },
  },
  // @pack:live
};
