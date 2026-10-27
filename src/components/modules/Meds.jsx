import { useState, useEffect, useRef } from "react";
import { useData } from "../../contexts/DataContext";
import { agoLabel, prettyDate, dayKey, addDays } from "../../utils/date";
import MedArt, { HINTS, Pill } from "./MedArt";
import {
  CONTAINERS, TINTS, PILL_SHAPES, PILL_COLORS, NOTE_COLORS, UNITS, WEEK, SITES, siteLabel, injectable, newMed,
  clockLabel, atLabel, shortDate, openSlots, nextSlot, notAgainUntil, leftLabel, whenLabel, supplyInfo, refillSoon,
  recordDose, snoozeDose, punchDays, recentSites, usesPill, unitOf,
} from "../../lib/meds";

// A medicine cabinet: the next med due sits front and centre, the rest stand on the
// shelf below. Each one is a drawn container you open to take it (twist the cap, press
// the plunger, pop a bubble...). It only keeps a record of what you type in and when
// you took it; it never works out a dose, and a late dose is just "taken at 9:12".
export default function Meds({ board, mod, setState, entries, expanded, openBig }) {
  const data = useData();
  const { toast } = data;
  const { meds = [], notify = false, hideNames = false } = mod.state;
  const [now, setNow] = useState(Date.now);
  const [pick, setPick] = useState(null); // the med standing in front (null = whichever is next)
  const [go, setGo] = useState(null); // med id while its take-it animation plays
  const [ask, setAsk] = useState(null); // { medId, text, run }: "not due yet, log it anyway?"
  const [ed, setEd] = useState(null); // { isNew, med }: the editor's draft
  const timers = useRef([]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 20000);
    return () => {
      clearInterval(t);
      timers.current.forEach(clearTimeout);
    };
  }, []);

  const mine = entries.filter((e) => e.kind === "dose" && e.moduleId === mod.id);

  // Due ones first, then the soonest coming up, then as-needed, then the rest
  const ranked = meds
    .map((m) => ({ m, slot: nextSlot(m, now) }))
    .sort((a, b) => {
      const rank = (x) => (x.slot?.due ? 0 : x.slot ? 1 : x.m.asNeeded ? 2 : 3);
      return rank(a) - rank(b) || (a.slot?.at ?? 0) - (b.slot?.at ?? 0);
    });
  const front = meds.find((m) => m.id === pick) ?? ranked[0]?.m;

  const setMeds = (fn) => setState((s) => ({ ...s, meds: fn(s.meds ?? []) }));

  // Plays the animation, then records the dose halfway through
  const fire = (med, site = null, slot = openSlots(med, now)[0] ?? null) => {
    if (go) return;
    setAsk(null);
    setGo(med.id);
    timers.current.push(
      setTimeout(() => recordDose(data, board.id, mod.id, med, { slot, site }), 650),
      setTimeout(() => setGo(null), 1500)
    );
  };

  // Tapping the container: straight away if it's due, a gentle "sure?" if it isn't
  const tapTake = (med, site = null) => {
    const due = openSlots(med, now)[0];
    if (due) return fire(med, site, due);
    if (med.asNeeded) {
      const wait = notAgainUntil(med, now);
      const go1 = () => fire(med, site, null);
      return wait ? setAsk({ medId: med.id, text: `You set “not again for ${med.minHours} hours”: ${leftLabel(wait - now)} to go.`, run: go1 }) : go1();
    }
    const next = nextSlot(med, now);
    if (!next) return setAsk({ medId: med.id, text: "Nothing's scheduled right now. Log one anyway?", run: () => fire(med, site, null) });
    setAsk({ medId: med.id, text: `Not due until ${whenLabel(next, now)}. Log it now for that dose?`, run: () => fire(med, site, next) });
  };

  const skip = (med) => recordDose(data, board.id, mod.id, med, { slot: openSlots(med, now)[0] ?? null, status: "skipped" });
  const snooze = (med) => snoozeDose(data, board.id, mod.id, med, 15);

  const toggleBell = async () => {
    if (notify) return setState((s) => ({ ...s, notify: false }));
    if (!("Notification" in window)) return toast({ text: "this browser can't show notifications; the dock still shows what's due" });
    let perm = Notification.permission;
    if (perm === "default") perm = await Notification.requestPermission();
    if (perm === "granted") {
      setState((s) => ({ ...s, notify: true }));
      toast({ text: "ok: I'll ping you while boards is open in a tab" });
    } else toast({ text: "notifications are blocked in this browser; the dock still shows what's due" });
  };

  const ctl = { now, go, ask, setAsk, tapTake, skip, snooze, entries: mine, openBig };

  if (!expanded) {
    return (
      <div className="meds">
        <div className="mc-cabinet">
          <div className="mc-top">
            <span className="mc-plate">medicine</span>
            <Switches notify={notify} hideNames={hideNames} onBell={toggleBell} onHide={() => setState((s) => ({ ...s, hideNames: !s.hideNames }))} compact />
          </div>
          {front ? (
            <Stage med={front} ctl={ctl} />
          ) : (
            <div className="mc-empty">
              <div className="mc-empty-art" aria-hidden="true"><i /><b /></div>
              <p>nothing on the shelf yet</p>
              <button className="mini-btn" onClick={openBig}>+ add a med</button>
            </div>
          )}
          {meds.length > 0 && (
            <div className="mc-shelf">
              {ranked.map(({ m, slot }) => (
                <Mini key={m.id} med={m} on={m.id === front?.id} due={!!slot?.due} onPick={() => setPick(m.id)} />
              ))}
              <button className="mc-add" onClick={openBig} aria-label="Add a med">+</button>
            </div>
          )}
        </div>
        {meds.length > 0 && (
          <div className="mc-foot">
            {notify ? "pings only while boards is open in a tab" : "tap the container to take it"} ·{" "}
            <button className="mc-link" onClick={openBig}>open big</button>
          </div>
        )}
      </div>
    );
  }

  // ── big ───────────────────────────────────────────────────────────────────
  const sel = ed ? null : front;
  const startNew = () => setEd({ isNew: true, med: newMed("bottle") });
  const save = () => {
    const m = { ...ed.med, name: ed.med.name.trim() };
    setMeds((ms) => (ed.isNew ? [...ms, m] : ms.map((x) => (x.id === m.id ? m : x))));
    setPick(m.id);
    setEd(null);
  };
  const remove = (med) => {
    if (!confirm(`Take “${med.name || "this med"}” off the shelf? Its history stays in your records.`)) return;
    setMeds((ms) => ms.filter((x) => x.id !== med.id));
    setPick(null);
    setEd(null);
  };

  return (
    <div className="meds big">
      <p className="mc-honest">
        This only keeps a record of what you tell it and when you took it. It can’t tell you what or how much to take: that’s for you and your care team.
      </p>
      <div className="mc-cabinet">
        <div className="mc-top">
          <span className="mc-plate">medicine</span>
          <Switches notify={notify} hideNames={hideNames} onBell={toggleBell} onHide={() => setState((s) => ({ ...s, hideNames: !s.hideNames }))} />
        </div>
        <div className="mc-shelf">
          {ranked.map(({ m, slot }) => (
            <Mini key={m.id} med={m} on={!ed && m.id === front?.id} due={!!slot?.due} onPick={() => { setEd(null); setPick(m.id); }} />
          ))}
          <button className="mc-add" onClick={startNew} aria-label="Add a med">+<span>new</span></button>
        </div>
      </div>
      <p className="mc-note">
        {notify
          ? "🔔 on: reminders only work while boards is open in a browser tab. Push to a closed tab needs the server plan, coming later."
          : "🔕 reminders show here and in the dock while boards is open in a tab. Tap the bell to also get a browser notification."}
        {hideNames && " Names are kept off the home screen, the dock and pings."}
      </p>

      {ed && <Editor ed={ed} setEd={setEd} onSave={save} onRemove={ed.isNew ? null : () => remove(ed.med)} />}
      {sel && <Detail med={sel} ctl={ctl} onEdit={() => setEd({ isNew: false, med: structuredClone(sel) })} />}
      {!ed && !sel && (
        <div className="mc-empty">
          <div className="mc-empty-art" aria-hidden="true"><i /><b /></div>
          <p>nothing on the shelf yet</p>
          <button className="mini-btn" onClick={startNew}>+ add your first med</button>
        </div>
      )}
    </div>
  );
}

