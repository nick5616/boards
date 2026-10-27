import { useState } from "react";
import { useDiag, apiSummary, problems, diagReport, clearDiag } from "../lib/telemetry";

// "just now", "4 min ago", "3 h ago", "2 d ago"
const since = (at) => {
  const m = Math.round((Date.now() - at) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  if (m < 48 * 60) return `${Math.round(m / 60)} h ago`;
  return `${Math.round(m / 1440)} d ago`;
};

// Settings → Diagnostics: how the free APIs are doing, and what broke lately.
// All of it lives on this computer (lib/telemetry.js).
export default function Diagnostics() {
  const evts = useDiag();
  const apis = apiSummary(evts);
  const probs = problems(evts);
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(diagReport());
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch { /* no clipboard: nothing to do */ }
  };

  return (
    <div className="diag">
      <p className="diag-intro">
        What the modules asked of other sites, and anything that broke. It stays on this computer.
      </p>
      <div className="diag-acts">
        <button className="mini-btn" onClick={copy}>{copied ? "copied ✓" : "copy report"}</button>
        <button className="mini-btn ghost" onClick={clearDiag}>clear</button>
      </div>

      <h3 className="diag-h">APIs</h3>
      {!apis.length ? (
        <div className="diag-none">No calls yet. Open a board with a "From the web" module.</div>
      ) : (
        <table className="diag-table">
          <thead>
            <tr><th>site</th><th>calls</th><th>failed</th><th>typical</th><th>last problem</th></tr>
          </thead>
          <tbody>
            {apis.map((h) => (
              <tr key={h.host} className={h.fails && h.lastFail === h.last ? "bad" : h.fails ? "meh" : ""}>
                <td>{h.host}</td>
                <td>{h.calls}</td>
                <td>{h.fails || ""}</td>
                <td>{h.median != null ? `${h.median} ms` : ""}</td>
                <td>{h.lastFail ? `${h.lastFail.status || h.lastFail.err} · ${since(h.lastFail.at)}` : ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h3 className="diag-h">Recent problems</h3>
      {!probs.length ? (
        <div className="diag-none">Nothing's gone wrong. 🌱</div>
      ) : (
        <ul className="diag-list">
          {probs.slice(0, 40).map((e, i) => (
            <li key={i}>
              <span className={`diag-kind diag-${e.kind}`}>{e.kind === "api" ? "api" : e.kind === "crash" ? "module" : "error"}</span>
              <span className="diag-msg">
                {e.kind === "api" ? `${e.host}${e.path} → ${e.status || e.err}` : e.kind === "crash" ? `${e.type}: ${e.msg}` : `${e.msg}${e.where ? ` (${e.where})` : ""}`}
              </span>
              <span className="diag-when">{since(e.at)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
