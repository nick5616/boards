import { useState } from "react";
import { useData } from "../../contexts/DataContext";
import { useLive } from "../../contexts/LiveContext";
import { useBoardEntries } from "../../hooks/useEntries";
import { MODULES } from "../../constants/modules";
import { slugs, pathFor } from "../../lib/routes";
import { MODULE_COMPONENTS } from ".";

// Folders need the board they sit on, and a window can't look through a window
const windowable = (m) => m.type !== "folder" && m.type !== "window";

// A little sash window onto another module, anywhere. What you do in it happens
// to the real thing: it writes to the source board and reads that board's entries.
export default function Window({ mod, setState }) {
  const data = useData();
  const { uid, updateBoard, boards } = data;
  const live = useLive();
  const [wide, setWide] = useState(false); // the window's own "open big"
  const [picking, setPicking] = useState(false);

  const src = mod.state.src ?? null;
  const board = src && boards?.find((b) => b.id === src.boardId);
  const target = board?.modules.find((m) => m.id === src.modId);
  const entries = useBoardEntries(uid, board?.id ?? null);
  const Body = target && windowable(target) ? MODULE_COMPONENTS[target.type] : null;

  const choices = (boards ?? [])
    .map((b) => ({ board: b, mods: b.modules.filter((m) => windowable(m) && m.id !== mod.id) }))
    .filter((g) => g.mods.length);

  const pick = (value) => {
    const [boardId, modId] = value.split("/");
    if (boardId && modId) setState((s) => ({ ...s, src: { boardId, modId } }));
    setPicking(false);
  };

  // App opens the board for us (the dock's openBoard); failing that, load its address
  const goThere = () => {
    if (live?.openBoard) live.openBoard(board.id);
    else window.location.assign(pathFor(slugs(boards).get(board.id)));
  };

  const picker = (
    <select className="win-pick" value="" onChange={(e) => pick(e.target.value)} aria-label="Pick a module to look at">
      <option value="">{boards ? "pick something to look at…" : "looking for boards…"}</option>
      {choices.map((g) => (
        <optgroup key={g.board.id} label={g.board.title}>
          {g.mods.map((m) => (
            <option key={m.id} value={`${g.board.id}/${m.id}`}>
              {m.title}
              {m.title !== MODULES[m.type].label ? ` (${MODULES[m.type].label})` : ""}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );

  // Nothing chosen yet, or what it looked at is gone
  if (!Body || picking) {
    const gone = !!src && !picking;
    return (
      <div className="win win-bare">
        <div className="win-frame">
          <i className="win-curtain l" />
          <i className="win-curtain r" />
          <div className="win-pane">
            <div className="win-msg">
              {gone ? (
                <>
                  <b>the view's gone</b>
                  <span>{board ? "that module was taken down" : "that board is gone, or isn't shared with you"}</span>
                </>
              ) : (
                <b>a window onto…</b>
              )}
              {picker}
              {picking && src && (
                <button className="mini-btn ghost" onClick={() => setPicking(false)}>
                  keep looking at {target?.title}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const edit = (fn, opts) =>
    updateBoard(board.id, (b) => ({ ...b, modules: b.modules.map((m) => (m.id === target.id ? fn(m) : m)) }), opts);

  return (
    <div className="win">
      <div className="win-frame">
        <i className="win-curtain l" />
        <i className="win-curtain r" />
        {/* the glass wears the looked-at module's own paper (mod-timer, mod-graph…) */}
        <div className={`win-pane mod-${target.type}`}>
          <div className={`win-view${wide ? " big" : ""}`}>
            <Body
              board={board}
              mod={target}
              entries={entries}
              setState={(fn, opts) => edit((m) => ({ ...m, state: fn(m.state) }), opts)}
              onPatch={(p) => edit((m) => ({ ...m, ...p }))}
              openBig={() => setWide(true)}
              expanded={wide}
            />
          </div>
        </div>
        <i className="win-sash" aria-hidden="true" />
      </div>
      <div className="win-sill">
        <span className="win-from" title={`${target.title}, on ${board.title}`}>
          {target.title} <i>on {board.title}</i>
        </span>
        {wide && (
          <button className="mini-btn ghost" onClick={() => setWide(false)}>
            ⤡ less
          </button>
        )}
        <button className="mini-btn ghost" onClick={goThere}>↗ go there</button>
        <button className="mini-btn ghost" onClick={() => setPicking(true)}>change</button>
      </div>
    </div>
  );
}
