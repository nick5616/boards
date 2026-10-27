import { useState, useEffect, useRef } from "react";

// Watch together: a clipping's YouTube video plays in step on every screen in a shared space.
// Everyone streams from YouTube themselves; only little control messages cross the peer bus
// ("watch": play, pause, seek, plus a heartbeat from whoever last touched it). Every message
// carries the video position and the shared-clock moment it was true, so a late one still
// lands in the right place. We drift-correct to within half a second.
// See docs/plans/peer-to-peer.md P4. YouTube only for now: Vimeo and SoundCloud ship
// their own player scripts, and Spotify embeds have no player API.

let api = null;
function loadYT() {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  return (api ??= new Promise((resolve, reject) => {
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prev?.();
      resolve(window.YT);
    };
    const s = Object.assign(document.createElement("script"), { src: "https://www.youtube.com/iframe_api" });
    s.onerror = () => {
      api = null;
      reject(new Error("couldn't load the YouTube player"));
    };
    document.head.append(s);
  }));
}

const DRIFT = 0.5; // seconds apart before we nudge someone's playhead
const JUMP = 1.5; // a playhead that moves this far by itself was scrubbed
const BEAT = 4000; // the one who last touched it says where it is this often
const QUIET = 900; // after we obey a message, ignore the player's echo of it

// mod: the clipping's module id; t: useTogether(); frame: ref to the element holding the
// iframe; enabled: the clip is a YouTube video in a shared space; shown: the iframe is up;
// show(): put it up; src: the iframe's address (a new video starts a new player)
// → { on, setOn, invite }: invite is the peer who's watching while I'm not (or null)
export function useWatch({ mod, t, frame, enabled, shown, show, src }) {
  const [on, setOn] = useState(false);
  const [invite, setInvite] = useState(null);
  const room = enabled ? t?.room : null;
  const clk = t?.clk;
  const c = useRef({ on: false, player: null, quiet: 0, lead: false, pos: 0, at: 0, pending: null });
  const latest = useRef({});
  latest.current = { show, shown, clk };

  const say = (m, to) => room?.send("watch", { mid: mod, ...m }, to);
  const stateOf = () => {
    const p = c.current.player;
    return { k: "state", playing: p.getPlayerState() === 1, p: p.getCurrentTime(), t: latest.current.clk.now() };
  };

  // Do what a message says
  const obey = (m) => {
    const x = c.current;
    const p = x.player;
    if (!p) {
      x.pending = m;
      if (!latest.current.shown) latest.current.show();
      return;
    }
    const target = Math.max(0, m.playing ? m.p + (latest.current.clk.now() - m.t) / 1000 : m.p);
    x.quiet = Date.now() + QUIET;
    x.lead = false;
    if (Math.abs(p.getCurrentTime() - target) > DRIFT) p.seekTo(target, true);
    const playing = p.getPlayerState() === 1;
    if (m.playing && !playing) p.playVideo();
    if (!m.playing && playing) p.pauseVideo();
    x.pos = target;
    x.at = Date.now();
  };

  // The room: who's watching, and what they say
  useEffect(() => {
    if (!room) return;
    const x = c.current;
    const offs = [
      room.on("watch", (m, from) => {
        if (m.mid !== mod) return;
        if (m.k === "bye") return setInvite((i) => (i === from ? null : i));
        if (!x.on) {
          if (m.k === "on" || m.k === "state") setInvite(from);
          return;
        }
        if (m.k === "hi") x.player && latest.current.clk && say(stateOf(), from);
        if (m.k === "state" && latest.current.clk) obey(m);
      }),
      room.onPeer((id, joined) => {
        if (!joined) setInvite((i) => (i === id ? null : i));
        else if (x.on && x.player && latest.current.clk) say(stateOf(), id); // a newcomer: where we are
      }),
    ];
    return () => offs.forEach((off) => off());
  }, [room, mod]); // eslint-disable-line react-hooks/exhaustive-deps

  // The toggle
  useEffect(() => {
    const x = c.current;
    x.on = on;
    if (!room || !on) return;
    if (!latest.current.shown) latest.current.show();
    setInvite(null);
    say({ k: "on" });
    return () => {
      say({ k: "bye" });
      x.on = false;
    };
  }, [on, room]); // eslint-disable-line react-hooks/exhaustive-deps

  // The player, once the toggle is on and the iframe is up
  useEffect(() => {
    if (!room || !on || !shown) return;
    const x = c.current;
    let dead = false;
    let poll;
    loadYT()
      .then((YT) => {
        const iframe = frame.current?.querySelector("iframe");
        if (dead || !iframe) return;
        const send = () => latest.current.clk && x.player && say(stateOf());
        const player = new YT.Player(iframe, {
          events: {
            onReady: () => {
              if (dead) return;
              x.player = player;
              x.quiet = Date.now() + 2500; // it autoplays from the start: not a command
              x.pos = 0;
              x.at = Date.now();
              if (x.pending) {
                const m = x.pending;
                x.pending = null;
                obey(m);
              }
              say({ k: "hi" });
            },
            onStateChange: (e) => {
              if (dead || Date.now() < x.quiet || ![0, 1, 2].includes(e.data)) return;
              x.lead = true;
              send();
            },
          },
        });
        poll = setInterval(() => {
          const p = x.player;
          if (!p || !latest.current.clk) return;
          const now = Date.now();
          const state = p.getPlayerState();
          const here = p.getCurrentTime();
          const expect = x.pos + (state === 1 ? (now - x.at) / 1000 : 0);
          // The playhead jumped on its own: someone scrubbed
          if (now > x.quiet && state !== 3 && Math.abs(here - expect) > JUMP) {
            x.lead = true;
            send();
          } else if (x.lead && state === 1 && now - (x.beat ?? 0) > BEAT) {
            x.beat = now;
            send();
          }
          x.pos = here;
          x.at = now;
        }, 250);
      })
      .catch(() => setOn(false));
    return () => {
      dead = true;
      clearInterval(poll);
      x.player = null; // the page owns the iframe; we just stop listening
    };
  }, [room, on, shown, src]); // eslint-disable-line react-hooks/exhaustive-deps

  return { on, setOn, invite };
}
