import { repairIllustratorSplitGarmentPlaceholders } from "../patterns/sleevelessGarmentDiagramSvg";
import {
  applyJapaneseNotationSvgReplacements,
  concatSvgTextElementContent,
  normalizeSvgMarkupInput,
} from "../patterns/sleevelessJapaneseNotationSvg";

export const SKILL_BUILDER_DIAGRAM_BASE_PATH = "/images/skill-builders";

export type SkillBuilderDiagramValues = Record<string, string | number>;

const JP_SHAPING_KEY = "JP-SHAPING";
const JP_LINE_KEYS = ["JP_LINE1", "JP_LINE2", "JP_LINE3"] as const;
const MULTILINE_LINE_HEIGHT_EM = 1.2;
const DEFAULT_FONT_SIZE_PX = 12;

export function skillBuilderDiagramUrl(svg: string): string {
  const name = svg.replace(/\.svg$/i, "");
  return `${SKILL_BUILDER_DIAGRAM_BASE_PATH}/${name}.svg`;
}

function escapeXmlText(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function fontSizePxFromTextAttrs(attrs: string): number {
  const inlineMatch = /font-size="([\d.]+)"/i.exec(attrs);
  if (inlineMatch) return Number(inlineMatch[1]);
  return DEFAULT_FONT_SIZE_PX;
}

function ensureTextAnchorMiddle(attrs: string): string {
  if (/text-anchor=/i.test(attrs)) return attrs;
  return `${attrs} text-anchor="middle"`;
}

function firstTspanOpenAttrs(inner: string): string {
  const match = /<tspan(\s[^>]*)>/i.exec(inner);
  return match ? match[1]! : "";
}

function attrValue(attrs: string, name: string): string | undefined {
  const re = new RegExp(`\\b${name}="([^"]*)"`, "i");
  const m = re.exec(attrs);
  return m ? m[1] : undefined;
}

function parseTranslate(openAttrs: string): { x: number; y: number } | undefined {
  const match = /transform="translate\(([\d.+-]+)[,\s]+([\d.+-]+)\)/i.exec(openAttrs);
  if (!match) return undefined;
  return { x: Number(match[1]), y: Number(match[2]) };
}

function setTranslateX(openAttrs: string, x: number): string {
  const current = parseTranslate(openAttrs);
  if (!current) return openAttrs;
  const xText = Number.isFinite(x) ? String(Math.round(x * 100) / 100) : String(x);
  return openAttrs.replace(
    /transform="translate\([\d.+-]+[,\s]+([\d.+-]+)\)"/i,
    `transform="translate(${xText} ${current.y})"`,
  );
}

/** Horizontal center of the neck-width dimension line (green bar above/below the neck opening). */
export function neckOpeningCenterX(svgText: string): number | undefined {
  const lineRe =
    /<line x1="([\d.+-]+)" y1="([\d.+-]+)" x2="([\d.+-]+)" y2="([\d.+-]+)"[^>]*stroke="#536930"/gi;
  let best: { center: number; y: number; width: number } | undefined;

  for (const match of svgText.matchAll(lineRe)) {
    const x1 = Number(match[1]);
    const y1 = Number(match[2]);
    const x2 = Number(match[3]);
    const y2 = Number(match[4]);
    if (Math.abs(y1 - y2) > 0.5) continue;

    const width = Math.abs(x2 - x1);
    if (width < 20 || width > 140) continue;

    const center = (x1 + x2) / 2;
    const y = (y1 + y2) / 2;
    if (!best || y < best.y || (y === best.y && width < best.width)) {
      best = { center, y, width };
    }
  }

  return best?.center;
}

function centerTspanX(attrs: string): string {
  if (/(\s)x="/i.test(attrs)) {
    return attrs.replace(/\bx="[^"]*"/i, 'x="0"');
  }
  return `${attrs} x="0"`;
}

/**
 * Stack lines upward from a bottom-aligned Illustrator area-text anchor.
 * First line in the value sits on the anchor; later lines use negative dy.
 */
export function buildBottomAnchoredMultilineTspanMarkup(
  lines: readonly string[],
  firstTspanAttrs: string,
  fontSizePx: number,
): string {
  const x = "0";
  const y = attrValue(firstTspanAttrs, "y") ?? "0";
  const lineHeight = Math.round(fontSizePx * MULTILINE_LINE_HEIGHT_EM * 10) / 10;
  const firstAttrs = centerTspanX(
    firstTspanAttrs.trim().length > 0 ? firstTspanAttrs : ` x="${x}" y="${y}"`,
  );

  return lines
    .map((line, index) => {
      const text = escapeXmlText(line);
      if (index === 0) {
        return `<tspan${firstAttrs}>${text}</tspan>`;
      }
      return `<tspan x="${x}" dy="${-lineHeight}">${text}</tspan>`;
    })
    .join("");
}

/** Replace `{{JP-SHAPING}}` in a bottom-aligned, center-justified Illustrator text box. */
export function replaceJpShapingPlaceholder(svgText: string, value: string): string {
  const lines = value.split(/\r?\n/).filter((line) => line.length > 0);
  const placeholderRe = /\{\{\s*JP-SHAPING\s*\}\}/;
  const neckCenterX = neckOpeningCenterX(svgText);

  const textRe = /<text(\s[^>]*)?>([\s\S]*?)<\/text>/gi;
  return svgText.replace(textRe, (full, openAttrs: string | undefined, inner: string) => {
    if (!placeholderRe.test(concatSvgTextElementContent(inner))) return full;

    let attrs = ensureTextAnchorMiddle(openAttrs ?? "");
    if (neckCenterX != null) {
      attrs = setTranslateX(attrs, neckCenterX);
    }

    if (lines.length === 0) {
      return `<text${attrs}></text>`;
    }

    if (lines.length === 1) {
      const tspanAttrs = centerTspanX(
        firstTspanOpenAttrs(inner).length > 0 ? firstTspanOpenAttrs(inner) : ' x="0" y="0"',
      );
      return `<text${attrs}><tspan${tspanAttrs}>${escapeXmlText(lines[0]!)}</tspan></text>`;
    }

    const fontSizePx = fontSizePxFromTextAttrs(openAttrs ?? "");
    const tspans = buildBottomAnchoredMultilineTspanMarkup(
      lines,
      firstTspanOpenAttrs(inner),
      fontSizePx,
    );
    return `<text${attrs}>${tspans}</text>`;
  });
}

/**
 * Replace `{{TOKEN}}` placeholders in a skill builder SVG.
 * Measurement tokens use the shared garment renderer; `JP-SHAPING` uses bottom-anchored
 * multiline stacking centered on the neck-width dimension line.
 */
export function renderSkillBuilderDiagramSvg(
  svgText: string,
  values: SkillBuilderDiagramValues,
): string {
  const replacements = Object.fromEntries(
    Object.entries(values).map(([key, value]) => [key, String(value)]),
  );
  const jpShaping =
    replacements[JP_SHAPING_KEY] ??
    JP_LINE_KEYS.map((key) => replacements[key] ?? "")
      .filter((line) => line.length > 0)
      .join("\n");
  const reservedKeys = new Set<string>([JP_SHAPING_KEY, ...JP_LINE_KEYS]);
  const measurementReplacements = Object.fromEntries(
    Object.entries(replacements).filter(([key]) => !reservedKeys.has(key)),
  );

  let out = normalizeSvgMarkupInput(svgText);
  out = repairIllustratorSplitGarmentPlaceholders(out);
  out = applyJapaneseNotationSvgReplacements(out, measurementReplacements);
  out = replaceJpShapingPlaceholder(out, jpShaping);
  return out;
}

export async function fetchSkillBuilderDiagramSvg(svg: string): Promise<string> {
  const response = await fetch(skillBuilderDiagramUrl(svg));
  if (!response.ok) {
    throw new Error(`Failed to load skill builder diagram: ${skillBuilderDiagramUrl(svg)}`);
  }
  return response.text();
}

export async function loadSkillBuilderDiagram(
  container: HTMLElement,
  svg: string,
  values: SkillBuilderDiagramValues,
): Promise<void> {
  const svgText = await fetchSkillBuilderDiagramSvg(svg);
  container.innerHTML = renderSkillBuilderDiagramSvg(svgText, values);
}
