import { useRef, useState, useEffect } from "react";
import { useData } from "../../contexts/DataContext";
import { useImage } from "../../hooks/useEntries";
import { deleteImage } from "../../lib/data";
import { savePhotos, useImageIntake, luma } from "../../lib/studio";

const MAX = 720; // the working copy is this many pixels on its long side
const GRIDS = ["none", "thirds", "4x4"];
const GRID_LABEL = { none: "grid", thirds: "thirds", "4x4": "4 × 4" };
const STEP_NAMES = {
  3: ["dark", "middle", "light"],
  5: ["darkest", "dark", "middle", "light", "lightest"],
};

// Brightness 0-255 -> which of n steps it falls in (0 = darkest)
const stepOf = (l, n) => Math.min(n - 1, Math.floor((l / 256) * n));
const greyOf = (step, n) => Math.round((step / (n - 1)) * 255);

// A viewfinder for judging a reference by its values. Everything happens on a canvas
// in this browser: the picture is never changed, only how it's shown.
export default function Values({ board, mod, setState, expanded }) {
  const { uid, toast } = useData();
  const fileRef = useRef(null);
  const canvasRef = useRef(null);
  const origRef = useRef(null); // the untouched pixels, for picking
  const { imageId = null, gray = false, levels = 0, flip = false, grid = "none", squint = false } = mod.state;
  const src = useImage(uid, imageId);
  const [picking, setPicking] = useState(false);
  const [pick, setPick] = useState(null); // { l, x, y } where you pointed (fractions of the picture)

  const set = (patch) => setState((s) => ({ ...s, ...patch }));

  const add = async (files) => {
    const [id] = await savePhotos(uid, board.id, files.slice(0, 1), toast);
    if (!id) return;
    if (imageId) deleteImage(uid, imageId);
    setPick(null);
    set({ imageId: id });
  };
  const { rootRef, drop, dropping } = useImageIntake(add);

  // Draw the working copy once per picture...
  const [ready, setReady] = useState(0);
  const [ratio, setRatio] = useState(1);
  useEffect(() => {
    if (!src) return;
    let live = true;
    const img = new Image();
    img.onload = () => {
      if (!live) return;
      const s = Math.min(1, MAX / Math.max(img.width, img.height));
      const o = document.createElement("canvas");
      o.width = Math.max(1, Math.round(img.width * s));
      o.height = Math.max(1, Math.round(img.height * s));
      o.getContext("2d", { willReadFrequently: true }).drawImage(img, 0, 0, o.width, o.height);
      origRef.current = o;
      setRatio(o.width / o.height);
      setReady((n) => n + 1);
    };
    img.src = src;
    return () => { live = false; };
  }, [src]);

  // ...and re-tone it whenever a switch moves
  useEffect(() => {
    const o = origRef.current;
    const c = canvasRef.current;
    if (!o || !c) return;
    c.width = o.width;
    c.height = o.height;
    const ctx = c.getContext("2d");
    ctx.drawImage(o, 0, 0);
    if (!gray && !levels) return;
    const px = ctx.getImageData(0, 0, c.width, c.height);
    const d = px.data;
    for (let i = 0; i < d.length; i += 4) {
      let l = luma(d[i], d[i + 1], d[i + 2]);
      if (levels) l = greyOf(stepOf(l, levels), levels);
      d[i] = d[i + 1] = d[i + 2] = l;
    }
    ctx.putImageData(px, 0, 0);
  }, [ready, gray, levels]);

  const aim = (e) => {
    const o = origRef.current;
    if (!picking || !o) return;
    const r = e.currentTarget.getBoundingClientRect();
    let fx = (e.clientX - r.left) / r.width;
    const fy = (e.clientY - r.top) / r.height;
    if (flip) fx = 1 - fx; // the picture is mirrored on screen, not in the pixels
    const px = Math.max(2, Math.min(o.width - 3, Math.round(fx * o.width)));
    const py = Math.max(2, Math.min(o.height - 3, Math.round(fy * o.height)));
    // an average of a few pixels, so one speck of noise doesn't decide it
    const d = o.getContext("2d").getImageData(px - 2, py - 2, 5, 5).data;
    let sum = 0;
    for (let i = 0; i < d.length; i += 4) sum += luma(d[i], d[i + 1], d[i + 2]);
    setPick({ l: sum / (d.length / 4), x: fx, y: fy });
  };

  const scale = levels || 5;
  const lit = pick ? stepOf(pick.l, scale) : -1;

  const toggles = [
    ["gray", "grey", gray || !!levels, () => set({ gray: !gray })],
    ["3", "3 values", levels === 3, () => set({ levels: levels === 3 ? 0 : 3 })],
    ["5", "5 values", levels === 5, () => set({ levels: levels === 5 ? 0 : 5 })],
    ["flip", "mirror", flip, () => set({ flip: !flip })],
    ["grid", GRID_LABEL[grid], grid !== "none", () => set({ grid: GRIDS[(GRIDS.indexOf(grid) + 1) % GRIDS.length] })],
    ["squint", "squint", squint, () => set({ squint: !squint })],
  ];

  return (
    <div ref={rootRef} className={`val${dropping ? " dropping" : ""}${expanded ? " big" : ""}`} {...drop}>
      <div className="val-finder">
        <i className="val-br tl" /><i className="val-br tr" /><i className="val-br bl" /><i className="val-br br" />
        {src ? (
          <div className="val-box">
          <div
            className={`val-pic${picking ? " picking" : ""}`}
            style={{ "--r": ratio, transform: flip ? "scaleX(-1)" : undefined }}
            onClick={aim}
          >
            <canvas ref={canvasRef} className={squint ? "squint" : ""} />
            {grid === "thirds" && (
              <svg viewBox="0 0 3 3" preserveAspectRatio="none" aria-hidden="true"><path d="M1 0V3M2 0V3M0 1H3M0 2H3" /></svg>
            )}
            {grid === "4x4" && (
              <svg viewBox="0 0 4 4" preserveAspectRatio="none" aria-hidden="true"><path d="M1 0V4M2 0V4M3 0V4M0 1H4M0 2H4M0 3H4" /></svg>
            )}
            {pick && <b className="val-ring" style={{ left: `${pick.x * 100}%`, top: `${pick.y * 100}%` }} />}
          </div>
          </div>
        ) : (
          <button className="val-empty" onClick={() => fileRef.current?.click()}>
            <span>◎</span>drop a reference in
            <small>choose, paste or drop a photo</small>
          </button>
        )}
      </div>

      <div className="val-switches" role="group" aria-label="How to look at it">
        {toggles.map(([k, label, on, run]) => (
          <button key={k} className={`val-sw${on ? " on" : ""}`} aria-pressed={on} disabled={!src} onClick={run}>
            <i />{label}
          </button>
        ))}
      </div>

      <div className="val-scale" aria-label="Value steps">
        {Array.from({ length: scale }, (_, i) => (
          <span key={i} className={i === lit ? "lit" : ""} style={{ background: `rgb(${greyOf(i, scale)},${greyOf(i, scale)},${greyOf(i, scale)})` }}>
            {i === lit && <em style={{ color: i < scale / 2 ? "#fff" : "#2a2520" }}>▲</em>}
          </span>
        ))}
      </div>
      <div className="val-foot">
        <button className={`mini-btn${picking ? " on" : ""}`} disabled={!src} onClick={() => setPicking((v) => !v)}>
          {picking ? "pointing…" : "◎ pick a spot"}
        </button>
        <span className="val-read">
          {pick ? <>value <b>{lit + 1}</b> of {scale} · {STEP_NAMES[scale === 3 ? 3 : 5][lit]}</> : src ? (picking ? "click the picture" : "pick a spot to read its value") : ""}
        </span>
        {src && <button className="mini-btn ghost" onClick={() => fileRef.current?.click()}>swap</button>}
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={(e) => {
          add([...e.target.files]);
          e.target.value = "";
        }}
      />
    </div>
  );
}
