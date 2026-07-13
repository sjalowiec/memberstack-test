/**
 * Apply `{{TOKEN}}` replacements to sleeveless garment schematic SVGs.
 * Illustrator often splits long placeholders across multiple `<tspan>` elements on export.
 */

import {
  concatSvgTextElementContent,
  normalizeSvgMarkupInput,
} from "./sleevelessJapaneseNotationSvg";

/** Merge split tspans when concatenated text still contains `{{…}}` placeholders. */
export function repairIllustratorSplitGarmentPlaceholders(svgText: string): string {
  const textRe = /<text(\s[^>]*)?>([\s\S]*?)<\/text>/gi;
  return svgText.replace(textRe, (full, attrs: string, inner: string) => {
    if (!/<tspan/i.test(inner)) return full;
    const concatenated = concatSvgTextElementContent(inner);
    if (!/\{\{/.test(concatenated)) return full;
    const firstTspanMatch = /<tspan(\s[^>]*)>/i.exec(inner);
    const tspanAttrs = firstTspanMatch ? firstTspanMatch[1] : "";
    return `<text${attrs}><tspan${tspanAttrs}>${concatenated}</tspan></text>`;
  });
}

/** True when the schematic has a hem-depth dimension line but no hem label placeholders. */
export function svgNeedsHemDepthMeasurementLabels(svgText: string): boolean {
  return /id="hem_line"/.test(svgText) && !/\{\{\s*HEM_ROWS\s*\}\}/.test(svgText);
}

function parseHemLineAnchor(svgText: string): { x: number; yTop: number } | null {
  const groupMatch = svgText.match(/<g id="hem_line">([\s\S]*?)<\/g>/i);
  if (!groupMatch) return null;
  const lineMatch = groupMatch[1].match(/<line[^>]*\bx1="([\d.]+)"[^>]*\by1="([\d.]+)"/i);
  if (!lineMatch) return null;
  const x = Number(lineMatch[1]);
  const yTop = Number(lineMatch[2]);
  if (!Number.isFinite(x) || !Number.isFinite(yTop)) return null;
  return { x, yTop };
}

function fmtTranslate(x: number, y: number): string {
  const rx = Math.round(x * 100) / 100;
  const ry = Math.round(y * 100) / 100;
  return `translate(${rx} ${ry})`;
}

/** Inject `HEM_MEASUREMENT` label placeholders when Illustrator exports omit them. */
export function repairMissingHemDepthMeasurementLabels(svgText: string): string {
  if (!svgNeedsHemDepthMeasurementLabels(svgText)) return svgText;

  const viewBox = svgText.match(/viewBox="([^"]+)"/)?.[1] ?? "";
  const isLegacyStraightBack = viewBox.startsWith("0 0 254");
  const hemAnchor = parseHemLineAnchor(svgText);

  let rowsTransform: string;
  let inchesTransform: string;
  let rowsText: string;
  let inchesText: string;

  if (isLegacyStraightBack && hemAnchor) {
    rowsTransform = fmtTranslate(hemAnchor.x - 22.3, hemAnchor.yTop + 16.61);
    inchesTransform = fmtTranslate(hemAnchor.x - 26.7, hemAnchor.yTop + 27.41);
    rowsText = `<text class="st10" transform="${rowsTransform}"><tspan x="0" y="0" xml:space="preserve"> {{HEM_ROWS}} rows</tspan></text>`;
    inchesText = `<text class="st9" transform="${inchesTransform}"><tspan x="0" y="0" xml:space="preserve">      ({{HEM_INCHES}} {{UNIT}})</tspan></text>`;
  } else {
    rowsTransform = fmtTranslate(16.95, 266.47);
    inchesTransform = fmtTranslate(12.55, 277.27);
    rowsText = `<text transform="${rowsTransform}" fill="#010101" font-family="ArialMT, Arial" font-size="12" isolation="isolate"><tspan x="0" y="0" xml:space="preserve"> {{HEM_ROWS}} rows</tspan></text>`;
    inchesText = `<text transform="${inchesTransform}" fill="#565656" font-family="ArialMT, Arial" font-size="9" isolation="isolate"><tspan x="0" y="0" xml:space="preserve">      ({{HEM_INCHES}} {{UNIT}})</tspan></text>`;
  }

  const hemMeasurementGroup = `<g id="HEM_MEASUREMENT" isolation="isolate"><g isolation="isolate"><g isolation="isolate"><g isolation="isolate"><g isolation="isolate"><g isolation="isolate"><g isolation="isolate"><g isolation="isolate">${rowsText}</g></g></g></g></g></g><g isolation="isolate"><g isolation="isolate"><g isolation="isolate"><g isolation="isolate"><g isolation="isolate"><g isolation="isolate">${inchesText}</g></g></g></g></g></g></g></g>`;

  const measurementsOpen = /<g id="measurements">/i;
  if (measurementsOpen.test(svgText)) {
    return svgText.replace(measurementsOpen, `<g id="measurements">${hemMeasurementGroup}`);
  }
  const svgTail = /<\/svg>\s*$/i;
  if (svgTail.test(svgText)) {
    return svgText.replace(svgTail, `${hemMeasurementGroup}</svg>`);
  }
  return `${svgText}${hemMeasurementGroup}`;
}

export function applyGarmentDiagramSvgReplacements(
  svgText: string,
  replacements: Record<string, string>,
): string {
  let out = normalizeSvgMarkupInput(svgText);
  out = repairMissingHemDepthMeasurementLabels(out);
  out = repairIllustratorSplitGarmentPlaceholders(out);
  for (const [k, v] of Object.entries(replacements)) {
    const safeKey = String(k).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`\\{\\{\\s*${safeKey}\\s*\\}\\}`, "g");
    out = out.replace(re, v == null ? "" : String(v));
  }
  return out;
}
