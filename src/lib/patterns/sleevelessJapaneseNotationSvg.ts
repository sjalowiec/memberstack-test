/**
 * Proof-of-concept: Japanese notation garment SVG token replacement.
 * Live values: {@link buildBackJapaneseNotationReplacements} in `sleevelessBackJapaneseNotation.ts`.
 */

export {
  buildBackJapaneseNotationReplacements,
  JP_BACK_NOTATION_SVG_TOKEN_KEYS,
} from "./sleevelessBackJapaneseNotation";
export {
  buildFrontJapaneseNotationReplacements,
  JP_FRONT_NOTATION_SVG_TOKEN_KEYS,
  SLEEVELESS_FRONT_JP_NOTATION_DIAGRAM_SRC as JP_FRONT_NOTATION_SVG_SRC,
} from "./sleevelessFrontJapaneseNotation";
export { JP_BACK_NOTATION_SVG_SRC } from "./sleevelessBackDiagramSrc";

/** Matches `{{jp-*}}`, `{{rc-*}}`, and `{{rc_reset}}` in concatenated SVG text. */
export const JAPANESE_NOTATION_SVG_PLACEHOLDER_RE =
  /\{\{\s*(jp-[a-z0-9-]+|rc-[a-z0-9-]+|rc_reset)\s*\}\}/gi;

/** Concatenate text across all `<text>` elements in a markup fragment. */
function concatAllTextInMarkup(markup: string): string {
  const textRe = /<text(\s[^>]*)?>([\s\S]*?)<\/text>/gi;
  let out = "";
  let textMatch: RegExpExecArray | null;
  while ((textMatch = textRe.exec(markup)) !== null) {
    out += concatSvgTextElementContent(textMatch[2]!);
  }
  return out;
}

/** Concatenate `<tspan>` text (Illustrator re-exports split `{{token}}` across tspans). */
export function concatSvgTextElementContent(innerMarkup: string): string {
  const tspans: string[] = [];
  const tspanRe = /<tspan[^>]*>([\s\S]*?)<\/tspan>/gi;
  let match: RegExpExecArray | null;
  while ((match = tspanRe.exec(innerMarkup)) !== null) {
    tspans.push(match[1]!);
  }
  if (tspans.length > 0) return tspans.join("");
  return innerMarkup.replace(/<[^>]+>/g, "");
}

function listPlaceholdersInConcatenatedText(text: string): string[] {
  const found = new Set<string>();
  const re = new RegExp(JAPANESE_NOTATION_SVG_PLACEHOLDER_RE.source, "gi");
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    found.add(match[1]!);
  }
  return [...found];
}

/** Lists notation placeholder token names present in SVG markup (sorted, unique). */
export function listJapaneseNotationPlaceholdersInSvg(svgText: string): string[] {
  const found = new Set<string>();
  for (const token of listPlaceholdersInConcatenatedText(svgText)) {
    found.add(token);
  }
  const textRe = /<text(\s[^>]*)>([\s\S]*?)<\/text>/gi;
  let textMatch: RegExpExecArray | null;
  while ((textMatch = textRe.exec(svgText)) !== null) {
    for (const token of listPlaceholdersInConcatenatedText(
      concatSvgTextElementContent(textMatch[2]!),
    )) {
      found.add(token);
    }
  }
  const groupRe = /<g isolation="isolate">([\s\S]*?)<\/g>/gi;
  let groupMatch: RegExpExecArray | null;
  while ((groupMatch = groupRe.exec(svgText)) !== null) {
    for (const token of listPlaceholdersInConcatenatedText(concatAllTextInMarkup(groupMatch[1]!))) {
      found.add(token);
    }
  }
  const adjacentTextRunRe = /((?:<text(?:\s[^>]*)>[\s\S]*?<\/text>\s*)+)/gi;
  let runMatch: RegExpExecArray | null;
  while ((runMatch = adjacentTextRunRe.exec(svgText)) !== null) {
    const run = runMatch[1]!;
    const textParts = [...run.matchAll(/<text(\s[^>]*)>([\s\S]*?)<\/text>/gi)];
    if (textParts.length < 2) continue;
    const concatenated = textParts.map((p) => concatSvgTextElementContent(p[2]!)).join("");
    for (const token of listPlaceholdersInConcatenatedText(concatenated)) {
      found.add(token);
    }
  }
  return [...found].sort();
}

