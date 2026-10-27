import { useState, useEffect, useMemo } from "react";
import { uid } from "../../utils/uid";
import { myZone, wall, fmt12, dayWord, ahead, strip, bestWindows, findCity } from "../../lib/worldclock";
import { Credit } from "./kit";

const pad = (n) => String(n).padStart(2, "0");
const hourLabel = (h) => fmt12(h).replace("m", "");

// A little round clock face; night is dark blue, day is butter yellow
function Face({ tz, now, size = 56 }) {
  const w = wall(tz, now);
  const day = w.h >= 6 && w.h < 19;
  const hand = (deg, len, wd) => (
    <line x1="32" y1="32" x2={32 + len * Math.sin((deg * Math.PI) / 180)} y2={32 - len * Math.cos((deg * Math.PI) / 180)} stroke={day ? "#2a2520" : "#fffdf6"} strokeWidth={wd} strokeLinecap="round" />
  );
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} aria-hidden="true" className="wc-face">
      <circle cx="32" cy="32" r="29" fill={day ? "#fff0b3" : "#2c3a5e"} stroke="#2a2520" strokeWidth="2.5" />
      {Array.from({ length: 12 }, (_, i) => (
        <line key={i} x1="32" y1="6.5" x2="32" y2={i % 3 ? 9 : 11.5} stroke={day ? "#2a2520" : "#fffdf6"} strokeWidth={i % 3 ? 1 : 1.8} transform={`rotate(${i * 30} 32 32)`} />
      ))}
      {day ? <circle cx="32" cy="46" r="3" fill="#ffb02e" /> : <path d="M29 44 a4 4 0 1 0 5 5 a3.2 3.2 0 0 1 -5 -5z" fill="#ffe9a8" />}
      {hand(((w.h % 12) + w.m / 60) * 30, 15, 3)}
      {hand(w.m * 6, 22, 2)}
      <circle cx="32" cy="32" r="2" fill="#ff5d8f" />
    </svg>
  );
}

