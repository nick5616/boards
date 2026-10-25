import { useState, useEffect, useRef } from "react";
import { useLive } from "../../contexts/LiveContext";
import { useData } from "../../contexts/DataContext";
import { getAudio, mtof, drone } from "../../lib/audio";
import { freqToNote, midiToName, nameToMidi } from "../../lib/notes";

// What each preset hangs on its pegs (low to high). Chromatic and voice just
// get a handful of friendly reference notes to drone on.
const C_MAJOR = ["C4", "D4", "E4", "F4", "G4", "A4", "B4"];
export const PRESETS = {
  chromatic: { label: "any note", pegs: C_MAJOR },
  guitar: { label: "guitar", pegs: ["E2", "A2", "D3", "G3", "B3", "E4"] },
  violin: { label: "violin", pegs: ["G3", "D4", "A4", "E5"] },
  ukulele: { label: "ukulele", pegs: ["G4", "C4", "E4", "A4"] },
  voice: { label: "voice", pegs: C_MAJOR },
};

const SIGNAL = 0.01; // quieter than this is the room, not a note
const WINDOW = 2048;
const IN_TUNE = 5; // cents

// YIN-lite: find the lag where the wave best matches itself, then nudge it between samples.
// Returns Hz, or null when nothing clear is ringing.
function pitchOf(buf, sr) {
  let sum = 0;
  for (let i = 0; i < WINDOW; i++) sum += buf[i] * buf[i];
  if (Math.sqrt(sum / WINDOW) < SIGNAL) return null;

  const minTau = Math.floor(sr / 1100);
  const maxTau = Math.min(Math.floor(sr / 60), buf.length - WINDOW - 1);
  const d = new Float32Array(maxTau + 1);
  for (let tau = 1; tau <= maxTau; tau++) {
    let s = 0;
    for (let j = 0; j < WINDOW; j++) {
      const x = buf[j] - buf[j + tau];
      s += x * x;
    }
    d[tau] = s;
  }
  // Cumulative mean normalise, so a loud wave doesn't beat a clear one
  let run = 0;
  for (let tau = 1; tau <= maxTau; tau++) {
    run += d[tau];
    d[tau] = run ? (d[tau] * tau) / run : 1;
  }
  let tau = -1;
  for (let t = minTau; t < maxTau; t++) {
    if (d[t] < 0.15) {
      while (t + 1 < maxTau && d[t + 1] < d[t]) t++;
      tau = t;
      break;
    }
  }
  if (tau < 0) return null;
  const a = d[tau - 1], b = d[tau], c = d[tau + 1];
  const denom = a - 2 * b + c;
  const shift = denom ? (a - c) / (2 * denom) : 0;
  return sr / (tau + shift);
}