/** Tokens still present after replacement (should be empty for a complete diagram). */
export function findUnreplacedJapaneseNotationPlaceholders(svgText: string): string[] {
  return listJapaneseNotationPlaceholdersInSvg(svgText);
}

/** Throws when the SVG still contains notation placeholders or the map is missing keys. */
export function assertJapaneseNotationSvgFullyReplaced(
  svgText: string,
  replacements: Record<string, string>,
): void {
  const expected = listJapaneseNotationPlaceholdersInSvg(svgText);
  const missingKeys = expected.filter((key) => replacements[key] === undefined);
  if (missingKeys.length > 0) {
    throw new Error(
      `Japanese notation SVG missing replacement keys: ${missingKeys.join(", ")}`,
    );
  }
  const applied = applyJapaneseNotationSvgReplacements(svgText, replacements);
  const leftover = findUnreplacedJapaneseNotationPlaceholders(applied);
  if (leftover.length > 0) {
    throw new Error(
      `Japanese notation SVG has unreplaced placeholders: ${leftover.join(", ")}`,
    );
  }
}

/** Default line spacing multiplier for multiline notation tspans. */
const MULTILINE_LINE_HEIGHT_EM = 1.2;

/** Fixed sample values for SVG renderer unit tests only. */
export const SAMPLE_JP_BACK_NOTATION_REPLACEMENTS: Record<string, string> = {
  "jp-caston": "co199",
  "jp-body-rows": "146r",
  "jp-armhole-bo": "bo10",
  "jp-armhole-shaping": "1s-2r-10x",
  "jp-neckline-bo": "bo14",
  "jp-neckline-shaping": "1s-2r-4x\n2s-1r-1x\n3s-2r-2x",
  "jp-shoulder-shaping": "bo5s-2r-1x\nbo4s-2r-4x",
  "rc-caston": "rc000",
  "rc-hem": "rc020",
  "rc-neckline-start": "rc014",
  "rc-armhole-bo": "rc187",
  rc_reset: "↺ rc000",
};

const DEFAULT_FONT_SIZE_PX = 12;

export function normalizeSvgMarkupInput(svgText: string): string {
  return svgText.replace(/^\uFEFF/, "").replace(/^<\?xml[\s\S]*?\?>\s*/, "");
}

function escapeXmlText(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function placeholderPattern(key: string): RegExp {
  const safeKey = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`\\{\\{\\s*${safeKey}\\s*\\}\\}`, "g");
}

function isExactPlaceholderConcatenation(concatenated: string, key: string): boolean {
  const safeKey = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`^\\{\\{\\s*${safeKey}\\s*\\}\\}$`).test(concatenated);
}

function buildReplacementTextElement(
  attrs: string,
  firstInner: string,
  value: string,
  classFontSizes: Map<string, number>,
): string {
  const lines = value.split(/\r?\n/);
  while (lines.length > 0 && lines[lines.length - 1] === "") lines.pop();

  if (lines.length <= 1) {
    const text = escapeXmlText(lines[0] ?? "");
    return `<text${attrs}>${replaceSingleLineTextInner(firstInner, text)}</text>`;
  }

  const firstTspanAttrs = firstTspanOpenAttrs(firstInner);
  const fontSizePx = fontSizePxForTextOpenTag(attrs, classFontSizes);
  const tspans = buildMultilineTspanMarkup(lines, firstTspanAttrs, fontSizePx);
  return `<text${attrs}>${tspans}</text>`;
}

function textElementContainsPlaceholder(innerMarkup: string, key: string): boolean {
  return placeholderPattern(key).test(concatSvgTextElementContent(innerMarkup));
}

function parseSvgClassFontSizes(svgText: string): Map<string, number> {
  const sizes = new Map<string, number>();
  const blockRe = /\.([a-zA-Z0-9_-]+)\s*\{([^}]*)\}/g;
  let blockMatch: RegExpExecArray | null;
  while ((blockMatch = blockRe.exec(svgText)) !== null) {
    const className = blockMatch[1];
    const body = blockMatch[2];
    const fontMatch = /font-size:\s*([\d.]+)px/i.exec(body);
    if (fontMatch) {
      sizes.set(className, Number(fontMatch[1]));
    }
  }
  return sizes;
}

