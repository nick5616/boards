import { useState, useEffect, useRef } from "react";
import { norm } from "../../lib/games";
import { useGame, withResult } from "../../hooks/useGame";
import { Lobby, Podium, Scores, Bar, Dot, Results } from "../live/GameParts";

// A chalkboard. Alone it is a place to doodle (kept on the board). In a shared space with someone
// else here, "play together" starts Draw it: one person draws a word, the others type guesses,
// turns rotate, and the result ("Sam won 7–5") is all that is kept. Words come from a Flashcards
// deck on the board (the drawer sees the back, the others guess the front, so it drills vocabulary)
// or from a built-in list. The strokes ride the "draw" channel and are never saved or sent anywhere else.
// See docs/plans/peer-to-peer.md P6.

const W = 1000; // strokes live in a 1000 x 750 space whatever size the board is shown at
const H = 750;
const CHALK = ["#f4f1ea", "#ffe07a", "#ff9bb5", "#8fd3ff", "#a8e08a"];
const SEND_EVERY = 60;
const MAX_STROKES = 150;

const WORDS = [
  "cat", "dog", "house", "tree", "sun", "moon", "star", "fish", "bird", "flower", "car", "boat", "bicycle", "train",
  "apple", "banana", "pizza", "cake", "cheese", "egg", "key", "door", "chair", "table", "bed", "clock", "umbrella",
  "glasses", "hat", "shoe", "shirt", "guitar", "piano", "book", "phone", "camera", "balloon", "ghost", "robot",
  "rainbow", "mountain", "island", "bridge", "castle", "snowman", "spider", "snake", "elephant", "rabbit", "butterfly",
];

const first = (p) => (p?.name || "someone").split(/\s+/)[0];

