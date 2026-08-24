/**
 * Shared Sleeveless Front garment geometry.
 *
 * One approved silhouette (from generated Front Stitches & Rows) used by
 * Stitches & Rows and by Cardigan / matching Front notation renderers.
 * Presentation only — no pattern math.
 *
 * Pullover Round notation keeps its own approved canvas gutters so Straight
 * output does not move; it still reuses {@link sleevelessFrontBodySidePoints}.
 */

import type { SleevelessFrontStsRowsDiagramModel } from "./sleevelessFrontStsRowsDiagramModel";

export const SLEEVELESS_FRONT_GARMENT_VB_W = 400;
export const SLEEVELESS_FRONT_GARMENT_VB_H = 480;
export const SLEEVELESS_FRONT_GARMENT_LABEL_GUTTER = 96;
export const SLEEVELESS_FRONT_GARMENT_RIGHT_PAD = 86;
export const SLEEVELESS_FRONT_GARMENT_TOP = 76;
export const SLEEVELESS_FRONT_GARMENT_BOTTOM = 428;
const REF_BUST_STS = 80;

/** Visual band limits — presentation only. Labels keep true rows / inches. */
export const SLEEVELESS_FRONT_STS_ROWS_VISUAL = {
  minHem: 14,
  maxHem: 34,
  minBody: 90,
  maxBody: 196,
  minArmhole: 54,
  maxArmhole: 90,
  minShoulder: 20,
  maxShoulder: 34,
  fillTarget: 0.84,
  maxArmholeFraction: 0.34,
} as const;

export const SLEEVELESS_FRONT_STS_ROWS_VIEWBOX = {
  width: SLEEVELESS_FRONT_GARMENT_VB_W,
  height: SLEEVELESS_FRONT_GARMENT_VB_H,
} as const;

export type SleevelessFrontGarmentYBand = {
  rc0: number;
  rc1: number;
  yBottom: number;
  yTop: number;
};

export type SleevelessFrontGarmentPt = { x: number; y: number };

export type SleevelessFrontGarmentFrame = {
  cx: number;
  left: number;
  right: number;
  afterLeft: number;
  afterRight: number;
  boLeft: number;
  boRight: number;
  neckLeft: number;
  neckRight: number;
  hemLeft: number;
  hemRight: number;
  bottomY: number;
  hemY: number;
  shapeStartY: number;
  shapeEndY: number;
  armholeStartY: number;
  lastArmholeY: number;
  neckStartY: number;
  shoulderY: number;
  neckCornerY: number;
  shoulderTopY: number;
  bodyWidth: number;
  hemWidth: number;
  afterWidth: number;
  neckWidth: number;
  shoulderSideWidth: number;
  pxPerStitch: number;
  visualHemH: number;
  visualBodyH: number;
  visualArmholeH: number;
  visualShoulderH: number;
  visualNeckH: number;
  visualGarmentH: number;
  trueAfterWidth: number;
  upperScale: number;
};

/** Minimal fields needed to draw an A-line side seam on any Front canvas. */
export type SleevelessFrontBodySideFrame = {
  left: number;
  right: number;
  hemLeft: number;
  hemRight: number;
  bottomY: number;
  shapeStartY: number;
  shapeEndY: number;
  armholeStartY: number;
};

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

export function sleevelessFrontGarmentFmtNum(n: number): string {
  if (!Number.isFinite(n)) return "0";
  return String(Math.round(n * 100) / 100);
}

export function sleevelessFrontYAtRc(
  rc: number,
  bands: readonly SleevelessFrontGarmentYBand[],
): number {
  if (bands.length === 0) return SLEEVELESS_FRONT_GARMENT_BOTTOM;
  if (rc <= bands[0]!.rc0) return bands[0]!.yBottom;
  for (let i = 0; i < bands.length; i += 1) {
    const band = bands[i]!;
    const isLast = i === bands.length - 1;
    if (rc <= band.rc1 || isLast) {
      const span = band.rc1 - band.rc0;
      if (!(span > 0)) return band.yBottom;
      const t = clamp((rc - band.rc0) / span, 0, 1);
      return band.yBottom + t * (band.yTop - band.yBottom);
    }
  }
  return bands[bands.length - 1]!.yTop;
}

function sectionInches(rows: number, rowsPerInch: number, fallback: number): number {
  if (rowsPerInch > 0 && rows > 0) return rows / rowsPerInch;
  return fallback;
}

/**
 * Hat-style visual bands: inch-weighted, then clamped so no section becomes a
 * literal row graph. RC order is preserved; yAtRc only interpolates inside a band.
 */
