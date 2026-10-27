import { useId, useRef } from "react";
import { wrap, supplyInfo } from "../../lib/meds";

const INK = "#2a2520";

// What to do to take it, per container (also the button's label)
export const HINTS = {
  bottle: "tap the cap",
  vial: "tap the cap",
  syringe: "press the plunger",
  pen: "press the button",
  blister: "pop a bubble",
  organizer: "flip today's lid",
  inhaler: "press the can",
  dropper: "squeeze it",
  tube: "squeeze it",
  jar: "tap the lid",
};

// A pill, drawn at x,y. Round, oval, or a two-tone capsule.
export function Pill({ x = 0, y = 0, shape = "round", color = "#fbfaf5", color2 = "#ffb35c", s = 6, rot = 0, className }) {
  const sw = Math.max(1.3, s / 3.6);
  return (
    <g className={className} transform={`translate(${x} ${y}) rotate(${rot})`} stroke={INK} strokeWidth={sw} strokeLinejoin="round" strokeLinecap="round">
      {shape === "capsule" ? (
        <>
          <path d={`M0 ${-s}H${-s * 1.2}A${s} ${s} 0 0 0 ${-s * 1.2} ${s}H0Z`} fill={color} />
          <path d={`M0 ${-s}H${s * 1.2}A${s} ${s} 0 0 1 ${s * 1.2} ${s}H0Z`} fill={color2} />
          <path d={`M${-s * 1.9} ${-s * 0.45}H${-s * 0.8}`} stroke="#fff" strokeOpacity=".75" strokeWidth={sw * 0.8} />
        </>
      ) : shape === "oval" ? (
        <>
          <ellipse rx={s * 1.7} ry={s * 1.05} fill={color} />
          <path d={`M0 ${-s * 1.05}V${s * 1.05}`} strokeOpacity=".45" strokeWidth={sw * 0.7} />
          <path d={`M${-s * 1.1} ${-s * 0.45}H${-s * 0.4}`} stroke="#fff" strokeOpacity=".75" strokeWidth={sw * 0.8} />
        </>
      ) : (
        <>
          <circle r={s * 1.2} fill={color} />
          <path d={`M${-s * 1.2} 0H${s * 1.2}`} strokeOpacity=".45" strokeWidth={sw * 0.7} />
          <path d={`M${-s * 0.7} ${-s * 0.6}Q${-s * 0.45} ${-s * 0.85} ${-s * 0.1} ${-s * 0.85}`} stroke="#fff" strokeOpacity=".8" strokeWidth={sw * 0.8} fill="none" />
        </>
      )}
    </g>
  );
}

const shade = (color, pct) => `color-mix(in srgb, ${color} ${pct}%, ${INK})`;
const lift = (color, pct) => `color-mix(in srgb, ${color} ${pct}%, #fff)`;

// 0..1 of how full the container is (null when the person isn't counting)
export function fillOf(med) {
  const s = supplyInfo(med);
  if (!s || !s.full) return null;
  return Math.max(0, Math.min(1, s.left / s.full));
}

const cap = (t, n) => (t.length > n ? t.slice(0, n - 1) + "…" : t);
// A long name squeezes to fit its label instead of running off the edge
const fit = (t, size, width) => (t.length * size * 0.6 > width ? { textLength: width, lengthAdjust: "spacingAndGlyphs" } : {});
const nameOf = (med, n = 24) => cap(med.name || "name", n).toUpperCase();
// A flip-off cap colour that stays the same for the same med
const FLIP = ["#d9534f", "#4a7fc1", "#4f9a62", "#e8892b", "#7b5ea7"];

