import { useState } from "react";
import { useData } from "../../contexts/DataContext";
import { useBoardContext } from "../board/BoardContext";
import { uid as newUid } from "../../utils/uid";
import { dayDiff } from "../../utils/date";
import { hash } from "../Sticker";
import { newPlant } from "../../lib/garden";

const INK = "#2a2520";
const MAX_CM = 8; // a full jar of roots
const READY_CM = 2.5; // roots long enough that it's happy to be potted
const KINDS = ["pothos", "monstera", "snake", "fern"];
const STALE = 7; // days before the water wants changing

const fmtCm = (n) => `${Math.round(n * 10) / 10} cm`;

// Roots: a few wiggly strands that reach further as the number grows
function roots(cm, seed) {
  if (cm <= 0) return [];
  const len = 14 + (Math.min(cm, MAX_CM) / MAX_CM) * 38;
  const n = 3 + Math.min(5, Math.floor(cm * 1.4));
  return Array.from({ length: n }, (_, i) => {
    const h = hash(`${seed}${i}`);
    const dir = n === 1 ? 0 : (i / (n - 1)) * 2 - 1; // -1 … 1 across the bottom
    const l = len * (0.62 + ((h % 40) / 100));
    const sway = ((h >>> 4) % 9) - 4;
    const x0 = 40 + dir * 3;
    const x1 = x0 + dir * 12 + sway;
    return `M${x0} 76 q${sway * 0.8} ${l * 0.35} ${(x1 - x0) * 0.6} ${l * 0.55} t${(x1 - x0) * 0.4 + sway * 0.5} ${l * 0.45}`;
  });
}

function Cutting({ c }) {
  const waterAge = dayDiff(c.waterAt ?? c.start, new Date());
  // clear to murky green as the water ages
  const murk = Math.min(1, Math.max(0, (waterAge - 2) / 12));
  const tint = `rgba(${Math.round(176 - murk * 70)},${Math.round(218 - murk * 20)},${Math.round(236 - murk * 130)},${0.45 + murk * 0.25})`;
  const heart = c.kind === "pothos" || c.kind === "monstera";
  const leaf = "#6bb36b";
  return (
    <svg className="pg-art" viewBox="0 0 80 126" aria-hidden="true">
      <defs>
        <clipPath id={`pg-${c.id}`}>
          <path d="M20 44 h40 v66 q0 12 -12 12 h-16 q-12 0 -12 -12z" />
        </clipPath>
      </defs>
      {/* the cutting: a stem, a node, and leaves above the rim */}
      <path d="M40 76 V22" stroke={INK} strokeWidth="4.4" strokeLinecap="round" />
      <path d="M40 76 V22" stroke="#7fbf7f" strokeWidth="2" strokeLinecap="round" />
      <path d="M36.5 70 h7" stroke={INK} strokeWidth="2.2" strokeLinecap="round" />
      {heart ? (
        <>
          <g transform="translate(40 36) rotate(-34) scale(1.1)">
            <path d="M0 0 C-14 -2 -16 -16 -7 -20 C-3 -22 -1 -19 0 -17 C1 -19 3 -22 7 -20 C16 -16 14 -2 0 0z" fill={leaf} stroke={INK} strokeWidth="1.8" strokeLinejoin="round" />
          </g>
          <g transform="translate(40 28) rotate(30) scale(1.2)">
            <path d="M0 0 C-14 -2 -16 -16 -7 -20 C-3 -22 -1 -19 0 -17 C1 -19 3 -22 7 -20 C16 -16 14 -2 0 0z" fill={leaf} stroke={INK} strokeWidth="1.8" strokeLinejoin="round" />
            <path d="M0 -2 V-16" stroke="rgba(255,255,255,.55)" strokeWidth="1.2" />
          </g>
        </>
      ) : (
        <>
          <path d="M40 40 C28 36 28 16 36 6 C40 14 46 28 40 40z" fill={leaf} stroke={INK} strokeWidth="1.8" strokeLinejoin="round" />
          <path d="M40 30 C52 28 54 14 48 6 C42 12 38 22 40 30z" fill="#80c480" stroke={INK} strokeWidth="1.8" strokeLinejoin="round" />
        </>
      )}
      <g clipPath={`url(#pg-${c.id})`}>
        <rect x="20" y="56" width="40" height="70" fill={tint} />
        <path d="M20 56 q5 -3 10 0 t10 0 t10 0 t10 0" fill="none" stroke="rgba(255,255,255,.6)" strokeWidth="1.4" />
        {roots(c.roots, c.id).map((d, i) => (
          <g key={i} className="pg-root">
            <path d={d} fill="none" stroke={INK} strokeWidth="3.4" strokeLinecap="round" />
            <path d={d} fill="none" stroke="#fbf4e4" strokeWidth="1.5" strokeLinecap="round" />
          </g>
        ))}
        {murk > 0.5 && [0, 1, 2, 3].map((i) => <circle key={i} cx={26 + ((hash(c.id + i) % 28))} cy={90 + ((hash(c.id + i + 9) % 24))} r="1.2" fill="rgba(70,90,40,.45)" />)}
      </g>
      <path className="pg-glass" d="M20 44 h40 v66 q0 12 -12 12 h-16 q-12 0 -12 -12z" />
      <path d="M24 52 v54" stroke="rgba(255,255,255,.7)" strokeWidth="2.6" strokeLinecap="round" fill="none" />
      <rect x="17" y="40" width="46" height="6" rx="2.6" className="pg-lip" />
    </svg>
  );
}

