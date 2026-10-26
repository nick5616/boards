import { useState, useEffect, useRef, useCallback } from "react";
import { room, sendFile, clock } from "../../lib/peers";
import { uid as newId } from "../../utils/uid";
import {
  CODE_MS, isLocal, transportFor, phonePairing, savePhone, pairRoom, shrinkPhoto,
} from "../../lib/remote";

// The phone's half of the remote (/remote). No board chrome: a chunky controller with a
// camera, a clicker, the desktop's timer and metronome as a second screen, and a shaker.
// It can pair with a code from the desktop (#p=123456 in the link, or typed in), and after
// that it just reconnects by itself to the secret room the desktop gave it.

const STALE = 6000; // a computer that hasn't spoken for this long has gone quiet
const mmss = (ms) => {
  const s = Math.floor(Math.abs(ms) / 1000);
  return `${ms < 0 ? "+" : ""}${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

// Re-renders every frame, for things that move (a beat flash, a ticking clock)
function useFrame() {
  const [, set] = useState(0);
  useEffect(() => {
    let id;
    const loop = () => {
      set((n) => (n + 1) % 1e6);
      id = requestAnimationFrame(loop);
    };
    id = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(id);
  }, []);
}

export default function RemotePage() {
  const [local] = useState(() => isLocal() || !!phonePairing()?.local);
  const [link, setLink] = useState(() => {
    const code = window.location.hash.match(/p=(\d{6})/)?.[1];
    if (code) return { code };
    const saved = phonePairing();
    return saved ? { secret: saved.secret } : null;
  });
  const [problem, setProblem] = useState("");
  const [typed, setTyped] = useState("");

  const forget = useCallback(() => {
    savePhone(null);
    setLink(null);
  }, []);

  // ---- Pairing: say hi in the code's room, wait for the secret ----
  useEffect(() => {
    if (!link?.code) return;
    setProblem("");
    const r = room(pairRoom(link.code), { transport: transportFor(local) });
    let done = false;
    const hi = () => !done && r.peers.size && r.send("rmt:pair", { k: "hi", name: navigator.platform || "phone" });
    const off = r.on("rmt:pair", (m) => {
      if (m.k !== "secret" || !m.secret || done) return;
      done = true;
      savePhone({ secret: m.secret, local });
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
      setLink({ secret: m.secret });
    });
    const offPeer = r.onPeer((_, joined) => joined && hi());
    const again = setInterval(hi, 2000);
    const giveUp = setTimeout(() => {
      done = true;
      setProblem("that code ran out, or the computer can't be found. Ask for a new one.");
      setLink(null);
    }, CODE_MS + 10000);
    return () => {
      done = true;
      clearInterval(again);
      clearTimeout(giveUp);
      off();
      offPeer();
      r.leave();
    };
  }, [link?.code, local]);

  if (link?.secret) return <Remote secret={link.secret} local={local} onForget={forget} />;

  return (
    <div className="rmt">
      <div className="rmt-top">
        <span className={`rmt-led${link?.code ? " wait" : ""}`} />
        <b>boards remote</b>
      </div>
      <div className="rmt-card rmt-hello">
        {link?.code ? (
          <>
            <div className="rmt-ico">📡</div>
            <p>pairing… looking for your computer</p>
          </>
        ) : (
          <>
            <div className="rmt-ico">📱</div>
            <p>On your computer, press <kbd>Ctrl K</kbd> and pick <b>Pair a phone</b>. Scan the code, or type it here.</p>
            <input
              className="rmt-in"
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="000 000"
              value={typed}
              maxLength={7}
              onChange={(e) => setTyped(e.target.value.replace(/\D/g, "").replace(/(\d{3})(\d)/, "$1 $2"))}
              aria-label="Pairing code"
            />
            <button className="rmt-big go" disabled={typed.replace(/\D/g, "").length !== 6} onClick={() => setLink({ code: typed.replace(/\D/g, "") })}>
              pair
            </button>
            {problem && <p className="rmt-problem">{problem}</p>}
          </>
        )}
      </div>
    </div>
  );
}

// ---- Paired: the controller itself ------------------------------------------------

function Remote({ secret, local, onForget }) {
  const [ctl, setCtl] = useState(null); // { r, clk }
  const desks = useRef(new Map()); // peer id → { m, recv, at }
  const [, bump] = useState(0);
  const [note, setNote] = useState(null); // { text, ok } what just happened
  const noteTimer = useRef();

  const say = useCallback((text, ok = true) => {
    setNote({ text, ok });
    clearTimeout(noteTimer.current);
    noteTimer.current = setTimeout(() => setNote(null), 4000);
  }, []);

  useEffect(() => {
    const r = room(pairRoom(secret), { transport: transportFor(local) });
    const clk = clock(r);
    setCtl({ r, clk });
    const offState = r.on("rmt:state", (m, from) => {
      // How old is this? Only trust the clocks once they've agreed with each other
      const age = clk.ready ? Math.min(2000, Math.max(0, clk.now() - m.at)) : 0;
      desks.current.set(from, { m, recv: performance.now() - age, at: performance.now() });
      bump((n) => n + 1);
    });
    const offAck = r.on("rmt:ack", (m) => say(m.text, m.ok));
    const offBye = r.on("rmt:bye", (m) => m.k === "forget" && onForget());
    const offPeer = r.onPeer((id, joined) => {
      if (!joined) desks.current.delete(id);
      bump((n) => n + 1);
    });
    // Notice a computer going quiet
    const sweep = setInterval(() => bump((n) => n + 1), 2000);
    return () => {
      clearInterval(sweep);
      offState();
      offAck();
      offBye();
      offPeer();
      clk.stop();
      r.leave();
    };
  }, [secret, local, onForget, say]);

  // The computer to talk to: one whose screen is up, and heard from lately
  const fresh = [...desks.current].filter(([id, d]) => ctl?.r.peers.has(id) && performance.now() - d.at < STALE);
  const [deskId, desk] = fresh.sort((a, b) => (b[1].m.vis ? 1 : 0) - (a[1].m.vis ? 1 : 0) || b[1].at - a[1].at)[0] ?? [];
  const snap = desk?.m;
  const on = !!snap;

  // Keep the phone awake while it's a remote
  useEffect(() => {
    let lock = null;
    const grab = () => navigator.wakeLock?.request("screen").then((l) => (lock = l), () => {});
    grab();
    document.addEventListener("visibilitychange", grab);
    return () => {
      document.removeEventListener("visibilitychange", grab);
      lock?.release().catch(() => {});
    };
  }, []);

  const press = (k) => {
    if (!deskId) return say("can't find your computer", false);
    navigator.vibrate?.(25);
    ctl.r.send("rmt:cmd", { k, id: newId() }, deskId);
  };

  // ---- camera ----
  const [sending, setSending] = useState(null); // 0..1 while a photo goes over
  const snap_ = async (e) => {
    const files = [...(e.target.files ?? [])];
    e.target.value = "";
    if (!files.length) return;
    if (!deskId) return say("can't find your computer", false);
    for (const f of files) {
      try {
        setSending(0);
        const small = await shrinkPhoto(f);
        await sendFile(ctl.r, small, { to: deskId, meta: { k: "photo" }, id: newId(), onProgress: setSending });
        navigator.vibrate?.(25);
        say("sent ✓ look at your computer");
      } catch (err) {
        say(err.message === "nobody to send to" ? "can't find your computer" : "couldn't send that one", false);
      }
    }
    setSending(null);
  };

  return (
    <div className="rmt">
      <div className="rmt-top">
        <span className={`rmt-led${on ? " on" : " wait"}`} />
        <b>{on ? snap.board?.title ?? "no board open" : "looking for your computer…"}</b>
        <button className="rmt-forget" onClick={() => confirm("Unpair this phone from your computer?") && onForget()}>unpair</button>
      </div>

      {!on && (
        <div className="rmt-card rmt-hello">
          <div className="rmt-ico">📡</div>
          <p>Open boards on your computer and keep the tab open. I'll find it.</p>
        </div>
      )}

      {on && (
        <>
          <label className={`rmt-big cam${sending != null ? " busy" : ""}`}>
            <input type="file" accept="image/*" capture="environment" className="rmt-file" onChange={snap_} />
            <span className="rmt-ico">📷</span>
            {sending != null ? `sending… ${Math.round(sending * 100)}%` : "snap it onto the board"}
            <small>it lands where your cursor is</small>
          </label>

          <div className="rmt-pair2">
            <button className="rmt-big log" onClick={() => press("log")} disabled={!snap.board}>
              <span className="rmt-ico">🎯</span>I practiced
            </button>
            {snap.tally && (
              <button className="rmt-big tally" onClick={() => press("tally")}>
                <span className="rmt-ico">+1</span>
                {snap.tally.unit || snap.tally.title}
                <small>{snap.tally.n} today</small>
              </button>
            )}
          </div>

          <Screen snap={snap} recv={desk.recv} />

          {snap.fortune && <Shaker onShake={() => press("crack")} />}
        </>
      )}

      <div className={`rmt-note${note ? (note.ok ? " ok" : " bad") : ""}`} role="status">{note?.text}</div>
    </div>
  );
}

// ---- Second screen: what the desktop's dock is running --------------------------------

function Screen({ snap, recv }) {
  useFrame();
  if (!snap.sessions.length) {
    return (
      <div className="rmt-card rmt-quiet">
        <b>second screen</b>
        <p>nothing running. Start a timer or a metronome on your computer and it shows up here.</p>
      </div>
    );
  }
  const dt = performance.now() - recv; // how long since the numbers were true
  return (
    <div className="rmt-screens">
      {snap.sessions.map((s) =>
        s.metro ? <Beat key={s.id} s={s} dt={dt} /> : <Clock key={s.id} s={s} dt={dt} />
      )}
    </div>
  );
}

function Clock({ s, dt }) {
  const over = s.left != null && s.left - dt < 0;
  return (
    <div className={`rmt-card rmt-clock${over ? " over" : ""}`}>
      <span className="rmt-ico">{s.icon}</span>
      <div className="rmt-time">{mmss(s.left != null ? s.left - dt : s.elapsed + dt)}</div>
      <small>{s.label}</small>
    </div>
  );
}

function Beat({ s, dt }) {
  const { bpm, beats, pos, since } = s.metro;
  const period = 60000 / bpm;
  const t = since + dt;
  const at = (pos + Math.floor(t / period)) % beats;
  const glow = Math.max(0, 1 - ((t % period) / period) * 3); // a quick flash at the start of each beat
  return (
    <div className="rmt-card rmt-beat">
      <div
        className={`rmt-flash${at === 0 ? " one" : ""}`}
        style={{ opacity: 0.12 + glow * 0.88, transform: `scale(${0.9 + glow * 0.1})` }}
        aria-hidden="true"
      >
        {at + 1}
      </div>
      <div className="rmt-time">{bpm}<small> bpm</small></div>
      <div className="rmt-dots" aria-hidden="true">
        {Array.from({ length: beats }, (_, i) => <i key={i} className={i === at ? "now" : ""} />)}
      </div>
    </div>
  );
}

// ---- Shaker: shake the phone to crack another fortune ---------------------------------

function Shaker({ onShake }) {
  const [state, setState] = useState(() =>
    typeof DeviceMotionEvent === "undefined" ? "none" : DeviceMotionEvent.requestPermission ? "ask" : "on"
  );
  const latest = useRef(onShake);
  latest.current = onShake;

  useEffect(() => {
    if (state !== "on") return;
    let last = null;
    let quiet = 0;
    const on = (e) => {
      const a = e.accelerationIncludingGravity;
      if (!a || a.x == null) return;
      // How much it jerked since the last reading
      const jerk = last ? Math.abs(a.x - last.x) + Math.abs(a.y - last.y) + Math.abs(a.z - last.z) : 0;
      last = { x: a.x, y: a.y, z: a.z };
      if (jerk > 40 && Date.now() > quiet) {
        quiet = Date.now() + 1500;
        latest.current();
      }
    };
    window.addEventListener("devicemotion", on);
    return () => window.removeEventListener("devicemotion", on);
  }, [state]);

  // iPhones only allow motion after a tap
  const allow = async () => {
    try {
      setState((await DeviceMotionEvent.requestPermission()) === "granted" ? "on" : "no");
    } catch {
      setState("no");
    }
  };

  return (
    <div className="rmt-pair2">
      <button className="rmt-big fortune" onClick={onShake}>
        <span className="rmt-ico">🥠</span>crack another
        <small>
          {state === "on" ? "or shake me" : state === "ask" ? "allow shaking first →" : state === "no" ? "shaking is switched off" : "no shaking on this phone"}
        </small>
      </button>
      {state === "ask" && (
        <button className="rmt-big shake" onClick={allow}>
          <span className="rmt-ico">📳</span>allow shaking
        </button>
      )}
    </div>
  );
}
