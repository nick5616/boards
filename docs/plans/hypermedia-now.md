# Hypermedia, right away

> Part of [the plans](README.md). This doc covers modules and plumbing that
> need nothing beyond today's free Firebase setup. Sharing is specced in
> [sharing-multiplayer.md](sharing-multiplayer.md), direct browser-to-browser
> features in [peer-to-peer.md](peer-to-peer.md), and the cheap server pieces
> in [hypermedia-server.md](hypermedia-server.md).

Desktop first (Chrome/Edge). Firestore only ever sees small state: numbers,
note lists, hex colors, text. Heavy media is recorded and encoded in the
browser. It sits on this computer's local shelf (IndexedDB), passes peer to
peer, and later syncs to Cloud Storage. Phones get a reduced version of each
module, and the tray greys out what a browser can't do.

## Phase 0 — Groundwork (unlocks everything below)

### 0.1 Modules describe themselves
Each `MODULES[type]` in `src/constants/modules.js` gains:
- **`needs`**: `["audio" | "mic" | "camera" | "midi" | "speech" | "listen" | "eyedropper" | "pip" | "motion"]`
- **`accepts` + `takeIn(state, paste)`**: the per-type cases move out of
  `suggestions()` / `takeIn()` in `src/lib/paste.js` onto the module. Paste.js
  keeps classify, describe and naming, and asks the modules for the rest.
- **`receive(state, reading)`**: what the module does when another module
  sends it a reading (see 5.4). Graph, Tally and Jar implement it first.
- **`glance(mod, entries)`** returns a short string or null. It replaces the
  hand-written checks in `src/components/home/boardFacts.js` and the fixed
  fields in `Glance.jsx`.

New `src/lib/caps.js` is one feature-detect table. `ModuleTray.jsx` greys out
modules whose `needs` aren't met, with a note like "works in Chrome" or
"needs a microphone".

### 0.2 Live dock (things keep running across boards)
- **Where it lives:** `src/contexts/LiveContext.jsx` and
  `src/components/live/LiveDock.jsx`, mounted in `App.jsx` beside `<Toast>`,
  so it survives switching boards and going home.
- **What it tracks:** a registry of running things. **Running state stays in
  module state** (`startedAt`, `bpm`, `playing`), as Timer already does, so
  collaborators see "Sam's metronome is running" through ordinary sync. The
  dock handles the local sound, ticking display, wake lock, media keys and
  pop-out.
- **Sound:** `src/lib/audio.js` holds one shared `AudioContext`, created on
  the first gesture. It has a tiny synth (oscillator + envelope), a click
  voice and a ding, and everything below shares it.
- **While anything is live:**
  - `navigator.wakeLock` keeps the screen on.
  - Media Session shows a title and play/pause, so keyboard media keys work.
  - A **pop out** button floats the dock above other windows (Document
    Picture-in-Picture).
- **Timer** moves onto the dock first. Stopping it from the dock logs exactly
  like its own stop button.
- **Second window:** a dock in another window or on a second monitor stays in
  step over the same-computer channel
  ([peer-to-peer.md](peer-to-peer.md) plumbing).

### 0.3 Local shelf
`src/lib/localMedia.js` is a small IndexedDB wrapper with no dependency:
`put(blob) → id`, `get(id)`, `del(id)` and `list()`.
- **What syncs:** module state stores only the id, the duration and a
  ~100-point peaks array for drawing a waveform.
- **Ids:** content-addressed, so peers and Storage can dedupe later.
- **Save as a file:** "Save as file…" uses `showSaveFilePicker`, with a
  download fallback.
- **Its role:** the shelf is a **cache in front of Cloud Storage**, not the
  final home. Until the server plan lands, cards say "on this computer", and
  [peer-to-peer.md](peer-to-peer.md) P3 hands takes to other computers for
  free.

### 0.4 Board-level drop
`Space.jsx` gets a drop handler that mirrors its paste handler. Files and
links dragged from other tabs go through `classify` into the same
"What's this?" sheet.

**Cost:** zero. All of it runs in the browser.

## Phase 1 — Sharing & multiplayer
Specced in [sharing-multiplayer.md](sharing-multiplayer.md): M1 data layer,
M2 share a board, M3 share a tab, M4 presence, M5 together touches. It's
built right after Phase 0, so every module below is multiplayer-aware from
the start.

## Phase 2 — Sound (instruments, songwriting)

| Module | Object | How | Syncs | Together |
|---|---|---|---|---|
| Metronome | wind-up wooden pyramid, arm swings | lookahead scheduler on the audio clock; tap tempo; time signature + accent; "speed trainer" (+N bpm every N bars) | bpm, meter | **Play together:** clicks land in sync on the shared clock ([P2P](peer-to-peer.md) P4) |
| Tuner | needle gauge / tuning fork | mic → AnalyserNode → autocorrelation pitch; note + cents needle; presets (guitar, violin, uke, voice); **drone** mode plays a held reference pitch | preset only | personal; shows "Sam is tuning" |
| Keys | toy piano | click or QWERTY keys play the synth; **Web MIDI** input from a real keyboard; "keep this" saves the phrase as a note list and replays it | note lists | the other person's phrases appear and play |
| Staff paper | music notebook page | tap notes onto a staff (or guitar tab); plays back on the shared synth; good for song sketches | note lists | co-write a sketch |
| Tape recorder | cassette, reels spin | MediaRecorder (Opus) → local shelf (0.3); takes list with waveform; A/B two takes | take ids + peaks | send to… / spreads between members ([P2P](peer-to-peer.md) P3); Storage sync later |

