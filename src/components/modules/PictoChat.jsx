import { useState, useEffect, useRef } from "react";
import { useData } from "../../contexts/DataContext";
import { useTogether } from "../live/TogetherContext";
import { firstName, faceColor } from "../../lib/share";
import { uid as newId } from "../../utils/uid";
import { Seg } from "./kit";
import { Pic, Pad, PenTools, SIZES } from "./pixelKit";
import { W, CH, PENS, MAX_CHAT, BLANK_NOTE, decode, encode } from "../../lib/flipbook";

// A doodle chat on a pocket two-screener. Draw a little note on the bottom (touch) screen and
// send it; the notes scroll up the top screen for everyone on the board, and wait there for
// whoever comes by later. Notes are pixel strips, packed small (lib/flipbook).

const seenKey = (id) => `boards:flb-seen:${id}`;
const readSeen = (id) => {
  try {
    return Number(localStorage.getItem(seenKey(id))) || 0;
  } catch {
    return 0;
  }
};

export default function PictoChat({ mod, setState, expanded }) {
  const { uid: me } = useData();
  const together = useTogether();
  const chat = mod.state.chat ?? [];

  const [tool, setTool] = useState("pen");
  const [ink, setInk] = useState(1);
  const [size, setSize] = useState(1);
  const width = tool === "eraser" ? PENS[size] * 3 : PENS[size];
  const pen = tool === "eraser" ? 0 : ink;
  const [note, setNote] = useState(BLANK_NOTE);

  // Notes from others newer than my last look get a "new" line above them. The line stays
  // where it was while the module is open; the next visit starts from now.
  const [seenAtOpen] = useState(() => readSeen(mod.id));
  const firstNew = chat.findIndex((m) => m.by !== me && m.at > seenAtOpen);
  useEffect(() => {
    if (!chat.length) return;
    try {
      localStorage.setItem(seenKey(mod.id), String(Date.now()));
    } catch {
      /* it just shows the line again next time */
    }
  }, [chat.length, mod.id]);

  const log = useRef(null);
  useEffect(() => {
    if (log.current) log.current.scrollTop = log.current.scrollHeight;
  }, [chat.length, expanded]);

  const face = together?.me ?? { uid: me, name: "", color: faceColor(me ?? "") };
  const send = () => {
    if (note === BLANK_NOTE) return;
    const m = { id: newId(), by: me, name: face.name ?? "", color: face.color, at: Date.now(), px: note };
    setState((s) => ({ ...s, chat: [...(s.chat ?? []), m].slice(-MAX_CHAT) }));
    setNote(BLANK_NOTE);
  };
  const who = (m) => (m.by === me ? "me" : firstName(m.name) || "someone");

  return (
    <div className={`flb pch${expanded ? " big" : ""}`}>
      <div className="flb-ds">
        <div className="flb-lid">
          <div className="flb-screen">
            <div className="flb-log" ref={log} aria-live="polite" aria-label="Notes">
              {chat.length === 0 && <div className="flb-quiet">no notes yet · draw one below</div>}
              {chat.map((m, k) => (
                <div key={m.id} style={{ display: "contents" }}>
                  {k === firstNew && <div className="pch-new">new</div>}
                  <div className="flb-msg">
                    <span className="flb-tag" style={{ "--c": m.color }}>{who(m)}</span>
                    <Pic px={decode(m.px, W * CH)} label={`A note from ${who(m)}`} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flb-hinge" aria-hidden="true" />

        <div className="flb-base">
          <div className="flb-screen">
            <PenTools
              tool={tool}
              setTool={setTool}
              ink={ink}
              setInk={setInk}
              end={<button onClick={() => setNote(BLANK_NOTE)} disabled={note === BLANK_NOTE} aria-label="Clear the note">✕</button>}
            />
            <div className="flb-compose">
              <div className="flb-note">
                <span className="flb-tag" style={{ "--c": face.color }}>me</span>
                <Pad px={decode(note, W * CH)} ink={pen} width={width} onDone={(px) => setNote(encode(px))} label="Draw a note" />
              </div>
              <button className="flb-send" onClick={send} disabled={note === BLANK_NOTE}>send ✉</button>
            </div>
          </div>
        </div>
      </div>

      {expanded && (
        <div className="flb-more">
          <label className="flb-label">pen</label>
          <Seg small label="Pen size" value={size} onChange={setSize} options={SIZES} />
          {chat.length > 0 && (
            <div className="flb-row">
              <button className="mini-btn ghost" onClick={() => confirm("Clear every note, for everyone?") && setState((s) => ({ ...s, chat: [] }))}>clear the chat</button>
            </div>
          )}
          <p className="flb-label">the latest {MAX_CHAT} notes stay; everyone on the board sees them</p>
        </div>
      )}
    </div>
  );
}
