import { useEffect, useRef } from "react";
import { W, INKS, paint, line } from "../../lib/flipbook";

// The pixel-screen pieces the Flipbook and Picto chat share: a picture, a screen you
// draw on, and the touch screen's tool strip. Pictures are lib/flipbook's.

const INK_NAMES = ["", "black", "red", "blue"];
export const SIZES = [{ id: 0, label: "fine" }, { id: 1, label: "mid" }, { id: 2, label: "thick" }];

// A picture on a pixel screen
export function Pic({ px, under, className = "", label }) {
  const cv = useRef(null);
  useEffect(() => {
    if (cv.current) paint(cv.current, px, under);
  }, [px, under]);
  return <canvas ref={cv} className={`flb-px ${className}`} width={W} height={px.length / W} role="img" aria-label={label} />;
}

// A screen you draw on. Strokes go into a copy of px; onDone(copy) once the pen lifts.
export function Pad({ px, under, ink, width, onDone, label }) {
  const cv = useRef(null);
  const work = useRef(null);
  const last = useRef(null);
  const h = px.length / W;

  useEffect(() => {
    if (cv.current && !work.current) paint(cv.current, px, under);
  }, [px, under]);

  const at = (e) => {
    const r = cv.current.getBoundingClientRect();
    return [((e.clientX - r.left) / r.width) * W, ((e.clientY - r.top) / r.height) * h];
  };
  const down = (e) => {
    if (e.button > 0) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    work.current = px.slice();
    last.current = at(e);
    line(work.current, last.current, last.current, width, ink);
    paint(cv.current, work.current, under);
  };
  const move = (e) => {
    if (!work.current) return;
    for (const ev of e.nativeEvent.getCoalescedEvents?.() ?? [e]) {
      const p = at(ev);
      line(work.current, last.current, p, width, ink);
      last.current = p;
    }
    paint(cv.current, work.current, under);
  };
  const up = () => {
    const done = work.current;
    if (!done) return;
    work.current = null;
    onDone(done);
  };

  return (
    <canvas
      ref={cv}
      className="flb-px flb-pad"
      width={W}
      height={h}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
      aria-label={label}
    />
  );
}

const Eraser = () => (
  <svg viewBox="0 0 16 16" aria-hidden="true">
    <path d="M9.5 2.5l4 4-6 6.5H4.5l-2-2z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    <path d="M6.5 5.5l4 4" stroke="currentColor" strokeWidth="1.5" />
  </svg>
);

// Pen, eraser and the three inks; `end` is the button at the far right (undo, clear)
export function PenTools({ tool, setTool, ink, setInk, end }) {
  return (
    <div className="flb-tools" role="toolbar" aria-label="Pen">
      <button className={tool === "pen" ? "on" : ""} onClick={() => setTool("pen")} aria-pressed={tool === "pen"} aria-label="Pen">✎</button>
      <button className={tool === "eraser" ? "on" : ""} onClick={() => setTool("eraser")} aria-pressed={tool === "eraser"} aria-label="Eraser"><Eraser /></button>
      <span className="flb-sep" />
      {[1, 2, 3].map((k) => (
        <button
          key={k}
          className={`flb-ink${tool === "pen" && ink === k ? " on" : ""}`}
          style={{ "--c": INKS[k] }}
          onClick={() => (setInk(k), setTool("pen"))}
          aria-label={`${INK_NAMES[k]} ink`}
          aria-pressed={tool === "pen" && ink === k}
        />
      ))}
      <span className="flb-sep" />
      {end}
    </div>
  );
}
