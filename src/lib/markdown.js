// Markdown, a line at a time, for the Markdown module's live editor: every line shows as it
// will look, and the line you're on shows its raw text. No dependencies and no HTML out: lines
// come back as plain descriptions and inline runs as tokens, and the module draws them.
//
// Pictures already on the board are written ![caption](image:<imageId>).

// Does this read like markdown (rather than plain words or a plain list)? Each sign is
// worth a point or two; a bare list or one bold word isn't enough on its own.
const SIGNS = [
  [/^#{1,6}\s+\S/m, 2],
  [/^\s*```/m, 2],
  [/^\s*[-*+]\s+\[[ xX]\]\s/m, 2],
  [/^\s*>\s?\S/m, 1],
  [/\[[^\]\n]+\]\([^)\s]+\)/, 1],
  [/(\*\*|__)[^*_\n]+\1/, 1],
  [/`[^`\n]+`/, 1],
  [/^\s*[-*+]\s+\S/m, 1],
  [/^\s*\d+[.)]\s+\S/m, 1],
  [/^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/m, 1],
];
export const looksLikeMarkdown = (text = "") => SIGNS.reduce((n, [re, w]) => n + (re.test(text) ? w : 0), 0) >= 2;

// One line → what it is. fence = we're inside a ``` block (see parseLines).
//   { kind: "h", level, body, pre }  pre = the "## " in front of body
//   { kind: "ul" | "ol" | "task", indent, pre, body, n?, done? }
//   { kind: "quote", pre, body } | { kind: "hr" } | { kind: "fence", lang } | { kind: "code" }
//   { kind: "img", alt, src } (a picture on a line of its own) | { kind: "blank" } | { kind: "p", body }
export function parseLine(raw, fence = false) {
  if (/^\s*```/.test(raw)) return { kind: "fence", lang: raw.trim().slice(3).trim() };
  if (fence) return { kind: "code" };
  if (!raw.trim()) return { kind: "blank" };
  let m;
  if ((m = /^(#{1,6})(\s+)(.*)$/.exec(raw))) return { kind: "h", level: m[1].length, pre: m[1] + m[2], body: m[3] };
  if (/^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/.test(raw)) return { kind: "hr" };
  if ((m = /^(\s*)([-*+]\s+\[([ xX])\]\s?)(.*)$/.exec(raw)))
    return { kind: "task", indent: m[1].length, pre: m[1] + m[2], done: m[3] !== " ", body: m[4] };
  if ((m = /^(\s*)([-*+]\s+)(.*)$/.exec(raw))) return { kind: "ul", indent: m[1].length, pre: m[1] + m[2], body: m[3] };
  if ((m = /^(\s*)((\d+)[.)]\s+)(.*)$/.exec(raw))) return { kind: "ol", indent: m[1].length, pre: m[1] + m[2], n: Number(m[3]), body: m[4] };
  if ((m = /^(>\s?)(.*)$/.exec(raw))) return { kind: "quote", pre: m[1], body: m[2] };
  if ((m = /^\s*!\[([^\]]*)\]\(([^)\s]+)\)\s*$/.exec(raw))) return { kind: "img", alt: m[1], src: m[2] };
  return { kind: "p", body: raw };
}

// Every line of a document, with fences tracked across lines
export function parseLines(text) {
  let fence = false;
  return text.split("\n").map((raw) => {
    const line = parseLine(raw, fence);
    if (line.kind === "fence") fence = !fence;
    return line;
  });
}

// Inline runs → tokens: { t: "text" | "code" | "b" | "i" | "s" | "link" | "img", v, href? }.
// b / i / s carry their inside as tokens again (v), so **a *b*** nests.
const INLINE = /(`+)([^`]+?)\1|!\[([^\]]*)\]\(([^)\s]+)\)|\[([^\]]+)\]\(([^)\s]+)\)|(\*\*|__)(.+?)\7|(~~)(.+?)~~|(?<![\w*])([*_])(?![\s*_])(.+?)(?<![\s*_])\11(?![\w*])|(https?:\/\/[^\s<>()]+[^\s<>().,;:!?'"])/g;
export function inline(text) {
  const out = [];
  let at = 0;
  for (const m of text.matchAll(INLINE)) {
    if (m.index > at) out.push({ t: "text", v: text.slice(at, m.index) });
    if (m[1]) out.push({ t: "code", v: m[2] });
    else if (m[4]) out.push({ t: "img", v: m[3], href: m[4] });
    else if (m[6]) out.push({ t: "link", v: inline(m[5]), href: m[6] });
    else if (m[7]) out.push({ t: "b", v: inline(m[8]) });
    else if (m[9]) out.push({ t: "s", v: inline(m[10]) });
    else if (m[11]) out.push({ t: "i", v: inline(m[12]) });
    else out.push({ t: "link", v: [{ t: "text", v: m[13] }], href: m[13] });
    at = m.index + m[0].length;
  }
  if (at < text.length) out.push({ t: "text", v: text.slice(at) });
  return out;
}

// How many characters of text the reader sees in a line (for putting the caret near a click)
export const plainOf = (tokens) => tokens.map((k) => (Array.isArray(k.v) ? plainOf(k.v) : k.t === "img" ? "" : k.v)).join("");

// What the next line starts with when you press Enter at the end of this one: a list carries
// on (numbered lists count up, ticked boxes come back unticked). null = nothing to carry.
export function carryOn(line) {
  if (line.kind === "ul") return line.pre;
  if (line.kind === "task") return line.pre.replace(/\[[xX]\]/, "[ ]");
  if (line.kind === "ol") return line.pre.replace(/\d+/, String(line.n + 1));
  if (line.kind === "quote") return line.pre;
  return null;
}

// Pictures of the board's own (image:<id>) a document points at
export const imageIdsOf = (text = "") => [...text.matchAll(/\]\(image:([\w-]+)\)/g)].map((m) => m[1]);

// A page of the Notes module as markdown: titles become headings, pictures stay pictures
export function notesToMarkdown(blocks = []) {
  return blocks
    .map((b) =>
      b.type === "bigtitle" ? `# ${b.value}`
        : b.type === "divider" ? "---"
          : b.type === "image" ? (b.imageId ? `![](image:${b.imageId})` : "")
            : b.value
    )
    .filter((s) => s !== "")
    .join("\n\n");
}

// A title for a document: its first heading, else its first words
export function titleOf(text = "") {
  const h = /^#{1,6}\s+(.+)$/m.exec(text);
  const first = h?.[1] ?? text.split("\n").find((l) => l.trim()) ?? "";
  return first.replace(/[*_`#>[\]]/g, "").trim().split(/\s+/).slice(0, 5).join(" ") || null;
}

// Text files a person might hand over: markdown or plain text
export const isTextFile = (f) => /\.(md|markdown|mdown|txt|text)$/i.test(f.name ?? "") || /^text\/(plain|markdown|x-markdown)$/.test(f.type);
