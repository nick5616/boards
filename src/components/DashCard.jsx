import { useState, useRef, useEffect } from "react";
import CardInnards from "./CardInnards";

export default function DashCard({ card, onOpen, onEdit, onDelete }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  const count = card.blocks.filter((b) => b.type !== "divider").length;

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
        count={count}
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
            <button role="menuitem" onClick={() => { onEdit(card); setMenuOpen(false); }}>✏️ Edit card</button>
            <button role="menuitem" className="danger" onClick={() => { onDelete(card.id); setMenuOpen(false); }}>🗑 Delete</button>
          </div>
        )}
      </div>
    </div>
  );
}
