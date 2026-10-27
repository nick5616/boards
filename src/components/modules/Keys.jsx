import { useState, useEffect, useRef } from "react";
import { useLive } from "../../contexts/LiveContext";
import { useData } from "../../contexts/DataContext";
import { uid } from "../../utils/uid";
import { note as sound, now } from "../../lib/audio";
import { caps } from "../../lib/caps";
import { typing } from "../../lib/paste";
import { isBlack, midiToName } from "../../lib/notes";
import { sendAll } from "../../lib/readings";
import SendTo, { WireTag } from "../board/SendTo";

const MAX_NOTES = 2000; // per kept phrase: tiny JSON, still fine for Firestore
const IDLE_MS = 2 * 60000; // two quiet minutes and the practice session ends
const HOLD = 0.7; // seconds a note rings (keys have no sustain, so it's a pluck)

// Computer keys as a piano, in order from the left-hand C: A W S E D F T G Y H U J K O L P ;
const QWERTY = ["KeyA", "KeyW", "KeyS", "KeyE", "KeyD", "KeyF", "KeyT", "KeyG", "KeyY", "KeyH", "KeyU", "KeyJ", "KeyK", "KeyO", "KeyL", "KeyP", "Semicolon"];
const LABELS = ["A", "W", "S", "E", "D", "F", "T", "G", "Y", "H", "U", "J", "K", "O", "L", "P", ";"];

