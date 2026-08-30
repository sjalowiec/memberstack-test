/**
 * Basic Sock validation helpers — math-layer only (no builder UI).
 *
 * Unusual-gauge detection reuses the pattern-level Gauge Sanity Check Lego block,
 * which is the same evaluator Sweater and Hat already use.
 */

import {
  evaluateGaugeSanity,
  gaugeSanityAcknowledgementKey,
  gaugeSanityBlocksProceed,
  type GaugeSanityResult,
} from "../legoBlocks/gaugeSanity";
import type { SockDraft, SockDraftUnit } from "./sockDraft";
import type { BasicSockCalc } from "./sockMath";

export type SockGaugeSanityGate =
  | { proceed: true; sanity: GaugeSanityResult | null }
  | {
      proceed: false;
      reason: "unusual-gauge";
      sanity: GaugeSanityResult;
      acknowledgementKey: string;
    };

export function sockDraftGaugeRaw(
  draft: Pick<SockDraft, "unit" | "gaugeSlots">,
): { stitch: string; row: string; unit: SockDraftUnit } {
  const unit: SockDraftUnit = draft.unit === "cm" ? "cm" : "inches";
  const slot = draft.gaugeSlots[unit] ?? { stitch: "", row: "" };
  return { stitch: slot.stitch ?? "", row: slot.row ?? "", unit };
}

export function evaluateSockGaugeSanity(
  stitchRaw: string,
  rowRaw: string,
  unit: string | null | undefined,
): GaugeSanityResult | null {
  return evaluateGaugeSanity(stitchRaw, rowRaw, unit);
}

export function evaluateSockGaugeSanityGate(
  stitchRaw: string,
  rowRaw: string,
  unit: string | null | undefined,
  acknowledgedKey: string | null = null,
): SockGaugeSanityGate {
  const sanity = evaluateGaugeSanity(stitchRaw, rowRaw, unit);
  const acknowledgementKey = gaugeSanityAcknowledgementKey(stitchRaw, rowRaw, unit);
  if (gaugeSanityBlocksProceed(sanity, stitchRaw, rowRaw, unit, acknowledgedKey)) {
    return { proceed: false, reason: "unusual-gauge", sanity, acknowledgementKey };
  }
  return { proceed: true, sanity };
}

/** Invariants that must hold for every successful Basic Sock calculation. */
export function basicSockCalcInvariantErrors(calc: BasicSockCalc): string[] {
  const errors: string[] = [];
  if (calc.totalSockStitches < 6) errors.push("totalSockStitches is too small");
  if (calc.totalSockStitches % 2 !== 0) errors.push("totalSockStitches must be even");
  if (calc.footStitches !== calc.totalSockStitches) {
    errors.push("footStitches must equal totalSockStitches");
  }
  if (calc.ankleStitches !== calc.totalSockStitches) {
    errors.push("ankleStitches must equal totalSockStitches");
  }
  if (calc.legStitches < 2) errors.push("legStitches is too small");
  if (calc.legRows < 2) errors.push("legRows is too small");
  if (calc.legStitches % 2 !== 0) errors.push("legStitches must be even");
  if (calc.legStitchChange !== calc.legStitches - calc.footStitches) {
    errors.push("legStitchChange must equal legStitches - footStitches");
  }
  if (calc.legShapingNeeded !== (calc.legStitches !== calc.footStitches)) {
    errors.push("legShapingNeeded does not match stitch difference");
  }
  if (calc.legShapingSchedule !== null) errors.push("legShapingSchedule must remain unresolved");
  if (!(calc.heelDepthInches > 0)) errors.push("heelDepthInches must be positive");
  if (!(calc.toeDepthInches > 0)) errors.push("toeDepthInches must be positive");
  if (!(calc.straightFootLengthInches > 0)) {
    errors.push("straightFootLengthInches must be positive");
  }
  if (calc.straightFootRows < 2 || calc.straightFootRows % 2 !== 0) {
    errors.push("straightFootRows must be a positive even count");
  }
  if (
    Math.abs(
      calc.straightFootLengthInches -
        (calc.footLengthInches - calc.heelDepthInches - calc.toeDepthInches),
    ) > 1e-9
  ) {
    errors.push("straightFootLengthInches must equal foot length minus heel and toe depth");
  }

  for (const label of ["heel", "toe"] as const) {
    const part = calc[label];
    if (part.workingStitches + part.heldStitches !== calc.totalSockStitches) {
      errors.push(`${label} working+held must equal totalSockStitches`);
    }
    if (part.workingStitches < 3) errors.push(`${label} workingStitches is too small`);
    if (part.remainingStitches < 1) errors.push(`${label} remainingStitches is too small`);
    if (part.wrapsEachSide < 1) errors.push(`${label} wrapsEachSide is too small`);
    if (2 * part.wrapsEachSide + part.remainingStitches !== part.workingStitches) {
      errors.push(`${label} wraps are not symmetrical`);
    }
    if (part.shortRowInSteps !== part.shortRowDepthRows) {
      errors.push(`${label} shortRowInSteps must equal one-way shortRowDepthRows`);
    }
    if (part.shortRowOutSteps !== part.shortRowDepthRows) {
      errors.push(`${label} shortRowOutSteps must equal one-way shortRowDepthRows`);
    }
    if (part.shortRowDepthRows !== part.workingStitches - part.remainingStitches) {
      errors.push(`${label} shortRowDepthRows must equal working minus remaining`);
    }
    if (part.shortRowKnittingRows !== part.shortRowInSteps + part.shortRowOutSteps) {
      errors.push(`${label} shortRowKnittingRows must equal in + out`);
    }
    if (part.shortRowKnittingRows !== 2 * part.shortRowDepthRows) {
      errors.push(`${label} knitting rows must not be used as one-way physical depth`);
    }
    if (part.workingStitches % 2 !== part.remainingStitches % 2) {
      errors.push(`${label} remaining must match working parity`);
    }
  }

  if (
    calc.heel.workingStitches !== calc.toe.workingStitches ||
    calc.heel.remainingStitches !== calc.toe.remainingStitches ||
    calc.heel.wrapsEachSide !== calc.toe.wrapsEachSide ||
    calc.heel.shortRowDepthRows !== calc.toe.shortRowDepthRows
  ) {
    errors.push("heel and toe must use identical shaping math");
  }
  if (Math.abs(calc.heelDepthInches - calc.heel.shortRowDepthRows / calc.rowGaugePerInch) > 1e-9) {
    errors.push("heelDepthInches must equal one-way depth rows / row gauge");
  }
  if (Math.abs(calc.toeDepthInches - calc.toe.shortRowDepthRows / calc.rowGaugePerInch) > 1e-9) {
    errors.push("toeDepthInches must equal one-way depth rows / row gauge");
  }

  for (const n of [
    calc.totalSockStitches,
    calc.legStitches,
    calc.legRows,
    calc.heel.workingStitches,
    calc.heel.remainingStitches,
    calc.heel.wrapsEachSide,
    calc.straightFootRows,
    calc.heel.shortRowDepthRows,
    calc.heel.shortRowKnittingRows,
  ]) {
    if (!Number.isFinite(n) || n < 0) errors.push("negative or non-finite stitch/row count");
  }

  return errors;
}
