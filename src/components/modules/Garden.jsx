import { useState, useEffect } from "react";
import { uid as newUid } from "../../utils/uid";
import {
  getForecast, findTown, hereNow, showTemp, sowingTasks, frostDate, weeksBetween, validMD,
  dayLabel, weekdayOf,
} from "../../lib/garden";

const INK = "#2a2520";
const FROZEN = 0; // °C — Open-Meteo always speaks Celsius, we convert for display

// Common seeds as one-tap starters: weeks to start indoors before last frost,
// and weeks after last frost to sow outside (negative = before it)
const STARTERS = [
  { name: "tomatoes", indoors: 6, sow: 2 },
  { name: "peppers", indoors: 8, sow: 2 },
  { name: "basil", indoors: 6, sow: 1 },
  { name: "peas", indoors: null, sow: -4 },
  { name: "lettuce", indoors: null, sow: -3 },
  { name: "beans", indoors: null, sow: 1 },
  { name: "squash", indoors: 3, sow: 1 },
];

const when = (days) => {
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  if (days === -1) return "yesterday";
  if (days < 0) return `${-days} days ago`;
  if (days < 14) return `in ${days} days`;
  return `in ${Math.round(days / 7)} weeks`;
};

const numOrNull = (v) => {
  if (v === "" || v == null) return null;
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? n : null;
};

// A little drawn weather glyph for one day on the packet
function Sky({ frost, wet }) {
  return (
    <svg viewBox="0 0 32 26" className="gd-sky" aria-hidden="true">
      {frost ? (
        <g stroke="#4a86b5" strokeWidth="2" strokeLinecap="round" fill="none">
          <path d="M16 3v20M7.3 8l17.4 10M7.3 18l17.4-10" />
          <path d="M13 4.5l3 2.5 3-2.5M13 21.5l3-2.5 3 2.5" strokeWidth="1.5" />
        </g>
      ) : wet ? (
        <>
          <path d="M9 15a5 5 0 0 1 1-9.9A6 6 0 0 1 21.5 7 4.3 4.3 0 0 1 22 15z" fill="#e6eef4" stroke={INK} strokeWidth="1.6" strokeLinejoin="round" />
          <path d="M11 18l-1.5 4M16 18l-1.5 4M21 18l-1.5 4" stroke="#4a86b5" strokeWidth="1.8" strokeLinecap="round" />
        </>
      ) : (
        <>
          <circle cx="16" cy="13" r="5" fill="#ffd25c" stroke={INK} strokeWidth="1.6" />
          <path d="M16 3v3M16 20v3M6 13h3M23 13h3M9 6l2 2M21 18l2 2M23 6l-2 2M11 18l-2 2" stroke={INK} strokeWidth="1.5" strokeLinecap="round" />
        </>
      )}
    </svg>
  );
}

