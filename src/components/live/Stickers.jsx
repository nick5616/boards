import { useState, useEffect } from "react";
import StampSVG from "../StampSVG";
import { STAMPS } from "../../constants/stamps";
import { firstName } from "../../lib/share";

// A stamp somebody threw at you: it flies in from a side, lands with a thud, wobbles, and is
// gone. Nothing is kept. (Throwing one is in the header, from a person's face: see TogetherBar.)

const LIFE = 3200;

export default function Stickers({ room, who }) {
  const [flying, setFlying] = useState([]);

  useEffect(() => {
    return room.on("toss", (m, from) => {
      if (!STAMPS.some((s) => s.id === m.stamp)) return;
      const id = Math.random().toString(36).slice(2);
      // Lands somewhere in the middle of the screen, coming from a random edge
      const side = Math.random() * Math.PI * 2;
      const toss = {
        id,
        stamp: m.stamp,
        by: who(from),
        x: 18 + Math.random() * 64,
        y: 20 + Math.random() * 55,
        dx: Math.round(Math.cos(side) * 700),
        dy: Math.round(Math.sin(side) * 500),
        tilt: Math.round(Math.random() * 40 - 20),
      };
      setFlying((l) => [...l, toss]);
      setTimeout(() => setFlying((l) => l.filter((t) => t.id !== id)), LIFE);
    });
  }, [room, who]);

  return (
    <div className="tg-stickers" aria-hidden="true">
      {flying.map((t) => (
        <div
          key={t.id}
          className="tg-sticker"
          style={{ left: `${t.x}%`, top: `${t.y}%`, "--dx": `${t.dx}px`, "--dy": `${t.dy}px`, "--tilt": `${t.tilt}deg`, "--who": t.by.color }}
        >
          <span className="tg-sticker-stamp"><StampSVG stampId={t.stamp} color="#2a2520" /></span>
          <span className="tg-sticker-from">{firstName(t.by.name)}</span>
        </div>
      ))}
    </div>
  );
}
