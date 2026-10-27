import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { pngFor, trimmed, wandClear } from "../../lib/wardrobe";

const MAX = 560; // the biggest the workbench picture gets, in pixels

// The cutting table: trace a garment with the scissors (lasso), or tap its
// background with the wand to wipe it away. Done trims it to a see-through PNG.
export default function CutOut({ src, name, onDone, onClose, onFail }) {
  const work = useRef(null); // the picture as it is now (never shown, only copied from)
  const view = useRef(null);
  const ink = useRef(null); // the lasso line, over the picture
  const hist = useRef([]);
  const trail = useRef(null);
  const [tool, setTool] = useState("lasso");
  const [tol, setTol] = useState(32);
  const [ready, setReady] = useState(false);
  const [pending, setPending] = useState(null); // a traced loop waiting to be kept or removed
  const [steps, setSteps] = useState(0);

  const paint = () => {
    const v = view.current, w = work.current;
    if (!v || !w) return;
    v.width = w.width;
    v.height = w.height;
    v.getContext("2d").drawImage(w, 0, 0);
  };
  const clearInk = () => {
    const c = ink.current;
    if (c) c.getContext("2d").clearRect(0, 0, c.width, c.height);
  };

  useEffect(() => {
    const img = new Image();
    // A picture from another site can only be read if that site allows it
    if (!src.startsWith("data:") && !src.startsWith("blob:")) img.crossOrigin = "anonymous";
    img.onload = () => {
      const k = Math.min(1, MAX / Math.max(img.width, img.height));
      const w = document.createElement("canvas");
      w.width = Math.max(1, Math.round(img.width * k));
      w.height = Math.max(1, Math.round(img.height * k));
      w.getContext("2d", { willReadFrequently: true }).drawImage(img, 0, 0, w.width, w.height);
      try {
        w.getContext("2d").getImageData(0, 0, 1, 1);
      } catch {
        return onFail?.();
      }
      work.current = w;
      setReady(true);
    };
    img.onerror = () => onFail?.();
    img.src = src;
  }, [src]);

  useEffect(() => {
    if (!ready) return;
    paint();
    const c = ink.current;
    c.width = work.current.width;
    c.height = work.current.height;
  }, [ready]);

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const remember = () => {
    const w = work.current;
    hist.current.push(w.getContext("2d").getImageData(0, 0, w.width, w.height));
    if (hist.current.length > 12) hist.current.shift();
    setSteps(hist.current.length);
  };
  const undo = () => {
    const prev = hist.current.pop();
    if (!prev) return;
    work.current.getContext("2d").putImageData(prev, 0, 0);
    setSteps(hist.current.length);
    setPending(null);
    clearInk();
    paint();
  };

  const at = (e) => {
    const r = view.current.getBoundingClientRect();
    return [((e.clientX - r.left) / r.width) * view.current.width, ((e.clientY - r.top) / r.height) * view.current.height];
  };

  const wand = (x, y) => {
    const w = work.current, x2 = w.getContext("2d", { willReadFrequently: true });
    remember();
    const img = x2.getImageData(0, 0, w.width, w.height);
    wandClear(img, Math.min(w.width - 1, Math.max(0, Math.floor(x))), Math.min(w.height - 1, Math.max(0, Math.floor(y))), tol);
    x2.putImageData(img, 0, 0);
    paint();
  };
  // Whatever colour the four corners are is probably the backdrop
  const corners = () => {
    const w = work.current, x2 = w.getContext("2d", { willReadFrequently: true });
    remember();
    const img = x2.getImageData(0, 0, w.width, w.height);
    for (const [x, y] of [[0, 0], [w.width - 1, 0], [0, w.height - 1], [w.width - 1, w.height - 1]]) wandClear(img, x, y, tol);
    x2.putImageData(img, 0, 0);
    paint();
  };

  const trace = (pts, close = true) => {
    const c = ink.current.getContext("2d");
    clearInk();
    if (pts.length < 2) return;
    c.beginPath();
    c.moveTo(...pts[0]);
    pts.slice(1).forEach((p) => c.lineTo(...p));
    if (close) c.closePath();
    c.lineWidth = 2;
    c.setLineDash([6, 5]);
    c.strokeStyle = "#c2244b";
    c.fillStyle = "rgba(194, 36, 75, 0.14)";
    if (close) c.fill();
    c.stroke();
  };

  const down = (e) => {
    if (!ready) return;
    const p = at(e);
    if (tool === "wand") return wand(...p);
    e.currentTarget.setPointerCapture(e.pointerId);
    trail.current = [p];
    setPending(null);
    trace(trail.current, false);
  };
  const move = (e) => {
    if (!trail.current) return;
    trail.current.push(at(e));
    trace(trail.current, false);
  };
  const up = () => {
    const pts = trail.current;
    trail.current = null;
    if (!pts) return;
    if (pts.length < 6) return clearInk();
    trace(pts);
    setPending(pts);
  };

  // Keep what's inside the loop, or snip the loop out
  const apply = (keep) => {
    const w = work.current;
    remember();
    const c = w.getContext("2d", { willReadFrequently: true });
    const path = new Path2D();
    path.moveTo(...pending[0]);
    pending.slice(1).forEach((p) => path.lineTo(...p));
    path.closePath();
    if (keep) {
      const copy = document.createElement("canvas");
      copy.width = w.width;
      copy.height = w.height;
      copy.getContext("2d").drawImage(w, 0, 0);
      c.clearRect(0, 0, w.width, w.height);
      c.save();
      c.clip(path);
      c.drawImage(copy, 0, 0);
      c.restore();
    } else {
      c.save();
      c.globalCompositeOperation = "destination-out";
      c.fill(path);
      c.restore();
    }
    setPending(null);
    clearInk();
    paint();
  };

  const finish = () => {
    const t = trimmed(work.current);
    if (!t) return alert("There's nothing left of it. Undo a step and try again.");
    onDone(pngFor(t), t.width / t.height);
  };

  return createPortal(
    <div className="overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal cut" role="dialog" aria-modal="true" aria-label="Cut out a garment">
        <div className="modal-topbar">
          <div className="modal-handle" />
          <div className="modal-title">✂ Cut out {name ? `“${name}”` : "a garment"}</div>
          <button className="modal-x" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="cut-tools">
          <button className={`mini-btn${tool === "lasso" ? " on" : " ghost"}`} onClick={() => setTool("lasso")} title="Draw around the garment">✂ scissors</button>
          <button className={`mini-btn${tool === "wand" ? " on" : " ghost"}`} onClick={() => setTool("wand")} title="Click the background to wipe it away">✦ wand</button>
          <label className="cut-tol" title="How alike a colour must be to get wiped">
            wand reach <input type="range" min="4" max="90" value={tol} onChange={(e) => setTol(+e.target.value)} />
          </label>
          <button className="mini-btn ghost" onClick={corners} title="Wipe whatever colour the corners are">▢ backdrop</button>
          <button className="mini-btn ghost" onClick={undo} disabled={!steps}>↶ undo</button>
        </div>
        <div className="cut-hint">
          {tool === "lasso"
            ? pending
              ? "Keep what's inside the loop, or snip it out?"
              : "Press and draw all the way around the garment, then let go."
            : "Click the white (or plain) backdrop to wipe it. Click again to get the leftovers."}
        </div>
        <div className="cut-stage">
          {!ready && <div className="cut-wait">getting the picture…</div>}
          <div className={`cut-board${ready ? "" : " hide"}`}>
            <canvas ref={view} />
            <canvas ref={ink} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} className={tool} />
          </div>
        </div>
        <div className="cut-foot">
          {pending && (
            <>
              <button className="mini-btn" onClick={() => apply(true)}>keep inside</button>
              <button className="mini-btn ghost" onClick={() => apply(false)}>remove inside</button>
              <button className="mini-btn ghost" onClick={() => { setPending(null); clearInk(); }}>never mind</button>
            </>
          )}
          <span className="cut-grow" />
          <button className="mini-btn ghost" onClick={onClose}>cancel</button>
          <button className="mini-btn" onClick={finish} disabled={!ready}>done, save the cut-out</button>
        </div>
      </div>
    </div>,
    document.body
  );
}
