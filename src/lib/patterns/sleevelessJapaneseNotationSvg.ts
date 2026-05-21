/**
 * Proof-of-concept: Japanese notation garment SVG token replacement.
 * Live values: {@link buildBackJapaneseNotationReplacements} in `sleevelessBackJapaneseNotation.ts`.
 */

export {
  buildBackJapaneseNotationReplacements,
  JP_BACK_NOTATION_SVG_TOKEN_KEYS,
} from "./sleevelessBackJapaneseNotation";

export const JP_BACK_NOTATION_SVG_SRC = "/images/patterns/sleeveless/jp-back-notation.svg";

/** Matches `{{jp-*}}`, `{{rc-*}}`, and `{{rc_reset}}` in concatenated SVG text. */
export const JAPANESE_NOTATION_SVG_PLACEHOLDER_RE =
  /\{\{\s*(jp-[a-z0-9-]+|rc-[a-z0-9-]+|rc_reset)\s*\}\}/gi;

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

  return lines
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