export function allocateSleevelessFrontGarmentBands(args: {
  hemRc: number;
  armholeStartRc: number;
  shoulderRc: number;
  endRc: number;
  hemRows: number;
  bodyRows: number;
  armholeRows: number;
  rowsPerInch: number;
}): {
  bands: SleevelessFrontGarmentYBand[];
  hemH: number;
  bodyH: number;
  armholeH: number;
  shoulderH: number;
} {
  const hemRc = Math.max(0, args.hemRc);
  const armholeStartRc = Math.max(hemRc, args.armholeStartRc);
  const shoulderRc = Math.max(armholeStartRc, args.shoulderRc);
  const endRc = Math.max(shoulderRc, args.endRc);

  const hemIn = args.hemRows > 0 ? sectionInches(args.hemRows, args.rowsPerInch, 0.4) : 0;
  const bodyIn = sectionInches(args.bodyRows, args.rowsPerInch, 1);
  const armholeIn = sectionInches(args.armholeRows, args.rowsPerInch, 1);
  const shoulderIn = 0.4;
  const raw = Math.max(0.01, hemIn + bodyIn + armholeIn + shoulderIn);
  const usable = SLEEVELESS_FRONT_GARMENT_BOTTOM - SLEEVELESS_FRONT_GARMENT_TOP;

  let hemH = hemIn > 0 ? (hemIn / raw) * usable : 0;
  let bodyH = (bodyIn / raw) * usable;
  let armholeH = (armholeIn / raw) * usable;
  let shoulderH = (shoulderIn / raw) * usable;

  if (hemH > 0) {
    hemH = clamp(
      hemH,
      SLEEVELESS_FRONT_STS_ROWS_VISUAL.minHem,
      SLEEVELESS_FRONT_STS_ROWS_VISUAL.maxHem,
    );
  }
  bodyH = clamp(bodyH, SLEEVELESS_FRONT_STS_ROWS_VISUAL.minBody, SLEEVELESS_FRONT_STS_ROWS_VISUAL.maxBody);
  armholeH = clamp(
    armholeH,
    SLEEVELESS_FRONT_STS_ROWS_VISUAL.minArmhole,
    SLEEVELESS_FRONT_STS_ROWS_VISUAL.maxArmhole,
  );
  shoulderH = clamp(
    shoulderH,
    SLEEVELESS_FRONT_STS_ROWS_VISUAL.minShoulder,
    SLEEVELESS_FRONT_STS_ROWS_VISUAL.maxShoulder,
  );

  let sum = hemH + bodyH + armholeH + shoulderH;
  if (sum > usable && sum > 0) {
    const k = usable / sum;
    hemH *= k;
    bodyH *= k;
    armholeH *= k;
    shoulderH *= k;
  } else {
    const target = usable * SLEEVELESS_FRONT_STS_ROWS_VISUAL.fillTarget;
    if (sum < target) bodyH += target - sum;
  }

  const hemY = SLEEVELESS_FRONT_GARMENT_BOTTOM - hemH;
  const armholeStartY = hemY - bodyH;
  const shoulderY = armholeStartY - armholeH;
  const endY = shoulderY - shoulderH;

  const bands: SleevelessFrontGarmentYBand[] = [];
  if (hemH > 0 && hemRc > 0) {
    bands.push({
      rc0: 0,
      rc1: hemRc,
      yBottom: SLEEVELESS_FRONT_GARMENT_BOTTOM,
      yTop: hemY,
    });
  }
  bands.push({
    rc0: hemRc > 0 ? hemRc : 0,
    rc1: armholeStartRc,
    yBottom: hemH > 0 ? hemY : SLEEVELESS_FRONT_GARMENT_BOTTOM,
    yTop: armholeStartY,
  });
  bands.push({
    rc0: armholeStartRc,
    rc1: shoulderRc,
    yBottom: armholeStartY,
    yTop: shoulderY,
  });
  bands.push({
    rc0: shoulderRc,
    rc1: endRc,
    yBottom: shoulderY,
    yTop: endY,
  });
  return { bands, hemH, bodyH, armholeH, shoulderH };
}

export function isSleevelessFrontCardiganModel(
  model: SleevelessFrontStsRowsDiagramModel,
): boolean {
  return model.garmentStyle === "cardigan" && model.frontPiece === "leftFront";
}

export function usesSleevelessFrontAlineBodySilhouette(
  model: SleevelessFrontStsRowsDiagramModel,
): boolean {
  return model.bodyShape === "aline" && model.widths.hemStitches !== model.widths.bustStitches;
}