function fontSizePxForTextOpenTag(openTag: string, classFontSizes: Map<string, number>): number {
  const inlineMatch = /font-size:\s*([\d.]+)px/i.exec(openTag);
  if (inlineMatch) return Number(inlineMatch[1]);

  const classMatch = /class="([^"]+)"/i.exec(openTag);
  if (classMatch) {
    for (const token of classMatch[1].trim().split(/\s+/)) {
      const size = classFontSizes.get(token);
      if (size != null && Number.isFinite(size)) return size;
    }
  }
  return DEFAULT_FONT_SIZE_PX;
}

function attrValue(attrs: string, name: string): string | undefined {
  const re = new RegExp(`\\b${name}="([^"]*)"`, "i");
  const m = re.exec(attrs);
  return m ? m[1] : undefined;
}

function firstTspanOpenAttrs(inner: string): string {
  const match = /<tspan(\s[^>]*)>/i.exec(inner);
  return match ? match[1]! : "";
}

/**
 * Stack multiline notation for bottom-up reading (matches `.ns-notation-overlay__stack`
 * `flex-direction: column-reverse` — first line in the replacement string sits lowest).
 * Replacement string line order is unchanged; only tspan paint order is reversed.
 */
function buildMultilineTspanMarkup(
  lines: readonly string[],
  firstTspanAttrs: string,
  fontSizePx: number,
): string {
  const x = attrValue(firstTspanAttrs, "x") ?? "0";
  const y = attrValue(firstTspanAttrs, "y") ?? "0";
  const lineHeight = Math.round(fontSizePx * MULTILINE_LINE_HEIGHT_EM * 10) / 10;
  const firstAttrs =
    firstTspanAttrs.trim().length > 0 ? firstTspanAttrs : ` x="${x}" y="${y}"`;

  const stackLines = [...lines].reverse();

  return stackLines
    .map((line, index) => {
      const text = escapeXmlText(line);
      if (index === 0) {
        return `<tspan${firstAttrs}>${text}</tspan>`;
      }
      return `<tspan x="${x}" dy="${lineHeight}">${text}</tspan>`;
    })
    .join("");
}

function replaceSingleLineTextInner(inner: string, escapedValue: string): string {
  const firstTspanAttrs = firstTspanOpenAttrs(inner);
  if (firstTspanAttrs.length > 0) {
    return `<tspan${firstTspanAttrs}>${escapedValue}</tspan>`;
  }
  return escapedValue;
}

function isolateGroupContainsPlaceholder(inner: string, key: string): boolean {
  return placeholderPattern(key).test(concatAllTextInMarkup(inner));
}

/** Replace placeholders split across sibling `<text>` in `<g isolation="isolate">` (front notation export). */
function replacePlaceholderInIsolateGroups(
  svgText: string,
  key: string,
  value: string,
  classFontSizes: Map<string, number>,
): string {
  const groupRe = /<g isolation="isolate">([\s\S]*?)<\/g>/gi;
  return svgText.replace(groupRe, (full, inner: string) => {
    if (!isolateGroupContainsPlaceholder(inner, key)) return full;

    const firstTextRe = /<text(\s[^>]*)>([\s\S]*?)<\/text>/i;
    const firstMatch = firstTextRe.exec(inner);
    if (!firstMatch) return full;

    const attrs = firstMatch[1] ?? "";
    const firstInner = firstMatch[2] ?? "";
    const innerWithoutText = inner.replace(/<text[\s\S]*?<\/text>/gi, "");

    const replacementText = buildReplacementTextElement(attrs, firstInner, value, classFontSizes);

    return `<g isolation="isolate">${replacementText}${innerWithoutText}</g>`;
  });
}