function Switches({ notify, hideNames, onBell, onHide, compact }) {
  return (
    <span className="mc-switches">
      <button className={`mc-sw${notify ? " on" : ""}`} onClick={onBell} aria-pressed={notify} title={notify ? "Notifications on (only while boards is open)" : "Ask me with a notification"}>
        {notify ? "🔔" : "🔕"}{!compact && <span>{notify ? "pings on" : "pings off"}</span>}
      </button>
      <button className={`mc-sw${hideNames ? " on" : ""}`} onClick={onHide} aria-pressed={hideNames} title="Keep names off the home screen, the dock and pings">
        {hideNames ? "🙈" : "👁"}{!compact && <span>{hideNames ? "names hidden elsewhere" : "hide names elsewhere"}</span>}
      </button>
    </span>
  );
}

const UNIT_FOR = { syringe: "doses", pen: "doses", vial: "mL", dropper: "mL", inhaler: "puffs", tube: "doses", jar: "pills" };

// A small container standing on the shelf
function Mini({ med, on, due, onPick }) {
  const low = refillSoon(med);
  return (
    <button className={`mc-mini${on ? " on" : ""}${due ? " due" : ""}`} onClick={onPick} aria-label={`${med.name || "med"}${due ? ", due now" : ""}`} title={med.name}>
      <MedArt med={med} mini />
      <span className="mc-mini-name">{med.name || "new"}</span>
      {low && <i className="mc-mini-tag">refill</i>}
    </button>
  );
}