// Jars of cuttings on a shelf, each rooting in water. Nudge the root length as it
// grows; when it's ready, "pot it up" moves it to the Plant tags on this board
// (making that module if there isn't one yet). State: cuttings [{ id, name, kind,
// start (ms), roots (cm), waterAt (ms) }].
export default function Propagate({ board, mod, setState }) {
  const { toast, updateBoard } = useData();
  const ctx = useBoardContext();
  const cuttings = mod.state.cuttings ?? [];
  const [fresh, setFresh] = useState(null); // the jar whose name should take focus

  const patch = (id, fields, opts) =>
    setState((s) => ({ ...s, cuttings: (s.cuttings ?? []).map((c) => (c.id === id ? { ...c, ...fields } : c)) }), opts);

  const add = () => {
    const id = newUid();
    const now = Date.now();
    setState((s) => ({
      ...s,
      cuttings: [...(s.cuttings ?? []), { id, name: "", kind: KINDS[cuttings.length % KINDS.length], start: now, roots: 0, waterAt: now }],
    }));
    setFresh(id);
  };

  const potUp = (c) => {
    const plant = newPlant(newUid(), c.kind === "fern" ? "fern" : c.kind, c.name || "new plant");
    const home = board.modules.find((m) => m.type === "plants");
    let homeId = home?.id;
    if (home) {
      updateBoard(board.id, (b) => ({
        ...b,
        modules: b.modules.map((m) => (m.id === home.id ? { ...m, state: { ...m.state, plants: [...(m.state.plants ?? []), plant] } } : m)),
      }));
    } else if (ctx?.createModule) {
      homeId = ctx.createModule("plants", { near: mod.id, state: { plants: [plant] } });
    } else {
      return toast({ text: "no Plant tags here to pot it into" });
    }
    setState((s) => ({ ...s, cuttings: (s.cuttings ?? []).filter((x) => x.id !== c.id) }));
    toast({
      text: `${plant.name} is potted up 🪴${home ? "" : " · made you some Plant tags"}`,
      actions: [
        {
          label: "undo",
          run: () => {
            updateBoard(board.id, (b) => ({
              ...b,
              modules: b.modules.map((m) => (m.id === homeId ? { ...m, state: { ...m.state, plants: (m.state.plants ?? []).filter((p) => p.id !== plant.id) } } : m)),
            }));
            setState((s) => ({ ...s, cuttings: [...(s.cuttings ?? []), c] }));
          },
        },
      ],
    });
  };

  return (
    <div className="pg">
      <div className="pg-shelf">
        {cuttings.map((c) => {
          const day = Math.max(1, dayDiff(c.start, new Date()) + 1);
          const ready = c.roots >= READY_CM;
          const stale = dayDiff(c.waterAt ?? c.start, new Date()) >= STALE;
          return (
            <div key={c.id} className={`pg-jar${ready ? " ready" : ""}`}>
              <div className="pg-view" onClick={() => patch(c.id, { kind: KINDS[(KINDS.indexOf(c.kind) + 1) % KINDS.length] })} title="tap to change the leaf">
                <Cutting c={c} />
                {ready && <span className="pg-spark" aria-hidden="true">✦</span>}
                <span className="pg-tape">day {day}</span>
              </div>
              <div className="pg-plank" aria-hidden="true" />
              <input
                className="line-input pg-name"
                defaultValue={c.name}
                autoFocus={fresh === c.id}
                placeholder="what is it?"
                onChange={(e) => patch(c.id, { name: e.target.value }, { debounce: 500 })}
                aria-label="Cutting name"
              />
              <div className="pg-roots">
                <button className="pg-step" onClick={() => patch(c.id, { roots: Math.max(0, Math.round((c.roots - 0.5) * 10) / 10) })} disabled={c.roots <= 0} aria-label="Shorter roots">−</button>
                <span><b>{c.roots > 0 ? fmtCm(c.roots) : "no roots"}</b></span>
                <button className="pg-step" onClick={() => patch(c.id, { roots: Math.min(20, Math.round((c.roots + 0.5) * 10) / 10) })} aria-label="Longer roots">+</button>
              </div>
              <div className="pg-acts">
                <button className={`mini-btn ghost${stale ? " pg-stale" : ""}`} onClick={() => { patch(c.id, { waterAt: Date.now() }); toast({ text: "fresh water 💧" }); }} title={stale ? "the water's looking old" : "change the water"}>
                  💧{stale ? " stale" : ""}
                </button>
                <button className={`mini-btn${ready ? " pg-go" : ""}`} onClick={() => potUp(c)}>🪴 pot up</button>
              </div>
              <button className="x-btn pg-x" onClick={() => setState((s) => ({ ...s, cuttings: (s.cuttings ?? []).filter((x) => x.id !== c.id) }))} aria-label="Compost this cutting" title="compost it">✕</button>
            </div>
          );
        })}
        <button className="pl-add pg-add" onClick={add} aria-label="Add a cutting">
          <span>+</span>cutting
        </button>
      </div>
      {cuttings.length === 0 && <div className="pl-empty">snip something off and give it a jar.</div>}
    </div>
  );
}
