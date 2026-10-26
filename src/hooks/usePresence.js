import { useState, useEffect, useRef } from "react";
import { onSnapshot } from "firebase/firestore";
import { membersCol } from "../lib/data";
import { allow, joinPresence } from "../lib/presence";

// How many people share this space. Nothing live starts until it's more than one.
export function useMemberCount(sid, on) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!on) return setN(0);
    return onSnapshot(membersCol(sid), (s) => setN(s.size), () => setN(0));
  }, [sid, on]);
  return n;
}

// True while this browser tab is the one being looked at
export function useVisible() {
  const [v, setV] = useState(() => document.visibilityState !== "hidden");
  useEffect(() => {
    const on = () => setV(document.visibilityState !== "hidden");
    document.addEventListener("visibilitychange", on);
    return () => document.removeEventListener("visibilitychange", on);
  }, []);
  return v;
}

// The others looking at this board, and which tab each is on. Joins while `on`, leaves
// (and the face disappears for everyone else) when it turns off or the board closes.
export function usePresence(sid, role, tab, on) {
  const [people, setPeople] = useState([]);
  const [ready, setReady] = useState(false); // my access row is in, so the room may start
  const here = useRef(null);
  const tabNow = useRef(tab);
  tabNow.current = tab;

  useEffect(() => {
    if (!on) return;
    let dead = false;
    allow(sid, role)
      .then(() => {
        if (dead) return;
        setReady(true);
        return joinPresence(sid, () => tabNow.current, setPeople);
      })
      .then((h) => h && (dead ? h.leave() : (here.current = h)))
      .catch((e) => console.warn("presence: couldn't join", e));
    return () => {
      dead = true;
      here.current?.leave();
      here.current = null;
      setPeople([]);
      setReady(false);
    };
  }, [sid, role, on]);

  useEffect(() => {
    here.current?.touch();
  }, [tab]);

  return { people, ready };
}
