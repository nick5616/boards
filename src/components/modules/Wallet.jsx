import { useState, useEffect } from "react";
import { uid as newUid } from "../../utils/uid";
import { dayKey } from "../../utils/date";
import { ratesFor, allowance, spendInTrip, fmtMoney, symbolOf, currencyName } from "../../lib/travel";
import { Empty, Fold, Credit } from "./kit";

// A paper bill, drawn: the symbol big in the middle
function Bill({ cur, tilt, tint }) {
  return (
    <div className="wl-bill" style={{ transform: `rotate(${tilt}deg)`, background: tint }}>
      <span>{symbolOf(cur)}</span>
      <em>{cur}</em>
    </div>
  );
}

// An envelope of foreign money for a trip. The small card shows what's left today and one
// quick "spend"; the converter, budget, dates and spend log live in the big view.
// Rates are the European Central Bank's, via Frankfurter (no key), kept 6 hours.
// State: home / trip currency codes, budget (in the trip currency), start / end "YYYY-MM-DD",
// spends [{ id, day, label, amt, cur, rate (trip per 1 home, as of that moment) }].
export default function Wallet({ mod, setState, expanded, openBig }) {
  const { home = "USD", trip = "EUR", budget = 0, start = "", end = "", spends = [] } = mod.state;
  const [fx, setFx] = useState(null); // { rates, date, at, stale }
  const [err, setErr] = useState(false);
  const [busy, setBusy] = useState(false);
  const [conv, setConv] = useState("100");
  const [flip, setFlip] = useState(false); // converter direction: false = home → trip
  const [amt, setAmt] = useState("");
  const [label, setLabel] = useState("");
  const [curIn, setCurIn] = useState("trip"); // which currency the spend is typed in

  const load = (force) => {
    setErr(false);
    setBusy(true);
    ratesFor(home, force).then(setFx).catch(() => setErr(true)).finally(() => setBusy(false));
  };
  useEffect(() => { load(false); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [home]);

  const rate = trip === home ? 1 : fx?.rates?.[trip]; // trip per 1 home
  const codes = fx ? [...new Set([fx.base, ...Object.keys(fx.rates)])].sort() : [home, trip];
  const patch = (f) => setState((s) => ({ ...s, ...f }));
  const a = allowance({ budget, trip, spends, start, end });
  const fmt = (n, c = trip) => fmtMoney(n, c);

  const c = parseFloat(conv);
  const converted = rate && Number.isFinite(c) ? (flip ? c / rate : c * rate) : null;

  const log = () => {
    const n = parseFloat(amt);
    if (!(n > 0) || !rate) return;
    const cur = curIn === "trip" ? trip : home;
    patch({ spends: [{ id: newUid(), day: dayKey(), label: label.trim(), amt: n, cur, rate }, ...spends] });
    setAmt("");
    setLabel("");
  };

  const sorted = [...spends].sort((x, y) => y.day.localeCompare(x.day));
  const pct = a && budget ? Math.min(100, Math.max(0, (a.total / budget) * 100)) : 0;
  const rateText = trip === home ? "same as home" : rate ? `1 ${home} = ${rate < 10 ? rate.toFixed(3) : rate.toFixed(2)} ${trip}` : "";

  const settings = (
    <div className="wl-set">
      <label>home <select value={home} onChange={(e) => patch({ home: e.target.value })}>{codes.map((k) => <option key={k}>{k}</option>)}</select></label>
      <label>trip <select value={trip} onChange={(e) => patch({ trip: e.target.value })}>{codes.map((k) => <option key={k}>{k}</option>)}</select></label>
      <label>budget ({trip}) <input className="line-input" inputMode="decimal" defaultValue={budget || ""} placeholder="800" onChange={(e) => patch({ budget: Math.max(0, parseFloat(e.target.value) || 0) })} /></label>
      <label>from <input type="date" value={start} onChange={(e) => patch({ start: e.target.value })} /></label>
      <label>to <input type="date" value={end} min={start} onChange={(e) => patch({ end: e.target.value })} /></label>
    </div>
  );

  return (
    <div className="wl">
      <div className="wl-env">
        <div className="wl-bills" aria-hidden="true">
          <Bill cur={home} tilt={-7} tint="#dbe9d3" />
          <Bill cur={trip} tilt={5} tint="#f3e3b8" />
        </div>
        <div className="wl-flap">
          <b>{currencyName(trip)}</b>
          <span>{rateText || (err ? "no rate yet" : "checking the rate…")}</span>
        </div>
      </div>

      {a ? (
        <div className="wl-left">
          <div className={`wl-big${a.todayLeft != null && a.todayLeft < 0 ? " over" : ""}`}>
            <b>{fmt(Math.abs(a.todayLeft ?? a.left))}</b>
            <span>{a.todayLeft == null ? "left" : a.todayLeft < 0 ? "over today's share" : "left today"}</span>
          </div>
          <div className="wl-meter" role="img" aria-label={`${Math.round(pct)}% of the budget spent`}><i style={{ width: `${pct}%` }} /></div>
          <small>{fmt(a.total)} of {fmt(budget)} spent{a.daysLeft ? ` · ${a.daysLeft} ${a.daysLeft === 1 ? "day" : "days"} to go` : ""}</small>
        </div>
      ) : (
        !expanded && <Empty action={<button className="mini-btn" onClick={openBig}>set a budget</button>}>how much is the trip?</Empty>
      )}

      <div className="wl-add">
        <input className="line-input wl-amt" inputMode="decimal" value={amt} onChange={(e) => setAmt(e.target.value)} onKeyDown={(e) => e.key === "Enter" && log()} placeholder="spent…" aria-label="Amount spent" />
        <button className="mini-btn ghost" onClick={() => setCurIn(curIn === "trip" ? "home" : "trip")} aria-label={`In ${curIn === "trip" ? trip : home}; tap to switch`}>{curIn === "trip" ? trip : home}</button>
        <button className="mini-btn" onClick={log} disabled={!(parseFloat(amt) > 0) || !rate}>spend</button>
      </div>

      {expanded && (
        <>
          <input className="line-input" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="what for (optional)" aria-label="What for" />
          <div className="wl-conv">
            <input className="line-input" inputMode="decimal" value={conv} onChange={(e) => setConv(e.target.value)} aria-label={`Amount in ${flip ? trip : home}`} />
            <span>{flip ? trip : home}</span>
            <button className="x-btn" onClick={() => setFlip(!flip)} aria-label="Swap direction">⇄</button>
            <b>{converted != null ? fmt(converted, flip ? home : trip) : "…"}</b>
          </div>
          {sorted.length > 0 && (
            <ul className="wl-list">
              {sorted.slice(0, 40).map((s) => (
                <li key={s.id}>
                  <span>{s.label || "spend"}<small>{s.day.slice(5)}</small></span>
                  <span className="wl-amount">
                    {fmt(s.amt, s.cur)}
                    {s.cur !== trip && <small>= {fmt(spendInTrip(s, trip))} @ {s.rate < 10 ? s.rate.toFixed(3) : s.rate.toFixed(2)}</small>}
                  </span>
                  <button className="x-btn" onClick={() => patch({ spends: spends.filter((x) => x.id !== s.id) })} aria-label="Remove spend">✕</button>
                </li>
              ))}
            </ul>
          )}
          <Fold label="trip settings" start={!budget}>{settings}</Fold>
        </>
      )}

      <Credit at={fx?.at} loading={busy} error={err && !fx} stale={fx?.stale} reload={() => load(true)}>ECB rates · Frankfurter</Credit>
    </div>
  );
}
