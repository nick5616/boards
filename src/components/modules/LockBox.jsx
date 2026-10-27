import { useState } from "react";
import { MODULES } from "../../constants/modules";
import { pinHash, setOpen, isOpen, useCover } from "../../lib/lockbox";

// What a covered module shows instead of its contents: a closed metal box.
// (ModuleFrame, the big sheet, Window and Spotlight all use this; see lib/lockbox.)
export function Covered() {
  return (
    <div className="lb-cover" role="img" aria-label="Locked">
      <PadlockArt shut small />
      <b>locked</b>
      <span>open its lock box to see inside</span>
    </div>
  );
}

// A steel padlock. shut = shackle down; small = the little one for covers.
function PadlockArt({ shut, small, jiggle }) {
  return (
    <svg className={`lb-pad${small ? " small" : ""}${jiggle ? " jiggle" : ""}`} viewBox="0 0 100 120" aria-hidden="true">
      <defs>
        <linearGradient id="lb-steel" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#eceae4" />
          <stop offset="0.45" stopColor="#a8a49c" />
          <stop offset="1" stopColor="#5f5b55" />
        </linearGradient>
        <linearGradient id="lb-brass" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f4d58a" />
          <stop offset="1" stopColor="#a67a2b" />
        </linearGradient>
      </defs>
      {/* the shackle: down when shut, swung up and open when not */}
      <g className="lb-shackle" style={{ transform: shut ? "none" : "translate(0, -14px) rotate(-18deg)", transformOrigin: "30px 54px" }}>
        <path d="M30 56 V36 A20 20 0 0 1 70 36 V56" fill="none" stroke="#2a2724" strokeWidth="13" strokeLinecap="round" />
        <path d="M30 56 V36 A20 20 0 0 1 70 36 V56" fill="none" stroke="url(#lb-steel)" strokeWidth="8.5" strokeLinecap="round" />
      </g>
      <rect x="12" y="52" width="76" height="60" rx="10" fill="url(#lb-steel)" stroke="#2a2724" strokeWidth="3" />
      <rect x="18" y="58" width="64" height="48" rx="6" fill="none" stroke="#fff" strokeOpacity="0.45" strokeWidth="1.5" />
      <circle cx="21" cy="65" r="2.4" fill="#4a4641" />
      <circle cx="79" cy="65" r="2.4" fill="#4a4641" />
      <circle cx="21" cy="99" r="2.4" fill="#4a4641" />
      <circle cx="79" cy="99" r="2.4" fill="#4a4641" />
      {/* keyhole on a brass plate */}
      <circle cx="50" cy="80" r="13" fill="url(#lb-brass)" stroke="#5a3f10" strokeWidth="2" />
      <circle cx="50" cy="77" r="4.6" fill="#1c1a18" />
      <path d="M47.6 79 L52.4 79 L53.8 90 L46.2 90 Z" fill="#1c1a18" />
    </svg>
  );
}

// A four-digit pad, like the Diary's
function Pad({ onEnter }) {
  const [pin, setPin] = useState("");
  const [bad, setBad] = useState(false);
  const press = (d) => {
    const next = (pin + d).slice(0, 4);
    setPin(next);
    setBad(false);
    if (next.length === 4) {
      setTimeout(() => {
        if (!onEnter(next)) setBad(true);
        setPin("");
      }, 120);
    }
  };
  return (
    <div
      className={`pinpad lb-padkeys${bad ? " bad" : ""}`}
      tabIndex={0}
      onKeyDown={(e) => {
        if (/^\d$/.test(e.key)) press(e.key);
        if (e.key === "Backspace") setPin((p) => p.slice(0, -1));
      }}
    >
      <div className="pin-dots">
        {[0, 1, 2, 3].map((i) => <span key={i} className={i < pin.length ? "on" : ""} />)}
      </div>
      <div className="pin-keys">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "⌫"].map((k, i) =>
          k ? <button key={i} onClick={() => (k === "⌫" ? setPin((p) => p.slice(0, -1)) : press(k))}>{k}</button> : <span key={i} />
        )}
      </div>
    </div>
  );
}

// A padlock over other modules. The Diary's PIN idea, for anything on the board: pick what
// goes inside, set a PIN, lock it, and those modules turn into closed metal boxes.
// It keeps things from a glance over your shoulder. It is not encryption: the contents are
// stored and synced like everything else, and a closed box opens again when you reload.
export default function LockBox({ board, mod, setState }) {
  useCover(board, mod.id); // re-render when this box opens or shuts
  const { ids = [], pinHash: hashed = null } = mod.state;
  const open = isOpen(mod.id);
  const [setting, setSetting] = useState(false);
  const [pin, setPin] = useState("");
  const things = board.modules.filter((m) => m.id !== mod.id);
  const inside = ids.filter((id) => things.some((m) => m.id === id));

  const toggle = (id) => setState((s) => ({ ...s, ids: inside.includes(id) ? inside.filter((x) => x !== id) : [...inside, id] }));
  const savePin = () => {
    setState((s) => ({ ...s, pinHash: pinHash(mod, pin) }));
    setOpen(mod.id, true); // you just made it, so it starts open
    setSetting(false);
    setPin("");
  };

  // Shut, with a PIN: just the padlock and the pad
  if (hashed && !open) {
    return (
      <div className="lb">
        <PadlockArt shut />
        <div className="lb-sub">
          {inside.length} thing{inside.length === 1 ? "" : "s"} locked up
        </div>
        <Pad
          onEnter={(p) => {
            if (pinHash(mod, p) !== hashed) return false;
            setOpen(mod.id, true);
            return true;
          }}
        />
      </div>
    );
  }

  return (
    <div className="lb">
      <PadlockArt shut={false} />
      <div className="lb-sub">{hashed ? "open: what's inside shows" : "choose what goes inside, then set a PIN"}</div>
      <div className="lb-list">
        {things.length === 0 && <div className="lb-none">nothing else on this board yet</div>}
        {things.map((m) => (
          <label key={m.id} className="lb-row">
            <input type="checkbox" checked={inside.includes(m.id)} onChange={() => toggle(m.id)} />
            <span>{m.title}</span>
            <i>{MODULES[m.type].label}</i>
          </label>
        ))}
      </div>
      {setting ? (
        <div className="lb-pin">
          <input
            autoFocus
            className="line-input"
            inputMode="numeric"
            maxLength={4}
            placeholder="4 digits"
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
            onKeyDown={(e) => e.key === "Enter" && pin.length === 4 && savePin()}
          />
          <button className="mini-btn" disabled={pin.length !== 4} onClick={savePin}>set PIN</button>
          <button className="mini-btn ghost" onClick={() => { setSetting(false); setPin(""); }}>cancel</button>
        </div>
      ) : (
        <div className="lb-btns">
          {hashed ? (
            <>
              <button className="mini-btn" disabled={!inside.length} onClick={() => setOpen(mod.id, false)}>🔒 lock now</button>
              <button className="mini-btn ghost" onClick={() => setSetting(true)}>change PIN</button>
              <button className="mini-btn ghost" onClick={() => setState((s) => ({ ...s, pinHash: null }))}>remove PIN</button>
            </>
          ) : (
            <button className="mini-btn" disabled={!inside.length} onClick={() => setSetting(true)}>add a PIN</button>
          )}
        </div>
      )}
      <p className="lb-honest">Hides things from a glance at your screen. It isn't encryption: the contents are saved like everything else.</p>
    </div>
  );
}
