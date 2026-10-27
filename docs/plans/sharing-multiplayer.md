# Sharing & multiplayer — spec

> Part of [the plans](README.md). This doc runs entirely on the free Firebase
> plan: Firestore, security rules, Auth (Google and anonymous) and Realtime
> Database. Live cursors, typing and live text go peer to peer
> ([peer-to-peer.md](peer-to-peer.md)). Email, push and shared recordings are
> the cheap server pieces in [hypermedia-server.md](hypermedia-server.md).

Share a whole board, a tab on a board, or a tab inside a File folders module
with other people, and work on it together, live.

## What can be shared
- **A board:** everything on it, its tabs and its folders.
- **A board tab:** one surface and what's on it, folders included.
- **A folder tab:** one tab of a File folders module. As now, it can't hold
  folders.

Single modules aren't shared on their own: put the module in a tab and share
the tab.

## How it feels

### Sharing
The board ⋯ menu, or right-clicking a tab, offers **Share…**, which opens a
sheet with:
- two links, "can edit" and "can look"; each can be copied, or revoked and
  made fresh
- the faces of everyone who has it, with their role, and a way to remove a
  person
- **Stop sharing**: the tab or board becomes plain again, and everyone else
  loses it
- a warning if it holds a Diary: "Sam will be able to read this diary."

### Opening a link (`/s/<token>`)
- **Edit link:** sign in with Google, and it opens.
- **View link:** it opens right away, with no account (anonymous sign-in). A
  quiet "sign in to keep this" upgrades the same person to Google without
  losing anything.
- **Where it lands:** the home **Shared with me** shelf. **Tuck into a
  board…** also puts it in one of your boards, as a tab with a little "shared"
  ribbon. It's the same live thing either way.

### Together
- Faces of who's here appear on the board header and on each tab.
- **Live cursors** show on the desktop canvas, each with a name tag in that
  person's color. They go peer to peer
  ([peer-to-peer.md](peer-to-peer.md) P2).
- A module someone is working in gets an outline in their color.
- A text block someone is typing in shows "Sam is writing…" and is read-only
  for others until 3s after their last keystroke. This soft lock lasts only
  until live text merging ([peer-to-peer.md](peer-to-peer.md) P5) replaces it.
- What people log carries who did it:
  - the sticker chart shows each person's stickers in their color
  - jar drops, tallies and sticky notes get a tiny face
- Soft, batched toasts: "Sam added 3 sticky notes to Lyrics".
- **Viewers** see everything move live, but nothing edits for them: no tray,
  no drag, read-only fields. Links still open and players still play.

## Data model
Every board becomes a **space**, the shareable unit:
- A private board is just a space with one member.
- A shared tab is a space of its own, which a board tab or folder tab
  **mounts**.

That gives one code path for everything.

    spaces/{sid}                 owner, kind: "board" | "tab", title, color, icon,
                                 status, tabs (board kind), createdAt, updatedAt
    spaces/{sid}/members/{uid}   uid, role: "owner" | "edit" | "view",
                                 name, photo, color, via (invite token), joinedAt
    spaces/{sid}/modules/{mid}   the module exactly as today (type, title, x, y,
                                 w, h, rot, z, parent, tab, state, …)
                                 + updatedAt, updatedBy
    spaces/{sid}/entries/{eid}   the entry as today + by (uid)
    spaces/{sid}/images/{iid}    data, at, by        (until images move to Cloud Storage)
    invites/{token}              space, role: "edit" | "view", by, createdAt, revoked
    users/{uid}/mounts/{sid}     where: "home" | { board: sid, parent: mid | null, tab: tid },
                                 order, addedAt — the list of what's in my world

- **Mounts:** a mount is a tab whose content comes from another space,
  `{ id, name, mount: sid }`, in `board.tabs` or a folder's `state.tabs`.
  - `Space.jsx` sees `tab.mount` and renders that space's modules, writing
    through that space.
  - The Window module ([hypermedia-now.md](hypermedia-now.md) 5.3) is the same
    idea for a single module.
- **Ids:** boards keep their ids as space ids, so deep links and entry
  `boardId`s still line up.

## Writing without clobbering
The board shape the UI uses doesn't change. `useSpaces` assembles
`{ id, …spaceFields, modules: [...] }` for each space.

**`updateBoard(id, fn)` keeps its signature.** It diffs before and after, and
writes only what changed:
- **Board fields** (title, tabs, status): `updateDoc` on the space, by field
  path.
- **Changed modules:** a write per module.
- **Bulk changes** (arrange, move, remove): one `writeBatch`, chunked with
  `commitInChunks`.
