import { useState, useRef, useEffect } from "react";
import { useData } from "../../contexts/DataContext";
import { useImage } from "../../hooks/useEntries";
import { compressImage, saveImage, deleteImage } from "../../lib/data";
import { caps } from "../../lib/caps";
import { uid as newUid } from "../../utils/uid";
import { agoLabel } from "../../utils/date";
import { hash } from "../Sticker";
import {
  LIGHTS, PLANT_KINDS, newPlant, thirst, droop, isThirsty, dueLabel, needsFeed,
} from "../../lib/garden";

const POTS = ["#d9825b", "#f1e3c8", "#a9c4a0", "#e8b4bc", "#9db8d6"];
const INK = "#2a2520";

// Leaf green drifts to a tired yellow-olive as the plant wilts (a, b are [r,g,b])
const mix = (a, b, t) => `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * t)).join(",")})`;
const GREEN = [107, 179, 107];
const TIRED = [196, 190, 96];

// A leaf pointing up from the origin: stem, then a blade of length L and half-width w
const blade = (L, w) => `M0 0 C${-w} ${-L * 0.3} ${-w} ${-L * 0.82} 0 ${-L} C${w} ${-L * 0.82} ${w} ${-L * 0.3} 0 0z`;

// Each kind is a list of leaves: base angle (deg from straight up), size, and how
// much it sags (+1 hangs to the right, -1 to the left). Drooping turns each leaf
// outward and down, so a thirsty plant visibly slumps over its pot.
const LEAVES = {
  pothos: [
    { a: -62, L: 34, s: -1 }, { a: -32, L: 40, s: -1 }, { a: -6, L: 44, s: -1 },
    { a: 20, L: 40, s: 1 }, { a: 48, L: 36, s: 1 }, { a: 74, L: 30, s: 1 },
    { a: -98, L: 40, s: -1, vine: true }, { a: 100, L: 46, s: 1, vine: true },
  ],
  snake: [
    { a: -34, L: 56, s: -1 }, { a: -14, L: 74, s: -1 }, { a: 4, L: 82, s: 1 },
    { a: 22, L: 66, s: 1 }, { a: 40, L: 48, s: 1 },
  ],
  fern: [
    { a: -78, L: 50, s: -1 }, { a: -52, L: 60, s: -1 }, { a: -26, L: 64, s: -1 },
    { a: 0, L: 66, s: 1 }, { a: 26, L: 64, s: 1 }, { a: 52, L: 60, s: 1 }, { a: 78, L: 50, s: 1 },
  ],
  monstera: [
    { a: -50, L: 44, s: -1 }, { a: -16, L: 58, s: -1 }, { a: 14, L: 52, s: 1 }, { a: 46, L: 40, s: 1 },
  ],
};

