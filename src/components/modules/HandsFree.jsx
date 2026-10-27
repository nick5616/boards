import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { caps } from "../../lib/caps";
import { clockLeft, clockMins } from "../../lib/recipe";

// "500 g" reads better as "500 grams" out loud
const SPOKEN = { g: "grams", kg: "kilograms", oz: "ounces", lb: "pounds", ml: "millilitres", l: "litres", tbsp: "tablespoons", tsp: "teaspoons" };
const speakable = (s) => s.replace(/\b(g|kg|oz|lb|ml|l|tbsp|tsp)\b/g, (u) => SPOKEN[u]).replace(/~/g, "about ");

// What a heard phrase means, if anything
function commandOf(said) {
  const t = said.toLowerCase();
  if (/\b(start|set|begin)\b.*\b(timer|clock)\b|^timer\b/.test(t)) return "timer";
  if (/\b(back|previous|go back|before)\b/.test(t)) return "back";
  if (/\b(repeat|again|say that|one more time)\b/.test(t)) return "repeat";
  if (/\b(next|forward|continue|keep going)\b/.test(t)) return "next";
  return null;
}

// The recipe, big. Page 0 is the shopping list, then one step per page. The screen stays on,
// the step is read aloud, and (if you let it) it listens for "next", "back", "repeat" and
// "start timer" while this is open. Without a mic or a voice, the big buttons do it all.
export default function HandsFree({ title, ingredients, steps, timerFor, startTimer, onClose }) {
  const [page, setPage] = useState(0); // 0 = ingredients, n = step n
  const [read, setRead] = useState(caps.speech); // reading aloud
  const [listen, setListen] = useState(caps.listen); // voice commands
  const [heard, setHeard] = useState("");
  const [problem, setProblem] = useState(null);
  const last = steps.length;
  const speaking = useRef(false);

  const go = (n) => setPage(Math.max(0, Math.min(last, n)));
  const [again, setAgain] = useState(0); // bumps to read the page once more

  // What this page says
  const step = page > 0 ? steps[page - 1] : null;
  const spoken = step
    ? step.text
    : `You'll need: ${ingredients.map((i) => `${speakable(i.shown)} ${i.name}`).join(", ")}.`;

  // Screen stays on while this is open
  useEffect(() => {
    if (!("wakeLock" in navigator)) return;
    let lock = null;
    let gone = false;
    const grab = () => {
      if (document.visibilityState !== "visible" || lock) return;
      navigator.wakeLock.request("screen").then(
        (l) => {
          if (gone) return l.release().catch(() => {});
          lock = l;
          l.addEventListener("release", () => { if (lock === l) lock = null; });
        },
        () => {}
      );
    };
    grab();
    document.addEventListener("visibilitychange", grab);
    return () => {
      gone = true;
      document.removeEventListener("visibilitychange", grab);
      lock?.release().catch(() => {});
    };
  }, []);

  // Reading aloud: the listener is deaf while the voice talks, so it doesn't obey itself
  useEffect(() => {
    if (!read || !caps.speech) return;
    const synth = window.speechSynthesis;
    synth.cancel();
    const u = new SpeechSynthesisUtterance(spoken);
    u.rate = 0.95;
    const done = () => setTimeout(() => (speaking.current = false), 400);
    u.onstart = () => (speaking.current = true);
    u.onend = done;
    u.onerror = done;
    speaking.current = true;
    synth.speak(u);
    return () => {
      synth.cancel();
      speaking.current = false;
    };
  }, [read, spoken, again]);

  // What each spoken command does, always the latest version of it
  const act = (c) => {
    if (c === "next") go(page + 1);
    else if (c === "back") go(page - 1);
    else if (c === "repeat") setAgain((n) => n + 1);
    else if (c === "timer" && step?.mins) startTimer(page - 1);
  };
  const actRef = useRef(act);
  actRef.current = act;

  // Listening: only while this screen is open and the mic switch is on
  useEffect(() => {
    if (!listen || !caps.listen) return;
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const rec = new SR();
    rec.continuous = true;
    rec.interimResults = false;
    rec.lang = "en-US";
    let stopped = false;
    rec.onresult = (e) => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (!e.results[i].isFinal) continue;
        const said = e.results[i][0].transcript.trim();
        if (speaking.current) continue;
        const c = commandOf(said);
        setHeard(c ? `“${said}”` : `“${said}” (not a command)`);
        if (c) actRef.current(c);
      }
    };
    rec.onerror = (e) => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        stopped = true;
        setProblem("The microphone is turned off for this page. Allow it in the address bar to talk to the recipe.");
        setListen(false);
      } else if (e.error === "network") {
        stopped = true;
        setProblem("Couldn't reach Chrome's speech service, so voice commands are off. The big buttons still work.");
        setListen(false);
      }
    };
    rec.onend = () => {
      if (!stopped) {
        try { rec.start(); } catch { /* already running */ }
      }
    };
    try { rec.start(); } catch { setListen(false); }
    return () => {
      stopped = true;
      rec.abort();
    };
  }, [listen]);

  // Keys for when the hands aren't that messy
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight" || e.key === " ") (e.preventDefault(), go(page + 1));
      else if (e.key === "ArrowLeft") go(page - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const left = step?.mins ? timerFor(page - 1) : null;

  return createPortal(
    <div className="hf" role="dialog" aria-modal="true" aria-label={`${title} hands-free`}>
      <div className="hf-top">
        <b>{title}</b>
        <span>{page === 0 ? "ingredients" : `step ${page} of ${last}`}</span>
        <div className="hf-switches">
          {caps.speech && (
            <button className={`hf-sw${read ? " on" : ""}`} onClick={() => setRead((v) => !v)} aria-pressed={read}>🔊 read aloud</button>
          )}
          {caps.listen && (
            <button className={`hf-sw${listen ? " on" : ""}`} onClick={() => (setProblem(null), setListen((v) => !v))} aria-pressed={listen}>
              {listen && <i className="hf-mic" aria-hidden="true" />} 🎤 {listen ? "listening" : "voice off"}
            </button>
          )}
          <button className="hf-x" onClick={onClose} aria-label="Close hands-free">✕</button>
        </div>
      </div>

      <div className="hf-body">
        {page === 0 ? (
          <ul className="hf-ings">
            {ingredients.map((i) => (
              <li key={i.id}><b>{i.shown}</b> {i.name}</li>
            ))}
          </ul>
        ) : (
          <p className="hf-step">{step.text}</p>
        )}
        {step?.mins ? (
          <button className={`hf-timer${left != null ? " going" : ""}${left != null && left <= 0 ? " ring" : ""}`} onClick={() => left == null && startTimer(page - 1)}>
            ⏱ {left == null ? `start the ${clockMins(step.mins)} timer` : left <= 0 ? "ding! time's up" : clockLeft(left)}
          </button>
        ) : null}
      </div>

      <div className="hf-foot">
        {listen && (
          <p className="hf-hint">
            Say <b>next</b> · <b>back</b> · <b>repeat</b>{step?.mins ? <> · <b>start timer</b></> : null}
            {heard && <span> — heard {heard}</span>}
          </p>
        )}
        {problem && <p className="hf-problem">{problem}</p>}
        <div className="hf-nav">
          <button onClick={() => go(page - 1)} disabled={page === 0}>◀ back</button>
          <button className="mid" onClick={() => setAgain((n) => n + 1)} aria-label="Read this again">↻</button>
          <button className="go" onClick={() => (page === last ? onClose() : go(page + 1))}>{page === last ? "all done ✓" : page === 0 ? "start ▶" : "next ▶"}</button>
        </div>
        {listen && <small className="hf-priv">Voice commands use Chrome's speech service, which sends what it hears to Google while the mic is on. It's only on while this screen is open.</small>}
      </div>
    </div>,
    document.body
  );
}
