import { useState, useEffect, useRef } from "react";
import { useData } from "../../contexts/DataContext";
import { Seg, ChipRow } from "./kit";
import { Pic, Pad, PenTools, SIZES } from "./pixelKit";
import { SPEEDS, PENS, MAX_FRAMES, MAX_CHARS, BLANK, decode, encode, bookChars } from "../../lib/flipbook";

// A two-screen pocket animator. Draw a frame on the bottom (touch) screen with the one
// before showing faintly under it, flip on with ▶ (past the last page makes a new one), and
// the top screen plays the whole book. Frames are pixel pictures, packed small (lib/flipbook).
// Its doodle-chat sibling is Picto chat.

const UNDO = 20;

export default function Flipbook({ mod, setState, expanded }) {
  const { toast } = useData();
  const frames = mod.state.frames?.length ? mod.state.frames : [BLANK];
  const speed = mod.state.speed ?? 5;

  const [at, setAt] = useState(0);
  const i = Math.min(at, frames.length - 1);
  const [tool, setTool] = useState("pen");
  const [ink, setInk] = useState(1);
  const [size, setSize] = useState(1);
  const [onion, setOnion] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [shown, setShown] = useState(0);
  const width = tool === "eraser" ? PENS[size] * 3 : PENS[size];
  const pen = tool === "eraser" ? 0 : ink;

  // Undo: the book as it was before each change made here
  const undos = useRef([]);
  const [, setUndoN] = useState(0);
  const remember = () => {
    undos.current = [...undos.current.slice(1 - UNDO), { frames, at: i }];
    setUndoN(undos.current.length);
  };
  const setFrames = (fn, opts) => setState((s) => ({ ...s, frames: fn(s.frames?.length ? s.frames : [BLANK]) }), opts);
  const undo = () => {
    const u = undos.current.pop();
    setUndoN(undos.current.length);
    if (!u) return;
    setFrames(() => u.frames);
    setAt(u.at);
  };

  const drew = (px) => {
    const str = encode(px);
    if (str === frames[i]) return;
    remember();
    setFrames((fs) => fs.map((f, k) => (k === i ? str : f)), { debounce: 600 });
  };

  const chars = bookChars(frames);
  const full = chars > MAX_CHARS;
  const room = (n = 1) => {
    if (frames.length + n <= MAX_FRAMES && !full) return true;
    toast({ text: "the flipbook is full" });
    return false;
  };
  // ▶ past the last page turns to a fresh one (unless you're already on a blank page)
  const next = () => {
    if (i < frames.length - 1) return setAt(i + 1);
    if (frames[i] === BLANK || !room()) return;
    remember();
    setFrames((fs) => [...fs, BLANK]);
    setAt(i + 1);
  };
  const prev = () => setAt(Math.max(0, i - 1));
  const insert = (str) => {
    if (!room()) return;
    remember();
    setFrames((fs) => [...fs.slice(0, i + 1), str, ...fs.slice(i + 1)]);
    setAt(i + 1);
  };
  const clearFrame = () => {
    if (frames[i] === BLANK) return;
    remember();
    setFrames((fs) => fs.map((f, k) => (k === i ? BLANK : f)));
  };
  const dropFrame = () => {
    if (frames.length === 1) return clearFrame();
    remember();
    setFrames((fs) => fs.filter((_, k) => k !== i));
    setAt(Math.max(0, i - 1));
  };

  // The top screen plays the book from the start, over and over
  useEffect(() => {
    if (!playing) return;
    setShown(0);
    const t = setInterval(() => setShown((k) => k + 1), 1000 / SPEEDS[speed - 1]);
    return () => clearInterval(t);
  }, [playing, speed]);
  const showing = playing ? shown % frames.length : i;

  return (
    <div className={`flb${expanded ? " big" : ""}`}>
      <div className="flb-ds">
        <div className="flb-lid">
          <div className="flb-screen">
            <Pic px={decode(frames[showing])} label={`Frame ${showing + 1} of ${frames.length}`} />
            <div className="flb-bar" aria-hidden="true">
              <span>{playing ? "▶" : "❚❚"} {showing + 1}/{frames.length}</span>
              <span>speed {speed}</span>
            </div>
          </div>
        </div>

        <div className="flb-hinge" aria-hidden="true" />

        <div className="flb-base">
          <div className="flb-screen">
            <PenTools
              tool={tool}
              setTool={setTool}
              ink={ink}
              setInk={setInk}
              end={<button onClick={undo} disabled={!undos.current.length} aria-label="Undo">↶</button>}
            />
            <Pad px={decode(frames[i])} under={onion && i > 0 ? decode(frames[i - 1]) : null} ink={pen} width={width} onDone={drew} label={`Draw frame ${i + 1}`} />
          </div>

          <div className="flb-keys">
            <div className="flb-dpad">
              <button onClick={prev} disabled={i === 0} aria-label="Frame before">◀</button>
              <button onClick={next} aria-label={i === frames.length - 1 ? "New frame" : "Next frame"}>▶</button>
            </div>
            <button className={`flb-a${playing ? " on" : ""}`} onClick={() => setPlaying(!playing)} aria-label={playing ? "Stop" : "Play"}>
              {playing ? "■" : "▶"}
            </button>
          </div>
        </div>
      </div>

      {expanded && (
        <div className="flb-more">
          <ChipRow label="Frames">
            {frames.map((f, k) => (
              <button key={k} className={`flb-thumb${k === i ? " on" : ""}`} onClick={() => (setAt(k), setPlaying(false))} aria-label={`Frame ${k + 1}`}>
                <Pic px={decode(f)} />
                <span>{k + 1}</span>
              </button>
            ))}
          </ChipRow>
          <div className="flb-row">
            <button className="mini-btn ghost" onClick={() => insert(frames[i])}>+ copy of this frame</button>
            <button className="mini-btn ghost" onClick={() => insert(BLANK)}>+ blank frame</button>
          </div>
          <div className="flb-row">
            <button className="mini-btn ghost" onClick={clearFrame} disabled={frames[i] === BLANK}>clear frame</button>
            <button className="mini-btn ghost" onClick={dropFrame} disabled={frames.length === 1 && frames[0] === BLANK}>delete frame</button>
          </div>
          <label className="flb-label">speed</label>
          <Seg small label="Speed" value={speed} onChange={(v) => setState((s) => ({ ...s, speed: v }))} options={SPEEDS.map((_, k) => ({ id: k + 1, label: String(k + 1) }))} />
          <label className="flb-label">pen</label>
          <Seg small label="Pen size" value={size} onChange={setSize} options={SIZES} />
          <label className="flb-check">
            <input type="checkbox" checked={onion} onChange={(e) => setOnion(e.target.checked)} /> see the frame before, faintly
          </label>
          <div className="flb-mem" title="How much of the board's room the flipbook takes">
            <i style={{ width: `${Math.min(100, (chars / MAX_CHARS) * 100)}%` }} className={full ? "full" : ""} />
            <span>{frames.length} frame{frames.length === 1 ? "" : "s"} · {Math.round((chars / MAX_CHARS) * 100)}% full</span>
          </div>
        </div>
      )}
    </div>
  );
}
