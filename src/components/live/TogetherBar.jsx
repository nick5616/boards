import { useState, useEffect, useRef } from "react";
import { Face } from "../share/Faces";
import Faces from "../share/Faces";
import StampSVG from "../StampSVG";
import { STAMPS } from "../../constants/stamps";
import { firstName } from "../../lib/share";
import { uidOfPeer } from "../../lib/presence";
import { useData } from "../../contexts/DataContext";
import { useTogether } from "./TogetherContext";
import { passTake } from "../../lib/tapePass";

const TAKE = "application/x-boards-take";

// The board header's share of the live bits: the faces of whoever is here, a pen for fading ink,
// and, from a face, a drawer of stamps to throw at that person or a note to pass them.
// Renders nothing on a board only I am on.
export function TogetherBar() {
  const t = useTogether();
  const { toast } = useData();
  const [open, setOpen] = useState(null); // uid whose drawer is open
  const [note, setNote] = useState("");
  const wrap = useRef(null);
  const [sending, setSending] = useState({}); // uid → 0..1 while a take is on its way to them
  const [over, setOver] = useState(null); // uid a take is being dragged over

  useEffect(() => {
    if (!open) return;
    const close = (e) => wrap.current && !wrap.current.contains(e.target) && setOpen(null);
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);

  if (!t) return null;
  const person = t.people.find((p) => p.uid === open);
  // Their tabs in the room (one person can have two open)
  const peersOf = (uid) => (t.room ? [...t.room.peers].filter((id) => uidOfPeer(id) === uid) : []);
  const there = person ? peersOf(person.uid) : [];

  // A tape take dropped on a face goes straight to that person's shelf
  const give = async (e, p) => {
    setOver(null);
    if (!e.dataTransfer.types.includes(TAKE)) return;
    e.preventDefault();
    let drop;
    try {
      drop = JSON.parse(e.dataTransfer.getData(TAKE));
    } catch {
      return;
    }
    const name = firstName(p.name);
    if (!peersOf(p.uid).length) return toast({ text: `${name} isn't online right now`, ms: 2400 });
    setSending((s) => ({ ...s, [p.uid]: 0.02 }));
    try {
      await passTake(t.room, p.uid, drop, {
        boardId: drop.boardId,
        modId: drop.modId,
        onProgress: (f) => setSending((s) => ({ ...s, [p.uid]: f })),
      });
      toast({ text: `${drop.name} is on ${name}'s shelf`, ms: 2400 });
    } catch (err) {
      toast({ text: `couldn't pass it to ${name}: ${err.message}`, ms: 3000 });
    }
    setSending(({ [p.uid]: _done, ...rest }) => rest);
  };

  const toss = (stamp) => {
    t.room.send("toss", { stamp }, there);
    toast({ text: `tossed a ${stamp} at ${firstName(person.name)}`, ms: 1800 });
    setOpen(null);
  };
  const pass = (e) => {
    e.preventDefault();
    if (!note.trim()) return;
    t.room.send("note", { text: note.trim() }, there);
    toast({ text: `note passed to ${firstName(person.name)}`, ms: 1800 });
    setNote("");
    setOpen(null);
  };

  return (
    <span className="tg-bar" ref={wrap}>
      {t.people.length > 0 && (
        <span className="faces tg-faces">
          {t.people.map((p) => (
            <button
              key={p.uid}
              className={`tg-face${open === p.uid ? " on" : ""}${over === p.uid ? " drop" : ""}`}
              onClick={() => setOpen(open === p.uid ? null : p.uid)}
              onDragOver={(e) => {
                if (!e.dataTransfer.types.includes(TAKE)) return;
                e.preventDefault();
                setOver(p.uid);
              }}
              onDragLeave={() => setOver((o) => (o === p.uid ? null : o))}
              onDrop={(e) => give(e, p)}
              title={`${p.name || "Someone"} is here — throw them something, or drop a tape take on them`}
            >
              <Face person={p} size={28} />
              {sending[p.uid] != null && (
                <svg className="tg-ring" viewBox="0 0 36 36" aria-label={`Sending, ${Math.round(sending[p.uid] * 100)}%`}>
                  <circle cx="18" cy="18" r="16" pathLength="100" strokeDasharray={`${Math.round(sending[p.uid] * 100)} 100`} />
                </svg>
              )}
            </button>
          ))}
        </span>
      )}
      {t.room && t.desktop && (
        <button
          className={`tool-btn${t.pen ? " on" : ""}`}
          onClick={() => t.setPen(!t.pen)}
          title="Fading ink — draw on anything and it melts away (or hold Alt)"
        >
          🖍 ink
        </button>
      )}
      {person && (
        <div className="tg-drawer" role="dialog" aria-label={`Throw something at ${person.name || "them"}`}>
          <div className="tg-drawer-head">
            <Face person={person} size={20} /> {person.name || "Someone"}
          </div>
          {there.length === 0 ? (
            <div className="tg-drawer-wait">connecting to them…</div>
          ) : (
            <>
              <div className="tg-stamps">
                {STAMPS.map((s) => (
                  <button key={s.id} className="tg-stamp" onClick={() => toss(s.id)} title={`throw a ${s.id}`}>
                    <StampSVG stampId={s.id} color="#2a2520" />
                  </button>
                ))}
              </div>
              <form className="tg-pass" onSubmit={pass}>
                <input
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  maxLength={200}
                  placeholder="pass a note…"
                  aria-label="A note to pass"
                />
                <button type="submit" disabled={!note.trim()}>✉ pass</button>
              </form>
              <div className="tg-drawer-fine">stamps and notes vanish; nothing is saved</div>
            </>
          )}
        </div>
      )}
    </span>
  );
}

// Little faces on a tab: whoever is looking at it right now
export function TabFaces({ tab }) {
  const t = useTogether();
  const here = t?.people.filter((p) => p.tab === tab) ?? [];
  if (!here.length) return null;
  return (
    <span className="tg-tabfaces">
      <Faces people={here} size={16} />
    </span>
  );
}
