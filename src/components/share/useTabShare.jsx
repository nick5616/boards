import { useState } from "react";
import { SPACES } from "../../lib/data";
import { DEMO } from "../../lib/demo";
import { auth } from "../../firebase";
import { useData } from "../../contexts/DataContext";
import { shareTab, stopSharingTab, untuck } from "../../lib/shareTab";
import ShareSheet from "./ShareSheet";
import TabRibbon from "./TabRibbon";

const NONE = { items: () => [], badge: () => null, sheet: null };

// Everything a TabStrip needs to share its tabs: extra menu items, the "shared" stamp
// on mounted tabs, and the share sheet. board = the board the tabs belong to;
// parent = the folder whose tabs these are, or null for the board's own.
// Only the owner of a board gets the sharing items (an editor doesn't carve up someone else's board).
export function useTabShare(board, parent = null) {
  const { uid, updateBoard, toast, mounted } = useData();
  const [open, setOpen] = useState(null); // the space whose sheet is showing (a board-shaped stub or the real one)
  const [busy, setBusy] = useState(false);
  if (!SPACES || DEMO || !uid || auth.currentUser?.isAnonymous) return NONE;

  const attempt = async (job, fail) => {
    if (busy) return;
    setBusy(true);
    try {
      await job();
    } catch (e) {
      console.error(e);
      toast({ text: `${fail} (${e.code ?? e.message})` });
    }
    setBusy(false);
  };

  const share = (tab) =>
    attempt(async () => {
      const who = auth.currentUser;
      toast({ text: `making “${tab.name}” shareable…`, ms: 2500 });
      const { stub } = await shareTab({ uid, who: { name: who?.displayName, photo: who?.photoURL }, board, parent, tab, updateBoard });
      setOpen(stub);
    }, "couldn't share that tab");

  const unshare = (tab) =>
    attempt(async () => {
      await stopSharingTab({ uid, board, parent, tab, updateBoard });
      setOpen(null);
      toast({ text: `“${tab.name}” is a plain tab again` });
    }, "couldn't take that tab back");

  const owner = board.role === "owner" || board.role == null;
  const items = (t) => {
    if (!owner) return [];
    if (!t.mount) return [{ label: "✉ Share this tab…", run: () => share(t) }];
    const space = mounted?.get(t.mount);
    const mine = space?.role === "owner";
    return [
      ...(mine ? [{ label: "✉ Share…", run: () => setOpen(space) }] : []),
      ...(space ? [{ label: "⇱ Take off this board", run: () => untuck(uid, t.mount) }] : []),
      ...(mine
        ? [{
            label: "↩ Stop sharing this tab",
            danger: true,
            run: () =>
              confirm(`Stop sharing “${t.name}”? Everything on it comes back to this board, and everyone else loses it.`) && unshare(t),
          }]
        : []),
    ];
  };

  // Is the open sheet's space still the live one? (use the real thing once it has loaded)
  const live = open && (mounted?.get(open.id) ?? open);
  const mountTab = open && tabsMount(board, parent, open.id);
  return {
    items,
    badge: (t) => (t.mount ? <TabRibbon sid={t.mount} /> : null),
    sheet: live && (
      <ShareSheet
        board={live}
        onClose={() => setOpen(null)}
        onStop={mountTab ? () => stopSharingTab({ uid, board, parent, tab: mountTab, updateBoard }) : undefined}
      />
    ),
  };
}

// The mount tab (on this board or folder) that points at a space
function tabsMount(board, parent, sid) {
  const tabs = parent ? board.modules.find((m) => m.id === parent)?.state.tabs : board.tabs;
  return (tabs ?? []).find((t) => t.mount === sid);
}
