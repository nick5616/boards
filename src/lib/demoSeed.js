// The /demo person: Dani, who is learning violin as an adult, brushing up
// their Spanish before Abuela's 80th, baking on weekends, and has a guitar in
// the closet. Every date is relative to today, so the demo always looks lived
// in, and the randomness is seeded, so it looks the same on every load.

import { newModule, findSpot } from "../constants/modules";
import { hash } from "../components/Sticker";
import { dayKey, addDays, dayDiff } from "../utils/date";
import { blankBoard } from "./migrate";
import { memory } from "./demo";

const avatar = `data:image/svg+xml;utf8,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><rect width="40" height="40" fill="#ffb703"/><text x="20" y="26" text-anchor="middle" font-family="DM Sans, sans-serif" font-size="15" font-weight="600" fill="#2a2520">DR</text></svg>`
)}`;

export const DEMO_USER = { uid: "demo", displayName: "Dani Reyes (demo)", photoURL: avatar };

function random(seed) {
  let a = hash(seed);
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let cached = null;

// Builds the boards once per page load, and fills the in-memory entry store
export function demoProfile() {
  if (cached) return cached;

  const NOW = Date.now();
  const today = new Date();
  const rng = random("dani");
  const pick = (list) => list[Math.floor(rng() * list.length)];
  let seq = 0;
  const nid = (p) => `${p}-${(seq++).toString(36)}`;

  // `d` days ago at about `h` o'clock, never later than a little while ago
  const at = (d, h = 19, m = 0) => {
    const x = addDays(today, -d);
    x.setHours(h, m, 0, 0);
    return Math.min(x.getTime(), NOW - 15 * 60000);
  };
  const day = (d) => dayKey(addDays(today, d)); // negative = past
  const weekday = (d) => addDays(today, -d).getDay();

  const it = (text, extra = {}) => ({ id: nid("i"), text, createdAt: at(30), ...extra });
  const closed = (text, how, d) => it(text, { how, closedAt: at(d) });
  const tk = (text, d, note) => ({ id: nid("t"), text, date: day(d), createdAt: at(40), ...(note ? { note } : {}) });
  const mod = (board, type, extra = {}) => newModule(type, { x: 0, y: 0 }, { id: `${board}-${type}-${seq++}`, ...extra });

  const entries = [];
  const log = (boardId, d, text = "", { h, ...extra } = {}) =>
    entries.push({ id: nid("log"), kind: "log", boardId, moduleId: null, text, at: at(d, h ?? pick([7, 12, 18, 20, 21]), Math.floor(rng() * 59)), ...extra });

  // A habit over the last `days` days: rate is a chance per day (or a
  // function of the weekday). pinned = { daysAgo: note } always logs.
  const habit = (boardId, { days, from = 0, rate, notes = [], noteRate = 0.3, pinned = {}, skip = [], timer }) => {
    const pool = [...notes];
    for (let d = days; d >= from; d--) {
      if (skip.includes(d)) continue;
      const p = typeof rate === "function" ? rate(weekday(d)) : rate;
      if (pinned[d] != null) log(boardId, d, pinned[d]);
      else if (rng() < p) {
        if (timer && rng() < timer) {
          const mins = pick([15, 20, 20, 25, 30]);
          log(boardId, d, `⏱ ${mins} min`, { mins });
        } else log(boardId, d, pool.length && rng() < noteRate ? pool.splice(Math.floor(rng() * pool.length), 1)[0] : "");
      }
    }
  };

  const diary = (boardId, moduleId, d, text) =>
    entries.push({ id: nid("diary"), kind: "diary", boardId, moduleId, text, at: at(d, 22, 10) });

  // ── Violin ────────────────────────────────────────────────────────────────
  habit("violin", {
    days: 84,
    rate: 0.68,
    timer: 0.3,
    skip: [24, 25, 26, 27, 28],
    pinned: {
      0: "Minuet 2 bars 9–16 on repeat. the shift is shifting",
      5: "lesson! Ilse said my bow arm looks less like a chicken wing 🐔",
      23: "Hilary Hahn night. came home and played at 11pm, sorry neighbors",
      29: "back after the cold. everything is out of tune, including me",
    },
    notes: [
      "scales w/ drone. A major finally in tune-ish",
      "only 10 min, neighbor was home and I got shy",
      "open strings + long bows. boring but Ilse is right",
      "played along w/ the recording and kept up for once",
      "bow hold kept collapsing. pinky on strike",
      "recorded myself. never again. (again on thurs)",
      "practiced in the bathroom for the echo lol",
      "Song of the Wind clean 3x in a row!!",
      "tired. 5 min of twinkles so the chart isn't empty",
      "vibrato attempt #1. a goat. a happy goat",
      "Perpetual Motion at 80 without crashing",
    ],
  });

  // A couple of timed sessions this week, so the timer has minutes to show
  log("violin", 0, "⏱ 20 min", { mins: 20, h: 7 });
  if (today.getDay() !== 1) log("violin", 1, "⏱ 25 min", { mins: 25, h: 7 });

  const violin = [
    mod("violin", "tracker"),
    mod("violin", "nextup", {
      state: {
        items: [
          it("Minuet 3, bars 1–8, slow w/ metronome @ 60"),
          it("shifting exercise p.14 (3rd position, don't panic)"),
          it("ask Ilse about the squeak on the E string"),
          it("look up recital dress code??"),
        ],
        done: [
          closed("memorize Minuet 2, first half", "done", 4),
          closed("loosen the bow EVERY time", "done", 11),
          closed("buy a second set of strings", "dropped", 16),
        ],
      },
    }),
    mod("violin", "timer", { state: { preset: 20, startedAt: null } }),
    mod("violin", "setlist", {
      title: "Repertoire",
      state: {
        items: [
          ["Minuet 3", 0], ["Ashokan Farewell (the dream)", 0], ["Etude", 1], ["Minuet 2 (recital!!)", 1],
          ["Minuet 1", 2], ["Perpetual Motion", 2], ["Twinkle variations", 3], ["Lightly Row", 3],
          ["Song of the Wind", 3], ["Go Tell Aunt Rhody", 3], ["May Song", 3], ["Allegro", 3],
        ].map(([text, stage]) => it(text, { stage })),
      },
    }),
    mod("violin", "tickets", {
      state: {
        items: [
          tk("Lesson w/ Ilse", 2),
          tk("Lesson w/ Ilse", 9),
          tk("Adult student recital: Minuet 2 😬", 19),
          tk("Bow rehair pickup", -3),
          tk("Lesson w/ Ilse", -5, "she said “better!” and meant it"),
          tk("Hilary Hahn @ Symphony Hall", -23, "cried during the Bach. no shame"),
          tk("Lesson w/ Ilse", -12, "learned the word “spiccato”, can't do it"),
        ],
      },
    }),
    mod("violin", "graph", {
      title: "Minuet 2 tempo",
      state: {
        unit: "bpm",
        goal: 104,
        points: [[-45, 60], [-40, 63], [-35, 66], [-31, 66], [-22, 69], [-18, 72], [-14, 76], [-10, 76], [-6, 80], [-3, 84], [-1, 88]]
          .map(([d, v]) => ({ id: nid("p"), day: day(d), v })),
      },
    }),
    mod("violin", "punchcard", {
      state: {
        size: 10,
        reward: "a real shoulder rest",
        startedAt: at(11, 0),
        cards: [
          { id: nid("c"), reward: "fancy rosin", size: 10, startedAt: at(52), doneAt: at(38) },
          { id: nid("c"), reward: "the nice metronome", size: 10, startedAt: at(70), doneAt: at(55) },
        ],
      },
    }),
    mod("violin", "fortune", {
      title: "Ilse says",
      state: {
        items: [
          "Slow practice is the shortcut.",
          "Let the bow's weight do the work. Stop squeezing.",
          "Practice the two bars you hate, not the twenty you like.",
          "Breathe at the end of the phrase. You're allowed to.",
          "If it sounds bad, that's information, not a verdict.",
          "Thumb soft. Pinky curved. Shoulders down.",
          "Ten good minutes beat an hour of noodling.",
        ].map((text) => it(text)),
      },
    }),
    mod("violin", "wishlist", {
      state: {
        items: [
          it("shoulder rest that doesn't slide off"),
          it("Evah Pirazzi strings (when the punch card's full)"),
          it("a music stand that isn't a pile of books"),
          it("Suzuki book 2!!"),
        ],
        done: [
          closed("practice mute (for the neighbors)", "got", 20),
          closed("rosin", "got", 38),
          closed("electric violin (Ilse said no)", "dropped", 45),
        ],
      },
    }),
  ];

  // ── Spanish ───────────────────────────────────────────────────────────────
  habit("spanish", {
    days: 56,
    rate: 0.58,
    skip: [0],
    pinned: {
      1: "called Abuela! 6 min in Spanish before I caved",
      3: "🗂 reviewed 16 cards",
      6: "intercambio night. Marisol + her dog Frijol",
      13: "🗂 reviewed 11 cards",
    },
    notes: [
      "20 min Dreaming Spanish on the couch",
      "podcast on the bus, understood like 40%",
      "subjunctive. why. WHY",
      "Club de Cuervos ep 2 w/ Spanish subs",
      "wrote toast draft 1 (it's bad)",
      "texted Tía Lupe in Spanish, she replied with 9 emojis",
      "read the menu at La Esquina out loud, waiter was nice about it",
    ],
  });

  const thursday = (4 - today.getDay() + 7) % 7 || 7;
  const card = (front, back, box, due) => ({ id: nid("f"), front, back, box, due: day(due), createdAt: at(40) });
  const spanishDiary = mod("spanish", "diary", { title: "Diario" });

  const spanish = [
    mod("spanish", "tracker"),
    mod("spanish", "flashcards", {
      title: "Vocab",
      state: {
        cards: [
          card("brindar", "to toast (with a drink)", 1, 0),
          card("orgullosa", "proud (f.)", 2, 0),
          card("te extrañamos", "we miss you", 0, 0),
          card("apenas", "barely", 0, 0),
          card("aprovechar", "to make the most of", 2, -1),
          card("padrísimo", "super cool (MX)", 1, 0),
          card("agradecer", "to be grateful for", 0, 0),
          card("levantar la copa", "to raise a glass", 0, 0),
          card("echar de menos", "to miss (Spain says it this way)", 1, 0),
          card("el cumpleaños", "birthday", 3, 4),
          card("la sobremesa", "hanging out at the table after a meal", 2, 1),
          card("ojalá", "I hope / God willing", 4, 9),
          card("el pastel", "cake", 3, 2),
          card("la vergüenza", "embarrassment", 1, 1),
          card("embarazada", "pregnant (NOT embarrassed!!)", 5, 20),
          card("me cae bien", "I like them (as a person)", 3, 5),
          card("la chamba", "work, a job (MX)", 2, 2),
          card("el recuerdo", "a memory, a souvenir", 2, 3),
          card("la familia entera", "the whole family", 4, 11),
          card("ya mero", "almost (MX)", 1, 1),
        ],
        learned: [
          { ...card("la abuela", "grandma", 5, 0), learnedAt: at(18) },
          { ...card("¿qué onda?", "what's up? (MX)", 5, 0), learnedAt: at(25) },
          { ...card("gracias por todo", "thanks for everything", 5, 0), learnedAt: at(31) },
          { ...card("la nieta / el nieto", "granddaughter / grandson", 5, 0), learnedAt: at(33) },
        ],
      },
    }),
    mod("spanish", "nextup", {
      state: {
        items: [
          it("toast draft 2, out loud this time"),
          it("practice rolling Rs in the car (windows up)"),
          it("ask Mom which songs Abuela wants at the party"),
        ],
        done: [closed("toast draft 1", "done", 3), closed("finish Duolingo unit 14", "dropped", 9)],
      },
    }),
    mod("spanish", "tickets", {
      state: {
        items: [
          tk("Intercambio @ Café Lume", thursday),
          tk("Intercambio @ Café Lume", thursday + 7),
          tk("Abuela's 80th 🎂 (THE TOAST)", 41),
          tk("CDMX w/ Priya ✈️", 152),
          tk("Intercambio @ Café Lume", thursday - 7, "Marisol taught me “ya mero”. using it constantly"),
          tk("Coco singalong at the library", -30, "sang Recuérdame. cried. classic"),
        ],
      },
    }),
    mod("spanish", "tally", {
      title: "Convos en español",
      state: {
        unit: "convos",
        counts: Object.fromEntries(
          Array.from({ length: 24 }, (_, d) => [day(-d), d === 0 ? 1 : rng() < 0.45 ? 0 : 1 + Math.floor(rng() * 3)]).filter(([, n]) => n)
        ),
      },
    }),
    spanishDiary,
  ];
  diary("spanish", spanishDiary.id, 1,
    "Llamé a Abuela. Hablamos de su jardín y de los tomates que no quieren crecer. I only switched to English twice!! She said “tu español está mejorando, mija” and I had to put the phone down for a sec.");
  diary("spanish", spanishDiary.id, 9,
    "Intercambio. Marisol has a dog named Frijol and I understood the WHOLE story about Frijol eating a sock. Small wins.");
  diary("spanish", spanishDiary.id, 16,
    "Espero que tengas un buen día. Espero que TENGAS. Not tienes. Ok. Ok. Who designed this.");
  diary("spanish", spanishDiary.id, 27,
    "Mom told me Abuela still has the birthday card I made her in 3rd grade, the one where I spelled feliz wrong. I want to give the toast in Spanish. Like actually give it, not read it off my phone.");

  // ── Couch to 5K ───────────────────────────────────────────────────────────
  const runStart = entries.length;
  habit("run", { days: 49, from: 1, rate: (wd) => ([1, 3, 6].includes(wd) ? 0.9 : 0) });
  const runs = entries.slice(runStart).sort((a, b) => a.at - b.at);
  const runNotes = {
    0: "that was a lot of breathing",
    7: "didn't die",
    13: "20 MIN NO WALKING. who am I",
  };
  runs.forEach((e, i) => {
    e.text = `W${Math.floor(i / 3) + 1}D${(i % 3) + 1}${runNotes[i] ? `: ${runNotes[i]}` : ""}`;
  });
  const nextRun = `W${Math.floor(runs.length / 3) + 1}D${(runs.length % 3) + 1}`;

  const run = [
    mod("run", "tracker"),
    mod("run", "nextup", {
      state: {
        items: [it(`${nextRun}: just put the shoes on`), it("stretch AFTER, not just think about it"), it("figure out a podcast that isn't sad")],
        done: [closed(runs[runs.length - 1]?.text.split(":")[0] ?? "W1D1", "done", 2)],
      },
    }),
    mod("run", "punchcard", {
      state: {
        size: 12,
        reward: "the good socks (merino, worth it)",
        startedAt: at(24, 0),
        cards: [{ id: nid("c"), reward: "headphones that stay in", size: 12, startedAt: at(49), doneAt: at(25) }],
      },
    }),
    mod("run", "graph", {
      title: "Longest run",
      state: {
        unit: "min",
        goal: 30,
        points: [[-46, 1], [-39, 1.5], [-32, 3], [-25, 5], [-18, 8], [-12, 20], [-5, 22]].map(([d, v]) => ({ id: nid("p"), day: day(d), v })),
      },
    }),
    mod("run", "tickets", {
      title: "Races",
      state: {
        items: [
          tk("shoe fitting @ the running store", 3),
          tk("Riverside 5K fun run 🏃", 24),
          tk("first parkrun (walked half)", -20, "a 70 yr old lapped me and said “good job sweetie”. honored"),
        ],
      },
    }),
    mod("run", "fortune", {
      title: "Pep talks",
      state: {
        items: [
          "The first ten minutes always lie.",
          "Slow is still running.",
          "You don't have to want to. Just put the shoes on.",
          "Nobody is looking at you. They're thinking about their own knees.",
        ].map((text) => it(text)),
      },
    }),
  ];

  // ── Sourdough ─────────────────────────────────────────────────────────────
  habit("bread", {
    days: 75,
    from: 2,
    rate: (wd) => (wd === 6 ? 0.85 : wd === 0 ? 0.4 : 0.08),
    noteRate: 0.5,
    notes: [
      "best crumb yet 🤌",
      "forgot Bread Pitt in the fridge for 9 days. he lives",
      "overproofed. pancake. ate it anyway",
      "75% hydration = soup hands",
      "gave a loaf to the downstairs neighbors (apology for the violin)",
      "fed Bread Pitt",
      "fed Bread Pitt",
      "tried the coil fold thing, actually easier??",
      "burned the bottom. pizza stone was a mistake",
    ],
  });
  const bread = [
    mod("bread", "tracker"),
    mod("bread", "nextup", {
      state: {
        items: [
          it("try a 30% whole wheat loaf"),
          it("rice flour for the banneton (STOP STICKING)"),
          it("feed Bread Pitt Thursday night"),
        ],
        done: [closed("buy a lame (the razor, not the adjective)", "done", 15)],
      },
    }),
    mod("bread", "graph", {
      title: "Oven spring",
      state: {
        unit: "cm tall",
        goal: 10,
        points: [[-68, 5.5], [-61, 6], [-54, 5], [-47, 7], [-40, 7.5], [-33, 8], [-26, 7], [-19, 8.5], [-12, 9], [-5, 9.5]]
          .map(([d, v]) => ({ id: nid("p"), day: day(d), v })),
      },
    }),
    mod("bread", "notes", {
      title: "The recipe",
      w: 380,
      h: 460,
      state: {
        blocks: [
          { id: nid("b"), type: "bigtitle", value: "Weekend country loaf" },
          { id: nid("b"), type: "text", value: "500g bread flour (50g of it whole wheat)\n375g water (75%)\n100g Bread Pitt, bubbly\n10g salt" },
          { id: nid("b"), type: "divider", value: "" },
          { id: nid("b"), type: "text", value: "Fri 9pm: mix, rest 1 hr, add salt\nstretch & folds ×4, every 30 min\nbulk till ~50% bigger (4–6 hrs, kitchen is cold)\nshape, banneton, fridge overnight\nSat: 250°C dutch oven, 20 lid on / 25 lid off" },
          { id: nid("b"), type: "text", value: "don't open the oven to peek.\n(you will open the oven to peek)" },
        ],
      },
    }),
  ];

  // ── Reading ───────────────────────────────────────────────────────────────
  habit("read", {
    days: 30,
    from: 1,
    rate: 0.25,
    noteRate: 0.6,
    notes: ["read on the train instead of doomscrolling 👏", "finished Piranesi (again). still perfect", "fell asleep 4 pages in, counts"],
  });
  const year = today.getFullYear();
  const intoYear = Math.max(14, dayDiff(new Date(year, 0, 1), today));
  const readingDiary = mod("read", "diary", { title: "Reading notes" });
  const read = [
    mod("read", "jar", {
      state: {
        label: `${year} books`,
        goal: 24,
        unit: "books",
        drops: Array.from({ length: 14 }, (_, i) => ({ id: nid("d"), amt: 1, at: at(Math.round(intoYear * (1 - (i + 0.5) / 14))) })),
        shelf: [{ id: nid("j"), label: `${year - 1} books`, goal: 20, unit: "books", total: 20, startedAt: at(intoYear + 365), filledAt: at(intoYear + 12) }],
      },
    }),
    mod("read", "wishlist", {
      title: "TBR pile",
      state: {
        items: [
          it("Tomorrow, and Tomorrow, and Tomorrow"),
          it("Como agua para chocolate (Abuela's pick, in Spanish!!)"),
          it("The Left Hand of Darkness"),
          it("a cookbook I'll actually cook from"),
        ],
        done: [
          closed("Piranesi (re-read)", "got", 6),
          closed("Project Hail Mary", "got", 40),
          closed("Infinite Jest (who was I kidding)", "dropped", 60),
        ],
      },
    }),
    mod("read", "fortune", {
      title: "Underlined",
      state: {
        items: [
          "“There is no charm equal to tenderness of heart.” (Austen)",
          "“I am large, I contain multitudes.” (Whitman)",
          "“Hope is the thing with feathers.” (Dickinson)",
          "“The best way out is always through.” (Frost)",
          "“I went to the woods because I wished to live deliberately.” (Thoreau)",
        ].map((text) => it(text)),
      },
    }),
    readingDiary,
  ];
  diary("read", readingDiary.id, 6, "Piranesi, second time. “The Beauty of the House is immeasurable; its Kindness infinite.” Needed that this week.");
  diary("read", readingDiary.id, 40, "Project Hail Mary: stayed up till 2. Rocky deserves everything.");

  // ── Plant babies (paused) ─────────────────────────────────────────────────
  habit("plants", { days: 80, from: 22, rate: (wd) => (wd === 0 ? 0.7 : 0.05), notes: ["watered everyone", "misted the fern, it hates me"], noteRate: 0.5 });
  const plants = [
    mod("plants", "nextup", { state: { items: [it("repot the pothos (it's begging)"), it("propagate Kim's pilea cutting")], done: [] } }),
    mod("plants", "tally", {
      title: "Waterings",
      state: {
        unit: "plants",
        counts: Object.fromEntries(Array.from({ length: 9 }, (_, w) => [day(-(22 + w * 7)), 4 + Math.floor(rng() * 5)])),
      },
    }),
    mod("plants", "tickets", {
      state: {
        items: [tk("fertilize everyone", 8), tk("plant swap @ the library", -34, "came home with 3. said I'd take 1")],
      },
    }),
    mod("plants", "wishlist", { state: { items: [it("moisture meter"), it("grow light for the sad corner")], done: [closed("hanging hooks", "got", 50)] } }),
  ];

  // ── Japan someday ─────────────────────────────────────────────────────────
  const japan = [
    mod("japan", "jar", {
      state: {
        label: "Japan fund",
        goal: 4000,
        unit: "$",
        drops: [[330, 200], [300, 150], [270, 150], [240, 300], [210, 100], [180, 75], [150, 200], [120, 150], [100, 40], [90, 125], [60, 200], [30, 150]]
          .map(([d, amt]) => ({ id: nid("d"), amt, at: at(d) })),
        shelf: [],
      },
    }),
    mod("japan", "notes", {
      title: "Ideas",
      state: {
        blocks: [
          { id: nid("b"), type: "text", value: "Kyoto in November for the leaves (not cherry blossom chaos)" },
          { id: nid("b"), type: "text", value: "Naoshima art island. THE PUMPKIN" },
          { id: nid("b"), type: "text", value: "onsen etiquette: look it up before, not in the locker room" },
          { id: nid("b"), type: "text", value: "ask Priya if she wants to do CDMX *and* this (lol, money)" },
        ],
      },
    }),
    mod("japan", "wishlist", {
      title: "Before I go",
      state: { items: [it("learn hiragana (new board??)"), it("do the JR pass math"), it("good walking shoes (also for the 5K!)")], done: [] },
    }),
  ];

  // ── Guitar (the closet one) ───────────────────────────────────────────────
  log("guitar", 140, "played 15 min at Sam's party, forgot everything", { h: 23 });
  const guitar = [
    mod("guitar", "nextup", { state: { items: [it("restring it (in the closet since 2021)"), it("learn 4 chords. any 4")], done: [] } }),
    mod("guitar", "setlist", {
      title: "Someday songs",
      state: { items: [it("Here Comes the Sun", { stage: 0 }), it("Blackbird", { stage: 0 }), it("Wonderwall (ironically)", { stage: 1 })] },
    }),
  ];

  // ── Song swaps: one song with each friend, a folder tab apiece ────────────
  log("songs", 3, "hum-recorded the chorus idea in the car", { h: 18 });
  log("songs", 9, "", { h: 21 });
  const songFolder = mod("songs", "folder", {
    title: "One song each",
    w: 680,
    h: 520,
    state: { tabs: [{ id: "maya", name: "Maya" }, { id: "jo", name: "Jo" }, { id: "sam", name: "Sam" }], active: "maya" },
  });
  const inTab = (tab, type, extra) => mod("songs", type, { parent: songFolder.id, tab, ...extra });
  const songs = [
    songFolder,
    inTab("maya", "notes", {
      title: "Lyrics",
      w: 320,
      h: 360,
      state: {
        blocks: [
          { id: nid("b"), type: "bigtitle", value: "Porch Light (working title)" },
          { id: nid("b"), type: "text", value: "you left the porch light on for me\nlike a lighthouse for a car\n— Maya's line, keep it" },
          { id: nid("b"), type: "text", value: "chorus: G – Em – C – D, she wants it slower" },
        ],
      },
    }),
    inTab("maya", "nextup", { state: { items: [it("send Maya the voice memo"), it("second verse (about the dog?)")], done: [] } }),
    inTab("jo", "tickets", { title: "Sessions", state: { items: [tk("Jo's garage, bring capo", 4)] } }),
    inTab("jo", "notes", {
      title: "Ideas",
      state: { blocks: [{ id: nid("b"), type: "text", value: "Jo wants something fast and mean.\n7/8?? we'll see" }] },
    }),
  ];

  // ── Wheel class (done) ────────────────────────────────────────────────────
  // Eight Tuesdays, the last one about two months ago (days-ago, oldest first)
  const tuesdays = Array.from({ length: 8 }, (_, w) => 63 + w * 7 + ((today.getDay() - 2 + 7) % 7)).reverse();
  const clayNotes = [
    "centering is a lie",
    "made a bowl! it collapsed",
    "pulled walls ok-ish",
    "trimming day, trimmed through the bottom",
    "handles. why are handles so hard",
    "first thing that survived the kiln",
    "glazed everything blue, oops",
    "final pickup 🥲",
  ];
  tuesdays.forEach((d) => log("clay", d, "", { h: 20 }));
  const clayDiary = mod("clay", "diary", { title: "Studio notes" });
  const clay = [
    mod("clay", "tickets", {
      title: "Tuesdays 7pm",
      state: { items: tuesdays.map((d, i) => tk(`Week ${i + 1}`, -d, clayNotes[i])) },
    }),
    clayDiary,
  ];
  diary("clay", clayDiary.id, tuesdays[7] - 1,
    "Class is over. Kept 5 things out of ~20. The cup for Abuela is lopsided and she is going to love it anyway. Would take again, but maybe not till spring.");

  // ── Boards ────────────────────────────────────────────────────────────────
  // Each module finds a spot among the ones on the same surface (board, or folder tab)
  const place = (mods) => {
    const placed = [];
    for (const m of mods) {
      const siblings = placed.filter((p) => p.parent === m.parent && p.tab === m.tab);
      placed.push({ ...m, ...findSpot(siblings, m.w, m.h, m.parent ? 600 : 1000) });
    }
    return placed;
  };
  const defs = [
    ["violin", violin, { title: "Violin", color: { h: 30, s: 60, l: 80 }, stampId: "music", layout: "bleed", status: "active" }],
    ["spanish", spanish, { title: "Spanish (for Abuela)", color: { h: 50, s: 80, l: 78 }, stampId: "book", layout: "bubble", status: "active" }],
    ["run", run, { title: "5K prep", color: { h: 150, s: 45, l: 76 }, stampId: "zap", layout: "bleed", status: "active" }],
    ["bread", bread, { title: "Sourdough", color: { h: 16, s: 55, l: 80 }, stampId: "flame", layout: "centered", status: "active" }],
    ["read", read, { title: "Reading", color: { h: 265, s: 40, l: 84 }, stampId: "moon", layout: "bubble", status: "active" }],
    ["plants", plants, { title: "Plant babies", color: { h: 110, s: 40, l: 78 }, stampId: "leaf", layout: "centered", status: "paused" }],
    ["japan", japan, { title: "Japan someday", color: { h: 350, s: 60, l: 85 }, stampId: "sun", layout: "bleed", status: "someday" }],
    ["songs", songs, { title: "Song swaps", color: { h: 45, s: 70, l: 80 }, stampId: "mic", layout: "bleed", status: "active" }],
    ["guitar", guitar, { title: "Guitar (the closet one)", color: { h: 200, s: 35, l: 82 }, stampId: "mic", layout: "bubble", status: "someday" }],
    ["clay", clay, { title: "Wheel class", color: { h: 190, s: 25, l: 80 }, stampId: "palette", layout: "centered", status: "done" }],
  ];

  // Each practice log remembers the one before it, so undo restores "last practiced"
  const last = {};
  for (const e of entries.sort((a, b) => a.at - b.at)) {
    e.day = dayKey(e.at);
    if (e.kind !== "log") continue;
    e.prevLast = last[e.boardId] ?? null;
    last[e.boardId] = e.at;
  }
  entries.forEach((e) => memory.entries.set(e.id, e));

  const boards = defs.map(([id, mods, fields], order) => ({
    id,
    ...blankBoard({ ...fields, modules: place(mods), lastLoggedAt: last[id] ?? null, createdAt: at(200 - order) }, order),
  }));

  cached = { boards };
  return cached;
}
