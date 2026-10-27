import { useRef, useState } from "react";
import { useContainer, Page, countLabel } from "./containerKit";

// A deck of cards: one on top, the rest fanned behind it. ‹ › (or a swipe, on a
// phone) deals the next card; each card is a surface of its own.
export default function Deck({ mod, setState }) {
  const c = useContainer(mod, setState);
  const [dir, setDir] = useState(0); // which way the last card went, so the new one flies in from there
  const from = useRef(null);
  const n = c.tabs.length;

  const go = (d) => {
    if (n < 2) return;
    setDir(d);
    c.select(c.tabs[(c.i + d + n) % n].id);
  };
  // Cards behind the top one, nearest first
  const behind = Array.from({ length: Math.min(n - 1, 3) }, (_, k) => c.tabs[(c.i + k + 1) % n]);

  // Swipes start on the deck's own paper (the rim, or bare space), never on a module inside it
  const start = (e) => {
    const t = e.touches?.[0] ?? e;
    const hit = e.target.closest(".mod, input, textarea, button, select");
    from.current = hit && hit !== e.currentTarget.closest(".mod") ? null : { x: t.clientX, y: t.clientY };
  };
  const end = (e) => {
    const t = e.changedTouches?.[0] ?? e;
    const s = from.current;
    from.current = null;
    if (!s) return;
    const dx = t.clientX - s.x;
    const dy = t.clientY - s.y;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.8) go(dx < 0 ? 1 : -1);
  };

  const t = c.tab;
  return (
    <div className="dk" onTouchStart={start} onTouchEnd={end}>
      <div className="dk-bar">
        <button className="dk-arrow" onClick={() => go(-1)} disabled={n < 2} aria-label="Previous card">‹</button>
        <button className="dk-name" onClick={(e) => c.openMenu(t, e)} title="Card options">
          <b>{t.name}</b>
          <small>{c.i + 1} of {n} · {countLabel(c.count(t))}</small>
        </button>
        <button className="dk-arrow" onClick={() => go(1)} disabled={n < 2} aria-label="Next card">›</button>
        {c.count(t) !== null && <button className="dk-add" onClick={() => c.addHere()}>+ add</button>}
      </div>
      <div className="dk-table">
        {/* the cards waiting underneath, each a little more tilted */}
        {behind.reverse().map((b, k) => {
          const depth = behind.length - k;
          return (
            <div
              key={b.id}
              className="dk-ghost"
              style={{ "--tab": c.color(b), "--d": depth }}
              onClick={() => c.select(b.id)}
              title={`Deal “${b.name}”`}
            >
              <span>{b.name}</span>
            </div>
          );
        })}
        <div key={t.id} className={`dk-card${dir ? (dir > 0 ? " from-right" : " from-left") : ""}`} style={{ "--tab": c.color(t) }}>
          <span className="dk-corner a">{c.i + 1}</span>
          <span className="dk-corner b">{c.i + 1}</span>
          <Page mod={mod} tab={t.id} />
        </div>
      </div>
      <div className="dk-pips">
        {c.tabs.map((x, k) => (
          <button
            key={x.id}
            className={x.id === t.id ? "on" : ""}
            style={{ "--tab": c.color(x) }}
            onClick={() => { setDir(k > c.i ? 1 : -1); c.select(x.id); }}
            title={x.name}
            aria-label={x.name}
          />
        ))}
        <button className="dk-new" onClick={() => c.add(`Card ${n + 1}`)} title="Add a card to the deck" aria-label="New card">＋</button>
      </div>
      {c.menuNode}
    </div>
  );
}
