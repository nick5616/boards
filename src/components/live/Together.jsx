import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { SPACES } from "../../lib/data";
import { DEMO } from "../../lib/demo";
import { faceColor } from "../../lib/share";
import { myFace, uidOfPeer } from "../../lib/presence";
import { useData } from "../../contexts/DataContext";
import { useDesktop } from "../../hooks/useMedia";
import { useMemberCount, usePresence, useVisible } from "../../hooks/usePresence";
import { useRoom } from "../../hooks/useRoom";
import { clock } from "../../lib/peers";
import { registerSync, listen as listenMetro } from "../../lib/metroSync";
import { TogetherContext } from "./TogetherContext";
import Cursors from "./Cursors";
import Ink from "./Ink";
import Stickers from "./Stickers";
import PassNote from "./PassNote";
import TapePass from "./TapePass";

// Wraps an open board. With VITE_SPACES off, in the demo, or on a board only I am in, it does
// nothing at all (no database, no peers). Once a second person is a member it shows faces,
// and while this tab is in front it joins the live room for cursors, ink, stamps and notes.
// See docs/plans/sharing-multiplayer.md M4 and docs/plans/peer-to-peer.md P2.
export default function Together({ board, tab, children }) {
  if (!SPACES || DEMO) return children;
  return <Live board={board} tab={tab ?? ""}>{children}</Live>;
}

const TYPING_EVERY = 400; // "I'm typing here" no more often than this

function Live({ board, tab, children }) {
  const { uid } = useData();
  const desktop = useDesktop();
  const visible = useVisible();
  const together = useMemberCount(board.id, true) > 1;
  const on = together && visible; // a hidden tab leaves, and its face goes
  const { people, ready } = usePresence(board.id, board.role, tab, on, board.roomSecret);
  const { room, peers } = useRoom(board.id, on && ready);
  const [pen, setPen] = useState(false);
  const [focus, setFocus] = useState(() => new Map()); // peer → module id they're in
  const [typing, setTyping] = useState(() => new Map()); // block key → { peer, at }
  const me = useMemo(() => myFace(), [uid]);

  // Peer id → the person. (Stable, so the toys can subscribe once.)
  const known = useRef(people);
  known.current = people;
  const who = useCallback((peer) => {
    const id = uidOfPeer(peer);
    return known.current.find((p) => p.uid === id) ?? { uid: id, name: "", color: faceColor(id), photo: "" };
  }, []);

  // Focus: which module I'm in, and which each of them is in
  const mine = useRef({ mid: null, typed: new Map(), sentAt: 0 });
  useEffect(() => {
    if (!room) return;
    const say = (mid) => room.send("focus", { mid });
    let letGo = null;
    const into = (e) => {
      clearTimeout(letGo);
      const el = e.target;
      if (!el.matches?.("input, textarea, [contenteditable='true'], [contenteditable='']")) return;
      const mid = el.closest?.(".mod")?.dataset.mid ?? null;
      mine.current.mid = mid;
      say(mid);
    };
    // Focus moving between two boxes is a focusout then a focusin: wait a beat before letting go
    const out = () => {
      clearTimeout(letGo);
      letGo = setTimeout(() => {
        if (mine.current.mid) say(null);
        mine.current.mid = null;
      }, 250);
    };
    document.addEventListener("focusin", into);
    document.addEventListener("focusout", out);
    const offs = [
      room.on("focus", (m, from) =>
        setFocus((prev) => {
          const next = new Map(prev);
          if (m.mid) next.set(from, m.mid);
          else next.delete(from);
          return next;
        })
      ),
      room.on("type", (m, from) => {
        // I was typing there a moment ago too: no lock for me, we both just carry on
        if (Date.now() - (mine.current.typed.get(m.key) ?? 0) < 1000) return;
        setTyping((prev) => new Map(prev).set(m.key, { peer: from, at: Date.now() }));
      }),
      // A newcomer learns where I am; someone leaving takes their outline with them
      room.onPeer((id, joined) => {
        if (joined && mine.current.mid) room.send("focus", { mid: mine.current.mid }, id);
        if (!joined) setFocus((prev) => (prev.has(id) ? new Map([...prev].filter(([k]) => k !== id)) : prev));
      }),
    ];
    return () => {
      clearTimeout(letGo);
      document.removeEventListener("focusin", into);
      document.removeEventListener("focusout", out);
      offs.forEach((off) => off());
      setFocus(new Map());
      setTyping(new Map());
    };
  }, [room]);

  // The room's shared clock: metronomes and watch-together keep time by it
  const [clk, setClk] = useState(null);
  useEffect(() => {
    if (!room) return;
    const c = clock(room);
    setClk(c);
    const offs = [listenMetro(room), registerSync(board.id, { room, clk: c })];
    return () => {
      offs.forEach((off) => off());
      c.stop();
      setClk(null);
    };
  }, [room, board.id]);

  // I typed in a block: tell them, but not on every key
  const typed = useCallback(
    (key) => {
      const now = Date.now();
      mine.current.typed.set(key, now);
      if (!room || now - mine.current.sentAt < TYPING_EVERY) return;
      mine.current.sentAt = now;
      room.send("type", { key });
    },
    [room]
  );

  const value = useMemo(
    () => (together ? { me, people, room, peers, who, focus, typing, typed, pen, setPen, tab, desktop, clk } : null),
    [together, me, people, room, peers, who, focus, typing, typed, pen, tab, desktop, clk]
  );

  return (
    <TogetherContext.Provider value={value}>
      {children}
      {together && room && (
        <>
          {desktop && <Cursors room={room} who={who} tab={tab} />}
          {desktop && <Ink room={room} who={who} tab={tab} me={me} pen={pen} setPen={setPen} />}
          <Stickers room={room} who={who} />
          <PassNote room={room} who={who} />
          <TapePass room={room} board={board} who={who} />
        </>
      )}
    </TogetherContext.Provider>
  );
}
