// Games played peer to peer (docs/plans/peer-to-peer.md P6): flashcard race, magnet battle,
// draw-it. Nothing here touches a server. One player hosts the game state, everyone else sends
// them what they did ("act") and gets the new state back ("state"). Only the final result
// ("Sam won 7–5") is for the caller to write to the board.
//
//   const bus = gameBus(room);        // one per room, shared by every module that plays
//   bus.sub(mid, fn) → off            fn() whenever this module's game changes. Last one out turns the bus off.
//   bus.get(mid)                      what I see of the game in module `mid` (null = none)
//   bus.open(mid, kind, face)         start a lobby: kind is "flash" | "mag" | "draw"; face = { uid, name, color }
//   bus.act(mid, action)              do something (join, start, an answer…); the host applies it
//   bus.leave(mid) / bus.end(mid)     walk away / end it for everybody
//   bus.now()                         the shared clock, ms since 1970
//
// The host is the lowest peer id among the players, who all sit in the room, so it is also the
// room's clock reference. Secrets (the word being drawn, everyone's magnets) stay on the host
// and each player is sent a "view" with only their own part. If the host goes, the lowest
// player left takes over from the last state they were sent (their view; "adopt" patches up
// whatever a view couldn't carry).

import { clock } from "./peers";

const newId = () => Math.random().toString(36).slice(2, 9);
const shuffle = (a) => {
  const r = [...a];
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [r[i], r[j]] = [r[j], r[i]];
  }
  return r;
};
const first = (name) => String(name ?? "").trim().split(/\s+/)[0] || "";

// Lowercase, no accents or punctuation, so "¿Dónde está?" matches "donde esta".
export const norm = (t) =>
  String(t ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, "").replace(/\s+/g, " ").trim();

// Levenshtein, as 1 (same) down to 0 (nothing alike).
export const similarity = (a, b) => {
  a = norm(a);
  b = norm(b);
  if (!a && !b) return 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    for (let j = 1; j <= b.length; j++) row[j] = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = row;
  }
  return 1 - prev[b.length] / Math.max(a.length, b.length);
};

// "the dog / dog" all count. Short answers must be exact; longer ones forgive a typo.
export function matches(answer, text) {
  const t = norm(text);
  if (!t) return false;
  const options = [answer, ...String(answer).split(/\s*[/;,]\s*/)].map(norm).filter(Boolean);
  return options.some((o) => o === t || (o.length > 4 && similarity(o, t) >= 0.85));
}

// Players, best first
export function rows(s) {
  return Object.entries(s.players ?? {})
    .map(([peer, p]) => ({ peer, uid: p.uid, name: first(p.name) || "someone", color: p.color, n: s.scores?.[peer] ?? 0 }))
    .sort((a, b) => b.n - a.n || a.name.localeCompare(b.name));
}

// "Sam won 7–5", "Sam and Ana tied at 4"
export function summary(list) {
  const [a, b] = list;
  if (!a) return "";
  if (!b) return `${a.name} scored ${a.n}`;
  if (a.n === b.n) return `${list.filter((r) => r.n === a.n).map((r) => r.name).join(" and ")} tied at ${a.n}`;
  return `${a.name} won ${a.n}–${b.n}`;
}

const zeros = (s) => Object.fromEntries(Object.keys(s.players).map((p) => [p, 0]));
const finish = (s, extra = {}) => {
  const list = rows(s);
  return { ...s, phase: "done", result: { text: summary(list), rows: list.map(({ uid, name, n }) => ({ uid, name, n })), ...extra } };
};

// ---- Flashcard race ---------------------------------------------------------
// start data: { cards: [{ id, front, back }] }. Each card is shown at the same shared moment; everyone
// types the back. The first right answer scores, judged by when they sent it on the shared clock
// (answers landing within GRACE of the first are compared, so a slow connection isn't punished).

export const FLASH = { lead: 2200, limit: 20000, grace: 350, reveal: 2600 };

