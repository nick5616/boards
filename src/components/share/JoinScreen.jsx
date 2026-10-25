import { useEffect, useState } from "react";
import { auth } from "../../firebase";
import { lookUpInvite, joinSpace, upgradeToGoogle, firstName } from "../../lib/share";

// Someone sent a share link (/s/<token>). Shows who it's from, then joins and
// opens the board. A view link needs no account (a guest sign-in); an edit link
// wants Google. The invite itself carries the board's title and the sender's
// name, since a stranger can't read the board until they're in.
export default function JoinScreen({ token, user, signIn, signInAnon, boards, onJoined, onLeave }) {
  const [invite, setInvite] = useState(undefined); // undefined = looking, null = gone
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);
  const [, bump] = useState(0);

  useEffect(() => {
    if (!user) return;
    lookUpInvite(token).then(setInvite, (e) => { setErr(e.code ?? e.message); setInvite(null); });
  }, [token, user]);

  const guest = !!auth.currentUser?.isAnonymous;
  const order = Math.max(-1, ...(boards ?? []).map((b) => b.order ?? 0)) + 1;

  const go = async (before) => {
    setBusy(true);
    setErr(null);
    try {
      if (before) await before();
      onJoined(await joinSpace(token, invite, auth.currentUser.uid, order));
    } catch (e) {
      setErr(e.code ?? e.message);
      setBusy(false);
      bump((n) => n + 1);
    }
  };

  const from = firstName(invite?.fromName);
  const needsGoogle = invite?.role === "edit" && guest;

  return (
    <div className="app">
      <div className="login-screen open-link join-screen">
        <div className="hdr-wordmark" style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>my boards</div>
        {user === undefined ? (
          <p>One moment…</p>
        ) : !user ? (
          <>
            <p className="open-link-from">someone sent you an envelope</p>
            <h2 className="open-link-title">A shared board is waiting</h2>
            <p className="open-link-note">Sign in to see who it's from. If it's a look-only link, you can peek without an account.</p>
            <button className="btn-google-signin" onClick={signIn}>Sign in with Google</button>
            <button className="open-link-skip" onClick={() => signInAnon().catch((e) => setErr(e.code ?? e.message))}>
              or just look, no account
            </button>
            {err && <p className="open-link-note">{err === "auth/operation-not-allowed" ? "guest sign-in isn't switched on yet" : "couldn't sign in"}</p>}
          </>
        ) : invite === undefined ? (
          <p>Unfolding the envelope…</p>
        ) : invite === null ? (
          <>
            <h2 className="open-link-title">This link doesn't work any more</h2>
            <p className="open-link-note">
              {err === "permission-denied" ? "It can't be opened from here." : "It may have been taken back. Ask for a fresh one."}
            </p>
            <button className="btn-add" onClick={onLeave}>← back</button>
          </>
        ) : (
          <>
            <p className="open-link-from">{from} shared</p>
            <h2 className="open-link-title">{invite.title || "a board"}</h2>
            <p className="open-link-note">
              with you.{" "}
              {invite.role === "edit"
                ? "You'll be able to add and change things."
                : "You can look around; nothing will change on your side."}
            </p>
            {needsGoogle ? (
              <button className="btn-google-signin" disabled={busy} onClick={() => go(upgradeToGoogle)}>
                Sign in with Google to open it
              </button>
            ) : (
              <button className="btn-add" disabled={busy} onClick={() => go()}>
                {busy ? "opening…" : "Open it"}
              </button>
            )}
            <button className="open-link-skip" onClick={onLeave}>no thanks</button>
            {err && (
              <p className="open-link-note">
                {err === "auth/credential-already-in-use"
                  ? "that Google account already has boards. Sign in with it directly, then use the link again."
                  : err === "permission-denied"
                    ? "this link was taken back just now"
                    : "couldn't open it, try again"}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
