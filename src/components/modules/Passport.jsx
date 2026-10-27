import { useState } from "react";
import { uid as newUid } from "../../utils/uid";
import { dayKey, keyToDate } from "../../utils/date";
import {
  findCountries, countryName, flagOf, regionCounts, regionOf, stampLook, visitedCountries, REGION_NAMES,
} from "../../lib/travel";
import { Seg, Empty } from "./kit";

const SHOWN = 4; // stamps on the small card
const stampDate = (key) =>
  keyToDate(key).toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" }).toUpperCase();

// One rubber stamp, inked a little crooked
function Stamp({ s, onClick }) {
  const look = stampLook(s);
  return (
    <button
      type="button"
      className={`pp-stamp${look.round ? " round" : ""}`}
      style={{ "--stamp": look.ink, transform: `rotate(${look.tilt}deg) translateX(${look.dx}px)` }}
      onClick={onClick}
      aria-label={`${countryName(s.cc)}, ${stampDate(s.date)}${s.note ? `, ${s.note}` : ""}. Tap to edit.`}
    >
      <span className="pp-flag">{flagOf(s.cc)}</span>
      <b>{countryName(s.cc)}</b>
      <i>{stampDate(s.date)}</i>
    </button>
  );
}

// A passport page of ink stamps for places you've been, and a page of places you want to
// go. The country list is built in (flags are emoji from the two-letter code).
// State: stamps [{ id, cc, date: "YYYY-MM-DD", note }], want [{ id, cc, note }].
export default function Passport({ mod, setState, expanded, openBig }) {
  const { stamps = [], want = [] } = mod.state;
  const [page, setPage] = useState("stamps"); // stamps | want
  const [adding, setAdding] = useState(false);
  const [q, setQ] = useState("");
  const [date, setDate] = useState(dayKey());
  const [note, setNote] = useState("");
  const [edit, setEdit] = useState(null); // stamp id being edited

  const results = findCountries(q);
  const visited = visitedCountries(stamps);
  const regions = regionCounts(stamps);
  const patch = (f) => setState((s) => ({ ...s, ...f }));

  const add = (cc) => {
    if (page === "stamps") {
      patch({
        stamps: [{ id: newUid(), cc, date: date || dayKey(), note: note.trim() }, ...stamps],
        want: want.filter((w) => w.cc !== cc), // you made it
      });
    } else if (!want.some((w) => w.cc === cc) && !visited.includes(cc)) {
      patch({ want: [...want, { id: newUid(), cc, note: note.trim() }] });
    }
    setQ(""); setNote(""); setAdding(false);
  };
  const stampIt = (w) =>
    patch({
      stamps: [{ id: newUid(), cc: w.cc, date: dayKey(), note: w.note || "" }, ...stamps],
      want: want.filter((x) => x.id !== w.id),
    });
  const editing = stamps.find((s) => s.id === edit);
  const setStamp = (id, f, opts) =>
    setState((s) => ({ ...s, stamps: (s.stamps ?? []).map((x) => (x.id === id ? { ...x, ...f } : x)) }), opts);

  const shownStamps = expanded ? stamps : stamps.slice(0, SHOWN);
  const shownWant = expanded ? want : want.slice(0, 3);
  const more = page === "stamps" ? stamps.length - shownStamps.length : want.length - shownWant.length;
  const hasAny = page === "stamps" ? stamps.length > 0 : want.length > 0;

  return (
    <div className="pp">
      <div className="pp-top">
        <div className="pp-count"><b>{visited.length}</b> {visited.length === 1 ? "country" : "countries"}</div>
        <Seg label="Passport pages" value={page} onChange={(p) => { setPage(p); setAdding(false); }} options={[{ id: "stamps", label: "stamps" }, { id: "want", label: `want to go${want.length ? ` · ${want.length}` : ""}` }]} />
      </div>

      {adding && (
        <div className="pp-find">
          <div className="pp-findrow">
            <input autoFocus className="line-input" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && results[0] && add(results[0].cc)} placeholder="a country…" aria-label="Country" />
            <button className="x-btn" onClick={() => { setAdding(false); setQ(""); }} aria-label="Cancel">✕</button>
          </div>
          {expanded && page === "stamps" && <input type="date" className="pp-date" value={date} max={dayKey()} onChange={(e) => setDate(e.target.value)} aria-label="Date visited" />}
          {expanded && <input className="line-input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="a note (optional)" aria-label="Note" />}
          {q.trim() && (
            <div className="pp-results">
              {results.map((c) => (
                <button key={c.cc} className="pp-pick" onClick={() => add(c.cc)}><span>{c.flag}</span> {c.name}</button>
              ))}
              {!results.length && <small>no country called “{q.trim()}”</small>}
            </div>
          )}
        </div>
      )}

      {page === "stamps" ? (
        stamps.length === 0 ? (
          !adding && <Empty action={<button className="mini-btn" onClick={() => setAdding(true)}>+ first stamp</button>}>a clean page.</Empty>
        ) : (
          <div className="pp-grid">
            {shownStamps.map((s) => <Stamp key={s.id} s={s} onClick={() => setEdit(edit === s.id ? null : s.id)} />)}
          </div>
        )
      ) : want.length === 0 ? (
        !adding && <Empty action={<button className="mini-btn" onClick={() => setAdding(true)}>+ somewhere to go</button>}>no dreams on this page yet.</Empty>
      ) : (
        <ul className="pp-want">
          {shownWant.map((w, i) => (
            <li key={w.id}>
              <span className="pp-flag">{flagOf(w.cc)}</span>
              <div>
                <b>{countryName(w.cc)}</b>
                <small>{i === 0 ? "next · " : ""}{regionOf(w.cc)}{w.note ? ` · ${w.note}` : ""}</small>
              </div>
              <button className="mini-btn ghost" onClick={() => stampIt(w)}>stamp it</button>
              {expanded && <button className="x-btn" onClick={() => patch({ want: want.filter((x) => x.id !== w.id) })} aria-label={`Remove ${countryName(w.cc)}`}>✕</button>}
            </li>
          ))}
        </ul>
      )}

      {editing && page === "stamps" && (
        <div className="pp-edit">
          <b>{flagOf(editing.cc)} {countryName(editing.cc)}</b>
          <input type="date" className="pp-date" value={editing.date} onChange={(e) => e.target.value && setStamp(editing.id, { date: e.target.value })} aria-label="Date" />
          <input className="line-input" defaultValue={editing.note} placeholder="a note" onChange={(e) => setStamp(editing.id, { note: e.target.value }, { debounce: 500 })} aria-label="Note" />
          <button className="mini-btn ghost" onClick={() => { patch({ stamps: stamps.filter((x) => x.id !== editing.id) }); setEdit(null); }}>remove</button>
        </div>
      )}

      {expanded && page === "stamps" && regions.length > 0 && (
        <div className="pp-regions" aria-label="Countries by region">
          {REGION_NAMES.map((r) => {
            const n = regions.find(([name]) => name === r)?.[1] ?? 0;
            return <span key={r} className={n ? "has" : ""}>{r} <b>{n}</b></span>;
          })}
        </div>
      )}

      {(more > 0 || (!adding && hasAny)) && (
        <div className="pp-bar">
          {more > 0 && <button className="mini-btn ghost" onClick={openBig}>+ {more} more</button>}
          {!adding && hasAny && <button className="mini-btn" onClick={() => setAdding(true)}>+ {page === "stamps" ? "stamp" : "place"}</button>}
        </div>
      )}
    </div>
  );
}
