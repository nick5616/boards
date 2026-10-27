import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { STATUSES } from "../constants/modules";
import { agoLabel } from "../utils/date";
import CardInnards from "./CardInnards";

const CARD_BASE_W = 145;

export default function DashCard({ card, onOpen, onEdit, onDelete, onStatus }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuAt, setMenuAt] = useState(null); // where the menu sits on screen (it floats outside the card, which clips)
  const [textScale, setTextScale] = useState(2);
  const menuRef = useRef(null);
  const popRef = useRef(null);
  const cardRef = useRef(null);
  const status = STATUSES.find((s) => s.id === card.status)?.label;
  const ago = agoLabel(card.lastLoggedAt);
  const meta = [status, ago && `last ${ago}`].filter(Boolean).join(" · ");

  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const w = entry.contentRect.width;
      if (w > 0) setTextScale(w / CARD_BASE_W);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Close menu when clicking outside, scrolling or resizing
  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e) => {
      if (!menuRef.current?.contains(e.target) && !popRef.current?.contains(e.target)) setMenuOpen(false);
    };
    const close = () => setMenuOpen(false);
    document.addEventListener("pointerdown", handler);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("pointerdown", handler);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [menuOpen]);

  // Under the ··· button, or above it when the bottom of the screen is too close
  const openMenu = (btn) => {
    const r = btn.getBoundingClientRect();
    const right = Math.max(8, window.innerWidth - r.right);
    const up = window.innerHeight - r.bottom < 260;
    setMenuAt(up ? { right, bottom: window.innerHeight - r.top + 4 } : { right, top: r.bottom + 4 });
    setMenuOpen(true);
  };

  return (
    <div
      ref={cardRef}
      className={`card card-${card.layout}`}
      onClick={() => { if (!menuOpen) onOpen(card); }}
      role="button"
      tabIndex={0}
      aria-label={`Open ${card.title}`}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); if (!menuOpen) onOpen(card); } }}
    >
      <CardInnards
        layout={card.layout}
        stampId={card.stampId}
        iconData={card.iconData}
        color={card.color}
        title={card.title}
        meta={meta}
        scale={textScale}
        iconOffsetX={card.iconOffsetX}
        iconScale={card.iconScale}
      />

      <div ref={menuRef}>
        <button
          className="card-dots"
          onClick={(e) => { e.stopPropagation(); menuOpen ? setMenuOpen(false) : openMenu(e.currentTarget); }}
          aria-label="Card options"
          aria-expanded={menuOpen}
        >
          ···
        </button>
        {menuOpen && createPortal(
          <div ref={popRef} className="card-menu floating" style={menuAt} role="menu" onClick={(e) => e.stopPropagation()}>
            {STATUSES.filter((s) => s.id !== card.status).map((s) => (
              <button key={s.id} role="menuitem" onClick={() => { onStatus(card.id, s.id); setMenuOpen(false); }}>
                → {s.label}
              </button>
            ))}
            <button role="menuitem" onClick={() => { onEdit(card); setMenuOpen(false); }}>✏️ Edit card</button>
            <button role="menuitem" className="danger" onClick={() => { onDelete(card.id); setMenuOpen(false); }}>🗑 Delete</button>
          </div>,
          document.body
        )}
      </div>
    </div>
  );
}
