import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Fold, Credit } from "./kit";
import { Chess } from "chess.js";
import {
  GLYPH, dailyPuzzle, anotherPuzzle, tryMove, replyMove, uciParts, liveStreak, solvedToday, withSolved,
} from "../../lib/chesspuzzle";

const FILES = "abcdefgh";

// A little wooden chessboard with the Lichess puzzle of the day. Pieces are text glyphs.
// Tap a piece then a square, or drag it. The opponent's reply plays by itself.
// State: streak (days in a row), best, lastSolved (day key), total solved, dailyId / dailyResult
// ("solved" | "failed") for the puzzle of the day. Practice puzzles ("another") don't touch the streak.
export default function ChessPuzzle({ mod, setState, expanded }) {
  const st = mod.state ?? {};
  const [puz, setPuz] = useState(null);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);
  const [fen, setFen] = useState("");
  const [idx, setIdx] = useState(0); // which solution move we're on
  const [status, setStatus] = useState("playing"); // playing | solved | failed
  const [slipped, setSlipped] = useState(false); // got one wrong, or peeked
  const [sel, setSel] = useState(null);
  const [last, setLast] = useState(null);
  const [hint, setHint] = useState(null);
  const [shake, setShake] = useState(false);
  const [drag, setDrag] = useState(null); // { from, x, y, piece }
  const boardRef = useRef(null);
  const timers = useRef([]);
  const doneBefore = useRef({});
  doneBefore.current = { id: st.dailyId, result: st.dailyResult };

  const begin = useCallback((p) => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setPuz(p); setFen(p.fen); setIdx(0); setSel(null); setHint(null); setSlipped(false);
    setLast(p.last);
    const was = p.daily && doneBefore.current.id === p.id ? doneBefore.current.result : null;
    setStatus(was === "solved" ? "solved" : "playing");
  }, []);

  const load = useCallback((fn) => {
    setLoading(true); setErr("");
    fn().then((p) => { begin(p); setLoading(false); })
      .catch(() => { setErr("couldn't reach Lichess"); setLoading(false); });
  }, [begin]);
  useEffect(() => { load(() => dailyPuzzle()); }, [load]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const game = useMemo(() => (fen ? new Chess(fen) : null), [fen]);
  const mover = puz ? new Chess(puz.fen).turn() : "w"; // the person plays the side to move at the start
  const flip = mover === "b";
  const squares = useMemo(() => {
    const out = [];
    for (let r = 0; r < 8; r++) for (let f = 0; f < 8; f++) {
      const file = flip ? 7 - f : f;
      const rank = flip ? r : 7 - r;
      out.push(FILES[file] + (rank + 1));
    }
    return out;
  }, [flip]);

  const finish = (ok, helped) => {
    const result = ok && !helped ? "solved" : "failed";
    setStatus(ok ? "solved" : "failed");
    if (puz.daily) {
      setState((s) => {
        if (s.dailyId === puz.id && s.dailyResult === "solved") return s;
        const base = { ...s, dailyId: puz.id, dailyResult: result };
        return result === "solved" ? { ...withSolved(base), total: (s.total ?? 0) + 1 } : base;
      });
    } else if (result === "solved") setState((s) => ({ ...s, total: (s.total ?? 0) + 1 }));
  };

  const play = (from, to) => {
    if (status !== "playing" || !puz || !game) return;
    const piece = game.get(from);
    const promo = piece?.type === "p" && (to[1] === "8" || to[1] === "1")
      ? (uciParts(puz.solution[idx] ?? "").promotion ?? "q") : undefined;
    const r = tryMove(puz, fen, idx, from, to, promo);
    setSel(null); setHint(null);
    if (r.illegal) return;
    if (!r.ok) {
      setSlipped(true); setShake(true);
      timers.current.push(setTimeout(() => setShake(false), 450));
      return;
    }
    setFen(r.fen); setLast(r.move);
    if (r.done) { setIdx(puz.solution.length); finish(true, slipped); return; }
    const reply = puz.solution[idx + 1];
    setIdx(idx + 1);
    timers.current.push(setTimeout(() => {
      const rp = replyMove(r.fen, reply);
      setFen(rp.fen); setLast(rp.move); setIdx(idx + 2);
      if (idx + 2 >= puz.solution.length) finish(true, slipped);
    }, 550));
  };

  // How many moves the person still has to find
  const total = puz ? Math.ceil(puz.solution.length / 2) : 0;
  const found = Math.min(total, Math.ceil(idx / 2));

  const targetsOf = (sq) => (game ? game.moves({ square: sq, verbose: true }).map((m) => m.to) : []);
  const mine = (sq) => !!game && game.get(sq)?.color === mover && game.turn() === mover && status === "playing" && idx % 2 === 0;

  const tap = (sq) => {
    if (drag) return;
    if (sel && sel !== sq && targetsOf(sel).includes(sq)) return play(sel, sq);
    if (mine(sq)) setSel(sel === sq ? null : sq);
    else setSel(null);
  };

  // Dragging: pointer events work for touch and mouse alike
  const down = (e, sq) => {
    if (!mine(sq)) return;
    const piece = game.get(sq);
    const startX = e.clientX, startY = e.clientY;
    let moved = false;
    const move = (ev) => {
      if (!moved && Math.hypot(ev.clientX - startX, ev.clientY - startY) < 6) return;
      moved = true;
      setSel(sq);
      setDrag({ from: sq, x: ev.clientX, y: ev.clientY, piece });
    };
    const up = (ev) => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      if (!moved) return;
      setDrag(null);
      const el = document.elementFromPoint(ev.clientX, ev.clientY)?.closest("[data-sq]");
      const to = el && boardRef.current?.contains(el) ? el.dataset.sq : null;
      if (to && to !== sq && targetsOf(sq).includes(to)) play(sq, to);
      else setSel(null);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
  };

  const showHint = () => {
    if (status !== "playing" || !puz?.solution[idx]) return;
    setSlipped(true);
    setHint(uciParts(puz.solution[idx]).from);
  };
  const showAnswer = () => {
    if (status !== "playing") return;
    setSlipped(true); setSel(null); setHint(null);
    let f = fen;
    puz.solution.slice(idx).forEach((u, i) => {
      timers.current.push(setTimeout(() => {
        const m = replyMove(f, u);
        f = m.fen; setFen(m.fen); setLast(m.move);
        if (i === puz.solution.length - idx - 1) finish(false, true);
      }, 700 * (i + 1)));
    });
  };
  const retry = () => puz && begin({ ...puz });

  const streak = liveStreak(st);
  const sideName = mover === "w" ? "White" : "Black";
  const msg =
    status === "solved" ? (slipped ? "solved (with a little help)" : "solved! nicely done")
      : status === "failed" ? "not this time. the answer's on the board"
      : shake ? "not that one" : `${sideName} to move · ${found}/${total} found`;

  const lastSet = new Set(last ? [last.from, last.to] : []);
  const targets = sel ? targetsOf(sel) : [];

  return (
    <div className={`cz${expanded ? " big" : ""}`}>
      <div className="cz-frame">
        <div ref={boardRef} className={`cz-board${shake ? " shake" : ""}${loading ? " dim" : ""}`}>
          {squares.map((sq, i) => {
            const piece = game?.get(sq);
            const dark = (FILES.indexOf(sq[0]) + Number(sq[1])) % 2 === 1;
            const cls = [
              "cz-sq", dark && "d", lastSet.has(sq) && "last", sel === sq && "sel", hint === sq && "hint",
              targets.includes(sq) && (piece ? "cap" : "tgt"),
            ].filter(Boolean).join(" ");
            return (
              <div key={sq} data-sq={sq} className={cls} onClick={() => tap(sq)} onPointerDown={(e) => piece && down(e, sq)}>
                {i % 8 === 0 && <i className="cz-rk">{sq[1]}</i>}
                {i >= 56 && <i className="cz-fl">{sq[0]}</i>}
                {piece && (
                  <span className={`cz-pc ${piece.color}${drag?.from === sq ? " lift" : ""}${mine(sq) ? " mine" : ""}`}>
                    {GLYPH[piece.type]}{"︎"}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
      {drag && (
        <span className={`cz-ghost cz-pc ${drag.piece.color}`} style={{ left: drag.x, top: drag.y }}>
          {GLYPH[drag.piece.type]}{"︎"}
        </span>
      )}

      <div className={`cz-msg ${status}`} role="status">
        <span>{err || msg}</span>
        <em title="days in a row">♞ {streak}</em>
      </div>
      <div className="cz-btns">
        {status === "playing" ? (
          <button className="mini-btn ghost" onClick={showHint} disabled={!puz}>hint</button>
        ) : (
          <button className="mini-btn ghost" onClick={retry}>try again</button>
        )}
        <button className="mini-btn" onClick={() => load(anotherPuzzle)} disabled={loading}>another puzzle</button>
      </div>
      {expanded ? (
        <div className="cz-more">
          {status === "playing" && <button className="mini-btn ghost" onClick={showAnswer} disabled={!puz}>show answer</button>}
          {puz && !puz.daily && <button className="mini-btn ghost" onClick={() => load(() => dailyPuzzle())}>today&apos;s puzzle</button>}
        </div>
      ) : (
        (status === "playing" || (puz && !puz.daily)) && (
          <Fold label="more">
            <div className="cz-more">
              {status === "playing" && <button className="mini-btn ghost" onClick={showAnswer} disabled={!puz}>show answer</button>}
              {puz && !puz.daily && <button className="mini-btn ghost" onClick={() => load(() => dailyPuzzle())}>today&apos;s puzzle</button>}
            </div>
          </Fold>
        )
      )}
      <Credit>
        <a href="https://lichess.org/training/daily" target="_blank" rel="noreferrer">Lichess</a>
        {puz?.rating ? ` · rated ${puz.rating}` : ""}
        {(st.total ?? 0) > 0 ? ` · ${st.total} solved` : ""}
        {(st.best ?? 0) > 1 ? ` · best streak ${st.best}` : ""}
      </Credit>
    </div>
  );
}
