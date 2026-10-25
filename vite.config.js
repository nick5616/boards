import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { handle as unfurl } from "./server/unfurl.js";

// /api/unfurl reads link previews for Clipping cards. It runs inside the dev
// (and preview) server, on this machine, so links aren't sent to anyone else.
const linkPreviews = {
  name: "link-previews",
  configureServer(server) {
    server.middlewares.use("/api/unfurl", unfurl);
  },
  configurePreviewServer(server) {
    server.middlewares.use("/api/unfurl", unfurl);
  },
};

export default defineConfig({
  plugins: [react(), linkPreviews],
});