// One container, drawn in SVG on a 200x240 sheet so they all sit alike on a shelf.
//   go     the take-it animation is playing
//   onGo   makes it a button; leave off for a plain picture (picker, shelf)
//   mini   a shelf-sized one: less printing
//   week   the organizer's seven lids: [{ open, today }]
export default function MedArt({ med, go = false, onGo, mini = false, week, label }) {
  const id = useId().replace(/:/g, "");
  const kind = med.container ?? "bottle";
  const Draw = DRAW[kind] ?? Bottle;
  const tint = med.tint || "#e8892b";
  const pill = { shape: "round", color: "#fbfaf5", color2: "#ffb35c", ...med.pill };
  const style = { "--t": tint, "--td": shade(tint, 62), "--tl": lift(tint, 45) };
  const svg = (
    <svg viewBox="0 0 200 240" className="mc-svg" aria-hidden="true" focusable="false">
      <Draw med={med} go={go} mini={mini} id={id} pill={pill} week={week} />
    </svg>
  );
  const cls = `mc-art mc-${kind}${go ? " go" : ""}${mini ? " mini" : ""}${onGo ? " live" : ""}`;
  return onGo ? (
    <button className={cls} style={style} onClick={onGo} disabled={go} aria-label={label ?? `${HINTS[kind]}: take ${med.name || "it"}`}>
      {svg}
    </button>
  ) : (
    <div className={cls} style={style}>
      {svg}
    </div>
  );
}

const Ground = ({ rx = 62, cy = 224 }) => <ellipse className="mc-ground" cx="100" cy={cy} rx={rx} ry="8" />;

