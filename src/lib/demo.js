// /demo shows a made-up person's boards, held in memory. Nothing reads or
// writes Firestore, and a reload starts the demo over.
export const DEMO = /^\/demo(\/|$)/.test(window.location.pathname);

const listeners = new Set();
const changed = () => listeners.forEach((fn) => fn());

// entries: id -> entry (with its id), images: id -> { boardId, data }
export const memory = {
  entries: new Map(),
  images: new Map(),
  subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
  setEntry(id, data) {
    this.entries.set(id, { id, ...data });
    changed();
  },
  patchEntry(id, patch) {
    const e = this.entries.get(id);
    if (!e) return;
    this.entries.set(id, { ...e, ...patch });
    changed();
  },
  deleteEntries(match) {
    for (const e of [...this.entries.values()]) {
      if (!match(e)) continue;
      this.entries.delete(e.id);
      if (e.imageId) this.images.delete(e.imageId);
    }
    changed();
  },
};
