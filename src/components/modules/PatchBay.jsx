import { useState, useEffect, useRef, useLayoutEffect } from "react";
import { useData } from "../../contexts/DataContext";
import { MODULES } from "../../constants/modules";
import { onReading } from "../../lib/readings";

// Modules that send readings down wires (each keeps state.sendTo: [modId]).
// Anything with a `receive` is a place a wire can end.
const SENDERS = new Set(["timer", "metronome", "tuner", "keys", "tape"]);
const CABLES = ["#e4572e", "#17a398", "#f3a712", "#7a5cc4", "#3a86ff", "#e0457b"];

const ROW = 40; // height of one jack row, in px
const TOP = 46; // room for the name plate and column heads

// A studio patch panel. Left column: everything that can send a reading. Right column:
// everything that can take one. Each wire is a drooping cable; drag jack to jack to plug
// one in, click a cable to pull it out. The wires themselves live in each sender's
// state.sendTo, so this is only a nicer way of looking at (and editing) what SendTo does.
export default function PatchBay({ board, mod }) {
  const { updateBoard, toast } = useData();
  const [W, setW] = useState(360);
  const [drag, setDrag] = useState(null); // { side: "out" | "in", id, x, y } while a cable is being pulled
  const [hover, setHover] = useState(null); // cable key under the pointer
  const [flash, setFlash] = useState({}); // modId -> when a reading last landed there
  const wrap = useRef(null);
  const svg = useRef(null);

  const outs = board.modules.filter((m) => SENDERS.has(m.type) && Array.isArray(m.state.sendTo ?? []));
  const ins = board.modules.filter((m) => MODULES[m.type]?.receive);
  const rows = Math.max(outs.length, ins.length, 1);
  const H = TOP + rows * ROW + 30;
  const ox = Math.round(W * 0.34);
  const ix = Math.round(W * 0.66);
  const oy = (i) => TOP + i * ROW + ROW / 2;
  const colorOf = (id) => CABLES[outs.findIndex((m) => m.id === id) % CABLES.length];

  useLayoutEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const read = () => setW(Math.max(280, el.clientWidth));
    read();
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // A reading landing on a module lights its jack for a moment
  useEffect(
    () =>
      onReading(({ boardId, modId }) => {
        if (boardId !== board.id) return;
        const at = Date.now();
        setFlash((f) => ({ ...f, [modId]: at }));
        setTimeout(() => setFlash((f) => (f[modId] === at ? { ...f, [modId]: 0 } : f)), 1100);
      }),
    [board.id]
  );

  const cables = outs.flatMap((o, i) =>
    (o.state.sendTo ?? []).flatMap((to) => {
      const j = ins.findIndex((m) => m.id === to);
      return j < 0 ? [] : [{ key: `${o.id}>${to}`, from: o, to: ins[j], x1: ox, y1: oy(i), x2: ix, y2: oy(j) }];
    })
  );

  const setWire = (fromId, toId, on) =>
    updateBoard(board.id, (b) => ({
      ...b,
      modules: b.modules.map((m) => {
        if (m.id !== fromId) return m;
        const had = m.state.sendTo ?? [];
        const sendTo = on ? [...new Set([...had, toId])] : had.filter((x) => x !== toId);
        return { ...m, state: { ...m.state, sendTo } };
      }),
    }));

  const plug = (from, to) => {
    if ((from.state.sendTo ?? []).includes(to.id)) return toast?.({ text: `${from.title} is already plugged into ${to.title}` });
    setWire(from.id, to.id, true);
    toast?.({ text: `${from.title} → ${to.title}`, actions: [{ label: "undo", run: () => setWire(from.id, to.id, false) }] });
  };
  const unplug = (c) => {
    setWire(c.from.id, c.to.id, false);
    setHover(null);
    toast?.({ text: `unplugged ${c.from.title} → ${c.to.title}`, actions: [{ label: "undo", run: () => setWire(c.from.id, c.to.id, true) }] });
  };

  // Where the pointer is on the panel, in the drawing's own units (so it works scaled inside a Window)
  const at = (e) => {
    const r = svg.current.getBoundingClientRect();
    return { x: ((e.clientX - r.left) * W) / (r.width || W), y: ((e.clientY - r.top) * H) / (r.height || H) };
  };

  const startDrag = (side, id) => (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDrag({ side, id, ...at(e) });
    const move = (ev) => setDrag((d) => d && { ...d, ...at(ev) });
    const up = (ev) => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      const p = at(ev);
      // let go near a jack of the other kind to plug in
      const list = side === "out" ? ins : outs;
      const x = side === "out" ? ix : ox;
      const hit = list.find((m, i) => Math.hypot(p.x - x, p.y - oy(i)) < 24);
      if (hit) {
        const from = side === "out" ? outs.find((m) => m.id === id) : hit;
        const to = side === "out" ? hit : ins.find((m) => m.id === id);
        if (from && to) plug(from, to);
      }
      setDrag(null);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
  };

  const sag = (x1, y1, x2, y2) => {
    const s = 30 + Math.abs(y2 - y1) * 0.25;
    return `M${x1} ${y1} C${x1 + 44} ${y1 + s}, ${x2 - 44} ${y2 + s}, ${x2} ${y2}`;
  };

  const g = `pb${mod.id}`;
  const lit = (m) => (flash[m.id] ? "flash" : "");
  const wiredIn = (m) => cables.some((c) => c.to.id === m.id);
  const wiredOut = (m) => (m.state.sendTo ?? []).some((t) => ins.some((x) => x.id === t));

  return (
    <div className="pbay" ref={wrap}>
      <div className="pbay-scroll">
        <div className="pbay-panel" style={{ height: H }}>
          <span className="pbay-plate">PATCH BAY</span>
          <span className="pbay-head" style={{ left: ox }}>send</span>
          <span className="pbay-head" style={{ left: ix }}>receive</span>
          {outs.map((m, i) => (
            <span key={m.id} className="pbay-tag out" style={{ top: oy(i) - 9, right: W - ox + 24, maxWidth: ox - 34 }} title={m.title}>
              {m.title}
            </span>
          ))}
          {ins.map((m, i) => (
            <span key={m.id} className="pbay-tag in" style={{ top: oy(i) - 9, left: ix + 24, maxWidth: W - ix - 34 }} title={m.title}>
              {m.title}
            </span>
          ))}
          {outs.length === 0 && (
            <span className="pbay-none" style={{ left: 14, top: TOP + 6, width: ox - 30 }}>
              nothing here sends yet: add a timer, metronome, tuner, keys or tape
            </span>
          )}
          {ins.length === 0 && (
            <span className="pbay-none" style={{ left: ix + 20, top: TOP + 6, width: W - ix - 30 }}>
              nothing to plug into: add a graph, tally or jar
            </span>
          )}
          <svg ref={svg} className="pbay-svg" width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="group" aria-label="Patch bay">
            <defs>
              <radialGradient id={`${g}-ring`} cx="40%" cy="35%" r="75%">
                <stop offset="0" stopColor="#f4f1ea" />
                <stop offset="0.55" stopColor="#a9a39a" />
                <stop offset="1" stopColor="#5d5852" />
              </radialGradient>
              <radialGradient id={`${g}-hole`} cx="50%" cy="60%" r="60%">
                <stop offset="0" stopColor="#2a2724" />
                <stop offset="1" stopColor="#050504" />
              </radialGradient>
            </defs>

            {/* the sockets, with a status light over each */}
            {outs.map((m, i) => (
              <Jack key={m.id} x={ox} y={oy(i)} g={g} on={wiredOut(m)} flash={!!flash[m.id]} />
            ))}
            {ins.map((m, i) => (
              <Jack key={m.id} x={ix} y={oy(i)} g={g} on={wiredIn(m)} flash={!!flash[m.id]} />
            ))}

            {/* cables hang between the plugs; a fat see-through copy is the thing you click */}
            {cables.map((c) => {
              const d = sag(c.x1, c.y1, c.x2, c.y2);
              const col = colorOf(c.from.id);
              return (
                <g key={c.key} className={`pbay-cable ${hover === c.key ? "hot" : ""} ${lit(c.to)}`}>
                  <path d={d} className="pbay-c-shadow" />
                  <path d={d} className="pbay-c-edge" />
                  <path d={d} className="pbay-c-core" style={{ stroke: col }} />
                  <path d={d} className="pbay-c-shine" />
                  <Plug x={c.x1} y={c.y1} col={col} />
                  <Plug x={c.x2} y={c.y2} col={col} />
                  <path
                    d={d}
                    className="pbay-c-hit"
                    onPointerEnter={() => setHover(c.key)}
                    onPointerLeave={() => setHover(null)}
                    onClick={() => unplug(c)}
                  >
                    <title>{`${c.from.title} → ${c.to.title}: click to unplug`}</title>
                  </path>
                </g>
              );
            })}

            {/* grab handles sit on top of the cables, so a plugged jack can still start a new one */}
            {outs.map((m, i) => (
              <circle key={m.id} className="pbay-grab" cx={ox} cy={oy(i)} r="16" onPointerDown={startDrag("out", m.id)} role="button" aria-label={`${m.title} output`} />
            ))}
            {ins.map((m, i) => (
              <circle key={m.id} className="pbay-grab" cx={ix} cy={oy(i)} r="16" onPointerDown={startDrag("in", m.id)} role="button" aria-label={`${m.title} input`} />
            ))}

            {/* the cable you're pulling right now */}
            {drag && (() => {
              const list = drag.side === "out" ? outs : ins;
              const i = list.findIndex((m) => m.id === drag.id);
              if (i < 0) return null;
              const jx = drag.side === "out" ? ox : ix;
              const col = drag.side === "out" ? colorOf(drag.id) : "#8a8280";
              const d = drag.side === "out" ? sag(jx, oy(i), drag.x, drag.y) : sag(drag.x, drag.y, jx, oy(i));
              return (
                <g className="pbay-cable pulling" pointerEvents="none">
                  <path d={d} className="pbay-c-shadow" />
                  <path d={d} className="pbay-c-edge" />
                  <path d={d} className="pbay-c-core" style={{ stroke: col }} />
                  <Plug x={jx} y={oy(i)} col={col} />
                  <Plug x={drag.x} y={drag.y} col={col} />
                </g>
              );
            })()}
          </svg>
          <span className="pbay-foot">drag jack to jack · click a cable to unplug</span>
        </div>
      </div>
    </div>
  );
}

