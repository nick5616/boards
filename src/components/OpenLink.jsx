import { useEffect, useState } from "react";
import { fromLink, importable } from "../lib/snapshot";
import { MODULES } from "../constants/modules";

// Someone sent a board as a link (/open#b=…). Look inside, then keep a copy.
// Works signed out too: the link is the whole board, nothing is fetched.
export default function OpenLink({ user, signIn, onKeep, onLeave }) {
  const [snap, setSnap] = useState(null);
  const [bad, setBad] = useState(null);

  useEffect(() => {
    fromLink(window.location.hash).then(setSnap, (e) => setBad(e.message));
  }, []);

  const counts = {};
  for (const m of snap?.modules ?? []) counts[m.type] = (counts[m.type] ?? 0) + 1;

  return (
    <div className="app">
      <div className="login-screen open-link">
        <div className="hdr-wordmark" style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>my boards</div>
        {bad ? (
          <>
            <p>This link didn't open: {bad}.</p>
            <button className="btn-add" onClick={onLeave}>← back</button>
          </>
        ) : !snap ? (
          <p>Unfolding…</p>
        ) : (
          <>
            <p className="open-link-from">someone passed you a board</p>
            <h2 className="open-link-title">{snap.title || "Untitled board"}</h2>
            <ul className="open-link-list">
              {Object.entries(counts).map(([type, n]) => (
                <li key={type}>{n > 1 ? `${n} × ` : ""}{MODULES[type].label}</li>
              ))}
              {!snap.modules.length && <li>an empty board</li>}
            </ul>
            <p className="open-link-note">Pictures and private things stay behind. You get your own copy.</p>
            {user === undefined ? null : user ? (
              <button className="btn-add" onClick={() => onKeep(importable(snap))}>Open it as a new board</button>
            ) : (
              <button className="btn-google-signin" onClick={signIn}>Sign in to keep a copy</button>
            )}
            <button className="open-link-skip" onClick={onLeave}>no thanks</button>
          </>
        )}
      </div>
    </div>
  );
}
