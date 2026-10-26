import { useState, useEffect, useRef, useCallback } from "react";
import { useData } from "../../contexts/DataContext";
import { useLive } from "../../contexts/LiveContext";
import { room, onFile, clock } from "../../lib/peers";
import { dayKey } from "../../utils/date";
import {
  PAIR_EVENT, CRACK_EVENT, CODE_MS, isLocal, transportFor, deskPairing, saveDesk, forgetPhones,
  newCode, pairRoom, pairUrl, snapshot, dropPicture,
} from "../../lib/remote";
import { modulesIn, pickTab } from "../board/spaces";

// The computer's half of the phone remote. It sits in the app all the time but does nothing
// until a phone has been paired; then it keeps a room open for it, tells it what's on the
// open board (the second screen), and does what the phone asks (clicker, camera, shaker).

const BEAT_MS = 1500; // how often the phone gets a fresh look at things

export default function RemoteHost({ boards, openId }) {
  const data = useData();
  const live = useLive();
  const [paired, setPaired] = useState(() => deskPairing().paired);
  const [dialog, setDialog] = useState(false);
  const [phones, setPhones] = useState(0);
  const hostRoom = useRef(null);
  const push = useRef(null); // send every phone a fresh look now
  const ctx = useRef({});
  ctx.current = { boards, openId, data, live };

  useEffect(() => {
    const open = () => setDialog(true);
    window.addEventListener(PAIR_EVENT, open);
    return () => window.removeEventListener(PAIR_EVENT, open);
  }, []);

  // Paired: keep the phones' room open for as long as the app is
  useEffect(() => {
    if (!paired) return;
    const r = room(pairRoom(deskPairing().secret), { transport: transportFor(isLocal()) });
    const clk = clock(r);
    hostRoom.current = r;

    // The open board, and what a phone could do with it
    const look = () => {
      const { boards, openId } = ctx.current;
      const board = boards?.find((b) => b.id === openId) ?? null;
      const here = board ? modulesIn(board, { parent: null, tab: pickTab(board.tabs ?? [], board.tab) }) : [];
      return { board, here };
    };
    const tallyOf = (m) => {
      const n = m.state.counts?.[dayKey()] ?? 0;
      return { id: m.id, title: m.title, unit: m.state.unit || "", n };
    };
    const send = (to) => {
      const { board, here } = look();
      const tally = here.find((m) => m.type === "tally");
      const fortune = here.some((m) => m.type === "fortune" && (m.state.items?.length ?? 0) > 1);
      r.send(
        "rmt:state",
        snapshot({
          board, boards: ctx.current.boards, sessions: ctx.current.live?.sessions ?? [],
          tally: tally ? tallyOf(tally) : null, fortune, now: clk.now(),
        }),
        to
      );
    };

    const ack = (to, id, ok, text) => r.send("rmt:ack", { id, ok, text }, to);

    const offCmd = r.on("rmt:cmd", (m, from) => {
      const { data, boards } = ctx.current;
      const { board, here } = look();
      if (!board) return ack(from, m.id, false, "open a board on the computer first");
      if (board.role === "view") return ack(from, m.id, false, "that board is look-only");
      if (m.k === "log") {
        data.quickLog(board.id);
        return ack(from, m.id, true, "sticker stuck ✓");
      }
      if (m.k === "tally") {
        const t = here.find((x) => x.type === "tally");
        if (!t) return ack(from, m.id, false, "no tally on that board");
        const day = dayKey();
        data.updateBoard(board.id, (b) => ({
          ...b,
          modules: b.modules.map((x) =>
            x.id === t.id ? { ...x, state: { ...x.state, counts: { ...x.state.counts, [day]: (x.state.counts?.[day] ?? 0) + 1 } } } : x
          ),
        }));
        const n = (boards.find((b) => b.id === board.id)?.modules.find((x) => x.id === t.id)?.state.counts?.[day] ?? 0) + 1;
        return ack(from, m.id, true, `${n} ${t.state.unit || "today"}`);
      }
      if (m.k === "crack") {
        const f = here.find((x) => x.type === "fortune");
        if (!f) return ack(from, m.id, false, "no fortune cookies here");
        window.dispatchEvent(new CustomEvent(CRACK_EVENT, { detail: { modId: f.id } }));
        return ack(from, m.id, true, "🥠 cracked");
      }
    });

    const offFile = onFile(r, (blob, { from, meta, id }) => {
      if (meta?.k !== "photo") return;
      const { board } = look();
      if (!board) return ack(from, id, false, "got it, but no board is open to put it on");
      dropPicture(new File([blob], "phone.jpg", { type: blob.type || "image/jpeg" }));
      ctx.current.data.toast({ text: "📱 a picture from your phone" });
      ack(from, id, true, "landed ✓");
    });

    const offPeer = r.onPeer((id, joined) => {
      setPhones(r.peers.size);
      if (joined) send(id);
    });
    const beat = setInterval(() => r.peers.size && send(), BEAT_MS);
    push.current = () => r.peers.size && send();

    return () => {
      push.current = null;
      clearInterval(beat);
      offCmd();
      offFile();
      offPeer();
      clk.stop();
      r.leave();
      hostRoom.current = null;
      setPhones(0);
    };
  }, [paired]);

  // A new look right away when the board or the running things change
  const sessionKey = (live?.sessions ?? []).map((s) => s.id + s.label).join("|");
  useEffect(() => {
    push.current?.();
  }, [openId, sessionKey]);

  const forget = useCallback(() => {
    hostRoom.current?.send("rmt:bye", { k: "forget" });
    // Let the goodbye out before the room closes
    setTimeout(() => {
      forgetPhones();
      setPaired(false);
    }, 300);
  }, []);

  if (!dialog) return null;
  return (
    <PairDialog
      paired={paired}
      phones={phones}
      onPaired={() => {
        saveDesk({ paired: true });
        setPaired(true);
      }}
      onForget={forget}
      onClose={() => setDialog(false)}
    />
  );
}