const flash = {
  begin(s, c) {
    return {
      ...s, go: null, phase: "play", cards: s.go.cards, i: 0, roundAt: c.now + FLASH.lead,
      got: {}, wrong: {}, decided: false, winner: null, firstAt: 0, revealAt: 0, scores: zeros(s),
    };
  },
  act(s, a, c) {
    if (a.type !== "ans" || s.phase !== "play" || s.decided || a.i !== s.i || s.got[c.from]) return s;
    if (!(a.at >= s.roundAt)) return s; // before the card was turned over
    if (!matches(s.cards[s.i].back, a.text)) return { ...s, wrong: { ...s.wrong, [c.from]: String(a.text).slice(0, 40) } };
    const { [c.from]: _, ...wrong } = s.wrong;
    return { ...s, wrong, got: { ...s.got, [c.from]: a.at }, firstAt: s.firstAt || c.now };
  },
  tick(s, c) {
    if (s.phase !== "play") return s;
    if (!s.decided) {
      const hits = Object.entries(s.got).sort((x, y) => x[1] - y[1]);
      if (hits.length && c.now - s.firstAt >= FLASH.grace) {
        const winner = hits[0][0];
        return { ...s, decided: true, winner, revealAt: c.now, scores: { ...s.scores, [winner]: (s.scores[winner] ?? 0) + 1 } };
      }
      if (c.now >= s.roundAt + FLASH.limit) return { ...s, decided: true, winner: null, revealAt: c.now };
      return s;
    }
    if (c.now - s.revealAt < FLASH.reveal) return s;
    if (s.i + 1 >= s.cards.length) return finish(s);
    return { ...s, i: s.i + 1, roundAt: c.now + 900, got: {}, wrong: {}, decided: false, winner: null, firstAt: 0 };
  },
};

// ---- Magnet battle ------------------------------------------------------------
// start data: { words: [string] } (the module's magnets). Everyone is dealt HAND of them in private,
// makes a line before the timer runs out, lines are revealed without names, everyone votes (not for
// their own), and the winner's line is pinned on the fridge.

export const MAG = { hand: 20, make: 80000, vote: 30000 };

function tally(s, c) {
  const count = {};
  for (const id of Object.values(s.votes)) count[id] = (count[id] ?? 0) + 1;
  const order = Object.keys(s.by).sort((a, b) => (count[b] ?? 0) - (count[a] ?? 0) || s.lineAt[s.by[a]] - s.lineAt[s.by[b]]);
  const scores = zeros(s);
  for (const id of Object.keys(count)) scores[s.by[id]] = (scores[s.by[id]] ?? 0) + count[id];
  const top = order[0];
  const win = top && count[top] ? { text: s.lines[s.by[top]], peer: s.by[top], ...s.players[s.by[top]] } : null;
  const done = finish({ ...s, scores });
  done.result.pin = win ? { text: win.text, name: first(win.name) || "someone", uid: win.uid } : null;
  if (!win) done.result.text = "no votes, no winner";
  return { ...done, phase: "done" };
}

function toVote(s, c) {
  const owners = shuffle(Object.keys(s.lines));
  if (owners.length < 2) {
    // nothing to vote on: a lone line wins, no lines means no game
    const by = Object.fromEntries(owners.map((p, i) => [`c${i}`, p]));
    const done = tally({ ...s, by, votes: {}, cards: [] }, c);
    if (owners.length) done.result = { ...done.result, text: `${first(s.players[owners[0]].name) || "someone"} was the only one to write a line`, pin: { text: s.lines[owners[0]], name: first(s.players[owners[0]].name) || "someone", uid: s.players[owners[0]].uid } };
    else done.result = { ...done.result, text: "nobody made a line", pin: null };
    return done;
  }
  const by = {};
  const cards = owners.map((p, i) => ((by[`c${i}`] = p), { id: `c${i}`, text: s.lines[p] }));
  return { ...s, phase: "vote", endsAt: c.now + MAG.vote, cards, by, votes: {} };
}

