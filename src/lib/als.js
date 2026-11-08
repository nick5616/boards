// Ableton Live sets (.als): a gzipped XML file. Reads one in the browser and boils it down to a
// small summary a board can keep: tempo, time signature, key, length, each track with its colour,
// devices and where its clips sit, the plugins and samples it leans on. The file itself goes on
// the local shelf and (when the board has cloud storage) up to the board's host, see AbletonSet.
//
// Summary ("sum"), small on purpose since it lives in the module's state:
//   { live, bpm, sig, key, beats, scenes, note,
//     tracks: [{ n, t: m|a|g|r, c, g?, dev: [names], clips: [[start, end, colour]], ses: [[scene, colour]] }],
//     plugins: [names], samples: { own: [file names], lib: count } }
// Beats are quarter notes, as Live counts them.

export const alsIn = (files) => [...(files ?? [])].filter((f) => /\.als$/i.test(f.name ?? ""));

// "bbbbig head [2026-09-11 134752].als" (one of Live's backups) → "bbbbig head"
export const setName = (fileName) => (fileName ?? "").replace(/\.als$/i, "").replace(/\s*\[\d{4}-\d\d-\d\d \d{6}\]$/, "").trim() || "Live set";

// Live's clip and track colours, by index
export const LIVE_COLORS = [
  "#ff94a6", "#ffa529", "#cc9927", "#f7f47c", "#bffb00", "#1aff2f", "#25ffa8", "#5cffe8", "#8bc5ff", "#5480e4", "#92a7ff", "#d86ce4", "#e553a0", "#ffffff",
  "#ff3636", "#f66c03", "#99724b", "#fff034", "#87ff67", "#3dc300", "#00bfaf", "#19e9ff", "#10a4ee", "#007dc0", "#886ce4", "#b677c6", "#ff39d4", "#d0d0d0",
  "#e2675a", "#ffa374", "#d3ad71", "#edffae", "#d2e498", "#bad074", "#9bc48d", "#d4fde1", "#cdf1f8", "#b9c1e3", "#cdbbe4", "#ae98e5", "#e5dce1", "#a9a9a9",
  "#c6928b", "#b78256", "#99836a", "#bfba69", "#a6be00", "#7db04d", "#88c2ba", "#9bb3c4", "#85a5c2", "#8393cc", "#a595b5", "#bf9fbe", "#bc7196", "#7b7b7b",
  "#af3333", "#a95131", "#724f41", "#dbc300", "#85961f", "#539f31", "#0a9c8e", "#236384", "#1a2f96", "#2f52a2", "#624bad", "#a34bad", "#cc2e6e", "#3c3c3c",
];
export const liveColor = (i) => LIVE_COLORS[i] ?? "#a9a9a9";

const NOTES = ["C", "C♯", "D", "E♭", "E", "F", "F♯", "G", "A♭", "A", "B♭", "B"];
const SCALES = ["major", "minor", "Dorian", "Mixolydian", "Lydian", "Phrygian", "Locrian"];

// Live's own devices by their tag in the file, where the tag isn't the name
const DEVICES = {
  Eq8: "EQ Eight", Eq3: "EQ Three", ChannelEq: "Channel EQ", Compressor2: "Compressor", GlueCompressor: "Glue Compressor",
  AutoFilter2: "Auto Filter", AutoFilter: "Auto Filter", StereoGain: "Utility", OriginalSimpler: "Simpler", MultiSampler: "Sampler",
  UltraAnalog: "Analog", InstrumentVector: "Wavetable", InstrumentImpulse: "Impulse", LoungeLizard: "Electric", StringStudio: "Tension",
  DrumGroupDevice: "Drum Rack", InstrumentGroupDevice: "Instrument Rack", AudioEffectGroupDevice: "Audio Effect Rack",
  MidiEffectGroupDevice: "MIDI Effect Rack", MidiArpeggiator: "Arpeggiator", MidiChord: "Chord", MidiScale: "Scale", MidiPitcher: "Pitch",
  MidiRandom: "Random", MidiVelocity: "Velocity", MidiNoteLength: "Note Length", Chorus2: "Chorus-Ensemble", PhaserNew: "Phaser-Flanger",
  Redux2: "Redux", DrumBuss: "Drum Buss", Vinyl: "Vinyl Distortion", BeatRepeat: "Beat Repeat", FilterDelay: "Filter Delay",
  GrainDelay: "Grain Delay", PingPongDelay: "Ping Pong Delay", CrossDelay: "Simple Delay", MultibandDynamics: "Multiband Dynamics",
  Resonator: "Resonators", FrequencyShifter: "Frequency Shifter", HybridReverb: "Hybrid Reverb", ShifterDevice: "Shifter",
  MxDeviceAudioEffect: "Max audio effect", MxDeviceInstrument: "Max instrument", MxDeviceMidiEffect: "Max MIDI effect",
};