// A quarter-inch socket: chrome ring, dark hole, and a little LED (green = wired, white flare = reading just arrived)
function Jack({ x, y, g, on, flash }) {
  return (
    <g className="pbay-jack">
      <circle cx={x} cy={y} r="14.5" fill={`url(#${g}-ring)`} stroke="#1c1a18" strokeWidth="1.5" />
      <circle cx={x} cy={y} r="9.5" fill={`url(#${g}-hole)`} stroke="#3c3835" strokeWidth="1" />
      <circle cx={x - 15} cy={y - 14} r="3.6" className={`pbay-led${on ? " on" : ""}${flash ? " flash" : ""}`} />
    </g>
  );
}

// The plug end of a cable, seated in a jack (or hanging on the cursor)
function Plug({ x, y, col }) {
  return (
    <g pointerEvents="none">
      <circle cx={x} cy={y} r="10.5" fill="#26231f" />
      <circle cx={x} cy={y} r="8" fill={col} stroke="#1c1a18" strokeWidth="1.2" />
      <circle cx={x} cy={y} r="4.2" fill="#d9d4cb" stroke="#1c1a18" strokeWidth="1" />
      <circle cx={x - 2} cy={y - 2} r="1.3" fill="#fff" opacity="0.8" />
    </g>
  );
}