// ── orange prescription bottle ──────────────────────────────────────────────
function Bottle({ med, mini, id, pill }) {
  const dir = wrap(med.directions, 18, 3);
  const refills = med.refills === "" || med.refills == null ? null : med.refills;
  const low = supplyInfo(med)?.low;
  return (
    <>
      <defs>
        <linearGradient id={`b${id}`} x1="0" x2="1">
          <stop offset="0" className="t-stop-d" />
          <stop offset=".3" className="t-stop-m" />
          <stop offset=".62" className="t-stop-l" />
          <stop offset="1" className="t-stop-d" />
        </linearGradient>
        <linearGradient id={`w${id}`} x1="0" x2="1">
          <stop offset="0" stopColor="#000" stopOpacity=".2" />
          <stop offset=".18" stopColor="#000" stopOpacity="0" />
          <stop offset=".82" stopColor="#000" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity=".22" />
        </linearGradient>
      </defs>
      <Ground />
      <rect x="57" y="71" width="96" height="152" rx="16" fill={INK} />
      <rect x="52" y="66" width="96" height="152" rx="16" fill={`url(#b${id})`} stroke={INK} strokeWidth="3" />
      <rect x="59" y="84" width="6" height="118" rx="3" fill="#fff" opacity=".4" />
      {/* a few pills show through the amber below the label */}
      <g opacity=".5">
        <Pill x={72} y={212} s={3.4} shape={pill.shape} color={pill.color} color2={pill.color2} rot={20} />
        <Pill x={100} y={211} s={3.4} shape={pill.shape} color={pill.color} color2={pill.color2} rot={-30} />
        <Pill x={126} y={212} s={3.4} shape={pill.shape} color={pill.color} color2={pill.color2} rot={50} />
      </g>
      {/* the pharmacy label */}
      <g className="mc-label">
        <rect x="56" y="90" width="88" height="116" fill="#fffdf6" stroke={INK} strokeWidth="2" />
        <text x="62" y="108" className="mc-rx">Rx</text>
        {!mini && <text x="78" y="106" className="mc-tiny">PHARMACY</text>}
        <Pill x={130} y={103} s={3.6} shape={pill.shape} color={pill.color} color2={pill.color2} rot={-25} />
        <path d="M60 112H140" stroke={INK} strokeWidth="1" />
        <text x="62" y="124" className="mc-name" {...fit(nameOf(med), 10, 76)}>{nameOf(med)}</text>
        {med.strength && <text x="62" y="134" className="mc-line" {...fit(med.strength, 8, 76)}>{cap(med.strength, 24)}</text>}
        {!mini &&
          dir.map((l, i) => (
            <text key={i} x="62" y={145 + i * 8} className="mc-line sm">{l}</text>
          ))}
        {!mini && med.note && (
          <g transform="rotate(-2 100 170)">
            <rect x="60" y="167" width="80" height="14" rx="2" fill={med.noteColor || "#ffd84d"} stroke={INK} strokeWidth="1.2" />
            <text x="100" y="176.5" textAnchor="middle" className="mc-warn">{cap(med.note, 20).toUpperCase()}</text>
          </g>
        )}
        {!mini && med.rx && <text x="62" y="193" className="mc-tiny">Rx# {cap(String(med.rx), 14)}</text>}
        {!mini && refills != null && <text x="62" y="201" className="mc-tiny">REFILLS: {refills}</text>}
        {low && (
          <g transform="rotate(-10 124 190)">
            <rect x="104" y="184" width="40" height="13" rx="2" fill="#fffdf6" fillOpacity=".9" stroke="#c0392b" strokeWidth="1.6" />
            <text x="124" y="193.2" textAnchor="middle" className="mc-stamp sm">REFILL SOON</text>
          </g>
        )}
        <rect x="56" y="90" width="88" height="116" fill={`url(#w${id})`} pointerEvents="none" />
      </g>
      {/* child-proof cap: white, with ridges, lifts and turns off */}
      <g className="mc-cap">
        <rect x="46" y="22" width="108" height="46" rx="9" fill="#fbfaf5" stroke={INK} strokeWidth="3" />
        {Array.from({ length: 13 }, (_, i) => (
          <path key={i} d={`M${58 + i * 7.8} 30V60`} stroke="#d4cdc0" strokeWidth="2.4" />
        ))}
        <path d="M46 58H154" stroke={INK} strokeOpacity=".2" strokeWidth="1.5" />
        <rect x="52" y="26" width="96" height="5" rx="2.5" fill="#fff" />
      </g>
      <g className="mc-drop"><Pill x={100} y={78} s={7} shape={pill.shape} color={pill.color} color2={pill.color2} /></g>
    </>
  );
}

// ── glass vial with a rubber stopper and a crimped cap ─────────────────────
function Vial({ med, mini, id, go }) {
  const f = fillOf(med) ?? 0.7;
  const top = 216 - 6 - f * 106;
  const body = "M62 108Q62 94 76 90V76H124V90Q138 94 138 108V204Q138 218 124 218H76Q62 218 62 204Z";
  const dir = wrap(med.directions, 12, 2);
  return (
    <>
      <defs>
        <clipPath id={`v${id}`}><path d={body} /></clipPath>
      </defs>
      <Ground rx={52} />
      <path d={body} transform="translate(5 5)" fill={INK} />
      <path d={body} fill="#eaf6fb" />
      <g clipPath={`url(#v${id})`}>
        <g className="mc-liquid" style={{ transform: `translateY(${top}px)` }}>
          <rect x="56" y="0" width="90" height="140" className="t-fill" opacity=".85" />
          <path d="M56 0Q70 -5 82 0T108 0T134 0T160 0V6H56Z" className="t-light" />
        </g>
        {go && [0, 1, 2].map((i) => <circle key={i} className="mc-bub" cx={82 + i * 18} cy={200} r={3 + i} style={{ animationDelay: `${i * 0.18}s` }} />)}
      </g>
      <path d={body} fill="none" stroke={INK} strokeWidth="3" strokeLinejoin="round" />
      <rect x="68" y="104" width="6" height="96" rx="3" fill="#fff" opacity=".7" />
      {[0, 1, 2, 3, 4].map((i) => (
        <path key={i} d={`M132 ${112 + i * 20}h${i % 2 ? 4 : 7}`} stroke={INK} strokeWidth="1.5" opacity=".5" />
      ))}
      {/* paper label */}
      <rect x="72" y="128" width="56" height="66" rx="2" fill="#fffdf6" stroke={INK} strokeWidth="1.8" />
      <text x="76" y="141" className="mc-name sm" {...fit(nameOf(med), 8, 48)}>{nameOf(med)}</text>
      {med.strength && <text x="76" y="150" className="mc-line sm" {...fit(med.strength, 7, 48)}>{cap(med.strength, 24)}</text>}
      {!mini && dir.map((l, i) => <text key={i} x="76" y={160 + i * 7.5} className="mc-line xs">{l}</text>)}
      {!mini && med.note && <rect x="76" y="178" width="48" height="8" rx="2" fill={med.noteColor || "#ffd84d"} stroke={INK} strokeWidth="1" />}
      {/* rubber stopper, crimped collar, flip-off disc */}
      <rect x="82" y="64" width="36" height="14" rx="3" fill="#6d6a68" stroke={INK} strokeWidth="2.5" />
      <rect x="66" y="70" width="68" height="22" rx="4" fill="#cfd3d6" stroke={INK} strokeWidth="3" />
      {Array.from({ length: 9 }, (_, i) => <path key={i} d={`M${73 + i * 6.8} 75V88`} stroke={INK} strokeOpacity=".3" strokeWidth="1.6" />)}
      <g className="mc-cap">
        <rect x="78" y="56" width="44" height="12" rx="5" fill={FLIP[(med.name || "").length % FLIP.length]} stroke={INK} strokeWidth="2.5" />
        <rect x="84" y="59" width="18" height="3" rx="1.5" fill="#fff" opacity=".7" />
      </g>
    </>
  );
}

// ── syringe: barrel with ticks, plunger you press ──────────────────────────
function Syringe({ med, id }) {
  const f = fillOf(med) ?? 0.75;
  const x0 = 64 + f * 54; // where the stopper rests: further out = more in it
  const travel = x0 - 66;
  return (
    <>
      <Ground rx={64} cy={200} />
      <g transform="translate(100 112) rotate(-38) scale(1.12) translate(-100 -130)">
        <path d="M22 130H46" stroke={INK} strokeWidth="3" strokeLinecap="round" />
        <path d="M22 130H46" stroke="#e8e4dc" strokeWidth="1" strokeLinecap="round" />
        <path d="M46 125L60 118V142L46 135Z" fill="#e8f0f6" stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
        <rect x="60" y="116" width="84" height="28" rx="4" className="mc-glass" stroke={INK} strokeWidth="3" />
        <g className="mc-syr" style={{ "--travel": `${-travel}px` }}>
          <rect className="mc-syr-liq t-fill" x="62" y="118" width={x0 - 62} height="24" opacity=".9" style={{ "--k": 5 / (x0 - 62) }} />
          <g className="mc-syr-pl">
            <rect x={x0} y="118" width="10" height="24" rx="2" fill="#4b4642" stroke={INK} strokeWidth="2" />
            <rect x={x0 + 10} y="127" width="70" height="6" fill="#f4f1ea" stroke={INK} strokeWidth="2.2" />
            <rect x={x0 + 10} y="119" width="70" height="22" rx="1" fill="#f4f1ea" stroke={INK} strokeWidth="2" opacity=".0" />
            <rect x={x0 + 78} y="112" width="7" height="36" rx="3.5" fill="#f4f1ea" stroke={INK} strokeWidth="2.5" />
          </g>
        </g>
        {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => (
          <path key={i} d={`M${68 + i * 7.4} 144v${i % 2 ? -5 : -9}`} stroke={INK} strokeWidth="1.6" />
        ))}
        <rect x="142" y="104" width="7" height="52" rx="3" fill="#f4f1ea" stroke={INK} strokeWidth="2.5" />
        <path d="M66 120H100" stroke="#fff" strokeWidth="3" strokeLinecap="round" opacity=".7" />
        <path className="mc-sdrop" d="M20 134q-3 5 0 7q3 -2 0 -7z" />
      </g>
    </>
  );
}

