import { useState, useEffect, useRef } from "react";
import { uid } from "../../utils/uid";
import { Fold, ChipRow, Credit } from "./kit";
import { CATEGORIES, catName, fetchRound, bestThisWeek } from "../../lib/trivia";

const LETTERS = ["A", "B", "C", "D"];
const PAD = ["#ff5d8f", "#4d9bff", "#ffc933", "#8ac926"]; // one colour per answer button, game-show style

// A quiz-show buzzer card: pick a category, buzz in, ten questions from Open Trivia DB.
// Rounds are kept so the card can draw how you've been doing.
// State: cat (last category id), rounds [{ id, at, cat, score, of }] newest last, max 60.
export default function Trivia({ mod, setState, expanded }) {
  const { cat = 0, rounds = [] } = mod.state ?? {};
  const [phase, setPhase] = useState("lobby"); // lobby | loading | question | done
  const [qs, setQs] = useState([]);
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState(null);
  const [score, setScore] = useState(0);
  const [err, setErr] = useState("");
  const [wait, setWait] = useState(false);
  const alive = useRef(true);
  useEffect(() => () => { alive.current = false; }, []);

  const start = () => {
    setPhase("loading"); setErr(""); setWait(true);
    fetchRound(cat)
      .then((list) => {
        if (!alive.current) return;
        setQs(list); setI(0); setScore(0); setPicked(null); setPhase("question");
      })
      .catch(() => alive.current && (setErr("couldn't get questions. try again in a few seconds"), setPhase("lobby")))
      .finally(() => alive.current && setWait(false));
  };

  const q = qs[i];
  const answer = (n) => {
    if (picked != null) return;
    setPicked(n);
    if (n === q.right) setScore((s) => s + 1);
  };
  const next = () => {
    if (i + 1 < qs.length) { setI(i + 1); setPicked(null); return; }
    const round = { id: uid(), at: Date.now(), cat, score, of: qs.length };
    setState((s) => ({ ...s, rounds: [...(s.rounds ?? []), round].slice(-60) }));
    setPhase("done");
  };

  const best = bestThisWeek({ rounds });
  const chips = CATEGORIES.map((c) => (
    <button key={c.id} role="radio" aria-checked={cat === c.id} className={`tv-cat${cat === c.id ? " on" : ""}`} onClick={() => setState((s) => ({ ...s, cat: c.id }))}>
      {c.icon} {c.name}
    </button>
  ));
  const recent = rounds.slice(-14);

  return (
    <div className="tv">
      <div className="tv-marquee" aria-hidden="true">
        {Array.from({ length: 12 }, (_, n) => <i key={n} style={{ animationDelay: `${(n % 4) * 0.25}s` }} />)}
      </div>
      {phase === "question" && <div className="tv-head"><span>{catName(cat)} · {i + 1} of {qs.length}</span></div>}

      {phase === "lobby" && (
        <>
          <button className="tv-buzz" onClick={start}><span>BUZZ IN</span></button>
          <div className="tv-best">{best ? `best this week ${best.score}/${best.of}` : "ten questions a round"}</div>
          {err && <div className="tv-err" role="alert">{err}</div>}
          {expanded ? (
            <>
              <ChipRow label="Category">{chips}</ChipRow>
              <Chart rounds={recent} />
            </>
          ) : (
            <Fold label={`${catName(cat)}`}>
              <ChipRow label="Category">{chips}</ChipRow>
            </Fold>
          )}
        </>
      )}

      {phase === "loading" && (
        <div className="tv-wait" role="status">
          <div className="tv-spin" />
          shuffling the cards…
          {wait && <small>the question bank only answers every 5 seconds</small>}
        </div>
      )}

      {phase === "question" && q && (
        <div className="tv-q">
          <div className="tv-text">{q.q}</div>
          <div className="tv-ans">
            {q.answers.map((a, n) => {
              const shown = picked != null;
              const cls = shown ? (n === q.right ? " right" : n === picked ? " wrong" : " dim") : "";
              return (
                <button key={n} className={`tv-a${cls}`} style={{ "--pad": PAD[n] }} onClick={() => answer(n)} disabled={shown}>
                  <b>{LETTERS[n]}</b><span>{a}</span>
                </button>
              );
            })}
          </div>
          {picked != null && (
            <div className="tv-next">
              <em>{picked === q.right ? "correct!" : "so close"}</em>
              <button className="mini-btn" onClick={next}>{i + 1 < qs.length ? "next" : "finish"}</button>
            </div>
          )}
          <div className="tv-score">score {score}</div>
        </div>
      )}

      {phase === "done" && (
        <div className="tv-done">
          <div className="tv-big"><b>{score}</b><span>/ {qs.length}</span></div>
          <p>{score === qs.length ? "a perfect round!" : score >= qs.length * 0.7 ? "sharp." : score >= qs.length * 0.4 ? "not bad at all." : "the cards were mean tonight."}</p>
          <div className="tv-btns">
            <button className="mini-btn" onClick={start}>another round</button>
            <button className="mini-btn ghost" onClick={() => setPhase("lobby")}>categories</button>
          </div>
          {expanded && <Chart rounds={recent} />}
        </div>
      )}

      <Credit>
        <a href="https://opentdb.com" target="_blank" rel="noreferrer">Open Trivia DB</a> · CC BY-SA
      </Credit>
    </div>
  );
}

// The last rounds as little bars, newest on the right
function Chart({ rounds }) {
  if (!rounds.length) return null;
  const W = 14, H = 40;
  return (
    <div className="tv-chart">
      <svg viewBox={`0 0 ${rounds.length * W + 2} ${H + 4}`} role="img" aria-label={`Last ${rounds.length} rounds: ${rounds.map((r) => `${r.score} of ${r.of}`).join(", ")}`}>
        <line x1="0" x2={rounds.length * W + 2} y1={H + 2} y2={H + 2} stroke="#2a2520" strokeWidth="1.5" />
        {rounds.map((r, n) => {
          const h = Math.max(2, (r.score / r.of) * H);
          return (
            <rect key={r.id} x={n * W + 3} y={H + 2 - h} width={W - 4} height={h} rx="2"
              fill={n === rounds.length - 1 ? "#ff5d8f" : "#ffc933"} stroke="#2a2520" strokeWidth="1.4">
              <title>{`${r.score}/${r.of} · ${catName(r.cat)}`}</title>
            </rect>
          );
        })}
      </svg>
      <span>last {rounds.length} round{rounds.length > 1 ? "s" : ""}</span>
    </div>
  );
}
