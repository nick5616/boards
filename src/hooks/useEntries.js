import { useState, useEffect } from "react";
import { onSnapshot, query, where } from "firebase/firestore";
import { SPACES, entriesCol, spaceEntriesCol, entriesGroup, loadImage } from "../lib/data";
import { DEMO, memory } from "../lib/demo";
import { dayKey, addDays, keyToDate } from "../utils/date";

// boardId is set for one board's entries; left out, spaces mode asks every board
// at once for the entries this person made.
function useEntryQuery(uid, field, op, value, boardId) {
  const [entries, setEntries] = useState([]);
  useEffect(() => {
    if (!uid || value == null) return;
    if (DEMO) {
      const read = () =>
        setEntries(
          [...memory.entries.values()]
            .filter((e) => (op === "==" ? e[field] === value : e[field] >= value))
            .sort((a, b) => b.at - a.at)
        );
      read();
      return memory.subscribe(read);
    }
    // The across-boards query needs a collection-group index (firestore.indexes.json)
    const source = !SPACES
      ? query(entriesCol(uid), where(field, op, value))
      : boardId
        ? spaceEntriesCol(boardId)
        : query(entriesGroup(), where("by", "==", uid), where(field, op, value));
    return onSnapshot(source, (snap) => {
      // Sorted here rather than in the query, so no extra index is needed
      setEntries(snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => b.at - a.at));
    });
  }, [uid, field, op, value, boardId]);
  return entries;
}

// Everything logged across all boards in the last `days` days
export function useRecentEntries(uid, days = 21) {
  const since = keyToDate(dayKey(addDays(new Date(), -days))).getTime();
  return useEntryQuery(uid, "at", ">=", since);
}

export const useBoardEntries = (uid, boardId) => useEntryQuery(uid, "boardId", "==", boardId, boardId);

export function useImage(uid, id) {
  const [src, setSrc] = useState(null);
  useEffect(() => {
    if (!uid || !id) return;
    let live = true;
    loadImage(uid, id).then((d) => live && setSrc(d));
    return () => { live = false; };
  }, [uid, id]);
  return src;
}
