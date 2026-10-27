import { useState, useEffect, useLayoutEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useData } from "../../contexts/DataContext";
import { useBoardEntries } from "../../hooks/useEntries";
import { MODULES } from "../../constants/modules";
import { MODULE_COMPONENTS } from ".";
import { useCover } from "../../lib/lockbox";
import { Covered } from "./LockBox";

// A folder needs its board's surface; the spotlight can't stand in front of itself
const castable = (m) => m.type !== "folder" && m.type !== "spotlight";
const BAR = 32;
const natural = (m) => ({ w: m.w ?? MODULES[m.type].desk.w, h: Math.max(80, (m.h ?? MODULES[m.type].desk.h) - BAR) });

// A little stage with curtains. Choose the running order, raise the curtain, and each
// module takes the whole stage in turn, big enough to read across a room. Good for walking
// a friend through a board, or for a routine you don't want to touch your computer for.
export default function Spotlight({ board, mod, setState }) {
  const [on, setOn] = useState(false);
  const order = (mod.state.order ?? []).filter((id) => board.modules.some((m) => m.id === id && castable(m)));
  const byId = (id) => board.modules.find((m) => m.id === id);
  const wings = board.modules.filter((m) => castable(m) && m.id !== mod.id && !order.includes(m.id));

  const set = (next) => setState((s) => ({ ...s, order: next }));
  const nudge = (i, d) => {
    const next = [...order];
    const j = i + d;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    set(next);
  };

  return (
    <div className="sp">
      <div className="sp-marquee" aria-hidden="true">
        {Array.from({ length: 11 }, (_, i) => <i key={i} style={{ animationDelay: `${(i % 2) * 0.6}s` }} />)}
      </div>
      <div className="sp-bill">
        <div className="sp-h">running order</div>
        {order.length === 0 && <div className="sp-none">pick what goes on stage, in the order you want it</div>}
        <ol>
          {order.map((id, i) => {
            const m = byId(id);
            return (
              <li key={id}>
                <span className="sp-n">{i + 1}</span>
                <span className="sp-t">{m.title}</span>
                <button onClick={() => nudge(i, -1)} disabled={i === 0} aria-label={`Move ${m.title} up`}>▲</button>
                <button onClick={() => nudge(i, 1)} disabled={i === order.length - 1} aria-label={`Move ${m.title} down`}>▼</button>
                <button onClick={() => set(order.filter((x) => x !== id))} aria-label={`Take ${m.title} off`}>✕</button>
              </li>
            );
          })}
        </ol>
        {wings.length > 0 && (
          <>
            <div className="sp-h">in the wings</div>
            <div className="sp-wings">
              {wings.map((m) => (
                <button key={m.id} onClick={() => set([...order, m.id])} title={`Add ${m.title}`}>
                  + {m.title}
                </button>
              ))}
              <button className="all" onClick={() => set([...order, ...wings.map((m) => m.id)])}>+ all of them</button>
            </div>
          </>
        )}
      </div>
      <button className="sp-raise" disabled={!order.length} onClick={() => setOn(true)}>
        raise the curtain ▸
      </button>
      {on && createPortal(<Show board={board} ids={order} onClose={() => setOn(false)} />, document.body)}
    </div>
  );
}

// The full-screen show: one module at a time, centre stage
function Show({ board, ids, onClose }) {
  const { uid, updateBoard } = useData();
  const [i, setI] = useState(0);
  const [up, setUp] = useState(false); // curtains drawn back
  const mods = ids.map((id) => board.modules.find((m) => m.id === id)).filter(Boolean);
  const cur = mods[Math.min(i, mods.length - 1)];

  const go = (d) => setI((n) => Math.max(0, Math.min(mods.length - 1, n + d)));

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const t = setTimeout(() => setUp(true), 60);
    const onKey = (e) => {
      if (e.key === "Escape") return onClose();
      if (e.target.closest?.("input, textarea, select, [contenteditable]")) return;
      if (e.key === "ArrowRight" || e.key === "PageDown" || e.key === " ") (e.preventDefault(), go(1));
      if (e.key === "ArrowLeft" || e.key === "PageUp") (e.preventDefault(), go(-1));
    };
    window.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(t);
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onClose, mods.length]);

  return (
    <div className={`sp-show${up ? " up" : ""}`} role="dialog" aria-modal="true" aria-label="Spotlight">
      <div className="sp-valance" aria-hidden="true" />
      <div className="sp-curtain l" aria-hidden="true" />
      <div className="sp-curtain r" aria-hidden="true" />
      <button className="sp-leave" onClick={onClose} aria-label="Leave (Esc)">✕ <span>Esc</span></button>
      <div className="sp-stage">{cur && <Act key={cur.id} board={board} mod={cur} uid={uid} updateBoard={updateBoard} />}</div>
      <div className="sp-foot">
        <button onClick={() => go(-1)} disabled={i === 0} aria-label="Previous">‹</button>
        <div className="sp-cap">
          <b>{cur?.title}</b>
          <span>{i + 1} of {mods.length}</span>
          <div className="sp-dots">
            {mods.map((m, k) => <button key={m.id} className={k === i ? "on" : ""} onClick={() => setI(k)} aria-label={m.title} />)}
          </div>
        </div>
        <button onClick={() => go(1)} disabled={i >= mods.length - 1} aria-label="Next">›</button>
      </div>
      <div className="sp-lights" aria-hidden="true">
        {Array.from({ length: 9 }, (_, k) => <i key={k} />)}
      </div>
    </div>
  );
}

// One module, laid out at its own size and scaled up (or down) to fill the stage
function Act({ board, mod, uid, updateBoard }) {
  const entries = useBoardEntries(uid, board.id);
  const cover = useCover(board, mod.id);
  const ref = useRef(null);
  const [box, setBox] = useState({ w: 0, h: 0 });
  const Body = MODULE_COMPONENTS[mod.type];

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const read = () => setBox({ w: el.clientWidth - 24, h: el.clientHeight - 24 });
    read();
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const edit = (fn, opts) => updateBoard(board.id, (b) => ({ ...b, modules: b.modules.map((m) => (m.id === mod.id ? fn(m) : m)) }), opts);
  const n = natural(mod);
  const scale = box.w ? Math.max(0.3, Math.min(box.w / n.w, box.h / n.h, 2.6)) : 1;

  return (
    <div className="sp-act" ref={ref}>
      <div className="sp-fit" style={{ width: n.w * scale, height: n.h * scale }}>
        <div className={`win-src mod mod-${mod.type} sp-src`} style={{ width: n.w, height: n.h, transform: `scale(${scale})` }}>
          <div className="mod-body">
            {cover ? (
              <Covered />
            ) : (
              <Body
                board={board}
                mod={mod}
                entries={entries}
                setState={(fn, opts) => edit((m) => ({ ...m, state: fn(m.state) }), opts)}
                onPatch={(p) => edit((m) => ({ ...m, ...p }))}
                openBig={() => {}}
                expanded={false}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
