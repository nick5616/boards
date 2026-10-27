// Listening together. A shared radio's switch and dial reach everyone through the board, but
// not who is actually hearing it: sound needs a tap on each screen. That goes over the peer bus
// ("radio"): { mid } when I start hearing a radio on this board, { mid: null } when I stop.
// Together registers the room for a board (listenRadio); the card asks earsOn().
import { subscribe as onRadio, radioSnap } from "./radio";

const rooms = new Map(); // boardId → Map(peer → module id they're hearing)
const fns = new Set();
let ver = 0;
const bump = () => {
  ver++;
  fns.forEach((f) => f());
};

export const subscribeEars = (f) => {
  fns.add(f);
  return () => fns.delete(f);
};
export const earsVersion = () => ver;

// The peers hearing this radio right now
export const earsOn = (boardId, modId) =>
  [...(rooms.get(boardId) ?? [])].filter(([, mid]) => mid === modId).map(([peer]) => peer);

export function listenRadio(room, boardId) {
  const ears = new Map();
  rooms.set(boardId, ears);
  const hearing = () => {
    const s = radioSnap();
    return s.boardId === boardId && (s.status === "on" || s.status === "tuning") ? s.modId : null;
  };
  let mine = hearing();
  const say = (to) => room.send("radio", { mid: mine }, to);

  const offs = [
    room.on("radio", (m, from) => {
      if (m?.mid) ears.set(from, m.mid);
      else ears.delete(from);
      bump();
    }),
    // A newcomer learns what I'm hearing; someone leaving stops hearing
    room.onPeer((id, joined) => {
      if (joined) mine && say(id);
      else if (ears.delete(id)) bump();
    }),
    onRadio(() => {
      const now = hearing();
      if (now === mine) return;
      mine = now;
      say();
    }),
  ];
  if (mine) say();

  return () => {
    if (mine) room.send("radio", { mid: null });
    offs.forEach((off) => off());
    if (rooms.get(boardId) === ears) rooms.delete(boardId);
    bump();
  };
}
