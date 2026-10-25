import { useEffect, useState } from "react";
import { onSnapshot } from "firebase/firestore";
import { useData } from "../../contexts/DataContext";
import { membersCol, mountDoc } from "../../lib/data";
import { freshInvite, revokeInvite, removeMember, stopSharing, linkFor, firstName } from "../../lib/share";
import { Face } from "./Faces";

const KEYS = [
  { role: "edit", label: "can edit", note: "they sign in with Google, then add and change things" },
  { role: "view", label: "can look", note: "opens right away, no account; nothing can be changed" },
];

// The board's little envelope: two keys to hand out, the guest list, and a way
// to take it all back. Only the owner gets here.
export default function ShareSheet({ board, onClose }) {
  const { uid, toast } = useData();
  const [invites, setInvites] = useState({}); // my current { edit, view } tokens
  const [members, setMembers] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    const quiet = () => {};
    const a = onSnapshot(mountDoc(uid, board.id), (s) => setInvites(s.data()?.invites ?? {}), quiet);
    const b = onSnapshot(
      membersCol(board.id),
      (s) => setMembers(s.docs.map((d) => d.data()).sort((x, y) => (x.joinedAt ?? 0) - (y.joinedAt ?? 0))),
      quiet
    );
    return () => { a(); b(); };
  }, [uid, board.id]);

  const others = (members ?? []).filter((m) => m.uid !== uid);
  const diary = board.modules.some((m) => m.type === "diary");
  const sharing = others.length > 0 || Object.values(invites).some(Boolean);

  const attempt = async (job, done) => {
    setBusy(true);
    try {
      await job();
      if (done) toast({ text: done });
    } catch (e) {
      toast({ text: `couldn't do that (${e.code ?? e.message})` });
    }
    setBusy(false);
  };

  const copy = async (token) => {
    try {
      await navigator.clipboard.writeText(linkFor(token));
      toast({ text: "link copied" });
    } catch {
      toast({ text: "couldn't copy; select the link and copy it by hand" });
    }
  };

  const stop = () => {
    const n = others.length;
    const msg = n
      ? `Stop sharing “${board.title}”? ${n === 1 ? firstName(others[0].name) : `${n} people`} will lose it, and both links stop working.`
      : "Stop sharing? Both links stop working.";
    if (confirm(msg)) attempt(() => stopSharing(board, uid, invites), "it's just yours again");
  };

  return (
    <div className="overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal tray share-sheet" role="dialog" aria-modal="true" aria-label="Share this board">
        <div className="modal-topbar">
          <div className="modal-handle" />
          <div className="modal-title">Share “{board.title}”</div>
          <button className="modal-x" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div className="share-body">
          {KEYS.map(({ role, label, note }) => {
            const token = invites[role];
            return (
              <div key={role} className="share-key">
                <div className="share-key-head">
                  <b>Anyone with this link {label}</b>
                  <span>{note}</span>
                </div>
                {token ? (
                  <>
                    <div className="share-link">
                      <input readOnly value={linkFor(token)} onFocus={(e) => e.target.select()} aria-label={`Link, ${label}`} />
                      <button className="mini-btn" onClick={() => copy(token)}>copy</button>
                    </div>
                    <div className="share-key-acts">
                      <button
                        className="mini-btn ghost"
                        disabled={busy}
                        onClick={() => attempt(() => freshInvite(board, uid, role, invites), "fresh link made; the old one stopped working")}
                      >
                        make a fresh one
                      </button>
                      <button
                        className="mini-btn ghost"
                        disabled={busy}
                        onClick={() => attempt(() => revokeInvite(board, uid, role, invites), "link taken back")}
                      >
                        take it back
                      </button>
                    </div>
                  </>
                ) : (
                  <button className="mini-btn" disabled={busy} onClick={() => attempt(() => freshInvite(board, uid, role, invites))}>
                    make a link
                  </button>
                )}
              </div>
            );
          })}

          <div className="share-list-head">The guest list</div>
          <ul className="share-members">
            {(members ?? []).map((m) => (
              <li key={m.uid}>
                <Face person={m} size={32} />
                <span className="share-who">
                  {m.uid === uid ? "You" : m.name || "Guest"}
                  <small>{m.role === "owner" ? "owner" : m.role === "edit" ? "can edit" : "can look"}</small>
                </span>
                {m.uid !== uid && (
                  <button
                    className="mini-btn ghost"
                    disabled={busy}
                    onClick={() =>
                      confirm(`Take ${firstName(m.name)} off “${board.title}”?${invites[m.role] ? " (They could use the link again; make a fresh one to stop that.)" : ""}`) &&
                      attempt(() => removeMember(board.id, m.uid), `${firstName(m.name)} is off the list`)
                    }
                  >
                    remove
                  </button>
                )}
              </li>
            ))}
            {members && !others.length && <li className="share-empty">just you so far</li>}
          </ul>

          {diary && (
            <p className="share-warn">
              📖 There's a diary on this board.{" "}
              {others.length === 1 ? `${firstName(others[0].name)} will be able to read it` : "Anyone you share this with will be able to read it"}.
            </p>
          )}

          {sharing && (
            <button className="share-stop" disabled={busy} onClick={stop}>
              Stop sharing
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
