// What this browser can do, checked once. Modules list what they `needs`;
// the tray greys out the ones that can't work here.
const w = typeof window !== "undefined" ? window : {};
const nav = typeof navigator !== "undefined" ? navigator : {};

export const caps = {
  audio: !!(w.AudioContext || w.webkitAudioContext),
  mic: !!nav.mediaDevices?.getUserMedia,
  camera: !!nav.mediaDevices?.getUserMedia,
  midi: !!nav.requestMIDIAccess,
  speech: "speechSynthesis" in w,
  listen: !!(w.SpeechRecognition || w.webkitSpeechRecognition),
  eyedropper: "EyeDropper" in w,
  pip: "documentPictureInPicture" in w,
  motion: "DeviceMotionEvent" in w,
  bluetooth: !!nav.bluetooth,
};

// Which of these needs can't be met here
export const missing = (needs = []) => needs.filter((n) => !caps[n]);

const HINTS = {
  mic: "needs a microphone",
  camera: "needs a camera",
  audio: "needs sound",
  speech: "needs a voice to read aloud",
  motion: "needs a device that moves",
  bluetooth: "needs Bluetooth",
};
const CHROME_ONLY = ["midi", "listen", "eyedropper", "pip", "bluetooth"];

// A short human reason, or null when everything's available
export function capHint(needs = []) {
  const gone = missing(needs);
  if (!gone.length) return null;
  const hints = gone.map((n) => (CHROME_ONLY.includes(n) ? "works in Chrome or Edge" : HINTS[n]));
  return [...new Set(hints)].join(" · ");
}
