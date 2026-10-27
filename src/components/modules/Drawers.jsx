import { useContainer, Page, countLabel } from "./containerKit";

// A little chest of drawers: each tab is a labelled drawer with a brass pull.
// One slides open at a time and shows its surface; the shut ones show what's inside.
export default function Drawers({ mod, setState }) {
  const c = useContainer(mod, setState);

  return (
    <div className="dr">
      <div className="dr-case">
        {c.tabs.map((t) => {
          const on = t.id === c.active;
          const n = c.count(t);
          return (
            <section key={t.id} className={`dr-drawer${on ? " open" : ""}`} style={{ "--tab": c.color(t) }}>
              <div
                className="dr-front"
                onClick={() => !on && c.select(t.id)}
                onContextMenu={(e) => c.openMenu(t, e)}
              >
                {/* the little card-holder every good drawer has */}
                <span className="dr-label">{t.name}</span>
                <span className="dr-count">
                  {!on && n > 0 && (
                    <span className="dr-stubs" aria-hidden="true">
                      {Array.from({ length: Math.min(n, 5) }, (_, k) => <i key={k} style={{ "--k": k }} />)}
                    </span>
                  )}
                  {countLabel(n)}
                </span>
                {on && n !== null && (
                  <button className="dr-add" onClick={(e) => { e.stopPropagation(); c.addHere(t.id); }}>+ add</button>
                )}
                <button
                  className="dr-pull"
                  aria-label={on ? `${t.name} options` : `Open ${t.name}`}
                  title={on ? "Drawer options" : "Pull open"}
                  onClick={(e) => {
                    e.stopPropagation();
                    on ? c.openMenu(t, e) : c.select(t.id);
                  }}
                />
              </div>
              {on && (
                <div className="dr-tray">
                  <Page mod={mod} tab={t.id} />
                </div>
              )}
            </section>
          );
        })}
        <button className="dr-new" onClick={() => c.add(`Drawer ${c.tabs.length + 1}`)}>＋ a new drawer</button>
      </div>
      {c.menuNode}
    </div>
  );
}
