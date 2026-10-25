// Asking a board to do something from outside it ("open that module big",
// "add a metronome", "copy me as a link"). The asker may be a board away, so an
// open request waits (a few seconds) for its board to mount and take it.
import { useEffect, useRef } from "react";

const WAIT = 4000;
let pending = null; // { boardId, modId, at }
const listeners = new Set();
const ping = () => listeners.forEach((f) => f());

// Call this, then switch to the board (or don't, if it's already open)
export const requestOpen = (boardId, modId) => {
  pending = { boardId, modId, at: Date.now() };
  ping();
};

// These act on whichever board is open right now
export const requestAdd = (type) => listeners.forEach((f) => f({ add: type }));
export const requestLink = () => listeners.forEach((f) => f({ link: true }));

// BoardView uses this: open(modId) shows a module big, add(type) puts one on the
// board, link() copies the board as a link
export function useGotoRequests(board, { open, add, link }) {
  const ref = useRef();
  ref.current = { board, open, add, link };
  useEffect(() => {
    const on = (msg) => {
      const { board, open, add, link } = ref.current;
      if (msg?.add) return add(msg.add);
      if (msg?.link) return link();
      if (!pending || pending.boardId !== board.id) return;
      const { modId, at } = pending;
      pending = null;
      if (Date.now() - at < WAIT && board.modules.some((m) => m.id === modId)) open(modId);
    };
    listeners.add(on);
    on(); // a request made just before this board mounted
    return () => listeners.delete(on);
  }, []);
}
