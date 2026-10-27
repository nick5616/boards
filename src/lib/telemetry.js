// What went wrong, and how the outside APIs are behaving, kept on this computer only.
// Nothing is sent anywhere: Settings → Diagnostics reads it, and "copy report" puts a
// summary on the clipboard to paste into a bug report or a chat.
//
// It watches three things:
//   - every request to another site (the free APIs), timed, through a fetch wrapper
//   - uncaught errors and rejected promises
//   - modules that crash (ModuleCatch reports them)
// Events go in a ring buffer in localStorage, so a reload doesn't lose them.
import { useEffect, useState } from "react";

const KEY = "boards-diag";
const MAX = 400;
const CHANGED = "boards-diag-changed";
// Our own backend isn't "an API" here: it has its own console
const OURS = /(^|\.)(googleapis\.com|firebaseio\.com|firebaseapp\.com|gstatic\.com|google\.com)$/;

let events = null;
const load = () => {
  if (events) return events;
  try { events = JSON.parse(localStorage.getItem(KEY) || "[]"); } catch { events = []; }
  return events;
};
let saveT = null;
const save = () => {
  clearTimeout(saveT);
  saveT = setTimeout(() => {
    try { localStorage.setItem(KEY, JSON.stringify(events.slice(-MAX))); } catch { /* full: keep it in memory */ }
    window.dispatchEvent(new Event(CHANGED));
  }, 400);
};

// kind: "api" | "error" | "crash" | "note"; data is small and plain
export function record(kind, data = {}) {
  load().push({ kind, at: Date.now(), ...data });
  if (events.length > MAX * 1.25) events = events.slice(-MAX);
  save();
}

export const diagEvents = () => load().slice();
export function clearDiag() {
  events = [];
  try { localStorage.removeItem(KEY); } catch { /* fine */ }
  window.dispatchEvent(new Event(CHANGED));
}

// ── Watching ────────────────────────────────────────────────────────────────
let installed = false;
export function installTelemetry() {
  if (installed || typeof window === "undefined") return;
  installed = true;

  const real = window.fetch.bind(window);
  window.fetch = async (input, init) => {
    let url;
    try { url = new URL(typeof input === "string" ? input : input.url, location.href); } catch { return real(input, init); }
    if (url.origin === location.origin || OURS.test(url.hostname)) return real(input, init);
    const t0 = performance.now();
    const base = { host: url.hostname, path: url.pathname.slice(0, 60) };
    try {
      const res = await real(input, init);
      record("api", { ...base, status: res.status, ms: Math.round(performance.now() - t0) });
      return res;
    } catch (err) {
      // a CORS refusal and being offline look the same from here
      record("api", { ...base, status: 0, ms: Math.round(performance.now() - t0), err: navigator.onLine ? "blocked or unreachable (CORS?)" : "offline" });
      throw err;
    }
  };

  window.addEventListener("error", (e) => {
    if (!e.message) return; // a broken <img> etc.
    record("error", { msg: String(e.message).slice(0, 300), where: `${(e.filename || "").split("/").pop()}:${e.lineno}` });
  });
  window.addEventListener("unhandledrejection", (e) => {
    const r = e.reason;
    record("error", { msg: String(r?.message ?? r).slice(0, 300), where: "promise" });
  });
}

// ── Reading ─────────────────────────────────────────────────────────────────
const median = (xs) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
};

// Per API host: how often, how slow, how often it failed, and the last thing that went wrong
export function apiSummary(evts = diagEvents()) {
  const by = new Map();
  for (const e of evts) {
    if (e.kind !== "api") continue;
    const h = by.get(e.host) ?? { host: e.host, calls: 0, fails: 0, ms: [], last: null, lastFail: null };
    h.calls++;
    h.ms.push(e.ms);
    const bad = !e.status || e.status >= 400;
    if (bad) { h.fails++; h.lastFail = e; }
    h.last = e;
    by.set(e.host, h);
  }
  return [...by.values()]
    .map((h) => ({ ...h, median: median(h.ms), ms: undefined }))
    .sort((a, b) => b.fails - a.fails || b.calls - a.calls);
}

export const problems = (evts = diagEvents()) =>
  evts.filter((e) => e.kind === "error" || e.kind === "crash" || (e.kind === "api" && (!e.status || e.status >= 400))).reverse();

// A short plain-text report to paste somewhere
export function diagReport() {
  const evts = diagEvents();
  const lines = [`boards diagnostics · ${new Date().toISOString()} · ${navigator.userAgent}`, "", "APIs (calls · failed · median ms · last problem):"];
  for (const h of apiSummary(evts)) {
    lines.push(`  ${h.host}: ${h.calls} · ${h.fails} · ${h.median ?? "-"}ms${h.lastFail ? ` · ${h.lastFail.status || h.lastFail.err} ${h.lastFail.path}` : ""}`);
  }
  lines.push("", "Recent problems:");
  for (const e of problems(evts).slice(0, 30)) {
    const when = new Date(e.at).toLocaleString();
    if (e.kind === "api") lines.push(`  ${when} api ${e.host}${e.path} → ${e.status || e.err}`);
    else if (e.kind === "crash") lines.push(`  ${when} module ${e.type} crashed: ${e.msg}`);
    else lines.push(`  ${when} error ${e.msg} (${e.where})`);
  }
  return lines.join("\n");
}

// Re-renders when anything new is recorded
export function useDiag() {
  const [, bump] = useState(0);
  useEffect(() => {
    const on = () => bump((n) => n + 1);
    window.addEventListener(CHANGED, on);
    return () => window.removeEventListener(CHANGED, on);
  }, []);
  return diagEvents();
}