function Leaf({ kind, L, color, d, vine, s = 1 }) {
  const edge = { stroke: INK, strokeWidth: 1.8, strokeLinejoin: "round", strokeLinecap: "round" };
  if (kind === "snake") {
    return (
      <>
        <path d={blade(L, 8)} fill={color} {...edge} />
        <path d={`M0 -4 Q-3 ${-L * 0.4} 0 ${-L * 0.9}`} fill="none" stroke="rgba(42,37,32,.28)" strokeWidth="1.2" />
        <path d={`M-4.5 ${-L * 0.3}q4 -4 8 0M-4 ${-L * 0.55}q4 -4 7.5 0`} fill="none" stroke="rgba(255,255,255,.4)" strokeWidth="1.3" />
      </>
    );
  }
  if (kind === "fern") {
    const n = Math.round(L / 7);
    return (
      <>
        <path d={`M0 0 Q3 ${-L * 0.6} 0 ${-L}`} fill="none" stroke={INK} strokeWidth="3.2" strokeLinecap="round" />
        <path d={`M0 0 Q3 ${-L * 0.6} 0 ${-L}`} fill="none" stroke={color} strokeWidth="1.4" strokeLinecap="round" />
        {Array.from({ length: n }, (_, i) => {
          const y = -8 - (i * (L - 12)) / n;
          const w = 12 * (1 - (i / n) * 0.7);
          return (
            <g key={i} fill={color} stroke={INK} strokeWidth="1.1">
              <ellipse cx={-w * 0.55} cy={y + 1} rx={w * 0.55} ry="2.6" transform={`rotate(-24 0 ${y})`} />
              <ellipse cx={w * 0.55} cy={y + 1} rx={w * 0.55} ry="2.6" transform={`rotate(24 0 ${y})`} />
            </g>
          );
        })}
      </>
    );
  }
  if (kind === "monstera") {
    // a long stem, then a big heart with the slits that make it a monstera
    const sl = L * 0.5;
    return (
      <>
        <path d={`M0 0 L0 ${-sl}`} stroke={INK} strokeWidth="3.4" strokeLinecap="round" />
        <path d={`M0 0 L0 ${-sl}`} stroke={color} strokeWidth="1.5" strokeLinecap="round" />
        <g className="pl-leaf" style={{ transform: `translate(0px, ${-sl}px) rotate(${s * d * 70}deg)` }}>
          <path d="M0 0 C-22 -4 -26 -26 -12 -32 C-6 -35 -2 -30 0 -27 C2 -30 6 -35 12 -32 C26 -26 22 -4 0 0z" fill={color} {...edge} />
          <path d="M0 -2 V-26" stroke="rgba(42,37,32,.3)" strokeWidth="1.1" fill="none" />
          <path d="M-22 -14 L-10 -14M-19 -23 L-8 -20M22 -14 L10 -14M19 -23 L8 -20" stroke="#faf8f5" strokeWidth="2.4" strokeLinecap="round" />
        </g>
      </>
    );
  }
  // pothos: a thin stem and a heart-shaped leaf with a pale splash
  const sl = L * (vine ? 0.62 : 0.5);
  return (
    <>
      <path d={`M0 0 Q${vine ? 5 : 2} ${-sl * 0.5} 0 ${-sl}`} fill="none" stroke={INK} strokeWidth="3" strokeLinecap="round" />
      <path d={`M0 0 Q${vine ? 5 : 2} ${-sl * 0.5} 0 ${-sl}`} fill="none" stroke={color} strokeWidth="1.2" strokeLinecap="round" />
      <g className="pl-leaf" style={{ transform: `translate(0px, ${-sl}px) rotate(${s * d * 75}deg) scale(${0.8 + L / 120})` }}>
        <path d="M0 0 C-14 -2 -16 -16 -7 -20 C-3 -22 -1 -19 0 -17 C1 -19 3 -22 7 -20 C16 -16 14 -2 0 0z" fill={color} {...edge} />
        <path d="M0 -2 V-16" stroke="rgba(255,255,255,.55)" strokeWidth="1.2" fill="none" />
      </g>
    </>
  );
}

function Cactus({ color, d }) {
  const lean = d * 10;
  return (
    <g style={{ transform: `rotate(${lean}deg) scaleY(${1 - d * 0.07})`, transformOrigin: "0 0" }} className="pl-leaf">
      <path d="M-13 0 V-44 Q-13 -62 0 -62 Q13 -62 13 -44 V0z" fill={color} stroke={INK} strokeWidth="2" strokeLinejoin="round" />
      <path d={`M-13 -24 H-22 Q-28 -24 -28 -32 V${-44 + d * 12}`} fill="none" stroke={INK} strokeWidth="11" strokeLinecap="round" />
      <path d={`M-13 -24 H-22 Q-28 -24 -28 -32 V${-44 + d * 12}`} fill="none" stroke={color} strokeWidth="7" strokeLinecap="round" />
      <path d={`M13 -34 H21 Q27 -34 27 -42 V${-54 + d * 14}`} fill="none" stroke={INK} strokeWidth="11" strokeLinecap="round" />
      <path d={`M13 -34 H21 Q27 -34 27 -42 V${-54 + d * 14}`} fill="none" stroke={color} strokeWidth="7" strokeLinecap="round" />
      <path d="M-5 -6 V-54M5 -6 V-54" stroke="rgba(42,37,32,.22)" strokeWidth="1.4" />
      <path d="M-9 -16h-3M9 -22h3M-8 -38h-3M8 -44h3M-3 -52v-3M4 -30h3" stroke={INK} strokeWidth="1.2" strokeLinecap="round" />
      <circle cx="0" cy="-64" r="4.5" fill="#f08aa6" stroke={INK} strokeWidth="1.6" />
      <circle cx="0" cy="-64" r="1.5" fill="#ffd25c" />
    </g>
  );
}

