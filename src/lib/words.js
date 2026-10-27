// The words pack's logic, kept out of the components: dictionary lookups, translations,
// kanji and poems. All of it is called straight from the browser (no keys) and cached.
import { cachedJSON, HOUR, DAY } from "./apis";
import { dayKey, keyToDate, addDays } from "../utils/date";

// ── Languages ────────────────────────────────────────────────────────────────
// name = Wiktionary's language name; code = MyMemory / ISO; voice = speechSynthesis lang
export const LANGS = [
  { code: "en", name: "English", voice: "en-US" },
  { code: "es", name: "Spanish", voice: "es-ES" },
  { code: "fr", name: "French", voice: "fr-FR" },
  { code: "de", name: "German", voice: "de-DE" },
  { code: "it", name: "Italian", voice: "it-IT" },
  { code: "pt", name: "Portuguese", voice: "pt-BR" },
  { code: "ja", name: "Japanese", voice: "ja-JP" },
  { code: "ko", name: "Korean", voice: "ko-KR" },
  { code: "zh-CN", name: "Chinese", voice: "zh-CN" },
  { code: "ru", name: "Russian", voice: "ru-RU" },
  { code: "nl", name: "Dutch", voice: "nl-NL" },
  { code: "sv", name: "Swedish", voice: "sv-SE" },
];
export const langOf = (code) => LANGS.find((l) => l.code === code) ?? LANGS[0];
export const langByName = (name) => LANGS.find((l) => l.name === name) ?? LANGS[0];

// A stable small number from a string (so "today's word" is the same all day)
export const hash = (s) => {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
};

// Wiktionary hands back HTML snippets: keep the words
export function stripHtml(s) {
  return String(s ?? "")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#0?39;/g, "'")
    .replace(/\s+/g, " ").trim();
}

// ── Word-a-day ───────────────────────────────────────────────────────────────
// A small starter shelf for days when you haven't saved anything yet
export const BUILTIN_WORDS = [
  { word: "sobremesa", lang: "Spanish" }, { word: "serendipity", lang: "English" },
  { word: "petrichor", lang: "English" }, { word: "dépaysement", lang: "French" },
  { word: "Fernweh", lang: "German" }, { word: "komorebi", lang: "Japanese" },
  { word: "saudade", lang: "Portuguese" }, { word: "hygge", lang: "English" },
  { word: "gigil", lang: "English" }, { word: "ephemeral", lang: "English" },
  { word: "Waldeinsamkeit", lang: "German" }, { word: "sehnsucht", lang: "German" },
  { word: "querencia", lang: "Spanish" }, { word: "l'esprit de l'escalier", lang: "French" },
  { word: "sonder", lang: "English" }, { word: "resplendent", lang: "English" },
  { word: "tsundoku", lang: "Japanese" }, { word: "mamihlapinatapai", lang: "English" },
  { word: "gökotta", lang: "Swedish" }, { word: "lagom", lang: "Swedish" },
];

// Today's page: from your own stack when you have one, else the built-in shelf.
export function wordOfDay(state, day = dayKey()) {
  const stack = state.stack ?? [];
  const pool = stack.length ? stack : BUILTIN_WORDS;
  const w = pool[hash(day + (state.salt ?? "")) % pool.length];
  return { word: w.word, lang: w.lang, own: stack.length > 0, saved: stack.find((s) => s.word === w.word && s.lang === w.lang) ?? null };
}

export const isTorn = (state, day = dayKey()) => (state.torn ?? []).some((t) => t.day === day);

// Days in a row (ending today or yesterday) that appear in `days`
export function streakOf(days, today = dayKey()) {
  const set = new Set(days ?? []);
  let d = keyToDate(today);
  if (!set.has(dayKey(d))) d = addDays(d, -1);
  let n = 0;
  while (set.has(dayKey(d))) { n++; d = addDays(d, -1); }
  return n;
}