- **`setState(fn)` in a space with more than one member** runs in
  `runTransaction`: read the latest module doc, apply `fn`, write. The
  existing functional updaters (`setState((st) => …)`) fit this as they are.
  Solo spaces keep the instant write.
- **Debounced typing:** the "local copy wins while a write is pending" rule now
  applies to **one module**, not the whole board.
- **Text:** last writer wins per block, softened by the soft lock, until P5's
  merging arrives.

**Cost:** per-module writes are smaller and fewer than today's whole-board
rewrites. A busy shared session is ~1 write per meaningful change. Cursors
and typing don't touch Firestore at all.

## Presence (Realtime Database, free on Spark)
    presence/{sid}/{uid}: { name, color, tab, at }        — just "who's here", for faces
    signal/{room}/{to}/{from}: …                          — WebRTC handshakes (peer-to-peer.md)
    access/{sid}/{uid}: { role, secret }                  — mirror of membership for RTDB rules
    keys/{sid}: { owner, secret }                         — the room secret, written once, never readable

- `onDisconnect().remove()` clears a person's presence when they leave.
- Cursors, focus outlines and typing go over the peer bus, not RTDB.
- **Rules:** RTDB rules can't read Firestore, so the client writes
  `access/{sid}/{uid}` when someone joins. Presence and signal rows are then
  readable and writable only by people in `access/{sid}`.
- **Self-asserted, but with a key:** the row must carry the space's
  `roomSecret` (on the Firestore space doc, so members only; the owner makes it
  when first sharing and claims it in `keys/{sid}`, first writer wins). Knowing
  a space id alone no longer lets a stranger see faces and cursors. Residual
  risk: someone who was a member keeps the secret after being removed, and can
  still see faces and cursors (never content) until rotation is built.

**Cost:** one tiny presence row per open tab. It's well inside the free tier
(100 simultaneous connections on Spark; ~$5 per 200k connections on Blaze).

## Rules (Firestore, sketch)
    function me()          { return request.auth.uid; }
    function memberRow(s)  { return /databases/$(database)/documents/spaces/$(s)/members/$(me()); }
    function isMember(s)   { return request.auth != null && exists(memberRow(s)); }
    function role(s)       { return get(memberRow(s)).data.role; }
    function canEdit(s)    { return isMember(s) && role(s) in ["owner", "edit"]; }
    function isOwner(s)    { return isMember(s) && role(s) == "owner"; }

    match /spaces/{s} {
      allow read:   if isMember(s);
      allow create: if request.resource.data.owner == me();
      allow update: if canEdit(s) && request.resource.data.owner == resource.data.owner;
      allow delete: if isOwner(s);
      match /members/{u} {
        allow read: if isMember(s);
        // the owner's own row, created in the same batch as the space (getAfter),
        // or a joiner's own row backed by a live invite with the same role
        allow create: if u == me() && (
          (getAfter(/databases/$(database)/documents/spaces/$(s)).data.owner == me()
            && request.resource.data.role == "owner")
          || (get(/databases/$(database)/documents/invites/$(request.resource.data.via)).data.space == s
            && !get(/databases/$(database)/documents/invites/$(request.resource.data.via)).data.revoked
            && request.resource.data.role
               == get(/databases/$(database)/documents/invites/$(request.resource.data.via)).data.role));
        allow update: if u == me() && request.resource.data.role == resource.data.role;
        allow delete: if u == me() || isOwner(s);
      }
      match /modules/{m} { allow read: if isMember(s); allow write: if canEdit(s); }
      match /entries/{e} { allow read: if isMember(s); allow write: if canEdit(s); }
      match /images/{i}  { allow read: if isMember(s); allow write: if canEdit(s); }
    }
    match /invites/{t} {
      allow get: if request.auth != null;   // knowing the token is the key; no listing
      allow create: if isOwner(request.resource.data.space);
      allow update, delete: if isOwner(resource.data.space);
    }
    match /users/{uid}/{document=**} { allow read, write: if me() == uid; }   // mounts, meta, old backup
    match /{path=**}/entries/{e} { allow read: if resource.data.by == me(); } // home "my practice" dots

The home screen's "my practice" dots come from a collection-group query on
`entries` where `by == me` and `at >= 21 days ago`. It needs a
collection-group index in `firestore.indexes.json`.

## Migration (v3, in `lib/migrate.js`)
For each `users/{uid}/boards/{bid}`:
1. Create `spaces/{bid}`, its owner row, and one `modules/{mid}` doc per
   module.