// The line under a med's name: what's next, what's due, what's done
function statusOf(med, now) {
  const wait = notAgainUntil(med, now);
  if (med.asNeeded) {
    const last = med.lastAt ? `last ${agoLabel(med.lastAt) === "today" ? atLabel(med.lastAt) : agoLabel(med.lastAt)}` : "none yet";
    return { text: wait ? `as needed · ${leftLabel(wait - now)} left of the gap you set` : `as needed · ${last}`, due: false };
  }
  const next = nextSlot(med, now);
  if (!next) return { text: med.times?.length ? "nothing coming up" : "no times set", due: false };
  if (next.due) return { text: `due ${whenLabel(next, now)}`, due: true };
  return { text: `next ${whenLabel(next, now)}`, due: false };
}

function Stage({ med, ctl, big, site }) {
  const { now, go, ask, setAsk, tapTake, skip, snooze, entries } = ctl;
  const status = statusOf(med, now);
  const sup = supplyInfo(med);
  const week = med.container === "organizer" ? weekOf(med, entries) : undefined;
  const mine = ask?.medId === med.id ? ask : null;
  return (
    <div className={`mc-stage${status.due ? " due" : ""}`}>
      <div className="mc-hero">
        <MedArt med={med} go={go === med.id} week={week} onGo={() => tapTake(med, site)} />
        <div className="mc-hint">{HINTS[med.container]}</div>
      </div>
      <div className="mc-info">
        <div className="mc-name-big">{med.name || "unnamed"}</div>
        {(med.strength || usesPill(med)) && (
          <div className="mc-strength">
            {usesPill(med) && <svg viewBox="0 0 36 18" width="36" height="18" aria-hidden="true"><Pill x={18} y={9} s={4.6} shape={med.pill?.shape} color={med.pill?.color} color2={med.pill?.color2} /></svg>}
            {med.strength}
          </div>
        )}
        <div className={`mc-when${status.due ? " due" : ""}`}>{status.due && "⏰ "}{status.text}</div>
        {sup && (
          <div className="mc-supply">
            {Math.round(sup.left * 10) / 10} {unitOf(sup.unit, sup.left)} left
            {sup.runOut && <> · refill around {shortDate(sup.runOut)}</>}
            {sup.low && <b className="mc-low">refill soon</b>}
          </div>
        )}
        {mine && (
          <div className="mc-ask" role="alertdialog">
            <p>{mine.text}</p>
            <button className="mini-btn" onClick={mine.run}>log it now</button>
            <button className="mini-btn ghost" onClick={() => setAsk(null)}>never mind</button>
          </div>
        )}
        {status.due && !mine && (
          <div className="mc-actions">
            <button className="mini-btn mc-took" onClick={() => tapTake(med, site)} disabled={go === med.id}>took it</button>
            <button className="mini-btn ghost" onClick={() => snooze(med)}>snooze 15 min</button>
            <button className="mini-btn ghost" onClick={() => skip(med)}>skip</button>
          </div>
        )}
        {!big && injectable(med) && <div className="mc-sitenote">open big to note which site</div>}
      </div>
    </div>
  );
}

