/**
 * Shared Sleeveless Back garment geometry.
 *
 * One approved silhouette (from generated Back Stitches & Rows) used by both
 * Stitches & Rows and Shaping Notation. Presentation only — no pattern math.
 */

import type { SleevelessBackStsRowsDiagramModel } from "./sleevelessBackStsRowsDiagramModel";

export const SLEEVELESS_BACK_GARMENT_VB_W = 400;
export const SLEEVELESS_BACK_GARMENT_VB_H = 480;
export const SLEEVELESS_BACK_GARMENT_LABEL_GUTTER = 96;
export const SLEEVELESS_BACK_GARMENT_RIGHT_PAD = 86;
export const SLEEVELESS_BACK_GARMENT_TOP = 76;
export const SLEEVELESS_BACK_GARMENT_BOTTOM = 428;
const REF_BUST_STS = 80;

/** Visual band limits — presentation only. Labels keep true rows / inches. */
export const SLEEVELESS_BACK_STS_ROWS_VISUAL = {
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
  /**
   * Presentation-only Back neck U depth in px. The shared RC→Y bands can drop a
   * 6-row / 1 in back neck past the shoulder line; labels still use true rows / inches.
   */
  minBackNeckDepth: 10,
  maxBackNeckDepth: 16,
} as const;

export type SleevelessBackGarmentYBand = {
  rc0: number;
  rc1: number;
  yBottom: number;
  yTop: number;
};

export type SleevelessBackGarmentPt = { x: number; y: number };

export type SleevelessBackGarmentFrame = {
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
  lastDecreaseRc: number;
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
  rcMappedNeckH: number;
  visualGarmentH: number;
  trueAfterWidth: number;
  upperScale: number;
};

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

export function sleevelessBackGarmentFmtNum(n: number): string {
  if (!Number.isFinite(n)) return "0";
  return String(Math.round(n * 100) / 100);
}