// One potted plant, drawn from its thirst. t: 0 fresh … 1 due … >1 overdue.
export function PlantArt({ kind = "pothos", t = 0, seed = "", perk = false }) {
  const d = droop(t);
  const color = mix(GREEN, TIRED, d * 0.8);
  const pot = POTS[hash(seed) % POTS.length];
  const leaves = LEAVES[kind] ?? LEAVES.pothos;
  const sad = t >= 1;
  const meh = t >= 0.6 && !sad;
  return (
    <svg className={`pl-art${perk ? " perk" : ""}`} viewBox="0 -16 100 140" aria-hidden="true">
      <g transform="translate(50 80)">
        {kind === "cactus" ? (
          <Cactus color={color} d={d} />
        ) : (
          leaves.map((lf, i) => {
            // the sag turns it outward (and a trailing vine just hangs further)
            const ang = lf.vine ? lf.a + lf.s * d * 25 : Math.max(-86, Math.min(86, lf.a + lf.s * d * 50));
            return (
              <g key={i} className="pl-leaf" style={{ transform: `rotate(${ang}deg) scale(${1 - d * 0.1})`, transformOrigin: "0 0" }}>
                <Leaf kind={kind} L={lf.L} color={color} d={d} vine={lf.vine} s={lf.s} />
              </g>
            );
          })
        )}
      </g>
      {/* the pot sits in front of the stems */}
      <path d="M27 86 H73 L67 120 Q66.4 122 64 122 H36 Q33.6 122 33 120z" fill={pot} stroke={INK} strokeWidth="2.4" strokeLinejoin="round" />
      <rect x="22" y="76" width="56" height="13" rx="4" fill={pot} stroke={INK} strokeWidth="2.4" />
      <path d="M27 80 H73" stroke="rgba(255,255,255,.45)" strokeWidth="2.2" strokeLinecap="round" />
      {/* a face, because why not */}
      <g stroke={INK} strokeWidth="2" strokeLinecap="round" fill="none">
        <circle cx="42" cy="102" r="1.7" fill={INK} stroke="none" />
        <circle cx="58" cy="102" r="1.7" fill={INK} stroke="none" />
        {sad ? <path d="M45 111 Q50 106.5 55 111" /> : meh ? <path d="M46 109.5 H54" /> : <path d="M45 107.5 Q50 112.5 55 107.5" />}
      </g>
      <circle cx="37" cy="107" r="2.6" fill="#f08aa6" opacity=".5" />
      <circle cx="63" cy="107" r="2.6" fill="#f08aa6" opacity=".5" />
      {sad && <path className="pl-tear" d="M62 104 q2 3 0 4.4 q-2 -1.4 0 -4.4z" fill="#7ec8e3" stroke={INK} strokeWidth="1" />}
    </svg>
  );
}

const CanIcon = () => (
  <svg viewBox="0 0 28 22" aria-hidden="true">
    <path d="M6 7h13v11a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2z" fill="#9db8d6" stroke={INK} strokeWidth="1.8" strokeLinejoin="round" />
    <path d="M19 10l6-5M24 3.4l2.6 3.2" stroke={INK} strokeWidth="1.8" strokeLinecap="round" fill="none" />
    <path d="M6 9.5C1.5 9.5 1.5 15 6 15" fill="none" stroke={INK} strokeWidth="1.8" strokeLinecap="round" />
    <path d="M9 7V5.5h7V7" fill="none" stroke={INK} strokeWidth="1.8" strokeLinecap="round" />
  </svg>
);

