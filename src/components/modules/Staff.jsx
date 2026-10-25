import { useState, useEffect, useRef, useMemo } from "react";
import { uid } from "../../utils/uid";
import { useData } from "../../contexts/DataContext";
import { note as playNote, getAudio } from "../../lib/audio";
import { CLEF_BASE, spelled, stepOf, midiFor, layout, barsOf } from "../../lib/staff";

const DURS = [
  { d: 4, name: "whole" },
  { d: 2, name: "half" },
  { d: 1, name: "quarter" },
  { d: 0.5, name: "eighth" },
];
const TIMES = [[4, 4], [3, 4], [2, 4], [6, 8]];
const SPAN = [-6, 14]; // steps above/below the bottom line you can click (ledger lines)

// A treble or bass clef, drawn with strokes in units of one staff space
function Clef({ clef, x, y, S }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${S})`} className="stf-clef" strokeWidth={0.32}>
      {clef === "treble" ? (
        <path d="M1.2,-5.4 C2,-4.7 1.9,-3.4 1,-2.6 C0.1,-1.8 -0.4,-1 0.3,-0.3 C1,0.4 2.3,-0.1 2.1,-1 C1.9,-1.9 0.7,-2 0.5,-1.2 M1.2,-5.4 L1.2,0.9 C1.2,1.6 0.6,1.7 0.3,1.3" />
      ) : (
        <>
          <path d="M0.2,-3.1 C1.6,-3.7 2.4,-2.6 1.8,-1.6 C1.3,-0.8 0.7,-0.5 0,-0.1" />
          <circle cx="0.1" cy="-3" r="0.35" fill="currentColor" />
          <circle cx="2.9" cy="-3.5" r="0.28" fill="currentColor" />
          <circle cx="2.9" cy="-2.5" r="0.28" fill="currentColor" />
        </>
      )}
    </g>
  );
}

// A music notebook page: click the lines to write notes, drag them to move them,
// press play to hear it. Tiny JSON, so it syncs like any other module.
export default function Staff({ mod, setState, expanded }) {
  const { uid: me } = useData();
  const { clef = "treble", time = [4, 4], tempo = 100, notes = [] } = mod.state;
  const S = expanded ? 14 : 10;
  const maxW = expanded ? 900 : Infinity;
  const base = CLEF_BASE[clef];

  const [dur, setDur] = useState(1);
  const [acc, setAcc] = useState(null); // "#" | "b" | null for the next note
  const [rest, setRest] = useState(false);
  const [sel, setSel] = useState(null); // selected note id
  const [drag, setDrag] = useState(null); // { id, y0, step0, step }
  const [head, setHead] = useState(null); // playhead, in beats
  const play = useRef({ oscs: [], raf: 0 });
  const box = useRef(null);

  const lay = useMemo(() => layout(notes, time, S, maxW), [notes, time, S, maxW]);
  const sysH = S * 14;
  const top = S * 4;
  const yBottom = (line) => line * sysH + top + 4 * S;
  const yOfStep = (line, step) => yBottom(line) - ((step - base) * S) / 2;
  const slot = Object.fromEntries(lay.items.map((it) => [it.i, it]));
  const height = lay.lines * sysH;
  const total = notes.reduce((t, n) => t + n.d, 0);

  const patch = (p) => setState((s) => ({ ...s, ...p }));
  const editNote = (id, f) => setState((s) => ({ ...s, notes: (s.notes ?? []).map((n) => (n.id === id ? f(n) : n)) }));
  const selNote = notes.find((n) => n.id === sel);

  const hear = (m) => m != null && getAudio() && playNote(m, { dur: 0.6 });

  // --- writing -------------------------------------------------------------
  const onPaper = (e) => {
    const r = box.current.getBoundingClientRect();
    const px = e.clientX - r.left;
    const py = e.clientY - r.top;
    const line = Math.min(lay.lines - 1, Math.max(0, Math.floor(py / sysH)));
    // Goes before the first note to the right of the click on that line, else at the end of it
    let at = notes.length;
    const onLine = lay.items.filter((it) => it.line === line);
    const hit = onLine.find((it) => it.x + it.w / 2 > px);
    if (hit) at = hit.i;
    else {
      const next = lay.items.find((it) => it.line > line);
      if (next) at = next.i;
    }
    let n;
    if (rest) n = { id: uid(), m: null, d: dur, by: me };
    else {
      const step = Math.round((yBottom(line) - py) / (S / 2)) + base;
      if (step < base + SPAN[0] || step > base + SPAN[1]) return;
      const m = midiFor(step, acc);
      n = { id: uid(), m, d: dur, by: me };
      if (acc && m != null) n.acc = acc;
      hear(m);
    }
    setState((s) => {
      const list = [...(s.notes ?? [])];
      list.splice(Math.min(at, list.length), 0, n);
      return { ...s, notes: list };
    });
    setSel(n.id);
  };

  const dropNote = (id) => {
    const i = notes.findIndex((n) => n.id === id);
    patch({ notes: notes.filter((n) => n.id !== id) });
    setSel(notes[i + 1]?.id ?? notes[i - 1]?.id ?? null);
  };

  const shift = (id, steps) => {
    const n = notes.find((x) => x.id === id);
    if (!n || n.m == null) return;
    const step = Math.min(base + SPAN[1], Math.max(base + SPAN[0], stepOf(n.m, n.acc) + steps));
    const a = spelled(n);
    const m = midiFor(step, a);
    editNote(id, (x) => ({ ...x, m }));
    hear(m);
  };

  // Picking a length or accidental also changes the note you have selected
  const pickDur = (d) => {
    setDur(d);
    if (sel) editNote(sel, (n) => ({ ...n, d }));
  };
  const pickAcc = (a) => {
    const next = acc === a ? null : a;
    setAcc(next);
    if (selNote && selNote.m != null) {
      const nat = midiFor(stepOf(selNote.m, spelled(selNote)), null);
      editNote(sel, (n) => {
        const { acc: _, ...rest } = n;
        return { ...rest, m: nat + (next === "#" ? 1 : next === "b" ? -1 : 0), ...(next ? { acc: next } : {}) };
      });
    }
  };

  // dragging a note up and down changes its pitch; a plain click selects & plays it
  const down = (e, n) => {
    e.stopPropagation();
    setSel(n.id);
    box.current?.focus({ preventScroll: true });
    if (n.m == null) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const s0 = stepOf(n.m, spelled(n));
    setDrag({ id: n.id, y0: e.clientY, step0: s0, step: s0 });
  };
  const move = (e) => {
    if (!drag) return;
    const step = Math.min(base + SPAN[1], Math.max(base + SPAN[0], drag.step0 + Math.round((drag.y0 - e.clientY) / (S / 2))));
    if (step !== drag.step) setDrag({ ...drag, step });
  };
  const up = () => {
    if (!drag) return;
    const n = notes.find((x) => x.id === drag.id);
    if (n && drag.step !== drag.step0) {
      const m = midiFor(drag.step, spelled(n));
      editNote(n.id, (x) => ({ ...x, m }));
      hear(m);
    } else if (n) hear(n.m);
    setDrag(null);
  };

  const keys = (e) => {
    if (e.target.tagName === "INPUT" || e.target.tagName === "SELECT") return;
    const i = notes.findIndex((n) => n.id === sel);
    if (e.key === "Delete" || e.key === "Backspace") sel && (e.preventDefault(), dropNote(sel));
    else if (e.key === "ArrowUp" && sel) (e.preventDefault(), shift(sel, 1));
    else if (e.key === "ArrowDown" && sel) (e.preventDefault(), shift(sel, -1));
    else if (e.key === "ArrowRight") (e.preventDefault(), setSel(notes[Math.min(notes.length - 1, i + 1)]?.id ?? null));
    else if (e.key === "ArrowLeft") (e.preventDefault(), setSel(notes[Math.max(0, i - 1)]?.id ?? null));
  };

  // --- playing -------------------------------------------------------------
  const halt = () => {
    cancelAnimationFrame(play.current.raf);
    play.current.oscs.forEach((o) => {
      try {
        o?.stop();
      } catch {
        /* already finished */
      }
    });
    play.current.oscs = [];
    setHead(null);
  };
  useEffect(() => halt, []);

  const go = () => {
    if (head != null) return halt();
    const a = getAudio();
    if (!a || !notes.length) return;
    const spb = 60 / tempo;
    const t0 = a.currentTime + 0.1;
    let b = 0;
    play.current.oscs = notes.map((n) => {
      const o = n.m != null ? playNote(n.m, { when: t0 + b * spb, dur: n.d * spb * 0.9 }) : null;
      b += n.d;
      return o;
    });
    const loop = () => {
      const beat = (a.currentTime - t0) / spb;
      if (beat >= total) return halt();
      setHead(Math.max(0, beat));
      play.current.raf = requestAnimationFrame(loop);
    };
    loop();
  };

  // The playhead's spot on the page
  const headAt = (() => {
    if (head == null) return null;
    const it = [...lay.items].reverse().find((x) => x.start <= head);
    if (!it) return null;
    const f = Math.min(1, (head - it.start) / notes[it.i].d);
    return { x: it.x + f * it.w, line: it.line };
  })();

  // --- drawing -------------------------------------------------------------
  const rx = S * 0.62;
  const ry = S * 0.46;
  const bottomNote = (n, it) => {
    const picked = drag?.id === n.id;
    const step = picked ? drag.step : stepOf(n.m, spelled(n));
    const cx = it.x + it.w / 2;
    const cy = yOfStep(it.line, step);
    const a = spelled(n);
    const stemUp = step < base + 4;
    const ledgers = [];
    for (let s = base - 2; s >= step; s -= 2) ledgers.push(s);
    for (let s = base + 10; s <= step; s += 2) ledgers.push(s);
    return (
      <g
        key={n.id}
        className={`stf-note${sel === n.id ? " sel" : ""}`}
        onPointerDown={(e) => down(e, n)}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={() => setDrag(null)}
      >
        <rect x={cx - S} y={cy - S} width={S * 2} height={S * 2} fill="transparent" />
        {ledgers.map((s) => (
          <line key={s} x1={cx - S} x2={cx + S} y1={yOfStep(it.line, s)} y2={yOfStep(it.line, s)} className="stf-ledger" />
        ))}
        {a && (
          <text x={cx - S * 1.25} y={cy + S * 0.4} className="stf-acc" fontSize={S * 1.5} textAnchor="middle">
            {a === "#" ? "♯" : "♭"}
          </text>
        )}
        <ellipse
          cx={cx}
          cy={cy}
          rx={rx}
          ry={ry}
          transform={`rotate(-20 ${cx} ${cy})`}
          className={n.d >= 2 ? "stf-head open" : "stf-head"}
        />
        {n.d < 4 && (
          <line
            className="stf-stem"
            x1={stemUp ? cx + rx - 0.5 : cx - rx + 0.5}
            x2={stemUp ? cx + rx - 0.5 : cx - rx + 0.5}
            y1={cy}
            y2={stemUp ? cy - S * 3.4 : cy + S * 3.4}
          />
        )}
        {n.d < 1 && (
          <path
            className="stf-flag"
            d={
              stemUp
                ? `M${cx + rx - 0.5},${cy - S * 3.4} c${S},${S * 0.7} ${S * 0.9},${S * 1.5} ${S * 0.4},${S * 2.2}`
                : `M${cx - rx + 0.5},${cy + S * 3.4} c${S},${-S * 0.7} ${S * 0.9},${-S * 1.5} ${S * 0.4},${-S * 2.2}`
            }
          />
        )}
      </g>
    );
  };

  const restOf = (n, it) => {
    const cx = it.x + it.w / 2;
    const yt = yBottom(it.line) - 4 * S; // top line
    return (
      <g key={n.id} className={`stf-note stf-rest${sel === n.id ? " sel" : ""}`} onPointerDown={(e) => down(e, n)}>
        <rect x={cx - S} y={yt} width={S * 2} height={S * 4} fill="transparent" />
        {n.d >= 4 && <rect x={cx - S * 0.6} y={yt + S} width={S * 1.2} height={S * 0.5} />}
        {n.d >= 2 && n.d < 4 && <rect x={cx - S * 0.6} y={yt + S * 1.5} width={S * 1.2} height={S * 0.5} />}
        {n.d >= 1 && n.d < 2 && (
          <path d={`M${cx - S * 0.3},${yt + S * 0.7} l${S * 0.7},${S * 0.8} l${-S * 0.6},${S * 0.8} l${S * 0.6},${S * 0.8} q${-S},${S * 0.1} ${-S * 0.5},${S * 0.9}`} className="stf-stroke" />
        )}
        {n.d < 1 && (
          <>
            <circle cx={cx - S * 0.3} cy={yt + S * 1.5} r={S * 0.28} />
            <path d={`M${cx - S * 0.1},${yt + S * 1.6} l${-S * 0.4},${S * 1.6}`} className="stf-stroke" />
          </>
        )}
      </g>
    );
  };

  const timeBtn = (
    <select
      value={time.join("/")}
      onChange={(e) => patch({ time: e.target.value.split("/").map(Number) })}
      aria-label="Time signature"
    >
      {TIMES.map((t) => (
        <option key={t.join("/")}>{t.join("/")}</option>
      ))}
    </select>
  );

  return (
    <div className={`stf${expanded ? " big" : ""}`}>
      <div className="stf-bar">
        <button className="mini-btn" onClick={go} disabled={!notes.length && head == null} aria-label={head != null ? "Stop" : "Play"}>
          {head != null ? "■ stop" : "▶ play"}
        </button>
        <label className="stf-tempo">
          ♩=
          <input
            type="number"
            min="30"
            max="240"
            value={tempo}
            onChange={(e) => patch({ tempo: Math.max(30, Math.min(240, Number(e.target.value) || 100)) })}
          />
        </label>
        {timeBtn}
        <button className="mini-btn ghost" onClick={() => patch({ clef: clef === "treble" ? "bass" : "treble" })}>
          {clef} clef
        </button>
      </div>
      <div className="stf-bar">
        {DURS.map((x) => (
          <button key={x.d} className={`stf-chip${(selNote ? selNote.d : dur) === x.d ? " on" : ""}`} onClick={() => pickDur(x.d)} aria-pressed={dur === x.d}>
            {x.name}
          </button>
        ))}
        <button className={`stf-chip${acc === "#" ? " on" : ""}`} onClick={() => pickAcc("#")} aria-pressed={acc === "#"} aria-label="Sharp">♯</button>
        <button className={`stf-chip${acc === "b" ? " on" : ""}`} onClick={() => pickAcc("b")} aria-pressed={acc === "b"} aria-label="Flat">♭</button>
        <button className={`stf-chip${rest ? " on" : ""}`} onClick={() => setRest(!rest)} aria-pressed={rest}>rest</button>
        {sel && (
          <button className="stf-chip del" onClick={() => dropNote(sel)}>
            delete
          </button>
        )}
      </div>

      <div className="stf-scroll">
        <svg
          ref={box}
          className="stf-page"
          width={lay.width}
          height={height}
          viewBox={`0 0 ${lay.width} ${height}`}
          tabIndex={0}
          onKeyDown={keys}
          aria-label="Staff paper. Click to place a note, arrow keys to move the selected one."
        >
          <rect width={lay.width} height={height} fill="transparent" onPointerDown={onPaper} />
          {Array.from({ length: lay.lines }, (_, line) => (
            <g key={line} pointerEvents="none">
              {[0, 1, 2, 3, 4].map((k) => (
                <line key={k} x1={S * 0.4} x2={lay.width - S} y1={yBottom(line) - k * S} y2={yBottom(line) - k * S} className="stf-line" />
              ))}
              <line x1={S * 0.4} x2={S * 0.4} y1={yBottom(line)} y2={yBottom(line) - 4 * S} className="stf-line" />
              <Clef clef={clef} x={S * 0.8} y={yBottom(line)} S={S} />
              {line === 0 && (
                <g className="stf-time" fontSize={S * 2.1} textAnchor="middle">
                  <text x={S * 5.3} y={yBottom(0) - 2.3 * S}>{time[0]}</text>
                  <text x={S * 5.3} y={yBottom(0) - 0.3 * S}>{time[1]}</text>
                </g>
              )}
            </g>
          ))}
          {lay.bars.map((b, i) => (
            <line key={i} x1={b.x} x2={b.x} y1={yBottom(b.line)} y2={yBottom(b.line) - 4 * S} className="stf-bar-line" pointerEvents="none" />
          ))}
          {notes.map((n, i) => (slot[i] ? (n.m == null ? restOf(n, slot[i]) : bottomNote(n, slot[i])) : null))}
          {notes.map((n, i) =>
            slot[i] && n.ly ? (
              <text key={n.id} x={slot[i].x + slot[i].w / 2} y={yBottom(slot[i].line) + S * 4.6} className="stf-ly" fontSize={S * 1.1} textAnchor="middle" pointerEvents="none">
                {n.ly}
              </text>
            ) : null
          )}
          {headAt && (
            <line x1={headAt.x} x2={headAt.x} y1={yBottom(headAt.line) - 6 * S} y2={yBottom(headAt.line) + 2 * S} className="stf-head-line" pointerEvents="none" />
          )}
          {!notes.length && (
            <text x={lay.lead0 + S} y={yBottom(0) - 2 * S + S * 0.4} className="stf-hint" fontSize={S * 1.2} pointerEvents="none">
              click a line or space to write a note
            </text>
          )}
        </svg>
      </div>

      {selNote && (
        <label className="stf-ly-in">
          lyric
          <input
            value={selNote.ly ?? ""}
            maxLength={16}
            placeholder="syllable"
            onChange={(e) => editNote(sel, (n) => ({ ...n, ly: e.target.value }))}
            onKeyDown={(e) => {
              if (e.key !== "Enter") return;
              const nxt = notes[notes.findIndex((n) => n.id === sel) + 1];
              if (nxt) setSel(nxt.id);
            }}
          />
        </label>
      )}
      <div className="stf-foot">{barsOf(notes, time).length || 0} bar{barsOf(notes, time).length === 1 ? "" : "s"}</div>
    </div>
  );
}
