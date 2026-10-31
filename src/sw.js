// The service worker, built into /sw.js (vite.config.js fills in VERSION and FILES).
// It keeps boards opening with no connection and fetches new versions in the
// background; lib/pwa.js decides when a new version takes over.
// Firestore keeps its own offline copy of the data; this only holds the app itself.

const VERSION = __VERSION__;
// Every file of this build: /index.html, the hashed /assets/…, icons, manifest
const FILES = __FILES__;

const CACHE = "boards-app";
const FONTS = "boards-fonts";
const SHELL = "/index.html";
// What the last version kept, so a tab still on it can load its lazy chunks
const KEPT = "/__kept.json";
const FONT_HOSTS = ["fonts.googleapis.com", "fonts.gstatic.com"];
// Past this, a slow network loses to the copy we have
const PAGE_WAIT = 3500;

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(FILES.map((u) => new Request(u, { cache: "reload" }))))
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    (async () => {
      for (const k of await caches.keys()) if (k !== CACHE && k !== FONTS) await caches.delete(k);
      const c = await caches.open(CACHE);
      const prev = await c.match(KEPT).then((r) => r?.json()).catch(() => null);
      const keep = new Set([...FILES, ...(prev ?? []), KEPT]);
      for (const req of await c.keys()) if (!keep.has(new URL(req.url).pathname)) await c.delete(req);
      await c.put(KEPT, new Response(JSON.stringify(FILES)));
      await self.clients.claim();
    })()
  );
});

self.addEventListener("message", (e) => {
  if (e.data === "skip-waiting") self.skipWaiting();
  if (e.data === "version") e.ports[0]?.postMessage(VERSION);
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET" || req.headers.has("range")) return;
  const url = new URL(req.url);
  if (url.origin === location.origin) {
    if (req.mode === "navigate") return e.respondWith(page(req, e));
    if (url.pathname.startsWith("/assets/")) return e.respondWith(asset(req));
    if (FILES.includes(url.pathname)) return e.respondWith(fresh(req, CACHE, e));
    return; // /api/…, /sw.js and anything else go straight to the network
  }
  if (FONT_HOSTS.includes(url.hostname)) e.respondWith(fresh(req, FONTS, e));
});

// A redirected response can't answer a navigation, so keep a plain copy
const plain = async (res) =>
  res.redirected ? new Response(await res.blob(), { status: res.status, headers: res.headers }) : res;

const isHtml = (res) => res.ok && (res.headers.get("content-type") ?? "").includes("text/html");

// Every address is the same page (the app routes in the browser): the network's
// newest copy when it answers in time, else the one we have
async function page(req, e) {
  const net = fetch(req);
  e.waitUntil(
    net
      .then(async (res) => {
        if (isHtml(res)) await (await caches.open(CACHE)).put(SHELL, await plain(res.clone()));
      })
      .catch(() => {})
  );
  const held = await caches.match(SHELL);
  if (!held) return net;
  const late = new Promise((r) => setTimeout(() => r(held), PAGE_WAIT));
  return Promise.race([net.catch(() => held), late]);
}

// Hashed files never change, so the cached copy is always right. A missing one
// comes back as the app page (_redirects), which mustn't be kept as a script.
async function asset(req) {
  const held = await caches.match(req);
  if (held) return held;
  const res = await fetch(req);
  if (res.ok && !isHtml(res)) {
    const copy = res.clone();
    caches.open(CACHE).then((c) => c.put(req, copy));
  }
  return res;
}

// The copy we have right away, refreshed for next time
async function fresh(req, name, e) {
  const net = fetch(req);
  e.waitUntil(
    net
      .then(async (res) => {
        if (res.ok || res.type === "opaque") await (await caches.open(name)).put(req, res.clone());
      })
      .catch(() => {})
  );
  return (await caches.match(req, { cacheName: name })) ?? net;
}
