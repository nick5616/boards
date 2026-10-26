// The Realtime Database: only for tiny, short-lived things (who's here, and the
// few messages two browsers swap to find each other). Never for content.
// Loaded lazily so boards that never go live don't pay for it.
//
// VITE_RTDB_URL       the database (defaults to the project's default instance)
// VITE_RTDB_EMULATOR  "host:port" to use the local emulator instead (e.g. 127.0.0.1:9000)

import { app, EMULATORS } from "../firebase";

// (under VITE_FIREBASE_EMULATORS the made-up project is "demo-boards", so its database is named to match)
const DEFAULT_URL = EMULATORS
  ? "https://demo-boards-default-rtdb.firebaseio.com"
  : "https://my-boards-app-2026-default-rtdb.firebaseio.com";
export const RTDB_URL = import.meta.env.VITE_RTDB_URL || DEFAULT_URL;
const EMULATOR = import.meta.env.VITE_RTDB_EMULATOR || "";
export const RTDB_EMULATOR = EMULATOR;

let ready = null;
export function rtdb() {
  ready ??= import("firebase/database").then((m) => {
    const db = m.getDatabase(app, RTDB_URL);
    if (EMULATOR) {
      const [host, port] = EMULATOR.split(":");
      m.connectDatabaseEmulator(db, host, +port);
    }
    return { db, ...m };
  });
  return ready;
}
