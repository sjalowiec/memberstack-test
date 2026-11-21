/**
 * Machine model names match with or without a hyphen or space: LK150, LK-150, and LK 150.
 *
 * Prefixes come from the machine library. Ordinary words such as "row 40" or "bind-off"
 * are left alone, and LK150 stays distinct from SK150.
 *
 * Pagefind already joins a tight hyphen (LK-150) into one word. A space still splits the
 * name, so the build inserts the joined spelling for Pagefind to index. That index is
 * rebuilt by `pagefind --site dist` after this rewrite.
 */

export const MACHINE_MODEL_PREFIXES: readonly string[] = [
  "passap",
  "zippy",
  "frj",
  "frp",
  "krc",
  "mod",
  "srj",
  "srp",
  "ag",
  "aw",
  "dm",
  "ec",
  "ek",
  "er",
  "es",
  "fb",
  "fc",
  "gb",
  "hk",
  "ka",
  "ke",
  "kg",
  "kh",
  "kl",
  "kr",
  "ks",
  "kx",
  "lc",
  "lk",
  "ls",
  "lw",
  "mk",
  "pe",
  "ps",
  "rj",
  "rt",
  "sc",
  "sh",
  "sk",
  "sr",
  "ta",
  "th",
  "tr",
  "yc",
];

const PREFIX_ALT = [...MACHINE_MODEL_PREFIXES]
  .sort((a, b) => b.length - a.length || a.localeCompare(b))
  .map(escapeRegExp)
  .join("|");

/** Letters, then any spaces or dashes, then the model number. */
const MODEL_NAME = new RegExp(
  `(?<![\\p{L}\\p{N}])(${PREFIX_ALT})([\\s\\u00A0\\u2010-\\u2015-]*)(\\d{1,4})(?![\\p{L}\\p{N}])`,
  "giu",
);

const HTML_WS = "(?:\\s|&nbsp;|&#160;|&#xa0;|&#xA0;|&#x0*a0;)";
const HTML_DASH = "[\\u2010-\\u2015-]";
/** A model separator that includes whitespace, which Pagefind indexes as two words. */
const HTML_SPACED_MODEL = new RegExp(
  `(?<![\\p{L}\\p{N}])(${PREFIX_ALT})((?:${HTML_WS}|${HTML_DASH})*${HTML_WS}(?:${HTML_WS}|${HTML_DASH})*)(\\d{1,4})(?![\\p{L}\\p{N}])`,
  "giu",
);

const WHOLE_MODEL = new RegExp(`^(?:${PREFIX_ALT})\\d{1,4}$`, "iu");

const SKIP_TAGS = new Set(["script", "style", "textarea", "noscript", "title"]);

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Letter prefixes of model numbers in the machine library.
 * A one-letter prefix is omitted so "S 9" and similar phrases stay ordinary words.
 */
export function prefixesInModelLabels(labels: readonly string[]): string[] {
  const found = new Set<string>();
  const re = /(?<![A-Za-z0-9])([A-Za-z]{2,})[\s\u00A0\u2010-\u2015-]*\d{1,4}(?![A-Za-z0-9])/g;
  for (const label of labels) {
    for (const match of String(label).matchAll(re)) {
      found.add(match[1].toLowerCase());
    }
  }
  return [...found].sort((a, b) => b.length - a.length || a.localeCompare(b));
}

/** Join a known model prefix to its number. Other punctuation stays in place. */
export function collapseMachineModels(value: string): string {
  MODEL_NAME.lastIndex = 0;
  return String(value ?? "").replace(MODEL_NAME, "$1$3");
}

export function isWholeMachineModel(value: string): boolean {
  WHOLE_MODEL.lastIndex = 0;
  return WHOLE_MODEL.test(value);
}

function aliasTag(canonical: string): string {
  // The leading space keeps the joined name from sticking to the digits in front of it.
  return `<span hidden aria-hidden="true" data-machine-model-alias="${canonical}"> ${canonical}</span>`;
}

function aliasText(text: string, following: string): string {
  HTML_SPACED_MODEL.lastIndex = 0;
  return text.replace(HTML_SPACED_MODEL, (full, letters: string, _sep: string, digits: string, offset: number) => {
    const canonical = `${letters}${digits}`;
    const hidden = aliasTag(canonical);
    const rest = text.slice(offset + full.length);
    if (!rest && following.startsWith(hidden)) return full;
    return `${full}${hidden}`;
  });
}

/**
 * Insert the joined model spelling next to a spaced model name so Pagefind indexes
 * the same word it indexes for LK150 and LK-150. Tight hyphens are already one word.
 * Text inside script, style, or the title is left unchanged.
 */
export function addMachineModelSearchAliases(html: string): string {
  const parts: string[] = [];
  const tagRe = /<!--[\s\S]*?-->|<\/?([A-Za-z][\w:-]*)\b[^>]*>/g;
  let last = 0;
  let skipUntil = "";
  let match: RegExpExecArray | null;
  while ((match = tagRe.exec(html))) {
    const text = html.slice(last, match.index);
    parts.push(skipUntil ? text : aliasText(text, html.slice(match.index)));
    parts.push(match[0]);
    last = match.index + match[0].length;
    const tag = match[0];
    if (tag.startsWith("<!--") || tag.startsWith("<!") || tag.startsWith("<?") || tag.endsWith("/>")) continue;
    const name = (match[1] || "").toLowerCase();
    if (!SKIP_TAGS.has(name)) continue;
    if (!tag.startsWith("</") && !skipUntil) skipUntil = name;
    else if (tag.startsWith("</") && skipUntil === name) skipUntil = "";
  }
  const tail = html.slice(last);
  parts.push(skipUntil ? tail : aliasText(tail, ""));
  return parts.join("");
}