const kids = (el, tag) => (el ? [...el.children].filter((c) => c.tagName === tag) : []);
const kid = (el, tag) => kids(el, tag)[0] ?? null;
// el > a > b > c, by direct children only
const at = (el, ...path) => path.reduce((e, tag) => kid(e, tag), el);
const value = (el, ...path) => at(el, ...path)?.getAttribute("Value") ?? null;
const num = (el, ...path) => {
  const n = Number(value(el, ...path));
  return Number.isFinite(n) ? n : null;
};
const round = (n) => Math.round(n * 4) / 4; // to the sixteenth

// A plugin's name, from its PluginDesc (VST2, VST3 or Audio Unit)
const plugName = (desc) =>
  value(desc, "VstPluginInfo", "PlugName") || value(desc, "Vst3PluginInfo", "Name") || value(desc, "AuPluginInfo", "Name") || null;

function deviceName(d) {
  const desc = kid(d, "PluginDesc");
  if (desc) return plugName(desc) || "a plugin";
  const user = value(d, "UserName");
  if (user) return user;
  return DEVICES[d.tagName] ?? d.tagName.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/\d+$/, "");
}

const TYPES = { MidiTrack: "m", AudioTrack: "a", GroupTrack: "g", ReturnTrack: "r" };
const MAX_CLIPS = 40; // per track, after joining ones that touch
const MAX_TRACKS = 64;

function trackOf(el, ids) {
  const seq = at(el, "DeviceChain", "MainSequencer");
  // Arrangement clips: MIDI under ClipTimeable, audio under Sample
  const clips = [];
  for (const holder of [at(seq, "ClipTimeable"), at(seq, "Sample")]) {
    for (const c of kids(at(holder, "ArrangerAutomation", "Events"), "MidiClip").concat(kids(at(holder, "ArrangerAutomation", "Events"), "AudioClip"))) {
      const s = num(c, "CurrentStart") ?? Number(c.getAttribute("Time"));
      const e = num(c, "CurrentEnd");
      if (Number.isFinite(s) && Number.isFinite(e) && e > s) clips.push([round(s), round(e), num(c, "Color") ?? -1]);
    }
  }
  clips.sort((a, b) => a[0] - b[0]);
  // Clips end to end in the same colour read as one block
  const joined = [];
  for (const c of clips) {
    const last = joined[joined.length - 1];
    if (last && last[2] === c[2] && c[0] - last[1] <= 0.25) last[1] = Math.max(last[1], c[1]);
    else joined.push(c);
  }
  // Session clips: which scene rows have one
  const ses = [];
  kids(at(seq, "ClipSlotList"), "ClipSlot").forEach((slot, i) => {
    const v = at(slot, "ClipSlot", "Value");
    const c = v && (kid(v, "MidiClip") ?? kid(v, "AudioClip"));
    if (c) ses.push([i, num(c, "Color") ?? -1]);
  });
  const dev = [...(at(el, "DeviceChain", "DeviceChain", "Devices")?.children ?? [])].map(deviceName);
  const t = {
    n: value(el, "Name", "EffectiveName") || value(el, "Name", "UserName") || "track",
    t: TYPES[el.tagName],
    c: num(el, "Color") ?? -1,
    dev: dev.slice(0, 12),
    clips: joined.slice(0, MAX_CLIPS),
    ses: ses.slice(0, 64),
  };
  const group = ids.get(value(el, "TrackGroupId"));
  if (group != null) t.g = group;
  return t;
}

async function textOf(file) {
  const head = new Uint8Array(await file.slice(0, 2).arrayBuffer());
  if (head[0] !== 0x1f || head[1] !== 0x8b) return file.text(); // already plain XML (rare, but Live reads it)
  return new Response(file.stream().pipeThrough(new DecompressionStream("gzip"))).text();
}