// A tiny dated polaroid in a plant's growth strip
function Mini({ id, at, onToss }) {
  const { uid } = useData();
  const src = useImage(uid, id);
  const rot = ((hash(id) % 7) - 3) * 1.2;
  return (
    <div className="pl-pola" style={{ transform: `rotate(${rot}deg)` }}>
      <span className="pl-pola-img">{src && <img src={src} alt="" draggable={false} />}</span>
      <span className="pl-pola-date">{new Date(at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>
      <button className="pl-pola-x" onClick={onToss} aria-label="Toss this photo">✕</button>
    </div>
  );
}

// Snap from the camera, with a little viewfinder; falls back to the file picker
function Snap({ onShot, onClose }) {
  const vid = useRef(null);
  const [err, setErr] = useState(false);
  useEffect(() => {
    let stream;
    let live = true;
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "environment" } })
      .then((s) => {
        stream = s;
        if (!live) return s.getTracks().forEach((t) => t.stop());
        if (vid.current) vid.current.srcObject = s;
      })
      .catch(() => setErr(true));
    return () => {
      live = false;
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);
  const shoot = () => {
    const v = vid.current;
    if (!v?.videoWidth) return;
    const c = document.createElement("canvas");
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    c.getContext("2d").drawImage(v, 0, 0);
    c.toBlob((b) => b && onShot(new File([b], "plant.jpg", { type: "image/jpeg" })), "image/jpeg", 0.9);
  };
  return (
    <div className="pl-snap">
      {err ? <span className="pl-snap-err">can't reach a camera</span> : <video ref={vid} autoPlay playsInline muted />}
      <div>
        {!err && <button className="mini-btn" onClick={shoot}>📷 click!</button>}
        <button className="mini-btn ghost" onClick={onClose}>{err ? "ok" : "never mind"}</button>
      </div>
    </div>
  );
}

const nudge = (fn) => (e) => fn(e.target.value);

// A windowsill of potted plants. Each has a stake saying what it is and when it's
// next thirsty. The plant droops the thirstier it gets and perks up when you water
// it. State: plants [{ id, name, kind, every (days), light, watered (ms), feedEvery
// (weeks), fed (ms), notes, photos, history }]. Each watering is one sticker-chart
// entry (a "log" with moduleId + plantId, so the board's chart and streak count it).
export default function Plants({ board, mod, setState }) {
  const { uid, toast, logPractice, undoLog } = useData();
  const plants = mod.state.plants ?? [];
  const [sel, setSel] = useState(null);
  const [splash, setSplash] = useState({}); // plantId → true while the watering animation plays
  const [snapping, setSnapping] = useState(false);
  const fileRef = useRef(null);
  const [, tick] = useState(0);

  // Droop is a function of the clock, so nudge it along every few minutes
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 300000);
    return () => clearInterval(t);
  }, []);

  const now = Date.now();
  const thirsty = plants.filter((p) => isThirsty(p, now));
  const patch = (id, fields, opts) =>
    setState((s) => ({ ...s, plants: (s.plants ?? []).map((p) => (p.id === id ? { ...p, ...fields } : p)) }), opts);

  const water = (ids) => {
    const list = plants.filter((p) => ids.includes(p.id));
    if (!list.length) return;
    const at = Date.now();
    const before = Object.fromEntries(list.map((p) => [p.id, { watered: p.watered, history: p.history }]));
    setState((s) => ({
      ...s,
      plants: (s.plants ?? []).map((p) =>
        ids.includes(p.id) ? { ...p, watered: at, history: [at, ...(p.history ?? [])].slice(0, 12) } : p
      ),
    }));
    // the little splash
    setSplash((m) => ({ ...m, ...Object.fromEntries(ids.map((i) => [i, true])) }));
    setTimeout(() => setSplash((m) => Object.fromEntries(Object.entries(m).filter(([k]) => !ids.includes(k)))), 1300);
    const names = list.map((p) => p.name || "a plant");
    const entry = logPractice(board.id, `🪴 watered ${names.join(", ")}`, {
      moduleId: mod.id,
      plantId: list.length === 1 ? list[0].id : null,
      water: true,
    });
    toast({
      text: list.length === 1 ? `${names[0]} says thanks 💧` : `watered ${list.length} plants 💧`,
      actions: [
        {
          label: "undo",
          run: () => {
            undoLog(entry);
            setState((s) => ({
              ...s,
              plants: (s.plants ?? []).map((p) => (before[p.id] ? { ...p, ...before[p.id] } : p)),
            }));
          },
        },
      ],
    });
  };

  const add = () => {
    const kind = PLANT_KINDS[plants.length % PLANT_KINDS.length];
    const p = newPlant(newUid(), kind, "");
    setState((s) => ({ ...s, plants: [...(s.plants ?? []), p] }));
    setSel(p.id);
  };
  const remove = (p) => {
    setState((s) => ({ ...s, plants: (s.plants ?? []).filter((x) => x.id !== p.id) }));
    (p.photos ?? []).forEach((ph) => deleteImage(uid, ph.imageId));
    setSel(null);
  };

  const addPhoto = async (p, file) => {
    try {
      const imageId = saveImage(uid, board.id, await compressImage(file));
      patch(p.id, { photos: [...(p.photos ?? []), { imageId, at: Date.now() }] });
    } catch {
      toast({ text: "couldn't read that picture" });
    }
    setSnapping(false);
  };
  const tossPhoto = (p, ph) => {
    patch(p.id, { photos: (p.photos ?? []).filter((x) => x.imageId !== ph.imageId) });
    deleteImage(uid, ph.imageId);
  };

  const cur = plants.find((p) => p.id === sel);
  const num = (v, lo, hi, fallback) => Math.max(lo, Math.min(hi, Math.round(Number(v)))) || fallback;

  return (
    <div className="pl">
      {plants.length > 0 && (
        <div className="pl-bar">
          {thirsty.length > 0 ? (
            <button className="mini-btn pl-all" onClick={() => water(thirsty.map((p) => p.id))}>
              💧 water all that need it ({thirsty.length})
            </button>
          ) : (
            <span className="pl-ok">everyone's had a drink 🌿</span>
          )}
        </div>
      )}

      <div className="pl-sillrow">
        {plants.map((p) => {
          const t = thirst(p, now);
          const needy = t >= 1;
          return (
            <div key={p.id} className={`pl-card${sel === p.id ? " sel" : ""}${needy ? " dry" : ""}`}>
              <button className="pl-stage" onClick={() => setSel(sel === p.id ? null : p.id)} aria-label={`${p.name || "plant"}: edit`}>
                <PlantArt kind={p.kind} t={t} seed={p.id} perk={!!splash[p.id]} />
                {splash[p.id] && (
                  <span className="pl-splash" aria-hidden="true">
                    <b className="pl-pour"><CanIcon /></b>
                    {[0, 1, 2, 3, 4, 5].map((i) => <i key={i} style={{ "--x": `${(i - 2.5) * 9}px`, "--dl": `${i * 70}ms` }} />)}
                  </span>
                )}
                <span className="pl-stake" style={{ "--tilt": `${(hash(p.id) % 7) - 3}deg` }}>
                  <span className="pl-stake-name">{p.name || "name me"}</span>
                  <span className="pl-stake-due">{LIGHTS.find((l) => l.id === p.light)?.icon} 💧 {dueLabel(p, now)}</span>
                </span>
              </button>
              <div className="pl-sill" aria-hidden="true" />
              <button className="pl-can" onClick={() => water([p.id])} aria-label={`Water ${p.name || "this plant"}`} title="water it">
                <CanIcon />
              </button>
              {needsFeed(p, now) && <span className="pl-feed" title="time to fertilize">🌱</span>}
            </div>
          );
        })}
        <button className="pl-add" onClick={add} aria-label="Add a plant">
          <span>+</span>plant
        </button>
      </div>
      {plants.length === 0 && <div className="pl-empty">an empty windowsill. who's moving in?</div>}

      {cur && (
        <div className="pl-edit" key={cur.id}>
          <div className="pl-edit-top">
            <input
              className="line-input pl-name"
              defaultValue={cur.name}
              placeholder="what do you call it?"
              autoFocus={!cur.name}
              onChange={(e) => patch(cur.id, { name: e.target.value }, { debounce: 500 })}
              aria-label="Plant name"
            />
            <button className="x-btn" onClick={() => setSel(null)} aria-label="Close">✕</button>
          </div>
          <div className="pl-kinds" role="radiogroup" aria-label="Kind of plant">
            {PLANT_KINDS.map((k) => (
              <button key={k} role="radio" aria-checked={cur.kind === k} className={`pl-kind${cur.kind === k ? " sel" : ""}`} onClick={() => patch(cur.id, { kind: k })}>
                {k}
              </button>
            ))}
          </div>
          <div className="gr-settings pl-fields">
            <label>
              water every (days)
              <input className="line-input" inputMode="numeric" defaultValue={cur.every} onChange={nudge((v) => patch(cur.id, { every: num(v, 1, 90, 7) }, { debounce: 500 }))} />
            </label>
            <label>
              feed every (weeks)
              <input className="line-input" inputMode="numeric" defaultValue={cur.feedEvery} placeholder="0 = never" onChange={nudge((v) => patch(cur.id, { feedEvery: Math.max(0, Math.min(52, Math.round(Number(v)) || 0)) }, { debounce: 500 }))} />
            </label>
          </div>
          <div className="pl-lights" role="radiogroup" aria-label="Light">
            {LIGHTS.map((l) => (
              <button key={l.id} role="radio" aria-checked={cur.light === l.id} className={`pl-light${cur.light === l.id ? " sel" : ""}`} onClick={() => patch(cur.id, { light: l.id })}>
                {l.icon} {l.label}
              </button>
            ))}
          </div>
          <div className="pl-facts">
            last drink {agoLabel(cur.watered)}
            {cur.feedEvery > 0 && (
              <>
                {" · "}fed {agoLabel(cur.fed)}{" "}
                <button className="mini-btn pl-fed" onClick={() => { patch(cur.id, { fed: Date.now() }); toast({ text: `${cur.name || "plant"} is fed 🌱` }); }}>
                  fed it
                </button>
              </>
            )}
          </div>
          <textarea
            className="line-input pl-notes"
            rows={2}
            defaultValue={cur.notes}
            placeholder="notes: mist it, turn it, it hates drafts…"
            onChange={(e) => patch(cur.id, { notes: e.target.value }, { debounce: 600 })}
            aria-label="Notes"
          />

          <div className="pl-prog-h">progress photos</div>
          <div className="pl-prog">
            {(cur.photos ?? []).map((ph) => (
              <Mini key={ph.imageId} id={ph.imageId} at={ph.at} onToss={() => tossPhoto(cur, ph)} />
            ))}
            {!snapping && (
              <div className="pl-prog-add">
                {caps.camera && <button className="mini-btn" onClick={() => setSnapping(true)}>📷 snap</button>}
                <button className="mini-btn" onClick={() => fileRef.current?.click()}>🖼 pick</button>
              </div>
            )}
          </div>
          {snapping && <Snap onShot={(f) => addPhoto(cur, f)} onClose={() => setSnapping(false)} />}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f) addPhoto(cur, f);
            }}
          />
          <button className="pile-toggle pl-remove" onClick={() => remove(cur)}>give this plant away</button>
        </div>
      )}
    </div>
  );
}