// Little clocks for the people you work and play with, and a strip showing when everyone is awake
export default function WorldClock({ mod, setState, expanded }) {
  const { people = [], me = {} } = mod.state;
  const [now, setNow] = useState(() => Date.now());
  const [q, setQ] = useState("");
  const [hits, setHits] = useState(null);
  const [busy, setBusy] = useState(false);
  const [editId, setEditId] = useState(null);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 20000);
    return () => clearInterval(t);
  }, []);

  const tz = myZone();
  const you = { id: "me", name: "me", city: tz.split("/").pop().replace(/_/g, " "), tz, wake: me.wake ?? 8, sleep: me.sleep ?? 22 };
  const everyone = [you, ...people];
  const slots = useMemo(() => strip(everyone, you, Math.floor(now / 3600000) * 3600000), [people, me, tz, Math.floor(now / 3600000)]); // eslint-disable-line react-hooks/exhaustive-deps
  const best = bestWindows(slots, everyone.length);
  const askRow = adding || expanded || !people.length;

  const search = async () => {
    if (!q.trim()) return;
    setBusy(true);
    try { setHits(await findCity(q.trim())); } catch { setHits([]); }
    setBusy(false);
  };

  const add = (h) => {
    const id = uid();
    setState((s) => ({ ...s, people: [...(s.people ?? []), { id, name: h.city, city: h.city, tz: h.tz, wake: 8, sleep: 22 }] }));
    setQ("");
    setHits(null);
    setAdding(false);
    setEditId(id); // so you can give them a name
  };

  const patch = (id, p) => setState((s) => (id === "me" ? { ...s, me: { ...s.me, ...p } } : { ...s, people: s.people.map((x) => (x.id === id ? { ...x, ...p } : x)) }));
  const remove = (id) => {
    setState((s) => ({ ...s, people: s.people.filter((x) => x.id !== id) }));
    setEditId(null);
  };

  const span = (r) => `${fmt12(r.from.hour)}–${fmt12((r.to.hour + 1) % 24)}`;
  const sentence = !people.length
    ? "add someone to find a time that works"
    : best.top === 0
      ? "no one is up in the next 24 hours?"
      : best.everyone
        ? `everyone’s up ${span(best.runs[0])} your time${best.runs[0].from.at - now > 3600000 * 20 ? " (tomorrow)" : ""}`
        : `no time suits everyone; ${best.top} of ${everyone.length} are up ${span(best.runs[0])}`;

  const marks = [0, 6, 12, 18];
  const editing = everyone.find((p) => p.id === editId);
  const hours = Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{fmt12(h)}</option>);

  return (
    <div className="wcl">
      <div className="wcl-row">
        {everyone.map((p) => {
          const w = wall(p.tz, now);
          const isMe = p.id === "me";
          return (
            <button key={p.id} className={`wcl-clock${editId === p.id ? " on" : ""}`} onClick={() => setEditId(editId === p.id ? null : p.id)} aria-label={`${p.name}, ${p.city}: ${fmt12(w.h, w.m)}. Tap for settings`} aria-expanded={editId === p.id}>
              <Face tz={p.tz} now={now} size={expanded ? 68 : 54} />
              <b className="wcl-time">{pad(w.h)}:{pad(w.m)}</b>
              <span className="wcl-name">{p.name}</span>
              <i className="wcl-city">{isMe ? p.city : `${ahead(p.tz, tz, now)} · ${dayWord(p.tz, tz, now)}`}</i>
            </button>
          );
        })}
        {!askRow && <button className="wcl-plus mini-btn ghost" onClick={() => setAdding(true)} aria-label="Add someone">+</button>}
      </div>

      {editing && (
        <div className="wcl-edit">
          {editing.id !== "me" && <input className="line-input" value={editing.name} onChange={(e) => patch(editing.id, { name: e.target.value })} aria-label="Their name" />}
          <label>up at <select value={editing.wake} onChange={(e) => patch(editing.id, { wake: Number(e.target.value) })}>{hours}</select></label>
          <label>bed at <select value={editing.sleep} onChange={(e) => patch(editing.id, { sleep: Number(e.target.value) })}>{hours}</select></label>
          {editing.id !== "me" && <button className="x-btn" onClick={() => remove(editing.id)} aria-label={`Remove ${editing.name}`} title="Remove">✕</button>}
        </div>
      )}

      {askRow && (
        <>
          <div className="wcl-add">
            <input className="line-input" placeholder="add a city: Tokyo, Lagos…" value={q} onChange={(e) => (setQ(e.target.value), setHits(null))} onKeyDown={(e) => e.key === "Enter" && search()} aria-label="A city" />
            <button className="mini-btn" onClick={search} disabled={busy || !q.trim()}>{busy ? "…" : "find"}</button>
          </div>
          {hits && (
            <div className="wcl-hits">
              {hits.map((h, i) => (
                <button key={i} className="wcl-hit" onClick={() => add(h)}>
                  <b>{h.city}</b>
                  <i>{[h.place, h.tz.replace(/_/g, " ")].filter(Boolean).join(" · ")}</i>
                </button>
              ))}
              {!hits.length && <div className="wcl-none">no city by that name</div>}
            </div>
          )}
        </>
      )}

      {people.length > 0 && (
        <div className="wcl-find">
          <div className="wcl-strip" role="img" aria-label={sentence}>
            <div className="wcl-hours">
              {slots.map((s, i) => <span key={i}>{marks.includes(s.hour) ? hourLabel(s.hour) : ""}</span>)}
            </div>
            {everyone.slice(0, expanded ? 12 : 4).map((p) => (
              <div key={p.id} className="wcl-line">
                <em>{p.name}</em>
                <div>{slots.map((s, i) => <i key={i} className={s.up.some((x) => x.id === p.id) ? "on" : ""} />)}</div>
              </div>
            ))}
            <div className="wcl-line all">
              <em>all</em>
              <div>{slots.map((s, i) => <i key={i} className={s.all ? "on" : ""} />)}</div>
            </div>
          </div>
          <div className="wcl-say">{sentence}</div>
        </div>
      )}
      {expanded && <Credit>geocoding by Open-Meteo · times in your zone</Credit>}
    </div>
  );
}
