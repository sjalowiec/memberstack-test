/**
 * A-line body shaping guide overlays for sleeveless garment schematics.
 * Uses {@link SleevelessBodyDiagramGuides} from the body block only — no hip/bust inference here.
 */

import type { SleevelessBodyDiagramGuides } from "./bodyBlock/sleevelessBodyBlock";

/** Brand / measurement diagram green — matches existing schematic accents. */
export const SLEEVELESS_BODY_SHAPE_GUIDE_STROKE = "#52682d";

export type SleevelessGarmentDiagramLayout = "back" | "front";

/** Fixed anchors on pullover back/front artwork (viewBox coordinates). */
const PULLOVER_LAYOUT: Record<
  SleevelessGarmentDiagramLayout,
  { bustY: number; hemY: number; leftBustX: number; rightBustX: number; seamOutset: number }
> = {
  back: { bustY: 131.5, hemY: 256, leftBustX: 40.5, rightBustX: 169.5, seamOutset: 3 },
  front: { bustY: 115, hemY: 242, leftBustX: 40.5, rightBustX: 169.5, seamOutset: 3 },
};

/** Max hem-side horizontal offset for guide endpoints (visual only — not body-block math). */
const MAX_GUIDE_OFFSET_PX = 22;
/** Scales stitch-derived offset so A-line reads clearly at schematic scale. */
const VISUAL_FLARE_MULTIPLIER = 2;
/**
 * Minimum outward push at the hem endpoint only (bust anchors unchanged).
 * Ensures moderate A-lines (e.g. bust 38 / hip 44) read clearly on the schematic.
 */
const MIN_HEM_FLARE_OFFSET_PX = 15;

function guideOffsetPx(guides: SleevelessBodyDiagramGuides): number {
  const { hemStitches, bustStitches } = guides;
  if (bustStitches <= 0) return 0;
  const ratio = Math.abs(hemStitches - bustStitches) / bustStitches;
  const scaled = ratio * MAX_GUIDE_OFFSET_PX * VISUAL_FLARE_MULTIPLIER;
  return Math.max(MIN_HEM_FLARE_OFFSET_PX, scaled);
}

/**
 * SVG fragment (inner `<g>`) for dashed side guides, or empty when guides are off.
 */
export function buildBodyShapeGuideSvgFragment(
  guides: SleevelessBodyDiagramGuides | undefined,
  layout: SleevelessGarmentDiagramLayout,
): string {
  if (!guides?.showBodyShapeGuides) return "";
  const { shapingDirection } = guides;
  if (shapingDirection !== "increase" && shapingDirection !== "decrease") return "";

  const offsetPx = guideOffsetPx(guides);
  if (offsetPx <= 0) return "";

  const L = PULLOVER_LAYOUT[layout];
  // Upper endpoints: fixed just outside side seam (seamOutset only — never flare-adjusted).
  const leftBustX = L.leftBustX - L.seamOutset;
  const rightBustX = L.rightBustX + L.seamOutset;
  // Lower endpoints: same bust X; hem X alone moves outward/inward for silhouette cue.
  let leftHemX = leftBustX;
  let rightHemX = rightBustX;

  if (shapingDirection === "decrease") {
    leftHemX -= offsetPx;
    rightHemX += offsetPx;
  } else {
    leftHemX += offsetPx;
    rightHemX -= offsetPx;
  }

  return (
    `<g id="body-shape-guides" aria-hidden="true" pointer-events="none" fill="none" ` +
    `stroke="${SLEEVELESS_BODY_SHAPE_GUIDE_STROKE}" stroke-width="1.5" stroke-miterlimit="10" ` +
    `stroke-dasharray="4 3" stroke-linecap="round" opacity="0.72">` +
    `<line x1="${leftBustX}" y1="${L.bustY}" x2="${leftHemX}" y2="${L.hemY}"/>` +
    `<line x1="${rightBustX}" y1="${L.bustY}" x2="${rightHemX}" y2="${L.hemY}"/>` +
    `</g>`
  );
}

/** Appends guide overlay markup to a parsed garment schematic `<svg>`. */
export function injectBodyShapeGuidesIntoGarmentSvg(
  svg: SVGSVGElement,
  guides: SleevelessBodyDiagramGuides | undefined,
  layout: SleevelessGarmentDiagramLayout,
): void {
  const fragment = buildBodyShapeGuideSvgFragment(guides, layout);
  if (!fragment) return;

  const doc = svg.ownerDocument ?? document;
  const wrapper = doc.createElementNS("http://www.w3.org/2000/svg", "svg");
  wrapper.innerHTML = fragment;
  const guideGroup = wrapper.firstElementChild;
  if (!guideGroup) return;

  svg.appendChild(doc.importNode(guideGroup, true));
}
