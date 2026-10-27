import { useEffect, useState } from "react";
import { MODULES, MODULE_KINDS, MODULE_TYPES } from "../../constants/modules";
import ModuleBadges from "./ModuleBadges";
import { capHint } from "../../lib/caps";
import { KEYS, apiKey, keyHint, setApiKey, useKeysChanged } from "../../lib/apis";
import { useLocalStorage } from "../../hooks/useLocalStorage";

const ROW = 5; // modules on a closed shelf (desktop; a phone scrolls the row sideways)

// The sheet of things you can slap onto a board, shelved by kind.
// nested = adding inside a folder, where controls don't go.
export default function ModuleTray({ onPick, onClose, nested = false }) {
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const kinds = MODULE_KINDS.filter((k) => !(nested && k.id === "control"));
  // There are a lot of modules now: typing narrows them by name and blurb
  const [q, setQ] = useState("");
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  const hit = (t) => {
    const hay = `${MODULES[t].label} ${MODULES[t].blurb} ${t}`.toLowerCase();
    return words.every((w) => hay.includes(w));
  };
  // Shelves are one row tall until opened, one at a time or all at once (remembered)
  const [allOpen, setAllOpen] = useLocalStorage("boards-tray-all", false);
  const [open, setOpen] = useState({});
  // A key pasted on a teaser card (or in Settings) unlocks it right away
  useKeysChanged();
  // keys a module can't start without get that module's own teaser card instead
  const needed = new Set(MODULE_TYPES.flatMap((t) => MODULES[t].keys ?? []));
  const locked = Object.keys(KEYS).filter((n) => KEYS[n].feature && !needed.has(n) && !apiKey(n)
    && words.every((w) => `${KEYS[n].feature} ${KEYS[n].label} ${KEYS[n].unlocks}`.toLowerCase().includes(w)));
  const unlockShut = !words.length && !(open.unlock ?? allOpen);

  return (
    <div className="overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal tray" role="dialog" aria-modal="true" aria-label="Add to board">
        <div className="modal-topbar">
          <div className="modal-handle" />
          <div className="modal-title">Slap something on</div>
          <button className="modal-x" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="tray-tools">
          <input
            className="tray-find"
            type="search"
            autoFocus={window.matchMedia("(min-width: 680px)").matches}
            placeholder="find a module…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label="Find a module"
          />
          <label className="tray-all">
            <input type="checkbox" checked={allOpen} onChange={(e) => { setAllOpen(e.target.checked); setOpen({}); }} />
            expand all
          </label>
        </div>
        <div className="tray-shelves">
          {kinds.map((k) => {
            const types = MODULE_TYPES.filter((t) => MODULES[t].kind === k.id && hit(t));
            if (!types.length) return null;
            // a shelf shows one row until it's opened; searching opens every shelf
            const shut = !words.length && !(open[k.id] ?? allOpen);
            return (
              <section key={k.id} className={`tray-shelf${shut ? " shut" : ""}`}>
                <button className="tray-kind" onClick={() => setOpen((o) => ({ ...o, [k.id]: shut }))} aria-expanded={!shut}>
                  <span>{k.label}</span>
                  <small>{shut && types.length > ROW ? `show all ${types.length}` : !words.length && types.length > ROW ? "show less" : types.length}</small>
                </button>
                <div className="tray-grid">
                  {types.map((t) => {
                    // Still shown when this browser can't do it, so you know it exists
                    const hint = capHint(MODULES[t].needs);
                    // Waiting on a key you haven't pasted: a darker teaser card to unlock it
                    const key = !hint && MODULES[t].keys?.find((n) => !apiKey(n));
                    if (key) {
                      return (
                        <div key={t} className="tray-item unlock">
                          <div className={`tray-art tray-art-${t}`} aria-hidden="true"><TrayArt type={t} /></div>
                          <div className="tray-label">{MODULES[t].label}</div>
                          <div className="tray-blurb">{keyHint(MODULES[t].keys)}</div>
                          <KeyRow name={key} />
                        </div>
                      );
                    }
                    return (
                      <button key={t} className={`tray-item${hint ? " cant" : ""}`} disabled={!!hint} title={hint ?? undefined} onClick={() => onPick(t)}>
                        <div className={`tray-art tray-art-${t}`} aria-hidden="true">
                          <TrayArt type={t} />
                        </div>
                        <div className="tray-label">
                          {MODULES[t].label}
                          <ModuleBadges type={t} />
                        </div>
                        <div className="tray-blurb">{hint ?? MODULES[t].blurb}</div>
                      </button>
                    );
                  })}
                </div>
              </section>
            );
          })}
          {locked.length > 0 && (
            <section className={`tray-shelf tray-unlocks${unlockShut ? " shut" : ""}`}>
              <button className="tray-kind" onClick={() => setOpen((o) => ({ ...o, unlock: unlockShut }))} aria-expanded={!unlockShut}>
                <span>Unlock with a free key</span>
                <small>{unlockShut && locked.length > ROW ? `show all ${locked.length}` : locked.length}</small>
              </button>
              <div className="tray-grid">
                {locked.map((n) => <UnlockTile key={n} name={n} />)}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

// A feature a free key would turn on: get the key, paste it here, and it's unlocked
function UnlockTile({ name }) {
  const k = KEYS[name];
  return (
    <div className="tray-item unlock">
      <div className={`tray-art ua-${name}`} aria-hidden="true"><UnlockArt name={name} /></div>
      <div className="tray-label">{k.feature}</div>
      <div className="tray-blurb">{k.unlocks}</div>
      <KeyRow name={name} />
    </div>
  );
}

// Get a key ↗ / paste it, on a teaser card
function KeyRow({ name }) {
  const k = KEYS[name];
  const [pasting, setPasting] = useState(false);
  const [draft, setDraft] = useState("");
  const save = () => draft.trim() && setApiKey(name, draft);
  return pasting ? (
    <div className="unlock-row">
      <input
        type="password"
        autoFocus
        autoComplete="off"
        spellCheck={false}
        placeholder={`${k.label} key`}
        aria-label={`Paste your ${k.label} key`}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") { e.stopPropagation(); setPasting(false); } }}
      />
      <button className="mini-btn" onClick={save} disabled={!draft.trim()}>save</button>
    </div>
  ) : (
    <div className="unlock-row">
      <a className="mini-btn ghost" href={k.get} target="_blank" rel="noreferrer">get a key ↗</a>
      <button className="mini-btn" onClick={() => setPasting(true)}>paste</button>
    </div>
  );
}

const ink = { fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round", strokeLinejoin: "round" };

function UnlockArt({ name }) {
  switch (name) {
    case "tmdb": // a clapperboard
      return (
        <svg viewBox="0 0 60 46" {...ink}>
          <rect x="10" y="18" width="40" height="24" rx="2" />
          <path d="M10 18l-1.5-8 39-6 1.5 8" />
          <path d="M17 9l5 7M27 7.5l5 7M37 6l5 7" />
          <path d="M18 27h24M18 33h16" />
        </svg>
      );
    case "rawg": // a boxed game with its cover
      return (
        <svg viewBox="0 0 60 46" {...ink}>
          <rect x="16" y="4" width="28" height="38" rx="2" />
          <rect x="20" y="9" width="20" height="18" rx="1" />
          <path d="M20 22l6-6 5 5 3-3 6 6" />
          <path d="M20 33h14M20 37h9" />
        </svg>
      );
    case "guardian": // a folded paper with the world on it
      return (
        <svg viewBox="0 0 60 46" {...ink}>
          <path d="M8 6h36v34H12a4 4 0 0 1-4-4z" />
          <path d="M44 14h8v22a4 4 0 0 1-8 0" />
          <path d="M13 12h26" />
          <circle cx="21" cy="26" r="7" />
          <path d="M14 26h14M21 19c-3 3-3 11 0 14M21 19c3 3 3 11 0 14" />
          <path d="M32 21h7M32 26h7M32 31h7" />
        </svg>
      );
    case "ebird": // a bird on a branch, with a pin for "near you"
      return (
        <svg viewBox="0 0 60 46" {...ink}>
          <path d="M6 38c14-4 30-4 48-2M34 37l4-6" />
          <path d="M14 30c0-8 6-13 13-13 3-5 9-6 12-2-3 0-4 2-4 4 0 8-6 13-14 13-4 0-7-1-7-2z" />
          <path d="M17 31l-6 4" />
          <circle cx="36" cy="17" r=".6" fill="currentColor" />
          <path d="M48 20c-3-4-5-6-5-9a5 5 0 0 1 10 0c0 3-2 5-5 9z" />
        </svg>
      );
    case "lastfm": // a record with the arm down, and how much it's played
      return (
        <svg viewBox="0 0 60 46" {...ink}>
          <circle cx="24" cy="24" r="17" />
          <circle cx="24" cy="24" r="10" />
          <circle cx="24" cy="24" r="2" />
          <path d="M50 6v10l-12 14" />
          <path d="M46 40v-4M50 40v-9M54 40v-6" />
        </svg>
      );
    default:
      return null;
  }
}

export function TrayArt({ type }) {
  switch (type) {
    case "clipping":
      return <div className="ta-clip"><i /><b>corset top</b><span>$22.99</span></div>;
    case "links":
      return <div className="ta-links"><i>corset top</i><i>hurt (video)</i></div>;
    case "folder":
      return <div className="ta-folder"><i>Maya</i><i>Jo</i><i>Sam</i><b /></div>;
    case "tracker":
      return <div className="ta-grid">{Array.from({ length: 12 }, (_, i) => <i key={i} className={[1, 2, 5, 8, 9].includes(i) ? "on" : ""} />)}</div>;
    case "nextup":
      return <div className="ta-sticky">next:<br />#7</div>;
    case "tickets":
      return <div className="ta-ticket"><b>NOV<br />4</b><span>concert</span></div>;
    case "wishlist":
      return <div className="ta-receipt">☐ strings<br />☐ tuner<br />☑ case</div>;
    case "diary":
      return <div className="ta-diary"><span /></div>;
    case "notes":
      return <div className="ta-notes">~~~~<br />~~~<br />~~~~~</div>;
    case "scrapbook":
      return <div className="ta-polaroid"><i /><i /></div>;
    case "timer":
      return <div className="ta-tomato"><span>20:00</span></div>;
    case "punchcard":
      return <div className="ta-punch">{Array.from({ length: 10 }, (_, i) => <i key={i} className={i < 6 ? "on" : ""} />)}</div>;
    case "flashcards":
      return <div className="ta-cards"><i /><i>el perro</i></div>;
    case "setlist":
      return <div className="ta-tape"><b /><span>A1 minuet ●●○</span></div>;
    case "graph":
      return (
        <div className="ta-graph">
          <svg viewBox="0 0 60 40"><polyline points="4,34 16,28 26,30 38,16 50,12 56,6" /></svg>
        </div>
      );
    case "tally":
      return (
        <div className="ta-chalk">
          <svg viewBox="0 0 60 30"><path d="M6 4v22M12 4v22M18 4v22M24 4v22M2 22L28 8M40 4v22M46 4v22" /></svg>
        </div>
      );
    case "jar":
      return <div className="ta-jar"><i /><i /><i /><i /><i /></div>;
    case "fortune":
      return <div className="ta-fortune">slow is smooth</div>;
    case "tuner":
      return <div className="ta-tuner"><i /><b /></div>;
    case "keys":
      return <div className="ta-keys">{Array.from({ length: 7 }, (_, i) => <i key={i} />)}<b style={{ left: 8 }} /><b style={{ left: 20 }} /><b style={{ left: 44 }} /><b style={{ left: 56 }} /><b style={{ left: 68 }} /></div>;
    case "metronome":
      return <div className="ta-metro"><i /><b /></div>;
    case "tape":
      return <div className="ta-reels"><i /><i /></div>;
    case "staff":
      return (
        <div className="ta-staff">
          <svg viewBox="0 0 60 36">
            <path d="M3 10h54M3 15h54M3 20h54M3 25h54M3 30h54" />
            <ellipse cx="18" cy="25" rx="3.4" ry="2.5" />
            <ellipse cx="34" cy="15" rx="3.4" ry="2.5" />
            <ellipse cx="48" cy="20" rx="3.4" ry="2.5" />
            <path d="M21 25V7M37 15V0M51 20V3" />
          </svg>
        </div>
      );
    case "magnets":
      return <div className="ta-mag"><i>sing</i><i>the</i><i>blues</i></div>;
    case "radio":
      return <div className="ta-radio"><i /><b /><span /></div>;
    case "mirror":
      return <div className="ta-mirror"><i /></div>;
    case "paintchips":
      return (
        <div className="ta-chips">
          {["#6b0f1f", "#c2244b", "#f2c4ce", "#4b1f45"].map((c, i) => <i key={c} style={{ background: c, "--r": `${(i - 1.5) * 9}deg` }} />)}
        </div>
      );
    case "window":
      return <div className="ta-window"><i /><b /></div>;
    case "photostrip":
      return <div className="ta-pstrip"><i /><i /><i /><i /></div>;
    case "books":
      return <div className="ta-books"><i /><i /><i /><i /><b /></div>;
    case "highlights":
      return <div className="ta-slips"><i>“slow is smooth”</i><i>p.42</i></div>;
    case "focus":
      return <div className="ta-focus"><i /><b>25:00</b></div>;
    case "syllabus":
      return <div className="ta-syl"><i>☑ ch 1</i><i>☑ ch 2</i><i>☐ ch 3</i><b /></div>;
    case "timelapse":
      return <div className="ta-tlapse"><i /><b /><span /></div>;
    case "recipe":
      return <div className="ta-recipe"><b>sourdough</b><i>500 g flour</i><i>375 g water</i><i>10 g salt</i></div>;
    case "bakes":
      return <div className="ta-bakes"><b /><span>75% country loaf</span></div>;
    case "patchbay":
      return <div className="ta-pbay"><i /><i /><i /><i /><svg viewBox="0 0 60 36"><path d="M13 10C16 34 44 34 47 26" /></svg></div>;
    case "gauges":
      return <div className="ta-gauge"><b /><i /></div>;
    case "shuffle":
      return <div className="ta-bag"><i /><b /></div>;
    case "spotlight":
      return <div className="ta-stage"><i /><i /><b /></div>;
    case "lockbox":
      return <div className="ta-lockbox"><i /><b /></div>;
    case "paperdoll":
      return (
        <div className="ta-pdoll">
          <svg viewBox="0 0 40 56" aria-hidden="true">
            <ellipse cx="20" cy="9" rx="4.4" ry="5.4" fill="#d9a77d" />
            <path d="M13 17h14l4 17H9z" fill="#c2244b" stroke="#6b0f1f" strokeWidth="1" strokeDasharray="2 1.4" />
            <path d="M16 34l-2 16h4l2-12 2 12h4l-2-16z" fill="#d9a77d" />
            <rect x="8" y="50" width="24" height="3.5" rx="1.5" fill="#c49a6c" stroke="#6e4f30" />
          </svg>
        </div>
      );
    case "closet":
      return (
        <div className="ta-closet">
          <b />
          <i style={{ "--c": "#6b0f1f" }} />
          <i style={{ "--c": "#2a2a2c" }} />
          <i style={{ "--c": "#e6dccb" }} />
        </div>
      );
    case "measure":
      return (
        <div className="ta-tapemeasure">
          <svg viewBox="0 0 70 46" aria-hidden="true">
            <path d="M30 14h38v10H35" fill="#f2d86b" stroke="#2a2520" strokeWidth="1.4" />
            <path d="M40 14v4M46 14v6M52 14v4M58 14v6M64 14v4" stroke="#2a2520" strokeWidth="1" />
            <circle cx="22" cy="26" r="17" fill="#f2d86b" stroke="#2a2520" strokeWidth="1.6" />
            <circle cx="22" cy="26" r="11" fill="none" stroke="#c9a92f" strokeWidth="1.4" />
            <circle cx="22" cy="26" r="5.5" fill="#faf8f5" stroke="#2a2520" strokeWidth="1.4" />
          </svg>
        </div>
      );
    case "route":
      return (
        <div className="ta-route">
          <svg viewBox="0 0 60 44"><path d="M8 34 C14 20 22 36 30 24 S44 10 52 12" /><circle cx="8" cy="34" r="2.6" /><circle cx="52" cy="12" r="2.6" /></svg>
        </div>
      );
    case "intervals":
      return <div className="ta-clipboard"><i /><span>6× run<br />1:00</span></div>;
    case "shoes":
      return (
        <div className="ta-shoes">
          <svg viewBox="0 0 60 34"><path d="M4 22 L4 12 Q4 8 9 8 L15 9 Q18 14 24 14 Q42 15 52 21 Q56 24 54 26 L4 26Z" /><path d="M3 26 H55 V30 H5Z" /></svg>
          <b><i>0</i><i>4</i><i>1</i><i>2</i></b>
        </div>
      );
    case "heartrate":
      return <div className="ta-heart"><svg viewBox="0 0 40 36"><path d="M20 33 C5 22 3 11 10 7 C15 4 19 8 20 12 C21 8 25 4 30 7 C37 11 35 22 20 33Z" /></svg></div>;
    case "drawers":
      return <div className="ta-drawers"><i><b /></i><i><b /></i><i><b /></i></div>;
    case "deck":
      return <div className="ta-deck"><i /><i /><i><b>♠</b></i></div>;
    case "routine":
      return <div className="ta-routine"><u /><span><em>✓</em>tune up</span><span><em>✓</em>scales</span><span><em /> pieces</span></div>;
    case "dayparts":
      return <div className="ta-dayparts"><i><b /><s /></i></div>;
    case "capsule":
      return <div className="ta-capsule"><i /><b>⏳</b></div>;
    case "split":
      return <div className="ta-split"><i /><u /><i /></div>;
    case "plants":
      return <div className="ta-plants"><i /><b /><span /></div>;
    case "garden":
      return <div className="ta-packet"><i /><b>frost<br />sow</b><span /></div>;
    case "propagate":
      return <div className="ta-prop"><i /><b /></div>;
    case "gesture":
      return <div className="ta-gest"><i><b /></i><span /><em /></div>;
    case "values":
      return <div className="ta-val">{[0, 1, 2, 3, 4].map((i) => <i key={i} style={{ background: `hsl(0 0% ${8 + i * 21}%)` }} />)}</div>;
    case "sketchbook":
      return (
        <div className="ta-skb">
          <span />
          <svg viewBox="0 0 40 30"><path d="M6 22c4-14 8-14 10-4s6 6 9-8 6 2 9 4" /></svg>
        </div>
      );
    case "typewriter":
      return <div className="ta-tw"><i>500<br />words</i><b><u /><u /><u /><u /></b></div>;
    case "corkboard":
      return (
        <div className="ta-cork">
          <i /><i />
          <svg viewBox="0 0 60 40"><path d="M17 10Q30 34 44 14" /></svg>
        </div>
      );
    case "chores":
      return (
        <div className="ta-wheel">
          <svg viewBox="0 0 60 66">
            <path d="M16 64 L30 30 L44 64" className="ta-wheel-leg" />
            <circle cx="30" cy="30" r="25" className="ta-wheel-rim" />
            {["#ffd6e0", "#ffe9a8", "#cfe8ff", "#d8f0b8", "#e6d4fa", "#ffd9b0"].map((c, i) => {
              const p = (a) => [30 + 22 * Math.sin((a * Math.PI) / 180), 30 - 22 * Math.cos((a * Math.PI) / 180)];
              const [x0, y0] = p(i * 60);
              const [x1, y1] = p(i * 60 + 60);
              return <path key={c} d={`M30 30 L${x0} ${y0} A22 22 0 0 1 ${x1} ${y1}Z`} fill={c} stroke="#2a2520" strokeWidth="1" />;
            })}
            <circle cx="30" cy="30" r="4" className="ta-wheel-hub" />
            <path d="M28 1 L32 1 L30.6 11 L29.4 11Z" className="ta-wheel-flap" />
          </svg>
        </div>
      );
    case "groceries":
      return <div className="ta-grocery"><b>AISLE 1</b>2× eggs<br /><s>milk</s><br />basil</div>;
    case "piggy":
      return (
        <div className="ta-piggy">
          <svg viewBox="0 0 70 50">
            <path d="M14 36 h6 v8 h-6z M44 36 h6 v8 h-6z" className="ta-pig-leg" />
            <path d="M12 26 C12 14 22 8 34 8 C46 8 54 15 54 26 C54 36 46 42 38 42 L24 42 C17 42 12 35 12 26Z" className="ta-pig-body" />
            <ellipse cx="34" cy="38" rx="16" ry="3.4" className="ta-pig-coin" />
            <ellipse cx="30" cy="34" rx="10" ry="3" className="ta-pig-coin" />
            <ellipse cx="57" cy="26" rx="5" ry="6.5" className="ta-pig-snout" />
            <circle cx="49" cy="20" r="1.6" fill="#2a2520" />
            <path d="M30 9 h10" className="ta-pig-slot" />
          </svg>
        </div>
      );
    case "dice":
      return (
        <div className="ta-dice">
          <svg viewBox="0 0 70 50">
            <rect x="6" y="14" width="26" height="26" rx="6" fill="#ff5d8f" stroke="#2a2520" strokeWidth="2" transform="rotate(-12 19 27)" />
            <g fill="#fff" transform="rotate(-12 19 27)"><circle cx="13" cy="21" r="2.2" /><circle cx="19" cy="27" r="2.2" /><circle cx="25" cy="33" r="2.2" /></g>
            <polygon points="48,6 64,34 32,34" fill="#ffc933" stroke="#2a2520" strokeWidth="2" strokeLinejoin="round" transform="translate(4 8) scale(.9)" />
            <text x="52" y="38" textAnchor="middle" fontSize="11" fontWeight="700" fill="#2a2520">20</text>
          </svg>
        </div>
      );
    case "initiative":
      return <div className="ta-init"><i><b>18</b>Mira</i><i className="here"><b>14</b>Goblin</i><i><b>7</b>Dorn</i></div>;
    case "meds":
      return <div className="ta-meds"><i><u /></i><b /><s /></div>;
    case "wordday":
      return <div className="ta-wd"><i /><b>14</b><u>word</u></div>;
    case "phrasebook":
      return <div className="ta-pb"><b>¿Hola?</b><i /></div>;
    case "kanji":
      return <div className="ta-kj"><b>字</b></div>;
    case "poems":
      return <div className="ta-po"><i /><b>♥</b></div>;
    // @pack:words
    case "lyrics":
      return <div className="ta-lyrics"><i /><i className="now" /><i /><i /></div>;
    case "crate":
      return <div className="ta-crate"><s /><s /><s /><u /></div>;
    case "scrobbles":
      return <div className="ta-scrobbles"><i /><b /></div>;
    case "chords":
      return <div className="ta-chords"><i /><i /><i /><i /></div>;
    // @pack:music
    case "tvguide":
      return <div className="ta-tvguide"><b /><i /><i /><i /></div>;
    case "paperback":
      return <div className="ta-paperback"><b /><i /></div>;
    case "backlog":
      return <div className="ta-backlog"><b /><i /></div>;
    // @pack:screen
    case "chesspuzzle":
      return <div className="ta-chz"><i /><i /><i /><i /><i /><i /><i /><i /><b>♞&#xFE0E;</b></div>;
    case "trivia":
      return <div className="ta-triv"><span><u /><u /><u /><u /></span><b>?</b><em /></div>;
    case "rabbithole":
      return <div className="ta-rab"><i>Owl</i><i>Moon</i><i>Tide</i></div>;
    case "almanac":
      return <div className="ta-alm"><u /><span>OCT</span><b>26</b><em>🌖</em></div>;
    // @pack:games
    case "barometer":
      return <div className="ta-baro"><i /><b /><span /></div>;
    case "stargazer":
      return <div className="ta-starwheel"><i /><b /><u /><s /></div>;
    case "fieldguide":
      return <div className="ta-guide"><i /><b>🐦</b></div>;
    case "tides":
      return <div className="ta-tide"><i /><b /></div>;
    // @pack:sky
    case "passport":
      return <div className="ta-passport"><i /><b /></div>;
    case "wallet":
      return <div className="ta-wallet"><i /><b /></div>;
    case "daysoff":
      return <div className="ta-daysoff"><i /></div>;
    case "errands":
      return <div className="ta-errands"><i /><b /></div>;
    // @pack:travel
    case "pantry":
      return <div className="ta-pantry"><i className="can"><u /></i><i className="jar"><u /></i><i className="can soon"><u /></i></div>;
    case "recipetin":
      return <div className="ta-rtin"><i /><i /><b>RECIPES</b></div>;
    case "barcart":
      return <div className="ta-bcart"><i className="b1" /><i className="b2" /><i className="b3" /><s /></div>;
    case "postcards":
      return <div className="ta-pcard"><i /><i /><i /></div>;
    // @pack:kitchen
    case "catalog":
      return <div className="ta-catl"><i><u /></i><i><u /></i><i><u /></i></div>;
    case "paper":
      return <div className="ta-news"><b>NEWS</b><i /><i /><i /></div>;
    case "lifting":
      return <div className="ta-lift"><s /><i /><i /><i /><u /></div>;
    case "worldclock":
      return <div className="ta-wclk"><i /><i /></div>;
    // @pack:desk
    case "practiceroom":
      return <div className="ta-prac"><i /><i /><i /><i /></div>;
    case "drawit":
      return (
        <div className="ta-chalk">
          <svg viewBox="0 0 60 30"><path d="M8 22C14 6 22 6 26 16S36 26 42 10M46 22l6-8" /></svg>
        </div>
      );
    case "flipbook":
      return <div className="ta-flb"><i /><b /><i /></div>;
    case "pictochat":
      return <div className="ta-flb ta-pch"><i /><b /><i /></div>;
    // @pack:live
    case "markdown":
      return <div className="ta-md"><b>#</b><i /><i /><u /></div>;
    case "soundbox":
      return <div className="ta-sb"><b /><i /></div>;
    case "checklist":
      return <div className="ta-ckl"><i /><i /><i /></div>;
    case "frame":
      return <div className="ta-pf"><i /></div>;
    case "kanban":
      return <div className="ta-kb"><i><b /><b /></i><i><b /></i><i><b /></i></div>;
    // @pack:media
    default:
      return null;
  }
}
