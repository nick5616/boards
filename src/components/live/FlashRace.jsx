import { useState, useEffect, useRef } from "react";
import { Lobby, Podium, Scores, Dot } from "./GameParts";

const SIZES = [5, 10, 15];
const pick = (cards, n) => [...cards].sort(() => Math.random() - 0.5).slice(0, n).map(({ id, front, back }) => ({ id, front, back }));

// Flashcard race: the same card for everyone at the same shared moment, type the back,
// first right answer scores. The deck is the module's own cards (everyone has them).
export default function FlashRace({ g, cards }) {
  const s = g.state;
  const [size, setSize] = useState(10);
  const [text, setText] = useState("");
  const input = useRef(null);
  const n = Math.min(size, cards.length);

  // A new card: empty box, cursor in it
  useEffect(() => {
    setText("");
    if (s?.phase === "play") input.current?.focus();
  }, [s?.i, s?.phase]);

  if (s.phase === "lobby") {
    return (
      <Lobby
        s={s}
        g={g}
        title="⚡ flashcard race"
        blurb="Same card for everyone. First right answer scores."
        short={cards.length < 3 ? "add a few cards first" : ""}
        onStart={() => g.act({ type: "start", data: { cards: pick(cards, n) } })}
        startLabel={`race ${n} cards`}
      >
        <div className="gm-row">
          {SIZES.map((z) => (
            <button key={z} className={`mini-btn${size === z ? " on" : ""}`} onClick={() => setSize(z)} disabled={cards.length < z && z !== SIZES[0]}>
              {z}
            </button>
          ))}
          <span className="gm-note">cards</span>
        </div>
      </Lobby>
    );
  }

  if (s.phase === "done") {
    return (
      <Podium s={s}>
        <div className="gm-row">
          {s.host === g.me && s.players[g.me] && (
            <button className="mini-btn gm-go" onClick={() => { g.end(); setTimeout(() => g.open("flash"), 50); }}>again</button>
          )}
          <button className="mini-btn ghost" onClick={g.leave}>close</button>
        </div>
      </Podium>
    );
  }

  const card = s.cards[s.i];
  const t = g.now();
  const wait = Math.ceil((s.roundAt - t) / 1000);
  const waiting = wait > 0;
  const mine = !!s.players[g.me];
  const won = s.winner ? s.players[s.winner] : null;
  const name = (p) => (p?.name || "someone").split(/\s+/)[0];
  const send = () => {
    if (!text.trim() || waiting || s.decided || s.got[g.me]) return;
    g.act({ type: "ans", i: s.i, text, at: g.now() });
  };
  const wrong = s.wrong[g.me];

  return (
    <div className="gm gm-flash">
      <div className="gm-head">
        <span>card {s.i + 1} of {s.cards.length}</span>
        <button className="mini-btn ghost" onClick={g.leave}>leave</button>
      </div>
      <Scores s={s} g={g} />
      <div className={`gm-card${s.decided ? " shown" : ""}`}>
        {waiting ? <span className="gm-count" key={wait}>{wait}</span> : card.front}
        {s.decided && <em>{card.back}</em>}
      </div>
      {s.decided ? (
        <div className="gm-verdict" role="status">
          {won ? (
            <><Dot name={won.name} color={won.color} /> {name(won)} got it{s.winner === g.me ? "!" : ""}</>
          ) : (
            "nobody got that one"
          )}
        </div>
      ) : mine ? (
        <div className="gm-answer">
          <input
            ref={input}
            className="line-input"
            placeholder={waiting ? "get ready…" : "type the answer"}
            value={text}
            disabled={waiting || !!s.got[g.me]}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
            aria-label="Your answer"
            autoCapitalize="none"
            autoCorrect="off"
          />
          <button className="mini-btn gm-go" onClick={send} disabled={waiting || !text.trim() || !!s.got[g.me]}>go</button>
        </div>
      ) : (
        <div className="gm-note">watching</div>
      )}
      {!s.decided && wrong && !s.got[g.me] && <div className="gm-wrong" key={wrong + s.i}>not quite</div>}
      {!s.decided && s.got[g.me] && <div className="gm-wrong ok">in! waiting to see who was first…</div>}
    </div>
  );
}
