import { useState } from "react";
import { uid } from "./utils/uid";
import { useLocalStorage } from "./hooks/useLocalStorage";
import { SEEDS } from "./constants/seeds";
import { IconOverridesProvider } from "./contexts/IconOverridesContext";
import DashCard from "./components/DashCard";
import CardEditor from "./components/CardEditor";
import DetailView from "./components/DetailView";
import SettingsView from "./components/SettingsView";

export default function App() {
  const [cards, setCards]       = useLocalStorage("myboards-cards", SEEDS);
  const [search, setSearch]     = useState("");
  const [openCard, setOpenCard] = useState(null);
  const [modal, setModal]       = useState(null);
  const [showSettings, setShowSettings] = useState(false);

  const filtered = cards.filter((c) =>
    c.title.toLowerCase().includes(search.toLowerCase())
  );

  const createCard = (updates) => {
    setCards((prev) => [
      ...prev,
      { id: uid(), blocks: [{ id: uid(), type: "bigtitle", value: updates.title }], ...updates },
    ]);
    setModal(null);
  };

  const editCard = (id, updates) => {
    setCards((prev) => prev.map((c) => (c.id === id ? { ...c, ...updates } : c)));
    setModal(null);
  };

  const deleteCard = (id) => {
    setCards((prev) => prev.filter((c) => c.id !== id));
    if (openCard?.id === id) setOpenCard(null);
  };

  const updateContent = (updated) => {
    setCards((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
    setOpenCard(updated);
  };

  return (
    <IconOverridesProvider>
      <div className="app">
        {showSettings ? (
          <SettingsView
            cards={cards}
            onBack={() => setShowSettings(false)}
          />
        ) : openCard ? (
          <DetailView
            card={cards.find((c) => c.id === openCard.id) || openCard}
            onBack={() => setOpenCard(null)}
            onUpdate={updateContent}
          />
        ) : (
          <>
            <header className="hdr">
              <div>
                <div className="hdr-wordmark">my boards</div>
                <div className="hdr-sub">
                  {cards.length} collection{cards.length !== 1 ? "s" : ""}
                </div>
              </div>
              <button className="btn-add" onClick={() => setModal({ mode: "create" })}>
                + New
              </button>
            </header>

            <div className="search-wrap">
              <div className="search-inner">
                <span className="search-ico" aria-hidden="true">⌕</span>
                <input
                  type="search"
                  className="search-in"
                  placeholder="Search your boards…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  aria-label="Search boards"
                />
              </div>
            </div>

            <div className="section-label" aria-hidden="true">Collections</div>

            <main className="grid">
              {filtered.length === 0 && (
                <div className="empty">
                  {search ? "no boards match that search" : "nothing here yet…"}
                </div>
              )}
              {filtered.map((card) => (
                <DashCard
                  key={card.id}
                  card={card}
                  onOpen={setOpenCard}
                  onEdit={(c) => setModal({ mode: "edit", card: c })}
                  onDelete={deleteCard}
                />
              ))}
            </main>

            <footer className="dash-footer">
              <button
                className="btn-settings"
                onClick={() => setShowSettings(true)}
                aria-label="Open settings"
              >
                Settings
              </button>
            </footer>

            {modal && (
              <CardEditor
                card={modal.mode === "edit" ? modal.card : null}
                onSave={(updates) =>
                  modal.mode === "edit"
                    ? editCard(modal.card.id, updates)
                    : createCard(updates)
                }
                onClose={() => setModal(null)}
              />
            )}
          </>
        )}
      </div>
    </IconOverridesProvider>
  );
}
