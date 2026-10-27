import { useEffect, useState } from "react";
import { useContainer, Page, countLabel } from "./containerKit";

// The clock: a container whose tabs belong to times of day and days of the week.
// It opens whichever tab fits right now, so the board shows the right things at the
// right time. Tap a tab to pin it open; "auto" hands it back to the clock.
const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];
const DAY_LETTERS = ["S", "M", "T", "W", "T", "F", "S"];
const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

// 5 → "5a", 12 → "12p", 24 → "12a"
export const hourLabel = (h) => `${h % 12 === 0 ? 12 : h % 12}${h % 24 < 12 ? "a" : "p"}`;

const daysOf = (t) => t.days ?? ALL_DAYS;
const inHours = (t, h) => {
  const from = t.from ?? 0;
  const to = t.to ?? 24;
  return from <= to ? h >= from && h < to : h >= from || h < to; // an evening can run past midnight
};

// The tab for this moment: of those that fit, the one on the fewest days wins
// (so "Weekend" beats "Evening" on a Saturday night), then the earlier in the list.
export function tabNow(tabs, now = new Date()) {
  const h = now.getHours() + now.getMinutes() / 60;
  const fits = tabs.filter((t) => !t.mount && daysOf(t).includes(now.getDay()) && inHours(t, h));
  return fits.reduce((best, t) => (!best || daysOf(t).length < daysOf(best).length ? t : best), null);
}

export const rangeLabel = (t) => {
  const days = daysOf(t);
  const d = days.length === 7 ? "" : days.join() === "0,6" ? " · weekends" : days.join() === "1,2,3,4,5" ? " · weekdays" : ` · ${days.map((x) => DAY_LETTERS[x]).join("")}`;
  return `${(t.from ?? 0) === 0 && (t.to ?? 24) === 24 ? "all day" : `${hourLabel(t.from ?? 0)}–${hourLabel(t.to ?? 24)}`}${d}`;
};

// A sun and a moon on a turning disc under a fixed pointer: noon puts the sun on top
function Dial({ now }) {
  const h = now.getHours() + now.getMinutes() / 60;
  return (
    <svg className="dp-dial" viewBox="0 0 80 80" role="img" aria-label="Sun and moon dial">
      <defs>
        <radialGradient id="dp-glass" cx="35%" cy="28%" r="70%">
          <stop offset="0" stopColor="#fff" stopOpacity=".55" />
          <stop offset=".5" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="dp-brass" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f3d98a" />
          <stop offset=".5" stopColor="#b98a2e" />
          <stop offset="1" stopColor="#7a5514" />
        </linearGradient>
      </defs>
      <circle cx="40" cy="40" r="38" fill="url(#dp-brass)" />
      <circle cx="40" cy="40" r="33" fill="#1f2a4a" />
      <g className="dp-disc" style={{ transform: `rotate(${(h - 12) * 15}deg)` }}>
        {/* the day half of the sky, on the sun's side */}
        <path d="M7 40a33 33 0 0 1 66 0z" fill="#8fd0f5" />
        <circle cx="40" cy="15" r="6.5" fill="#ffd23f" stroke="#e8a317" strokeWidth="1.4" />
        {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => (
          <path key={a} d="M40 4.5v3.2" stroke="#e8a317" strokeWidth="1.5" strokeLinecap="round" transform={`rotate(${a} 40 15)`} />
        ))}
        <circle cx="40" cy="65" r="6.5" fill="#f4efe0" />
        <circle cx="43" cy="63.2" r="5.4" fill="#1f2a4a" />
        {[[22, 52], [58, 56], [30, 63], [52, 46]].map(([x, y], k) => (
          <circle key={k} cx={x} cy={y} r="0.9" fill="#fff" />
        ))}
      </g>
      <circle cx="40" cy="40" r="33" fill="url(#dp-glass)" />
      <path d="M40 2.5l-4 7h8z" fill="#c2244b" stroke="#6b0f1f" strokeWidth="1" strokeLinejoin="round" />
    </svg>
  );
}

