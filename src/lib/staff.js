// Music-on-paper maths for the staff paper: midi <-> staff position, bars, and
// where everything sits on the page. No React in here.

const NATURAL_PC = [0, 2, 4, 5, 7, 9, 11]; // C D E F G A B
const IS_NATURAL = [true, false, true, false, true, true, false, true, false, true, false, true];

// Diatonic step of the bottom line: E4 on the treble staff, G2 on the bass staff
// (C4 is step 28; every line or space is one step)
export const CLEF_BASE = { treble: 30, bass: 18 };

export const isBlack = (m) => !IS_NATURAL[((m % 12) + 12) % 12];

// A black key is spelled as a sharp unless the note says flat
export const spelled = (n) => (n.m != null && isBlack(n.m) ? n.acc ?? "#" : undefined);

// midi + spelling -> the line/space it sits on
export function stepOf(m, acc) {
  const nat = isBlack(m) ? (acc === "b" ? m + 1 : m - 1) : m;
  const oct = Math.floor(nat / 12) - 1;
  return oct * 7 + NATURAL_PC.indexOf(((nat % 12) + 12) % 12);
}

// line/space + sharp or flat -> midi
export function midiFor(step, acc) {
  const oct = Math.floor(step / 7);
  const nat = (oct + 1) * 12 + NATURAL_PC[((step % 7) + 7) % 7];
  return nat + (acc === "#" ? 1 : acc === "b" ? -1 : 0);
}

export const barLen = (time) => (time[0] * 4) / time[1]; // in quarter-note beats

// Notes grouped into bars (arrays of indexes). A note that won't fit starts the next bar.
export function barsOf(notes, time) {
  const len = barLen(time);
  const out = [];
  let cur = [];
  let fill = 0;
  notes.forEach((n, i) => {
    if (cur.length && fill + n.d > len + 1e-6) {
      out.push(cur);
      cur = [];
      fill = 0;
    }
    cur.push(i);
    fill += n.d;
    if (fill >= len - 1e-6) {
      out.push(cur);
      cur = [];
      fill = 0;
    }
  });
  if (cur.length) out.push(cur);
  return out;
}

export const barCount = (state) => barsOf(state.notes ?? [], state.time ?? [4, 4]).length;

const itemW = (d) => (d >= 4 ? 70 : d >= 2 ? 50 : d >= 1 ? 38 : 30);

// Where each note goes. S = line spacing in px; maxW wraps onto new lines of staff
// at a bar boundary (Infinity = one long line that scrolls).
// -> { items: [{ i, x, w, line, start }], bars: [{ x, line }], lines, width, end, endLine }
export function layout(notes, time, S, maxW = Infinity) {
  const lead0 = S * 7.5; // clef + time signature
  const lead1 = S * 4; // clef only
  const items = [];
  const bars = [];
  let line = 0;
  let x = lead0;
  let beat = 0;
  let width = 0;
  const groups = barsOf(notes, time);
  groups.forEach((g, gi) => {
    const bw = g.reduce((t, i) => t + itemW(notes[i].d), 0) + 12;
    if (x + bw > maxW && x > (line ? lead1 : lead0) + 1) {
      line += 1;
      x = lead1;
    }
    g.forEach((i) => {
      const w = itemW(notes[i].d);
      items.push({ i, x, w, line, start: beat });
      x += w;
      beat += notes[i].d;
    });
    const filled = g.reduce((t, i) => t + notes[i].d, 0);
    // close every bar except a short one at the very end (that's where you keep writing)
    if (filled >= barLen(time) - 1e-6 || gi < groups.length - 1) {
      x += 12;
      bars.push({ x: x - 6, line });
    }
    width = Math.max(width, x);
  });
  return { items, bars, lines: line + 1, width: Math.max(width + S * 6, S * 24), end: x, endLine: line, lead0, lead1 };
}
