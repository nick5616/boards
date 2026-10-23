import { useState } from "react";
import { useData } from "../../contexts/DataContext";
import { useBoardEntries } from "../../hooks/useEntries";
import { useDesktop } from "../../hooks/useMedia";
import { MODULES, STATUSES, newModule, findSpot } from "../../constants/modules";
import { deleteEntriesWhere } from "../../lib/data";
import { hslStr } from "../../utils/color";
import IconChip from "../IconChip";
import Canvas from "./Canvas";
import WidgetGrid, { mobileOrder } from "./WidgetGrid";
import ModuleTray from "./ModuleTray";
import BigSheet from "./BigSheet";

export default function BoardView({ board, onBack, onEdit }) {
  const { uid, updateBoard, toast } = useData();
  const entries = useBoardEntries(uid, board.id);
  const desktop = useDesktop();
  const [tray, setTray] = useState(false);
  const [arranging, setArranging] = useState(false);
  const [bigId, setBigId] = useState(null);

  const onModules = (fn, opts) => updateBoard(board.id, (b) => ({ ...b, modules: fn(b.modules) }), opts);
  const patchModule = (id, patch, opts) =>
    onModules((ms) => ms.map((m) => (m.id === id ? (typeof patch === "function" ? patch(m) : { ...m, ...patch }) : m)), opts);
  const setModState = (id) => (fn, opts) => patchModule(id, (m) => ({ ...m, state: fn(m.state) }), opts);

  const addModule = (type) => {
    const { w, h } = MODULES[type].desk;
    const spot = findSpot(board.modules, w, h, Math.max(960, window.innerWidth - 80));
    const mod = newModule(type, spot, { z: Math.max(0, ...board.modules.map((m) => m.z ?? 1)) + 1 });
    updateBoard(board.id, (b) => ({
      ...b,
      modules: [...b.modules, mod],
      // Phones put new things at the top, where you'll see them
      mobileOrder: b.mobileOrder ? [mod.id, ...mobileOrder(b)] : b.mobileOrder,
    }));
    setTray(false);
    if (!desktop) window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const removeModule = (mod) => {
    const owns = ["diary", "scrapbook"].includes(mod.type);
    const n = entries.filter((e) => e.moduleId === mod.id).length;
    const msg = owns && n
      ? `Remove “${mod.title}” and the ${n} thing${n === 1 ? "" : "s"} in it?`
      : `Remove “${mod.title}”?`;
    if (!confirm(msg)) return;
    onModules((ms) => ms.filter((m) => m.id !== mod.id));
    if (owns) deleteEntriesWhere(uid, "moduleId", mod.id).catch(() => toast({ text: "couldn't clean up entries" }));
  };

  const frameProps = (mod) => ({
    board,
    mod,
    entries,
    setState: setModState(mod.id),
    onPatch: (p) => patchModule(mod.id, p),
    onRemove: () => removeModule(mod),
    openBig: () => setBigId(mod.id),
  });

  const onArrange = ({ mobileOrder: order, sizes }) =>
    updateBoard(board.id, (b) => ({
      ...b,
      mobileOrder: order,
      modules: sizes ? b.modules.map((m) => (sizes[m.id] ? { ...m, mw: sizes[m.id].w, mh: sizes[m.id].h } : m)) : b.modules,
    }));

  const big = board.modules.find((m) => m.id === bigId);

  return (
    <div className={`board${desktop ? " board-desk" : ""}`}>
      <div className="detail-hdr board-hdr">
        <button className="detail-back" onClick={onBack} aria-label="Back">←</button>
        <button className="board-title-btn" onClick={onEdit} title="Edit look">
          <IconChip board={board} />
          <span className="detail-hdr-title">{board.title}</span>
        </button>
        <select
          className={`status-pill st-${board.status}`}
          value={board.status}
          onChange={(e) => updateBoard(board.id, { status: e.target.value })}
          aria-label="Status"
        >
          {STATUSES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
        </select>
        {desktop ? (
          <button
            className={`tool-btn${board.snap ? " on" : ""}`}
            onClick={() => updateBoard(board.id, { snap: !board.snap })}
            title="Snap to grid"
          >
            ▦ snap
          </button>
        ) : (
          <button className={`tool-btn${arranging ? " on" : ""}`} onClick={() => setArranging((v) => !v)}>
            {arranging ? "done" : "✥"}
          </button>
        )}
        <button className="btn-add board-add" onClick={() => setTray(true)}>+ add</button>
      </div>
      <div className="detail-strip" style={{ background: hslStr(board.color.h, board.color.s, board.color.l) }} />

      {board.modules.length === 0 ? (
        <button className="board-empty" onClick={() => setTray(true)}>
          an empty board — tap to slap something on it
        </button>
      ) : desktop ? (
        <Canvas board={board} frameProps={frameProps} onModules={onModules} />
      ) : (
        <WidgetGrid board={board} arranging={arranging} frameProps={frameProps} onArrange={onArrange} />
      )}

      {tray && <ModuleTray onPick={addModule} onClose={() => setTray(false)} />}
      {big && (
        <BigSheet board={board} mod={big} entries={entries} setState={setModState(big.id)} onClose={() => setBigId(null)} />
      )}
    </div>
  );
}
