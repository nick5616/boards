import { useEffect, useState } from "react";
import { useData } from "../../contexts/DataContext";
import { addDays, dayKey, keyToDate, prettyDate, dayDiff } from "../../utils/date";
import { useContainer, Page } from "./containerKit";

// A time capsule: a tin with one surface to fill. Seal it until a date and the
// insides are put out of sight (and out of search) until then. That's a promise to
// yourself, not a lock: nothing is encrypted, and the seal can be broken early.
const CONFETTI = ["#c2244b", "#ffb703", "#3a86a8", "#6a994e", "#9d4edd", "#fb8500"];

const left = (ms) => {
  const mins = Math.max(0, Math.ceil(ms / 60000));
  const d = Math.floor(mins / 1440);
  const h = Math.floor((mins % 1440) / 60);
  const m = mins % 60;
  return d >= 2 ? { big: d, unit: "days", small: `${h} h` } : d === 1 ? { big: 1, unit: "day", small: `${h} h` } : h ? { big: h, unit: h === 1 ? "hour" : "hours", small: `${m} min` } : { big: m, unit: m === 1 ? "minute" : "minutes", small: "" };
};

export default function Capsule({ mod, setState }) {
  const { toast } = useData();
  const c = useContainer(mod, setState);
  const { sealedUntil: until, sealedAt, celebrated } = mod.state;
  const [now, setNow] = useState(() => Date.now());
  const [when, setWhen] = useState(() => dayKey(addDays(new Date(), 30)));

  // Ticks slowly, and every second for the last minute so the opening is seen
  const sealed = !!until && now < until;
  useEffect(() => {
    if (!until) return;
    const id = setInterval(() => setNow(Date.now()), until - Date.now() < 90000 ? 1000 : 20000);
    return () => clearInterval(id);
  }, [until, sealed]);

  const t = c.tab;
  const n = c.count(t);
  const party = !!until && !sealed && !celebrated;

  const seal = () => {
    const at = keyToDate(when).getTime();
    if (!(at > Date.now())) return toast({ text: "pick a day after today" });
    if (!confirm(`Seal it until ${prettyDate(when)}? Its insides are hidden until then.`)) return;
    setState((s) => ({ ...s, sealedUntil: at, sealedAt: Date.now(), celebrated: false }));
    setNow(Date.now());
  };
  const celebrate = () => setState((s) => ({ ...s, celebrated: true }));
  const breakSeal = () => {
    if (!confirm("Break the seal early? It opens right now.")) return;
    setState((s) => ({ ...s, sealedUntil: null, sealedAt: null, celebrated: true }));
  };
  const chip = (days) => setWhen(dayKey(addDays(new Date(), days)));
  const min = dayKey(addDays(new Date(), 1));

  if (sealed) {
    const l = left(until - now);
    return (
      <div className="cp cp-sealed">
        <div className="cp-tin">
          <i className="rivet a" /><i className="rivet b" /><i className="rivet c" /><i className="rivet d" />
          <div className="cp-wax" aria-hidden="true"><span>⏳</span></div>
          <div className="cp-count">
            <b>{l.big}</b>
            <span>{l.unit}{l.small ? ` · ${l.small}` : ""}</span>
          </div>
          <div className="cp-inside">{n === null ? "a shared tab inside" : `${n} thing${n === 1 ? "" : "s"} inside`}</div>
          <div className="cp-date">opens {prettyDate(dayKey(until))}{sealedAt ? ` · sealed ${dayDiff(sealedAt, new Date()) <= 0 ? "today" : `${dayDiff(sealedAt, new Date())}d ago`}` : ""}</div>
          <p className="cp-honest">Hidden from view and from search, but not encrypted — it's a promise, not a vault.</p>
          <button className="cp-break" onClick={breakSeal}>break the seal early</button>
        </div>
      </div>
    );
  }

  return (
    <div className="cp">
      <div className="cp-lid">
        {party ? (
          <div className="cp-party">
            <div className="cp-confetti" aria-hidden="true">
              {Array.from({ length: 26 }, (_, k) => (
                <i key={k} style={{ "--x": `${(k * 37) % 100}%`, "--d": `${(k % 7) * 0.12}s`, "--c": CONFETTI[k % CONFETTI.length], "--r": `${(k * 53) % 360}deg` }} />
              ))}
            </div>
            <b>It's open! 🎉</b>
            <span>sealed {sealedAt ? `${Math.max(1, dayDiff(sealedAt, new Date()))} days ago` : "a while back"} — see what past you left</span>
            <button className="cp-btn" onClick={celebrate}>lovely</button>
          </div>
        ) : (
          <div className="cp-seal-row">
            <label>
              <small>seal it until</small>
              <input type="date" value={when} min={min} onChange={(e) => e.target.value && setWhen(e.target.value)} />
            </label>
            <span className="cp-chips">
              <button onClick={() => chip(7)}>1 wk</button>
              <button onClick={() => chip(30)}>1 mo</button>
              <button onClick={() => chip(365)}>1 yr</button>
            </span>
            <button className="cp-btn" onClick={seal} disabled={!n}>🔒 Seal it</button>
          </div>
        )}
        {!party && until && celebrated && <div className="cp-was">opened on {prettyDate(dayKey(until))} · seal it again whenever</div>}
      </div>
      <div className="cp-bin">
        <div className="cp-bin-bar">
          <span>{n === 0 ? "nothing in it yet" : `${n} thing${n === 1 ? "" : "s"} inside`}</span>
          {n !== null && <button onClick={() => c.addHere()}>+ add</button>}
        </div>
        <Page mod={mod} tab={t.id} />
      </div>
      {c.menuNode}
    </div>
  );
}

// "⏳ capsule opens in 12 days" for the home glance
export const capsuleSays = (mods, now = Date.now()) => {
  const next = mods.map((m) => m.state.sealedUntil).filter((u) => u && u > now).sort((a, b) => a - b)[0];
  if (!next) return null;
  const d = Math.max(1, Math.ceil((next - now) / 86400000));
  return `⏳ capsule opens in ${d} day${d === 1 ? "" : "s"}`;
};