// A toy piano. Click it, type on it, or plug in a real keyboard. "Keep this"
// records what you play as a phrase in the module, and playing for a while
// logs itself to the sticker chart.
export default function Keys({ board, mod, setState, expanded }) {
  const live = useLive();
  const data = useData();
  const phrases = mod.state.phrases ?? [];
  const octaves = expanded ? 3 : 2;

  const [oct, setOct] = useState(3); // the octave of the leftmost C
  const [lit, setLit] = useState([]); // midis ringing right now
  const [rec, setRec] = useState(false);
  const [playing, setPlaying] = useState(null); // id of the phrase being played back
  const [midiOn, setMidiOn] = useState(false);
  const [midiMsg, setMidiMsg] = useState("");
  const [editing, setEditing] = useState(null);
  const [count, setCount] = useState(0); // notes this session, for the badge

  const low = 12 * (oct + 1);
  const whites = [];
  for (let m = low; whites.length < 7 * octaves + 1; m++) if (!isBlack(m)) whites.push(m);

  const root = useRef(null);
  const holds = useRef(new Map()); // midi -> who is holding it (pointer / keys / midi)
  const recRef = useRef(null); // { t0, notes, open: Map(midi -> note) } while recording
  const sess = useRef(null); // { sid, startedAt, last, notes }
  const idle = useRef(0);
  const away = useRef(true); // true unless the card is hovered or focused
  const lowRef = useRef(low);
  lowRef.current = low;
  const liveRef = useRef(live);
  liveRef.current = live;
  const dataRef = useRef(data);
  dataRef.current = data;
  const wiresRef = useRef(mod.state.sendTo); // endSession can run from an old render, so it reads the latest wires here
  wiresRef.current = mod.state.sendTo;
  const playback = useRef({ timers: [], oscs: [] });

  // A practice session: starts on the first note, ends after two idle minutes or when you leave
  const endSession = () => {
    const s = sess.current;
    if (!s) return;
    sess.current = null;
    clearTimeout(idle.current);
    setCount(0);
    liveRef.current?.stop(s.sid);
    const mins = Math.round((s.last - s.startedAt) / 60000);
    if (mins >= 1) {
      const { logPractice, undoLog, toast } = dataRef.current;
      const entry = logPractice(board.id, `🎹 played ${mins} min, ${s.notes} notes`, { mins, notes: s.notes, moduleId: mod.id });
      const sent = sendAll(dataRef.current.updateBoard, board.id, wiresRef.current, { value: mins, unit: "min", label: "keys" });
      toast({ text: `${mins} min at the keys, on the chart ✓${sent ? " · sent" : ""}`, actions: [{ label: "undo", run: () => undoLog(entry) }] });
    }
  };

  const beat = () => {
    let s = sess.current;
    if (!s) {
      const sid = liveRef.current.start({ kind: "keys", boardId: board.id, modId: mod.id, label: "playing keys", icon: "🎹", onStop: endSession });
      s = sess.current = { sid, startedAt: Date.now(), last: Date.now(), notes: 0 };
    }
    s.last = Date.now();
    s.notes++;
    setCount(s.notes);
    clearTimeout(idle.current);
    idle.current = setTimeout(endSession, IDLE_MS);
  };

  const showLit = () => setLit([...holds.current.keys()]);

  const finishPhrase = () => {
    const r = recRef.current;
    recRef.current = null;
    setRec(false);
    if (!r || !r.notes.length) return;
    const t = Date.now() - r.t0;
    r.open.forEach((n) => (n.d = Math.max(30, Math.round(t - n.t)))); // keys still down when you stopped
    setState((s) => ({
      ...s,
      phrases: [
        ...(s.phrases ?? []),
        { id: uid(), name: `phrase ${(s.phrases?.length ?? 0) + 1}`, notes: r.notes, at: Date.now(), by: dataRef.current.uid },
      ],
    }));
  };

  // Press / release a key from any source. vel is 0..1.
  const down = (m, src, vel = 0.7) => {
    const who = holds.current.get(m) ?? new Set();
    if (who.has(src)) return;
    who.add(src);
    holds.current.set(m, who);
    sound(m, { dur: HOLD, vel });
    showLit();
    beat();
    const r = recRef.current;
    if (r) {
      const t = Math.round(Date.now() - (r.t0 ??= Date.now())); // the phrase starts at your first note
      const n = { m, t, d: 0, v: Math.round(vel * 100) / 100 };
      r.notes.push(n);
      r.open.set(m, n);
      if (r.notes.length >= MAX_NOTES) finishPhrase();
    }
  };
  const up = (m, src) => {
    const who = holds.current.get(m);
    if (!who?.delete(src)) return;
    if (!who.size) holds.current.delete(m);
    showLit();
    const n = recRef.current?.open.get(m);
    if (n && !holds.current.has(m)) {
      n.d = Math.max(30, Math.round(Date.now() - recRef.current.t0 - n.t));
      recRef.current.open.delete(m);
    }
  };
  const downRef = useRef(down);
  downRef.current = down;
  const upRef = useRef(up);
  upRef.current = up;

  // Computer keyboard, but only while the card is hovered or focused, and never over a text field.
  // Each physical key remembers the note it started, so shifting octaves mid-hold still lets go of it.
  useEffect(() => {
    const pressed = new Map(); // e.code -> midi
    const kd = (e) => {
      if (away.current || typing() || e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
      const i = QWERTY.indexOf(e.code);
      if (i < 0) return;
      e.preventDefault();
      pressed.set(e.code, lowRef.current + i);
      downRef.current(lowRef.current + i, "keys");
    };
    const ku = (e) => {
      if (!pressed.has(e.code)) return;
      upRef.current(pressed.get(e.code), "keys");
      pressed.delete(e.code);
    };
    // Switching windows mid-hold swallows the keyup; let everything go
    const letGo = () => {
      pressed.forEach((m) => upRef.current(m, "keys"));
      pressed.clear();
    };
    window.addEventListener("keydown", kd);
    window.addEventListener("keyup", ku);
    window.addEventListener("blur", letGo);
    return () => {
      window.removeEventListener("keydown", kd);
      window.removeEventListener("keyup", ku);
      window.removeEventListener("blur", letGo);
    };
  }, []);

  // A real keyboard over Web MIDI
  useEffect(() => {
    if (!midiOn) return;
    let access = null;
    let gone = false;
    const hear = (e) => {
      const [st, m, v] = e.data;
      const kind = st & 0xf0;
      if (kind === 0x90 && v > 0) downRef.current(m, "midi", v / 127);
      else if (kind === 0x80 || (kind === 0x90 && v === 0)) upRef.current(m, "midi");
    };
    const wire = () => {
      let n = 0;
      access.inputs.forEach((i) => {
        i.onmidimessage = hear;
        n++;
      });
      setMidiMsg(n ? `${n} keyboard${n === 1 ? "" : "s"} plugged in` : "no keyboard found, plug one in");
    };
    navigator
      .requestMIDIAccess()
      .then((a) => {
        if (gone) return;
        access = a;
        a.onstatechange = wire;
        wire();
      })
      .catch(() => {
        if (gone) return;
        setMidiOn(false);
        setMidiMsg("MIDI is switched off for this page");
      });
    return () => {
      gone = true;
      if (access) {
        access.onstatechange = null;
        access.inputs.forEach((i) => (i.onmidimessage = null));
      }
    };
  }, [midiOn]);

  const hush = () => {
    const p = playback.current;
    p.timers.forEach(clearTimeout);
    p.oscs.forEach((o) => {
      try { o.stop(); } catch { /* already finished */ }
    });
    playback.current = { timers: [], oscs: [] };
    setPlaying(null);
    holds.current.forEach((who, m) => {
      who.delete("play");
      if (!who.size) holds.current.delete(m);
    });
    showLit();
  };

  const playPhrase = (ph) => {
    if (playing === ph.id) return hush();
    hush();
    const t0 = now();
    const p = playback.current;
    ph.notes.forEach((n) => {
      p.oscs.push(sound(n.m, { when: t0 + 0.05 + n.t / 1000, dur: Math.max(n.d, 80) / 1000, vel: n.v }));
      p.timers.push(
        setTimeout(() => {
          const who = holds.current.get(n.m) ?? new Set();
          who.add("play");
          holds.current.set(n.m, who);
          showLit();
        }, 50 + n.t),
        setTimeout(() => upRef.current(n.m, "play"), 50 + n.t + Math.max(n.d, 80))
      );
    });
    const end = Math.max(...ph.notes.map((n) => n.t + n.d)) + 200;
    setPlaying(ph.id);
    p.timers.push(setTimeout(() => setPlaying(null), end));
  };

  // Leaving the card: stop everything, end the session, drop a half-made phrase's open keys
  useEffect(
    () => () => {
      hush();
      endSession();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const rename = (id, name) => setState((s) => ({ ...s, phrases: s.phrases.map((p) => (p.id === id ? { ...p, name: name.trim() || p.name } : p)) }));
  const remove = (id) => {
    if (playing === id) hush();
    setState((s) => ({ ...s, phrases: s.phrases.filter((p) => p.id !== id) }));
  };

  const keyProps = (m) => ({
    className: `keys-key ${isBlack(m) ? "black" : "white"}${lit.includes(m) ? " lit" : ""}`,
    onPointerDown: (e) => {
      e.preventDefault();
      e.currentTarget.releasePointerCapture?.(e.pointerId); // so sliding across keys plays each one
      const r = e.currentTarget.getBoundingClientRect();
      down(m, "ptr", 0.45 + 0.5 * Math.min(1, (e.clientY - r.top) / r.height)); // lower on the key = harder
    },
    onPointerEnter: (e) => e.buttons === 1 && down(m, "ptr", 0.7),
    onPointerUp: () => up(m, "ptr"),
    onPointerLeave: () => up(m, "ptr"),
    onPointerCancel: () => up(m, "ptr"),
    "aria-label": midiToName(m),
  });

  return (
    <div
      ref={root}
      className={`keys${expanded ? " big" : ""}`}
      tabIndex={0}
      onMouseEnter={() => (away.current = false)}
      onMouseLeave={() => (away.current = !root.current?.contains(document.activeElement))}
      onFocus={() => (away.current = false)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) away.current = true;
      }}
    >
      <div className="keys-bar">
        <button className="mini-btn ghost" onClick={() => setOct((o) => Math.max(0, o - 1))} disabled={oct <= 0} aria-label="Octave down">
          oct −
        </button>
        <span className="keys-range">
          {midiToName(low)}–{midiToName(low + 12 * octaves)}
        </span>
        <button className="mini-btn ghost" onClick={() => setOct((o) => Math.min(7 - octaves, o + 1))} disabled={oct >= 7 - octaves} aria-label="Octave up">
          oct +
        </button>
        {count > 0 && <span className="keys-count">{count} ♪</span>}
      </div>

      <div className="keys-board">
        {whites.map((m, i) => (
          <div key={m} className="keys-slot">
            <button {...keyProps(m)}>
              {m >= low && m - low < 18 && !isBlack(m) && QWERTY[m - low] ? <span>{LABELS[m - low]}</span> : null}
            </button>
            {whites[i + 1] !== undefined && isBlack(m + 1) && <button {...keyProps(m + 1)} />}
          </div>
        ))}
      </div>

      <div className="keys-btns">
        <button className={`mini-btn${rec ? " on" : ""}`} onClick={() => (rec ? finishPhrase() : ((recRef.current = { t0: null, notes: [], open: new Map() }), setRec(true)))}>
          {rec ? "● keep this" : "○ record"}
        </button>
        {caps.midi && (
          <button className={`mini-btn${midiOn ? " on" : ""}`} onClick={() => (midiOn ? (setMidiOn(false), setMidiMsg("")) : (setMidiMsg("looking…"), setMidiOn(true)))}>
            {midiOn ? "unplug" : "plug in a keyboard"}
          </button>
        )}
      </div>
      {midiMsg && <div className="keys-msg">{midiMsg}</div>}
      <WireTag board={board} mod={mod} />
      {expanded && <SendTo fold board={board} mod={mod} setState={setState} note="the minutes you played go there" />}

      {phrases.length > 0 && (
        <ul className="keys-phrases">
          {phrases.map((p) => (
            <li key={p.id}>
              <button className="mini-btn" onClick={() => playPhrase(p)} aria-label={playing === p.id ? "Stop" : `Play ${p.name}`}>
                {playing === p.id ? "■" : "▶"}
              </button>
              {editing === p.id ? (
                <input
                  className="keys-name"
                  autoFocus
                  defaultValue={p.name}
                  onBlur={(e) => (rename(p.id, e.target.value), setEditing(null))}
                  onKeyDown={(e) => (e.key === "Enter" || e.key === "Escape") && e.currentTarget.blur()}
                />
              ) : (
                <button className="keys-pname" onClick={() => setEditing(p.id)} title="Rename">
                  {p.name} <i>{p.notes.length} notes</i>
                </button>
              )}
              <button className="x-btn" onClick={() => remove(p.id)} aria-label={`Delete ${p.name}`}>
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