export default function DayParts({ mod, setState }) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 20000);
    return () => clearInterval(id);
  }, []);
  const [editing, setEditing] = useState(null); // tab id whose times are open for editing

  const pinned = !!mod.state.pin;
  const fits = tabNow(mod.state.tabs, now);
  const c = useContainer(mod, setState, { shown: pinned ? undefined : fits?.id });
  const t = c.tab;
  const e = c.tabs.find((x) => x.id === editing);
  const clock = now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

  const toggleDay = (d) => {
    const days = daysOf(e).includes(d) ? daysOf(e).filter((x) => x !== d) : [...daysOf(e), d].sort();
    if (days.length) c.patchTab(e.id, { days });
  };
  const hours = Array.from({ length: 25 }, (_, h) => h);

  return (
    <div className="dp">
      <div className="dp-top">
        <Dial now={now} />
        <div className="dp-says">
          <b>{DAY_NAMES[now.getDay()]}, {clock}</b>
          <span>
            {pinned ? <>📌 holding on <u>{t?.name}</u></> : fits ? <>showing <u>{fits.name}</u> — it's that time</> : "nothing fits this hour, so here's the last one"}
          </span>
        </div>
        <button
          className={`dp-pin${pinned ? " on" : ""}`}
          onClick={() => setState((s) => ({ ...s, pin: !s.pin, active: s.pin ? s.active : t?.id ?? s.active }))}
          title={pinned ? "Let the clock choose again" : "Keep this tab open whatever the time"}
        >
          {pinned ? "↺ auto" : "📌 pin"}
        </button>
      </div>
      <div className="dp-tags" role="tablist">
        {c.tabs.map((x) => {
          const on = x.id === c.active;
          const itsTime = fits?.id === x.id;
          return (
            <div key={x.id} className={`dp-tag${on ? " on" : ""}${itsTime ? " now" : ""}`} style={{ "--tab": c.color(x) }} onContextMenu={(ev) => c.openMenu(x, ev)}>
              <button
                role="tab"
                aria-selected={on}
                className="dp-tag-main"
                onClick={on ? (ev) => c.openMenu(x, ev) : () => setState((s) => ({ ...s, active: x.id, pin: true }))}
                title={on ? "Options" : `Open ${x.name} and pin it`}
              >
                <span>{itsTime ? "☀ " : ""}{x.name}{on && <i className="dp-caret">▾</i>}</span>
                <small>{x.mount ? "shared" : rangeLabel(x)}</small>
              </button>
              {!x.mount && <button className="dp-clock" onClick={() => setEditing(editing === x.id ? null : x.id)} aria-label={`Set times for ${x.name}`} title="Set the times">⏰</button>}
            </div>
          );
        })}
        <button className="dp-new" onClick={() => c.add("Late night", { from: 22, to: 5, days: ALL_DAYS })} aria-label="New part of the day" title="New part of the day">+</button>
      </div>
      {e && (
        <div className="dp-edit" style={{ "--tab": c.color(e) }}>
          <b>{e.name}</b>
          <label>
            from
            <select value={e.from ?? 0} onChange={(ev) => c.patchTab(e.id, { from: +ev.target.value })}>
              {hours.slice(0, 24).map((h) => <option key={h} value={h}>{hourLabel(h)}</option>)}
            </select>
          </label>
          <label>
            to
            <select value={e.to ?? 24} onChange={(ev) => c.patchTab(e.id, { to: +ev.target.value })}>
              {hours.slice(1).map((h) => <option key={h} value={h}>{hourLabel(h)}</option>)}
            </select>
          </label>
          <span className="dp-days">
            {ALL_DAYS.map((d) => (
              <button key={d} className={daysOf(e).includes(d) ? "on" : ""} onClick={() => toggleDay(d)} aria-label={DAY_NAMES[d]} aria-pressed={daysOf(e).includes(d)}>
                {DAY_LETTERS[d]}
              </button>
            ))}
          </span>
          <button className="dp-ok" onClick={() => setEditing(null)}>ok</button>
        </div>
      )}
      <div className="dp-face" style={{ "--tab": c.color(t) }}>
        <div className="dp-face-bar">
          <span>{t.name} · {countLabel(c.count(t))}</span>
          {c.count(t) !== null && <button onClick={() => c.addHere()}>+ add</button>}
        </div>
        <Page mod={mod} tab={t.id} />
      </div>
      {c.menuNode}
    </div>
  );
}