// ── pen injector: cap slides off, dial and button clicks in ────────────────
function Pen({ med }) {
  return (
    <>
      <Ground rx={64} cy={196} />
      <g transform="translate(100 116) rotate(-34) scale(0.98) translate(-100 -130)">
        <path d="M14 130H40" stroke={INK} strokeWidth="3" strokeLinecap="round" />
        <path d="M14 130H40" stroke="#e8e4dc" strokeWidth="1" strokeLinecap="round" />
        <rect x="38" y="112" width="112" height="36" rx="13" className="t-fill" stroke={INK} strokeWidth="3" />
        <rect x="46" y="116" width="96" height="6" rx="3" fill="#fff" opacity=".35" />
        <rect x="84" y="120" width="46" height="20" rx="3" fill="#fffdf6" stroke={INK} strokeWidth="2" />
        {Array.from({ length: 9 }, (_, i) => <path key={i} d={`M${89 + i * 5} 140v${i % 2 ? -4 : -7}`} stroke={INK} strokeWidth="1.2" />)}
        <path d="M108 120V133" stroke="#d9534f" strokeWidth="2.4" strokeLinecap="round" />
        <path d="M44 130h28" stroke="#fff" strokeWidth="1.5" opacity=".6" />
        <g className="mc-penbtn">
          <rect x="150" y="105" width="22" height="50" rx="7" className="t-dark" stroke={INK} strokeWidth="3" />
          {[0, 1, 2, 3].map((i) => <path key={i} d={`M${155 + i * 4} 110V150`} stroke="#fff" strokeOpacity=".35" strokeWidth="1.5" />)}
          <rect x="172" y="118" width="12" height="24" rx="4" fill="#f4f1ea" stroke={INK} strokeWidth="2.5" />
        </g>
        <g className="mc-cap">
          <rect x="6" y="105" width="44" height="50" rx="9" className="t-dark" stroke={INK} strokeWidth="3" />
          <rect x="12" y="98" width="30" height="8" rx="3" fill="#f4f1ea" stroke={INK} strokeWidth="2.2" />
          <rect x="12" y="110" width="3" height="40" rx="1.5" fill="#fff" opacity=".4" />
        </g>
        <path className="mc-sdrop" d="M12 134q-3 5 0 7q3 -2 0 -7z" />
      </g>
    </>
  );
}

