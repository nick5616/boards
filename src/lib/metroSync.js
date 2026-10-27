// A metronome that clicks together. In a shared space every metronome that is running gets
// an `anchor` in its state: the moment (on the room's shared clock, see clock() in peers.js)
// of a downbeat. Every beat after it is anchor + n * (60000 / bpm), so everyone books their
// clicks at the same moments without talking to each other. When tempo, meter or start/stop
// changes, the change also goes over the peer bus ("metro") so it lands before the database
// catches up; the database copy is the record, the bus copy is just faster.
//
// Together registers the room for a board (registerSync); the metronome code asks syncOf().

const syncs = new Map(); // boardId → { room, clk }
const over = new Map(); // modId → { p, at }: changes heard on the bus, ahead of the database

const OVER_MS = 4000; // after this the module's own state is the truth again
const LEAD = 200; // a start lands this far ahead, so every screen has time to hear it

export function registerSync(boardId, sync) {
  syncs.set(boardId, sync);
  return () => syncs.get(boardId) === sync && syncs.delete(boardId);
}
export const syncOf = (boardId) => syncs.get(boardId) ?? null;

// The room's time, or this computer's when there's no room
export const sharedNow = (boardId) => syncs.get(boardId)?.clk.now() ?? Date.now();

// Who else is in step with me on this board (peer ids), once the clock has settled
export function inStep(boardId) {
  const s = syncs.get(boardId);
  return s && s.clk.ready ? [...s.room.peers] : [];
}

// Is this browser the one that steers shared things (the speed trainer)? Lowest peer id.
const leads = (room) => [room.self, ...room.peers].filter(Boolean).sort()[0] === room.self;

export function hear(modId, p) {
  over.set(modId, { p, at: Date.now() });
}

// A module's state with whatever the bus has said lately laid over it. null = stopped.
export function overlay(modId, state) {
  const o = over.get(modId);
  if (!o || !state) return state;
  if (Date.now() - o.at > OVER_MS) {
    over.delete(modId);
    return state;
  }
  return o.p.startedAt === null ? null : { ...state, ...o.p };
}

// Shared-clock time of the first beat on this state's grid at or after `t`
export function beatAfter(s, t) {
  if (typeof s.anchor !== "number") return t;
  const per = 60000 / s.bpm;
  return s.anchor + Math.max(0, Math.ceil((t - s.anchor) / per)) * per;
}

const TIMING = ["bpm", "beats", "startedAt"]; // changes that move the grid
const SOUND = ["sub", "accent"]; // changes everyone should hear at once, grid untouched

// Turn a change to a metronome's state into one that keeps everyone on the same grid, and
// tell the room. `s` is the state before; `patch` what's changing. With nobody to be in
// step with (not a shared board) the patch comes back as it was.
export function retime(boardId, modId, s, patch) {
  const sy = syncs.get(boardId);
  if (!sy) return patch;
  const out = { ...patch };
  if (TIMING.some((k) => k in patch)) {
    const now = sy.clk.now();
    if (patch.startedAt) out.anchor = now + LEAD;
    else if (patch.startedAt === null) out.anchor = null;
    else if (s.startedAt) out.anchor = beatAfter(s, now + 120); // a new tempo starts on the next beat
  } else if (!SOUND.some((k) => k in patch)) return patch;
  const say = { ...out };
  if (patch.startedAt) say.startedAt = patch.startedAt;
  sy.room.send("metro", { mid: modId, p: say });
  return out;
}

// The speed trainer nudges the tempo; in a shared space only one browser does it
export const mayTrain = (boardId) => {
  const sy = syncs.get(boardId);
  return !sy || leads(sy.room);
};

// Listen for the room's metronome changes
export function listen(room) {
  return room.on("metro", (m) => m?.mid && m.p && hear(m.mid, m.p));
}
