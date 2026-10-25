import { useRef, useEffect } from "react";
import { createPortal } from "react-dom";

// A small menu at the pointer. items = [{ label, run, danger }].
// Portaled to <body> so a tilted or scrolled parent doesn't carry it off the cursor.
export default function ContextMenu({ at, items, onClose }) {
  const ref = useRef(null);

  useEffect(() => {
    const away = (e) => !ref.current?.contains(e.target) && onClose();
    const onKey = (e) => e.key === "Escape" && onClose();
    // Not "scroll": focusing the thing that opened the menu can scroll its parent.
    // These only fire when the person moves the page themselves.
    const moved = ["wheel", "touchmove", "resize"];
    document.addEventListener("pointerdown", away);
    window.addEventListener("keydown", onKey);
    moved.forEach((ev) => window.addEventListener(ev, onClose, { passive: true }));
    return () => {
      document.removeEventListener("pointerdown", away);
      window.removeEventListener("keydown", onKey);
      moved.forEach((ev) => window.removeEventListener(ev, onClose));
    };
  }, [onClose]);

  return createPortal(
    <div
      ref={ref}
      className="card-menu ctx-menu"
      role="menu"
      style={{
        left: Math.min(at.x, window.innerWidth - 230),
        top: Math.min(at.y, window.innerHeight - items.length * 44 - 12),
      }}
    >
      {items.map((it) => (
        <button
          key={it.label}
          role="menuitem"
          className={it.danger ? "danger" : ""}
          onClick={() => {
            onClose();
            it.run();
          }}
        >
          {it.label}
        </button>
      ))}
    </div>,
    document.body
  );
}
