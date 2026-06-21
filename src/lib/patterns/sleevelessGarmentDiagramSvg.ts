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

export function applyGarmentDiagramSvgReplacements(
  svgText: string,
  replacements: Record<string, string>,
): string {
  let out = normalizeSvgMarkupInput(svgText);
  out = repairIllustratorSplitGarmentPlaceholders(out);
  for (const [k, v] of Object.entries(replacements)) {
    const safeKey = String(k).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`\\{\\{\\s*${safeKey}\\s*\\}\\}`, "g");
    out = out.replace(re, v == null ? "" : String(v));
  }
  return out;
}