// The board itself. `list` is every stroke to show; with `edit`, drawing adds strokes and reports
// them: onLive(msg) as they grow (for the peers), onDone(stroke) once finished (to keep).
function Chalk({ list, edit, color, width = 7, onLive, onDone }) {
  const cv = useRef(null);
  const cur = useRef(null); // the stroke in my hand: { id, c, w, p, sent }
  const timer = useRef(0);
  const [, bump] = useState(0);
  const latest = useRef(null);

  const paint = () => {
    const el = cv.current;
    if (!el || !el.width) return;
    const g = el.getContext("2d");
    const k = el.width / W;
    g.clearRect(0, 0, el.width, el.height);
    g.lineCap = g.lineJoin = "round";
    for (const s of cur.current ? [...list, cur.current] : list) {
      g.strokeStyle = s.c;
      g.lineWidth = s.w * k;
      g.beginPath();
      g.moveTo(s.p[0] * k, s.p[1] * k);
      for (let i = 2; i < s.p.length; i += 2) g.lineTo(s.p[i] * k, s.p[i + 1] * k);
      if (s.p.length === 2) g.lineTo(s.p[0] * k + 0.1, s.p[1] * k);
      g.stroke();
    }
  };
  latest.current = paint;
  useEffect(paint);

  useEffect(() => {
    const el = cv.current;
    if (!el) return;
    const fit = () => {
      const r = el.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      el.width = Math.max(1, Math.round(r.width * dpr));
      el.height = Math.max(1, Math.round(r.height * dpr));
      latest.current();
    };
    fit();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(fit) : null;
    ro?.observe(el);
    return () => {
      ro?.disconnect();
      clearInterval(timer.current);
    };
  }, []);

  const at = (e) => {
    const r = cv.current.getBoundingClientRect();
    return [
      Math.max(0, Math.min(W, Math.round(((e.clientX - r.left) / r.width) * W))),
      Math.max(0, Math.min(H, Math.round(((e.clientY - r.top) / r.height) * H))),
    ];
  };
  const flush = () => {
    const s = cur.current;
    if (!s || s.sent >= s.p.length) return;
    onLive?.({ k: "s", id: s.id, c: s.c, w: s.w, pts: s.p.slice(s.sent) });
    s.sent = s.p.length;
  };
  const down = (e) => {
    if (!edit || e.button > 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    cur.current = { id: Math.random().toString(36).slice(2, 8), c: color, w: width, p: at(e), sent: 0 };
    flush();
    timer.current = setInterval(flush, SEND_EVERY);
    bump((n) => n + 1);
  };
  const move = (e) => {
    const s = cur.current;
    if (!s) return;
    s.p.push(...at(e));
    paint();
  };
  const up = () => {
    const s = cur.current;
    if (!s) return;
    clearInterval(timer.current);
    flush();
    cur.current = null;
    const { sent, ...stroke } = s;
    onDone?.(stroke);
  };

  return (
    <canvas
      ref={cv}
      className={`gm-chalk${edit ? " edit" : ""}`}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
      aria-label="Chalkboard"
    />
  );
}

function Tools({ color, setColor, onUndo, onClear, extra }) {
  return (
    <div className="gm-tools">
      {CHALK.map((c) => (
        <button key={c} className={`gm-nub${c === color ? " on" : ""}`} style={{ background: c }} onClick={() => setColor(c)} aria-label="Chalk colour" />
      ))}
      {onUndo && <button className="mini-btn ghost" onClick={onUndo}>↶</button>}
      <button className="mini-btn ghost" onClick={onClear}>wipe</button>
      {extra}
    </div>
  );
}

export default function DrawIt({ board, mod, setState }) {
  const game = useGame(board, mod, (result, gid) => setState((s) => withResult(s, result, gid)));
  const [color, setColor] = useState(CHALK[0]);
  const { strokes = [] } = mod.state;

  if (game.state) return <DrawGame g={game} board={board} mod={mod} color={color} setColor={setColor} />;

  // Alone: just a board to doodle on
  return (
    <div className="gm gm-solo">
      <Chalk
        list={strokes}
        edit
        color={color}
        onDone={(st) => setState((s) => ({ ...s, strokes: [...(s.strokes ?? []), st].slice(-MAX_STROKES) }), { debounce: 400 })}
      />
      <Tools
        color={color}
        setColor={setColor}
        onUndo={strokes.length ? () => setState((s) => ({ ...s, strokes: (s.strokes ?? []).slice(0, -1) })) : null}
        onClear={() => setState((s) => ({ ...s, strokes: [] }))}
        extra={game.can && <button className="mini-btn gm-go" onClick={() => game.open("draw")}>✏️ play together</button>}
      />
      <Results games={mod.state.games} />
    </div>
  );
}

function DrawGame({ g, board, mod, color, setColor }) {
  const s = g.state;
  const [list, setList] = useState([]); // this turn's strokes, mine or the drawer's
  const [text, setText] = useState("");
  const [src, setSrc] = useState("built-in");
  const turn = useRef(-1);
  const mine = useRef(list);
  mine.current = list;
  const sNow = useRef(s);
  sNow.current = s;
  const input = useRef(null);
  const room = g.room;
  const mid = mod.id;

  // A new turn starts with a clean board
  useEffect(() => {
    if (s.t === undefined || s.t === turn.current) return;
    turn.current = s.t;
    setList([]);
    setText("");
  }, [s.t]);

  // The drawer's strokes arriving, and handing the picture to anyone who joins late
  useEffect(() => {
    if (!room) return;
    const apply = (m) =>
      setList((l) => {
        if (m.k === "clear") return [];
        if (m.k === "undo") return l.slice(0, -1);
        const i = l.findIndex((x) => x.id === m.id);
        if (i < 0) return [...l, { id: m.id, c: m.c, w: m.w, p: m.pts }];
        const next = [...l];
        next[i] = { ...next[i], p: [...next[i].p, ...m.pts] };
        return next;
      });
    const offMsg = room.on("draw", (m, from) => {
      if (m.mid !== mid || from === room.self) return;
      if (m.t > turn.current) {
        turn.current = m.t; // the turn's first stroke beat the news that it began
        setList([]);
      }
      if (m.t !== turn.current) return;
      apply(m);
    });
    const offPeer = room.onPeer((id, joined) => {
      const st = sNow.current;
      if (!joined || !st || st.drawer !== room.self) return;
      for (const x of mine.current) room.send("draw", { mid, t: st.t, k: "s", id: x.id, c: x.c, w: x.w, pts: x.p }, id);
    });
    return () => {
      offMsg();
      offPeer();
    };
  }, [room, mid]);

  const drawing = s.phase === "turn" && s.drawer === g.me && !s.decided;
  const say = (m) => room?.send("draw", { mid, t: s.t, ...m });

  if (s.phase === "lobby") {
    const decks = board.modules.filter((m) => m.type === "flashcards" && (m.state.cards ?? []).length >= 3);
    const deck = decks.find((m) => m.id === src);
    const pool = deck
      ? deck.state.cards.map((c) => ({ word: c.front, prompt: c.back }))
      : WORDS.map((w) => ({ word: w, prompt: w }));
    return (
      <Lobby
        s={s}
        g={g}
        title="✏️ draw it"
        blurb="One of you draws a word, the rest type guesses. Everyone takes a turn."
        onStart={() => g.act({ type: "start", data: { pool } })}
        startLabel="start drawing"
      >
        {decks.length > 0 && (
          <div className="gm-row">
            <select value={deck ? src : "built-in"} onChange={(e) => setSrc(e.target.value)} aria-label="Where the words come from">
              <option value="built-in">built-in words</option>
              {decks.map((m, i) => (
                <option key={m.id} value={m.id}>{m.title || `flashcards${decks.length > 1 ? ` ${i + 1}` : ""}`} (guess the front)</option>
              ))}
            </select>
          </div>
        )}
      </Lobby>
    );
  }

  if (s.phase === "done") {
    return (
      <Podium s={s}>
        <div className="gm-row">
          {s.host === g.me && s.players[g.me] && (
            <button className="mini-btn gm-go" onClick={() => { g.end(); setTimeout(() => g.open("draw"), 50); }}>again</button>
          )}
          <button className="mini-btn ghost" onClick={g.leave}>close</button>
        </div>
      </Podium>
    );
  }

  const drawer = s.players[s.drawer];
  const mineNow = !!s.players[g.me];
  const guess = () => {
    if (!text.trim() || s.decided || s.guessed[g.me] || drawing) return;
    g.act({ type: "guess", text });
    setText("");
    input.current?.focus();
  };

  return (
    <div className="gm gm-draw">
      <div className="gm-head">
        <span>turn {s.t + 1} of {s.turns} · {drawing ? "you're drawing" : `${first(drawer)} is drawing`}</span>
        <button className="mini-btn ghost" onClick={g.leave}>leave</button>
      </div>
      <Scores s={s} g={g} />
      {!s.decided && <Bar g={g} from={s.startedAt} to={s.endsAt} />}
      <Chalk
        list={list}
        edit={drawing}
        color={color}
        onLive={say}
        onDone={(st) => setList((l) => (l.some((x) => x.id === st.id) ? l : [...l, st]))}
      />
      {drawing ? (
        <>
          <div className="gm-prompt">draw: <b>{s.prompt}</b></div>
          <Tools
            color={color}
            setColor={setColor}
            onUndo={() => { setList((l) => l.slice(0, -1)); say({ k: "undo" }); }}
            onClear={() => { setList([]); say({ k: "clear" }); }}
            extra={<button className="mini-btn ghost" onClick={() => g.act({ type: "pass" })}>skip</button>}
          />
        </>
      ) : s.decided ? (
        <div className="gm-verdict" role="status">
          it was <b>{s.word}</b>
          {s.prompt && norm(s.prompt) !== norm(s.word) && <> ({s.prompt})</>}
          {Object.keys(s.guessed).length === 0 && " · nobody got it"}
        </div>
      ) : mineNow ? (
        <>
          <div className="gm-hint" aria-label="The word">{s.hint}</div>
          <div className="gm-answer">
            <input
              ref={input}
              className="line-input"
              placeholder={s.guessed[g.me] ? "you got it!" : "type a guess"}
              value={text}
              disabled={!!s.guessed[g.me]}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && guess()}
              aria-label="Your guess"
              autoCapitalize="none"
              autoCorrect="off"
            />
            <button className="mini-btn gm-go" onClick={guess} disabled={!text.trim() || !!s.guessed[g.me]}>guess</button>
          </div>
        </>
      ) : (
        <div className="gm-hint">{s.hint}</div>
      )}
      {s.feed.length > 0 && (
        <div className="gm-feed">
          {s.feed.slice(-5).map((f, i) => {
            const p = s.players[f.peer];
            return (
              <div key={i} className={f.hit ? "hit" : ""}>
                <Dot name={first(p)} color={p?.color} /> {f.hit ? <>{first(p)} got it!</> : <>{first(p)}: {f.text}</>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
