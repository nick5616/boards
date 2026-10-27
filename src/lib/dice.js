// Dice maths for the Dice tray and the Initiative tracker.
// Every result comes from crypto.getRandomValues, never Math.random.

export const SIDES = [4, 6, 8, 10, 12, 20, 100];
export const MAX_DICE = 20;

// 1..n with no modulo bias (throw away the few values that would skew it)
export function rollDie(n) {
  const lim = Math.floor(0x100000000 / n) * n;
  const buf = new Uint32Array(1);
  do crypto.getRandomValues(buf);
  while (buf[0] >= lim);
  return (buf[0] % n) + 1;
}

// "3d6+2", "d20", "2d8+1d4-1", "4d6 + 3". Returns { tray: { d6: 3 }, mod: 2 } or null.
export function parseNotation(text) {
  const src = String(text ?? "").toLowerCase().replace(/\s+/g, "");
  if (!src || !/^[+-]?(\d*d\d+|\d+)([+-](\d*d\d+|\d+))*$/.test(src)) return null;
  const tray = {};
  let mod = 0;
  for (const [, sign, body] of src.matchAll(/([+-]?)(\d*d\d+|\d+)/g)) {
    const k = sign === "-" ? -1 : 1;
    const d = body.match(/^(\d*)d(\d+)$/);
    if (!d) {
      mod += k * parseInt(body, 10);
      continue;
    }
    const sides = parseInt(d[2], 10);
    // Subtracting dice isn't a thing here; an odd die (d7) just isn't on the tray
    if (k < 0 || !SIDES.includes(sides)) return null;
    tray[`d${sides}`] = (tray[`d${sides}`] ?? 0) + (d[1] === "" ? 1 : parseInt(d[1], 10));
  }
  const total = Object.values(tray).reduce((t, n) => t + n, 0);
  if (!total || total > MAX_DICE) return null;
  return { tray, mod };
}

// The tray as a sorted list of [sides, count]
export const diceOf = (tray = {}) =>
  SIDES.map((s) => [s, Math.max(0, tray[`d${s}`] ?? 0)]).filter(([, n]) => n > 0);

export const countOf = (tray) => diceOf(tray).reduce((t, [, n]) => t + n, 0);

// "3d6+2" for a tray
export function labelOf(tray, mod = 0, adv = null) {
  const parts = diceOf(tray).map(([s, n]) => `${n === 1 ? "" : n}d${s}`);
  const m = mod ? (mod > 0 ? `+${mod}` : `${mod}`) : "";
  const a = adv && tray.d20 ? (adv === "adv" ? " (adv)" : " (dis)") : "";
  return `${parts.join("+")}${m}${a}` || "–";
}

// Roll the whole tray. With advantage the first d20 is rolled twice and the better (or worse)
// one counts; the other is kept in the list but marked `drop` so it can be shown dimmed.
export function rollTray(tray, mod = 0, adv = null) {
  const rolls = [];
  let usedAdv = false;
  for (const [s, n] of diceOf(tray)) {
    for (let i = 0; i < n; i++) {
      if (s === 20 && adv && !usedAdv) {
        usedAdv = true;
        const a = rollDie(20);
        const b = rollDie(20);
        const keepFirst = adv === "adv" ? a >= b : a <= b;
        rolls.push({ s, v: a, drop: !keepFirst }, { s, v: b, drop: keepFirst });
      } else {
        rolls.push({ s, v: rollDie(s) });
      }
    }
  }
  const total = rolls.reduce((t, r) => t + (r.drop ? 0 : r.v), 0) + mod;
  return { rolls, total, mod };
}
