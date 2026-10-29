// Nicole's own sites and apps, each one a module on the "Made by me" shelf.
// Synced by hand from nickel-tools/app/data/content.ts (hidden entries left out).
//
// Every live site here was checked for framing (no X-Frame-Options, no CSP
// frame-ancestors) on 2026-10-27, so they open right on the card. GitHub refuses
// to be framed, so a repo-only project is a repo card from the GitHub API instead.
//
// url:    where it opens; pages: [{ label, url }] other doors into the same site
// frame:  false = can't go in an iframe (repo: "owner/name" shows a repo card)
// tap:    heavy (3D, multiplayer, camera): a poster until tapped, so a board full of
//         them doesn't spin up every WebGL world at once
// vw:     a desktop layout's width in px; the page is laid out that wide and shrunk to fit
// allow:  the iframe's permissions (mic, MIDI, camera…) on top of fullscreen/clipboard
// note:   the one thing to know about running it inside a board
// shot:   a real screenshot from nickeltools.dev, for the poster
// shelf:  false = kept working wherever it's placed but left off the tray
//         (folded into another site's pages, or not much use on a board)
// does:   tray badges (see ModuleBadges)
const NT = "https://nickeltools.dev";
const SHOT = `${NT}/project-screenshots`;
const WORLD = "https://nicolebelovoskey.com";
const GALLERY = (path) => `${NT}/art-gallery/${path}`;

const ROOMS = [
  { label: "front door", url: WORLD },
  { label: "art room", url: `${WORLD}/holodeck/art` },
  { label: "museum", url: `${WORLD}/art-gallery` },
  { label: "showroom", url: `${WORLD}/software` },
  { label: "Courage", url: `${WORLD}/holodeck/courage-the-cowardly-dog` },
  { label: "math", url: `${WORLD}/holodeck/math` },
];
const ART = [
  { label: "digital", url: GALLERY("digital-art") },
  { label: "paintings", url: GALLERY("paintings") },
  { label: "sketches", url: GALLERY("sketches") },
  { label: "left hand", url: GALLERY("lefthanded") },
  { label: "misc", url: GALLERY("miscellaneous") },
  { label: "notes app", url: GALLERY("notesappart") },
];
const PHONE = { desk: { w: 340, h: 560 }, mobile: { w: 2, h: 8 } };
const WIDE = { desk: { w: 520, h: 400 }, mobile: { w: 2, h: 6 } };

