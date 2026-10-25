# Plans

Four plans for what boards becomes after v1:

| Doc | What | Needs |
|---|---|---|
| [hypermedia-now.md](hypermedia-now.md) | Modules that use everything a browser can do: sound, mic, MIDI, speech, camera, links between things | nothing new (free Firebase) |
| [sharing-multiplayer.md](sharing-multiplayer.md) | Share a board, a tab, or a folder tab; work on it together | nothing new (free Firebase + Realtime Database) |
| [peer-to-peer.md](peer-to-peer.md) | Live, heavy, ephemeral things that go straight between browsers | nothing new (signaling rides on Realtime Database) |
| [hypermedia-server.md](hypermedia-server.md) | The cheap server pieces: Cloud Storage, Functions, push, relay | turning on Blaze |

Desktop first (Chrome/Edge). Phones get a reduced version of each thing.

## Cost principle

The goal is a product that scales and is cheap to run. The work scales with
the clients, and the bill doesn't.

1. **The browser does the work.** Audio, pitch detection, encoding, image
   resizing, layout, search and text merging all run on people's own
   machines. That's free and unlimited.
2. **Live and heavy go peer to peer.** Calls, cursors, file handoff and games
   go browser to browser. They're free, and capacity grows with the number of
   people.
3. **Bytes that must last go to Cloud Storage, not Firestore.**
   - Storage costs about $0.02/GB-month at rest, roughly 1/9 of Firestore's
     ~$0.18.
   - Content-addressed ids with `Cache-Control: immutable` mean each file is
     downloaded about once per device.
   - Encode small in the browser first: Opus voice at about 32 kbps
     (≈ 14 MB per hour), JPEG/WebP photos.
4. **Firestore holds only small structured state.** Writes are per-module and
   debounced, so a move doesn't rewrite the whole board, and listeners stay
   narrow.
5. **Server code only where a browser can't do it:** link previews (CORS),
   push, scheduled jobs, email and a TURN relay. Each one is small, cached,
   and sits behind a budget alert.
6. **Every feature gets a cost line** ("what it costs at 1k / 100k users"),
   so expensive ideas show up early.

Today's images are data URLs inside Firestore docs, which breaks rule 3.
[hypermedia-server.md](hypermedia-server.md) S2 moves them to Cloud Storage.
