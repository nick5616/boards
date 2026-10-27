import { useState, useEffect, useRef } from "react";
import { useData } from "../../contexts/DataContext";
import { MODULES } from "../../constants/modules";
import { CRACK_EVENT } from "../../lib/remote";
import { bagContents, pull, touchedAt } from "../../lib/shuffle";
import { TrayArt } from "../board/ModuleTray";

const DAY = 86400000;

// Why this one came out, in plain words
function whyLine(board, mod, now = Date.now()) {
  const at = touchedAt(mod) ?? board.lastLoggedAt;
  if (!at) return "nothing logged here yet";
  const d = Math.floor((now - at) / DAY);
  if (d < 1) return "you were just on this";
  return `not since ${d === 1 ? "yesterday" : `${d} days ago`}`;
}

// A drawstring bag of everything you could be doing. "What now?" shakes it and pulls out
// one thing, weighted toward what you haven't touched lately. Leave out what you don't want,
// or let it reach into your other Now boards.
export default function ShuffleBag({ board, mod, setState }) {
  const { boards, goTo } = useData();
  const { skip = [], everywhere = false, pulled = {}, last = null } = mod.state;
  const [shaking, setShaking] = useState(false);
  const [listing, setListing] = useState(false);
  const timer = useRef(null);

  const items = bagContents(boards, board, { everywhere, pulled, selfId: mod.id });
  const inBag = items.filter((i) => !skip.includes(i.mod.id));

  // Resolve the token we're showing: it may since have been removed
  const lb = last && boards?.find((b) => b.id === last.boardId);
  const lm = lb?.modules.find((m) => m.id === last.modId);

  const draw = () => {
    if (shaking || !inBag.length) return;
    setShaking(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const hit = pull(items, skip);
      setShaking(false);
      if (!hit) return;
      setState((s) => ({
        ...s,
        pulled: { ...(s.pulled ?? {}), [hit.mod.id]: Date.now() },
        last: { boardId: hit.board.id, modId: hit.mod.id, at: Date.now(), why: whyLine(hit.board, hit.mod) },
      }));
    }, 650);
  };

  // A shake of the phone remote draws one too
  const again = useRef(draw);
  again.current = draw;
  useEffect(() => {
    const on = (e) => e.detail.modId === mod.id && again.current();
    window.addEventListener(CRACK_EVENT, on);
    return () => {
      window.removeEventListener(CRACK_EVENT, on);
      clearTimeout(timer.current);
    };
  }, [mod.id]);

  const toggle = (id) => setState((s) => ({ ...s, skip: skip.includes(id) ? skip.filter((x) => x !== id) : [...skip, id] }));

  return (
    <div className="sb">
      <div className="sb-stage">
        <svg className={`sb-bag${shaking ? " shaking" : ""}`} viewBox="0 0 160 150" role="img" aria-label="A drawstring bag">
          <defs>
            <radialGradient id={`sb-${mod.id}`} cx="40%" cy="35%" r="75%">
              <stop offset="0" stopColor="#d9b982" />
              <stop offset="0.6" stopColor="#b98f55" />
              <stop offset="1" stopColor="#8a6535" />
            </radialGradient>
          </defs>
          {/* the sack, with its pinched neck */}
          <path d="M56 36 C30 54 10 92 14 120 C17 142 40 146 80 146 C120 146 143 142 146 120 C150 92 130 54 104 36 Z" fill={`url(#sb-${mod.id})`} stroke="#4a3418" strokeWidth="2.5" strokeLinejoin="round" />
          {/* burlap weave and stitched seams */}
          <path d="M26 100 C60 110 100 110 134 100M24 120 C60 130 100 130 136 120" className="sb-weave" />
          <path d="M56 40 C44 70 40 110 44 142M104 40 C116 70 120 110 116 142" className="sb-seam" />
          {/* the gathered top, a ruffle above the cord */}
          <path d="M52 40 C56 20 66 16 80 20 C94 16 104 20 108 40 Z" fill="#c9a266" stroke="#4a3418" strokeWidth="2.5" strokeLinejoin="round" />
          <path d="M62 38 C62 28 66 22 70 20M80 38 C80 28 80 24 80 20M98 38 C98 28 94 22 90 20" className="sb-weave" />
          <path d="M48 41 C70 50 90 50 112 41" className="sb-cord" />
          <path d="M48 41 C70 47 90 47 112 41" className="sb-cord hi" />
          {/* bow and dangling tassels */}
          <path d="M80 47 C66 38 56 44 62 54 C68 58 76 52 80 47 C84 52 92 58 98 54 C104 44 94 38 80 47Z" fill="#c1272d" stroke="#4a1418" strokeWidth="2" strokeLinejoin="round" />
          <path d="M80 48 C76 62 70 70 66 76M80 48 C84 62 90 70 94 76" className="sb-cord" />
          <circle cx="66" cy="78" r="3.2" fill="#c1272d" stroke="#4a1418" strokeWidth="1.5" />
          <circle cx="94" cy="78" r="3.2" fill="#c1272d" stroke="#4a1418" strokeWidth="1.5" />
          {/* a sewn-on patch */}
          <g transform="rotate(-4 80 112)">
            <rect x="52" y="94" width="56" height="34" rx="4" fill="#f3e6c8" stroke="#4a3418" strokeWidth="2" strokeDasharray="4 2.5" />
            <text x="80" y="118" textAnchor="middle" className="sb-q">?</text>
          </g>
        </svg>

        {/* whatever came out, fanned over the bag's mouth */}
        {lm && !shaking && (
          <div className="sb-token" key={last.at} style={{ "--tilt": `${((last.at % 7) - 3) * 1.6}deg` }}>
            <div className="sb-art" aria-hidden="true">
              <TrayArt type={lm.type} />
            </div>
            <b>{lm.title}</b>
            <i>
              {MODULES[lm.type].label}
              {lb.id !== board.id ? ` · ${lb.title}` : ""}
            </i>
            <span>{last.why}</span>
          </div>
        )}
      </div>

      <div className="sb-btns">
        <button className="sb-draw" onClick={draw} disabled={shaking || !inBag.length}>
          {shaking ? "rummaging…" : last && lm ? "pick again" : "what should I do now?"}
        </button>
        {lm && !shaking && (
          <button className="sb-go" onClick={() => goTo(lb.id, lm.id)}>
            go →
          </button>
        )}
      </div>
      {!inBag.length && <div className="sb-none">the bag is empty: add something to this board or let it reach further</div>}

      <button className="sb-roster-btn" onClick={() => setListing((v) => !v)} aria-expanded={listing}>
        {inBag.length} thing{inBag.length === 1 ? "" : "s"} in the bag {listing ? "▴" : "▾"}
      </button>
      {listing && (
        <div className="sb-roster">
          <label className="sb-all">
            <input type="checkbox" checked={everywhere} onChange={(e) => setState((s) => ({ ...s, everywhere: e.target.checked }))} />
            reach into my other Now boards too
          </label>
          {items.map(({ board: b, mod: m, w }) => (
            <label key={m.id} className="sb-row">
              <input type="checkbox" checked={!skip.includes(m.id)} onChange={() => toggle(m.id)} />
              <span>{m.title}</span>
              {b.id !== board.id && <i>{b.title}</i>}
              <em title="how likely it is to come out">{"●".repeat(Math.max(1, Math.min(4, Math.round(w / 8))))}</em>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
