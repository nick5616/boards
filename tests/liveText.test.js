// Live text: merging, caret shifting, and who saves. No browser or emulator needed: `npx vitest run tests/liveText.test.js`
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { liveText, diffText, shiftPos, pickWriter, WAIT_SYNC, QUIET } from "../src/lib/liveText.js";

// A tiny in-memory room, so the peers can talk without a browser
function bus() {
  const rooms = [];
  const make = (self) => {
    const r = {
      self,
      peers: new Set(),
      fns: new Map(),
      peerFns: new Set(),
      on(ch, fn) {
        if (!r.fns.has(ch)) r.fns.set(ch, new Set());
        r.fns.get(ch).add(fn);
        return () => r.fns.get(ch).delete(fn);
      },
      onPeer(fn) {
        r.peerFns.add(fn);
        return () => r.peerFns.delete(fn);
      },
      send(ch, msg, to) {
        const copy = JSON.parse(JSON.stringify(msg));
        const dest = to == null ? [...r.peers] : Array.isArray(to) ? to : [to];
        for (const id of dest) {
          const other = rooms.find((x) => x.self === id);
          if (other && !r.held?.(id)) for (const fn of other.fns.get(ch) ?? []) fn(copy, self);
        }
        return Promise.resolve();
      },
      leave() {
        rooms.splice(rooms.indexOf(r), 1);
        for (const o of rooms) {
          o.peers.delete(self);
          for (const fn of o.peerFns) fn(self, false);
        }
      },
    };
    for (const o of rooms) {
      o.peers.add(self);
      r.peers.add(o.self);
    }
    rooms.push(r);
    return r;
  };
  return make;
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("diffText", () => {
  it("finds the one edit", () => {
    expect(diffText("hello world", "hello brave world")).toEqual({ at: 6, del: 0, ins: "brave " });
    expect(diffText("hello world", "hello")).toEqual({ at: 5, del: 6, ins: "" });
    expect(diffText("abc", "axc")).toEqual({ at: 1, del: 1, ins: "x" });
    expect(diffText("same", "same")).toEqual({ at: 4, del: 0, ins: "" });
  });
  it("applies back to the new text", () => {
    for (const [a, b] of [["aaa", "aa"], ["abcabc", "abcXabc"], ["", "hi"], ["hi", ""], ["a😀b", "a😁b"]]) {
      const { at, del, ins } = diffText(a, b);
      expect(a.slice(0, at) + ins + a.slice(at + del)).toBe(b);
    }
  });
});

describe("shiftPos", () => {
  it("moves a caret past text put in before it", () => {
    expect(shiftPos(5, [{ insert: "abc" }, { retain: 9 }])).toBe(8);
  });
  it("leaves it when the edit is after", () => {
    expect(shiftPos(5, [{ retain: 6 }, { insert: "abc" }])).toBe(5);
  });
  it("stays put for text typed right at the caret", () => {
    expect(shiftPos(5, [{ retain: 5 }, { insert: "abc" }])).toBe(5);
  });
  it("pulls back for deletes before it, and clamps inside one", () => {
    expect(shiftPos(10, [{ retain: 2 }, { delete: 3 }])).toBe(7);
    expect(shiftPos(5, [{ retain: 3 }, { delete: 6 }])).toBe(3);
  });
});

describe("pickWriter", () => {
  it("is the lowest uid", () => {
    expect(pickWriter(["sam", "ann", "zed"])).toBe("ann");
    expect(pickWriter([])).toBe(null);
  });
});

describe("two people in one note", () => {
  const setup = (text = "hello world") => {
    const make = bus();
    const ra = make("ann-1");
    const rb = make("bob-1");
    const saved = { ann: [], bob: [] };
    const opts = (me, log) => ({ initial: text, myUid: me, uidOf: (p) => p.slice(0, p.lastIndexOf("-")), onPersist: (t) => log.push(t) });
    const a = liveText(ra, "m1:0", opts("ann", saved.ann));
    const b = liveText(rb, "m1:0", opts("bob", saved.bob));
    vi.advanceTimersByTime(WAIT_SYNC + 10); // nobody has it: both start from Firestore's text
    return { a, b, ra, rb, saved, make, opts };
  };

  it("starts both from the same text without doubling it", () => {
    const { a, b } = setup("hello world");
    expect(a.text()).toBe("hello world");
    expect(b.text()).toBe("hello world");
  });

  it("merges edits in different places", () => {
    const { a, b } = setup("hello world");
    a.set("hello big world"); // ann, in the middle
    b.set(b.text() + "!"); // bob, at the end (his box already shows ann's word)
    expect(a.text()).toBe("hello big world!");
    expect(b.text()).toBe("hello big world!");
  });

  it("merges when updates cross in flight", () => {
    const { a, b, ra, rb } = setup("one two");
    const held = [];
    ra.held = () => true; // ann's messages are held back
    rb.held = () => true;
    a.set("ONE two");
    b.set("one TWO");
    delete ra.held;
    delete rb.held;
    // Replay by hand: ask for each other's state, the way a reconnect would
    ra.send("text", { key: "m1:0", k: "want", sv: "AA==" });
    rb.send("text", { key: "m1:0", k: "want", sv: "AA==" });
    expect(a.text()).toBe("ONE TWO");
    expect(b.text()).toBe("ONE TWO");
  });

  it("tells the textarea what changed so the caret can follow", () => {
    const { a, b } = setup("hello world");
    const seen = [];
    b.onRemote((e) => seen.push(e));
    a.set("well hello world");
    expect(seen).toHaveLength(1);
    expect(seen[0].text).toBe("well hello world");
    expect(shiftPos(7, seen[0].delta)).toBe(12); // bob's caret was after "hello"
  });

  it("does not echo a remote edit back out", () => {
    const { a, b, ra } = setup("x");
    const sent = vi.spyOn(ra, "send");
    b.set("xy");
    expect(a.text()).toBe("xy");
    expect(sent).not.toHaveBeenCalled();
  });

  it("only the lowest uid among the editors saves", () => {
    const { a, b, saved } = setup("hello");
    a.set("hello there");
    b.set("hello there, you");
    vi.advanceTimersByTime(QUIET + 50);
    expect(saved.ann).toEqual(["hello there, you"]);
    expect(saved.bob).toEqual([]);
  });

  it("a lone typist saves for themselves, even if someone with a lower uid is just watching", () => {
    const { b, saved } = setup("hello"); // ann is here but not typing
    b.set("hello!");
    vi.advanceTimersByTime(QUIET + 50);
    expect(saved.bob).toEqual(["hello!"]);
    expect(saved.ann).toEqual([]);
  });

  it("saves once while typing never stops, not on every key", () => {
    const { a, saved } = setup("");
    for (let i = 1; i <= 10; i++) {
      a.set("x".repeat(i));
      vi.advanceTimersByTime(300);
    }
    vi.advanceTimersByTime(QUIET + 50);
    expect(saved.ann.length).toBeLessThanOrEqual(3);
    expect(saved.ann.at(-1)).toBe("x".repeat(10));
  });

  it("when the saver leaves, the other one saves", () => {
    const { a, b, ra, saved } = setup("hi");
    a.set("hi a");
    b.set("hi a b");
    a.destroy(); // ann saves on her way out
    ra.leave();
    vi.advanceTimersByTime(QUIET + 50);
    expect(saved.ann.at(-1)).toBe("hi a b");
    expect(b.text()).toBe("hi a b");
    vi.advanceTimersByTime(QUIET + 50);
    // bob is now the only editor: his copy matches what ann saved, so nothing more is needed
    expect(saved.bob.length).toBeLessThanOrEqual(1);
  });

  it("a late joiner takes the peers' text, not Firestore's older one", () => {
    const { a, make, opts } = setup("v1");
    a.set("v1 and then some");
    const rc = make("cat-1");
    const log = [];
    const c = liveText(rc, "m1:0", { ...opts("cat", log), initial: "v1" });
    expect(c.text()).toBe("v1 and then some");
    vi.advanceTimersByTime(WAIT_SYNC + 10);
    expect(c.text()).toBe("v1 and then some"); // never seeded on top
  });

  it("keeps notes apart by key", () => {
    const { a, ra } = setup("one");
    const make = bus();
    void make;
    const other = liveText(ra, "m1:1", { initial: "two", myUid: "ann", uidOf: (p) => p.slice(0, p.lastIndexOf("-")) });
    vi.advanceTimersByTime(WAIT_SYNC + 10);
    a.set("one!");
    expect(other.text()).toBe("two");
  });
});
