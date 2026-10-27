// Phone as a remote: the shared bits of the desktop side (components/remote/RemoteHost)
// and the phone side (components/remote/RemotePage).
//
// Pairing, in short
//   1. The desktop shows a 6-digit code (and a QR of /remote#p=<code>). Room: "pair:<code>",
//      good for 2 minutes. The phone signs in as an anonymous guest (no Google needed) and says hi.
//   2. The desktop does not trust the code alone (6 digits can be guessed): it shows "Allow this
//      phone?" with a 2-digit check number it sent to the phone, which shows it too. The person
//      compares the two and presses Allow, and only then does the desktop answer with a long
//      random SECRET, handed over the encrypted peer link.
//      Both sides keep it in localStorage. From then on they meet in "pair:<secret>".
//      (Not "me:<uid>": that would force the phone to be signed in as the same Google
//      account, and the phone is often a browser you'd rather not sign in on.)
//   3. "Forget my phones" on the desktop makes a new secret, so old phones can't get back in.
//
// What goes over the room (channel → message):
//   rmt:pair   phone → desk  { k: "hi", name }
//              desk → phone { k: "check", n } then { k: "secret", secret } or { k: "no" }
//   rmt:state  desk → phone  what the second screen shows (see snapshot below), ~every 1.5s
//   rmt:cmd    phone → desk  { k: "log" | "tally" | "crack", id }
//   rmt:ack    desk → phone  { id, ok, text }          what happened, in words
//   rmt:bye    desk → phone  { k: "forget" }
//   file       phone → desk  a photo (sendFile, meta { k: "photo" })

import { signInAnonymously } from "firebase/auth";
import { auth } from "../firebase";
import { BASE } from "./routes";
import { getAudio } from "./audio";
import { beatAt, metroState } from "./metronome";

export const PAIR_EVENT = "boards-pair-phone"; // the palette asks the desktop to show the pairing dialog
export const CRACK_EVENT = "boards-remote-crack"; // { modId }: a shake, for a Fortune to crack another
export const PHOTO_EVENT = "boards-remote-photo"; // { images }: a phone photo no module caught
export const ROLL_EVENT = "boards-remote-roll"; // { modId }: a shake, for a Dice tray to roll
export const SPIN_EVENT = "boards-remote-spin"; // { modId }: a shake, for a Chore wheel to spin

export const CODE_MS = 2 * 60 * 1000;

// ?local=1 swaps the network for same-browser tabs, to try it all out on one computer
// (Remembered for the tab, since the board's own address drops the ?local=1; ?local=0 clears it.)
export const isLocal = () => {
  try {
    const q = new URLSearchParams(window.location.search).get("local");
    if (q != null) q === "0" ? sessionStorage.removeItem("boards-remote-local") : sessionStorage.setItem("boards-remote-local", "1");
    return sessionStorage.getItem("boards-remote-local") === "1";
  } catch {
    return new URLSearchParams(window.location.search).has("local");
  }
};
isLocal(); // look at the address now, while it still has the ?local=1
export const transportFor = (local) => (local ? "local" : "rtdb");

// The phone has no Google account on it: an anonymous guest is enough to join a pair room
// (the rules only look at the room name, which is a hash of the code or secret)
export async function phoneSignIn() {
  await auth.authStateReady();
  if (!auth.currentUser) await signInAnonymously(auth);
}

// ---- What each side remembers ------------------------------------------------
const read = (key) => {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? null;
  } catch {
    return null;
  }
};
const write = (key, v) => {
  try {
    v == null ? localStorage.removeItem(key) : localStorage.setItem(key, JSON.stringify(v));
  } catch {
    /* private window: pairing just won't stick */
  }
};

const rand = (n) => crypto.getRandomValues(new Uint32Array(n));
export const newCheck = () => String(10 + (rand(1)[0] % 90)); // the 2 digits both screens show
export const newCode = () => String(rand(1)[0] % 1_000_000).padStart(6, "0");
export const randomSecret = () => [...rand(6)].map((n) => n.toString(36).padStart(7, "0").slice(-7)).join("");

