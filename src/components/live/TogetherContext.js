import { createContext, useContext, useEffect, useState } from "react";

// What a shared, open board knows about the people in it. null when nobody else is
// around (a private board, the demo, VITE_SPACES off), so every hook here is a no-op then.
//   me, people          who I am; the others here: [{ uid, name, color, photo, tab }]
//   room                the live peer room (null until joined)
//   who(peerId)         the person behind a peer id
//   focus, typing       Maps: peer → module id they're in; block key → { peer, at }
//   typed(key)          tell the room I'm typing in a block
//   pen, setPen         the fading-ink pen
//   clk                 the room's shared clock (clk.now(), clk.ready), null until joined
export const TogetherContext = createContext(null);
export const useTogether = () => useContext(TogetherContext);

const SOFT_LOCK = 3000; // a block someone else is typing in stays theirs this long after the last key

// Who else has a hand in this module right now ({ name, color }), for its outline
export function useFocuser(modId) {
  const t = useTogether();
  if (!t) return null;
  for (const [peer, mid] of t.focus) if (mid === modId) return t.who(peer);
  return null;
}

// Typing in one text box. Gives { by, locked, typed }: by = the person writing there (or null),
// locked = read-only for a moment so two people don't type over each other (not used where the text
// is merged live, see useLiveText), typed() = I just typed, key = this box's name in the room.
export function useWriting(ref) {
  const t = useTogether();
  const [key, setKey] = useState(null);
  const [, tick] = useState(0);

  // A block is named by its module and its place among that module's text boxes: the same
  // on every screen, because everyone has the same board
  useEffect(() => {
    const ta = ref.current;
    const mod = ta?.closest(".mod");
    const k = mod && t ? `${mod.dataset.mid}:${[...mod.querySelectorAll("textarea")].indexOf(ta)}` : null;
    setKey((was) => (was === k ? was : k));
  });

  const hit = key && t?.typing.get(key);
  const live = hit && Date.now() - hit.at < SOFT_LOCK;
  // Come back and unlock once they've been quiet long enough
  useEffect(() => {
    if (!live) return;
    const id = setTimeout(() => tick((n) => n + 1), hit.at + SOFT_LOCK - Date.now() + 30);
    return () => clearTimeout(id);
  }, [hit?.at, live]);

  if (!t || !key) return { by: null, locked: false, typed() {}, key: null };
  return { by: live ? t.who(hit.peer) : null, locked: !!live, typed: () => t.typed(key), key };
}
