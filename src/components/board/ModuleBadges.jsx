import { SITES, siteType } from "../../lib/sites";

// Little red-ink marks on the tray saying how you play with each module:
// a controller for the game-ish ones, f(x) for plotting, a speaker for music…

const s = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" };
const dot = (cx, cy, r = 1.1) => <circle cx={cx} cy={cy} r={r} fill="currentColor" stroke="none" />;

const VERBS = {
  play: {
    label: "a little game",
    draw: (
      <>
        <path d="M6.5 8.5h11a4 4 0 0 1 3.9 4.8l-.8 3.6a2.2 2.2 0 0 1-3.8 1L15.3 16H8.7l-1.5 1.9a2.2 2.2 0 0 1-3.8-1l-.8-3.6a4 4 0 0 1 3.9-4.8z" />
        <path d="M7.5 11v3.6M5.7 12.8h3.6" />
        {dot(15.8, 11.8)}
        {dot(17.8, 13.8)}
      </>
    ),
  },
  tap: {
    label: "tap to mark it",
    draw: (
      <>
        <path d="M10 12V6.2a1.5 1.5 0 0 1 3 0V12M13 11.2a1.5 1.5 0 0 1 3 0v1M16 12a1.5 1.5 0 0 1 3 0v3a6 6 0 0 1-6 6h-.8a5 5 0 0 1-4-2l-2.5-3.4a1.5 1.5 0 0 1 2.3-1.9L10 15.5" />
        <path d="M6 3.5l1.4 1.4M4.5 7.5h2M17 3.5l-1.4 1.4" />
      </>
    ),
  },
  plot: { label: "plots a number", text: "f(x)" },
  count: { label: "counts up", text: "+1" },
  time: {
    label: "runs a clock",
    draw: (
      <>
        <circle cx="12" cy="14" r="7" />
        <path d="M12 14v-3.5M10 3h4M12 3v4M18.5 7.5l1-1" />
      </>
    ),
  },
  sound: {
    label: "for music",
    draw: (
      <>
        <path d="M4 9.5h3.2L12 5.5v13l-4.8-4H4z" />
        <path d="M15.5 9.2a4 4 0 0 1 0 5.6M18 6.8a7.5 7.5 0 0 1 0 10.4" />
      </>
    ),
  },
  watch: {
    label: "plays videos & songs right on it",
    draw: (
      <>
        <rect x="3" y="5" width="18" height="14" rx="2.5" />
        <path d="M10 9.2v5.6l4.8-2.8z" />
      </>
    ),
  },
  write: {
    label: "write in it",
    draw: (
      <>
        <path d="M4.5 19.5l1-4L16 5l3 3L8.5 18.5z" />
        <path d="M14 7l3 3" />
      </>
    ),
  },
  photo: {
    label: "holds pictures",
    draw: (
      <>
        <rect x="3" y="7.5" width="18" height="12.5" rx="2" />
        <path d="M8 7.5L9.5 4.5h5L16 7.5" />
        <circle cx="12" cy="13.7" r="3.3" />
      </>
    ),
  },
  link: {
    label: "holds links",
    draw: (
      <>
        <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" />
        <path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />
      </>
    ),
  },
  date: {
    label: "goes by the date",
    draw: (
      <>
        <rect x="3.5" y="5.5" width="17" height="15" rx="2" />
        <path d="M3.5 10h17M8 3.5v4M16 3.5v4" />
      </>
    ),
  },
  check: {
    label: "check things off",
    draw: (
      <>
        <rect x="4" y="4" width="16" height="16" rx="2.5" />
        <path d="M8 12.5l3 3 5-6.5" />
      </>
    ),
  },
  lock: {
    label: "can lock with a PIN",
    draw: (
      <>
        <rect x="5" y="11" width="14" height="10" rx="2" />
        <path d="M8 11V8a4 4 0 0 1 8 0v3" />
      </>
    ),
  },
  luck: {
    label: "a bit of luck",
    draw: (
      <>
        <rect x="4" y="4" width="16" height="16" rx="3.5" />
        {dot(8.7, 8.7)}
        {dot(12, 12)}
        {dot(15.3, 15.3)}
      </>
    ),
  },
  holds: {
    label: "holds other modules",
    draw: (
      <>
        <path d="M3 9.5h18v10.5H3z" />
        <path d="M3 9.5V6h5.5l1.5 2M10.5 9.5V7h5l1.2 2.5" />
      </>
    ),
  },
  tempo: {
    label: "keeps time",
    draw: (
      <>
        <path d="M7 20.5h10L14.5 5h-5z" />
        <path d="M12 16L16.5 3.5" />
      </>
    ),
  },
  pick: {
    label: "picks colours off the screen",
    draw: (
      <>
        <path d="M15.5 4.5l4 4-2 2-4-4zM13.5 6.5l-8 8-1 4.5 4.5-1 8-8" />
        <path d="M7 15.5l2.5 2.5" />
      </>
    ),
  },
  record: {
    label: "records from your microphone",
    draw: (
      <>
        <rect x="9" y="3.5" width="6" height="11" rx="3" />
        <path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3M8.5 21h7" />
      </>
    ),
  },
  talk: {
    label: "talks live with people on the board",
    draw: (
      <>
        <path d="M4 5.5h16v10H12l-4.5 4v-4H4z" />
        <path d="M8 9.5h8M8 12.5h5" />
      </>
    ),
  },
  peek: {
    label: "shows another module, live",
    draw: (
      <>
        <rect x="4" y="3.5" width="16" height="17" rx="1.5" />
        <path d="M12 3.5v17M4 12h16" />
      </>
    ),
  },
  trek: {
    label: "maps your route",
    draw: (
      <>
        <path d="M5 19c2-6 6 0 8-5s3-6 6-9" />
        <circle cx="5" cy="19" r="1.6" />
        <circle cx="19" cy="5" r="1.6" />
      </>
    ),
  },
  pulse: {
    label: "reads a heartbeat",
    draw: <path d="M3 12h4l2.5-6 4 12 2.5-6H21" />,
  },
  net: {
    label: "pulls live from the internet",
    draw: (
      <>
        <circle cx="12" cy="12" r="8.5" />
        <path d="M3.5 12h17M12 3.5c-3 3.2-3 13.8 0 17M12 3.5c3 3.2 3 13.8 0 17" />
      </>
    ),
  },
};