// A needle gauge. Listen, play a note, and the needle says sharp or flat; the pegs
// for the chosen instrument light up as each string gets in tune. Or hold a drone to tune against.
export default function Tuner({ board, mod, setState, expanded }) {
  const live = useLive();
  const data = useData();
  const { preset = "chromatic", drone: target = null } = mod.state;
  const set = PRESETS[preset] ?? PRESETS.chromatic;
  const pegs = set.pegs.map((n) => ({ name: n, midi: nameToMidi(n) }));
  const aim = target ?? pegs[0].midi;

  const [listening, setListening] = useState(false);
  const [reading, setReading] = useState(null); // { name, octave, cents, freq, midi }
  const [err, setErr] = useState(null);
  const [tuned, setTuned] = useState([]); // midis that have hit the green zone this time
  const [droning, setDroning] = useState(false);

  // The mic and its loop live in refs: nothing here should re-render the card
  const run = useRef(null); // { stream, src, raf, startedAt, sid }
  const stopDrone = useRef(null);
  const liveRef = useRef(live);
  liveRef.current = live;
  const dataRef = useRef(data);
  dataRef.current = data;

  // Let go of the mic, and put the session on the chart if it was worth a minute
  const halt = () => {
    const r = run.current;
    if (!r) return;
    run.current = null;
    cancelAnimationFrame(r.raf);
    r.src.disconnect();
    r.stream.getTracks().forEach((t) => t.stop());
    setListening(false);
    setReading(null);
    liveRef.current?.stop(r.sid); // its onStop lands back here and finds nothing to do
    const mins = Math.round((Date.now() - r.startedAt) / 60000);
    if (mins >= 1) {
      const { logPractice, undoLog, toast } = dataRef.current;
      const entry = logPractice(board.id, `🎻 tuned up ${mins} min`, { mins });
      toast({ text: `tuned up ${mins} min, on the chart ✓`, actions: [{ label: "undo", run: () => undoLog(entry) }] });
    }
  };

  const listen = async () => {
    if (run.current) return;
    const ctx = getAudio();
    if (!ctx) return setErr("sound");
    setErr(null);
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      });
    } catch (e) {
      return setErr(e?.name === "NotFoundError" ? "none" : "denied");
    }
    if (run.current) return stream.getTracks().forEach((t) => t.stop()); // double tap
    const an = ctx.createAnalyser();
    an.fftSize = 4096;
    const src = ctx.createMediaStreamSource(stream);
    src.connect(an); // listens only, never to the speakers
    const buf = new Float32Array(an.fftSize);
    const sid = liveRef.current.start({
      kind: "tuner",
      boardId: board.id,
      modId: mod.id,
      label: "tuning",
      icon: "🎻",
      onStop: halt,
    });
    const r = (run.current = { stream, src, raf: 0, startedAt: Date.now(), sid });
    setListening(true);

    let smooth = null; // { midi, cents }
    let heard = 0; // when we last had a clear note
    let steady = 0; // how long it's been in the green zone
    let last = 0;
    const loop = (t) => {
      r.raf = requestAnimationFrame(loop);
      if (t - last < 50) return;
      last = t;
      an.getFloatTimeDomainData(buf);
      const hz = pitchOf(buf, ctx.sampleRate);
      if (hz) {
        const n = freqToNote(hz);
        const exact = n.cents;
        // Same note: ease toward the new reading. New note: jump.
        smooth = smooth && smooth.midi === n.midi ? { midi: n.midi, cents: smooth.cents * 0.6 + exact * 0.4 } : { midi: n.midi, cents: exact };
        heard = t;
        steady = Math.abs(smooth.cents) <= IN_TUNE ? steady + 1 : 0;
        if (steady === 6) setTuned((xs) => (xs.includes(n.midi) ? xs : [...xs, n.midi]));
        setReading({ ...n, cents: Math.round(smooth.cents), freq: hz });
      } else if (t - heard > 700) {
        smooth = null;
        steady = 0;
        setReading(null);
      }
    };
    r.raf = requestAnimationFrame(loop);
  };

  const dronePlay = (midi) => {
    stopDrone.current?.();
    stopDrone.current = drone(mtof(midi));
    setDroning(!!stopDrone.current);
  };
  const dronePut = () => {
    stopDrone.current?.();
    stopDrone.current = null;
    setDroning(false);
  };

  // The card going away (board closed, module removed) lets go of everything
  useEffect(
    () => () => {
      halt();
      stopDrone.current?.();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const pick = (p) => {
    dronePut();
    setTuned([]);
    setState((s) => ({ ...s, preset: p, drone: null }));
  };
  const pickPeg = (midi) => {
    setState((s) => ({ ...s, drone: midi }));
    if (droning) dronePlay(midi);
  };

  const cents = reading ? Math.max(-50, Math.min(50, reading.cents)) : 0;
  const green = !!reading && Math.abs(reading.cents) <= IN_TUNE;

  if (err) {
    return (
      <div className="tuner">
        <div className="tuner-err">
          {err === "denied" && (
            <>
              <b>The mic is switched off for this page.</b> Click the little lock (or tune) icon next to the address,
              set Microphone to Allow, then try again.
            </>
          )}
          {err === "none" && <b>No microphone found. Plug one in, then try again.</b>}
          {err === "sound" && <b>Tap anywhere on the page first so it can make sound, then try again.</b>}
        </div>
        <button className="mini-btn" onClick={listen}>try again</button>
      </div>
    );
  }

  return (
    <div className={`tuner${expanded ? " big" : ""}`}>
      <div className={`tuner-gauge${green ? " green" : ""}${reading ? "" : " idle"}`}>
        <svg viewBox="0 0 200 112" aria-hidden="true">
          <path className="tuner-arc" d="M20 100 A80 80 0 0 1 180 100" />
          <path className="tuner-zone" d="M92 20.5 A80 80 0 0 1 108 20.5" />
          {[-50, -25, 0, 25, 50].map((c) => {
            const a = ((c / 50) * 45 * Math.PI) / 180;
            const x = (r) => 100 + Math.sin(a) * r;
            const y = (r) => 100 - Math.cos(a) * r;
            return <line key={c} className="tuner-tick" x1={x(70)} y1={y(70)} x2={x(80)} y2={y(80)} />;
          })}
          <g className="tuner-needle" style={{ transform: `rotate(${(cents / 50) * 45}deg)` }}>
            <line x1="100" y1="100" x2="100" y2="26" />
          </g>
          <circle className="tuner-hub" cx="100" cy="100" r="6" />
        </svg>
        <div className="tuner-note">
          {reading ? (
            <>
              {reading.name}
              <sub>{reading.octave}</sub>
            </>
          ) : (
            <span className="tuner-wait">{listening ? "play a note" : "–"}</span>
          )}
        </div>
        <div className="tuner-hz">
          {reading ? `${reading.freq.toFixed(1)} Hz · ${reading.cents > 0 ? "+" : ""}${reading.cents}¢` : " "}
        </div>
      </div>

      <div className="tuner-pegs" role="group" aria-label="Strings">
        {pegs.map((p) => (
          <button
            key={p.name}
            className={`tuner-peg${tuned.includes(p.midi) ? " lit" : ""}${aim === p.midi ? " aim" : ""}${reading?.midi === p.midi ? " near" : ""}`}
            onClick={() => pickPeg(p.midi)}
            aria-label={`${p.name}${tuned.includes(p.midi) ? ", in tune" : ""}`}
            aria-pressed={aim === p.midi}
          >
            {p.name.replace(/\d/, "")}
            <sub>{p.name.match(/\d/)[0]}</sub>
          </button>
        ))}
      </div>

      <div className="tuner-btns">
        <button className={`mini-btn${listening ? " on" : ""}`} onClick={() => (listening ? halt() : listen())}>
          {listening ? "stop" : "listen"}
        </button>
        <button className={`mini-btn${droning ? " on" : ""}`} onClick={() => (droning ? dronePut() : dronePlay(aim))}>
          {droning ? `drone ${midiToName(aim)}` : "drone"}
        </button>
      </div>

      <div className="tuner-presets" role="radiogroup" aria-label="Instrument">
        {Object.entries(PRESETS).map(([id, p]) => (
          <button key={id} role="radio" aria-checked={id === preset} className={`tuner-preset${id === preset ? " sel" : ""}`} onClick={() => pick(id)}>
            {p.label}
          </button>
        ))}
      </div>
    </div>
  );
}
