// All "days" are local calendar days, keyed as YYYY-MM-DD.

const pad = (n) => String(n).padStart(2, "0");

export const dayKey = (d = new Date()) => {
  const x = d instanceof Date ? d : new Date(d);
  return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`;
};

export const keyToDate = (key) => {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
};

export const addDays = (d, n) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};

// Whole calendar days from a to b (b - a)
export const dayDiff = (a, b) =>
  Math.round((keyToDate(dayKey(b)) - keyToDate(dayKey(a))) / 86400000);

// Last n day keys, oldest first, ending today
export const lastDays = (n, today = new Date()) =>
  Array.from({ length: n }, (_, i) => dayKey(addDays(today, i - n + 1)));

export function agoLabel(ts, now = new Date()) {
  if (!ts) return null;
  const d = dayDiff(ts, now);
  if (d <= 0) return "today";
  if (d === 1) return "yesterday";
  if (d < 7) return `${d}d ago`;
  if (d < 60) return `${Math.round(d / 7)}w ago`;
  return `${Math.round(d / 30)}mo ago`;
}

export function untilLabel(key, now = new Date()) {
  const d = dayDiff(now, keyToDate(key));
  if (d < 0) return d === -1 ? "yesterday" : `${-d}d ago`;
  if (d === 0) return "today";
  if (d === 1) return "tomorrow";
  if (d < 14) return `in ${d}d`;
  if (d < 60) return `in ${Math.round(d / 7)}w`;
  return `in ${Math.round(d / 30)}mo`;
}

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const WEEKDAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

export const prettyDate = (key) => {
  const d = keyToDate(key);
  return `${["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d.getDay()]} ${MONTHS[d.getMonth()][0].toUpperCase()}${MONTHS[d.getMonth()].slice(1)} ${d.getDate()}`;
};

// Pulls a date out of free text like "Nov 4 concert", "concert 11/4",
// "fri lesson", "tomorrow: recital", "in 3 days". Returns
// { date: "YYYY-MM-DD" | null, text: what's left once the date is removed }.
export function parseDated(input, now = new Date()) {
  const today = keyToDate(dayKey(now));
  let text = input;
  let date = null;

  const take = (re, fn) => {
    if (date) return;
    const m = text.match(re);
    if (!m) return;
    const d = fn(m);
    if (!d || isNaN(d)) return;
    date = d;
    text = (text.slice(0, m.index) + " " + text.slice(m.index + m[0].length));
  };
  // A month/day with no year means the next time that day comes around
  const upcoming = (m, d) => {
    let x = new Date(today.getFullYear(), m, d);
    if (dayDiff(today, x) < -1) x = new Date(today.getFullYear() + 1, m, d);
    return x;
  };

  take(/\b(\d{4})-(\d{1,2})-(\d{1,2})\b/, (m) => new Date(+m[1], +m[2] - 1, +m[3]));
  take(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/, (m) => {
    if (!m[3]) return upcoming(+m[1] - 1, +m[2]);
    const y = +m[3] < 100 ? 2000 + +m[3] : +m[3];
    return new Date(y, +m[1] - 1, +m[2]);
  });
  const monthRe =
    "(january|jan|february|feb|march|mar|april|apr|may|june|jun|july|jul|august|aug|september|sept|sep|october|oct|november|nov|december|dec)\\.?";
  take(new RegExp(`\\b${monthRe}\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:,?\\s+(\\d{4}))?\\b`, "i"), (m) => {
    const mo = MONTHS.indexOf(m[1].toLowerCase().slice(0, 3));
    return m[3] ? new Date(+m[3], mo, +m[2]) : upcoming(mo, +m[2]);
  });
  take(new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(?:of\\s+)?${monthRe}\\b`, "i"), (m) =>
    upcoming(MONTHS.indexOf(m[2].toLowerCase().slice(0, 3)), +m[1])
  );
  take(/\b(today|tonight)\b/i, () => today);
  take(/\b(tomorrow|tmrw|tmr)\b/i, () => addDays(today, 1));
  take(/\bin\s+(\d+)\s+(day|days|week|weeks)\b/i, (m) =>
    addDays(today, +m[1] * (m[2].toLowerCase().startsWith("w") ? 7 : 1))
  );
  // "fri" = the soonest Friday (today counts); "next fri" = strictly after today
  take(
    /\b(next\s+)?(sunday|sun|monday|mon|tuesday|tues|tue|wednesday|wed|thursday|thurs|thur|thu|friday|fri|saturday|sat)\b/i,
    (m) => {
      const wd = WEEKDAYS.indexOf(m[2].toLowerCase().slice(0, 3));
      const diff = (wd - today.getDay() + 7) % 7;
      return addDays(today, m[1] && diff === 0 ? 7 : diff);
    }
  );

  text = text.replace(/\s*[:\-–—,@]\s*$/, "").replace(/^\s*[:\-–—,@]\s*/, "").replace(/\s+/g, " ").trim();
  return { date: date ? dayKey(date) : null, text };
}