export function buildSleevelessFrontGarmentFrame(
  model: SleevelessFrontStsRowsDiagramModel,
): { frame: SleevelessFrontGarmentFrame; bands: SleevelessFrontGarmentYBand[] } {
  const hemRc = Math.max(0, model.rows.hemRows);
  const armholeStart = Math.max(0, model.armhole.startGarmentRc);
  const neckStart = Math.max(0, model.neckline.startGarmentRc);
  const shoulderRc = Math.max(armholeStart, model.shoulder.startGarmentRc);
  const endRc = Math.max(shoulderRc, model.rows.frontFinalRow);
  const bodyRows = Math.max(
    0,
    model.rows.sideSeamRowsAboveHem,
    model.rows.rowsFromCastOnToArmholeStart - hemRc,
  );
  const allocated = allocateSleevelessFrontGarmentBands({
    hemRc,
    armholeStartRc: armholeStart,
    shoulderRc,
    endRc,
    hemRows: model.rows.hemRows,
    bodyRows,
    armholeRows: model.rows.armholeRows,
    rowsPerInch: model.rows.rowsPerInch,
  });
  const bands = allocated.bands;

  const bustSts = Math.max(1, model.widths.bustStitches);
  const hemSts = Math.max(1, model.widths.hemStitches);
  const afterSts = Math.max(1, model.widths.stitchesAfterArmhole);
  const shoulderSts = Math.max(0, model.widths.shoulderStitchesPerSide);
  const bindOffSts = Math.max(0, model.armhole.bindOffStsEachSide);
  const cardigan = isSleevelessFrontCardiganModel(model);

  const maxBodyW =
    SLEEVELESS_FRONT_GARMENT_VB_W -
    SLEEVELESS_FRONT_GARMENT_LABEL_GUTTER -
    SLEEVELESS_FRONT_GARMENT_RIGHT_PAD;
  const widthScale = clamp(bustSts / REF_BUST_STS, 0.6, 1.25);
  const bodyWidth = maxBodyW * (widthScale / 1.25);
  const cx = SLEEVELESS_FRONT_GARMENT_LABEL_GUTTER + maxBodyW / 2;
  const half = bodyWidth / 2;
  const pxPerStitch = bodyWidth / bustSts;
  const trueAfterWidth = afterSts * pxPerStitch;
  const afterWidth = trueAfterWidth;
  const upperScale = 1;
  const shoulderSideWidth = shoulderSts * pxPerStitch;
  const neckWidth = Math.max(
    0,
    cardigan ? afterWidth - shoulderSideWidth : afterWidth - 2 * shoulderSideWidth,
  );
  const afterHalf = afterWidth / 2;
  const neckHalf = neckWidth / 2;
  const boInset = Math.max(0, bindOffSts * pxPerStitch);
  const hemHalf = clamp(
    half * (hemSts / bustSts),
    18,
    Math.min(cx - 12, SLEEVELESS_FRONT_GARMENT_VB_W - 12 - cx),
  );
  const left = cx - half;
  const right = cx + half;
  const cardiganHemWidth = clamp(
    hemSts * pxPerStitch,
    18,
    Math.max(18, SLEEVELESS_FRONT_GARMENT_VB_W - 12 - left),
  );
  const hemLeft = cardigan ? left : cx - hemHalf;
  const hemRight = cardigan ? left + cardiganHemWidth : cx + hemHalf;
  const hemWidth = cardigan ? hemRight - hemLeft : hemHalf * 2;
  const afterLeft = cardigan ? left : cx - afterHalf;
  const afterRight = cardigan ? left + afterWidth : cx + afterHalf;
  const neckLeft = cardigan ? left : cx - neckHalf;
  const neckRight = cardigan ? left + neckWidth : cx + neckHalf;
  const boLeft = cardigan ? left : cx - half + boInset;
  const boRight = cx + half - boInset;

  const bottomY = sleevelessFrontYAtRc(0, bands);
  const hemY = hemRc > 0 ? sleevelessFrontYAtRc(hemRc, bands) : bottomY;
  const armholeStartY = sleevelessFrontYAtRc(armholeStart, bands);
  const shapeStartRc = clamp(model.bodyShaping.startRc, 0, armholeStart);
  const shapeEndRc = clamp(model.bodyShaping.endRc, shapeStartRc, armholeStart);
  const shapeStartY = sleevelessFrontYAtRc(shapeStartRc, bands);
  const shapeEndY = sleevelessFrontYAtRc(shapeEndRc, bands);
  const lastArmholeY = sleevelessFrontYAtRc(model.armhole.lastGarmentRc, bands);
  const neckStartY = sleevelessFrontYAtRc(neckStart, bands);
  const shoulderY = sleevelessFrontYAtRc(shoulderRc, bands);
  const lastBand = bands[bands.length - 1];
  const shoulderBandH = lastBand
    ? Math.max(8, shoulderY - lastBand.yTop)
    : SLEEVELESS_FRONT_STS_ROWS_VISUAL.minShoulder;
  const hasShoulderSlope = model.shoulder.points.length > 0;
  const shoulderTopY = hasShoulderSlope ? shoulderY - shoulderBandH : shoulderY;
  const neckCornerY = hasShoulderSlope ? shoulderTopY : shoulderY;
  const visualNeckH = Math.max(0, neckStartY - neckCornerY);
  const visualGarmentH = Math.max(0, bottomY - shoulderTopY);

  return {
    frame: {
      cx,
      left,
      right,
      afterLeft,
      afterRight,
      boLeft,
      boRight,
      neckLeft,
      neckRight,
      hemLeft,
      hemRight,
      bottomY,
      hemY,
      shapeStartY,
      shapeEndY,
      armholeStartY,
      lastArmholeY,
      neckStartY,
      shoulderY,
      neckCornerY,
      shoulderTopY,
      bodyWidth,
      hemWidth,
      afterWidth,
      neckWidth,
      shoulderSideWidth,
      pxPerStitch,
      visualHemH: allocated.hemH,
      visualBodyH: allocated.bodyH,
      visualArmholeH: allocated.armholeH,
      visualShoulderH: allocated.shoulderH,
      visualNeckH,
      visualGarmentH,
      trueAfterWidth,
      upperScale,
    },
    bands,
  };
}

