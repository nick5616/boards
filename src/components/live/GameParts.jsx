import { rows } from "../../lib/games";

// Bits every shared game uses: the lobby, the score chips, the podium, a timer bar.
// See lib/games.js for the rules and hooks/useGame.js for `g`.

export const Dot = ({ name, color }) => (
  <span className="gm-dot" style={{ background: color }} title={name} aria-hidden="true">
    {(name || "?").trim()[0]?.toUpperCase()}
  </span>
);

export function Scores({ s, g }) {
  return (
    <div className="gm-scores">
      {rows(s).map((r) => (
        <span key={r.peer} className={`gm-chip${r.peer === g.me ? " me" : ""}`} style={{ "--who": r.color }}>
          <Dot name={r.name} color={r.color} /> {r.name} <b>{r.n}</b>
        </span>
      ))}
    </div>
  );
}

// How much of a stretch of shared-clock time is left, as a bar
export function Bar({ g, from, to }) {
  const left = Math.max(0, Math.min(1, (to - g.now()) / (to - from)));
  return (
    <div className="gm-bar" aria-hidden="true">
      <i style={{ width: `${left * 100}%` }} className={left < 0.25 ? "low" : ""} />
    </div>
  );
}

export function Lobby({ s, g, title, blurb, short, children, onStart, startLabel = "start" }) {
  const list = Object.entries(s.players);
  const mine = !!s.players[g.me];
  const hosts = s.host === g.me;
  return (
    <div className="gm gm-lobby">
      <div className="gm-title">{title}</div>
      <div className="gm-blurb">{blurb}</div>
      <div className="gm-scores">
        {list.map(([peer, p]) => (
          <span key={peer} className={`gm-chip${peer === g.me ? " me" : ""}`}>
            <Dot name={p.name} color={p.color} /> {p.name.split(/\s+/)[0] || "someone"}
          </span>
        ))}
      </div>
      {mine && hosts && children}
      <div className="gm-row">
        {!mine && <button className="mini-btn gm-go" onClick={g.join}>join in</button>}
        {mine && hosts && (
          <button className="mini-btn gm-go" disabled={list.length < 2 || !!short} onClick={onStart}>
            {startLabel}
          </button>
        )}
        {mine && !hosts && <span className="gm-note">waiting for the host to start</span>}
        {mine && hosts && list.length < 2 && <span className="gm-note">waiting for someone to join</span>}
        {mine && hosts && list.length >= 2 && short && <span className="gm-note">{short}</span>}
        <button className="mini-btn ghost" onClick={g.leave}>{mine ? "never mind" : "not now"}</button>
      </div>
    </div>
  );
}

// First, second and third on their steps; anyone else underneath
export function Podium({ s, children }) {
  const list = rows(s);
  const order = [list[1], list[0], list[2]].filter(Boolean); // 2nd, 1st, 3rd
  const top = Math.max(1, list[0]?.n ?? 1);
  return (
    <div className="gm gm-done">
      <div className="gm-title">{s.result?.text || "that's the game"}</div>
      <div className="gm-podium">
        {order.map((r) => (
          <div key={r.peer} className={`gm-step${r === list[0] ? " first" : ""}`}>
            <Dot name={r.name} color={r.color} />
            <span className="gm-step-name">{r.name}</span>
            <span className="gm-step-block" style={{ height: 22 + (r.n / top) * 46, background: r.color }}>
              <b>{r.n}</b>
            </span>
          </div>
        ))}
      </div>
      {list.length > 3 && (
        <div className="gm-scores">
          {list.slice(3).map((r) => (
            <span key={r.peer} className="gm-chip"><Dot name={r.name} color={r.color} /> {r.name} <b>{r.n}</b></span>
          ))}
        </div>
      )}
      {children}
    </div>
  );
}

// Where a finished game goes on the module: its last results
export function Results({ games = [] }) {
  if (!games.length) return null;
  const when = (at) => new Date(at).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  return (
    <div className="gm-results">
      {games.slice(0, 3).map((x) => (
        <div key={x.id}>🏁 {x.text} <span>{when(x.at)}</span></div>
      ))}
    </div>
  );
}
