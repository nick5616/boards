import { useState, useEffect } from "react";
import { useData } from "../../contexts/DataContext";
import { useBoardEntries } from "../../hooks/useEntries";
import { useDesktop } from "../../hooks/useMedia";
import { MODULES, STATUSES, newModule, findSpot } from "../../constants/modules";
import { deleteEntriesWhere, addEntry, copyImage, saveImage, compressImage, deleteImage } from "../../lib/data";
import { toLink } from "../../lib/snapshot";
import { useGotoRequests } from "../../lib/goto";
import { del as delLocal } from "../../lib/localMedia";
import { classify, takeIn, nameFor } from "../../lib/paste";
import { hslStr } from "../../utils/color";
import { uid as newId } from "../../utils/uid";
import IconChip from "../IconChip";
import { mobileOrder } from "./WidgetGrid";
import { BoardContext } from "./BoardContext";
import { modulesIn, withContents, destinations, spaceWidth, pickTab, locator } from "./spaces";
import Space from "./Space";
import TabStrip from "./TabStrip";
import ModuleTray from "./ModuleTray";
import ShareButton from "../share/ShareButton";
import PasteSheet from "./PasteSheet";
import BigSheet from "./BigSheet";

const OWNS_ENTRIES = ["diary", "scrapbook"];
const things = (n) => `${n} thing${n === 1 ? "" : "s"}`;

