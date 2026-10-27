import { useState, useEffect, useRef, useCallback } from "react";
import { useData } from "../../contexts/DataContext";
import { ROLL_EVENT } from "../../lib/remote";
import { uid } from "../../utils/uid";
import { agoLabel } from "../../utils/date";
import { SIDES, MAX_DICE, diceOf, countOf, labelOf, rollTray, parseNotation } from "../../lib/dice";
import { clack } from "../../lib/homeSounds";

// Gem-coloured dice, one colour per kind so a handful is easy to read at a glance
const GEM = { 4: "#ff9a3c", 6: "#ff5d8f", 8: "#4d9bff", 10: "#a875ee", 12: "#8ac926", 20: "#ffc933", 100: "#41c7c0" };

// The outline of each die in a 40x40 box (a d6 is a rounded square, a d100 is round)
const SHAPE = {
  4: <polygon points="20,4 37,35 3,35" />,
  6: <rect x="4" y="4" width="32" height="32" rx="7" />,
  8: <polygon points="20,2 37,20 20,38 3,20" />,
  10: <polygon points="20,2 36,15 31,37 9,37 4,15" />,
  12: <polygon points="20,2 37,15 31,36 9,36 3,15" />,
  20: <polygon points="20,2 36,11 36,29 20,38 4,29 4,11" />,
  100: <circle cx="20" cy="20" r="17" />,
};
// A few facet lines inside, so a d20 looks like a d20
const FACETS = {
  4: "M20 4 L20 35 M3 35 L20 22 L37 35",
  8: "M3 20 H37",
  10: "M20 2 V37 M4 15 L20 24 L36 15",
  12: "M20 2 V15 M3 15 H37 M20 15 L9 36 M20 15 L31 36",
  20: "M20 2 L4 29 H36 Z M4 11 L20 38 L36 11",
};

export function DieFace({ s, v, size = 40, drop = false, tilt = 0, className = "" }) {
  return (
    <svg className={`die ${className}${drop ? " drop" : ""}`} viewBox="0 0 40 40" width={size} height={size} style={{ transform: `rotate(${tilt}deg)` }} aria-hidden="true">
      <g fill={GEM[s]} stroke="#2a2520" strokeWidth="2" strokeLinejoin="round">{SHAPE[s]}</g>
      {FACETS[s] && <path d={FACETS[s]} fill="none" stroke="rgba(42,37,32,0.28)" strokeWidth="1" strokeLinejoin="round" />}
      <path d="M9 12 Q13 7 19 6" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="2.2" strokeLinecap="round" />
      <text x="20" y={s === 4 ? 29 : 25} textAnchor="middle" className="die-num" style={{ fontSize: String(v).length > 2 ? 11 : String(v).length > 1 ? 14 : 17 }}>{v}</text>
    </svg>
  );
}

const sizeFor = (n, big = false) => Math.round((n > 12 ? 30 : n > 6 ? 36 : 44) * (big ? 1.4 : 1));
const rand = (a, b) => a + Math.random() * (b - a);

// Lay the dice out in a neat row (or rows), face up on their kind, ready to throw
function lay(list, W, H, size) {
  const per = Math.max(1, Math.floor((W - 12) / (size + 6)));
  return list.map((d, i) => {
    const row = Math.floor(i / per);
    const inRow = Math.min(per, list.length - row * per);
    const col = i % per;
    return {
      ...d,
      x: W / 2 + (col - (inRow - 1) / 2) * (size + 6),
      y: H / 2 + (row - (Math.ceil(list.length / per) - 1) / 2) * (size + 6),
      vx: 0,
      vy: 0,
      rot: ((i * 53) % 21) - 10,
      vr: 0,
      show: null,
    };
  });
}