// A seed-packet calendar: the week's weather on the front, and on the back what to
// sow when, counted from your last frost. Weather comes straight from Open-Meteo in
// the browser (no key, no server) and is remembered for 3 hours.
// State: place {name,lat,lon}, units "F"|"C", lastFrost / firstFrost "MM-DD",
// seeds [{ id, name, indoors (weeks before last frost), sow (weeks after), done {in,out: year} }].
export default function Garden({ mod, setState }) {
  const { place = null, units = "F", lastFrost = "", firstFrost = "", seeds = [] } = mod.state;
  const [wx, setWx] = useState(null); // { at, days, cached }
  const [status, setStatus] = useState("idle"); // idle | loading | error
  const [town, setTown] = useState("");
  const [open, setOpen] = useState(false); // settings drawer
  const [adding, setAdding] = useState(seeds.length === 0); // the starter chips stay up while you're picking
  const [msg, setMsg] = useState("");

  const lat = place?.lat;
  const lon = place?.lon;
  useEffect(() => {
    if (lat == null) return;
    let live = true;
    setStatus("loading");
    getForecast({ lat, lon })
      .then((w) => live && (setWx(w), setStatus("idle")))
      .catch(() => live && setStatus("error"));
    return () => { live = false; };
  }, [lat, lon]);

  const refresh = () => {
    if (lat == null) return;
    setStatus("loading");
    getForecast({ lat, lon }, true).then((w) => (setWx(w), setStatus("idle"))).catch(() => setStatus("error"));
  };

  const setPlace = (p) => setState((s) => ({ ...s, place: p }));
  const useHere = async () => {
    setMsg("");
    try { setPlace(await hereNow()); } catch { setMsg("couldn't find you; type a town instead"); }
  };
  const lookup = async () => {
    if (!town.trim()) return;
    setMsg("");
    try {
      const p = await findTown(town.trim());
      if (p) { setPlace(p); setTown(""); } else setMsg(`no town called "${town.trim()}"`);
    } catch { setMsg("couldn't reach the town finder"); }
  };

  const today = new Date();
  const lf = frostDate(lastFrost, today);
  const ff = frostDate(firstFrost, today);
  const jobs = sowingTasks(seeds, lastFrost, today);
  const thisWeek = jobs.filter((j) => j.week);
  const later = jobs.filter((j) => !j.week);
  const frostDays = (wx?.days ?? []).filter((d) => d.min <= FROZEN);
  const stateField = (k, v) => setState((s) => ({ ...s, [k]: v }));
  const patchSeed = (id, f, opts) =>
    setState((s) => ({ ...s, seeds: (s.seeds ?? []).map((x) => (x.id === id ? { ...x, ...f } : x)) }), opts);
  const addSeed = (seed) => {
    setState((s) => ({ ...s, seeds: [...(s.seeds ?? []), { id: newUid(), name: "", indoors: null, sow: 0, ...seed }] }));
  };
  const tick = (job) => {
    const key = job.what === "start indoors" ? "in" : "out";
    patchSeed(job.seed.id, { done: { ...(job.seed.done ?? {}), [key]: job.done ? null : job.date.getFullYear() } });
  };

  const dayWord = (d, i) => (i === 0 ? "today" : weekdayOf(d.day));
  const weeksToLast = lf ? weeksBetween(today, lf) : null;

  return (
    <div className="gd">
      <div className="gd-packet">
        <div className="gd-head">
          <svg viewBox="0 0 40 30" className="gd-sprout" aria-hidden="true">
            <path d="M20 29V14" stroke={INK} strokeWidth="2.4" strokeLinecap="round" />
            <path d="M20 17C10 18 6 11 6 5c8 0 14 3 14 12z" fill="#6bb36b" stroke={INK} strokeWidth="1.8" strokeLinejoin="round" />
            <path d="M20 14c2-7 8-10 15-9 0 7-6 11-15 9z" fill="#80c480" stroke={INK} strokeWidth="1.8" strokeLinejoin="round" />
          </svg>
          <div className="gd-title">
            <b>Frost &amp; sow</b>
            <span>{place ? place.name : "pick a place for the weather"}</span>
          </div>
          <div className="gd-tools">
            <button className="gd-unit" onClick={() => stateField("units", units === "F" ? "C" : "F")} title="switch units" aria-label={`Temperatures in ${units === "F" ? "Fahrenheit" : "Celsius"}; tap to switch`}>
              °{units}
            </button>
            <button className={`gd-unit${open ? " on" : ""}`} onClick={() => setOpen(!open)} aria-label="Settings" aria-expanded={open}>⚙</button>
          </div>
        </div>

        {(open || !place) && (
          <div className="gd-set">
            <div className="gd-where">
              <button className="mini-btn" onClick={useHere}>📍 use my location</button>
              <input
                className="line-input"
                value={town}
                onChange={(e) => setTown(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && lookup()}
                placeholder="or type a town…"
                aria-label="Town"
              />
              <button className="mini-btn" onClick={lookup} disabled={!town.trim()}>find</button>
            </div>
            {msg && <div className="gd-msg">{msg}</div>}
            <div className="gd-dates">
              <label>
                last spring frost
                <input type="date" value={lf && validMD(lastFrost) ? `${lf.getFullYear()}-${lastFrost}` : ""} onChange={(e) => stateField("lastFrost", e.target.value ? e.target.value.slice(5) : "")} />
              </label>
              <label>
                first fall frost
                <input type="date" value={ff && validMD(firstFrost) ? `${ff.getFullYear()}-${firstFrost}` : ""} onChange={(e) => stateField("firstFrost", e.target.value ? e.target.value.slice(5) : "")} />
              </label>
            </div>
            <div className="gd-hint">no key can tell us your frost dates, so you do: ask a neighbour, or search “last frost date + your town”.</div>
          </div>
        )}

        {frostDays.length > 0 ? (
          <div className="gd-alert frost" role="status">
            ❄ frost {frostDays.map((d) => weekdayOf(d.day)).slice(0, 3).join(", ")}
            {frostDays.length > 3 ? " …" : ""} (down to {showTemp(Math.min(...frostDays.map((d) => d.min)), units)}). cover the tender ones!
          </div>
        ) : wx ? (
          <div className="gd-alert calm">no frost in the 7-day forecast</div>
        ) : null}

        {place && (
          <div className="gd-week" aria-busy={status === "loading"}>
            {(wx?.days ?? Array.from({ length: 7 }, () => null)).map((d, i) => {
              const frost = d && d.min <= FROZEN;
              const wet = d && (d.rain >= 1 || (d.chance ?? 0) >= 60);
              return (
                <div key={d?.day ?? i} className={`gd-day${frost ? " frost" : ""}${wet ? " wet" : ""}${!d ? " ghost" : ""}`}>
                  <span className="gd-dow">{d ? dayWord(d, i) : "…"}</span>
                  {d && <Sky frost={frost} wet={wet} />}
                  <b className="gd-min">{d ? showTemp(d.min, units) : ""}</b>
                  <span className="gd-max">{d ? showTemp(d.max, units) : ""}</span>
                  <span className="gd-rain">{d && d.rain >= 0.2 ? `💧${d.rain < 10 ? d.rain.toFixed(1) : Math.round(d.rain)}mm` : ""}</span>
                </div>
              );
            })}
          </div>
        )}
        {place && (
          <div className="gd-foot">
            {status === "error" ? "couldn't reach the weather · " : status === "loading" ? "checking the sky… · " : ""}
            {wx && status !== "error" && `lows on top · updated ${new Date(wx.at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })} · `}
            <button className="gd-link" onClick={refresh}>refresh</button>
          </div>
        )}
      </div>

      <div className="gd-packet gd-back">
        <div className="gd-countdown">
          {lf ? (
            <>
              <b>{weeksToLast > 0.2 ? `${Math.round(weeksToLast)} wk` : weeksToLast < -0.2 ? `${Math.round(-weeksToLast)} wk ago` : "now"}</b>
              <span>{weeksToLast > 0.2 ? "until last frost" : weeksToLast < -0.2 ? "since last frost" : "last frost is about now"} · {dayLabel(lf)}</span>
            </>
          ) : (
            <span className="gd-nofrost">set your last frost date (⚙) to get a sowing list</span>
          )}
          {ff && <em>first fall frost {when(Math.round((ff - new Date(today.getFullYear(), today.getMonth(), today.getDate())) / 86400000))}</em>}
        </div>

        {thisWeek.length > 0 && (
          <div className="gd-todo">
            <div className="gd-h">this week</div>
            {thisWeek.map((j) => (
              <label key={j.id} className="gd-job now">
                <input type="checkbox" checked={j.done} onChange={() => tick(j)} />
                <span><b>{j.what}</b> {j.seed.name}</span>
                <em>{when(j.days)}</em>
              </label>
            ))}
          </div>
        )}
        {lf && jobs.length > 0 && thisWeek.length === 0 && <div className="gd-clear">nothing to sow this week 🌿</div>}

        {later.length > 0 && (
          <div className="gd-todo">
            <div className="gd-h">coming up</div>
            {later.map((j) => (
              <label key={j.id} className={`gd-job${j.done ? " done" : ""}${j.days < 0 ? " past" : ""}`}>
                <input type="checkbox" checked={j.done} onChange={() => tick(j)} />
                <span><b>{j.what}</b> {j.seed.name}</span>
                <em>{dayLabel(j.date)} · {when(j.days)}</em>
              </label>
            ))}
          </div>
        )}

        <div className="gd-seeds">
          <div className="gd-h">seeds</div>
          {seeds.map((sd) => (
            <div key={sd.id} className="gd-seed">
              <input className="line-input" defaultValue={sd.name} placeholder="seed" onChange={(e) => patchSeed(sd.id, { name: e.target.value }, { debounce: 500 })} aria-label="Seed name" />
              <label title="weeks before last frost to start indoors (blank = skip)">
                <span>indoors</span>
                <input className="line-input" inputMode="numeric" defaultValue={sd.indoors ?? ""} placeholder="–" onChange={(e) => patchSeed(sd.id, { indoors: numOrNull(e.target.value) }, { debounce: 500 })} />
                <span>wk before</span>
              </label>
              <label title="weeks after last frost to sow outside; negative = before it (blank = skip)">
                <span>outside</span>
                <input className="line-input" inputMode="numeric" defaultValue={sd.sow ?? ""} placeholder="–" onChange={(e) => patchSeed(sd.id, { sow: numOrNull(e.target.value) }, { debounce: 500 })} />
                <span>wk after</span>
              </label>
              <button className="x-btn" onClick={() => setState((s) => ({ ...s, seeds: (s.seeds ?? []).filter((x) => x.id !== sd.id) }))} aria-label={`Remove ${sd.name || "seed"}`}>✕</button>
            </div>
          ))}
          {adding && (
            <div className="gd-chips">
              {STARTERS.filter((c) => !seeds.some((s) => s.name === c.name)).map((c) => (
                <button key={c.name} className="gd-chip" onClick={() => addSeed(c)}>+ {c.name}</button>
              ))}
            </div>
          )}
          <div className="gd-addrow">
            <button className="mini-btn ghost gd-addseed" onClick={() => (adding ? addSeed({}) : setAdding(true))}>
              + {adding ? "blank packet" : "seed packet"}
            </button>
            {adding && seeds.length > 0 && <button className="mini-btn ghost gd-addseed" onClick={() => setAdding(false)}>done</button>}
          </div>
        </div>
      </div>
    </div>
  );
}
