import { uid } from "../../utils/uid";
import { useBoardContext } from "../board/BoardContext";
import { pickTab } from "../board/spaces";
import TabStrip, { tabColor } from "../board/TabStrip";
import Space from "../board/Space";

// File folders: a control module. Each tab is its own blank page that holds
// other modules, e.g. one tab per friend you're writing a song with.
export default function Folder({ mod, setState }) {
  const { openTray, removeTab, duplicateTab, reorderTabs } = useBoardContext();
  const tabs = mod.state.tabs;
  const active = pickTab(tabs, mod.state.active);
  const i = tabs.findIndex((t) => t.id === active);

  return (
    <div className="folder">
      <div className="folder-top">
        <TabStrip
          tabs={tabs}
          active={active}
          onSelect={(id) => setState((s) => ({ ...s, active: id }))}
          onAdd={(name) => {
            const id = uid();
            setState((s) => ({ ...s, tabs: [...s.tabs, { id, name }], active: id }));
          }}
          onRename={(id, name) => setState((s) => ({ ...s, tabs: s.tabs.map((t) => (t.id === id ? { ...t, name } : t)) }))}
          onDuplicate={(t, full) => duplicateTab(mod.id, t, full)}
          onReorder={(next) => reorderTabs(mod.id, next)}
          onRemove={tabs.length > 1 ? (t) => removeTab(mod.id, t) : undefined}
        />
        <button className="folder-add" onClick={() => openTray({ parent: mod.id, tab: active })}>+ add</button>
      </div>
      <div className="folder-page" style={{ "--tab": tabColor(tabs[i], i) }}>
        <Space parent={mod.id} tab={active} />
      </div>
    </div>
  );
}
