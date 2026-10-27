import { useState, useEffect, useRef, useCallback } from "react";
import { useTogether } from "../components/live/TogetherContext";
import { gameBus } from "../lib/games";

// Play a game together in one module (docs/plans/peer-to-peer.md P6, lib/games.js has the rules).
//
//   const g = useGame(board, mod, onResult);
//   g.can       true only in a shared space with someone else here, and I can edit it. Solo it is
//               always false and nothing is joined or sent.
//   g.state     the game I'm in or watching (null = none); g.me is my peer id
//   g.now()     the shared clock
//   g.open(kind) / g.act(action) / g.leave() / g.end()
//
// onResult({ text, rows, pin? }, gameId) is called once, on the host only, when the game is over:
// that is what gets written to the board. The caller makes sure it is saved once per game id.
export function useGame(board, mod, onResult) {
  const t = useTogether();
  const room = t?.room ?? null;
  const here = !!room && t.peers.length > 0 && board.role !== "view";
  const [bus, setBus] = useState(null);
  const [, setTick] = useState(0);
  const done = useRef(null);
  const say = useRef(onResult);
  say.current = onResult;
  const mid = mod.id;

  useEffect(() => {
    if (!here) return;
    const b = gameBus(room);
    const off = b.sub(mid, () => setTick((n) => n + 1));
    setBus(b);
    return () => {
      off();
      setBus(null);
    };
  }, [room, here, mid]);

  const state = bus?.get(mid) ?? null;
  const me = room?.self ?? "";

  // While a game is on, redraw often enough for timers
  const live = !!state && state.phase !== "lobby" && state.phase !== "done";
  useEffect(() => {
    if (!live) return;
    const id = setInterval(() => setTick((n) => n + 1), 200);
    return () => clearInterval(id);
  }, [live]);

  // The host writes the result, once
  useEffect(() => {
    if (state?.phase !== "done" || !state.result || state.host !== me || done.current === state.gid) return;
    done.current = state.gid;
    say.current?.(state.result, state.gid);
  }, [state?.phase, state?.gid, state?.host, me]);

  const face = t?.me ? { uid: t.me.uid, name: t.me.name, color: t.me.color } : null;
  const open = useCallback(
    (kind) => {
      if (bus && face) bus.open(mid, kind, face);
    },
    [bus, mid, face?.uid, face?.name, face?.color]
  );
  const join = useCallback(() => bus && face && bus.act(mid, { type: "join", ...face }), [bus, mid, face?.uid, face?.name, face?.color]);

  return {
    can: here && !!bus,
    state,
    me,
    room,
    now: () => (bus ? bus.now() : Date.now()),
    open,
    join,
    act: (a) => bus?.act(mid, a),
    leave: () => bus?.leave(mid),
    end: () => bus?.end(mid),
  };
}

// The game's result as a line in a module's history: newest first, once per game.
// (A module keeps `games: [{ id, at, text, rows }]`.)
export const withResult = (state, result, gid) =>
  (state.games ?? []).some((x) => x.id === gid)
    ? state
    : { ...state, games: [{ id: gid, at: Date.now(), text: result.text, rows: result.rows }, ...(state.games ?? [])].slice(0, 12) };
