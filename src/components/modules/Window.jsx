import { useState, useEffect, useLayoutEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useData } from "../../contexts/DataContext";
import { useBoardEntries } from "../../hooks/useEntries";
import { MODULES } from "../../constants/modules";
import { MODULE_COMPONENTS } from ".";
import { TrayArt } from "../board/ModuleTray";
import BigSheet from "../board/BigSheet";

// Folders need the board they sit on, and a window can't look through a window
const windowable = (m) => m.type !== "folder" && m.type !== "window";

// The title bar is the window's own; what's left is the source's body
const BAR = 32;

// Whatever size the source has on its own board is the size it's laid out at
const natural = (m) => ({
  w: m.w ?? MODULES[m.type].desk.w,
  h: Math.max(80, (m.h ?? MODULES[m.type].desk.h) - BAR),
});

// A live clipping of another module, anywhere. The module is laid out at its own
// size and shrunk to fit, so nothing is cropped. What you do in it happens to the
// real thing: it writes to the source board and reads that board's entries.
export default function Window({ mod, setState, onPatch }) {
  const { uid, updateBoard, boards, goTo } = useData();
  const [picking, setPicking] = useState(false);
  const [peek, setPeek] = useState(false); // the looked-at module's own "open big"
  const [actual, setActual] = useState(false); // 1:1 instead of fit
  const [box, setBox] = useState({ w: 0, h: 0 });
  const [q, setQ] = useState("");
  const boxRef = useRef(null);

  const src = mod.state.src ?? null;
  const board = src && boards?.find((b) => b.id === src.boardId);
  const target = board?.modules.find((m) => m.id === src.modId);
  const entries = useBoardEntries(uid, board?.id ?? null);
  const Body = target && windowable(target) ? MODULE_COMPONENTS[target.type] : null;
  const live = !!Body && !picking;

  // The title says what it shows, from the source's own (so a rename follows),
  // unless this window was named by hand
  const label = target && board ? `${target.title} ↗ ${board.title}` : null;
  useEffect(() => {
    if (label && !mod.named && mod.title !== label) onPatch?.({ title: label });
  }, [label, mod.named, mod.title, onPatch]);

  // Measure the room we've got, so the source can be fitted into it
  useLayoutEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const read = () => setBox({ w: el.clientWidth - 8, h: el.clientHeight - 8 }); // less the dashed edge and its padding
    read();
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, [live]);

  const pick = (b, m) => {
    setState((s) => ({ ...s, src: { boardId: b.id, modId: m.id } }));
    // Cut the window to the clipping's size so it looks right straight away
    const n = natural(m);
    onPatch?.({
      w: n.w + 12,
      h: n.h + BAR + 34,
      mw: m.mw ?? MODULES[m.type].mobile.w,
      mh: m.mh ?? MODULES[m.type].mobile.h,
    });
    setPicking(false);
    setQ("");
  };

  if (!live) {
    const needle = q.trim().toLowerCase();
    const rows = (boards ?? [])
      .map((b) => ({
        board: b,
        mods: b.modules.filter(
          (m) =>
            windowable(m) &&
            m.id !== mod.id &&
            `${m.title} ${MODULES[m.type].label} ${b.title}`.toLowerCase().includes(needle)
        ),
      }))
      .filter((g) => g.mods.length);
    const gone = !!src && !picking;
    return (
      <div className={`win win-bare${gone ? " gone" : ""}`}>
        {gone && (
          <div className="win-msg">
            <b>{mod.title}</b>
            <span>{board ? "that module was taken down" : "that board is gone, or isn't shared with you"}</span>
          </div>
        )}
        <input
          className="win-search"
          placeholder={boards ? (src ? "look at something else…" : "look through to…") : "looking for boards…"}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Search modules to look at"
        />
        <div className="win-list">
          {rows.map((g) => (
            <div key={g.board.id} className="win-group">
              <div className="win-board">{g.board.title}</div>
              {g.mods.map((m) => (
                <button key={m.id} className="win-row" onClick={() => pick(g.board, m)}>
                  <span className="win-thumb" aria-hidden="true">
                    <span>
                      <TrayArt type={m.type} />
                    </span>
                  </span>
                  <span className="win-row-t">
                    {m.title}
                    {m.title !== MODULES[m.type].label && <i>{MODULES[m.type].label}</i>}
                  </span>
                </button>
              ))}
            </div>
          ))}
          {boards && !rows.length && <div className="win-none">nothing matches</div>}
        </div>
        {picking && (
          <button className="mini-btn ghost" onClick={() => setPicking(false)}>
            keep looking at {target?.title}
          </button>
        )}
      </div>
    );
  }

  const edit = (fn, opts) =>
    updateBoard(board.id, (b) => ({ ...b, modules: b.modules.map((m) => (m.id === target.id ? fn(m) : m)) }), opts);
  const setTargetState = (fn, opts) => edit((m) => ({ ...m, state: fn(m.state) }), opts);
  const patchTarget = (p) => edit((m) => ({ ...m, ...p }));

  const n = natural(target);
  const fit = Math.min(box.w / n.w, box.h / n.h, 2);
  const scale = actual || !box.w ? 1 : Math.max(0.2, fit);
  const shrunk = !actual && scale < 0.97;

  return (
    <div className="win">
      <div className="win-box" ref={boxRef}>
        {/* sized to what it'll be after scaling, so the box can scroll in 1:1 */}
        <div className="win-fit" style={{ width: n.w * scale, height: n.h * scale }}>
          {/* the clipping wears the looked-at module's own paper (mod-timer, mod-graph…) */}
          <div className={`win-src mod mod-${target.type}`} style={{ width: n.w, height: n.h, transform: `scale(${scale})` }}>
            <div className="mod-body">
              <Body
                board={board}
                mod={target}
                entries={entries}
                setState={setTargetState}
                onPatch={patchTarget}
                openBig={() => setPeek(true)}
                expanded={false}
              />
            </div>
          </div>
        </div>
      </div>
      <div className="win-foot">
        <button className="win-tab" onClick={() => goTo(board.id, target.id)} title={`Open ${target.title} on ${board.title}`}>
          ↗ open on {board.title}
        </button>
        <span className="win-sp" />
        <button className="win-tab" onClick={() => setActual((v) => !v)} title={actual ? "Shrink to fit the window" : "Show at full size"}>
          {actual ? "fit" : shrunk ? `${Math.round(scale * 100)}%` : "1:1"}
        </button>
        <button className="win-tab" onClick={() => setPicking(true)}>
          change
        </button>
      </div>
      {/* out in the body: a transformed parent would trap the sheet's fixed overlay */}
      {peek &&
        createPortal(
          <BigSheet
            board={board}
            mod={target}
            entries={entries}
            setState={setTargetState}
            onPatch={patchTarget}
            onClose={() => setPeek(false)}
          />,
          document.body
        )}
    </div>
  );
}