const mag = {
  begin(s, c) {
    const words = [...new Set((s.go.words ?? []).map((w) => String(w).slice(0, 40)))];
    const hands = Object.fromEntries(Object.keys(s.players).map((p) => [p, shuffle(words).slice(0, MAG.hand).map((text, i) => ({ i, text }))]));
    return { ...s, go: null, phase: "make", endsAt: c.now + MAG.make, hands, lines: {}, lineAt: {}, submitted: {}, scores: zeros(s) };
  },
  act(s, a, c) {
    if (a.type === "line" && s.phase === "make" && !s.submitted[c.from]) {
      const hand = s.hands[c.from] ?? [];
      const picks = [...new Set((a.line ?? []).filter((i) => Number.isInteger(i) && hand[i]))].slice(0, MAG.hand);
      if (!picks.length) return s;
      return {
        ...s, submitted: { ...s.submitted, [c.from]: true }, lineAt: { ...s.lineAt, [c.from]: c.now },
        lines: { ...s.lines, [c.from]: picks.map((i) => hand[i].text).join(" ") },
      };
    }
    if (a.type === "vote" && s.phase === "vote" && !s.votes[c.from] && s.by[a.id] && s.by[a.id] !== c.from) {
      return { ...s, votes: { ...s.votes, [c.from]: a.id } };
    }
    return s;
  },
  tick(s, c) {
    const all = Object.keys(s.players);
    if (s.phase === "make" && (all.every((p) => s.submitted[p]) || c.now >= s.endsAt)) return toVote(s, c);
    if (s.phase === "vote" && (all.every((p) => s.votes[p] || !Object.values(s.by).some((o) => o !== p)) || c.now >= s.endsAt)) return tally(s, c);
    return s;
  },
  // A new host only ever saw its own view: the others' hands are gone, so call it there
  adopt(s) {
    return s.phase === "make" || s.phase === "vote" ? { ...s, phase: "done", result: { text: "the host left, so the round ended", rows: [], pin: null } } : s;
  },
  view(s, peer) {
    const { hands, lines, lineAt, by, votes, ...pub } = s;
    const done = s.phase === "done";
    return { ...pub, hand: hands?.[peer], voted: Object.fromEntries(Object.keys(votes ?? {}).map((p) => [p, true])), by: done ? by : undefined, votes: done ? votes : undefined };
  },
};

// ---- Draw it ----------------------------------------------------------------
// start data: { pool: [{ word, prompt }] }. The drawer sees `prompt` (what to draw) and the others
// guess `word`; from a flashcard deck the word is the front (el perro) and the prompt the back
// (the dog). Strokes themselves never go through here: they ride the "draw" channel, see DrawIt.jsx.

export const DRAW = { limit: 70000, reveal: 4000 };

function nextTurn(s, c, t) {
  const order = Object.keys(s.players).sort();
  if (t >= s.turns || !order.length) return finish(s);
  const e = s.pool[t % s.pool.length];
  return {
    ...s, phase: "turn", t, drawer: order[t % order.length], word: e.word, prompt: e.prompt,
    hint: [...e.word].map((ch) => (/[\p{L}\p{N}]/u.test(ch) ? "_" : ch)).join(" "),
    startedAt: c.now, endsAt: c.now + DRAW.limit, guessed: {}, feed: [], decided: false, revealAt: 0,
  };
}

const draw = {
  begin(s, c) {
    const n = Object.keys(s.players).length;
    const pool = shuffle(s.go.pool);
    return nextTurn({ ...s, go: null, pool, turns: n * (n < 3 ? 2 : 1), scores: zeros(s) }, c, 0);
  },
  act(s, a, c) {
    if (s.phase !== "turn" || s.decided) return s;
    if (a.type === "pass" && c.from === s.drawer) return { ...s, decided: true, revealAt: c.now };
    if (a.type !== "guess" || c.from === s.drawer || s.guessed[c.from]) return s;
    const text = String(a.text ?? "").slice(0, 40);
    if (!norm(text)) return s;
    const hit = norm(text) === norm(s.word) || (norm(s.word).length >= 7 && similarity(s.word, text) >= 0.9);
    if (!hit) return { ...s, feed: [...s.feed, { peer: c.from, text }].slice(-8) };
    const guessed = { ...s.guessed, [c.from]: c.now };
    const got = Object.keys(guessed).length;
    const scores = { ...s.scores, [c.from]: (s.scores[c.from] ?? 0) + Math.max(1, 4 - got), [s.drawer]: (s.scores[s.drawer] ?? 0) + 1 };
    const guessers = Object.keys(s.players).filter((p) => p !== s.drawer);
    const all = guessers.every((p) => guessed[p]);
    return { ...s, guessed, scores, feed: [...s.feed, { peer: c.from, hit: true }].slice(-8), ...(all ? { decided: true, revealAt: c.now } : {}) };
  },
  tick(s, c) {
    if (s.phase !== "turn") return s;
    if (!s.decided) {
      if (c.now >= s.endsAt || !s.players[s.drawer]) return { ...s, decided: true, revealAt: c.now };
      return s;
    }
    return c.now - s.revealAt >= DRAW.reveal ? nextTurn(s, c, s.t + 1) : s;
  },
  // The pool and the word stayed on the old host; just finish up with what's been scored
  adopt(s) {
    return s.phase === "turn" ? finish(s) : s;
  },
  view(s, peer) {
    const { pool, ...pub } = s;
    const open = peer === s.drawer || s.decided || s.phase === "done";
    return { ...pub, word: open ? s.word : null, prompt: open ? s.prompt : null };
  },
};

