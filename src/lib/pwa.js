import { useSyncExternalStore } from "react";

// boards as an app on the home screen: the service worker (src/sw.js) keeps it
// opening offline and fetches new versions in the background. A new version takes
// over on its own only when nothing's in progress (opening the app after being
// away a while); otherwise the person gets a "refresh" toast and can pick the moment.

const AWAY = 30 * 60 * 1000; // hidden this long counts as reopening the app
const CHECK_EVERY = 60 * 60 * 1000;

const standalone = () =>
  window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;

// ready: a newer version is waiting. canInstall: the browser offered an install prompt.
let state = {
  supported: "serviceWorker" in navigator,
  installed: standalone(),
  ios: /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1),
  ready: false,
  canInstall: false,
  checking: false,
};
const listeners = new Set();
const set = (patch) => {
  state = { ...state, ...patch };
  listeners.forEach((fn) => fn());
};
const subscribe = (fn) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};
export const usePwa = () => useSyncExternalStore(subscribe, () => state);

let reg = null;
let installEvent = null;
let reloading = false;
let quiet = false; // this tab let a worker of its own build take over
let hiddenAt = null;

// Ask a worker which build it is
const versionOf = (sw) =>
  new Promise((res) => {
    const ch = new MessageChannel();
    ch.port1.onmessage = (e) => res(e.data);
    sw.postMessage("version", [ch.port2]);
    setTimeout(() => res(null), 2000);
  });

// A worker finished installing behind the current one. If it's this very build (the
// page loaded fresh from the network), it can take over quietly; if it's newer, say so.
async function noticeWaiting() {
  const sw = reg?.waiting;
  if (!sw || !navigator.serviceWorker.controller) return;
  if ((await versionOf(sw)) === __BUILD__) {
    quiet = true;
    return sw.postMessage("skip-waiting");
  }
  set({ ready: true });
  if (hiddenAt == null && document.visibilityState === "visible" && performance.now() < 8000) applyUpdate();
}

export function applyUpdate() {
  reloading = true;
  if (!reg?.waiting) return location.reload();
  reg.waiting.postMessage("skip-waiting");
  setTimeout(() => location.reload(), 3000); // in case the takeover never comes
}

export async function checkForUpdate() {
  if (!reg || state.checking) return state.ready;
  set({ checking: true });
  try {
    await reg.update();
    // update() settles once the new worker is fetched; give it a moment to install
    await new Promise((r) => setTimeout(r, 1500));
    await noticeWaiting();
  } catch { /* offline: try again later */ }
  set({ checking: false });
  return state.ready;
}

export async function promptInstall() {
  if (!installEvent) return;
  installEvent.prompt();
  await installEvent.userChoice.catch(() => null);
  installEvent = null;
  set({ canInstall: false });
}

export function registerPwa() {
  window.addEventListener("beforeinstallprompt", (e) => {
    installEvent = e;
    set({ canInstall: true });
  });
  window.addEventListener("appinstalled", () => set({ installed: true, canInstall: false }));
  window.matchMedia("(display-mode: standalone)").addEventListener?.("change", () => set({ installed: standalone() }));

  // In dev the worker would hold on to stale modules, so it's only for real builds
  if (!state.supported || !import.meta.env.PROD) return;

  // The first worker ever taking over is no news; after that, a takeover this tab didn't
  // ask for means another tab started the new version, so offer it here too
  let controlled = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (reloading) return location.reload();
    if (controlled && !quiet) set({ ready: true });
    controlled = true;
    quiet = false;
  });

  navigator.serviceWorker
    .register("/sw.js")
    .then((r) => {
      reg = r;
      noticeWaiting();
      r.addEventListener("updatefound", () => {
        const sw = r.installing;
        sw?.addEventListener("statechange", () => sw.state === "installed" && noticeWaiting());
      });
    })
    .catch((e) => console.warn("service worker didn't register", e));

  // Phones keep the app open in the background for days, so look again whenever it comes back
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      hiddenAt = Date.now();
      return;
    }
    const away = hiddenAt != null && Date.now() - hiddenAt > AWAY;
    hiddenAt = null;
    if (away && state.ready) return applyUpdate();
    checkForUpdate().then((ready) => away && ready && applyUpdate());
  });
  setInterval(() => document.visibilityState === "visible" && checkForUpdate(), CHECK_EVERY);
}