// What each module is like to use
const DOES = {
  folder: ["holds"],
  tracker: ["tap"],
  nextup: ["check"],
  tickets: ["date"],
  wishlist: ["check", "link"],
  diary: ["write", "lock"],
  notes: ["write", "photo"],
  scrapbook: ["photo"],
  timer: ["time"],
  punchcard: ["tap"],
  flashcards: ["play"],
  setlist: ["sound"],
  graph: ["plot"],
  tally: ["count"],
  jar: ["count"],
  links: ["link"],
  clipping: ["link", "watch"],
  fortune: ["luck"],
  tuner: ["sound"],
  keys: ["sound"],
  metronome: ["tempo", "sound"],
  tape: ["record", "sound"],
  staff: ["write", "sound"],
  magnets: ["write", "play"],
  radio: ["sound"],
  mirror: ["photo"],
  paintchips: ["pick"],
  window: ["peek"],
  photostrip: ["photo"],
  books: ["write", "link"],
  highlights: ["write"],
  focus: ["time", "sound"],
  syllabus: ["check", "date"],
  timelapse: ["photo", "time"],
  recipe: ["write", "time", "sound"],
  bakes: ["write", "photo"],
  patchbay: ["link"],
  gauges: ["peek"],
  shuffle: ["luck"],
  spotlight: ["peek"],
  lockbox: ["lock"],
  paperdoll: ["photo", "play"],
  closet: ["tap", "photo"],
  measure: ["write"],
  route: ["trek", "time"],
  intervals: ["time", "sound"],
  shoes: ["count"],
  heartrate: ["pulse"],
  drawers: ["holds"],
  deck: ["holds", "play"],
  routine: ["holds", "check", "time"],
  dayparts: ["holds", "time"],
  capsule: ["holds", "date", "lock"],
  split: ["holds"],
  plants: ["tap", "photo"],
  garden: ["date", "check"],
  propagate: ["tap"],
  gesture: ["time", "photo"],
  values: ["photo"],
  sketchbook: ["photo"],
  typewriter: ["write", "count"],
  corkboard: ["write"],
  chores: ["luck", "check"],
  groceries: ["check", "write"],
  piggy: ["count"],
  dice: ["luck"],
  initiative: ["play", "check"],
  meds: ["tap", "date"],
  wordday: ["net", "date", "sound"],
  phrasebook: ["net", "write", "sound"],
  kanji: ["net", "write", "count"],
  poems: ["net", "write", "link"],
  // @pack:words
  lyrics: ["net", "time", "check"],
  crate: ["net", "sound", "check"],
  scrobbles: ["net", "peek"],
  chords: ["sound", "tempo"],
  // @pack:music
  tvguide: ["net", "date", "check"],
  paperback: ["net", "peek", "count"],
  backlog: ["net", "play", "count"],
  // @pack:screen
  chesspuzzle: ["play", "net", "count"],
  trivia: ["play", "net", "count"],
  rabbithole: ["net", "trek", "link"],
  almanac: ["net", "date", "pick"],
  // @pack:games
  barometer: ["net", "peek"],
  stargazer: ["net", "peek", "date"],
  fieldguide: ["net", "count", "write"],
  tides: ["net", "peek", "time"],
  // @pack:sky
  passport: ["net", "date", "write"],
  wallet: ["net", "count", "plot"],
  daysoff: ["net", "date", "time"],
  errands: ["net", "check", "trek"],
  // @pack:travel
  pantry: ["net", "date", "photo", "check"],
  recipetin: ["net", "luck", "holds"],
  barcart: ["net", "tap", "luck"],
  postcards: ["net", "luck", "link"],
  // @pack:kitchen
  catalog: ["net", "link", "write", "check"],
  paper: ["net", "link", "peek"],
  lifting: ["count", "plot", "time"],
  worldclock: ["time", "pick"],
  // @pack:desk
  practiceroom: ["talk", "sound"],
  drawit: ["write", "play"],
  flipbook: ["write", "play"],
  pictochat: ["write", "talk"],
  // @pack:live
  markdown: ["write", "link"],
  soundbox: ["sound"],
  checklist: ["check"],
  kanban: ["write", "check"],
  frame: ["photo"],
  // @pack:media
  ...Object.fromEntries(SITES.map((s) => [siteType(s.id), s.does ?? []])),
};

export default function ModuleBadges({ type }) {
  const verbs = DOES[type] ?? [];
  if (!verbs.length) return null;
  return (
    <span className="badges">
      {verbs.map((v) => {
        const verb = VERBS[v];
        return (
          <span key={v} className={`badge${verb.text ? " badge-text" : ""}`} title={verb.label}>
            {verb.text ?? <svg viewBox="0 0 24 24" {...s} aria-hidden="true">{verb.draw}</svg>}
            <span className="sr-only">{verb.label}</span>
          </span>
        );
      })}
    </span>
  );
}