// Sun..Sat of this week: which lids are open (a dose was taken that day)
function weekOf(med, entries) {
  const today = new Date();
  const sun = addDays(today, -today.getDay());
  const taken = new Set(entries.filter((e) => e.medId === med.id && e.status === "taken").map((e) => e.day));
  return Array.from({ length: 7 }, (_, i) => {
    const d = addDays(sun, i);
    return { open: taken.has(dayKey(d)), today: i === today.getDay() };
  });
}

// ── a med opened big ────────────────────────────────────────────────────────
function Detail({ med, ctl, onEdit }) {
  const { now, entries } = ctl;
  const [site, setSite] = useState(null);
  const mine = entries.filter((e) => e.medId === med.id);
  const inj = injectable(med);
  const recent = recentSites(med, entries, 4);
  return (
    <div className="mc-detail">
      <Stage med={med} ctl={ctl} big site={inj ? site : null} />
      <MedPaper med={med} />
      {inj && (
        <div className="mc-card">
          <div className="mc-card-h">where this one goes</div>
          <SiteMap recent={recent} value={site} onPick={(id) => setSite((s) => (s === id ? null : id))} />
        </div>
      )}
      <div className="mc-card">
        <div className="mc-card-h">pharmacy punch card · last 28 days</div>
        <Punch days={punchDays(med, entries, 28)} />
      </div>
      <div className="mc-card">
        <div className="mc-card-h">schedule</div>
        <div className="mc-sched">{scheduleText(med)}</div>
        {(med.start || med.end) && <div className="mc-sched">{med.start && `from ${shortDate(new Date(med.start + "T00:00"))}`}{med.start && med.end && " "}{med.end && `until ${shortDate(new Date(med.end + "T00:00"))}`}</div>}
      </div>
      {mine.length > 0 && (
        <div className="mc-card">
          <div className="mc-card-h">lately</div>
          {mine.slice(0, 8).map((e) => (
            <div key={e.id} className={`mc-row ${e.status}`}>
              <span>{agoLabel(e.at) === "today" ? "today" : prettyDate(e.day)} · {atLabel(e.at)}</span>
              <b>{e.status === "taken" ? "taken" : "skipped"}</b>
              {e.site && <em>{siteLabel(e.site)}</em>}
            </div>
          ))}
        </div>
      )}
      <button className="mini-btn" onClick={onEdit}>✏️ edit this med</button>
    </div>
  );
}

// The little label details as a typed slip, with the refill counter
function MedPaper({ med }) {
  const sup = supplyInfo(med);
  const rows = [
    med.directions && ["directions", med.directions],
    med.rx && ["Rx #", med.rx],
    med.refills !== "" && med.refills != null && ["refills left", med.refills],
    med.note && ["note", med.note],
    sup?.runOut && ["refill around", shortDate(sup.runOut)],
  ].filter(Boolean);
  if (!rows.length) return null;
  return (
    <div className="mc-paper">
      {rows.map(([k, v]) => (
        <div key={k}><span>{k}</span> {v}</div>
      ))}
    </div>
  );
}

function scheduleText(med) {
  if (med.asNeeded) return `as needed${parseFloat(med.minHours) > 0 ? ` · you set “not again for ${med.minHours} h”` : ""}`;
  const t = [...(med.times ?? [])].sort().map(clockLabel).join(", ") || "no times yet";
  const { mode = "every", dow = [], n = 2 } = med.days ?? {};
  const days = mode === "weekdays" ? "weekdays" : mode === "custom" ? dow.map((d) => ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d]).join(" ") || "no days" : mode === "every-n" ? `every ${n} days` : "every day";
  return `${t} · ${days}`;
}

