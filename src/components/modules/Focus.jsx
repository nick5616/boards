import { useState, useEffect, useSyncExternalStore } from "react";
import { useLive } from "../../contexts/LiveContext";
import { cfg, phaseOf, phaseMins, PHASE_NAME, todayMarks, hm, setPhase } from "../../lib/pomodoro";
import { LAYERS, setLevels, startNoise, stopNoise, isOn, subscribe, mixName } from "../../lib/noise";
import { useData } from "../../contexts/DataContext";
import SendTo, { WireTag } from "../board/SendTo";

const clock = (ms) => {
  const s = Math.ceil(Math.abs(ms) / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

const Tomato = () => (
  <svg viewBox="0 0 20 20" className="fb-tom" aria-hidden="true">
    <circle cx="10" cy="11.5" r="7" fill="#ef4b3a" stroke="#2a2520" strokeWidth="1.5" />
    <path d="M6.5 5.5l3.5 2 3.5-2M10 7.5V3.5" fill="none" stroke="#3f7a3f" strokeWidth="1.8" strokeLinecap="round" />
    <path d="M6.5 10a3 3 0 0 1 2-2.2" fill="none" stroke="#fff" strokeOpacity=".7" strokeWidth="1.2" strokeLinecap="round" />
  </svg>
);

// A study carrel with a desk lamp. The pomodoro runs through the live dock, and the
// hush (brown / pink / white noise, rain, café) is made right here in the browser and
// keeps playing when you go to another board.
export default function Focus({ board, mod, setState, expanded }) {
  const live = useLive();
  const { updateBoard } = useData();
  const s = mod.state;
  const c = cfg(s);
  const phase = phaseOf(s);
  const { startedAt = null } = s;
  const [now, setNow] = useState(Date.now);
  const [setup, setSetup] = useState(false);
  const noiseOn = useSyncExternalStore(subscribe, isOn);
  const mix = s.mix ?? { rain: 0.5 };

  useEffect(() => {
    if (!startedAt) return;
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [startedAt]);

  const total = phaseMins(s) * 60000;
  const left = startedAt ? total - Math.max(0, now - startedAt) : total;
  const rung = !!startedAt && left <= 0;
  const frac = startedAt ? Math.max(0, left) / total : 1;
  const marks = todayMarks(s);
  const mins = marks.reduce((n, m) => n + m.mins, 0);

  const start = () => live.start({ kind: "focus", boardId: board.id, modId: mod.id });
  const stop = (log) => live.stop(`focus:${mod.id}`, { log });

  // The noise belongs to the dock, not this card: its ticket stops it from anywhere
  const noiseId = `noise:${mod.id}`;
  const hush = () => {
    if (noiseOn && live.sessions.some((x) => x.id === noiseId)) return live.stop(noiseId);
    if (!startNoise(mix)) return;
    live.start({ id: noiseId, kind: "noise", boardId: board.id, modId: mod.id, icon: "🎧", label: mixName(mix), onStop: stopNoise });
  };
  const hushHere = noiseOn && live.sessions.some((x) => x.id === noiseId);

  const slide = (id, v) => {
    const next = { ...mix, [id]: v };
    setLevels(next);
    if (hushHere) live.update(noiseId, { label: mixName(next) });
    setState((st) => ({ ...st, mix: next }), { debounce: 400 });
  };

  const setCfg = (k, v) => {
    const n = Math.max(1, Math.min(180, Math.round(Number(v)) || 1));
    setState((st) => ({ ...st, [k]: n }), { debounce: 500 });
  };

  return (
    <div className={`fb${startedAt ? " lit" : ""}${phase !== "focus" ? " brk" : ""}`}>
      <div className="fb-carrel">
        <svg className="fb-lamp" viewBox="0 0 90 100" aria-hidden="true">
          <path className="fb-beam" d="M26 34 L4 98 H74 Z" />
          <ellipse cx="62" cy="94" rx="20" ry="4.5" fill="#2a2520" />
          <path d="M62 92V62L42 30" fill="none" stroke="#2a2520" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M62 92V62L42 30" fill="none" stroke="#c9a227" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <path className="fb-shade" d="M30 20 L50 36 L40 46 Q22 40 16 30 Z" />
          <circle cx="42" cy="30" r="3" fill="#2a2520" />
        </svg>

        <button
          className={`fb-clock${rung ? " ringing" : ""}`}
          onClick={() => (startedAt ? stop(true) : start())}
          aria-label={startedAt ? "Finish this stretch" : `Start ${PHASE_NAME[phase]}, ${phaseMins(s)} minutes`}
        >
          <span className="fb-phase">{PHASE_NAME[phase]}</span>
          <span className="fb-time">{startedAt ? (rung ? `+${clock(left)}` : clock(left)) : `${phaseMins(s)}:00`}</span>
          <span className="fb-ring" style={{ "--frac": frac }} />
          <span className="fb-hint">{startedAt ? (rung ? "ding! tap to log" : "tap to stop") : "tap to begin"}</span>
        </button>
      </div>

      <div className="fb-dots" aria-label={`Round ${(s.round ?? 0) + 1} of ${c.every}`}>
        {Array.from({ length: c.every }, (_, i) => (
          <i key={i} className={i < (s.round ?? 0) ? "on" : i === (s.round ?? 0) && phase === "focus" && startedAt ? "now" : ""} />
        ))}
        {startedAt ? (
          <button className="mini-btn ghost" onClick={() => stop(false)}>cancel</button>
        ) : (
          phase !== "focus" && <button className="mini-btn ghost" onClick={() => setPhase(updateBoard, board.id, mod.id, "focus")}>skip break</button>
        )}
      </div>

      <div className="fb-toms" title={marks.length ? `${marks.length} today · ${hm(mins)}` : "no tomatoes yet today"}>
        {marks.length === 0 && <span className="fb-none">no tomatoes yet today</span>}
        {marks.slice(-12).map((m, i) => <Tomato key={i} />)}
        {marks.length > 0 && <b>{marks.length} · {hm(mins)}</b>}
      </div>

      <div className="fb-mix">
        <div className="fb-mixhead">
          <b>the hush</b>
          <button className={`mini-btn${hushHere ? " on" : ""}`} onClick={hush} aria-pressed={hushHere}>
            {hushHere ? "■ hush off" : "▶ hush on"}
          </button>
        </div>
        {LAYERS.map((l) => (
          <label key={l.id} className="fb-row" title={l.hint}>
            <span>{l.label}</span>
            <input type="range" min="0" max="1" step="0.02" value={mix[l.id] ?? 0} onChange={(e) => slide(l.id, Number(e.target.value))} aria-label={`${l.label} noise`} />
          </label>
        ))}
      </div>

      <button className="pile-toggle" onClick={() => setSetup((v) => !v)} aria-expanded={setup}>
        {setup ? "▾" : "▸"} {c.focus}/{c.short} · long {c.long} every {c.every}
      </button>
      {setup && (
        <div className="fb-setup">
          {[["focus", "focus"], ["short", "short break"], ["long", "long break"], ["every", "rounds per cycle"]].map(([k, label]) => (
            <label key={k}>
              {label}
              <input type="number" min="1" max="180" value={c[k]} onChange={(e) => setCfg(k, e.target.value)} />
            </label>
          ))}
        </div>
      )}
      <WireTag board={board} mod={mod} />
      {!startedAt && expanded !== false && <SendTo fold board={board} mod={mod} setState={setState} note="each focus round's minutes go there" />}
    </div>
  );
}
