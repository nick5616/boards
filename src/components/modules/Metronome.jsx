import { useState, useEffect, useRef } from "react";
import { useLive } from "../../contexts/LiveContext";
import { getAudio, hasGesture } from "../../lib/audio";
import { BPM_MIN, BPM_MAX, clampBpm, metroState, beatAt } from "../../lib/metronome";
import { MODULES } from "../../constants/modules";

const BEATS = [2, 3, 4, 5, 6, 7];
const SUBS = [1, 2, 3, 4];
const PIVOT = 100; // where the arm turns, in the drawing's units
const D_MIN = 22; // weight's distance up the arm at the fastest tempo
const D_MAX = 80; // ...and at the slowest
const SWING = 22; // degrees either side of upright

const weightAt = (bpm) => D_MAX - ((bpm - BPM_MIN) / (BPM_MAX - BPM_MIN)) * (D_MAX - D_MIN);
const bpmAt = (d) => clampBpm(BPM_MIN + ((D_MAX - d) / (D_MAX - D_MIN)) * (BPM_MAX - BPM_MIN));
const num = (v, lo, hi) => Math.max(lo, Math.min(hi, Math.round(Number(v)) || lo));

// A wooden wind-up metronome. The ticking itself is run by the live dock (so it goes
// on when you leave the board); this card is the face: the arm just follows the
// audio clock, and everything you set lands in the module.
export default function Metronome({ board, mod, setState, openBig, expanded }) {
  const live = useLive();
  const s = metroState(mod.state);
  const running = !!s.startedAt;
  const id = `metronome:${mod.id}`;

  const svgRef = useRef(null);
  const armRef = useRef(null);
  const [beat, setBeat] = useState(-1); // which beat of the bar the dots are lit on
  const [mute, setMute] = useState(false); // running, but nothing can sound until a tap

  // The arm and the dots follow the audio clock, one frame at a time
  useEffect(() => {
    const arm = armRef.current;
    if (!running) {
      arm?.setAttribute("transform", `rotate(0 50 ${PIVOT})`);
      setBeat(-1);
      setMute(false);
      return;
    }
    let raf;
    let lit = -1;
    const frame = () => {
      const a = getAudio();
      setMute((m) => (m === !a ? m : !a));
      const b = a && beatAt(mod.id, a.currentTime);
      if (b) {
        const into = Math.min(1, (a.currentTime - b.time) / b.period);
        // one beat is one swing: the extremes land on the clicks
        const deg = SWING * Math.cos(Math.PI * (b.n + into));
        arm?.setAttribute("transform", `rotate(${deg.toFixed(2)} 50 ${PIVOT})`);
        if (b.pos !== lit) setBeat((lit = b.pos));
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [running, mod.id]);

  const patch = (p) => setState((st) => ({ ...st, ...p }));
  const setBpm = (n) => patch({ bpm: clampBpm(n) });
  const setTrainer = (p) => patch({ trainer: { ...s.trainer, ...p } });

  // Slide the weight: pointer height on the (upright) arm becomes the tempo
  const drag = (e) => {
    const svg = svgRef.current;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const p = pt.matrixTransform(svg.getScreenCTM().inverse());
    setBpm(bpmAt(Math.max(D_MIN, Math.min(D_MAX, PIVOT - p.y))));
  };

  // Tap tempo: the average gap of the last few taps, forgetting a pause
  const taps = useRef([]);
  const tap = (e) => {
    const t = e.timeStamp;
    const ts = taps.current;
    if (ts.length && t - ts[ts.length - 1] > 2000) ts.length = 0;
    ts.push(t);
    if (ts.length > 6) ts.shift();
    if (ts.length >= 2) setBpm((60000 * (ts.length - 1)) / (t - ts[0]));
  };

  // The typed number waits until you're done typing
  const [draft, setDraft] = useState(null);
  const commit = () => {
    if (draft !== null) setBpm(draft);
    setDraft(null);
  };

  const wired = s.sendTo.filter((m) => board.modules.some((x) => x.id === m));
  const targets = board.modules.filter((m) => MODULES[m.type]?.receive);

  return (
    <div className={`met${expanded ? " big" : ""}`}>
      <svg ref={svgRef} className="met-svg" viewBox="0 0 100 130" aria-hidden="true">
        <polygon className="met-body" points="18,124 82,124 63,22 37,22" />
        <polygon className="met-face" points="42,36 58,36 61,112 39,112" />
        <g ref={armRef} transform={`rotate(0 50 ${PIVOT})`}>
          <rect className="met-arm" x="48.6" y={PIVOT - 90} width="2.8" height="98" rx="1.2" />
          <rect className="met-weight" x="43" y={PIVOT - weightAt(s.bpm) - 6} width="14" height="12" rx="2" />
        </g>
        <circle className="met-pin" cx="50" cy={PIVOT} r="3.2" />
        {/* the grab strip stays upright, whatever the arm is doing */}
        <rect
          className="met-track"
          x="34"
          y={PIVOT - D_MAX - 8}
          width="32"
          height={D_MAX - D_MIN + 16}
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            drag(e);
          }}
          onPointerMove={(e) => e.currentTarget.hasPointerCapture(e.pointerId) && drag(e)}
        />
      </svg>

      <div className="met-beats" aria-hidden="true">
        {Array.from({ length: s.beats }, (_, i) => (
          <i key={i} className={`${i === beat ? "on" : ""}${i === 0 && s.accent ? " first" : ""}`} />
        ))}
      </div>

      <div className="met-bpm">
        <button className="mini-btn" onClick={() => setBpm(s.bpm - 1)} aria-label="Slower">−</button>
        <input
          type="number"
          min={BPM_MIN}
          max={BPM_MAX}
          value={draft ?? s.bpm}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
          aria-label="Beats per minute"
        />
        <button className="mini-btn" onClick={() => setBpm(s.bpm + 1)} aria-label="Faster">+</button>
      </div>

      <div className="met-go">
        <button
          className={`mini-btn met-start${running ? " on" : ""}`}
          onClick={() => (running ? live.stop(id, { log: true }) : live.start({ kind: "metronome", boardId: board.id, modId: mod.id }))}
        >
          {running ? "■ stop & log" : "▶ wind up"}
        </button>
        <button className="mini-btn" onClick={tap}>tap</button>
      </div>
      {running && (mute || !hasGesture()) && <div className="met-hint">tap anywhere to hear it</div>}

      <div className="met-chips" role="radiogroup" aria-label="Beats per bar">
        {BEATS.map((n) => (
          <button key={n} role="radio" aria-checked={n === s.beats} className={`met-chip${n === s.beats ? " sel" : ""}`} onClick={() => patch({ beats: n })}>
            {n}
          </button>
        ))}
      </div>

      {!expanded && openBig && (
        <button className="mini-btn ghost met-more" onClick={openBig}>
          more…{s.trainer.on ? " (trainer on)" : ""}
        </button>
      )}
      {running && !expanded && (
        <button className="mini-btn ghost tmr-cancel" onClick={() => live.stop(id, { log: false })}>
          stop, don't log
        </button>
      )}

      {expanded && (
        <div className="met-more-panel">
          <label className="met-row">
            <input type="checkbox" checked={s.accent} onChange={(e) => patch({ accent: e.target.checked })} /> accent beat 1
          </label>
          <div className="met-row">
            subdivide
            <span className="met-chips" role="radiogroup" aria-label="Clicks per beat">
              {SUBS.map((n) => (
                <button key={n} role="radio" aria-checked={n === s.sub} className={`met-chip${n === s.sub ? " sel" : ""}`} onClick={() => patch({ sub: n })}>
                  {n === 1 ? "off" : n}
                </button>
              ))}
            </span>
          </div>

          <div className="met-trainer">
            <label className="met-row">
              <input type="checkbox" checked={s.trainer.on} onChange={(e) => setTrainer({ on: e.target.checked })} /> speed trainer
            </label>
            <div className="met-row">
              +<input type="number" value={s.trainer.step} min={1} max={40} onChange={(e) => setTrainer({ step: num(e.target.value, 1, 40) })} aria-label="Bpm to add" />
              bpm every
              <input type="number" value={s.trainer.every} min={1} max={64} onChange={(e) => setTrainer({ every: num(e.target.value, 1, 64) })} aria-label="Bars between steps" />
              bars, up to
              <input type="number" value={s.trainer.target} min={BPM_MIN} max={BPM_MAX} onChange={(e) => setTrainer({ target: num(e.target.value, BPM_MIN, BPM_MAX) })} aria-label="Target bpm" />
            </div>
          </div>

          <div className="met-send">
            <b>Send readings to…</b>
            {targets.length === 0 && <span className="met-none">add a graph, tally or jar to this board</span>}
            {targets.map((m) => (
              <label key={m.id} className="met-row">
                <input
                  type="checkbox"
                  checked={wired.includes(m.id)}
                  onChange={(e) => patch({ sendTo: e.target.checked ? [...wired, m.id] : wired.filter((x) => x !== m.id) })}
                />
                {m.title}
              </label>
            ))}
            {wired.length > 0 && <span className="met-none">the tempo you stop at goes there</span>}
          </div>
          {running && (
            <button className="mini-btn ghost tmr-cancel" onClick={() => live.stop(id, { log: false })}>
              stop, don't log
            </button>
          )}
        </div>
      )}
    </div>
  );
}
