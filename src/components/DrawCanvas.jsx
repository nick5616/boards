import { useState, useRef, useEffect, useCallback } from "react";

const DRAW_SIZES = [
  { label: "XS", v: 1.5 },
  { label: "S",  v: 3 },
  { label: "M",  v: 6 },
  { label: "L",  v: 12 },
];

export default function DrawCanvas({ value, onChange, bgColor }) {
  const ref = useRef(null);
  const drawing = useRef(false);
  const last = useRef(null);
  const history = useRef([]);
  const histIdx = useRef(-1);
  const [brushColor, setBrushColor] = useState("#2A2520");
  const [size, setSize] = useState(3);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const colorRef = useRef(brushColor);
  const sizeRef = useRef(size);
  colorRef.current = brushColor;
  sizeRef.current = size;

  const syncHistory = () => {
    setCanUndo(histIdx.current > 0);
    setCanRedo(histIdx.current < history.current.length - 1);
  };

  const saveSnap = useCallback(() => {
    const c = ref.current;
    if (!c) return;
    const snap = c.toDataURL();
    history.current = history.current.slice(0, histIdx.current + 1);
    history.current.push(snap);
    histIdx.current = history.current.length - 1;
    syncHistory();
    onChange(snap);
  }, [onChange]);

  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    c.getContext("2d").clearRect(0, 0, c.width, c.height);
    if (value) {
      const img = new Image();
      img.onload = () => {
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
        history.current = [value];
        histIdx.current = 0;
        syncHistory();
      };
      img.src = value;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const applySnap = (snap) => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    ctx.clearRect(0, 0, c.width, c.height);
    if (!snap) { onChange(""); return; }
    const img = new Image();
    img.onload = () => { ctx.drawImage(img, 0, 0, c.width, c.height); onChange(snap); };
    img.src = snap;
  };

  const undo = () => {
    if (histIdx.current === 0) {
      histIdx.current = -1;
      ref.current.getContext("2d").clearRect(0, 0, ref.current.width, ref.current.height);
      onChange("");
      syncHistory();
      return;
    }
    if (histIdx.current < 0) return;
    histIdx.current--;
    applySnap(history.current[histIdx.current]);
    syncHistory();
  };

  const redo = () => {
    if (histIdx.current >= history.current.length - 1) return;
    histIdx.current++;
    applySnap(history.current[histIdx.current]);
    syncHistory();
  };

  const clear = () => {
    ref.current.getContext("2d").clearRect(0, 0, ref.current.width, ref.current.height);
    history.current = [];
    histIdx.current = -1;
    syncHistory();
    onChange("");
  };

  const getPos = (e) => {
    const r = ref.current.getBoundingClientRect();
    const sx = ref.current.width / r.width;
    const sy = ref.current.height / r.height;
    const src = e.touches ? e.touches[0] : e;
    return { x: (src.clientX - r.left) * sx, y: (src.clientY - r.top) * sy };
  };

  const startDraw = (e) => { e.preventDefault(); drawing.current = true; last.current = getPos(e); };
  const moveDraw = (e) => {
    e.preventDefault();
    if (!drawing.current) return;
    const ctx = ref.current.getContext("2d");
    const p = getPos(e);
    ctx.beginPath();
    ctx.moveTo(last.current.x, last.current.y);
    ctx.lineTo(p.x, p.y);
    ctx.strokeStyle = colorRef.current;
    ctx.lineWidth = sizeRef.current;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.stroke();
    last.current = p;
  };
  const endDraw = () => { if (!drawing.current) return; drawing.current = false; saveSnap(); };

  return (
    <div className="draw-wrap">
      <canvas
        ref={ref}
        width={300}
        height={300}
        className="draw-canvas"
        style={{ background: bgColor }}
        onMouseDown={startDraw}
        onMouseMove={moveDraw}
        onMouseUp={endDraw}
        onMouseLeave={endDraw}
        onTouchStart={startDraw}
        onTouchMove={moveDraw}
        onTouchEnd={endDraw}
      />
      <div className="draw-toolbar">
        <button className="draw-color-pick" style={{ borderColor: brushColor }} aria-label="Pick brush color">
          <div className="draw-color-dot" style={{ background: brushColor }} />
          <input type="color" value={brushColor} onChange={(e) => setBrushColor(e.target.value)} />
        </button>
        <div className="draw-sep" />
        {DRAW_SIZES.map((s) => (
          <button
            key={s.label}
            className={`draw-size-btn${size === s.v ? " sel" : ""}`}
            onClick={() => setSize(s.v)}
            aria-label={`Brush size ${s.label}`}
          >
            {s.label}
          </button>
        ))}
        <div className="draw-sep" />
        <button className="draw-hist-btn" onClick={undo} disabled={!canUndo} title="Undo" aria-label="Undo">↩</button>
        <button className="draw-hist-btn" onClick={redo} disabled={!canRedo} title="Redo" aria-label="Redo">↪</button>
        <button className="draw-clear" onClick={clear}>clear</button>
      </div>
    </div>
  );
}