// ── foil blister pack: pop a bubble ────────────────────────────────────────
function Blister({ med, pill, go, mini }) {
  const s = supplyInfo(med);
  const total = Math.max(4, Math.min(28, Math.round(s?.full || s?.left || 14)));
  const gone = Math.max(0, Math.min(total, total - Math.round(s?.left ?? total)));
  const was = useRef(gone);
  if (!go) was.current = gone; // the bubble that's popping stays put while the count changes
  const cols = 7;
  const rows = Math.ceil(total / cols);
  const H = 44 + rows * 27;
  const y0 = 126 - H / 2;
  const jag = (cx, cy) =>
    Array.from({ length: 14 }, (_, i) => {
      const a = (i / 14) * Math.PI * 2;
      const r = [13.5, 9.5, 11.5, 9, 14, 9.5, 12, 9, 13, 9.5, 11, 9, 14.5, 9.5][i];
      return `${(cx + Math.cos(a) * r).toFixed(1)},${(cy + Math.sin(a) * r * 1.05).toFixed(1)}`;
    }).join(" ");
  return (
    <>
      <Ground rx={78} />
      <rect x="19" y={y0 + 5} width="172" height={H} rx="12" fill={INK} />
      <rect x="14" y={y0} width="172" height={H} rx="12" className="mc-foil" stroke={INK} strokeWidth="3" />
      <path d={`M24 ${y0 + 12}l30 -4M120 ${y0 + H - 12}l50 -3M30 ${y0 + H - 18}l14 -8`} stroke="#fff" strokeOpacity=".7" strokeWidth="2" />
      {!mini && cols === 7 && ["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
        <text key={i} x={34 + i * 22} y={y0 + 16} textAnchor="middle" className="mc-tiny">{d}</text>
      ))}
      {Array.from({ length: total }, (_, i) => {
        const cx = 34 + (i % cols) * 22;
        const cy = y0 + 38 + Math.floor(i / cols) * 27;
        const popped = i < gone;
        const popping = go && i === was.current;
        return popped ? (
          <g key={i}>
            <polygon points={jag(cx, cy)} className="mc-tear" stroke={INK} strokeWidth="1.1" strokeLinejoin="round" />
            <ellipse cx={cx} cy={cy} rx="8" ry="9" fill="#6a5b4d" stroke={INK} strokeWidth="1.4" />
            <ellipse cx={cx - 2} cy={cy - 2} rx="3" ry="4" fill="#85766a" />
          </g>
        ) : (
          <g key={i} className={popping ? "mc-bubble popping" : "mc-bubble"}>
            <ellipse cx={cx} cy={cy} rx="10" ry="11.5" className="mc-dome" stroke={INK} strokeWidth="2.2" />
            <Pill x={cx} y={cy} s={3.9} shape={pill.shape} color={pill.color} color2={pill.color2} rot={pill.shape === "round" ? 0 : (i % 2 ? -28 : 20)} />
            <path d={`M${cx - 6} ${cy - 6}Q${cx - 3} ${cy - 10} ${cx + 1} ${cy - 9}`} stroke="#fff" strokeWidth="2" fill="none" strokeLinecap="round" />
          </g>
        );
      })}
      {!mini && <text x="100" y={y0 + H - 8} textAnchor="middle" className="mc-foiltxt">{nameOf(med, 18)}{med.strength ? ` ${cap(med.strength, 8).toUpperCase()}` : ""}</text>}
    </>
  );
}

