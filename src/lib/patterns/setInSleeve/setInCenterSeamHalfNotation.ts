/**
 * Shaping-notation tokens for one Set-In Sleeve center-seam half.
 * Reads that half's front timeline, which is the same schedule as its checklist.
 */

import {
  compressStitchDecreasePointsToNotationLines,
  type StitchDecreasePoint,
} from "../shapingNotationCompress";
import {
  formatBindOffNotation,
  formatHoldNotation,
} from "../sleevelessBackJapaneseNotation";
import type { SleevelessBackPatternResult } from "../sleevelessPatternOutput";
import { collectOuterShoulderBindOffPoints } from "../shoulderShapingNotation";
import type { RowEntry } from "../shapingTimeline";

export type SetInCenterSeamHalfNotation = {
  side: "left" | "right";
  /** `bo11` or `hold11`. Empty when the neckline starts with a decrease. */
  neckOpeningToken: string;
  neckOpeningStitches: number;
  /** Armhole-local RC of the first neckline action. */
  neckStartLocalRc?: number;
  neckShapingLines: string[];
  shoulderLines: string[];
  /** Armhole-local RC of the first shoulder bind-off. */
  shoulderStartLocalRc?: number;
  /** Straight rows at the armhole edge after decreases, up to the first shoulder bind-off. */
  armholeStraightRows: number;
};

type InnerPoint = StitchDecreasePoint & { kind: "bindOff" | "decrease" | "hold" };

function frontTimeline(result: SleevelessBackPatternResult): RowEntry[] {
  return result.frontNeckShoulderTimeline ?? result.frontNeckShoulderShapingChart.timeline ?? [];
}

function localRc(garmentRow: number, armholeStart: number): number {
  return Math.floor(garmentRow) - Math.floor(armholeStart);
}

function notationSide(timeline: readonly RowEntry[]): "left" | "right" {
  let left = 0;
  let right = 0;
  for (const entry of timeline) {
    for (const event of entry.events) {
      if (event.edge !== "inner" && event.edge !== "outer") continue;
      if (event.side === "left") left += 1;
      else if (event.side === "right") right += 1;
    }
  }
  return left > right ? "left" : "right";
}

function innerPoints(timeline: readonly RowEntry[], side: "left" | "right"): InnerPoint[] {
  const out: InnerPoint[] = [];
  for (const entry of [...timeline].sort((a, b) => a.row - b.row)) {
    let amount = 0;
    let kind: InnerPoint["kind"] | null = null;
    for (const event of entry.events) {
      if (event.side !== side || event.edge !== "inner") continue;
      if (event.kind !== "bindOff" && event.kind !== "decrease" && event.kind !== "hold") continue;
      if (event.amount <= 0) continue;
      if (kind === null) kind = event.kind;
      amount += event.amount;
    }
    if (kind && amount > 0) out.push({ row: entry.row, amount, kind });
  }
  return out;
}

function openingToken(point: InnerPoint | undefined): string {
  if (!point || point.kind === "decrease") return "";
  return point.kind === "hold" ? formatHoldNotation(point.amount) : formatBindOffNotation(point.amount);
}

/**
 * Set-in center-seam round halves are drawn on the cardigan-front silhouette.
 * Neck, shoulder, and straight-row tokens come from this half's timeline.
 * V-neck halves keep the V-neck diagram.
 */
export function setInCenterSeamHalfNotation(
  result: SleevelessBackPatternResult,
): SetInCenterSeamHalfNotation | null {
  if ((result as { isSetInSleeve?: boolean }).isSetInSleeve !== true) return null;
  if (result.debug.centerSeamStitch !== true) return null;
  if (result.frontNeckShoulderShapingChart.sleevelessFullWidthVNeckFront === true) return null;
  const plan = result.setInArmholePlan;
  if (!plan) return null;
  const armholeStart = result.debug.armholeStartRow;
  if (armholeStart === undefined || !Number.isFinite(armholeStart)) return null;
  const timeline = frontTimeline(result);
  if (timeline.length === 0) return null;

  const side = notationSide(timeline);
  const neck = innerPoints(timeline, side);
  const opening = neck[0] && neck[0].kind !== "decrease" ? neck[0] : undefined;
  const neckRest = opening ? neck.slice(1) : neck;
  const shapingEnd = plan.matchedBindOffRows + plan.decreaseRows;
  const shoulderPoints = collectOuterShoulderBindOffPoints(timeline, side).filter(
    (point) => localRc(point.row, armholeStart) >= shapingEnd,
  );
  const shoulderStartLocalRc = shoulderPoints[0]
    ? Math.max(0, localRc(shoulderPoints[0].row, armholeStart))
    : undefined;

  return {
    side,
    neckOpeningToken: openingToken(opening),
    neckOpeningStitches: opening?.amount ?? 0,
    ...(neck[0] ? { neckStartLocalRc: Math.max(0, localRc(neck[0].row, armholeStart)) } : {}),
    neckShapingLines: compressStitchDecreasePointsToNotationLines(neckRest),
    shoulderLines: compressStitchDecreasePointsToNotationLines(shoulderPoints),
    ...(shoulderStartLocalRc !== undefined ? { shoulderStartLocalRc } : {}),
    armholeStraightRows:
      shoulderStartLocalRc !== undefined
        ? Math.max(0, shoulderStartLocalRc - shapingEnd)
        : plan.straightRows,
  };
}

/** Replace only the trailing straight-row token. Bind-offs and decreases stay as calculated. */
export function replaceSetInCenterSeamArmholeStraightRows(
  lines: readonly string[],
  straightRows: number,
): string[] {
  const straight = Math.max(0, Math.round(straightRows));
  const next = [...lines];
  const last = next[next.length - 1];
  if (last && /^\d+r$/.test(last)) {
    if (straight > 0) next[next.length - 1] = `${straight}r`;
    else next.pop();
    return next;
  }
  if (straight > 0) next.push(`${straight}r`);
  return next;
}
