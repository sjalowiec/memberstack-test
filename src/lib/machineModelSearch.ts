/**
 * Machine model names match with or without a hyphen or space: LK150, LK-150, and LK 150.
 *
 * Prefixes come from the machine library. Ordinary words such as "row 40" or "bind-off"
 * are left alone, and LK150 stays distinct from SK150 and from LK1500.
 * A one-letter prefix is included only when that library model uses at least three digits,
 * so "S 9" stays an ordinary phrase while "E 6000" still matches E6000.
 * A single letter glued to the number stays part of the model: KH950i is not KH950.
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

/**
 * Library models whose prefix is one letter and whose number has at least three digits.
 * Shorter one-letter phrases such as "S 9" are not models.
 */
export const ONE_LETTER_MACHINE_PREFIXES: readonly string[] = ["e", "f", "m"];

const PREFIX_ALT = [...MACHINE_MODEL_PREFIXES]
  .sort((a, b) => b.length - a.length || a.localeCompare(b))
  .map(escapeRegExp)
  .join("|");

const ONE_ALT = [...ONE_LETTER_MACHINE_PREFIXES]
  .sort((a, b) => b.length - a.length || a.localeCompare(b))
  .map(escapeRegExp)
  .join("|");

const BOUND_BEFORE = "(?<![\\p{L}\\p{N}])";
const BOUND_AFTER = "(?![\\p{L}\\p{N}])";
const MODEL_SEP = "([\\s\\u00A0\\u2010-\\u2015-]*)";
/** A letter glued to the number, as in KH950i. A space before that letter is not part of the model. */
const MODEL_SUFFIX = "([A-Za-z])?";

function modelPattern(prefixAlt: string, digits: string): string {
  return `${BOUND_BEFORE}(${prefixAlt})${MODEL_SEP}(${digits})${MODEL_SUFFIX}${BOUND_AFTER}`;
}

/** Letters, then any spaces or dashes, then the model number, then an optional glued letter. */
const MODEL_TWO = new RegExp(modelPattern(PREFIX_ALT, "\\d{1,4}"), "giu");
const MODEL_ONE = new RegExp(modelPattern(ONE_ALT, "\\d{3,4}"), "giu");

const HTML_WS = "(?:\\s|&nbsp;|&#160;|&#xa0;|&#xA0;|&#x0*a0;)";
const HTML_DASH = "[\\u2010-\\u2015-]";
const HTML_SEP = `((?:${HTML_WS}|${HTML_DASH})*${HTML_WS}(?:${HTML_WS}|${HTML_DASH})*)`;

function htmlSpacedPattern(prefixAlt: string, digits: string): string {
  return `${BOUND_BEFORE}(${prefixAlt})${HTML_SEP}(${digits})${MODEL_SUFFIX}${BOUND_AFTER}`;
}

/** A model separator that includes whitespace, which Pagefind indexes as two words. */
const HTML_SPACED_TWO = new RegExp(htmlSpacedPattern(PREFIX_ALT, "\\d{1,4}"), "giu");
const HTML_SPACED_ONE = new RegExp(htmlSpacedPattern(ONE_ALT, "\\d{3,4}"), "giu");

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

function joinedModel(prefix: string, digits: string, suffix?: string): string {
  return `${prefix}${digits}${suffix || ""}`;
}

function collapsePattern(value: string, pattern: RegExp): string {
  pattern.lastIndex = 0;
  return value.replace(pattern, (_full, prefix: string, _sep: string, digits: string, suffix?: string) =>
    joinedModel(prefix, digits, suffix),
  );
}

/** Join a known model prefix to its number. Other punctuation stays in place. */
export function collapseMachineModels(value: string): string {
  return collapsePattern(collapsePattern(String(value ?? ""), MODEL_TWO), MODEL_ONE);
}

const SHIELDED_MODEL = new RegExp(
  `(?<![\\p{L}\\p{N}])((?:(?:${PREFIX_ALT})\\d{1,4}|(?:${ONE_ALT})\\d{3,4})[A-Za-z]?)(?![\\p{L}\\p{N}])`,
  "giu",
);

/**
 * Wrap each model so a shorter number cannot match inside a longer one.
 * LK150 does not match LK1500, and KH950 does not match KH950i.
 */
export function shieldMachineModels(value: string): string {
  const source = collapseMachineModels(value);
  SHIELDED_MODEL.lastIndex = 0;
  return source.replace(SHIELDED_MODEL, (_full, model: string) => `\u0000${model}\u0000`);
}

function aliasTag(canonical: string): string {
  // The leading space keeps the joined name from sticking to the digits in front of it.
  return `<span hidden aria-hidden="true" data-machine-model-alias="${canonical}"> ${canonical}</span>`;
}

function aliasPattern(text: string, following: string, pattern: RegExp): string {
  pattern.lastIndex = 0;
  return text.replace(
    pattern,
    (full, letters: string, _sep: string, digits: string, suffix: string | undefined, offset: number) => {
      const canonical = joinedModel(letters, digits, suffix);
      const hidden = aliasTag(canonical);
      const rest = text.slice(offset + full.length);
      if (!rest && following.startsWith(hidden)) return full;
      return `${full}${hidden}`;
    },
  );
}

function aliasText(text: string, following: string): string {
  return aliasPattern(aliasPattern(text, following, HTML_SPACED_TWO), following, HTML_SPACED_ONE);
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
