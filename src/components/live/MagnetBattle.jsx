import { useState, useEffect } from "react";
import { MAG } from "../../lib/games";
import { STICKER_COLORS, hash } from "../Sticker";
import { Lobby, Podium, Bar, Dot } from "./GameParts";

const tile = (text) => ({ background: STICKER_COLORS[hash(text) % STICKER_COLORS.length] });
const first = (p) => (p?.name || "someone").split(/\s+/)[0];

// Magnet battle: everyone is dealt 20 of the door's words in private, makes a line, the lines come
// out without names, everyone votes, and the winner's line is pinned on the fridge (Magnets.jsx).
export default function MagnetBattle({ g, words }) {
  const s = g.state;
  const [line, setLine] = useState([]); // indexes into my hand, in order
  useEffect(() => setLine([]), [s?.gid]);

  if (s.phase === "lobby") {
    return (
      <Lobby
        s={s}
        g={g}
        title="🧲 magnet battle"
        blurb={`Everyone gets ${MAG.hand} of these words, privately, and makes a line. Then you all vote.`}
        short={words.length < 8 ? "needs at least 8 magnets on the door" : ""}
        onStart={() => g.act({ type: "start", data: { words } })}
        startLabel="deal the magnets"
      />
    );
  }

  const mine = !!s.players[g.me];

  if (s.phase === "make") {
    const hand = s.hand ?? [];
    const sent = !!s.submitted[g.me];
    const text = line.map((i) => hand[i]?.text).join(" ");
    const waiting = Object.keys(s.players).filter((p) => !s.submitted[p]).length;
    return (
      <div className="gm gm-mag">
        <div className="gm-head">
          <span>make a line</span>
          <button className="mini-btn ghost" onClick={g.leave}>leave</button>
        </div>
        <Bar g={g} from={s.endsAt - MAG.make} to={s.endsAt} />
        {mine ? (
          <>
            <div className="gm-line" aria-label="Your line">
              {line.length === 0 && <span className="gm-note">tap magnets to build your line</span>}
              {line.map((i, n) => (
                <button key={i} className="gm-mag" style={tile(hand[i].text)} disabled={sent} onClick={() => setLine((l) => l.filter((x) => x !== i))}>
                  {hand[i].text}
                </button>
              ))}
            </div>
            <div className="gm-hand" aria-label="Your magnets, only you can see them">
              {hand.map((w) => (
                <button key={w.i} className={`gm-mag${line.includes(w.i) ? " used" : ""}`} style={tile(w.text)} disabled={sent || line.includes(w.i)} onClick={() => setLine((l) => [...l, w.i])}>
                  {w.text}
                </button>
              ))}
            </div>
            <div className="gm-row">
              <button className="mini-btn gm-go" disabled={sent || !line.length} onClick={() => g.act({ type: "line", line })}>
                {sent ? "line is in" : "that's my line"}
              </button>
              {!sent && line.length > 0 && <button className="mini-btn ghost" onClick={() => setLine([])}>clear</button>}
              <span className="gm-note">{waiting ? `${waiting} still writing` : "everyone's in"}</span>
            </div>
          </>
        ) : (
          <div className="gm-note">watching, {waiting} still writing</div>
        )}
        {!sent && text && <div className="gm-tiny">{text}</div>}
      </div>
    );
  }

  if (s.phase === "vote") {
    const mineId = Object.keys(s.by ?? {}).find((id) => s.by[id] === g.me);
    const voted = Object.keys(s.voted ?? {}).length;
    return (
      <div className="gm gm-mag">
        <div className="gm-head">
          <span>vote for the best one</span>
          <button className="mini-btn ghost" onClick={g.leave}>leave</button>
        </div>
        <Bar g={g} from={s.endsAt - MAG.vote} to={s.endsAt} />
        <div className="gm-cards">
          {s.cards.map((c) => (
            <button key={c.id} className="gm-pick" disabled={!mine || s.voted[g.me] || c.id === mineId} onClick={() => g.act({ type: "vote", id: c.id })}>
              {c.text}
              <i>{c.id === mineId ? "yours" : s.voted[g.me] ? "" : "vote"}</i>
            </button>
          ))}
        </div>
        <div className="gm-note">{voted} of {Object.keys(s.players).length} voted</div>
      </div>
    );
  }

  // done: who wrote what, and the winner on the fridge
  const tallied = {};
  for (const id of Object.values(s.votes ?? {})) tallied[id] = (tallied[id] ?? 0) + 1;
  return (
    <Podium s={s}>
      {s.result?.pin && (
        <div className="gm-pinned">
          <b>📌 on the fridge</b>
          <span>{s.result.pin.text}</span>
          <i>{s.result.pin.name}</i>
        </div>
      )}
      {s.by && s.cards?.length > 0 && (
        <div className="gm-cards">
          {s.cards.map((c) => (
            <div key={c.id} className="gm-pick shown">
              {c.text}
              <i><Dot name={first(s.players[s.by[c.id]])} color={s.players[s.by[c.id]]?.color} /> {first(s.players[s.by[c.id]])} · {tallied[c.id] ?? 0}</i>
            </div>
          ))}
        </div>
      )}
      <div className="gm-row">
        {s.host === g.me && s.players[g.me] && (
          <button className="mini-btn gm-go" onClick={() => { g.end(); setTimeout(() => g.open("mag"), 50); }}>another round</button>
        )}
        <button className="mini-btn ghost" onClick={g.leave}>close</button>
      </div>
    </Podium>
  );
}