// ---- The pairing dialog ----------------------------------------------------------

function PairDialog({ paired, phones, onPaired, onForget, onClose }) {
  const [gen, setGen] = useState(0); // bumps for a fresh code
  const [code, setCode] = useState(newCode);
  const [left, setLeft] = useState(CODE_MS);
  const [done, setDone] = useState(false);
  const [qr, setQr] = useState(null);
  const local = isLocal();
  const url = pairUrl(code, local);
  const claimed = useRef(false);

  // The code's room, open for 2 minutes. Only the first phone to say hi gets the secret.
  useEffect(() => {
    if (done) return;
    claimed.current = false;
    const r = room(pairRoom(code), { transport: transportFor(local) });
    const t0 = Date.now();
    const off = r.on("rmt:pair", (m, from) => {
      if (m.k !== "hi" || claimed.current || Date.now() - t0 > CODE_MS) return;
      claimed.current = true;
      r.send("rmt:pair", { k: "secret", secret: deskPairing().secret }, from);
      onPaired();
      setDone(true);
      // Give the secret time to arrive, then close the room and the dialog
      setTimeout(onClose, 1800);
    });
    const tick = setInterval(() => {
      const ms = CODE_MS - (Date.now() - t0);
      setLeft(Math.max(0, ms));
      if (ms <= 0) clearInterval(tick);
    }, 500);
    return () => {
      clearInterval(tick);
      off();
      // Leave a beat later so a secret still on its way isn't cut off
      setTimeout(() => r.leave(), 1500);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, gen]);

  // The QR is drawn as one SVG path: a square per dark module
  useEffect(() => {
    let live = true;
    import("qrcode-generator").then(({ default: qrcode }) => {
      const q = qrcode(0, "M");
      q.addData(url);
      q.make();
      const n = q.getModuleCount();
      let d = "";
      for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (q.isDark(y, x)) d += `M${x} ${y}h1v1h-1z`;
      live && setQr({ n, d });
    });
    return () => {
      live = false;
    };
  }, [url]);

  useEffect(() => {
    const esc = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onClose]);

  const expired = left <= 0 && !done;
  const mm = Math.floor(left / 60000);
  const ss = String(Math.floor((left % 60000) / 1000)).padStart(2, "0");

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="rmt-pair" role="dialog" aria-modal="true" aria-label="Pair a phone">
        <h2>📱 pair a phone</h2>
        {done ? (
          <p className="rmt-pair-done">paired! your phone is now a remote ✓</p>
        ) : (
          <>
            <p>
              Point your phone's camera at this, or open <b>{url.replace(/^https?:\/\//, "").replace(/#.*/, "")}</b> and type the code.
            </p>
            <div className={`rmt-qr${expired ? " old" : ""}`}>
              {qr && (
                <svg viewBox={`-2 -2 ${qr.n + 4} ${qr.n + 4}`} role="img" aria-label="QR code to pair a phone" shapeRendering="crispEdges">
                  <rect x="-2" y="-2" width={qr.n + 4} height={qr.n + 4} fill="#fff" />
                  <path d={qr.d} fill="#2a2520" />
                </svg>
              )}
            </div>
            <div className="rmt-code" aria-label={`code ${code}`}>
              {code.slice(0, 3)} {code.slice(3)}
            </div>
            {expired ? (
              <button className="mini-btn" onClick={() => { setCode(newCode()); setLeft(CODE_MS); setGen((g) => g + 1); }}>
                that one ran out — new code
              </button>
            ) : (
              <small className="rmt-pair-left">good for {mm}:{ss}</small>
            )}
            <small className="rmt-pair-url">{url}</small>
          </>
        )}
        {paired && !done && (
          <div className="rmt-pair-foot">
            <span>{phones ? `${phones} phone${phones === 1 ? "" : "s"} connected now` : "a phone is paired, not connected right now"}</span>
            <button className="mini-btn ghost" onClick={onForget}>forget my phones</button>
          </div>
        )}
        <button className="mini-btn" onClick={onClose}>{done ? "close" : "never mind"}</button>
      </div>
    </div>
  );
}