export const ENGINES = { flash, mag, draw };
const viewOf = (e, s, peer) => (e.view ? e.view(s, peer) : s);

// One step of a game: what an action does to the state. Pure; the host runs it.
// c = { from (peer who acted), self, now }
export function step(s, a, c) {
  const eng = ENGINES[s.g];
  const known = !!s.players?.[c.from];
  switch (a.type) {
    case "join":
      if (s.phase !== "lobby" || known) return s;
      return { ...s, players: { ...s.players, [c.from]: { uid: a.uid, name: String(a.name ?? "").slice(0, 30), color: a.color } } };
    case "leave": {
      if (!known) return s;
      const { [c.from]: _, ...players } = s.players;
      return { ...s, players };
    }
    case "start": {
      if (s.phase !== "lobby" || s.go || c.from !== s.host || Object.keys(s.players).length < 2) return s;
      const host = Object.keys(s.players).sort()[0];
      const t = { ...s, host, go: a.data };
      return host === c.self ? eng.begin(t, c) : t; // otherwise the new host begins it, on its next tick
    }
    case "tick":
      if (s.go && s.host === c.self) return eng.begin(s, c);
      return s.phase === "lobby" || s.phase === "done" || !eng.tick ? s : eng.tick(s, c);
    case "adopt":
      return eng.adopt ? eng.adopt(s, c) : s;
    default:
      return known && s.phase !== "lobby" && s.phase !== "done" ? eng.act(s, a, c) : s;
  }
}

// ---- The bus ----------------------------------------------------------------

const buses = new WeakMap();
const TICK = 250;

export function gameBus(room) {
  let bus = buses.get(room);
  if (!bus) buses.set(room, (bus = makeBus(room, () => buses.delete(room))));
  return bus;
}