2. Copy that board's entries into the space, adding `by: uid`.
3. Write `users/{uid}/mounts/{bid}` with `where: "home"`.

Then mark `meta` v3. The old docs stay untouched as a backup, as in the last
migration. Writes are batched through `commitInChunks`, and the whole thing is
safe to re-run if interrupted.

**Deploy the new rules and indexes before turning the client on.** While M1 is
being built it sits behind `VITE_SPACES=1`.

## Local-only and heavy things in shared spaces
Tape recorder takes live on the recorder's computer (local shelf). Others see
the cassette as "Nicole's tape". There are two ways it reaches them:
- **Peer to peer:** while both people are online, the take is handed over
  directly. It's free ([peer-to-peer.md](peer-to-peer.md) P3).
- **Cloud Storage:** for when nobody's online at the same time
  ([hypermedia-server.md](hypermedia-server.md) S2).

## Code map
- **Firebase setup**
  - `src/firebase.js`: add Realtime Database and anonymous auth.
  - `src/lib/data.js`: path helpers per space (`spaceDoc`, `modulesCol(sid)`,
    entries, images, members, invites, `mountsCol(uid)`). `addEntry`,
    `saveImage` and `loadImage` take a space and stamp `by`.
- **Hooks**
  - `src/hooks/useSpaces.js`: listens to mounts, then to each space doc and
    its modules. Returns the same shape as `useBoards` (`boards`,
    `updateBoard`, `createBoard`, `deleteBoard`), plus `shared`.
  - `src/hooks/useEntries.js`: space paths, and the collection-group query
    for recent entries.
  - `src/hooks/useAuth.js`: `signInAnonymously` for view links,
    `linkWithPopup` to upgrade.
- **Routing:** `src/lib/routes.js` and `App.jsx` handle the `/s/<token>` join
  flow.
- **New UI**
  - `src/components/share/ShareSheet.jsx`, `JoinScreen.jsx`, `Faces.jsx`
  - `src/lib/presence.js` and `src/hooks/usePresence.js`
- **Changed UI**
  - `TabStrip.jsx`: shared ribbon, faces, Share… and Tuck into a board…
  - `Space.jsx`: renders `tab.mount`
  - `ModuleFrame.jsx`: focus outline
  - `AutoTA.jsx`: soft lock, and read-only for viewers
  - `Glance.jsx` / `Tiles.jsx`: the Shared with me shelf
- **Viewers:** `BoardContext` gets `role`.
  - `setState` and `onPatch` become no-ops with a "view only" toast.
  - The tray and dragging are off.
  - `AutoTA` is read-only.
- **Config files:** `firestore.rules`, `firestore.indexes.json`,
  `database.rules.json`, `firebase.json`.
- **Console (manual, free):** turn on the Anonymous provider and Realtime
  Database.
- **Demo:** `src/lib/demo.js` and `demoSeed.js` include one fake shared tab
  with a second person.

## Build order
- **M1 Data layer:** spaces, one doc per module, migration. Solo use looks
  exactly the same.
- **M2 Share a board:** invites (edit and view), join links, anonymous
  viewers, the Shared with me shelf, remove a person, stop sharing.
- **M3 Share a tab:** board tabs and folder tabs become their own spaces when
  shared; mounts; Tuck into a board…; stop sharing copies the modules back.
- **M4 Presence:** faces from RTDB. Cursors, focus outlines and typing come
  over the peer bus ([peer-to-peer.md](peer-to-peer.md) P2).
- **M5 Together touches:** `by` colors on stickers, logs and notes; activity
  toasts.

## Checking it works
- **Rules tests:** `@firebase/rules-unit-testing` against the local Firestore
  emulator (`npm run test:rules`). Owner, editor, viewer and stranger each
  try to read and write:
  - a space, its modules and its entries
  - members: self-join with a good invite, a revoked one and a wrong-role one
  - invites
- **M1:** after migrating, every board, tab, folder, diary, scrapbook photo
  and log is still there. Firestore shows `spaces/*` with module docs, and the
  old `users/{uid}/boards` docs are untouched.
- **Two people:** two Chrome profiles signed in as two Google accounts.
  - Both add sticky notes to the same Next up at the same time; nothing is
    lost.
  - Each drags a different module at the same time; both moves stick.
  - Faces appear, and disappear when a window closes.
- **View link:** in an incognito window it opens without an account, updates
  live, and nothing edits. "Sign in to keep this" keeps it on the shelf.
- **Tab share:** share a folder tab and tuck it into the friend's board.
  - Edits show on both sides.
  - After stop sharing, the friend's tab says it's gone, and the owner still
    has everything.
