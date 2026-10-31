import { readFileSync, readdirSync } from "node:fs";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { handle as unfurl } from "./server/unfurl.js";
import { handle as nowPlaying } from "./server/nowplaying.js";

// /api/unfurl reads link previews for Clipping cards. It runs inside the dev
// (and preview) server, on this machine, so links aren't sent to anyone else.
// /api/nowplaying does the same for "what song is this?" on the radio.
const linkPreviews = {
  name: "link-previews",
  configureServer(server) {
    server.middlewares.use("/api/unfurl", unfurl);
    server.middlewares.use("/api/nowplaying", nowPlaying);
  },
  configurePreviewServer(server) {
    server.middlewares.use("/api/unfurl", unfurl);
    server.middlewares.use("/api/nowplaying", nowPlaying);
  },
};

// One id per build, shared by the app (__BUILD__) and its service worker, so the
// app can tell whether a waiting worker is newer than itself (lib/pwa.js)
const BUILD = Date.now().toString(36);

// Builds src/sw.js into /sw.js with the list of this build's files to keep offline
const serviceWorker = {
  name: "service-worker",
  apply: "build",
  enforce: "post",
  generateBundle(_, bundle) {
    const publicFiles = readdirSync("public").filter((f) => !f.startsWith("_"));
    const files = [...new Set(["index.html", ...Object.keys(bundle), ...publicFiles])]
      .filter((f) => !f.endsWith(".map"))
      .map((f) => `/${f}`);
    this.emitFile({
      type: "asset",
      fileName: "sw.js",
      source: readFileSync("src/sw.js", "utf8")
        .replace("__VERSION__", JSON.stringify(BUILD))
        .replace("__FILES__", JSON.stringify(files)),
    });
  },
};

export default defineConfig({
  plugins: [react(), linkPreviews, serviceWorker],
  define: { __BUILD__: JSON.stringify(BUILD) },
});