// A felt tray you throw dice onto. The numbers are decided first, with crypto randomness
// (lib/dice); the tumble is only a show, so the physics can never favour a face.
export default function Dice({ mod, setState, expanded }) {
  const { uid: me } = useData();
  const { tray = { d6: 2 }, mod: plus = 0, adv = null, history = [] } = mod.state;
  const dice = diceOf(tray);
  const n = countOf(tray);
  const size = sizeFor(n, expanded);
  const hasD20 = !!tray.d20;

  const area = useRef(null);
  const sim = useRef({ bodies: [], running: false, raf: 0, pending: null });
  const [, frame] = useState(0);
  const [shown, setShown] = useState(null); // the settled roll: { rolls, total, mod, label }
  const [rolling, setRolling] = useState(false);
  const [text, setText] = useState("");
  const [bad, setBad] = useState(false);

  const flat = dice.flatMap(([s, c]) => Array.from({ length: c }, () => ({ s, v: s })));
  const sig = flat.map((d) => d.s).join(",") + (hasD20 && adv ? "+" : "");

  // The ready row, rebuilt whenever you change what's on the tray
  useEffect(() => {
    const el = area.current;
    if (!el || sim.current.running) return;
    const list = hasD20 && adv ? [...flat, { s: 20, v: 20 }] : flat;
    sim.current.bodies = lay(list.map((d, i) => ({ ...d, id: i, v: "?" })), el.clientWidth, el.clientHeight, size);
    setShown(null);
    frame((x) => x + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig, size]);

  // Keep dice inside the felt if the card is resized
  useEffect(() => {
    const el = area.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => {
      if (sim.current.running) return;
      const W = el.clientWidth;
      const H = el.clientHeight;
      const r = size / 2;
      sim.current.bodies = sim.current.bodies.map((b) => ({ ...b, x: Math.min(W - r, Math.max(r, b.x)), y: Math.min(H - r, Math.max(r, b.y)) }));
      frame((x) => x + 1);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [size]);

  useEffect(() => () => {
    cancelAnimationFrame(sim.current.raf);
    // leaving mid-throw: the roll still counts
    sim.current.pending?.();
  }, []);

  const roll = useCallback(
    (over) => {
      const el = area.current;
      const S = sim.current;
      const t = over?.tray ?? tray;
      const m = over?.mod ?? plus;
      if (!el || S.running || !countOf(t)) return;
      const result = rollTray(t, m, hasD20 || over?.tray?.d20 ? adv : null);
      const W = el.clientWidth;
      const H = el.clientHeight;
      const sz = sizeFor(result.rolls.length, expanded);
      const r = sz / 2;
      S.running = true;
      setRolling(true);
      setShown(null);
      const label = labelOf(t, m, adv);
      const entry = { id: uid(), at: Date.now(), label, rolls: result.rolls, mod: m, total: result.total, by: me };
      let committed = false;
      const commit = () => {
        if (committed) return;
        committed = true;
        S.pending = null;
        setState((s) => ({ ...s, history: [entry, ...(s.history ?? [])].slice(0, 30) }));
      };
      S.pending = commit;

      // Thrown in from a random edge, towards the middle, all at once
      S.bodies = result.rolls.map((rl, i) => {
        const side = Math.floor(Math.random() * 4);
        const x = side === 0 ? r : side === 1 ? W - r : rand(r, W - r);
        const y = side === 2 ? r : side === 3 ? H - r : rand(r, H - r);
        const ang = Math.atan2(H / 2 - y, W / 2 - x) + rand(-0.7, 0.7);
        const sp = rand(520, 950);
        return { ...rl, id: i, x, y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, rot: rand(0, 360), vr: rand(-900, 900), show: 1 + Math.floor(Math.random() * rl.s), sz, lastShow: 0, lastClack: 0 };
      });

      let last = performance.now();
      let t0 = last;
      const step = (nowMs) => {
        const dt = Math.min(0.033, (nowMs - last) / 1000);
        last = nowMs;
        const age = (nowMs - t0) / 1000;
        const k = Math.exp(-(age < 0.9 ? 1.6 : 5) * dt);
        const bs = S.bodies;
        let fastest = 0;
        for (const b of bs) {
          b.x += b.vx * dt;
          b.y += b.vy * dt;
          b.rot += b.vr * dt;
          b.vx *= k;
          b.vy *= k;
          b.vr *= k;
          if (b.x < r) { b.x = r; b.vx = Math.abs(b.vx) * 0.72; if (Math.abs(b.vx) > 120 && nowMs - b.lastClack > 90) { b.lastClack = nowMs; clack(); } }
          if (b.x > W - r) { b.x = W - r; b.vx = -Math.abs(b.vx) * 0.72; if (Math.abs(b.vx) > 120 && nowMs - b.lastClack > 90) { b.lastClack = nowMs; clack(); } }
          if (b.y < r) { b.y = r; b.vy = Math.abs(b.vy) * 0.72; if (Math.abs(b.vy) > 120 && nowMs - b.lastClack > 90) { b.lastClack = nowMs; clack(); } }
          if (b.y > H - r) { b.y = H - r; b.vy = -Math.abs(b.vy) * 0.72; if (Math.abs(b.vy) > 120 && nowMs - b.lastClack > 90) { b.lastClack = nowMs; clack(); } }
        }
        // dice knock each other: push apart and trade a bounce
        for (let i = 0; i < bs.length; i++) {
          for (let j = i + 1; j < bs.length; j++) {
            const a = bs[i];
            const c = bs[j];
            const dx = c.x - a.x;
            const dy = c.y - a.y;
            const d = Math.hypot(dx, dy) || 0.01;
            if (d >= sz * 0.92) continue;
            const nx = dx / d;
            const ny = dy / d;
            const push = (sz * 0.92 - d) / 2;
            a.x -= nx * push; a.y -= ny * push;
            c.x += nx * push; c.y += ny * push;
            const rel = (a.vx - c.vx) * nx + (a.vy - c.vy) * ny;
            if (rel > 0) {
              a.vx -= rel * nx * 0.85; a.vy -= rel * ny * 0.85;
              c.vx += rel * nx * 0.85; c.vy += rel * ny * 0.85;
              if (rel > 160 && nowMs - a.lastClack > 90) { a.lastClack = nowMs; clack(true); }
            }
          }
        }
        for (const b of bs) {
          const sp = Math.hypot(b.vx, b.vy);
          fastest = Math.max(fastest, sp);
          // faces blur through numbers while it's still moving
          if (sp > 140) {
            if (nowMs - b.lastShow > 75) { b.lastShow = nowMs; b.show = 1 + Math.floor(Math.random() * b.s); }
          } else b.show = null;
        }
        frame((x) => x + 1);
        if (fastest < 14 || age > 2.8) {
          S.running = false;
          for (const b of bs) {
            b.vx = b.vy = b.vr = 0;
            b.show = null;
            b.rot = ((b.id * 37) % 29) - 14; // settle nearly upright so you can read it
          }
          setRolling(false);
          setShown({ rolls: result.rolls, total: result.total, mod: m, label });
          frame((x) => x + 1);
          commit();
          return;
        }
        S.raf = requestAnimationFrame(step);
      };
      S.raf = requestAnimationFrame(step);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tray, plus, adv, hasD20, me, expanded]
  );

  // A shake on the phone remote throws the dice too
  const again = useRef(roll);
  again.current = roll;
  useEffect(() => {
    const on = (e) => e.detail.modId === mod.id && again.current();
    window.addEventListener(ROLL_EVENT, on);
    return () => window.removeEventListener(ROLL_EVENT, on);
  }, [mod.id]);

  const patch = (p) => setState((s) => ({ ...s, ...p }));
  const bump = (s, by) => {
    const c = Math.max(0, (tray[`d${s}`] ?? 0) + by);
    if (by > 0 && n >= MAX_DICE) return;
    const next = { ...tray, [`d${s}`]: c };
    if (!c) delete next[`d${s}`];
    patch({ tray: next });
  };

  const typed = () => {
    const p = parseNotation(text);
    if (!p) {
      setBad(true);
      setTimeout(() => setBad(false), 600);
      return;
    }
    patch({ tray: p.tray, mod: p.mod });
    setText("");
    // the tray catches up on the next frame, then we throw what was typed
    setTimeout(() => roll({ tray: p.tray, mod: p.mod }), 30);
  };

  const sz = sim.current.bodies[0]?.sz ?? size;
  const settled = !rolling && shown;
  const kept = shown?.rolls.filter((r) => !r.drop) ?? [];

  return (
    <div className="dc">
      <div className="dc-felt" ref={area}>
        {sim.current.bodies.length === 0 && <div className="dc-empty">pick some dice below</div>}
        {sim.current.bodies.map((b) => (
          <div
            key={b.id}
            className={`dc-body${b.show == null && !rolling ? " rest" : ""}`}
            style={{ transform: `translate(${b.x - (b.sz ?? size) / 2}px, ${b.y - (b.sz ?? size) / 2}px)` }}
          >
            <DieFace s={b.s} v={b.show ?? b.v} size={b.sz ?? size} tilt={b.rot} drop={settled && b.drop} />
          </div>
        ))}
      </div>

      <div className="dc-result" aria-live="polite">
        {settled ? (
          <>
            <b className="dc-total">{shown.total}</b>
            <span className="dc-sum">
              {shown.label}
              {kept.length > 1 || shown.mod ? ` = ${kept.map((r) => r.v).join(" + ")}${shown.mod ? ` ${shown.mod > 0 ? "+" : "−"} ${Math.abs(shown.mod)}` : ""}` : ""}
            </span>
          </>
        ) : (
          <span className="dc-sum">{rolling ? "tumbling…" : `${labelOf(tray, plus, adv)} · ready when you are`}</span>
        )}
      </div>

      <div className="dc-go">
        <button className="dc-roll" onClick={() => roll()} disabled={!n || rolling}>
          {rolling ? "…" : "ROLL"}
        </button>
        <input
          className={`line-input dc-note${bad ? " bad" : ""}`}
          placeholder="or type 3d6+2"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && typed()}
          aria-label="Dice notation, like 3d6+2"
        />
      </div>

      <div className="dc-pick" role="group" aria-label="Dice on the tray">
        {SIDES.map((s) => {
          const c = tray[`d${s}`] ?? 0;
          return (
            <span key={s} className={`dc-pk${c ? " has" : ""}`}>
              <button className="dc-add" onClick={() => bump(s, 1)} aria-label={`Add a d${s}`}>
                <DieFace s={s} v={`d${s}`} size={32} />
              </button>
              {c > 0 && <b className="dc-cnt">{c}</b>}
              {c > 0 && <button className="dc-less" onClick={() => bump(s, -1)} aria-label={`Take a d${s} off`}>−</button>}
            </span>
          );
        })}
      </div>

      <div className="dc-opts">
        <span className="dc-mod">
          <button className="mini-btn" onClick={() => patch({ mod: plus - 1 })} aria-label="Minus one">−</button>
          <b>{plus > 0 ? `+${plus}` : plus}</b>
          <button className="mini-btn" onClick={() => patch({ mod: plus + 1 })} aria-label="Plus one">+</button>
        </span>
        {hasD20 && (
          <span className="dc-adv" role="radiogroup" aria-label="Advantage">
            {[["dis", "disadv"], [null, "plain"], ["adv", "adv"]].map(([k, l]) => (
              <button key={l} role="radio" aria-checked={adv === k} className={`dc-chip${adv === k ? " sel" : ""}`} onClick={() => patch({ adv: k })}>{l}</button>
            ))}
          </span>
        )}
        {n > 0 && <button className="pile-toggle dc-clear" onClick={() => patch({ tray: {}, mod: 0 })}>clear</button>}
      </div>

      {history.length > 0 && (
        <div className="dc-hist">
          {history.slice(0, expanded ? 30 : 4).map((h) => (
            <div key={h.id} className="pile-row dc-h">
              <b>{h.total}</b>
              <span className="pile-text">{h.label} · {h.rolls.map((r) => (r.drop ? `(${r.v})` : r.v)).join(" ")}</span>
              <span className="pile-when">{agoLabel(h.at)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