// ── weekly organizer: seven lids, today's flips open ───────────────────────
function Organizer({ med, pill, week, go }) {
  const days = week ?? Array.from({ length: 7 }, (_, i) => ({ open: false, today: i === new Date().getDay() }));
  return (
    <>
      <Ground rx={86} />
      <rect x="15" y="80" width="180" height="136" rx="14" fill={INK} />
      <rect x="10" y="75" width="180" height="136" rx="14" className="t-light" stroke={INK} strokeWidth="3" />
      {days.map((d, i) => {
        const x = 17 + i * 24.6;
        const open = d.open || (d.today && go);
        return (
          <g key={i}>
            <rect x={x} y="88" width="22" height="112" rx="4" fill="#f1e8d6" stroke={INK} strokeWidth="1.6" />
            <rect x={x + 1} y="89" width="20" height="10" rx="3" fill="#2a2520" opacity=".16" />
            {!d.open && !(d.today && go) && (
              <g>
                <Pill x={x + 11} y="176" s={3.4} shape={pill.shape} color={pill.color} color2={pill.color2} rot={20} />
                {(med.times?.length ?? 1) > 1 && <Pill x={x + 11} y="158" s={3.4} shape={pill.shape} color={pill.color} color2={pill.color2} rot={-30} />}
              </g>
            )}
            {d.today && go && <g className="mc-out"><Pill x={x + 11} y="150" s={3.6} shape={pill.shape} color={pill.color} color2={pill.color2} rot={30} /></g>}
            <g className={`mc-lid${open ? " open" : ""}${d.today ? " today" : ""}`}>
              <rect x={x} y="86" width="22" height="116" rx="5" className="t-fill" fillOpacity=".62" stroke={INK} strokeWidth="2.4" />
              <rect x={x + 3} y="90" width="3" height="104" rx="1.5" fill="#fff" opacity=".35" />
              <text x={x + 11} y="112" textAnchor="middle" className="mc-day">{["S", "M", "T", "W", "T", "F", "S"][i]}</text>
              <rect x={x + 6} y="188" width="10" height="5" rx="2.5" fill="#fff" stroke={INK} strokeWidth="1.2" />
            </g>
            {d.today && <path d={`M${x + 11} 74l-6 -10h12z`} fill="#d9534f" stroke={INK} strokeWidth="1.8" strokeLinejoin="round" />}
          </g>
        );
      })}
      <text x="100" y="64" textAnchor="middle" className="mc-hand">{cap(med.name || "this week", 22)}</text>
    </>
  );
}

// ── inhaler: press the can, a puff comes out ───────────────────────────────
function Inhaler({ med }) {
  const s = supplyInfo(med);
  return (
    <>
      <Ground rx={68} />
      <g className="mc-can">
        <rect x="80" y="34" width="30" height="56" rx="5" fill="#d7dbe0" stroke={INK} strokeWidth="3" />
        <rect x="80" y="52" width="30" height="16" className="t-fill" stroke={INK} strokeWidth="2" />
        <rect x="85" y="38" width="4" height="46" rx="2" fill="#fff" opacity=".7" />
      </g>
      <path d="M72 88Q72 78 82 78H110Q120 78 120 88V158H142Q154 158 154 170V194Q154 206 142 206H84Q72 206 72 194Z" transform="translate(5 5)" fill={INK} />
      <path d="M72 88Q72 78 82 78H110Q120 78 120 88V158H142Q154 158 154 170V194Q154 206 142 206H84Q72 206 72 194Z" className="t-fill" stroke={INK} strokeWidth="3" strokeLinejoin="round" />
      <path d="M78 92V150" stroke="#fff" strokeWidth="4" strokeLinecap="round" opacity=".35" />
      <rect x="82" y="112" width="30" height="24" rx="3" fill="#fffdf6" stroke={INK} strokeWidth="2" />
      <text x="97" y="129" textAnchor="middle" className="mc-counter">{s ? Math.round(s.left) : "--"}</text>
      <rect x="86" y="172" width="58" height="22" rx="4" fill="#fffdf6" opacity=".9" stroke={INK} strokeWidth="1.6" />
      <text x="115" y="187" textAnchor="middle" className="mc-name sm" {...fit(nameOf(med), 8, 50)}>{nameOf(med)}</text>
      <g className="mc-cap">
        <rect x="148" y="164" width="18" height="36" rx="5" className="t-dark" stroke={INK} strokeWidth="3" />
        <path d="M152 170V194" stroke="#fff" strokeOpacity=".35" strokeWidth="2" />
      </g>
      <g className="mc-puff">
        {[[166, 182, 7], [176, 174, 9], [178, 190, 8], [188, 182, 6]].map(([x, y, r], i) => <circle key={i} cx={x} cy={y} r={r} />)}
      </g>
    </>
  );
}