export const SITES = [
  // Apps you'd actually use from a board
  { id: "tierlistify", label: "tierlistify", blurb: "rank anything, drag it into tiers", url: "https://tierlistify.com", shot: `${SHOT}/tierlistifytierlist.png`, ...PHONE, does: ["play", "tap"] },
  {
    id: "friendex", label: "Friendex", blurb: "a pokédex for your friends", url: "https://friendex.online",
    pages: [{ label: "app", url: "https://friendex.online/" }, { label: "demo", url: "https://friendex.online/demo" }],
    shot: `${SHOT}/friendex.png`, note: "signs in separately here: browsers keep a framed site's login apart", ...PHONE, does: ["write"],
  },
  {
    id: "rpgquests", label: "RPG Quests", blurb: "journal it, get it back as quests", url: "https://rpg-quests.netlify.app/",
    pages: [{ label: "app", url: "https://rpg-quests.netlify.app/" }, { label: "demo", url: "https://rpg-quests.netlify.app/demo" }],
    shot: `${SHOT}/videogamequest.png`, ...PHONE, does: ["write", "play"],
  },
  { id: "passionfruit", label: "Passionfruit", blurb: "every project you've got going", url: "https://yieldpassionfruit.netlify.app", shot: `${SHOT}/passionfruit.png`, vw: 1100, ...WIDE, does: ["check"], shelf: false },
  { id: "lifegraph", label: "Life Network", blurb: "your goals as a 3D web", url: "https://yieldpassionfruit.netlify.app/life-graph", tap: true, ...WIDE, does: ["peek"], shelf: false },
  { id: "routine", label: "Routine", blurb: "a daily routine in fresh colours", url: "https://nick5616.github.io/routine/", desk: { w: 380, h: 460 }, mobile: { w: 2, h: 7 }, does: ["date", "pick"], shelf: false },
  { id: "choicepicker", label: "Choice Picker", blurb: "spin a wheel to decide", url: `${NT}/choice-picker`, desk: { w: 360, h: 440 }, mobile: { w: 2, h: 7 }, does: ["luck"], shelf: false },
  { id: "colors", label: "Colour Schemes", blurb: "palettes from colour theory, as JSON", url: `${NT}/advanced-color-scheme-generator`, vw: 1100, desk: { w: 540, h: 440 }, mobile: { w: 2, h: 7 }, does: ["pick"], shelf: false },
  { id: "batch", label: "Batch Analyzer", blurb: "one question, a pile of pictures", url: "https://batch-analyzer.netlify.app/", vw: 1100, ...WIDE, does: ["photo"], shelf: false },
  { id: "resume", label: "LaTeX Resume", blurb: "a resume that compiles in the browser", url: `${NT}/resume-editor`, shot: `${SHOT}/latex.png`, vw: 1280, desk: { w: 560, h: 440 }, mobile: { w: 2, h: 7 }, does: ["write"], shelf: false },
  { id: "sre", label: "SRE Dashboard", blurb: "services, incidents and logs", url: "https://sre.nickeltools.dev", vw: 1200, ...WIDE, does: ["peek"], shelf: false },

  // Music
  { id: "smartpiano", label: "Smart Piano", blurb: "suggests your next notes", url: `${NT}/smart-piano`, shot: `${SHOT}/smartpiano.png`, vw: 1400, allow: "midi; autoplay", desk: { w: 560, h: 340 }, mobile: { w: 2, h: 5 }, does: ["sound"] },
  { id: "pitchhero", label: "Pitch Hero", blurb: "sing the scrolling notes", url: "https://music.nickeltools.dev/pitch-hero/", tap: true, allow: "microphone; midi; autoplay", vw: 1000, ...WIDE, does: ["sound", "play"], shelf: false },
  { id: "midirecorder", label: "Smart MIDI Recorder", blurb: "records your keyboard, shows the key", url: "https://music.nickeltools.dev/smart-midi-recorder/", allow: "midi; microphone; autoplay", vw: 1100, ...WIDE, does: ["record", "sound"] },
  { id: "songviz", label: "Song Visualizer", blurb: "music as particles and waves", url: "https://music.nickeltools.dev/song-visualizer/", tap: true, allow: "microphone; autoplay", vw: 1100, ...WIDE, does: ["sound"] },
  { id: "audiomidi", label: "Audio → MIDI", blurb: "turn a recording into MIDI", url: `${NT}/audio-to-midi`, allow: "microphone", desk: { w: 380, h: 480 }, mobile: { w: 2, h: 7 }, does: ["sound"], shelf: false },

  // Games and toys
  { id: "wizardwars", label: "Wizard Wars", blurb: "a 3D wizard shooter, multiplayer", url: "https://wizardwars.saucedog.art", tap: true, allow: "gamepad; autoplay", note: "click in to aim; Esc gives the mouse back", vw: 1280, ...WIDE, does: ["play", "talk"] },
  { id: "pokemontech", label: "Pokémon or Technology", blurb: "is it a Pokémon or a tech term?", url: `${NT}/pokemon-or-technology`, desk: { w: 300, h: 440 }, mobile: { w: 2, h: 7 }, does: ["play", "count"], shelf: false },
  { id: "plasma", label: "Plasma Sphere", blurb: "drag on the ball to pull the lightning", url: "https://sphere.saucedog.art", tap: true, desk: { w: 360, h: 380 }, mobile: { w: 2, h: 6 }, does: ["play"] },
  {
    id: "thecircle", label: "The Circle", blurb: "one live room, eight on camera", url: "https://live.saucedog.art/", tap: true,
    allow: "camera; microphone; autoplay; display-capture", note: "made for its own tab; on a board the camera may not start", vw: 1200, ...WIDE, does: ["talk"],
  },

  // Nicole's World (one site, many rooms)
  { id: "world", label: "Nicole's World", blurb: "walk around a 3D portfolio", url: WORLD, pages: ROOMS, shot: `${SHOT}/3dportfolio.png`, tap: true, note: "click in to look around; Esc gives the mouse back", vw: 1280, ...WIDE, does: ["play", "peek"] },
  { id: "artroom", label: "Art Room", blurb: "paintings on the holodeck walls", url: ROOMS[1].url, tap: true, vw: 1280, ...WIDE, does: ["photo"], shelf: false },
  { id: "museum", label: "Art Museum", blurb: "a museum of rooms to wander", url: ROOMS[2].url, tap: true, vw: 1280, ...WIDE, does: ["photo"], shelf: false },
  { id: "showroom", label: "Software Showroom", blurb: "use the projects on 3D screens", url: ROOMS[3].url, tap: true, vw: 1280, ...WIDE, does: ["play"], shelf: false },
  { id: "courage", label: "Courage Computer Room", blurb: "a smug computer that roasts you", url: ROOMS[4].url, tap: true, vw: 1280, ...WIDE, does: ["talk"], shelf: false },
  { id: "mathroom", label: "Math Room", blurb: "maths you can walk around", url: ROOMS[5].url, tap: true, vw: 1280, ...WIDE, does: ["play"], shelf: false },

  // Art
  { id: "artgallery", label: "Art Gallery", blurb: "digital art, paintings, sketches", url: ART[0].url, pages: ART, vw: 1100, ...WIDE, does: ["photo"] },
  { id: "saucedog", label: "saucedog.art", blurb: "the older art portfolio", url: "https://saucedog.art", shot: `${SHOT}/oldartportfolio.png`, vw: 1200, ...WIDE, does: ["photo"] },
  { id: "art-paintings", label: "Paintings", blurb: "acrylic, watercolour, canvas", url: ART[1].url, vw: 1100, ...WIDE, does: ["photo"], shelf: false },
  { id: "art-sketches", label: "Sketches", blurb: "studies and quick drawings", url: ART[2].url, vw: 1100, ...WIDE, does: ["photo"], shelf: false },
  { id: "art-lefthanded", label: "Left-Handed Art", blurb: "drawn with the left hand only", url: ART[3].url, vw: 1100, ...WIDE, does: ["photo"], shelf: false },
  { id: "art-misc", label: "Miscellaneous Art", blurb: "experiments and one-offs", url: ART[4].url, vw: 1100, ...WIDE, does: ["photo"], shelf: false },
  { id: "art-notesapp", label: "Notes App Art", blurb: "drawn in apps not meant for it", url: ART[5].url, vw: 1100, ...WIDE, does: ["photo"], shelf: false },

  // Everything else
  { id: "nickeltools", label: "Nickel Tools", blurb: "a desktop OS of all of it", url: `${NT}/desktop`, vw: 1280, ...WIDE, does: ["holds"] },
  { id: "swviz", label: "Star Wars Ship Costs", blurb: "what starships cost, charted", url: "https://star-wars-spending-viz.netlify.app", vw: 1100, ...WIDE, does: ["plot"] },
  { id: "sphere", label: "Sphere Website", blurb: "the hello world of 3D", url: "https://tiny-sorbet-aefcf4.netlify.app/", tap: true, ...WIDE, does: ["play"], shelf: false },
  { id: "newmedia", label: "New Media Class Site", blurb: "the first real website, from 2019", url: "https://new-media-college-class.netlify.app/", vw: 1100, ...WIDE, does: ["link"], shelf: false },

  // Repos only: GitHub won't be framed, so these are repo cards
  { id: "chaos", label: "CHAOS", blurb: "finds the Counter-Strike highlights", frame: false, repo: "nick5616/CHAOS", url: "https://github.com/nick5616/CHAOS", shot: `${SHOT}/chaos.png`, desk: { w: 320, h: 220 }, mobile: { w: 2, h: 4 }, does: ["net", "peek"], shelf: false },
  { id: "voicelab", label: "VoiceLab", blurb: "tracks a singer's takes", frame: false, repo: "nick5616/VoiceLab", url: "https://github.com/nick5616/VoiceLab", desk: { w: 320, h: 220 }, mobile: { w: 2, h: 4 }, does: ["net", "peek"], shelf: false },
  { id: "factory", label: "Factory Orchestrator", blurb: "Microsoft's factory-floor test harness", frame: false, repo: "microsoft/FactoryOrchestrator", url: "https://github.com/microsoft/FactoryOrchestrator", desk: { w: 320, h: 220 }, mobile: { w: 2, h: 4 }, does: ["net"], shelf: false },
];

export const siteType = (id) => `site-${id}`;
export const SITE_OF = Object.fromEntries(SITES.map((s) => [siteType(s.id), s]));

const hostOf = (url) => {
  try { return new URL(url).host.replace(/^www\./, ""); } catch { return ""; }
};
export const siteHost = (s) => hostOf(s.url);
// What an address bar would show, in two short parts: the host (without the
// netlify/github hosting suffix) and the path, if there is one
export function siteAddress(s) {
  const u = new URL(s.url);
  return [u.host.replace(/^www\./, "").replace(/\.(netlify\.app|github\.io)$/, ""), u.pathname.replace(/\/$/, "")];
}

// Which shelved site a pasted link belongs to: the one whose address (or one of its
// pages) is the longest match, so a Life Network link goes to Life Network and not to
// Passionfruit, which lives on the same host
const bare = (u) => u.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "");
export function siteFor(url) {
  const u = bare(url);
  let best = null, len = 0;
  for (const s of SITES) {
    if (s.shelf === false) continue;
    for (const p of [s.url, ...(s.pages ?? []).map((x) => x.url)].map(bare)) {
      if ((u === p || u.startsWith(`${p}/`)) && p.length > len) [best, len] = [s, p.length];
    }
  }
  return best;
}
