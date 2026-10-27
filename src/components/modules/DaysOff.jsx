import { useState, useEffect, useMemo } from "react";
import { uid as newUid } from "../../utils/uid";
import { dayKey, keyToDate, dayDiff, addDays } from "../../utils/date";
import { getHolidays, getHolidayCountries, longWeekends, describeBreak, inDays, countryName, flagOf } from "../../lib/travel";
import { Empty, Fold, Credit } from "./kit";

const short = (key) => keyToDate(key).toLocaleDateString(undefined, { month: "short", day: "numeric" });

// A wall calendar page: your country's public holidays (Nager.Date, no key, kept a week),
// your own days off and trips, a countdown to the next one, and the long-weekend finder.
// The small card is the month and the countdown; lists, adding and the country live in
// the big view. Days that have passed drop into a done pile.
// State: country (ISO code), days [{ id, date, end?, label }] (your own days off and trips).
export default function DaysOff({ mod, setState, expanded, openBig }) {
  const { country = "", days = [] } = mod.state;
  const [list, setList] = useState([]); // [{ countryCode, name }]
  const [hols, setHols] = useState([]);
  const [err, setErr] = useState(false);
  const [busy, setBusy] = useState(false);
  const [label, setLabel] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [month, setMonth] = useState(0); // months from this one
  const [showDone, setShowDone] = useState(false);
  const [nonce, setNonce] = useState(0);

  const today = new Date();
  const t = dayKey(today);
  const year = today.getFullYear();

  useEffect(() => { getHolidayCountries().then(setList).catch(() => {}); }, []);
  useEffect(() => {
    if (!country) { setHols([]); return; }
    let live = true;
    setErr(false);
    setBusy(true);
    Promise.all([getHolidays(year, country), getHolidays(year + 1, country)])
      .then(([a, b]) => live && setHols([...a, ...b].map((h) => ({ date: h.date, name: h.localName || h.name }))))
      .catch(() => live && setErr(true))
      .finally(() => live && setBusy(false));
    return () => { live = false; };
  }, [country, year, nonce]);

  const patch = (f) => setState((s) => ({ ...s, ...f }));
  const own = useMemo(() => days.map((d) => ({ ...d, name: d.label || "day off", own: true })), [days]);
  const everything = useMemo(
    () => [...hols, ...own].sort((a, b) => a.date.localeCompare(b.date)),
    [hols, own]
  );
  const endOf = (d) => d.end || d.date;
  const coming = everything.filter((d) => endOf(d) >= t);
  const done = everything.filter((d) => endOf(d) < t && d.date >= `${year}-01-01`).reverse();
  const next = coming[0];
  const nextOwn = coming.find((d) => d.own);
  const breaks = useMemo(() => longWeekends(everything, today).slice(0, 5), [everything, t]); // eslint-disable-line react-hooks/exhaustive-deps

  const add = () => {
    if (!from) return;
    const end = to && to > from ? to : "";
    patch({ days: [...days, { id: newUid(), date: from, end, label: label.trim() }] });
    setLabel(""); setFrom(""); setTo("");
  };

  // The month on the wall
  const first = new Date(today.getFullYear(), today.getMonth() + month, 1);
  const lead = first.getDay();
  const dim = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  const marks = new Map();
  for (const d of everything) {
    for (let x = keyToDate(d.date); dayKey(x) <= endOf(d); x = addDays(x, 1)) marks.set(dayKey(x), d.own ? "own" : "pub");
  }
  const bridge = new Set(breaks.flatMap((b) => b.take));
  const bk = breaks[0] ? describeBreak(breaks[0]) : null;

  const picker = (
    <div className="do-where">
      <select value={country} onChange={(e) => patch({ country: e.target.value })} aria-label="Country for public holidays">
        <option value="">holidays for… pick a country</option>
        {list.map((c) => <option key={c.countryCode} value={c.countryCode}>{flagOf(c.countryCode)} {c.name}</option>)}
        {country && !list.some((c) => c.countryCode === country) && <option value={country}>{countryName(country)}</option>}
      </select>
    </div>
  );

  return (
    <div className="do">
      <div className="do-wall">
        <div className="do-rings" aria-hidden="true"><i /><i /><i /><i /><i /></div>
        <div className="do-head">
          {expanded ? <button className="x-btn" onClick={() => setMonth(month - 1)} aria-label="Previous month">◀</button> : <span />}
          <b>{first.toLocaleDateString(undefined, { month: "long", year: "numeric" })}</b>
          {expanded ? <button className="x-btn" onClick={() => setMonth(month + 1)} aria-label="Next month">▶</button> : <span />}
        </div>
        <div className="do-grid" role="grid" aria-label="Calendar">
          {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => <span key={i} className="do-dow">{d}</span>)}
          {Array.from({ length: lead }, (_, i) => <span key={`l${i}`} />)}
          {Array.from({ length: dim }, (_, i) => {
            const key = dayKey(new Date(first.getFullYear(), first.getMonth(), i + 1));
            const wk = [0, 6].includes((lead + i) % 7);
            return (
              <span key={key} className={`do-day${wk ? " wk" : ""}${marks.get(key) ? ` ${marks.get(key)}` : ""}${key === t ? " today" : ""}${bridge.has(key) ? " bridge" : ""}`}>
                {i + 1}
              </span>
            );
          })}
        </div>
      </div>

      {!country && !days.length ? (
        <Empty action={picker}>when is your next day off?</Empty>
      ) : (
        <div className="do-count">
          {next ? (
            <>
              <b>{inDays(Math.max(0, dayDiff(today, keyToDate(next.date))))}</b>
              <span>{next.name} · {short(next.date)}</span>
            </>
          ) : <span>nothing coming up.</span>}
          {bk && breaks[0] && <em>{breaks[0].take.length ? `book ${bk.takeLabel} off: ${bk.deal.replace("take 1 day off, ", "")}` : `long weekend ${bk.span}`}</em>}
          {expanded && nextOwn && nextOwn !== next && <em>your next: {nextOwn.name} {inDays(Math.max(0, dayDiff(today, keyToDate(nextOwn.date))))}</em>}
        </div>
      )}

      {!expanded && (coming.length > 1 || done.length > 0) && <button className="mini-btn ghost do-more" onClick={openBig}>+ {Math.max(0, coming.length - 1)} more · long weekends</button>}

      {expanded && (
        <>
          {breaks.length > 0 && (
            <div className="do-breaks">
              <div className="do-h">long weekends</div>
              {breaks.map((b) => {
                const d = describeBreak(b);
                return (
                  <div key={b.start} className={`do-break${b.take.length ? " bridge" : ""}`}>
                    <b>{d.span}</b>
                    <span>{b.names.join(" + ")} · {d.deal}{d.takeLabel ? ` (${d.takeLabel})` : ""}</span>
                    <em>{inDays(b.days)}</em>
                  </div>
                );
              })}
            </div>
          )}

          <div className="do-add">
            <input className="line-input" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="a day off or trip…" aria-label="Label" />
            <input type="date" value={from} min={t} onChange={(e) => setFrom(e.target.value)} aria-label="From" />
            <input type="date" value={to} min={from || t} onChange={(e) => setTo(e.target.value)} aria-label="To (optional)" />
            <button className="mini-btn" onClick={add} disabled={!from}>add</button>
          </div>

          <ul className="do-list">
            {coming.slice(0, 14).map((d) => (
              <li key={d.id ?? `${d.date}-${d.name}`} className={d.own ? "own" : ""}>
                <time>{short(d.date)}{d.end && d.end !== d.date ? ` – ${short(d.end)}` : ""}</time>
                <span>{d.name}</span>
                {d.own && <button className="x-btn" onClick={() => patch({ days: days.filter((x) => x.id !== d.id) })} aria-label={`Remove ${d.name}`}>✕</button>}
              </li>
            ))}
          </ul>

          {done.length > 0 && (
            <div className="do-done">
              <button className="pile-toggle" onClick={() => setShowDone(!showDone)} aria-expanded={showDone}>
                done pile · {done.length} {showDone ? "▾" : "▸"}
              </button>
              {showDone && (
                <ul className="do-list gone">
                  {done.map((d) => <li key={d.id ?? `${d.date}-${d.name}`}><time>{short(d.date)}</time><span>{d.name}</span></li>)}
                </ul>
              )}
            </div>
          )}
          <Fold label="country" start={!country}>{picker}</Fold>
        </>
      )}

      <Credit at={hols.length ? Date.now() : null} loading={busy} error={err} reload={country ? () => setNonce(nonce + 1) : undefined}>Nager.Date</Credit>
    </div>
  );
}
