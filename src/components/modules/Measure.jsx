import { useMemo, useState } from "react";
import { uid } from "../../utils/uid";
import { dayKey, prettyDate } from "../../utils/date";
import { MEASURES, fitChart, parseChart, sayBetween, toUnit } from "../../lib/wardrobe";

// A cloth tape measure, curled up. Your measurements run along it, and a shop's
// size chart (pasted any old way) gets read against them: which size fits what.
// Measurements are personal, so nothing here reaches the Glance unless asked.
export default function Measure({ mod, setState, expanded }) {
  const s = mod.state;
  const unit = s.unit ?? "in";
  const vals = s.vals ?? {};
  const charts = s.charts ?? [];
  const chart = charts.find((c) => c.id === s.active) ?? charts[0] ?? null;
  const [draft, setDraft] = useState("");
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(false);

  const parsed = useMemo(() => (chart ? parseChart(chart.text) : null), [chart?.text]);
  const fit = useMemo(() => fitChart(parsed, vals, unit), [parsed, s.vals, unit]);
  const n = MEASURES.filter((m) => vals[m.id] !== undefined && vals[m.id] !== "").length;

  const setVal = (id, v) =>
    setState((st) => ({ ...st, vals: { ...(st.vals ?? {}), [id]: v === "" ? "" : Number(v) }, on: st.on ?? dayKey() }), { debounce: 500 });

  // Switching units converts what's written, so 27 in becomes 68.6 cm
  const flip = () => {
    const to = unit === "in" ? "cm" : "in";
    setState((st) => ({
      ...st,
      unit: to,
      vals: Object.fromEntries(
        Object.entries(st.vals ?? {}).map(([k, v]) => [k, v === "" ? v : Math.round(toUnit(Number(v), unit, to) * 10) / 10])
      ),
    }));
  };

  const addChart = (text) => {
    if (!parseChart(text)) return false;
    const c = { id: uid(), name: `Chart ${charts.length + 1}`, text: text.trim() };
    setState((st) => ({ ...st, charts: [...(st.charts ?? []), c], active: c.id }));
    return true;
  };
  const rename = (c) => {
    const name = prompt("Name this chart (the shop?)", c.name);
    if (name?.trim()) setState((st) => ({ ...st, charts: st.charts.map((x) => (x.id === c.id ? { ...x, name: name.trim() } : x)) }));
  };
  const dropChart = (c) =>
    setState((st) => {
      const rest = st.charts.filter((x) => x.id !== c.id);
      return { ...st, charts: rest, active: rest[0]?.id ?? null };
    });

  return (
    <div className="ms">
      {/* The roll, with the tape trailing off it */}
      <div className="ms-roll">
        <svg viewBox="0 0 90 90" aria-hidden="true" className="ms-coil">
          <circle cx="45" cy="45" r="40" fill="#f2d86b" stroke="#2a2520" strokeWidth="2" />
          <circle cx="45" cy="45" r="31" fill="none" stroke="#c9a92f" strokeWidth="1.6" />
          <circle cx="45" cy="45" r="24" fill="none" stroke="#c9a92f" strokeWidth="1.6" />
          <circle cx="45" cy="45" r="17" fill="none" stroke="#c9a92f" strokeWidth="1.6" />
          <circle cx="45" cy="45" r="10" fill="#faf8f5" stroke="#2a2520" strokeWidth="2" />
          <path d="M45 5 C70 8 86 26 84 48" fill="none" stroke="#2a2520" strokeWidth="1" strokeDasharray="1.6 3" />
          <rect x="39" y="82" width="12" height="7" rx="1.5" fill="#c0605a" stroke="#2a2520" strokeWidth="1.4" />
        </svg>
        <div className="ms-head">
          <label className="ms-on">
            measured
            <input
              type="date"
              value={s.on ?? ""}
              onChange={(e) => setState((st) => ({ ...st, on: e.target.value || null }))}
              aria-label="Measured on"
            />
          </label>
          <span className="ms-on-pretty">{s.on ? prettyDate(s.on) : "not yet"}</span>
          <button className="mini-btn ghost ms-unit" onClick={flip} title="Switch between inches and centimetres">
            {unit === "in" ? "in → cm" : "cm → in"}
          </button>
        </div>
      </div>

      <div className="ms-tape" role="group" aria-label="Measurements">
        {MEASURES.map((m) => {
          const f = fit?.cols.find((c) => c.id === m.id);
          const size = f && parsed ? parsed.rows[f.pick].size : null;
          const inside = f?.inside[f.pick];
          return (
            <label key={m.id} className="ms-row">
              <span className="ms-name">{m.label}</span>
              <input
                className="ms-val"
                type="number"
                inputMode="decimal"
                step="0.1"
                min="0"
                placeholder="—"
                defaultValue={vals[m.id] ?? ""}
                key={`${m.id}-${unit}`}
                onChange={(e) => setVal(m.id, e.target.value)}
              />
              <span className="ms-u">{unit}</span>
              {size && <span className={`ms-fits${inside ? "" : " near"}`}>{inside ? size : `~${size}`}</span>}
            </label>
          );
        })}
      </div>

      {/* Size chart translator */}
      <div className="ms-chartbar">
        <span className="ms-h">Size chart</span>
        {charts.map((c) => (
          <button
            key={c.id}
            className={`pc-look${c.id === chart?.id ? " on" : ""}`}
            onClick={() => setState((st) => ({ ...st, active: c.id }))}
            onDoubleClick={() => rename(c)}
            title="Double-click to rename"
          >
            {c.name}
          </button>
        ))}
        <button className="pc-look pc-plus" onClick={() => setAdding((v) => !v)} aria-label="Add a size chart">+</button>
      </div>

      {(adding || !charts.length) && (
        <div className="ms-paste">
          <textarea
            value={draft}
            placeholder={"paste a shop's size chart, or type rows:\nS 32-34 26-28 36-38\nM 35-37 29-31 39-41"}
            onChange={(e) => setDraft(e.target.value)}
            rows={expanded ? 6 : 4}
          />
          <div className="ms-paste-row">
            <button
              className="mini-btn"
              disabled={!draft.trim()}
              onClick={() => {
                if (addChart(draft)) {
                  setDraft("");
                  setAdding(false);
                }
              }}
            >
              Read it
            </button>
            <span className="ms-hint">{draft.trim() && !parseChart(draft) ? "couldn't find any rows with numbers" : "rows: size, then bust, waist, hips"}</span>
          </div>
        </div>
      )}

      {chart && parsed && (
        <div className="ms-chart">
          <table>
            <thead>
              <tr>
                <th>size</th>
                {parsed.cols.map((c, i) => <th key={i}>{c ?? "?"}</th>)}
              </tr>
            </thead>
            <tbody>
              {parsed.rows.map((r, ri) => (
                <tr key={ri} className={fit?.best === ri ? "best" : ""}>
                  <th>{r.size}{fit?.best === ri && <i className="ms-stamp">best</i>}</th>
                  {parsed.cols.map((_, ci) => {
                    const f = fit?.cols.find((x) => x.c === ci);
                    const g = f?.gaps[ri];
                    const cls = g == null || !f ? "" : g === 0 ? "in" : g <= (parsed.unit === "in" ? 1 : 2.5) ? "near" : "";
                    const [lo, hi] = r.ranges[ci] ?? [];
                    return <td key={ci} className={cls}>{lo == null ? "" : lo === hi ? lo : `${lo}–${hi}`}</td>;
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          <div className="ms-note">
            {!fit?.cols.length
              ? n ? "none of your measurements match this chart's columns" : "write your measurements above and the sizes light up"
              : fit.between
                ? sayBetween(parsed, fit.between)
                : `${parsed.rows[fit.best].size} fits everything measured.`}
            {parsed.unit !== unit && <span className="ms-conv"> (chart is in {parsed.unit}; I converted)</span>}
          </div>
          <div className="ms-chart-tools">
            <button className="mini-btn ghost" onClick={() => setEditing((v) => !v)}>{editing ? "done" : "edit rows"}</button>
            <button className="mini-btn ghost" onClick={() => confirm(`Throw away “${chart.name}”?`) && dropChart(chart)}>✕ chart</button>
          </div>
          {editing && (
            <textarea
              className="ms-edit"
              defaultValue={chart.text}
              rows={5}
              onChange={(e) =>
                setState((st) => ({ ...st, charts: st.charts.map((x) => (x.id === chart.id ? { ...x, text: e.target.value } : x)) }), { debounce: 500 })
              }
            />
          )}
        </div>
      )}

      <label className="ms-glance">
        <input type="checkbox" checked={!!s.glance} onChange={(e) => setState((st) => ({ ...st, glance: e.target.checked }))} />
        show my numbers on the home Glance <i>(off keeps them private)</i>
      </label>
    </div>
  );
}
