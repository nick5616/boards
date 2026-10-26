import { useRef, useEffect, useState } from "react";
import { canvasAt, canvasFor, spaceOf } from "./Cursors";

// Fading ink: hold Alt (or switch the pen on in the header) and draw over anything to point
// and circle. Strokes go straight to everyone in the room, hang about for a couple of seconds,
// then fade. Never saved. Like cursors, points are in canvas coordinates; ink that starts
// somewhere that isn't a canvas is in plain window coordinates ("@").

const HOLD = 2200; // fully inked this long after its last point…
const FADE = 900; // …then gone over this long
const WIDTH = 5;
const SEND_EVERY = 60;

export default function Ink({ room, who, tab, me, pen, setPen }) {
  const cv = useRef(null);
  const strokes = useRef(new Map()); // "peer/id" → { sp, tab, color, pts: [x, y, …], t, live }
  const frame = useRef(0);
  const [alt, setAlt] = useState(false);
  const active = pen || alt;

  const paint = () => {
    frame.current = 0;
    const el = cv.current;
    if (!el) return;
    const g = el.getContext("2d");
    g.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
    g.clearRect(0, 0, el.width, el.height);
    g.lineCap = g.lineJoin = "round";
    g.lineWidth = WIDTH;
    const now = Date.now();
    for (const [k, s] of strokes.current) {
      if (s.live) s.t = now; // still being drawn: not fading yet
      const age = now - s.t;
      if (age > HOLD + FADE) {
        strokes.current.delete(k);
        continue;
      }
      if (s.tab !== tab) continue;
      const home = s.sp === "@" ? { left: 0, top: 0 } : canvasFor(s.sp)?.getBoundingClientRect();
      if (!home) continue;
      g.globalAlpha = age < HOLD ? 1 : 1 - (age - HOLD) / FADE;
      g.strokeStyle = s.color;
      g.beginPath();
      g.moveTo(home.left + s.pts[0], home.top + s.pts[1]);
      for (let i = 2; i < s.pts.length; i += 2) g.lineTo(home.left + s.pts[i], home.top + s.pts[i + 1]);
      if (s.pts.length === 2) g.lineTo(home.left + s.pts[0] + 0.1, home.top + s.pts[1]); // a click is a dot
      g.stroke();
    }
    if (strokes.current.size) frame.current = requestAnimationFrame(paint);
  };
  const kick = () => (frame.current ||= requestAnimationFrame(paint));

  // The layer is as big as the window
  useEffect(() => {
    const fit = () => {
      if (!cv.current) return;
      cv.current.width = innerWidth * devicePixelRatio;
      cv.current.height = innerHeight * devicePixelRatio;
      kick();
    };
    fit();
    window.addEventListener("resize", fit);
    return () => {
      window.removeEventListener("resize", fit);
      cancelAnimationFrame(frame.current);
      frame.current = 0;
    };
  }, []);

  // Alt held = pen down. (Preventing the keyup keeps the browser from grabbing its menu bar.)
  useEffect(() => {
    const down = (e) => {
      if (e.key === "Alt") {
        e.preventDefault();
        setAlt(true);
      }
      if (e.key === "Escape") setPen(false);
    };
    const up = (e) => {
      if (e.key !== "Alt") return;
      e.preventDefault();
      setAlt(false);
    };
    const blur = () => setAlt(false);
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
    };
  }, [setPen]);

  // Theirs coming in
  useEffect(() => {
    const off = room.on("ink", (m, from) => {
      const k = `${from}/${m.id}`;
      const s = strokes.current.get(k) ?? { sp: m.sp, tab: m.tab, color: who(from).color, pts: [], t: 0 };
      s.pts.push(...m.pts);
      s.t = Date.now();
      if (s.pts.length > 4000) s.pts.splice(0, s.pts.length - 4000); // a very long scribble: keep the end
      strokes.current.set(k, s);
      kick();
    });
    return off;
  }, [room, who]);

  // Mine
  const mine = useRef(null); // { id, stroke, out: [], timer }
  const send = () => {
    const m = mine.current;
    if (!m?.out.length) return;
    room.send("ink", { id: m.id, sp: m.stroke.sp, tab, pts: m.out });
    m.out = [];
  };
  const add = (m, e) => {
    const r = m.stroke.sp === "@" ? { left: 0, top: 0 } : canvasFor(m.stroke.sp)?.getBoundingClientRect() ?? { left: 0, top: 0 };
    const x = Math.round(e.clientX - r.left);
    const y = Math.round(e.clientY - r.top);
    m.stroke.pts.push(x, y);
    m.out.push(x, y);
  };
  const down = (e) => {
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const c = canvasAt(e.clientX, e.clientY);
    const stroke = { sp: c ? spaceOf(c) : "@", tab, color: me.color, pts: [], t: Date.now(), live: true };
    const id = Math.random().toString(36).slice(2, 8);
    mine.current = { id, stroke, out: [], timer: setInterval(send, SEND_EVERY) };
    strokes.current.set(`me/${id}`, stroke);
    add(mine.current, e);
    send();
    kick();
  };
  const move = (e) => {
    if (!mine.current) return;
    add(mine.current, e);
  };
  const up = () => {
    const m = mine.current;
    if (!m) return;
    clearInterval(m.timer);
    send();
    m.stroke.live = false;
    m.stroke.t = Date.now();
    mine.current = null;
  };

  return (
    <canvas
      ref={cv}
      className={`tg-ink${active ? " on" : ""}`}
      aria-hidden="true"
      onPointerDown={active ? down : undefined}
      onPointerMove={active ? move : undefined}
      onPointerUp={up}
      onPointerCancel={up}
    />
  );
}