export default function BoardView({ board, onBack, onEdit }) {
  const { uid, updateBoard, toast } = useData();
  const entries = useBoardEntries(uid, board.id);
  const desktop = useDesktop();
  const [tray, setTray] = useState(null); // the space ({ parent, tab }) new things go into
  const [arranging, setArranging] = useState(false);
  const [bigIds, setBigIds] = useState([]); // opened big, newest last: a folder, then something in it
  const [pasted, setPasted] = useState(null); // { space, paste } waiting to be put somewhere
  // A board shared "can look": everything shows and moves live, nothing here edits (see useSpaces)
  const readOnly = board.role === "view";
  const [lookTab, setLookTab] = useState(null); // a viewer's own place in the tabs, since the board's is the owner's

  // The whole board, or one tab, as a link anyone can open a copy from
  const copyLink = async (tabId) => {
    try {
      const { url, size, long } = await toLink(board, { tabId });
      await navigator.clipboard.writeText(url);
      toast({
        text: long
          ? `copied, but it's long (${Math.round(size / 1000)}k) and some chat apps may cut it off`
          : "copied — anyone with it can open a copy",
        ms: long ? 8000 : 5000,
      });
    } catch {
      toast({ text: "couldn't make a link" });
    }
  };

  const boardTabs = board.tabs ?? [];
  const tab = pickTab(boardTabs, readOnly && lookTab ? lookTab : board.tab);
  const color = hslStr(board.color.h, board.color.s, board.color.l);

  const onModules = (fn, opts) => updateBoard(board.id, (b) => ({ ...b, modules: fn(b.modules) }), opts);
  const patchModule = (id, patch, opts) =>
    onModules((ms) => ms.map((m) => (m.id === id ? (typeof patch === "function" ? patch(m) : { ...m, ...patch }) : m)), opts);
  const setModState = (id) => (fn, opts) => patchModule(id, (m) => ({ ...m, state: fn(m.state) }), opts);

  // Where something lands in a space: the first open spot, on top of the pile
  const landing = (space, w, h) => {
    const siblings = modulesIn(board, space);
    // A drop remembers where the cursor was (space.at); the new thing is centred there
    const spot = space.at
      ? { x: Math.max(0, Math.round(space.at.x - w / 2)), y: Math.max(0, Math.round(space.at.y - h / 2)) }
      : findSpot(siblings, w, h, spaceWidth(board, space));
    return {
      ...spot,
      z: Math.max(0, ...siblings.map((m) => m.z ?? 1)) + 1,
      parent: space.parent,
      tab: space.tab,
    };
  };

  const createModule = (type, space, state, title) => {
    const { w, h } = MODULES[type].desk;
    const { z, ...spot } = landing(space, w, h);
    const mod = newModule(type, spot, { z, parent: spot.parent, tab: spot.tab, ...(state ? { state } : {}), ...(title ? { title } : {}) });
    updateBoard(board.id, (b) => ({
      ...b,
      modules: [...b.modules, mod],
      // Phones put new things at the top, where you'll see them
      mobileOrder: b.mobileOrder ? [mod.id, ...mobileOrder(b)] : b.mobileOrder,
    }));
    if (!desktop && !space.parent) window.scrollTo({ top: 0, behavior: "smooth" });
    return mod;
  };

  // For modules that want to make another module: createModule(type, { near, state, title }) → new id.
  // It lands in the same space as `near` (a module id), in the first open spot, with the given
  // starting state and title; the id is usable right away (e.g. as an entry's moduleId).
  const makeModule = (type, { near, state, title } = {}) => {
    const from = board.modules.find((m) => m.id === near);
    const space = from ? locator(board)(from) : { parent: null, tab };
    return createModule(type, space, state, title).id;
  };

  const addModule = (type) => {
    createModule(type, tray);
    setTray(null);
  };

  const onPasted = (space, clip) => {
    const paste = classify(clip);
    if (paste) setPasted({ space, paste });
    else toast({ text: "nothing on the clipboard to paste" });
  };

  // Puts the paste into an existing module (into = its id) or a new one
  const applyPaste = async (type, into) => {
    const { space, paste } = pasted;
    setPasted(null);
    let p = paste;
    if (p.kind === "image") {
      try {
        const imageIds = [];
        for (const img of p.images) imageIds.push(saveImage(uid, board.id, await compressImage(img)));
        p = { ...p, imageIds };
      } catch {
        return toast({ text: "couldn't read that picture" });
      }
    }
    const target = into
      ? board.modules.find((m) => m.id === into)
      : createModule(type, space, takeIn(type, MODULES[type].init(), p), nameFor(type, p));
    if (into) patchModule(into, (m) => ({ ...m, state: takeIn(type, m.state, p) }));
    if (type === "scrapbook") {
      p.imageIds.forEach((imageId) => addEntry(uid, { kind: "photo", boardId: board.id, moduleId: target.id, imageId, text: "" }));
    }
    if (type === "diary") addEntry(uid, { kind: "diary", boardId: board.id, moduleId: target.id, text: p.text });
    toast({ text: into ? `added to “${target.title}”` : `made a new ${MODULES[type].label.toLowerCase()}` });
  };

  // Takes modules (with everything inside them) off the board and cleans up the
  // entries they own. also = a further change made in the same write.
  const dropModules = (ids, also = (b) => b) => {
    const owners = board.modules.filter((m) => ids.includes(m.id) && OWNS_ENTRIES.includes(m.type));
    updateBoard(board.id, (b) => also({ ...b, modules: b.modules.filter((m) => !ids.includes(m.id)) }));
    setBigIds((s) => s.filter((id) => !ids.includes(id)));
    owners.forEach((m) =>
      deleteEntriesWhere(uid, board.id, "moduleId", m.id).catch(() => toast({ text: "couldn't clean up entries" }))
    );
    // Recordings live on this computer's shelf: clear the ones nothing else on this board
    // still points at. (Other boards can't be seen from here; a copy there would lose its sound.)
    const kept = new Set(
      board.modules.filter((m) => !ids.includes(m.id) && m.type === "tape").flatMap((m) => (m.state.takes ?? []).map((t) => t.id))
    );
    board.modules
      .filter((m) => ids.includes(m.id) && m.type === "tape")
      .flatMap((m) => m.state.takes ?? [])
      .forEach((t) => kept.has(t.id) || delLocal(t.id));
    // A mirror owns the pictures it kept (imageIds in its state) and its clips on the shelf
    board.modules
      .filter((m) => ids.includes(m.id) && m.type === "mirror")
      .forEach((m) => {
        (m.state.snaps ?? []).forEach((id) => deleteImage(uid, id));
        (m.state.reels ?? []).forEach((r) => delLocal(r.id));
      });
    // A photo strips module owns the frame pictures of every strip in it
    board.modules
      .filter((m) => ids.includes(m.id) && m.type === "photostrip")
      .forEach((m) => (m.state.strips ?? []).forEach((s) => s.frames.forEach((f) => deleteImage(uid, f.imageId))));
  };

  const removeModule = (mod) => {
    const ids = withContents(board.modules, [mod.id]);
    const n = entries.filter((e) => e.moduleId === mod.id).length;
    const msg = ids.length > 1
      ? `Remove “${mod.title}” and the ${things(ids.length - 1)} in it?`
      : OWNS_ENTRIES.includes(mod.type) && n
        ? `Remove “${mod.title}” and the ${things(n)} in it?`
        : mod.type === "photostrip" && mod.state.strips?.length
          ? `Remove “${mod.title}” and its ${mod.state.strips.length} strip${mod.state.strips.length === 1 ? "" : "s"}?`
        : mod.type === "tape" && mod.state.takes?.length
          ? `Remove “${mod.title}” and delete its ${mod.state.takes.length} recording${mod.state.takes.length === 1 ? "" : "s"} from this computer?`
        : `Remove “${mod.title}”?`;
    if (confirm(msg)) dropModules(ids);
  };

  // parent = a folder's id, or null for one of the board's own tabs
  const removeTab = (parent, t) => {
    if (!parent && boardTabs.length === 1) {
      if (confirm("Put the tabs away? Everything stays on the board.")) updateBoard(board.id, { tabs: [] });
      return;
    }
    const ids = withContents(board.modules, modulesIn(board, { parent, tab: t.id }).map((m) => m.id));
    if (!confirm(ids.length ? `Remove the “${t.name}” tab and the ${things(ids.length)} on it?` : `Remove the “${t.name}” tab?`)) return;
    dropModules(ids, (b) =>
      parent
        ? {
            ...b,
            modules: b.modules.map((m) =>
              m.id === parent ? { ...m, state: { ...m.state, tabs: m.state.tabs.filter((x) => x.id !== t.id) } } : m
            ),
          }
        : { ...b, tabs: b.tabs.filter((x) => x.id !== t.id) }
    );
  };

  // A new tab right after t, holding copies of everything on it (folders bring
  // their insides). full = with what's written in them; otherwise each module
  // starts fresh in the same spot, so a tab set up once works as a template.
  const duplicateTab = (parent, t, full) => {
    const name = prompt("Name the copy", `${t.name} copy`)?.trim();
    if (!name) return;
    const tabId = newId();
    const ids = withContents(board.modules, modulesIn(board, { parent, tab: t.id }).map((m) => m.id));
    const copyId = Object.fromEntries(ids.map((id) => [id, newId()]));
    // Pictures get their own copies, so deleting one doesn't break the other
    const withOwnImages = (v) =>
      Array.isArray(v)
        ? v.map(withOwnImages)
        : v && typeof v === "object"
          ? Object.fromEntries(
              Object.entries(v).map(([k, x]) => [k, k === "imageId" && x ? copyImage(uid, board.id, x) : withOwnImages(x)])
            )
          : v;
    const copies = board.modules
      .filter((m) => ids.includes(m.id))
      .map((m) => ({
        ...m,
        id: copyId[m.id],
        // Things on the tab move to the new tab; things inside a copied folder follow it
        parent: copyId[m.parent] ?? m.parent,
        tab: copyId[m.parent] ? m.tab : tabId,
        state: full || m.type === "folder" ? withOwnImages(m.state) : MODULES[m.type].init(),
      }));
    const after = (tabs) => {
      const i = tabs.findIndex((x) => x.id === t.id);
      return [...tabs.slice(0, i + 1), { id: tabId, name }, ...tabs.slice(i + 1)];
    };
    updateBoard(board.id, (b) => {
      const modules = [...b.modules, ...copies];
      return parent
        ? {
            ...b,
            modules: modules.map((m) =>
              m.id === parent ? { ...m, state: { ...m.state, tabs: after(m.state.tabs), active: tabId } } : m
            ),
          }
        : { ...b, modules, tabs: after(b.tabs), tab: tabId };
    });
    // Diary pages and photos live as entries, so they're copied one by one
    if (full) {
      entries
        .filter((e) => copyId[e.moduleId])
        .forEach(({ id, imageId, ...e }) =>
          addEntry(uid, { ...e, moduleId: copyId[e.moduleId], ...(imageId ? { imageId: copyImage(uid, board.id, imageId) } : {}) })
        );
    }
  };

  // Before tabs change order, every module writes down which tab it's on.
  // (Ones from before there were tabs have been going by "the first tab".)
  const reorderTabs = (parent, next) =>
    updateBoard(board.id, (b) => {
      const where = locator(b);
      const modules = b.modules.map((m) => {
        const { tab: on } = where(m);
        return m.tab === on ? m : { ...m, tab: on };
      });
      return parent
        ? { ...b, modules: modules.map((m) => (m.id === parent ? { ...m, state: { ...m.state, tabs: next } } : m)) }
        : { ...b, modules, tabs: next };
    });

  // The first board tab holds whatever was already on the board
  const addBoardTab = (name) => {
    const id = newId();
    updateBoard(board.id, (b) => {
      const tabs = b.tabs?.length ? b.tabs : b.modules.length ? [{ id: newId(), name: "Main" }] : [];
      return { ...b, tabs: [...tabs, { id, name }], tab: id };
    });
  };

  // Opens the board tab, and the folder tab, a space is on
  const goTo = ({ parent, tab: to }) =>
    updateBoard(board.id, (b) => {
      if (!parent) return { ...b, tab: to };
      const folder = b.modules.find((m) => m.id === parent);
      return {
        ...b,
        tab: locator(b)(folder).tab,
        modules: b.modules.map((m) => (m.id === parent ? { ...m, state: { ...m.state, active: to } } : m)),
      };
    });

  const moveModule = (mod, to) => {
    patchModule(mod.id, landing(to, mod.w, mod.h));
    toast({ text: `moved to ${to.label}`, actions: [{ label: "go there", run: () => goTo(to) }] });
  };

  const frameProps = (mod) => ({
    board,
    mod,
    entries,
    setState: setModState(mod.id),
    onPatch: (p) => patchModule(mod.id, p),
    onRemove: () => removeModule(mod),
    openBig: () => setBigIds((s) => [...s.filter((id) => id !== mod.id), mod.id]),
    moveTargets: () => destinations(board, mod),
    onMove: (to) => moveModule(mod, to),
  });

  // order = the new phone order of one space; the rest of the board keeps theirs
  const onArrange = ({ mobileOrder: order, sizes }) =>
    updateBoard(board.id, (b) => ({
      ...b,
      mobileOrder: [...order, ...mobileOrder(b).filter((id) => !order.includes(id))],
      modules: sizes ? b.modules.map((m) => (sizes[m.id] ? { ...m, mw: sizes[m.id].w, mh: sizes[m.id].h } : m)) : b.modules,
    }));

  // Ctrl+K asks from outside: open a module big, add one, copy the link
  useGotoRequests(board, {
    open: (id) => setBigIds((s) => [...s.filter((x) => x !== id), id]),
    add: (type) => createModule(type, { parent: null, tab }),
    link: () => copyLink(),
  });

  const big = board.modules.find((m) => m.id === bigIds[bigIds.length - 1]);
  const context = {
    board, desktop, arranging, frameProps, onModules, onArrange, openTray: setTray, removeTab, duplicateTab, reorderTabs, onPasted, toast,
    createModule: makeModule,
  };

  return (
    <BoardContext.Provider value={readOnly ? { ...context, readOnly, openTray: () => {}, onPasted: () => {} } : context}>
      <div className={`board${desktop ? " board-desk" : ""}${readOnly ? " board-look" : ""}`}>
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
            disabled={readOnly}
            aria-label="Status"
          >
            {STATUSES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
          {readOnly ? null : desktop ? (
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
          <button className="tool-btn" onClick={() => copyLink()} title="Copy this board as a link">
            🔗 link
          </button>
          <ShareButton board={board} />
          {!boardTabs.length && !readOnly && (
            <button
              className="tool-btn"
              title="Split this board into tabs"
              onClick={() => {
                const name = prompt("Name the new tab", "Tab 2");
                if (name?.trim()) addBoardTab(name.trim());
              }}
            >
              + tab
            </button>
          )}
          {!readOnly && <button className="btn-add board-add" onClick={() => setTray({ parent: null, tab })}>+ add</button>}
        </div>
        {boardTabs.length > 0 && (
          <TabStrip
            className="board-tabs"
            style={{ "--board": color }}
            tabs={boardTabs}
            active={tab}
            onSelect={(id) => (readOnly ? setLookTab(id) : updateBoard(board.id, { tab: id }))}
            onAdd={addBoardTab}
            onRename={(id, name) =>
              updateBoard(board.id, (b) => ({ ...b, tabs: b.tabs.map((t) => (t.id === id ? { ...t, name } : t)) }))
            }
            onDuplicate={(t, full) => duplicateTab(null, t, full)}
            onReorder={(next) => reorderTabs(null, next)}
            onRemove={(t) => removeTab(null, t)}
            onLink={(t) => copyLink(t.id)}
            removeLabel={boardTabs.length === 1 ? "Put the tabs away" : undefined}
          />
        )}
        <div className="detail-strip" style={{ background: color }} />

        <Space key={tab} parent={null} tab={tab} />

        {tray && <ModuleTray nested={!!tray.parent} onPick={addModule} onClose={() => setTray(null)} />}
        {pasted && (
          <PasteSheet
            paste={pasted.paste}
            here={modulesIn(board, pasted.space)}
            onPick={applyPaste}
            onClose={() => setPasted(null)}
          />
        )}
        {big && (
          <BigSheet
            key={big.id}
            board={board}
            mod={big}
            entries={entries}
            setState={setModState(big.id)}
            onPatch={(p) => patchModule(big.id, p)}
            // Escape with the tray (or paste sheet) open closes just that
            onClose={() => !tray && !pasted && setBigIds((s) => s.slice(0, -1))}
          />
        )}
      </div>
    </BoardContext.Provider>
  );
}