// A card the pharmacy punches a hole in for each day you took it
function Punch({ days }) {
  const word = { taken: "taken", part: "some taken", skipped: "skipped", none: "nothing logged", off: "not scheduled" };
  return (
    <>
      <div className="mc-punch" role="img" aria-label="Last 28 days">
        {days.map((d) => (
          <i key={d.key} className={`${d.state}${d.today ? " today" : ""}`} title={`${shortDate(d.date)}: ${word[d.state]}`} />
        ))}
      </div>
      <div className="mc-legend"><i className="taken" />taken <i className="part" />some <i className="skipped" />skipped <i className="none" />nothing</div>
    </>
  );
}

// Tap where the last one went. The numbers are the last few, 1 = most recent.
function SiteMap({ recent, value, onPick }) {
  const rested = SITES.find((s) => !recent.includes(s.id)) ?? SITES.find((s) => s.id === recent[recent.length - 1]);
  const skin = "#f6d9bd";
  return (
    <div className="mc-sites">
      <svg viewBox="0 0 100 200" className="mc-body" role="group" aria-label="Injection sites">
        <g fill="none" strokeLinecap="round" strokeLinejoin="round">
          <path d="M31 42L22 54L18 98M69 42L78 54L82 98" stroke="#2a2520" strokeWidth="13" />
          <path d="M40 122L38 190M60 122L62 190" stroke="#2a2520" strokeWidth="19" />
          <path d="M31 42L22 54L18 98M69 42L78 54L82 98" stroke={skin} strokeWidth="9" />
          <path d="M40 122L38 190M60 122L62 190" stroke={skin} strokeWidth="15" />
        </g>
        <path d="M34 36Q50 30 66 36L71 52L69 116Q50 130 31 116L29 52Z" fill={skin} stroke="#2a2520" strokeWidth="2.4" strokeLinejoin="round" />
        <circle cx="50" cy="17" r="11" fill={skin} stroke="#2a2520" strokeWidth="2.4" />
        <rect x="45" y="26" width="10" height="10" fill={skin} />
        <circle cx="46" cy="15" r="1.2" fill="#2a2520" /><circle cx="54" cy="15" r="1.2" fill="#2a2520" />
        <path d="M46 21Q50 24 54 21" fill="none" stroke="#2a2520" strokeWidth="1.2" strokeLinecap="round" />
        <circle cx="50" cy="97" r="1.3" fill="#2a2520" opacity=".5" />
        <path d="M50 70V120M32 92H68" stroke="#2a2520" strokeOpacity=".12" strokeWidth="1" strokeDasharray="2 2" />
        {SITES.map((s) => {
          const n = recent.indexOf(s.id);
          return (
            <g key={s.id} className={`mc-site${value === s.id ? " sel" : ""}${rested?.id === s.id && n < 0 ? " rest" : ""}`} onClick={() => onPick(s.id)} role="button" tabIndex={0} aria-label={s.label} aria-pressed={value === s.id}
              onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onPick(s.id))}>
              <circle cx={s.x} cy={s.y} r="7" />
              {n >= 0 && <text x={s.x} y={s.y + 2.8} textAnchor="middle">{n + 1}</text>}
            </g>
          );
        })}
        <text x="2" y="198" className="mc-lr">your right</text>
        <text x="98" y="198" textAnchor="end" className="mc-lr">your left</text>
      </svg>
      <div className="mc-sites-text">
        <div className="mc-site-pick">{value ? <>this one: <b>{siteLabel(value)}</b></> : "tap a spot, then take it"}</div>
        {recent.length > 0 && (
          <ol className="mc-recent">
            {recent.map((id) => <li key={id}>{siteLabel(id)}</li>)}
          </ol>
        )}
        {rested && <div className="mc-rested">rested longest: {siteLabel(rested.id)}</div>}
        <div className="mc-fine">just a record of where, so you can rotate; follow your care team’s advice</div>
      </div>
    </div>
  );
}