// File → summary, or throws if it isn't a Live set
export async function readSet(file) {
  const xml = new DOMParser().parseFromString(await textOf(file), "application/xml");
  const root = xml.documentElement;
  if (root?.tagName !== "Ableton") throw new Error("not a Live set");
  const set = kid(root, "LiveSet");
  if (!set) throw new Error("not a Live set");

  const els = [...(at(set, "Tracks")?.children ?? [])].filter((e) => TYPES[e.tagName]);
  const ids = new Map(els.map((e, i) => [e.getAttribute("Id"), i]));
  const tracks = els.slice(0, MAX_TRACKS).map((e) => trackOf(e, ids));

  // The main (Live 12) or master track holds the tempo and time signature
  const main = kid(set, "MainTrack") ?? kid(set, "MasterTrack");
  const mixer = at(main, "DeviceChain", "Mixer");
  const bpm = num(mixer, "Tempo", "Manual");
  // Stored as numerator - 1 + 99 × log2(denominator): 201 is 4/4
  const ts = num(mixer, "TimeSignature", "Manual");
  const sig = ts == null ? null : `${(ts % 99) + 1}/${2 ** Math.floor(ts / 99)}`;

  const scale = kid(set, "ScaleInformation");
  const root12 = num(scale, "Root") ?? num(scale, "RootNote");
  const scaleIx = num(scale, "Name");
  const key = value(set, "InKey") === "true" && root12 != null ? `${NOTES[root12 % 12]} ${SCALES[scaleIx] ?? ""}`.trim() : null;

  // Plugins anywhere in the set, racks included
  const plugins = [...new Set([...xml.getElementsByTagName("PluginDesc")].map(plugName).filter(Boolean))].slice(0, 40);

  // Samples: ones from Live's library or packs travel with Live; the rest have to be sent along
  const own = new Set();
  let lib = 0;
  const seen = new Set();
  for (const ref of xml.getElementsByTagName("SampleRef")) {
    const f = kid(ref, "FileRef");
    const path = value(f, "Path") || value(f, "RelativePath") || value(f, "Name") || "";
    if (!path || seen.has(path)) continue;
    seen.add(path);
    if (value(f, "LivePackName") || /Core Library|[/\\]Packs[/\\]|Factory Packs|User Library/i.test(path)) lib++;
    else own.add(path.split(/[/\\]/).pop());
  }

  const beats = Math.max(0, ...tracks.flatMap((t) => t.clips.map((c) => c[1])));
  const scenes = kids(at(set, "Scenes"), "Scene").length;
  const note = (value(set, "Annotation") ?? "").trim().slice(0, 500) || null;
  const creator = root.getAttribute("Creator") ?? "";

  return {
    live: creator.replace(/^Ableton\s+/i, "") || null,
    bpm: bpm == null ? null : Math.round(bpm * 100) / 100,
    sig,
    key,
    beats,
    scenes,
    note,
    tracks,
    plugins,
    samples: { own: [...own].slice(0, 60), lib },
  };
}

// The same summary with the clip positions dropped, for older versions (the names still diff)
export const slim = (sum) => sum && { ...sum, tracks: sum.tracks.map(({ n, t, c, g }) => ({ n, t, c, ...(g != null && { g }) })) };

// How long the arrangement runs, as m:ss at the set's tempo
export function lengthOf(sum) {
  if (!sum?.beats || !sum.bpm) return null;
  const s = Math.round((sum.beats / sum.bpm) * 60);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export const kindName = { m: "MIDI", a: "audio", g: "group", r: "return" };

// What changed between two saves, in a few words each
export function changes(prev, next) {
  if (!prev || !next) return [];
  const out = [];
  if (prev.bpm !== next.bpm && next.bpm) out.push(`${next.bpm} bpm (was ${prev.bpm})`);
  if (prev.sig !== next.sig && next.sig) out.push(`now ${next.sig}`);
  if (prev.key !== next.key && next.key) out.push(`now in ${next.key}`);
  const before = new Set(prev.tracks.map((t) => t.n));
  const after = new Set(next.tracks.map((t) => t.n));
  const added = [...after].filter((n) => !before.has(n));
  const gone = [...before].filter((n) => !after.has(n));
  if (added.length) out.push(`+ ${added.slice(0, 3).join(", ")}${added.length > 3 ? ` +${added.length - 3}` : ""}`);
  if (gone.length) out.push(`− ${gone.slice(0, 3).join(", ")}${gone.length > 3 ? ` +${gone.length - 3}` : ""}`);
  const bar = Number(next.sig?.split("/")[0]) || 4;
  const bars = Math.round((next.beats - prev.beats) / bar);
  if (bars) out.push(`${Math.abs(bars)} bar${Math.abs(bars) === 1 ? "" : "s"} ${bars > 0 ? "longer" : "shorter"}`);
  const newPlugs = next.plugins.filter((p) => !prev.plugins.includes(p));
  if (newPlugs.length) out.push(`now uses ${newPlugs.slice(0, 2).join(", ")}`);
  return out;
}