function makeBus(room, dispose) {
  const held = new Map(); // mid → the state I have (all of it if I host, my view if not)
  const shown = new Map(); // mid → what my screen shows
  const gone = new Map(); // mid → game id I walked away from
  const subs = new Map(); // mid → Set of fn
  const clk = clock(room);
  let count = 0;

  const now = () => clk.now();
  const self = () => room.self;
  const emit = (mid) => subs.get(mid)?.forEach((fn) => fn());
  const tell = (to, msg) => Promise.resolve(room.send("game", msg, to)).catch(() => {});
  const ctx = (from) => ({ from, self: self(), now: now() });

  function put(mid, s) {
    held.set(mid, s);
    const eng = ENGINES[s.g];
    shown.set(mid, viewOf(eng, s, self()));
    emit(mid);
    for (const p of room.peers) tell(p, { k: "state", mid, s: viewOf(eng, s, p) });
  }

  function run(mid, a, from) {
    const s = held.get(mid);
    if (!s || s.host !== self()) return;
    const next = step(s, a, ctx(from));
    if (next !== s) put(mid, { ...next, v: (s.v ?? 0) + 1 });
  }

  function drop(mid, gid) {
    const s = held.get(mid);
    if (!s || (gid && s.gid !== gid)) return;
    held.delete(mid);
    shown.delete(mid);
    emit(mid);
  }

  // Give the game to `to`, sending it all of it (secrets and all) and everyone else just their views
  function handoff(mid, to) {
    const s = held.get(mid);
    if (!s || s.host !== self()) return;
    const t = { ...s, host: to, v: (s.v ?? 0) + 1 };
    const eng = ENGINES[s.g];
    held.set(mid, viewOf(eng, t, self()));
    shown.set(mid, held.get(mid));
    emit(mid);
    for (const p of room.peers) tell(p, { k: "state", mid, s: p === to ? t : viewOf(eng, t, p) });
  }

  const offs = [
    room.on("game", (m, from) => {
      if (m.k === "state") {
        if (!m.s || gone.get(m.mid) === m.s.gid) return;
        const cur = held.get(m.mid);
        if (cur && cur.gid === m.s.gid && (cur.v ?? 0) >= (m.s.v ?? 0)) return;
        held.set(m.mid, m.s);
        // Already my view, unless it's a handoff (the whole thing)
        shown.set(m.mid, m.s.host === self() ? viewOf(ENGINES[m.s.g], m.s, self()) : m.s);
        emit(m.mid);
      } else if (m.k === "act") {
        run(m.mid, m.a, from);
      } else if (m.k === "end") {
        drop(m.mid, m.gid);
      } else if (m.k === "hello") {
        for (const [mid, s] of held) if (s.host === self()) tell(from, { k: "state", mid, s: viewOf(ENGINES[s.g], s, from) });
      }
    }),
    room.onPeer((id, joined) => {
      if (joined) {
        for (const [mid, s] of held) if (s.host === self()) tell(id, { k: "state", mid, s: viewOf(ENGINES[s.g], s, id) });
        return;
      }
      for (const [mid, s] of [...held]) {
        if (!s.players?.[id] && s.host !== id) continue;
        const alive = Object.keys(s.players).filter((p) => p !== id && (p === self() || room.peers.has(p))).sort();
        if (!alive.length) {
          drop(mid);
        } else if (s.host === id && alive[0] === self() && s.players[self()]) {
          // The host is gone: I'm the lowest player left, so it's mine now
          const mine = { ...s, host: self(), v: (s.v ?? 0) + 1 };
          held.set(mid, mine);
          put(mid, { ...step(mine, { type: "adopt" }, ctx(self())), v: mine.v + 1 });
          run(mid, { type: "leave" }, id);
        } else if (s.host === self()) {
          run(mid, { type: "leave" }, id);
        }
      }
    }),
  ];
  const beat = setInterval(() => {
    for (const [mid, s] of held) if (s.host === self() && (s.go || (s.phase !== "lobby" && s.phase !== "done"))) run(mid, { type: "tick" }, self());
  }, TICK);

  // Anyone already playing tells me about it
  room.ready.then(() => tell(undefined, { k: "hello" }));

  return {
    get: (mid) => shown.get(mid) ?? null,
    now,
    sub(mid, fn) {
      if (!subs.has(mid)) subs.set(mid, new Set());
      subs.get(mid).add(fn);
      count++;
      return () => {
        subs.get(mid)?.delete(fn);
        if (--count > 0) return;
        offs.forEach((off) => off());
        clearInterval(beat);
        clk.stop();
        dispose();
      };
    },
    open(mid, kind, face) {
      if (held.has(mid)) return;
      gone.delete(mid);
      put(mid, { g: kind, gid: newId(), v: 0, host: self(), phase: "lobby", players: {}, go: null });
      run(mid, { type: "join", ...face }, self());
    },
    act(mid, a) {
      const s = held.get(mid);
      if (!s) return;
      if (s.host === self()) run(mid, a, self());
      else tell(s.host, { k: "act", mid, a });
    },
    // Walk away. If it was my game I hand it to the next player first.
    leave(mid) {
      const s = held.get(mid);
      if (!s) return;
      gone.set(mid, s.gid);
      if (s.host === self()) {
        const next = Object.keys(s.players).filter((p) => p !== self() && room.peers.has(p)).sort()[0];
        if (next) {
          handoff(mid, next);
          tell(next, { k: "act", mid, a: { type: "leave" } });
        } else tell(undefined, { k: "end", mid, gid: s.gid });
      } else tell(s.host, { k: "act", mid, a: { type: "leave" } });
      drop(mid);
    },
    end(mid) {
      const s = held.get(mid);
      if (!s) return;
      tell(undefined, { k: "end", mid, gid: s.gid });
      gone.set(mid, s.gid);
      drop(mid);
    },
  };
}
