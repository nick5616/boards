import { useState } from "react";
import { useData } from "../../contexts/DataContext";
import { addEntry, deleteEntry } from "../../lib/data";
import { prettyDate, agoLabel } from "../../utils/date";
import { hash } from "../Sticker";
import EntryText from "./EntryText";

// The PIN keeps a diary closed to someone glancing at your screen. It is not
// encryption: the entries are stored like everything else.
const pinHash = (mod, pin) => String(hash(`${mod.id}:${pin}`));
const unlocked = new Set(); // module ids opened during this visit

export default function Diary({ board, mod, setState, entries, expanded, openBig }) {
  const { uid } = useData();
  const [, rerender] = useState(0);
  const mine = entries.filter((e) => e.kind === "diary" && (e.moduleId === mod.id || !e.moduleId));
  const locked = !!mod.state.pinHash && !unlocked.has(mod.id);

  if (!expanded) {
    return (
      <button className="diary-cover" onClick={openBig} aria-label={`Open ${mod.title}`}>
        <span className="diary-label">{mod.title}</span>
        <span className="diary-meta">
          {mine.length} entr{mine.length === 1 ? "y" : "ies"}
          {mine[0] && <><br />last {agoLabel(mine[0].at)}</>}
        </span>
        <span className={`diary-clasp${mod.state.pinHash ? " pin" : ""}`}>{mod.state.pinHash ? "🔒" : ""}</span>
      </button>
    );
  }

  if (locked) {
    return (
      <PinPad
        onEnter={(pin) => {
          if (pinHash(mod, pin) !== mod.state.pinHash) return false;
          unlocked.add(mod.id);
          rerender((n) => n + 1);
          return true;
        }}
      />
    );
  }

  return (
    <div className="diary-open">
      <Composer onSave={(text) => addEntry(uid, { kind: "diary", boardId: board.id, moduleId: mod.id, text })} />
      {mine.map((e) => (
        <div key={e.id} className="diary-entry">
          <div className="diary-date">
            {prettyDate(e.day)}
            <button
              className="x-btn"
              onClick={() => confirm("Tear out this page?") && deleteEntry(uid, e)}
              aria-label="Delete entry"
            >
              ✕
            </button>
          </div>
          <EntryText entry={e} className="diary-text" />
        </div>
      ))}
      {mine.length === 0 && <div className="diary-empty">nothing written yet</div>}
      <PinSettings
        hasPin={!!mod.state.pinHash}
        onSet={(pin) => {
          setState((s) => ({ ...s, pinHash: pin ? pinHash(mod, pin) : null }));
          if (pin) unlocked.add(mod.id);
        }}
        onLock={() => {
          unlocked.delete(mod.id);
          rerender((n) => n + 1);
        }}
      />
    </div>
  );
}

function Composer({ onSave }) {
  const [text, setText] = useState("");
  return (
    <div className="diary-compose">
      <textarea
        className="diary-compose-ta"
        placeholder="dear diary…"
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={3}
      />
      {text.trim() && (
        <button className="mini-btn" onClick={() => { onSave(text.trim()); setText(""); }}>
          write it down
        </button>
      )}
    </div>
  );
}

function PinPad({ onEnter }) {
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
      className={`pinpad${bad ? " bad" : ""}`}
      tabIndex={0}
      onKeyDown={(e) => {
        if (/^\d$/.test(e.key)) press(e.key);
        if (e.key === "Backspace") setPin((p) => p.slice(0, -1));
      }}
    >
      <div className="pin-lock">🔒</div>
      <div className="pin-dots">
        {[0, 1, 2, 3].map((i) => <span key={i} className={i < pin.length ? "on" : ""} />)}
      </div>
      <div className="pin-keys">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "⌫"].map((k, i) =>
          k ? (
            <button key={i} onClick={() => (k === "⌫" ? setPin((p) => p.slice(0, -1)) : press(k))}>{k}</button>
          ) : (
            <span key={i} />
          )
        )}
      </div>
    </div>
  );
}

function PinSettings({ hasPin, onSet, onLock }) {
  const [setting, setSetting] = useState(false);
  const [pin, setPin] = useState("");
  if (setting) {
    return (
      <div className="diary-pin-set">
        <input
          autoFocus
          className="line-input"
          inputMode="numeric"
          maxLength={4}
          placeholder="4 digits"
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
        />
        <button
          className="mini-btn"
          disabled={pin.length !== 4}
          onClick={() => { onSet(pin); setSetting(false); setPin(""); }}
        >
          set PIN
        </button>
        <button className="mini-btn ghost" onClick={() => setSetting(false)}>cancel</button>
      </div>
    );
  }
  return (
    <div className="diary-pin-set">
      {hasPin ? (
        <>
          <button className="mini-btn ghost" onClick={onLock}>🔒 lock now</button>
          <button className="mini-btn ghost" onClick={() => setSetting(true)}>change PIN</button>
          <button className="mini-btn ghost" onClick={() => onSet(null)}>remove PIN</button>
        </>
      ) : (
        <button className="mini-btn ghost" onClick={() => setSetting(true)}>add a PIN</button>
      )}
    </div>
  );
}
