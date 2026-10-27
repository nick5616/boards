// The tape recorder's engine. A recording has to outlive the card it was started
// from (switch tabs, close the board: the dock keeps it going), so it lives here
// at module level, not in component state.
import { getAudio } from "./audio";
import { put } from "./localMedia";
import { uid } from "../utils/uid";
import { sendAll } from "./readings";

const active = new Map(); // modId -> { rec, stream, chunks, startedAt, analyser, buf, src }

export const isRecording = (modId) => active.has(modId);

// 0..1 live input level (peak of the last few ms)
export function levelOf(modId) {
  const a = active.get(modId);
  if (!a?.analyser) return 0;
  a.analyser.getByteTimeDomainData(a.buf);
  let peak = 0;
  for (const v of a.buf) peak = Math.max(peak, Math.abs(v - 128));
  return Math.min(1, peak / 100);
}

// Which computer made a take, so other computers can say "that one's on another machine"
export function deviceId() {
  try {
    let d = localStorage.getItem("boards-device");
    if (!d) localStorage.setItem("boards-device", (d = uid()));
    return d;
  } catch {
    return "anon";
  }
}

const MIMES = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];
const pickMime = () =>
  typeof MediaRecorder === "undefined" ? "" : MIMES.find((m) => MediaRecorder.isTypeSupported?.(m)) ?? "";

// Music mode leaves the mic alone (no gating or levelling); voice lets the browser clean it up
export async function startRecording(modId, { music, onDone }) {
  const on = !music;
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: on, noiseSuppression: on, autoGainControl: on },
  });
  if (active.has(modId)) {
    // a double tap while the mic prompt was open: keep the first recording
    stream.getTracks().forEach((t) => t.stop());
    return active.get(modId).startedAt;
  }
  const mime = pickMime();
  // Small on purpose: ~0.3 MB a minute, and it'll be uploaded and passed around later
  const opts = { audioBitsPerSecond: music ? 48000 : 32000 };
  if (mime) opts.mimeType = mime;
  let rec;
  try {
    rec = new MediaRecorder(stream, opts);
  } catch {
    rec = new MediaRecorder(stream); // the browser's own default
  }
  const a = { rec, stream, chunks: [], startedAt: Date.now() };
  const ctx = getAudio();
  if (ctx) {
    a.src = ctx.createMediaStreamSource(stream);
    a.analyser = ctx.createAnalyser();
    a.analyser.fftSize = 512;
    a.buf = new Uint8Array(a.analyser.fftSize);
    a.src.connect(a.analyser); // listening only, never to the speakers
  }
  rec.ondataavailable = (e) => e.data.size && a.chunks.push(e.data);
  rec.onstop = () => {
    stream.getTracks().forEach((t) => t.stop());
    a.src?.disconnect();
    active.delete(modId);
    const blob = new Blob(a.chunks, { type: rec.mimeType || mime || "audio/webm" });
    onDone(blob, (Date.now() - a.startedAt) / 1000);
  };
  active.set(modId, a);
  rec.start(1000);
  return a.startedAt;
}

export function stopRecording(modId) {
  const a = active.get(modId);
  if (a && a.rec.state !== "inactive") a.rec.stop();
}

// ~n loudness bars (0..1, 2 decimals, scaled so the loudest is 1) and the real length
export async function peaksOf(blob, n = 100) {
  try {
    const ctx = getAudio();
    const buf = await ctx.decodeAudioData(await blob.arrayBuffer());
    const ch = buf.getChannelData(0);
    const size = Math.max(1, Math.floor(ch.length / n));
    const raw = Array.from({ length: n }, (_, i) => {
      let p = 0;
      for (let j = i * size; j < Math.min(ch.length, (i + 1) * size); j++) p = Math.max(p, Math.abs(ch[j]));
      return p;
    });
    const top = Math.max(...raw, 0.0001);
    return { peaks: raw.map((p) => Math.round((p / top) * 100) / 100), dur: buf.duration };
  } catch {
    return { peaks: Array(n).fill(0.3), dur: null }; // couldn't decode: a flat line still plays fine
  }
}

// A finished recording becomes a take: the sound goes on this computer's shelf,
// and only its tiny description (no audio) goes into the board.
export async function finishTake(data, { boardId, modId, blob, secs, sendTo }) {
  const { uid: who, updateBoard, logPractice, undoLog, toast } = data;
  if (blob.size < 200) return toast({ text: "didn't hear anything, nothing kept" });
  const { peaks, dur } = await peaksOf(blob);
  const id = await put(blob, { boardId, modId });
  if (!id) return toast({ text: "couldn't keep that recording on this computer" });
  const take = {
    id,
    at: Date.now(),
    dur: Math.round((dur ?? secs) * 10) / 10,
    peaks,
    size: blob.size,
    type: blob.type,
    by: who,
    dev: deviceId(),
    where: "local", // later: "shared" once it's in Cloud Storage
  };
  updateBoard(boardId, (b) => ({
    ...b,
    modules: b.modules.map((m) => {
      if (m.id !== modId) return m;
      const takes = m.state.takes ?? [];
      if (takes.some((t) => t.id === id)) return m;
      const n = takes.reduce((k, t) => Math.max(k, Number(/^take (\d+)$/.exec(t.name)?.[1] ?? 0)), 0) + 1;
      return { ...m, state: { ...m.state, takes: [...takes, { ...take, name: `take ${n}` }] } };
    }),
  }));
  const mins = Math.round(secs / 60);
  if (mins < 1) return toast({ text: "take kept (under a minute, not logged)" });
  const entry = logPractice(boardId, `📼 recorded ${mins} min`, { mins, moduleId: modId });
  const sent = sendAll(updateBoard, boardId, sendTo, { value: mins, unit: "min", label: "tape" });
  toast({ text: `${mins} min on the chart ✓${sent ? " · sent" : ""}`, actions: [{ label: "undo", run: () => undoLog(entry) }] });
}
