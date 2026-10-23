import { useState, useEffect } from "react";
import { onSnapshot, query, where } from "firebase/firestore";
import { entriesCol, loadImage } from "../lib/data";
import { dayKey, addDays, keyToDate } from "../utils/date";

function useEntryQuery(uid, field, op, value) {
  const [entries, setEntries] = useState([]);
  useEffect(() => {
    if (!uid || value == null) return;
    return onSnapshot(query(entriesCol(uid), where(field, op, value)), (snap) => {
      // Sorted here rather than in the query, so no composite index is needed
      setEntries(snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => b.at - a.at));
    });
  }, [uid, field, op, value]);
  return entries;
}

// Everything logged across all boards in the last `days` days
export function useRecentEntries(uid, days = 21) {
  const since = keyToDate(dayKey(addDays(new Date(), -days))).getTime();
  return useEntryQuery(uid, "at", ">=", since);
}

export const useBoardEntries = (uid, boardId) => useEntryQuery(uid, "boardId", "==", boardId);

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