export function sleevelessBackYAtRc(
  rc: number,
  bands: readonly SleevelessBackGarmentYBand[],
): number {
  if (bands.length === 0) return SLEEVELESS_BACK_GARMENT_BOTTOM;
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

function allocateBands(args: {
  hemRc: number;
  armholeStartRc: number;
  shoulderRc: number;
  endRc: number;
  hemRows: number;
  bodyRows: number;
  armholeRows: number;
  rowsPerInch: number;
}): {
  bands: SleevelessBackGarmentYBand[];
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
  const usable = SLEEVELESS_BACK_GARMENT_BOTTOM - SLEEVELESS_BACK_GARMENT_TOP;

  let hemH = hemIn > 0 ? (hemIn / raw) * usable : 0;
  let bodyH = (bodyIn / raw) * usable;
  let armholeH = (armholeIn / raw) * usable;
  let shoulderH = (shoulderIn / raw) * usable;

  if (hemH > 0) {
    hemH = clamp(hemH, SLEEVELESS_BACK_STS_ROWS_VISUAL.minHem, SLEEVELESS_BACK_STS_ROWS_VISUAL.maxHem);
  }
  bodyH = clamp(bodyH, SLEEVELESS_BACK_STS_ROWS_VISUAL.minBody, SLEEVELESS_BACK_STS_ROWS_VISUAL.maxBody);
  armholeH = clamp(
    armholeH,
    SLEEVELESS_BACK_STS_ROWS_VISUAL.minArmhole,
    SLEEVELESS_BACK_STS_ROWS_VISUAL.maxArmhole,
  );
  shoulderH = clamp(
    shoulderH,
    SLEEVELESS_BACK_STS_ROWS_VISUAL.minShoulder,
    SLEEVELESS_BACK_STS_ROWS_VISUAL.maxShoulder,
  );

  let sum = hemH + bodyH + armholeH + shoulderH;
  if (sum > usable && sum > 0) {
    const k = usable / sum;
    hemH *= k;
    bodyH *= k;
    armholeH *= k;
    shoulderH *= k;
  } else {
    const target = usable * SLEEVELESS_BACK_STS_ROWS_VISUAL.fillTarget;
    if (sum < target) bodyH += target - sum;
  }

  const hemY = SLEEVELESS_BACK_GARMENT_BOTTOM - hemH;
  const armholeStartY = hemY - bodyH;
  const shoulderY = armholeStartY - armholeH;
  const endY = shoulderY - shoulderH;

  const bands: SleevelessBackGarmentYBand[] = [];
  if (hemH > 0 && hemRc > 0) {
    bands.push({ rc0: 0, rc1: hemRc, yBottom: SLEEVELESS_BACK_GARMENT_BOTTOM, yTop: hemY });
  }
  bands.push({
    rc0: hemRc > 0 ? hemRc : 0,
    rc1: armholeStartRc,
    yBottom: hemH > 0 ? hemY : SLEEVELESS_BACK_GARMENT_BOTTOM,
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

export function usesSleevelessBackAlineBodySilhouette(
  model: SleevelessBackStsRowsDiagramModel,
): boolean {
  return model.bodyShape === "aline" && model.widths.hemStitches !== model.widths.bustStitches;
}

function lastArmholeDecreaseRc(model: SleevelessBackStsRowsDiagramModel): number {
  const start = model.armhole.startGarmentRc;
  return model.armhole.events
    .filter((ev) => ev.kind === "decrease")
    .reduce((max, ev) => Math.max(max, ev.garmentRc), start);
}

export function buildSleevelessBackGarmentFrame(
  model: SleevelessBackStsRowsDiagramModel,
): { frame: SleevelessBackGarmentFrame; bands: SleevelessBackGarmentYBand[] } {
  const hemRc = Math.max(0, model.rows.hemRows);
  const armholeStart = Math.max(0, model.armhole.startGarmentRc);
  const neckStart = Math.max(0, model.neckline.startGarmentRc);
  const shoulderRc = Math.max(armholeStart, model.shoulder.startGarmentRc);
  const endRc = Math.max(shoulderRc, model.rows.backFinalRow);
  const bodyRows = Math.max(
    0,
    model.rows.sideSeamRowsAboveHem,
    model.rows.rowsFromCastOnToArmholeStart - hemRc,
  );
  const allocated = allocateBands({
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

  const maxBodyW =
    SLEEVELESS_BACK_GARMENT_VB_W -
    SLEEVELESS_BACK_GARMENT_LABEL_GUTTER -
    SLEEVELESS_BACK_GARMENT_RIGHT_PAD;
  const widthScale = clamp(bustSts / REF_BUST_STS, 0.6, 1.25);
  const bodyWidth = maxBodyW * (widthScale / 1.25);
  const cx = SLEEVELESS_BACK_GARMENT_LABEL_GUTTER + maxBodyW / 2;
  const half = bodyWidth / 2;
  const pxPerStitch = bodyWidth / bustSts;
  const trueAfterWidth = afterSts * pxPerStitch;
  const afterWidth = trueAfterWidth;
  const upperScale = 1;
  const shoulderSideWidth = shoulderSts * pxPerStitch;
  const neckWidth = Math.max(0, afterWidth - 2 * shoulderSideWidth);
  const afterHalf = afterWidth / 2;
  const neckHalf = neckWidth / 2;
  const boInset = Math.max(0, bindOffSts * pxPerStitch);
  const hemHalf = clamp(
    half * (hemSts / bustSts),
    18,
    Math.min(cx - 12, SLEEVELESS_BACK_GARMENT_VB_W - 12 - cx),
  );

  const bottomY = sleevelessBackYAtRc(0, bands);
  const hemY = hemRc > 0 ? sleevelessBackYAtRc(hemRc, bands) : bottomY;
  const armholeStartY = sleevelessBackYAtRc(armholeStart, bands);
  const shapeStartRc = clamp(model.bodyShaping.startRc, 0, armholeStart);
  const shapeEndRc = clamp(model.bodyShaping.endRc, shapeStartRc, armholeStart);
  const shapeStartY = sleevelessBackYAtRc(shapeStartRc, bands);
  const shapeEndY = sleevelessBackYAtRc(shapeEndRc, bands);
  const lastDecreaseRc = lastArmholeDecreaseRc(model);
  const shoulderY = sleevelessBackYAtRc(shoulderRc, bands);
  const lastArmholeY = clamp(
    sleevelessBackYAtRc(lastDecreaseRc, bands),
    shoulderY,
    armholeStartY,
  );
  const rcMappedNeckStartY = sleevelessBackYAtRc(neckStart, bands);
  const lastBand = bands[bands.length - 1];
  const shoulderBandH = lastBand
    ? Math.max(8, shoulderY - lastBand.yTop)
    : SLEEVELESS_BACK_STS_ROWS_VISUAL.minShoulder;
  const hasShoulderSlope = model.shoulder.points.length > 0;
  const shoulderTopY = hasShoulderSlope ? shoulderY - shoulderBandH : shoulderY;
  const neckCornerY = hasShoulderSlope ? shoulderTopY : shoulderY;
  const rcMappedNeckH = Math.max(0, rcMappedNeckStartY - neckCornerY);
  const visualNeckH =
    model.neckline.depthRows > 0
      ? clamp(
          rcMappedNeckH,
          SLEEVELESS_BACK_STS_ROWS_VISUAL.minBackNeckDepth,
          SLEEVELESS_BACK_STS_ROWS_VISUAL.maxBackNeckDepth,
        )
      : 0;
  const neckStartY = neckCornerY + visualNeckH;
  const visualGarmentH = Math.max(0, bottomY - shoulderTopY);

  return {
    frame: {
      cx,
      left: cx - half,
      right: cx + half,
      afterLeft: cx - afterHalf,
      afterRight: cx + afterHalf,
      boLeft: cx - half + boInset,
      boRight: cx + half - boInset,
      neckLeft: cx - neckHalf,
      neckRight: cx + neckHalf,
      hemLeft: cx - hemHalf,
      hemRight: cx + hemHalf,
      bottomY,
      hemY,
      shapeStartY,
      shapeEndY,
      armholeStartY,
      lastArmholeY,
      lastDecreaseRc,
      neckStartY,
      shoulderY,
      neckCornerY,
      shoulderTopY,
      bodyWidth,
      hemWidth: hemHalf * 2,
      afterWidth,
      neckWidth,
      shoulderSideWidth,
      pxPerStitch,
      visualHemH: allocated.hemH,
      visualBodyH: allocated.bodyH,
      visualArmholeH: allocated.armholeH,
      visualShoulderH: allocated.shoulderH,
      visualNeckH,
      rcMappedNeckH,
      visualGarmentH,
      trueAfterWidth,
      upperScale,
    },
    bands,
  };
}

export function sleevelessBackPolylineD(points: readonly SleevelessBackGarmentPt[]): string {
  return points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${sleevelessBackGarmentFmtNum(p.x)} ${sleevelessBackGarmentFmtNum(p.y)}`)
    .join(" ");
}

export function sleevelessBackRoundNecklineCurveD(frame: SleevelessBackGarmentFrame): string {
  return [
    `M ${sleevelessBackGarmentFmtNum(frame.neckLeft)} ${sleevelessBackGarmentFmtNum(frame.neckCornerY)}`,
    `C ${sleevelessBackGarmentFmtNum(frame.neckLeft)} ${sleevelessBackGarmentFmtNum(frame.neckStartY)} ${sleevelessBackGarmentFmtNum(frame.cx)} ${sleevelessBackGarmentFmtNum(frame.neckStartY)} ${sleevelessBackGarmentFmtNum(frame.cx)} ${sleevelessBackGarmentFmtNum(frame.neckStartY)}`,
    `C ${sleevelessBackGarmentFmtNum(frame.cx)} ${sleevelessBackGarmentFmtNum(frame.neckStartY)} ${sleevelessBackGarmentFmtNum(frame.neckRight)} ${sleevelessBackGarmentFmtNum(frame.neckStartY)} ${sleevelessBackGarmentFmtNum(frame.neckRight)} ${sleevelessBackGarmentFmtNum(frame.neckCornerY)}`,
  ].join(" ");
}

export function sleevelessBackBodySidePoints(
  frame: SleevelessBackGarmentFrame,
  side: "left" | "right",
  tapered: boolean,
): SleevelessBackGarmentPt[] {
  const bustX = side === "left" ? frame.left : frame.right;
  const hemX = side === "left" ? frame.hemLeft : frame.hemRight;
  if (!tapered) {
    return [
      { x: bustX, y: frame.bottomY },
      { x: bustX, y: frame.armholeStartY },
    ];
  }
  const pts: SleevelessBackGarmentPt[] = [{ x: hemX, y: frame.bottomY }];
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

export function sleevelessBackArmholePoints(
  frame: SleevelessBackGarmentFrame,
  side: "left" | "right",
): SleevelessBackGarmentPt[] {
  if (side === "left") {
    return [
      { x: frame.left, y: frame.armholeStartY },
      { x: frame.boLeft, y: frame.armholeStartY },
      { x: frame.afterLeft, y: frame.lastArmholeY },
      { x: frame.afterLeft, y: frame.shoulderY },
    ];
  }
  return [
    { x: frame.right, y: frame.armholeStartY },
    { x: frame.boRight, y: frame.armholeStartY },
    { x: frame.afterRight, y: frame.lastArmholeY },
    { x: frame.afterRight, y: frame.shoulderY },
  ];
}

export function sleevelessBackShoulderSegment(
  frame: SleevelessBackGarmentFrame,
  side: "left" | "right",
): SleevelessBackGarmentPt[] {
  if (side === "left") {
    return [
      { x: frame.afterLeft, y: frame.shoulderY },
      { x: frame.neckLeft, y: frame.neckCornerY },
    ];
  }
  return [
    { x: frame.afterRight, y: frame.shoulderY },
    { x: frame.neckRight, y: frame.neckCornerY },
  ];
}

export function sleevelessBackSilhouettePathD(
  frame: SleevelessBackGarmentFrame,
  tapered: boolean,
): string {
  const leftBody = sleevelessBackBodySidePoints(frame, "left", tapered);
  const rightBody = sleevelessBackBodySidePoints(frame, "right", tapered);
  const fmt = sleevelessBackGarmentFmtNum;
  const upperBody = [
    `L ${fmt(frame.boLeft)} ${fmt(frame.armholeStartY)}`,
    `L ${fmt(frame.afterLeft)} ${fmt(frame.lastArmholeY)}`,
    `L ${fmt(frame.afterLeft)} ${fmt(frame.shoulderY)}`,
    `L ${fmt(frame.neckLeft)} ${fmt(frame.neckCornerY)}`,
    `C ${fmt(frame.neckLeft)} ${fmt(frame.neckStartY)} ${fmt(frame.cx)} ${fmt(frame.neckStartY)} ${fmt(frame.cx)} ${fmt(frame.neckStartY)}`,
    `C ${fmt(frame.cx)} ${fmt(frame.neckStartY)} ${fmt(frame.neckRight)} ${fmt(frame.neckStartY)} ${fmt(frame.neckRight)} ${fmt(frame.neckCornerY)}`,
    `L ${fmt(frame.afterRight)} ${fmt(frame.shoulderY)}`,
    `L ${fmt(frame.afterRight)} ${fmt(frame.lastArmholeY)}`,
    `L ${fmt(frame.boRight)} ${fmt(frame.armholeStartY)}`,
  ];
  if (tapered) {
    return [
      sleevelessBackPolylineD(leftBody),
      ...upperBody,
      ...[...rightBody].reverse().map((p) => `L ${fmt(p.x)} ${fmt(p.y)}`),
      "Z",
    ].join(" ");
  }
  return [
    `M ${fmt(frame.left)} ${fmt(frame.bottomY)}`,
    `L ${fmt(frame.left)} ${fmt(frame.armholeStartY)}`,
    ...upperBody,
    `L ${fmt(frame.right)} ${fmt(frame.armholeStartY)}`,
    `L ${fmt(frame.right)} ${fmt(frame.bottomY)}`,
    "Z",
  ].join("");
}