// Desktop: { secret, paired }. The secret is made once and kept.
export function deskPairing() {
  let d = read("boards-remote-desk");
  if (!d?.secret) {
    d = { secret: randomSecret(), paired: false };
    write("boards-remote-desk", d);
  }
  return d;
}
export const saveDesk = (patch) => write("boards-remote-desk", { ...deskPairing(), ...patch });
export const forgetPhones = () => write("boards-remote-desk", { secret: randomSecret(), paired: false });

// Phone: { secret, local }
export const phonePairing = () => read("boards-remote-phone");
export const savePhone = (v) => write("boards-remote-phone", v);

export const pairRoom = (codeOrSecret) => `pair:${codeOrSecret}`;
export const pairUrl = (code, local) =>
  `${window.location.origin}${BASE}/remote${local ? "?local=1" : ""}#p=${code}`;

// ---- Desktop → phone: the second screen -----------------------------------------
// Everything is "ms ago / ms left" rather than clock times, so the two machines'
// wall clocks never have to agree. `at` is the room clock when it was sent; the phone
// takes off however long it took to arrive.
export function snapshot({ board, sessions, boards, tally, fortune, now }) {
  const t = Date.now();
  return {
    at: now,
    vis: !document.hidden,
    board: board && { id: board.id, title: board.title, look: board.role === "view" },
    tally,
    fortune,
    sessions: sessions.map((s) => {
      const out = { id: s.id, kind: s.kind, icon: s.icon, label: s.label, elapsed: t - s.startedAt };
      if (s.endsAt) out.left = s.endsAt - t;
      if (s.kind === "metronome") {
        const mod = boards?.find((b) => b.id === s.boardId)?.modules.find((m) => m.id === s.modId);
        const m = metroState(mod?.state);
        const period = 60000 / m.bpm;
        // The engine knows exactly which beat it booked last; without sound (nothing tapped
        // yet) we guess from when it was started
        const a = getAudio();
        const b = a && beatAt(s.modId, a.currentTime);
        out.metro = {
          bpm: m.bpm,
          beats: m.beats,
          pos: b ? b.pos : 0,
          since: b ? (a.currentTime - b.time) * 1000 : (t - s.startedAt) % period,
        };
      }
      return out;
    }),
  };
}

// ---- Phone → desktop: a photo ---------------------------------------------------
// Shrink it on the phone first: a 12-megapixel photo is a slow thing to send
export async function shrinkPhoto(file, max = 1600) {
  try {
    const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
    const s = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const c = document.createElement("canvas");
    c.width = Math.round(bmp.width * s);
    c.height = Math.round(bmp.height * s);
    c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
    const blob = await new Promise((res) => c.toBlob(res, "image/jpeg", 0.82));
    return blob ? new File([blob], "phone.jpg", { type: "image/jpeg" }) : file;
  } catch {
    return file; // can't decode here (an odd format): the desktop will try
  }
}

// ---- Desktop: drop a picture where the pointer is -------------------------------
// The board already knows how to take a pasted picture (Scrapbook, Clipping and friends watch
// for it under the pointer; bare space opens the "what's this?" sheet), so we paste for it.
// If nobody took it (pointer off the page, typing somewhere), BoardView gets it to ask.
export function dropPicture(file) {
  const dt = new DataTransfer();
  dt.items.add(file);
  const paste = new ClipboardEvent("paste", { clipboardData: dt, bubbles: true, cancelable: true });
  document.dispatchEvent(paste);
  if (!paste.defaultPrevented) window.dispatchEvent(new CustomEvent(PHOTO_EVENT, { detail: { images: [file] } }));
}

// ---- Home & table: what a phone can do with the dice, the wheel and the grocery list ----
// `here` is the modules on the open tab. The phone gets just enough to draw a button or a list.
export function homeSnap(here) {
  const dice = here.find((m) => m.type === "dice");
  const wheel = here.find((m) => m.type === "chores");
  const shop = here.find((m) => m.type === "groceries");
  if (!dice && !wheel && !shop) return null;
  return {
    dice: dice ? dice.id : null,
    chores: wheel ? wheel.id : null,
    groceries: shop && {
      id: shop.id,
      title: shop.title,
      items: (shop.state.items ?? []).filter((i) => !i.done).slice(0, 80).map((i) => ({ id: i.id, text: i.text, qty: i.qty ?? 1, aisle: i.aisle })),
    },
  };
}
