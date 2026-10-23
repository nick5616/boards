import { useState, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "./hooks/useAuth";
import { useBoards } from "./hooks/useBoards";
import { useRecentEntries } from "./hooks/useEntries";
import { useLocalStorage } from "./hooks/useLocalStorage";
import { IconOverridesProvider } from "./contexts/IconOverridesContext";
import { DataProvider } from "./contexts/DataContext";
import { addEntry, deleteEntry, updateEntry, errorSink } from "./lib/data";
import { newModule } from "./constants/modules";
import DashCard from "./components/DashCard";
import CardEditor from "./components/CardEditor";
import BoardView from "./components/board/BoardView";
import SettingsView from "./components/SettingsView";
import Glance from "./components/home/Glance";
import Tiles from "./components/home/Tiles";
import Toast from "./components/Toast";

const VIEWS = [
  { id: "glance", label: "Glance" },
  { id: "tiles", label: "Cards" },
  { id: "full", label: "Full" },
];

export default function App() {
  const { user, signIn, signOut } = useAuth();
  const { boards, error, updateBoard, createBoard, deleteBoard } = useBoards(user);
  const logs = useRecentEntries(user?.uid);
  const [view, setView] = useLocalStorage("myboards-home-view", "glance");
  const [search, setSearch] = useState("");
  const [openId, setOpenId] = useState(null);
  const [modal, setModal] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [toast, setToast] = useState(null);
  const uid = user?.uid;

  const clearToast = useCallback(() => setToast(null), []);

  useEffect(() => {
    errorSink.report = (e) => {
      console.error(e);
      setToast({ text: `couldn't save (${e.code ?? e.message})`, ms: 8000 });
    };
  }, []);

  // Logging remembers the board's previous "last practiced" so undo can restore it
  const logPractice = useCallback((boardId, text = "") => {
    let prevLast = null;
    const at = Date.now();
    updateBoard(boardId, (b) => {
      prevLast = b.lastLoggedAt ?? null;
      return { ...b, lastLoggedAt: Math.max(at, b.lastLoggedAt ?? 0) };
    });
    const { id } = addEntry(uid, { kind: "log", boardId, text, at, prevLast });
    return { id, at, boardId, prevLast };
  }, [uid, updateBoard]);

  const undoLog = useCallback((entry) => {
    deleteEntry(uid, entry);
    updateBoard(entry.boardId, (b) =>
      b.lastLoggedAt === entry.at ? { ...b, lastLoggedAt: entry.prevLast ?? null } : b
    );
  }, [uid, updateBoard]);

  const quickLog = useCallback((boardId) => {
    const entry = logPractice(boardId);
    setToast({
      text: "sticker stuck ✓",
      actions: [
        { label: "+ note", run: () => ({ placeholder: "what did you do?", submit: (t) => updateEntry(uid, entry.id, { text: t }) }) },
        { label: "undo", run: () => undoLog(entry) },
      ],
    });
  }, [uid, logPractice, undoLog]);

  const data = useMemo(
    () => ({ uid, updateBoard, logPractice, undoLog, quickLog, toast: setToast }),
    [uid, updateBoard, logPractice, undoLog, quickLog]
  );

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

  if (error) {
    const rules = error.code === "permission-denied";
    return (
      <div className="app">
        <div className="empty error-screen">
          {rules ? (
            <>
              <p>The database rules don't allow the new board layout yet.</p>
              <p className="error-detail">
                Deploy <code>firestore.rules</code> from this repo:<br />
                <code>firebase deploy --only firestore:rules</code>
                <br />Your existing boards are untouched.
              </p>
            </>
          ) : (
            <p>Something went wrong loading your boards: {error.message}</p>
          )}
        </div>
      </div>
    );
  }

  // Boards still loading (or being moved over from the old format)
  if (boards === null) {
    return <div className="app"><div className="empty">Loading your boards…</div></div>;
  }

  const filtered = boards.filter((b) => b.title.toLowerCase().includes(search.toLowerCase()));
  const openBoard = boards.find((b) => b.id === openId);
  const setStatus = (id, status) => updateBoard(id, { status });

  const saveEditor = (fields) => {
    if (modal.mode === "edit") updateBoard(modal.card.id, fields);
    else {
      const id = createBoard({
        ...fields,
        status: "active",
        modules: [newModule("tracker", { x: 0, y: 0 }), newModule("nextup", { x: 360, y: 20 })],
      });
      setOpenId(id);
    }
    setModal(null);
  };

  const removeBoard = (id) => {
    const b = boards.find((x) => x.id === id);
    if (!confirm(`Delete “${b?.title}” and everything on it? This can't be undone.`)) return;
    deleteBoard(id);
    if (openId === id) setOpenId(null);
  };

  const active = boards.filter((b) => b.status === "active").length;

  return (
    <IconOverridesProvider>
      <DataProvider value={data}>
        <div className={`app${openBoard ? " app-wide" : ""}`}>
          {showSettings ? (
            <SettingsView cards={boards} onBack={() => setShowSettings(false)} />
          ) : openBoard ? (
            <BoardView
              board={openBoard}
              onBack={() => setOpenId(null)}
              onEdit={() => setModal({ mode: "edit", card: openBoard })}
            />
          ) : (
            <>
              <header className="hdr">
                <div>
                  <div className="hdr-wordmark">my boards</div>
                  <div className="hdr-sub">
                    {active} going on · {boards.length} board{boards.length !== 1 ? "s" : ""}
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <img
                    src={user.photoURL}
                    alt={user.displayName}
                    title={`${user.displayName} — tap to sign out`}
                    style={{ width: 28, height: 28, borderRadius: "50%", cursor: "pointer" }}
                    onClick={signOut}
                  />
                  <button className="btn-add" onClick={() => setModal({ mode: "create" })}>
                    + New
                  </button>
                </div>
              </header>

              <div className="search-wrap home-tools">
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
                <div className="view-switch" role="tablist" aria-label="Home view">
                  {VIEWS.map((v) => (
                    <button
                      key={v.id}
                      role="tab"
                      aria-selected={view === v.id}
                      className={view === v.id ? "sel" : ""}
                      onClick={() => setView(v.id)}
                    >
                      {v.label}
                    </button>
                  ))}
                </div>
              </div>

              {filtered.length === 0 && (
                <div className="empty">{search ? "no boards match that search" : "nothing here yet…"}</div>
              )}

              {filtered.length > 0 && view === "glance" && (
                <Glance boards={filtered} logs={logs} onOpen={(b) => setOpenId(b.id)} onStatus={setStatus} searching={!!search} />
              )}
              {filtered.length > 0 && view === "tiles" && (
                <main className="tiles-wrap">
                  <Tiles boards={filtered} onOpen={(b) => setOpenId(b.id)} />
                </main>
              )}
              {filtered.length > 0 && view === "full" && (
                <>
                  <div className="section-label" aria-hidden="true">Collections</div>
                  <main className="grid">
                    {filtered.map((card) => (
                      <DashCard
                        key={card.id}
                        card={card}
                        onOpen={(c) => setOpenId(c.id)}
                        onEdit={(c) => setModal({ mode: "edit", card: c })}
                        onDelete={removeBoard}
                        onStatus={setStatus}
                      />
                    ))}
                  </main>
                </>
              )}

              <footer className="dash-footer">
                <button className="btn-settings" onClick={() => setShowSettings(true)} aria-label="Open settings">
                  Settings
                </button>
              </footer>
            </>
          )}

          {modal && (
            <CardEditor
              card={modal.mode === "edit" ? modal.card : null}
              onSave={saveEditor}
              onClose={() => setModal(null)}
              onDelete={modal.mode === "edit" ? () => { setModal(null); removeBoard(modal.card.id); } : null}
            />
          )}
          <Toast toast={toast} onDone={clearToast} />
        </div>
      </DataProvider>
    </IconOverridesProvider>
  );
}
