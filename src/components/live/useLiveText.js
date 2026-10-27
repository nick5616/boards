import { useState, useEffect, useLayoutEffect, useRef, useCallback } from "react";
import { useTogether } from "./TogetherContext";
import { liveText, shiftPos } from "../../lib/liveText";
import { uidOfPeer } from "../../lib/presence";

// A text box several people can type in at once (docs/plans/peer-to-peer.md P5). Only active
// in a shared, open board with someone else in the room and when I can edit: then the box
// shows the merged Yjs text and `onChange` is only called when I'm the one who saves the record.
// Anywhere else it does nothing, and the box is the plain textarea it always was.
//   const live = useLiveText(ref, boxKey, liveId, value, onChange, canEdit)
//   live → null (plain), or { text, change(next) }
export function useLiveText(ref, boxKey, liveId, value, onChange, canEdit) {
  const t = useTogether();
  const room = t?.room ?? null;
  // The box's name in the room: its module, plus its own id when it has one (else its place)
  const key = boxKey && liveId ? `${boxKey.slice(0, boxKey.lastIndexOf(":"))}:${liveId}` : boxKey;
  const on = !!(canEdit && key && room && t.peers.length > 0 && t.me?.uid);
  const [text, setText] = useState(value);
  const lt = useRef(null);
  const caret = useRef(null); // where to put the caret after the next render
  const latest = useRef({ value, onChange });
  latest.current = { value, onChange };

  useEffect(() => {
    if (!on) return;
    const x = liveText(room, key, {
      initial: latest.current.value ?? "",
      myUid: t.me.uid,
      uidOf: (p) => (p.includes("-") ? uidOfPeer(p) : p),
      onPersist: (s) => latest.current.onChange(s),
    });
    lt.current = x;
    setText(x.text());
    const off = x.onRemote(({ delta, text: next }) => {
      const ta = ref.current;
      if (ta && document.activeElement === ta) {
        // Several edits can land before a render: carry on from where the last one put the caret
        const from = caret.current ?? { start: ta.selectionStart, end: ta.selectionEnd };
        caret.current = { start: shiftPos(from.start, delta), end: shiftPos(from.end, delta) };
      }
      setText(next);
    });
    return () => {
      off();
      x.destroy();
      lt.current = null;
      caret.current = null;
    };
  }, [on, room, key]);

  // The text changed under the caret: put the caret back where it belongs
  useLayoutEffect(() => {
    const c = caret.current;
    const ta = ref.current;
    caret.current = null;
    if (c && ta && document.activeElement === ta) ta.setSelectionRange(c.start, c.end);
  }, [text]);

  const change = useCallback((next) => {
    lt.current.set(next);
    setText(next);
  }, []);

  return on && lt.current ? { text, change } : null;
}
