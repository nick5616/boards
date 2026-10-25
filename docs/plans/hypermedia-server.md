# Cheap server pieces

> Part of [the plans](README.md). Everything in the other three docs runs on
> today's free Firebase setup. This doc covers the parts that need **Firebase
> Blaze** (pay-as-you-go). They're still cheap, and each section carries its
> cost.

## The decision
**Turn on Blaze, with a budget alert at a few dollars a month.**
- **Why Firebase:** Firestore and Auth already live on Firebase. Blaze adds
  Hosting rewrites, Cloud Functions, Cloud Storage and scheduled jobs in one
  place, and the free-tier allowances still apply on top.
- **The alternative,** Cloudflare (Pages + Workers + R2, with no egress fees),
  is cheaper for heavy downloads at scale. But it splits the app across two
  providers.
- **Revisit** only if Storage egress becomes the biggest line on the bill.

Server code stays small. It only does what a browser can't: get around CORS,
run while nobody's online, send email or push, and relay WebRTC.

## S1 — Hosting + link previews in production
- Move `server/unfurl.js` into a Function behind a Hosting rewrite at
  `/api/unfurl`, so `src/lib/unfurl.js` works unchanged.
- Add a Hosting block to `firebase.json`.
- Cache results in Firestore by URL, so each page is unfurled once for
  everybody.

**Cost:** the Hosting free tier covers the app. Unfurls are ~1 invocation per
new link; within the free 2M invocations/month for a long while.

## S2 — Cloud Storage: the home for heavy bytes
- **Paths:** `users/{uid}/media/{hash}` for private things,
  `spaces/{sid}/media/{hash}` for shared ones.
  - Storage rules mirror the Firestore rules: members read, editors write.
  - Content-addressed names with `Cache-Control: immutable` mean each file is
    downloaded about once per device.
- **What lives there:**
  - tape recorder takes (Opus, ~14 MB/hour)
  - Mirror video takes
  - voice notes on diary pages
  - full-size photos
- **The local shelf** (IndexedDB) becomes a cache in front of Storage.
  - Recording still lands locally first; upload happens in the background,
    plus "sync this take" for anything older.
  - Peers still hand files to each other for free
    ([peer-to-peer.md](peer-to-peer.md) P3), so Storage mostly matters when
    nobody's online at the same time.
- **Existing images move off data URLs in Firestore.** A one-time migration
  uploads each `users/{uid}/images/{id}` and keeps the id. `useImage`
  resolves to a Storage URL. Firestore then holds only references.

**Cost:** about $0.02/GB-month stored, and ~$0.12/GB downloaded, cut by the
immutable caching. A heavy user with 10 hours of takes (~140 MB) costs ≈
$0.003/month to store.

## S3 — Sharing extras
- **Email invites:** "Nicole shared Lyrics with you", and adding someone by
  email. Uses a mail provider's free tier.
- **Push** when a collaborator changes something you care about (rides on S5).
- **Link preview card** for share links pasted into chats: a Function at
  `/s/<token>` serves the page title and picture.
- **Server-side cleanup** when an owner deletes a big shared space, so its
  subcollections don't depend on the owner's tab staying open.

**Cost:** a handful of invocations per share or delete.

## S4 — Price watch
- A scheduled Function re-reads shop clippings once a day and keeps a price
  history on the clipping.
- The clipping draws a sparkline, and a price drop shows on Glance (and as a
  push, S5).
- Wire: price → Graph.

**Cost:** ~1 invocation and 1 fetch per watched clipping per day. Cap it per
user.

## S5 — Reminders & push
- A service worker plus web push (FCM, which is free).
- Pushes for:
  - a ticket about to expire
  - a streak at risk ("haven't touched Spanish in 5 days")
  - a price drop
- The service worker also loads the app shell offline.

**Cost:** FCM is free. One small scheduled Function a day checks what's due.

## S6 — Things only a proxy can do
- **Image proxy** for sites that block hotlinking (clipping pictures that
  vanish). Cached in Storage.
- **"Keep a copy":** a readable text snapshot of a linked page.
- **Transcripts** for YouTube clippings, to turn into flashcards.

**Cost:** per use, cached. Small.

## S7 — Smarter naming (optional)
The server holds an API key and names pasted things from their page content,
not just the title. This is the answer to auto-names that feel generic. It
uses the latest Claude model, called only on paste, and caches by URL.

**Cost:** fractions of a cent per paste. Cap it per user.

## S8 — TURN relay
For the ~1 in 10 connections that can't go direct
([peer-to-peer.md](peer-to-peer.md)). Options are Cloudflare's TURN service
or a small hosted coturn. Hand out short-lived credentials from a Function.

**Cost:** paid per GB relayed, but only for those connections, and only for
live media. File handoffs can wait for Storage instead.

## Suggested order once Blaze is on
S1 → S2 (including moving images) → S3 → S5 → S8 → S4 → S6 → S7.
- S1 and S2 are small, and they finish what the right-away plan started.
- S2's image move is the single biggest cost fix.
