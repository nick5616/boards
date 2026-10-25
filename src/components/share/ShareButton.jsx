import { useState } from "react";
import { SPACES } from "../../lib/data";
import { DEMO } from "../../lib/demo";
import { auth } from "../../firebase";
import { upgradeToGoogle } from "../../lib/share";
import { useData } from "../../contexts/DataContext";
import ShareSheet from "./ShareSheet";

// What the board header shows for sharing: "Share…" for the owner, and for a
// guest without an account a quiet "sign in to keep this".
export default function ShareButton({ board }) {
  const { toast } = useData();
  const [open, setOpen] = useState(false);
  const [, bump] = useState(0);
  if (!SPACES || DEMO) return null;

  if (auth.currentUser?.isAnonymous) {
    const keep = async () => {
      try {
        await upgradeToGoogle();
        toast({ text: "signed in — this board is yours to keep" });
        bump((n) => n + 1);
      } catch (e) {
        toast({
          text: e.code === "auth/credential-already-in-use"
            ? "that Google account already has boards; sign out and sign in with it, then use the link again"
            : "couldn't sign in",
          ms: 8000,
        });
      }
    };
    return (
      <button className="tool-btn keep-btn" onClick={keep} title="Sign in with Google so this stays on your shelf">
        sign in to keep this
      </button>
    );
  }

  if (board.role !== "owner") return null;
  return (
    <>
      <button className="tool-btn" onClick={() => setOpen(true)} title="Share this board with people">
        ✉ Share…
      </button>
      {open && <ShareSheet board={board} onClose={() => setOpen(false)} />}
    </>
  );
}