export function sleevelessFrontPolylineD(
  points: readonly SleevelessFrontGarmentPt[],
): string {
  return points
    .map(
      (p, i) =>
        `${i === 0 ? "M" : "L"} ${sleevelessFrontGarmentFmtNum(p.x)} ${sleevelessFrontGarmentFmtNum(p.y)}`,
    )
    .join(" ");
}

export function sleevelessFrontBodySidePoints(
  frame: SleevelessFrontBodySideFrame,
  side: "left" | "right",
  tapered: boolean,
): SleevelessFrontGarmentPt[] {
  const bustX = side === "left" ? frame.left : frame.right;
  const hemX = side === "left" ? frame.hemLeft : frame.hemRight;
  if (!tapered) {
    return [
      { x: bustX, y: frame.bottomY },
      { x: bustX, y: frame.armholeStartY },
    ];
  }
  const pts: SleevelessFrontGarmentPt[] = [{ x: hemX, y: frame.bottomY }];
  if (frame.shapeStartY < frame.bottomY - 0.5) {
    pts.push({ x: hemX, y: frame.shapeStartY });
  }
  if (frame.shapeEndY < frame.shapeStartY - 0.5) {
    pts.push({ x: bustX, y: frame.shapeEndY });
  } else if (Math.abs(hemX - bustX) > 0.5) {
    pts.push({ x: bustX, y: frame.shapeStartY });
  }
  if (frame.armholeStartY < pts[pts.length - 1]!.y - 0.5) {
    pts.push({ x: bustX, y: frame.armholeStartY });
  }
  return pts;
}

/** Right body outline X at a garment Y — hem width, slope, then bust width. */
export function sleevelessFrontRightBodyOutlineXAtY(
  frame: SleevelessFrontBodySideFrame,
  y: number,
  tapered: boolean,
): number {
  if (!tapered) return frame.right;
  if (y >= frame.shapeStartY - 0.01) return frame.hemRight;
  if (y <= frame.shapeEndY + 0.01) return frame.right;
  const span = frame.shapeStartY - frame.shapeEndY;
  if (!(span > 0)) return frame.right;
  const t = clamp((frame.shapeStartY - y) / span, 0, 1);
  return frame.hemRight + t * (frame.right - frame.hemRight);
}

/** Cardigan CF stays vertical; only the right/side-seam edge tapers. */
export function sleevelessFrontCardiganCenterFrontPoints(
  frame: Pick<SleevelessFrontGarmentFrame, "left" | "bottomY" | "neckStartY">,
): SleevelessFrontGarmentPt[] {
  return [
    { x: frame.left, y: frame.bottomY },
    { x: frame.left, y: frame.neckStartY },
  ];
}
