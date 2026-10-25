// Note names and pitch maths, with no sound in it. MIDI 69 is A4 (440 Hz by default).
// Self-contained on purpose: nothing here imports from the rest of the app.

const NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

export const pitchClass = (midi) => ((Math.round(midi) % 12) + 12) % 12;
export const isBlack = (midi) => [1, 3, 6, 8, 10].includes(pitchClass(midi));
export const octaveOf = (midi) => Math.floor(Math.round(midi) / 12) - 1; // C4 = 60

// 69 -> "A4", 61 -> "C#4"
export const midiToName = (midi) => `${NAMES[pitchClass(midi)]}${octaveOf(midi)}`;

// "A4" / "c#3" / "Bb2" -> midi number, or null if it isn't a note name
export function nameToMidi(name) {
  const m = /^([A-Ga-g])([#b]?)(-?\d+)$/.exec(String(name).trim());
  if (!m) return null;
  const base = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[m[1].toUpperCase()];
  const shift = m[2] === "#" ? 1 : m[2] === "b" ? -1 : 0;
  return (Number(m[3]) + 1) * 12 + base + shift;
}

// Hz -> fractional midi number (69.5 is a quarter-tone above A4)
export const freqToMidi = (freq, a4 = 440) => 69 + 12 * Math.log2(freq / a4);

// Hz -> the nearest note and how far off it is: { midi, name, pc, octave, cents (-50..50), freq }
export function freqToNote(freq, a4 = 440) {
  const exact = freqToMidi(freq, a4);
  const midi = Math.round(exact);
  return {
    midi,
    name: NAMES[pitchClass(midi)],
    pc: pitchClass(midi),
    octave: octaveOf(midi),
    cents: Math.round((exact - midi) * 100),
    freq,
  };
}
