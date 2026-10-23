import { useState, useRef, useEffect } from "react";
import { STATUSES } from "../constants/modules";
import { agoLabel } from "../utils/date";
import CardInnards from "./CardInnards";

const CARD_BASE_W = 145;

export default function DashCard({ card, onOpen, onEdit, onDelete, onStatus }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [textScale, setTextScale] = useState(2);
  const menuRef = useRef(null);
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

  // Close menu when clicking outside
  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    document.addEventListener("pointerdown", handler);
    return () => document.removeEventListener("pointerdown", handler);
  }, [menuOpen]);

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
          onClick={(e) => { e.stopPropagation(); setMenuOpen((v) => !v); }}
          aria-label="Card options"
          aria-expanded={menuOpen}
        >
          ···
        </button>
        {menuOpen && (
          <div className="card-menu" role="menu" onClick={(e) => e.stopPropagation()}>
            {STATUSES.filter((s) => s.id !== card.status).map((s) => (
              <button key={s.id} role="menuitem" onClick={() => { onStatus(card.id, s.id); setMenuOpen(false); }}>
                → {s.label}
              </button>
            ))}
            <button role="menuitem" onClick={() => { onEdit(card); setMenuOpen(false); }}>✏️ Edit card</button>
            <button role="menuitem" className="danger" onClick={() => { onDelete(card.id); setMenuOpen(false); }}>🗑 Delete</button>
          </div>
        )}
      </div>
    </div>
  );
}
