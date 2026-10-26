import { useState, useEffect } from "react";
import { firstName } from "../../lib/share";

// Everyone's pointer, on the desktop canvas. Positions are sent in canvas coordinates (so they
// land on the right spot whatever the window size or scroll), at most ~15 a second while
// moving, and nothing is ever stored. A cursor that goes quiet for 3s is dropped.

const EVERY = 66; // ms between sends
const STALE = 3000;

// Which space a canvas belongs to: the board's own is "", a folder's tab is that folder's id
export const spaceOf = (canvas) => canvas.closest(".mod")?.dataset.mid ?? "";
export const canvasFor = (sp) => [...document.querySelectorAll(".canvas")].find((c) => spaceOf(c) === sp);
export const canvasAt = (x, y) => document.elementsFromPoint(x, y).find((el) => el.classList?.contains("canvas"));

export default function Cursors({ room, who, tab }) {
  const [cursors, setCursors] = useState(() => new Map()); // peer → { x, y, sp, tab, at }
  const [, tick] = useState(0);

  // Mine going out
  useEffect(() => {
    let last = 0;
    let timer = null;
    let pending = null;
    let on = false;
    const flush = () => {
      timer = null;
      last = Date.now();
      if (pending) room.send("cursor", pending);
      pending = null;
    };
    const move = (e) => {
      const c = e.target.closest?.(".canvas");
      if (!c) {
        // Off the canvas: tell them to put my pointer down, once
        if (on) room.send("cursor", { off: 1 });
        on = false;
        return;
      }
      on = true;
      const r = c.getBoundingClientRect();
      pending = { x: Math.round(e.clientX - r.left), y: Math.round(e.clientY - r.top), sp: spaceOf(c), tab };
      const wait = EVERY - (Date.now() - last);
      if (wait <= 0) flush();
      else timer ??= setTimeout(flush, wait);
    };
    const leave = () => on && room.send("cursor", { off: 1 });
    document.addEventListener("pointermove", move, { passive: true });
    document.documentElement.addEventListener("pointerleave", leave);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("pointermove", move);
      document.documentElement.removeEventListener("pointerleave", leave);
    };
  }, [room, tab]);

  // Theirs coming in
  useEffect(() => {
    const off = room.on("cursor", (m, from) =>
      setCursors((prev) => {
        const next = new Map(prev);
        if (m.off) next.delete(from);
        else next.set(from, { ...m, at: Date.now() });
        return next;
      })
    );
    const gone = room.onPeer((id, joined) => {
      if (!joined) setCursors((prev) => (prev.has(id) ? new Map([...prev].filter(([k]) => k !== id)) : prev));
    });
    return () => {
      off();
      gone();
    };
  }, [room]);

  // Quiet ones are dropped; while any are showing, keep their spot in step with scrolling
  const any = cursors.size > 0;
  useEffect(() => {
    if (!any) return;
    const id = setInterval(() => {
      setCursors((prev) => {
        const fresh = [...prev].filter(([, c]) => Date.now() - c.at < STALE);
        return fresh.length === prev.size ? prev : new Map(fresh);
      });
      tick((n) => n + 1);
    }, 120);
    return () => clearInterval(id);
  }, [any]);

  return (
    <div className="tg-cursors" aria-hidden="true">
      {[...cursors].map(([peer, c]) => {
        // On another tab of the board, or inside a folder tab that isn't open here: not on this screen
        const canvas = c.tab === tab ? canvasFor(c.sp) : null;
        if (!canvas) return null;
        const r = canvas.getBoundingClientRect();
        const x = r.left + c.x;
        const y = r.top + c.y;
        if (x < 0 || y < 0 || x > window.innerWidth || y > window.innerHeight) return null;
        const p = who(peer);
        return (
          <div key={peer} className="tg-cursor" style={{ transform: `translate(${x}px, ${y}px)`, "--who": p.color }}>
            <svg width="22" height="26" viewBox="0 0 22 26">
              {/* a chunky Kid Pix arrow: fat outline, flat fill */}
              <path d="M2 2 L2 20 L7 15.5 L10.5 23.5 L14 22 L10.6 14.2 L17.5 14 Z" fill="var(--who)" stroke="#2a2520" strokeWidth="2" strokeLinejoin="round" />
            </svg>
            <span className="tg-cursor-tag">{firstName(p.name)}</span>
          </div>
        );
      })}
    </div>
  );
}