// ── the editor, with a live preview ─────────────────────────────────────────
function Editor({ ed, setEd, onSave, onRemove }) {
  const med = ed.med;
  const set = (patch) => setEd((e) => ({ ...e, med: { ...e.med, ...patch } }));
  const setPill = (patch) => set({ pill: { ...med.pill, ...patch } });
  const setDays = (patch) => set({ days: { ...med.days, ...patch } });
  const setSupply = (patch) => set({ supply: { ...med.supply, ...patch } });
  const text = (key, props = {}) => ({ value: med[key] ?? "", onChange: (e) => set({ [key]: e.target.value }), ...props });
  const pickContainer = (id) => {
    const patch = { container: id, tint: TINTS[id].includes(med.tint) ? med.tint : TINTS[id][0] };
    // What it's counted in follows the container, until you start counting
    if (med.supply?.left === "") patch.supply = { ...med.supply, unit: UNIT_FOR[id] ?? "pills" };
    // A blister pack is all about the count; start it with a typical strip
    if (id === "blister" && med.supply?.left === "") patch.supply = { ...patch.supply, left: 14, full: 14 };
    set(patch);
  };
  const moveTime = (i, v) => set({ times: med.times.map((t, j) => (j === i ? v : t)) });
  const shape = med.pill.shape;

  return (
    <div className="mc-editor">
      <div className="mc-preview">
        <MedArt med={med} />
        <div className="mc-hint">{CONTAINERS.find((c) => c.id === med.container)?.label}</div>
      </div>
      <div className="mc-form">
        <div className="mc-grp">what it’s in</div>
        <div className="mc-picker" role="radiogroup" aria-label="Container">
          {CONTAINERS.map((c) => (
            <button key={c.id} role="radio" aria-checked={med.container === c.id} className={`mc-pick${med.container === c.id ? " sel" : ""}`} onClick={() => pickContainer(c.id)}>
              <MedArt med={{ ...med, container: c.id, tint: TINTS[c.id].includes(med.tint) ? med.tint : TINTS[c.id][0], name: med.name }} mini />
              <span>{c.label}</span>
            </button>
          ))}
        </div>
        <Chips label="colour" opts={TINTS[med.container]} value={med.tint} onPick={(v) => set({ tint: v })} />

        <div className="mc-grp">the label</div>
        <label className="mc-f">name<input className="line-input" placeholder="as it says on the label" {...text("name")} autoFocus={ed.isNew} /></label>
        <label className="mc-f">strength<input className="line-input" placeholder="e.g. 50 mg" {...text("strength")} /></label>
        <label className="mc-f">directions<input className="line-input" placeholder="copy what your label says" {...text("directions")} /></label>
        <div className="mc-two">
          <label className="mc-f">Rx #<input className="line-input" inputMode="numeric" {...text("rx")} /></label>
          <label className="mc-f">refills left<input className="line-input" inputMode="numeric" {...text("refills")} /></label>
        </div>
        <label className="mc-f">warning sticker<input className="line-input" placeholder="e.g. may cause drowsiness" {...text("note")} /></label>
        {med.note && <Chips label="sticker colour" opts={NOTE_COLORS} value={med.noteColor} onPick={(v) => set({ noteColor: v })} />}

        {usesPill(med) && (
          <>
            <div className="mc-grp">the pill</div>
            <div className="mc-chiprow">
              {PILL_SHAPES.map((p) => (
                <button key={p.id} className={`mc-chip${shape === p.id ? " sel" : ""}`} onClick={() => setPill({ shape: p.id })} aria-pressed={shape === p.id}>
                  <svg viewBox="0 0 40 20" width="40" height="20" aria-hidden="true"><Pill x={20} y={10} s={5} shape={p.id} color={med.pill.color} color2={med.pill.color2} /></svg>
                  {p.label}
                </button>
              ))}
            </div>
            <Chips label={shape === "capsule" ? "left half" : "colour"} opts={PILL_COLORS} value={med.pill.color} onPick={(v) => setPill({ color: v })} />
            {shape === "capsule" && <Chips label="right half" opts={PILL_COLORS} value={med.pill.color2} onPick={(v) => setPill({ color2: v })} />}
          </>
        )}

        <div className="mc-grp">when</div>
        <div className="mc-chiprow">
          <button className={`mc-chip${!med.asNeeded ? " sel" : ""}`} onClick={() => set({ asNeeded: false })}>at set times</button>
          <button className={`mc-chip${med.asNeeded ? " sel" : ""}`} onClick={() => set({ asNeeded: true })}>as needed</button>
        </div>
        {med.asNeeded ? (
          <label className="mc-f">show a countdown: not again for (hours)
            <input className="line-input" inputMode="decimal" placeholder="optional" {...text("minHours")} />
          </label>
        ) : (
          <>
            <div className="mc-times">
              {med.times.map((t, i) => (
                <span key={i} className="mc-time">
                  <input type="time" value={t} onChange={(e) => e.target.value && moveTime(i, e.target.value)} aria-label={`Time ${i + 1}`} />
                  {med.times.length > 1 && <button className="x-btn" onClick={() => set({ times: med.times.filter((_, j) => j !== i) })} aria-label="Remove this time">✕</button>}
                </span>
              ))}
              <button className="mini-btn" onClick={() => set({ times: [...med.times, "20:00"] })}>+ time</button>
            </div>
            <div className="mc-chiprow">
              {[["every", "every day"], ["weekdays", "weekdays"], ["custom", "pick days"], ["every-n", "every N days"]].map(([id, label]) => (
                <button key={id} className={`mc-chip${med.days.mode === id ? " sel" : ""}`} onClick={() => setDays({ mode: id })}>{label}</button>
              ))}
            </div>
            {med.days.mode === "custom" && (
              <div className="mc-dow">
                {WEEK.map((d, i) => {
                  const on = med.days.dow.includes(i);
                  return <button key={i} className={`mc-d${on ? " sel" : ""}`} aria-pressed={on} aria-label={["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][i]} onClick={() => setDays({ dow: on ? med.days.dow.filter((x) => x !== i) : [...med.days.dow, i] })}>{d}</button>;
                })}
              </div>
            )}
            {med.days.mode === "every-n" && (
              <label className="mc-f">every <input className="line-input mc-n" inputMode="numeric" value={med.days.n} onChange={(e) => setDays({ n: Math.max(1, parseInt(e.target.value) || 1) })} /> days</label>
            )}
          </>
        )}
        <div className="mc-two">
          <label className="mc-f">starts<input className="line-input" type="date" {...text("start")} /></label>
          <label className="mc-f">ends<input className="line-input" type="date" {...text("end")} /></label>
        </div>

        <div className="mc-grp">how many you have</div>
        <div className="mc-two">
          <label className="mc-f">left<input className="line-input" inputMode="decimal" placeholder="optional" value={med.supply.left} onChange={(e) => setSupply({ left: e.target.value })} /></label>
          <label className="mc-f">when full<input className="line-input" inputMode="decimal" value={med.supply.full} onChange={(e) => setSupply({ full: e.target.value })} /></label>
        </div>
        <div className="mc-chiprow">
          {UNITS.map((u) => <button key={u} className={`mc-chip${med.supply.unit === u ? " sel" : ""}`} onClick={() => setSupply({ unit: u })}>{u}</button>)}
        </div>
        <label className="mc-f">each time uses<input className="line-input mc-n" inputMode="decimal" value={med.supply.per} onChange={(e) => setSupply({ per: e.target.value })} /> {med.supply.unit}</label>
        <p className="mc-fine">The count goes down by this each time you log a dose, and the refill date is guessed from your schedule. It’s only arithmetic on what you typed.</p>

        <div className="mc-save">
          <button className="mini-btn" onClick={onSave} disabled={!med.name.trim()}>{ed.isNew ? "put it on the shelf" : "save"}</button>
          <button className="mini-btn ghost" onClick={() => setEd(null)}>cancel</button>
          {onRemove && <button className="mini-btn ghost mc-del" onClick={onRemove}>🗑 take off the shelf</button>}
        </div>
      </div>
    </div>
  );
}

function Chips({ label, opts, value, onPick }) {
  return (
    <div className="mc-swatches" role="radiogroup" aria-label={label}>
      <span>{label}</span>
      {opts.map((o) => (
        <button key={o} role="radio" aria-checked={value === o} className={`mc-sw-c${value === o ? " sel" : ""}`} style={{ background: o }} onClick={() => onPick(o)} aria-label={o} />
      ))}
    </div>
  );
}
