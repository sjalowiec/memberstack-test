/**
 * Live neckline / shoulder shaping chart rows from sleeveless back calculations (back piece only).
 */

import { calculateNecklineShaping } from "./legoBlocks/necklineShaping";
import { calculateSlopeShaping } from "./legoBlocks/slopeShaping";
import type { NeckShoulderShapingChartRow } from "./neckShoulderShapingChart";

/** Inputs derived from generateSleevelessBackPattern (back shoulder + neck numbers). */
export type NeckShoulderShapingPatternNumbers = {
  /** Machine row of center neckline bind-off (first chart row). */
  firstShapingRow: number;
  /** Stitches in each shoulder after armhole, before neckline shaping. */
  shoulderStitchesPerSide: number;
  /** Center back neck stitches to bind off on the first row. */
  centerNeckBindOff: number;
  /** Work rows after the center row for neck-edge + shoulder-edge shaping (matches sleeveless nRows). */
  shapingWorkRows: number;
};

function expandNecklineSteps(stitchesPerRow: { stitches: number; times: number }[]): number[] {
  const out: number[] = [];
  for (const s of stitchesPerRow) {
    for (let t = 0; t < s.times; t++) {
      out.push(s.stitches);
    }
  }
  return out;
}

function expandSlopeSteps(steps: { stitches: number; times: number }[]): number[] {
  const out: number[] = [];
  for (const s of steps) {
    for (let t = 0; t < s.times; t++) {
      out.push(s.stitches);
    }
  }
  return out;
}

/**
 * Builds chart rows for the back neckline / shoulder section: center bind-off first,
 * then neck-edge + shoulder-edge shaping with combined actions when both occur on one row.
 */
export function buildNeckShoulderShapingChartRows(
  patternNumbers: NeckShoulderShapingPatternNumbers
): NeckShoulderShapingChartRow[] {
  const firstRow = Math.floor(patternNumbers.firstShapingRow);
  const S = Math.round(patternNumbers.shoulderStitchesPerSide);
  const N = Math.round(patternNumbers.centerNeckBindOff);
  const workRows = Math.floor(patternNumbers.shapingWorkRows);

  if (
    !Number.isFinite(firstRow) ||
    !Number.isFinite(S) ||
    !Number.isFinite(N) ||
    !Number.isFinite(workRows)
  ) {
    return [];
  }
  if (S <= 0 || N <= 0 || workRows <= 0) {
    return [];
  }

  const rows: NeckShoulderShapingChartRow[] = [];

  rows.push({
    row: firstRow,
    action: "Neck",
    leftSide: "-",
    leftNeck: "-",
    centerNeck: `-${N}`,
    rightNeck: "-",
    rightSide: "-",
    leftStitchCount: S,
    rightStitchCount: S,
  });

  /** Neck stitches to remove per shoulder toward the opening (remaining comes off at shoulder edge). */
  let neckTotalPerSide = Math.min(S - 1, Math.max(0, Math.min(Math.floor(N / 2), Math.ceil(workRows / 2))));
  if (neckTotalPerSide === 0 && S > 1) {
    neckTotalPerSide = 1;
  }

  let shoulderTotalPerSide = S - neckTotalPerSide;
  if (shoulderTotalPerSide < 1) {
    shoulderTotalPerSide = Math.min(S, Math.max(1, S - 1));
    neckTotalPerSide = S - shoulderTotalPerSide;
  }

  const neckStepCount = Math.min(workRows, Math.max(1, neckTotalPerSide));
  const neckSteps =
    neckTotalPerSide > 0 ? calculateNecklineShaping(neckTotalPerSide, neckStepCount) : [];
  const neckExpanded = expandNecklineSteps(neckSteps);

  const shoulderEvenBudget = workRows % 2 === 0 ? workRows : workRows - 1;
  const slopeRows = Math.max(2, shoulderEvenBudget);
  const slopeSteps =
    shoulderTotalPerSide > 0 ? calculateSlopeShaping(slopeRows, shoulderTotalPerSide) : [];
  const shoulderExpanded = expandSlopeSteps(slopeSteps);

  const neckPerRow = Array(workRows).fill(0);
  for (let i = 0; i < workRows && i < neckExpanded.length; i++) {
    neckPerRow[i] = neckExpanded[i];
  }

  const shoulderPerRow = Array(workRows).fill(0);
  for (let si = 0; si < shoulderExpanded.length; si++) {
    shoulderPerRow[si] = shoulderExpanded[si];
  }

  let left = S;
  let right = S;

  for (let i = 0; i < workRows; i++) {
    const nDec = neckPerRow[i];
    const sDec = shoulderPerRow[i];
    if (nDec <= 0 && sDec <= 0) {
      continue;
    }

    left -= nDec + sDec;
    right -= nDec + sDec;

    let action: string;
    if (nDec > 0 && sDec > 0) {
      action = "Shoulder / Neck";
    } else if (nDec > 0) {
      action = "Neck";
    } else {
      action = "Shoulder";
    }

    const fmt = (v: number) => (v > 0 ? `-${v}` : "-");

    rows.push({
      row: firstRow + 1 + i,
      action,
      leftSide: fmt(sDec),
      leftNeck: fmt(nDec),
      centerNeck: "-",
      rightNeck: fmt(nDec),
      rightSide: fmt(sDec),
      leftStitchCount: Math.max(0, left),
      rightStitchCount: Math.max(0, right),
    });
  }

  return rows;
}
