# Peer to peer: where a server is the wrong answer

> Part of [the plans](README.md). Builds on the space membership from
> [sharing-multiplayer.md](sharing-multiplayer.md). The one paid piece, a TURN
> relay, is S8 in [hypermedia-server.md](hypermedia-server.md).

Some things should never go through a server: it would cost per message, add
lag, and store things nobody wants kept. These go **straight between
browsers**. They're free, and capacity grows with the number of people,
because every person brings their own bandwidth.

**Rule of thumb:** if it's ephemeral, high-frequency, heavy or private, and
"arrives about right" is good enough (it doesn't need "exactly once, in
order"), it goes peer to peer. Firestore stays the record for things that
must last, and Cloud Storage holds the heavy things that must last.

## Plumbing (built once)

### The peer bus — `src/lib/peers.js`
- `room(key)` returns
  `{ peers, send(channel, msg, to?), on(channel, fn), addStream, onStream, leave }`.
- **Delivery:** cursors, ink and the clock drop stale messages, because a late
  one is useless. Files, text edits and game moves arrive reliably and in
  order.
- **File transfer:**
  - sent in ~64 KB chunks with backpressure
  - resumable by chunk index
  - checked with a SHA-256 checksum at the end
- **Same-computer fast path:** `BroadcastChannel`, behind the same API, with
  no network at all. Tabs, pop-out windows and a board on a second monitor
  talk through it.

### Finding each other (signaling)
- **What signaling is:** WebRTC needs a few tiny messages exchanged once per
  connection: an offer, an answer, and route candidates. They ride on the
  Realtime Database at `signal/{room}/...`. It's free, a few KB per
  connection, and nothing heavy touches it.
- **No library:** our own ~200 lines (`src/lib/rtdbPeers.js`, the `"rtdb"`
  transport). We tried Trystero's Firebase strategy and dropped it: it writes
  under `__trystero__`, which members-only rules can't allow, and it can't be
  pointed at the local emulator.
  - `rooms/{room}/{peer}` is who's here (gone when the tab goes)
  - `signal/{room}/{to}/{from}/{msg}` carries offers, answers, route candidates
    and small fallback messages. You read only your own inbox.
  - A peer id is `{uid}-{random}`, so rules tie it to the signed-in account.
    The lower id of a pair makes the offer.
- **Room keys, and who may join** (rules look at `access/{room}/{uid}`):
  - a shared space uses `space:{sid}`. Your access row must carry the space's
    room secret, which lives on the Firestore space doc (members only) and is
    claimed once in `keys/{sid}` by the owner. A stranger who only knows the
    space id can't write a passing row. A removed member who kept the secret
    still can, until the space gets a new one (not built); they see faces and
    cursors, never content.
  - a phone pairing uses `pair:{code}`, then `pair:{secret}`. The room id is a
    hash (`pair_` + SHA-256 of the code or secret), so you can only join by
    knowing it. The phone signs in as an anonymous guest. A 6-digit code can be
    guessed in 2 minutes, so the desktop asks **Allow this phone?** and shows a
    2-digit check number that must match the one on the phone before it hands
    over the long secret. "Forget my phones" makes a new secret.
  - your own devices could use `me:{uid}` later (not built)
- **Routes:** Google's free public STUN.
- **When a direct route fails:** about 1 in 10 connections can't go direct
  (some office and phone networks).
  - Small messages fall back to RTDB.
  - Big transfers say "couldn't connect directly — try another network".
  - The TURN relay (server S8) closes the gap cheaply.

### Topology
- **Full mesh up to ~8 people:** everyone connects to everyone. Good for
  calls and cursors.
- **Bigger rooms, data only:** gossip. Each peer connects to about 4 others
  and forwards messages it hasn't seen, with a hop limit. That lets a public
  board have a crowd watching live without a server.

### Shared clock
NTP-style pings, taking the median of 8 and refreshing every 30s, accurate to
a few ms. It's much tighter than the RTDB server offset. The synced
metronome, watch-together and games all use it.

## Features

### P1 — Phone as a remote (desktop first, phone helps)
On the desktop, ⋯ → **Pair a phone** shows a QR code. Scanning it opens a
remote page joined to `pair:{code}`. After the person presses **Allow** on
the desktop, the phone remembers a pairing secret (`pair:{secret}`, no Google
account needed) and becomes:
- **a camera for the board:** snap on the phone, and the photo lands where
  you're pointing on the desktop (a Scrapbook, Clipping or Mirror)
- **a clicker at the instrument:** big "I practiced" and "+1" buttons that
  log on the desktop board
- **a second screen:** the dock's metronome or timer, big, on the music stand
- **a mic** for the tuner while the computer sits across the room
- **a shaker:** phone motion drives the Magic 8-ball or dice on the desktop

**Cost:** zero. Only the pairing handshake touches RTDB.

### P2 — The ephemeral layer (in shared spaces)
- **Cursors** at full framerate. RTDB keeps only "who's here", for the faces.
- **Fading ink:** hold a key and draw on top of anything to point and circle.
  It fades after a few seconds and is never saved.
- **Throw a sticker:** toss a Kid Pix stamp or confetti at someone's screen.
  It lands, wobbles, and is gone.
- **Pass a note:** a folded paper note pops open on their screen and burns
  after reading. It's never stored.
- **"Sam is writing…"** typing indicators and focus outlines.

**Cost:** zero. None of this would be affordable through a database.

### P3 — Pass the tape (files between computers)
- Drag a tape take, or any big file, onto a collaborator's face, and it goes
  straight to their local shelf.
- In a shared space, a peer that has a take offers it to peers who don't. So
  recordings spread between members whenever two of them are online together.
- Mirror video takes and full-size photos go the same way. The board keeps
  only a small copy.
- Cloud Storage ([server](hypermedia-server.md) S2) is the backstop for when
  nobody overlaps.

Built: drag a take (Tape card) onto a face in the board header; a progress ring
fills round the face (`lib/tapePass.js`, `TogetherBar`). Takes also spread by
themselves: on join each member says which takes it lacks, a holder says "have",
the receiver asks one holder (`components/live/TapePass.jsx`). A dropped
transfer resumes from the missing chunks (`sendFile` `resume`).

**Cost:** zero for the transfer. Storage only for what must survive when
everyone's offline.

### P4 — Together, live
- **Practice room**
  - An audio or video call inside a board tab, up to 8 people in a mesh.
    Never recorded.
  - "Music mode" turns off echo cancellation, noise suppression and
    auto-gain, so instruments sound like instruments.
  - Internet lag (50–150 ms) rules out playing in time together. It's for
    lessons, feedback and "listen to this", not jamming.
  - Built: `room.addStream / removeStream / onStream` on the "rtdb" transport
    (`rtdbPeers.js`: perfect-negotiation renegotiation over the same RTDB signaling,
    tracks come and go while data channels keep working; "local" says `streams: false`).
    `lib/liveMedia.js` labels each stream (`call:<mod>`, `show:<mod>`) and picks who gets it.
    Module `practiceroom` (`PracticeRoom.jsx`): TV-set and polaroid tiles, mute, camera off,
    music mode (mic re-acquired with the processing off), join/leave, roll call of who's in.
- **Show me:** your camera, or a screen or window, appears in a Mirror module
  on their board. For example, watch a friend's fretting hand while you teach.
  - Built: in `Mirror.jsx`; camera or `getDisplayMedia` goes into the same mirror on
    everyone else's screen ("Sam is showing you"), with a Stop button.
- **Synced metronome:** everyone's clicks land together on the shared clock,
  and tempo changes spread instantly.
- **Watch / listen together:** a clipping's YouTube or Spotify embed plays in
  sync. Each person streams from the source; only play, pause and seek go
  peer to peer.

Built (synced metronome): a running metronome in a shared space carries an `anchor`
on the shared clock, so all clicks land on one grid; tempo, meter and start/stop go
over the bus first (`lib/metroSync.js`) and show "in sync with Sam".
Built (watch together): a Clipping's YouTube embed has a "watch together" toggle
(`hooks/useWatch.js`, IFrame Player API); play, pause, seek and a 4 s heartbeat go
peer to peer, drift corrected past 0.5 s. YouTube only: Vimeo/SoundCloud need their
own player scripts and Spotify has no player API.

**Cost:** zero. That includes video, which would be the single most expensive
thing to relay through a server.

### P5 — Live text together
- Text blocks become **Yjs** documents (a text-merging library) synced over
  the peer bus. Keystroke-level merging means two people can type in the
  same note, and it replaces the sharing spec's soft lock.
- Firestore still keeps the record. Whichever peer has the lowest uid writes
  the merged text, debounced, for anyone who's offline.

**Cost:** fewer Firestore writes than today, because only one peer persists,
on a debounce.

Built: `src/lib/liveText.js` (Yjs doc per text box over the "text" channel, newcomer
state exchange, lowest-uid-among-editors saves on a debounce), `components/live/useLiveText.js`
(caret follows remote edits), wired into `AutoTA` (Notes blocks, Corkboard, NextUp, Syllabus,
Clipping notes). Merged boxes skip the 3 s soft lock but keep "Sam is writing…". Solo/private
boards, viewers and the diary/scrapbook text stay plain. Test: `npx vitest run tests/liveText.test.js`.

### P6 — Games
- **Flashcard race:** the same deck for everyone; the first to answer scores,
  timed on the shared clock.
- **Magnet battle:** each person gets 20 random word magnets from the shared
  lyrics, makes a line, and everyone votes.
- **Draw-it:** one person draws on the chalkboard while the others guess.
  Good for vocabulary in a language you're learning.

The lowest uid hosts the game state, peer to peer. Only results
("Sam won 7–5") get written to the board.

Built: `lib/games.js` (rules + a per-room game bus: lobby, host handoff to the lowest
player, per-player views so secrets stay on the host) and `hooks/useGame.js`. A
"play together" button shows only in a shared space with someone else online.
  - Built: Flashcard race (`live/FlashRace.jsx`): 5/10/15 cards from the deck, each
    turned over at one shared moment, typed answers, first right one (compared on the
    shared clock within 350 ms) scores, podium at the end.
  - Built: Magnet battle (`live/MagnetBattle.jsx`): 20 private magnets each, make a
    line, anonymous lines, vote, winner pinned on the fridge (`pinned` on the module).
  - Built: Draw it, new module `drawit` (`modules/DrawIt.jsx`): solo it is a saved
    chalkboard; together, one draws and the rest guess, turns rotate. Words come from a
    Flashcards deck (draw the back, guess the front) or a built-in list. Strokes ride the
    "draw" channel and are never saved.
  - Built: only the result is kept, as `games: [{ id, at, text, rows }]` on the module,
    written by the host once per game.

### P7 — Crowds (later)
- **Open house:** a public, view-only board link where any number of people
  watch live cursors, ink and stickers, carried by gossip. Firestore reads
  happen once on load, not per message.
- **Peer image cache:** viewers of the same board hand each other its
  pictures instead of each downloading them from Storage.

## Not peer to peer, same spirit: Board in a link
A read-only snapshot of a board or tab, entirely inside a URL:
- **Format:** the modules as JSON, compressed with `CompressionStream`,
  base64url-encoded after the `#`.
- **No server, no account, never expires.**
- **Left out:** pictures, diaries and PINs.
- **Opening it:** "Open it as a new board" copies it in.
- **Good for** templates ("my practice board setup") and handing someone a
  snapshot.

**Cost:** zero, forever, at any scale.

## Build order
1. Peer bus and same-computer channel, then Board in a link.
2. P1 phone remote. It needs no sharing work, only your own account.
3. P2 ephemeral layer, after sharing M2.
4. P3 pass the tape.
5. P4 together, live.
6. P5 live text.
7. P6 games.
8. P7 crowds.

## Checking it works
- **Same computer:** open a board in two windows. A drag in one shows in the
  other with no network; check with DevTools offline after load.
- **Phone remote:** pair over home wifi, and a phone snap lands on the desktop
  board within about a second. On cellular, it still works or shows the clear
  "couldn't connect directly" message.
- **Ephemeral:** with two Chrome profiles, cursors are smooth, and ink and
  stickers appear on the other screen. Nothing new shows in Firestore.
- **Files:** pass a 5-minute take. The receiver plays it after a reload, and a
  dropped connection resumes from where it stopped.
- **Clock:** two machines' metronome clicks, recorded together, land within
  ~10 ms.
- **Free:** Firebase usage shows only signaling-sized RTDB traffic during a
  10-minute call.