// → { word, lang, phon, audio, entries: [{ pos, defs: [string], example }] } or null when not found
export async function lookupWord(word, langName = "English") {
  const w = word.trim();
  if (!w) return null;
  try {
    if (langName === "English") {
      const { data } = await cachedJSON(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(w)}`, { ttl: 7 * DAY });
      if (!Array.isArray(data) || !data.length) return null;
      const ph = data.flatMap((e) => e.phonetics ?? []);
      return {
        word: data[0].word ?? w,
        lang: "English",
        phon: data[0].phonetic || ph.find((p) => p.text)?.text || "",
        audio: ph.find((p) => p.audio)?.audio || "",
        entries: data.flatMap((e) => e.meanings ?? []).slice(0, 4).map((m) => ({
          pos: m.partOfSpeech,
          defs: (m.definitions ?? []).slice(0, 3).map((d) => d.definition),
          example: (m.definitions ?? []).find((d) => d.example)?.example ?? "",
        })),
      };
    }
    const { data } = await cachedJSON(`https://en.wiktionary.org/api/rest_v1/page/definition/${encodeURIComponent(w)}`, { ttl: 7 * DAY });
    const hits = Object.values(data ?? {}).flat().filter((e) => e.language === langName);
    if (!hits.length) return null;
    return {
      word: w,
      lang: langName,
      phon: "",
      audio: "",
      entries: hits.slice(0, 4).map((e) => ({
        pos: e.partOfSpeech,
        defs: (e.definitions ?? []).map((d) => stripHtml(d.definition)).filter(Boolean).slice(0, 3),
        example: stripHtml(e.definitions?.find((d) => d.examples?.length)?.examples?.[0] ?? ""),
      })).filter((e) => e.defs.length),
    };
  } catch (err) {
    if (/404/.test(err.message)) return null; // not in the dictionary
    throw err;
  }
}

// The short meaning to put on the back of a card
export const gloss = (r) => r?.entries?.[0]?.defs?.[0] ?? "";

// A card for the Flashcards module
export const cardFor = (front, back, lang) => ({
  front, back, ...(lang ? { lang: langByName(lang).voice } : {}),
});

// Add cards to every Flashcards the person picked, skipping fronts it already has
export function addCards(state, cards, today = dayKey()) {
  const have = new Set((state.cards ?? []).map((c) => c.front));
  const fresh = cards.filter((c) => c.front && c.back && !have.has(c.front));
  return {
    state: {
      ...state,
      cards: [...(state.cards ?? []), ...fresh.map((c) => ({
        id: Math.random().toString(36).slice(2, 9), ...c, box: 0, due: today, createdAt: Date.now(),
      }))],
    },
    added: fresh.length,
  };
}

// ── Phrasebook ───────────────────────────────────────────────────────────────
export const TOPICS = ["greetings", "food", "travel", "feelings", "numbers", "other"];

// MyMemory: free, no key, but about 5000 characters a day per visitor. We keep what it said.
// → { text } | throws Error("limit") when the day's allowance is gone
export async function translate(text, from, to) {
  const q = text.trim().slice(0, 300);
  if (!q) return { text: "" };
  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(q)}&langpair=${from}|${to}`;
  const { data } = await cachedJSON(url, { ttl: 30 * DAY });
  if (data.quotaFinished || data.responseStatus === 429) throw new Error("limit");
  if (data.responseStatus && Number(data.responseStatus) >= 400) throw new Error(data.responseDetails || "no translation");
  // The top hit is sometimes a placeholder; prefer the best real match
  const real = (data.matches ?? [])
    .filter((m) => m.translation && !/^testvalue$/i.test(m.translation))
    .sort((a, b) => Number(b.quality ?? 0) - Number(a.quality ?? 0) || Number(b.match ?? 0) - Number(a.match ?? 0));
  const top = data.responseData?.translatedText;
  const text2 = top && !/^testvalue$/i.test(top) ? top : real[0]?.translation ?? "";
  return { text: stripHtml(text2) };
}

// ── Kanji ────────────────────────────────────────────────────────────────────
export const GRADES = [1, 2, 3, 4, 5, 6];
export const JLPT = [5, 4, 3, 2, 1];
const KANJI = "https://kanjiapi.dev/v1/kanji";

export async function kanjiList(mode, level) {
  const path = mode === "jlpt" ? `jlpt-${level}` : `grade-${level}`;
  const { data } = await cachedJSON(`${KANJI}/${path}`, { ttl: 30 * DAY });
  return Array.isArray(data) ? data : [];
}

// → { kanji, meanings, on, kun, strokes, grade, jlpt } or null
export async function kanjiInfo(ch) {
  const c = [...String(ch).trim()][0];
  if (!c) return null;
  try {
    const { data } = await cachedJSON(`${KANJI}/${encodeURIComponent(c)}`, { ttl: 30 * DAY });
    return {
      kanji: data.kanji, meanings: data.meanings ?? [], on: data.on_readings ?? [], kun: data.kun_readings ?? [],
      strokes: data.stroke_count, grade: data.grade, jlpt: data.jlpt,
    };
  } catch (err) {
    if (/404/.test(err.message)) return null;
    throw err;
  }
}

// Today's new kanji: the first one you don't know yet, from a day-shuffled order of grade 1, then up
export async function newKanjiFor(known = [], day = dayKey()) {
  const have = new Set(known);
  for (const g of GRADES) {
    const list = (await kanjiList("grade", g)).filter((k) => !have.has(k));
    if (list.length) return list[hash(day) % list.length];
  }
  return null;
}

// ── Poems ────────────────────────────────────────────────────────────────────
const POEMS = "https://poetrydb.org";
const clean = (p) => ({
  id: hash(`${p.author}|${p.title}`).toString(36),
  title: p.title, author: p.author, lines: (p.lines ?? []).map((l) => l.replace(/\s+$/, "")),
});

// The same random poem all day (the key carries the day, the URL stays random)
export async function poemOfDay(day = dayKey()) {
  const { data } = await cachedJSON(`${POEMS}/random/1`, { ttl: 2 * DAY, key: `poem-day:${day}` });
  return Array.isArray(data) && data[0] ? clean(data[0]) : null;
}

export async function poemSearch(kind, q) {
  const term = q.trim();
  if (!term) return [];
  const { data } = await cachedJSON(`${POEMS}/${kind}/${encodeURIComponent(term)}`, { ttl: DAY });
  return Array.isArray(data) ? data.slice(0, 40).map(clean) : []; // "not found" is an object
}

export const randomPoem = async () => {
  const { data } = await cachedJSON(`${POEMS}/random/1`, { force: true, ttl: HOUR });
  return Array.isArray(data) && data[0] ? clean(data[0]) : null;
};