/** Replace one placeholder split across a minimal consecutive `<text>` span inside a longer run. */
function replaceKeyInAdjacentTextPartSequence(
  textParts: RegExpMatchArray[],
  key: string,
  value: string,
  classFontSizes: Map<string, number>,
): string {
  const chunks: string[] = [];
  let i = 0;
  while (i < textParts.length) {
    let j = i;
    let concatenated = "";
    let matchedEnd = -1;
    while (j < textParts.length) {
      concatenated += concatSvgTextElementContent(textParts[j]![2] ?? "");
      if (isExactPlaceholderConcatenation(concatenated, key)) {
        matchedEnd = j;
        break;
      }
      const tokens = listPlaceholdersInConcatenatedText(concatenated);
      if (tokens.length > 1) break;
      if (tokens.length === 1 && tokens[0] !== key) break;
      j += 1;
    }
    if (matchedEnd >= 0) {
      const attrs = textParts[i]![1] ?? "";
      const firstInner = textParts[i]![2] ?? "";
      chunks.push(buildReplacementTextElement(attrs, firstInner, value, classFontSizes));
      i = matchedEnd + 1;
    } else {
      const part = textParts[i]!;
      chunks.push(`<text${part[1] ?? ""}>${part[2] ?? ""}</text>`);
      i += 1;
    }
  }
  return chunks.join("");
}

/**
 * Replace placeholders split across consecutive sibling `<text>` nodes (Illustrator layer export).
 */
function replacePlaceholderInAdjacentTextRuns(
  svgText: string,
  key: string,
  value: string,
  classFontSizes: Map<string, number>,
): string {
  const adjacentTextRunRe = /((?:<text(?:\s[^>]*)>[\s\S]*?<\/text>\s*)+)/gi;
  return svgText.replace(adjacentTextRunRe, (run) => {
    const textParts = [...run.matchAll(/<text(\s[^>]*)>([\s\S]*?)<\/text>/gi)];
    if (textParts.length < 2) return run;
    return replaceKeyInAdjacentTextPartSequence(textParts, key, value, classFontSizes);
  });
}

function replacePlaceholderInTextElements(
  svgText: string,
  key: string,
  value: string,
  classFontSizes: Map<string, number>,
): string {
  const lines = value.split(/\r?\n/);
  while (lines.length > 0 && lines[lines.length - 1] === "") lines.pop();

  const textRe = /<text(\s[^>]*)?>([\s\S]*?)<\/text>/gi;
  return svgText.replace(textRe, (full, openAttrs: string | undefined, inner: string) => {
    if (!textElementContainsPlaceholder(inner, key)) return full;

    const attrs = openAttrs ?? "";

    if (lines.length <= 1) {
      const text = escapeXmlText(lines[0] ?? "");
      const newInner = replaceSingleLineTextInner(inner, text);
      return `<text${attrs}>${newInner}</text>`;
    }

    const firstTspanAttrs = firstTspanOpenAttrs(inner);
    const fontSizePx = fontSizePxForTextOpenTag(attrs, classFontSizes);
    const tspans = buildMultilineTspanMarkup(lines, firstTspanAttrs, fontSizePx);
    return `<text${attrs}>${tspans}</text>`;
  });
}

/**
 * Replace `{{token}}` placeholders in Japanese notation SVG markup.
 * Multiline values expand to stacked `tspan` elements; single-line values use plain substitution.
 */
export function applyJapaneseNotationSvgReplacements(
  svgText: string,
  replacements: Record<string, string> = SAMPLE_JP_BACK_NOTATION_REPLACEMENTS,
): string {
  let out = normalizeSvgMarkupInput(svgText);
  const classFontSizes = parseSvgClassFontSizes(out);

  for (const [key, rawValue] of Object.entries(replacements)) {
    const value = rawValue == null ? "" : String(rawValue);
    // Split-token exports (front jp-diagram) before single-<text> replacement (back + front).
    out = replacePlaceholderInIsolateGroups(out, key, value, classFontSizes);
    out = replacePlaceholderInAdjacentTextRuns(out, key, value, classFontSizes);
    out = replacePlaceholderInTextElements(out, key, value, classFontSizes);
  }

  return out;
}

/** Fetch back Japanese notation SVG and apply sample (or custom) replacements — browser / print routes. */
export async function loadJapaneseNotationBackSvgMarkup(
  replacements: Record<string, string> = SAMPLE_JP_BACK_NOTATION_REPLACEMENTS,
): Promise<string> {
  const res = await fetch(JP_BACK_NOTATION_SVG_SRC, { credentials: "same-origin" });
  if (!res.ok) {
    throw new Error(`Failed to load SVG: ${JP_BACK_NOTATION_SVG_SRC} (${res.status})`);
  }
  const svgText = await res.text();
  return applyJapaneseNotationSvgReplacements(svgText, replacements);
}
