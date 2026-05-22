import { useState, useEffect, useRef } from "react";
import { doc, getDoc, setDoc, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";
import { SEEDS } from "../constants/seeds";

export function useBoards(user) {
  const [cards, setCards] = useState(null); // null = not yet loaded
  const saveTimerRef = useRef(null);

  useEffect(() => {
    if (!user) { setCards(null); return; }

    const docRef = doc(db, "users", user.uid);

    // Subscribe to realtime updates (syncs across devices)
    const unsub = onSnapshot(docRef, (snap) => {
      if (snap.exists()) {
        setCards(snap.data().cards ?? []);
      } else {
        // First time: seed with defaults and save
        const initial = SEEDS;
        setCards(initial);
        setDoc(docRef, { cards: initial });
      }
    });

    return unsub;
  }, [user]);

  const persistCards = (updated) => {
    if (!user) return;
    // Debounce writes — Firestore free tier has write limits
    clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      setDoc(doc(db, "users", user.uid), { cards: updated });
    }, 800);
  };

  const updateCards = (updater) => {
    setCards((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      persistCards(next);
      return next;
    });
  };

  return [cards, updateCards];
}
