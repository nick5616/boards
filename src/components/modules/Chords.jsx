import { Seg, Empty, Fold, Credit } from "./kit";
import { useState, useEffect, useRef, useMemo } from "react";
import { parseProgression, shapeFor, chordNotes } from "../../lib/music";
import { note, click, getAudio } from "../../lib/audio";

const INK = "#2a2520";
const ROWS = 5; // frets drawn

// One chord diagram: strings run left to right low to high, frets top to bottom
export function Diagram({ shape, name, on, inst }) {
  const n = inst === "ukulele" ? 4 : 6;
  const x0 = 14, x1 = 56;
  const gap = (x1 - x0) / (n - 1);
  const y0 = 24, rowH = 11;
  const xs = (i) => x0 + i * gap;
  const ys = (r) => y0 + r * rowH; // r = 0 is the nut/top line
  return (
    <svg viewBox="0 0 70 86" className={`ch-dia${on ? " on" : ""}`} role="img" aria-label={`${name} on ${inst}`}>
      <text x="35" y="11" textAnchor="middle" className="ch-name">{name}</text>
      {!shape ? (
        <text x="35" y="52" textAnchor="middle" className="chd-none">no shape</text>
      ) : (
        <>
          {shape.base === 1 ? (
            <rect x={x0 - 1} y={y0 - 3} width={x1 - x0 + 2} height="3.5" fill={INK} />
          ) : (
            <text x={x1 + 4} y={y0 + rowH * 0.8} className="ch-fr">{shape.base}fr</text>
          )}
          {Array.from({ length: ROWS + 1 }, (_, r) => (
            <line key={r} x1={x0} x2={x1} y1={ys(r)} y2={ys(r)} stroke={INK} strokeWidth={r === 0 && shape.base !== 1 ? 1.2 : 1} />
          ))}
          {Array.from({ length: n }, (_, i) => (
            <line key={i} x1={xs(i)} x2={xs(i)} y1={ys(0)} y2={ys(ROWS)} stroke={INK} strokeWidth="1.2" />
          ))}
          {shape.barre && (
            <rect
              x={xs(shape.barre.from) - 3.5}
              width={xs(shape.barre.to) - xs(shape.barre.from) + 7}
              y={ys(shape.barre.fret - shape.base) + 2}
              height={rowH - 4}
              rx="3.5"
              fill={INK}
            />
          )}
          {shape.frets.map((f, i) =>
            f < 0 ? (
              <text key={i} x={xs(i)} y={y0 - 7} textAnchor="middle" className="ch-x">×</text>
            ) : f === 0 ? (
              <circle key={i} cx={xs(i)} cy={y0 - 7.5} r="2.6" fill="none" stroke={INK} strokeWidth="1.2" />
            ) : (
              <circle key={i} cx={xs(i)} cy={ys(f - shape.base) + rowH / 2} r="3.6" fill={INK} />
            )
          )}
        </>
      )}
    </svg>
  );
}

// A songbook page of chord diagrams for the progression you type. Guitar or ukulele
// shapes are worked out here (no lookup), tap one to hear it strummed, or press
// practice to step through the changes at a tempo with a click.
// State: inst "guitar"|"ukulele", prog "C G Am F", bpm, beats (per chord).
export default function Chords({ mod, setState, onPatch, expanded }) {
  const { inst = "guitar", prog = "C G Am F", bpm = 80, beats = 4 } = mod.state;
  const [text, setText] = useState(prog);
  const [step, setStep] = useState(-1); // which chord is lit (-1 = none)
  const [running, setRunning] = useState(false);
  const [quiet, setQuiet] = useState(false); // sound blocked until a tap
  const timer = useRef(null);
  const live = useRef({});

  const chords = useMemo(() => parseProgression(prog), [prog]);
  const shapes = useMemo(() => chords.map((c) => shapeFor(c.chord, inst)), [chords, inst]);

  const strum = (i) => {
    const sh = shapes[i];
    if (!sh) return;
    if (!getAudio()) { setQuiet(true); return; }
    setQuiet(false);
    const t = getAudio().currentTime;
    chordNotes(sh, inst).forEach((m, k) => note(m, { when: t + k * 0.035, dur: 1.1, vel: 0.55, type: "triangle" }));
  };

  // practice: a click each beat, a strum on the first beat of each chord
  live.current = { chords, shapes, strum, beats };
  useEffect(() => {
    if (!running) return;
    let beat = 0;
    const tick = () => {
      const { chords: cs, strum: play, beats: per } = live.current;
      if (!cs.length) return;
      const i = Math.floor(beat / per) % cs.length;
      const first = beat % per === 0;
      if (first) { setStep(i); play(i); }
      if (getAudio()) click(getAudio().currentTime, { accent: first, gain: 0.35 });
      beat++;
    };
    tick();
    timer.current = setInterval(tick, 60000 / bpm);
    return () => clearInterval(timer.current);
  }, [running, bpm]);

  const stop = () => { setRunning(false); setStep(-1); };

  const commit = () => {
    const clean = text.trim();
    if (!clean || clean === prog) return;
    setState((s) => ({ ...s, prog: clean }));
    stop();
    const names = parseProgression(clean).filter((c) => c.chord).slice(0, 4).map((c) => c.chord.name);
    if (!mod.named && names.length) onPatch?.({ title: `${names.join(" ")} chart` });
  };

  const set = (k, v) => setState((s) => ({ ...s, [k]: v }));
  const bad = chords.filter((c) => !c.chord).length;

  return (
    <div className={`ch${expanded ? " big" : ""}`}>
      <input
        className="line-input ch-prog"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === "Enter" && (commit(), e.currentTarget.blur())}
        placeholder="C G Am F"
        aria-label="Chord progression"
      />
      {bad > 0 && <div className="ch-note">{bad} not recognised. Try C, F#m, Bb7, Gsus4.</div>}

      <div className="ch-page">
        {chords.map((c, i) => (
          <button key={i} className="ch-card" onClick={() => strum(i)} aria-label={`Play ${c.tok}`}>
            <Diagram shape={shapes[i]} name={c.chord?.name ?? c.tok} on={step === i} inst={inst} />
          </button>
        ))}
        {chords.length === 0 && <Empty>Type a progression, like Am F C G.</Empty>}
      </div>

      <div className="ch-practice">
        <button className={`mini-btn${running ? " on" : ""}`} onClick={() => (running ? stop() : setRunning(true))} disabled={!chords.length}>
          {running ? "■ stop" : "▶ practice"}
        </button>
        <span className="ch-bpm">{bpm} bpm</span>
      </div>
      {quiet && <div className="ch-note">tap a chord again to turn the sound on</div>}

      <Fold label="tempo & instrument" start={false}>
        <Seg small label="Instrument" options={["guitar", "ukulele"]} value={inst} onChange={(v) => set("inst", v)} />
        <label className="ch-slide">
          <input type="range" min="40" max="160" value={bpm} onChange={(e) => set("bpm", Number(e.target.value))} aria-label="Tempo" />
          <span>{bpm} bpm</span>
        </label>
        <Seg small label="Beats per chord" options={[{ id: "2", label: "2 beats" }, { id: "4", label: "4 beats" }]} value={String(beats)} onChange={(v) => set("beats", Number(v))} />
      </Fold>
    </div>
  );
}