Every one logs itself when a session ends, like Timer:
`logPractice(board.id, "♩ 12 min at 96", { mins, bpm })`. The tuner logs
`{ mins }`; Keys logs `{ mins, notes }` from MIDI activity.

**Cost:** zero, except Firestore writes for logs and note lists, a few per
session.

## Phase 3 — Words & voice (languages, lyrics)

- **Talking flashcards**
  - Cards get a `lang`. 🔊 reads a card aloud with `speechSynthesis`, picking
    a voice for that language, with optional auto-speak on flip.
  - 🎤 "say it" checks your pronunciation with Chrome's speech recognition.
    Chrome sends that audio to Google; it isn't our server or our cost, but
    people should know.
  - **Together:** a shared deck, where each person's "learned" is their own
    (keyed by uid).
- **Fridge magnets**
  - Word tiles from a Notes module or pasted lyrics, dragged around a fridge
    door.
  - "Rhymes with…" and "sounds like…" come from Datamuse, which is free,
    CORS-friendly and text only.
  - **Together:** both people drag words live, with cursors.
- **Radio**
  - A transistor radio playing stations in the language you're learning,
    from the radio-browser.info directory, with media keys via the dock.
  - The stream comes from the station, not us.

**Cost:** zero.

## Phase 4 — Eyes (fashion, form)

- **Paint chips**
  - A swatch fan. EyeDropper picks any color on screen, including the
    clippings on the board.
  - Each chip gets a name from a small built-in table, and palettes are kept
    per look. Syncs hex strings.
  - **Together:** a shared palette, where each pick carries the picker's face.
- **Mirror / photo booth**
  - Live camera; nothing is saved unless you snap.
  - A 4-frame strip composites to one small JPEG through the existing
    `compressImage` → `saveImage` path, and lands in a Scrapbook.
  - **Together:** "show me" sends your camera into a friend's Mirror, live
    ([P2P](peer-to-peer.md) P4).
  - Video takes go to the local shelf, then Storage
    ([server](hypermedia-server.md) S2).

**Cost:** one small image per snap; video costs only once it's in Storage.

## Phase 5 — Hyper (things link to each other)

- **5.1 @-mentions**
  - `src/lib/mentions.js` parses `@[Title](mod:<boardId>/<modId>)` and
    `@[Title](board:<id>)`.
  - `AutoTA` gets an `@` autocomplete popover. A new `RichText` component
    shows chips when the field isn't focused, and the textarea when it is.
  - Clicking a chip navigates with `pathFor` and opens the module big.
  - `useData()` gains `boards` and their slugs.
  - Covers shared spaces too. A mention the reader can't open shows as a
    plain grey chip.
- **5.2 Backlinks:** computed from the in-memory boards. They appear as
  "Mentioned in…" in the module ⋯ menu and at the foot of `BigSheet`.
- **5.3 Window module** (`kind: "control"`)
  - Pick any module in any space you're a member of. The window renders its
    Body the way `BigSheet` does, writes back to that space, and reads that
    space's entries.
  - It's the same mount mechanism as shared tabs
    ([sharing-multiplayer.md](sharing-multiplayer.md)).
  - Folders and other windows can't be windowed: folders need `BoardContext`,
    and windows can't nest.
- **5.4 Wires**
  - "Send readings to…" in the ⋯ menu of Timer, Metronome, Tuner and Keys
    lets you pick a Graph, Tally or Jar.
  - The source keeps `sendTo: [modId]`. At session end, the target's
    `MODULES[type].receive` runs.
  - The first wire is metronome bpm → Graph, so you see your tempo climbing
    over weeks.
- **5.5 Ctrl+K:** jump to any board or module, or add a module, from
  anywhere.

**Cost:** zero. Mentions and backlinks are computed in the browser.

## Phones
Each module names its phone version:
- Metronome, tuner, flashcards and fortunes work as they are.
- Keys hides MIDI.
- Paint chips picks colors from a photo instead.
- The dock has no pop-out.

Nothing here is phone-first. The phone's best role is as a remote for the
desktop ([peer-to-peer.md](peer-to-peer.md) P1).

## Adding a module (checklist)
1. `MODULES` + `MODULE_TYPES`
2. `MODULE_COMPONENTS`
3. `TrayArt` case + CSS
4. `DOES` badges (new verbs: mic, ear, keys, eye)
5. `needs` / `accepts` / `glance` / `receive`
6. `OWNS_ENTRIES`, if it owns entries
7. **Decide what's per-person vs. shared state**, and stamp `by` on anything a
   person adds
8. Optionally, a demoSeed entry

## Checking it works
`npm run dev`, Chrome desktop, both in demo mode and signed in.
- **Metronome**
  - Start it, switch boards and go home. The click never drifts or stops,
    the dock shows it, the screen doesn't sleep, and media keys pause it.
  - Stop it and a log appears with bpm. A wired Graph gets a point.
- **Tuner:** a 440 Hz tone from a phone app reads A4 ±2¢. If the mic is
  denied, the card explains why instead of going blank.
- **Keys:** with a MIDI keyboard plugged in, notes light up, play and log.
- **Tape:** record, reload, and the take is still there. Firestore shows only
  the id and peaks.
- **Mentions:** @ a module on another board, click it, and you land there
  with it open. The target shows the backlink.
- **Firefox / phone:** the tray greys out unsupported modules, and nothing
  throws.
- **Two Chrome profiles:** each module's "Together" column behaves as
  described.