// ── squeeze dropper bottle, tip down, a drop falling ───────────────────────
function Dropper({ med, id }) {
  const f = fillOf(med) ?? 0.7;
  const body = "M64 46Q64 28 82 28H118Q136 28 136 46V128Q136 144 120 148L112 154H88L80 148Q64 144 64 128Z";
  return (
    <>
      <defs><clipPath id={`d${id}`}><path d={body} /></clipPath></defs>
      <Ground rx={46} cy={218} />
      <g transform="translate(0 -14) rotate(-8 100 110)">
        <g className="mc-squeeze">
          <path d={body} transform="translate(5 5)" fill={INK} />
          <path d={body} className="mc-glass" stroke={INK} strokeWidth="3" />
          <g clipPath={`url(#d${id})`}>
            <rect x="60" y={150 - f * 112} width="80" height="130" className="t-fill" opacity=".78" />
            <rect x="60" y={150 - f * 112} width="80" height="4" fill="#fff" opacity=".5" />
          </g>
          <path d={body} fill="none" stroke={INK} strokeWidth="3" strokeLinejoin="round" />
          <rect x="70" y="40" width="6" height="84" rx="3" fill="#fff" opacity=".6" />
          <rect x="78" y="62" width="52" height="56" rx="3" fill="#fffdf6" stroke={INK} strokeWidth="1.8" />
          <text x="82" y="77" className="mc-name sm" {...fit(nameOf(med), 8, 44)}>{nameOf(med)}</text>
          {med.strength && <text x="82" y="87" className="mc-line sm" {...fit(med.strength, 7, 44)}>{cap(med.strength, 20)}</text>}
          {wrap(med.directions, 11, 3).map((l, i) => <text key={i} x="82" y={97 + i * 7.5} className="mc-line xs">{l}</text>)}
        </g>
        <path d="M86 150H114L108 172H92Z" fill="#fbfaf5" stroke={INK} strokeWidth="2.6" strokeLinejoin="round" />
        <path className="mc-dropper-drop" d="M100 172q-6 10 0 16q6 -6 0 -16z" />
        <g className="mc-cap">
          <path d="M84 148H116L108 196Q100 204 92 196Z" className="t-fill" stroke={INK} strokeWidth="3" strokeLinejoin="round" />
          <path d="M92 156l3 34" stroke="#fff" strokeOpacity=".5" strokeWidth="2.4" strokeLinecap="round" />
        </g>
      </g>
    </>
  );
}

