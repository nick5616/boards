import { useState } from "react";
import { uid } from "./utils/uid";
import { useAuth } from "./hooks/useAuth";
import { useBoards } from "./hooks/useBoards";
import { IconOverridesProvider } from "./contexts/IconOverridesContext";
import DashCard from "./components/DashCard";
import CardEditor from "./components/CardEditor";
import DetailView from "./components/DetailView";
import SettingsView from "./components/SettingsView";

export default function App() {
  const { user, signIn, signOut } = useAuth();
  const [cards, setCards] = useBoards(user);
  const [search, setSearch]     = useState("");
  const [openCard, setOpenCard] = useState(null);
  const [modal, setModal]       = useState(null);
  const [showSettings, setShowSettings] = useState(false);

  // Still loading auth state
  if (user === undefined) {
    return <div className="app"><div className="empty">Loading…</div></div>;
  }

  // Not signed in
  if (!user) {
    return (
      <div className="app">
        <div className="login-screen">
          <div className="hdr-wordmark" style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>my boards</div>
          <p style={{ color: "var(--text-muted, #888)", marginBottom: "1.5rem" }}>
            Sign in to sync your boards across all devices.
          </p>
          <button className="btn-google-signin" onClick={signIn}>
            <svg width="18" height="18" viewBox="0 0 24 24" style={{ marginRight: 8 }}>
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Sign in with Google
          </button>
        </div>
      </div>
    );
  }

  // Boards still loading from Firestore
  if (cards === null) {
    return <div className="app"><div className="empty">Loading your boards…</div></div>;
  }

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
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <img
                  src={user.photoURL}
                  alt={user.displayName}
                  title={user.displayName}
                  style={{ width: 28, height: 28, borderRadius: "50%", cursor: "pointer" }}
                  onClick={signOut}
                />
                <button className="btn-add" onClick={() => setModal({ mode: "create" })}>
                  + New
                </button>
              </div>
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
