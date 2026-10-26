import { useState, useEffect } from "react";
import { room as joinRoom } from "../lib/peers";

// The live room for a shared space: `space:{sid}` on the peer bus. Returns the room
// (null until joined) and who's in it. Leaves when `on` turns off or the board closes.
export function useRoom(sid, on) {
  const [state, setState] = useState({ room: null, peers: [] });

  useEffect(() => {
    if (!on) return;
    const r = joinRoom(`space:${sid}`, { transport: "rtdb" });
    const sync = () => setState({ room: r, peers: [...r.peers] });
    const off = r.onPeer(sync);
    setState({ room: r, peers: [] });
    return () => {
      off();
      r.leave();
      setState({ room: null, peers: [] });
    };
  }, [sid, on]);

  return state;
}
