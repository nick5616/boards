import { useRef, useState } from "react";
import { useBoardContext } from "../board/BoardContext";
import { useContainer, Page, countLabel } from "./containerKit";

// A hinged diptych: exactly two surfaces side by side, for comparing (two looks, two
// takes, before and after). Drag the hinge to give one more room. On a phone the
// two panels stack and the hinge runs sideways.
export default function Split({ mod, setState }) {
  const { desktop } = useBoardContext();
  const c = useContainer(mod, setState);
  const root = useRef(null);
  const [live, setLive] = useState(null); // the ratio while the hinge is held
  const side = desktop; // side by side, or stacked
  const ratio = Math.min(0.8, Math.max(0.2, live ?? mod.state.ratio ?? 0.5));

  const at = (e) => {
    const r = root.current.getBoundingClientRect();
    return side ? (e.clientX - r.left) / r.width : (e.clientY - r.top) / r.height;
  };
  const hinge = {
    onPointerDown: (e) => {
      e.currentTarget.setPointerCapture(e.pointerId);
      setLive(at(e));
    },
    onPointerMove: (e) => live !== null && setLive(Math.min(0.8, Math.max(0.2, at(e)))),
    onPointerUp: () => {
      if (live !== null) setState((s) => ({ ...s, ratio: Math.round(live * 100) / 100 }));
      setLive(null);
    },
    onPointerCancel: () => setLive(null),
    onDoubleClick: () => setState((s) => ({ ...s, ratio: 0.5 })),
    onKeyDown: (e) => {
      const less = side ? "ArrowLeft" : "ArrowUp";
      const more = side ? "ArrowRight" : "ArrowDown";
      if (e.key !== less && e.key !== more) return;
      e.preventDefault();
      setState((s) => ({ ...s, ratio: Math.min(0.8, Math.max(0.2, Math.round(((s.ratio ?? 0.5) + (e.key === more ? 0.05 : -0.05)) * 100) / 100)) }));
    },
  };

  const pane = (t, k) => (
    <div className={`sp-pane p${k}`} style={{ flex: `${k ? 1 - ratio : ratio} 1 0`, "--tab": c.color(t) }}>
      <div className="sp-head">
        <button className="sp-label" onClick={() => c.rename(t)} title="Rename this side">{t.name}</button>
        <small>{countLabel(c.count(t))}</small>
        <button className="sp-add" onClick={() => c.addHere(t.id)}>+ add</button>
      </div>
      <Page mod={mod} tab={t.id} />
    </div>
  );

  return (
    <div ref={root} className={`sp ${side ? "side" : "stack"}${live !== null ? " moving" : ""}`}>
      {pane(c.tabs[0], 0)}
      <div
        className="sp-hinge"
        role="separator"
        aria-orientation={side ? "vertical" : "horizontal"}
        aria-valuenow={Math.round(ratio * 100)}
        aria-label="Drag to give one side more room"
        tabIndex={0}
        title="Drag to resize · double-click to centre"
        {...hinge}
      >
        <i className="knuckle a" /><i className="grip" /><i className="knuckle b" />
      </div>
      {pane(c.tabs[1], 1)}
    </div>
  );
}