// ── squeezy tube with a crimped end and a cap ──────────────────────────────
function Tube({ med }) {
  return (
    <>
      <Ground rx={52} />
      <g transform="rotate(-6 100 120)">
        <path d="M66 44H138L146 154Q146 168 130 170H114V184H86V170H70Q54 168 58 154Z" transform="translate(5 5)" fill={INK} />
        <path d="M66 44H138L146 154Q146 168 130 170H114V184H86V170H70Q54 168 58 154Z" className="t-fill" stroke={INK} strokeWidth="3" strokeLinejoin="round" />
        <path d="M70 48L66 150" stroke="#fff" strokeWidth="4" strokeLinecap="round" opacity=".35" />
        <rect x="66" y="30" width="72" height="16" rx="2" className="t-dark" stroke={INK} strokeWidth="3" />
        {Array.from({ length: 12 }, (_, i) => <path key={i} d={`M${72 + i * 5.4} 33V43`} stroke="#fff" strokeOpacity=".4" strokeWidth="1.6" />)}
        <path d="M62 112H144L146 154Q146 168 130 170H70Q54 168 58 154Z" fill="#fffdf6" opacity=".92" stroke={INK} strokeWidth="2" strokeLinejoin="round" />
        <path d="M60 126H146" stroke="#fff" strokeOpacity="0" />
        <text x="101" y="128" textAnchor="middle" className="mc-name" {...fit(nameOf(med), 10, 76)}>{nameOf(med)}</text>
        {med.strength && <text x="101" y="140" textAnchor="middle" className="mc-line sm" {...fit(med.strength, 7, 76)}>{cap(med.strength, 24)}</text>}
        {wrap(med.directions, 18, 1).map((l, i) => <text key={i} x="101" y="152" textAnchor="middle" className="mc-line xs">{l}</text>)}
        <path className="mc-cream" d="M100 184C84 186 86 196 100 196C84 198 90 208 104 206C92 212 100 220 108 218" />
        <g className="mc-cap">
          <path d="M84 168H116V198Q116 204 110 204H90Q84 204 84 198Z" className="t-dark" stroke={INK} strokeWidth="3" strokeLinejoin="round" />
          {[0, 1, 2, 3, 4].map((i) => <path key={i} d={`M${89 + i * 5.5} 174V198`} stroke="#fff" strokeOpacity=".35" strokeWidth="1.6" />)}
        </g>
      </g>
    </>
  );
}

// ── plain jar for vitamins and supplements ─────────────────────────────────
function Jar({ med, pill, id }) {
  const body = "M54 100Q54 88 66 88H134Q146 88 146 100V196Q146 216 126 216H74Q54 216 54 196Z";
  return (
    <>
      <defs><clipPath id={`j${id}`}><path d={body} /></clipPath></defs>
      <Ground />
      <path d={body} transform="translate(5 5)" fill={INK} />
      <path d={body} className="mc-glass" />
      <g clipPath={`url(#j${id})`}>
        {[[72, 204, 10], [98, 208, -20], [124, 204, 40], [84, 190, -50], [112, 192, 15], [136, 192, -30], [66, 176, 30], [94, 178, 60], [122, 178, -10], [78, 164, 0], [106, 164, 35], [132, 164, -40]].map(([x, y, r], i) => (
          <Pill key={i} x={x} y={y} s={5} shape={pill.shape} color={pill.color} color2={pill.color2} rot={r} />
        ))}
      </g>
      <path d={body} fill="none" stroke={INK} strokeWidth="3" strokeLinejoin="round" />
      <rect x="54" y="118" width="92" height="56" className="t-fill" stroke={INK} strokeWidth="2.4" />
      <rect x="62" y="126" width="76" height="40" rx="3" fill="#fffdf6" stroke={INK} strokeWidth="1.8" />
      <text x="100" y="142" textAnchor="middle" className="mc-name" {...fit(nameOf(med), 10, 68)}>{nameOf(med)}</text>
      <text x="100" y="153" textAnchor="middle" className="mc-line sm" {...fit(med.strength || "", 7, 68)}>{cap(med.strength || "", 24)}</text>
      {wrap(med.directions, 18, 1).map((l, i) => <text key={i} x="100" y="162" textAnchor="middle" className="mc-line xs">{l}</text>)}
      <rect x="62" y="96" width="5" height="76" rx="2.5" fill="#fff" opacity=".45" />
      <g className="mc-drop"><Pill x={100} y={90} s={7} shape={pill.shape} color={pill.color} color2={pill.color2} /></g>
      <g className="mc-cap">
        <rect x="48" y="52" width="104" height="40" rx="9" className="t-fill" stroke={INK} strokeWidth="3" />
        {Array.from({ length: 12 }, (_, i) => <path key={i} d={`M${60 + i * 7.6} 58V86`} stroke={INK} strokeOpacity=".28" strokeWidth="2.2" />)}
        <rect x="54" y="56" width="92" height="5" rx="2.5" fill="#fff" opacity=".5" />
      </g>
    </>
  );
}

const DRAW = {
  bottle: Bottle,
  vial: Vial,
  syringe: Syringe,
  pen: Pen,
  blister: Blister,
  organizer: Organizer,
  inhaler: Inhaler,
  dropper: Dropper,
  tube: Tube,
  jar: Jar,
};
