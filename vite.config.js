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

export default defineConfig({
  plugins: [react(), linkPreviews],
});
