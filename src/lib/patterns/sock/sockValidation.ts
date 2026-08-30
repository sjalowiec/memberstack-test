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
  if (calc.ankleStraightRows < 0) errors.push("ankleStraightRows must not be negative");
  if (calc.legShapingRowsAvailable < 0) {
    errors.push("legShapingRowsAvailable must not be negative");
  }
  if (calc.ankleStraightRows + calc.legShapingRowsAvailable !== calc.legRows) {
    errors.push("straight ankle rows plus remaining shaping rows must equal total leg rows");
  }
  if (!(calc.ankleStraightLengthInches >= 0)) {
    errors.push("ankleStraightLengthInches must not be negative");
  }
  if (calc.legStitchChange !== calc.legStitches - calc.footStitches) {
    errors.push("legStitchChange must equal legStitches - footStitches");
  }
  if (calc.legShapingNeeded !== (calc.legStitches !== calc.footStitches)) {
    errors.push("legShapingNeeded does not match stitch difference");
  }
  errors.push(...sockLegShapingInvariantErrors(calc));
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
    calc.ankleStraightRows,
    calc.legShapingRowsAvailable,
  ]) {
    if (!Number.isFinite(n) || n < 0) errors.push("negative or non-finite stitch/row count");
  }

  return errors;
}

function sockLegShapingInvariantErrors(calc: BasicSockCalc): string[] {
  const errors: string[] = [];
  const schedule = calc.legShapingSchedule;
  if (!schedule) {
    errors.push("legShapingSchedule is required");
    return errors;
  }

  const expectedKnitStart =
    calc.constructionDirection === "cuff-to-toe" ? calc.legStitches : calc.ankleStitches;
  const expectedKnitTarget =
    calc.constructionDirection === "cuff-to-toe" ? calc.ankleStitches : calc.legStitches;
  const expectedGeometryDirection =
    calc.legStitches > calc.ankleStitches
      ? "increase"
      : calc.legStitches < calc.ankleStitches
        ? "decrease"
        : "none";
  const expectedPaired = Math.abs(calc.legStitchChange) / 2;

  if (schedule.method !== "magic") errors.push("leg shaping must use Magic Formula");
  if (schedule.shapingMode !== "both") errors.push("leg shaping must be paired (both sides)");
  if (schedule.startStitches !== calc.ankleStitches) {
    errors.push("leg shaping startStitches must equal ankleStitches");
  }
  if (schedule.targetStitches !== calc.legStitches) {
    errors.push("leg shaping targetStitches must equal legStitches");
  }
  if (schedule.totalStitchChange !== calc.legStitchChange) {
    errors.push("leg shaping totalStitchChange must equal legStitchChange");
  }
  if (schedule.rowsAvailable !== calc.legShapingRowsAvailable) {
    errors.push("leg shaping rowsAvailable must equal remaining rows after the straight ankle");
  }
  if (calc.legStitchChange % 2 !== 0) {
    errors.push("leg stitch difference must be even for paired events");
  }
  if (calc.ankleStitches % 2 !== 0 || calc.legStitches % 2 !== 0) {
    errors.push("ankle and top-leg stitch counts must stay even");
  }
  if (schedule.direction !== expectedGeometryDirection) {
    errors.push("leg shaping direction does not match ankle vs top-leg stitches");
  }
  if (schedule.pairedEventCount !== expectedPaired) {
    errors.push("pairedEventCount must equal |stitch change| / 2");
  }
  if (schedule.knitOrder.constructionDirection !== calc.constructionDirection) {
    errors.push("knit-order constructionDirection must match the calc");
  }
  if (schedule.knitOrder.startStitches !== expectedKnitStart) {
    errors.push("knit-order start stitches do not match construction direction");
  }
  if (schedule.knitOrder.targetStitches !== expectedKnitTarget) {
    errors.push("knit-order target stitches do not match construction direction");
  }

  const sections = schedule.knitOrder.sections;
  const sectionRowSum = sections.reduce((sum, section) => sum + section.rows, 0);
  if (sectionRowSum !== calc.legRows) {
    errors.push("construction-order sections must sum to total leg rows");
  }
  if (sections.some((section) => section.rows < 0)) {
    errors.push("construction-order section rows must not be negative");
  }
  const ankleSection = sections.find((section) => section.kind === "straight-ankle");
  if (calc.ankleStraightRows > 0) {
    if (!ankleSection || ankleSection.rows !== calc.ankleStraightRows) {
      errors.push("construction order must include the straight ankle section");
    }
    if (calc.constructionDirection === "cuff-to-toe") {
      if (sections[sections.length - 1]?.kind !== "straight-ankle") {
        errors.push("cuff-to-toe must work the straight ankle immediately before the heel");
      }
    } else if (sections[0]?.kind !== "straight-ankle") {
      errors.push("toe-up must work the straight ankle immediately after the heel");
    }
  }
  const upper = sections.find(
    (section) => section.kind === "leg-shaping" || section.kind === "straight-leg",
  );
  if (calc.legShapingRowsAvailable > 0) {
    const expectedUpperKind = calc.legShapingNeeded ? "leg-shaping" : "straight-leg";
    if (!upper || upper.kind !== expectedUpperKind || upper.rows !== calc.legShapingRowsAvailable) {
      errors.push("construction order must include the remaining upper-leg section");
    }
  } else if (upper) {
    errors.push("very short legs must not invent remaining upper-leg rows");
  }

  if (schedule.direction === "none") {
    if (schedule.pairedEventCount !== 0) errors.push("straight leg must have 0 paired events");
    if (schedule.steps.length !== 0) errors.push("straight leg must have an empty Magic Formula schedule");
    if (schedule.knitOrder.events.length !== 0) {
      errors.push("straight leg must have no knit-order events");
    }
    if (schedule.knitOrder.direction !== "none") {
      errors.push("straight leg knit-order direction must be none");
    }
    return errors;
  }

  const intervalRowSum =
    schedule.intervals.shortCount * schedule.intervals.shortInterval +
    schedule.intervals.longCount * schedule.intervals.longInterval;
  if (schedule.intervals.shortCount + schedule.intervals.longCount !== schedule.pairedEventCount) {
    errors.push("Magic Formula interval counts must equal paired events");
  }
  if (intervalRowSum !== schedule.rowsAvailable) {
    errors.push("Magic Formula intervals must use only the remaining rows after the straight ankle");
  }
  if (schedule.intervals.shortInterval < 1) {
    errors.push("Magic Formula short interval must be at least 1 row");
  }
  if (schedule.intervals.longCount > 0 && schedule.intervals.longInterval < 1) {
    errors.push("Magic Formula long interval must be at least 1 row");
  }
  if (schedule.knitOrder.events.length !== schedule.pairedEventCount) {
    errors.push("knit-order events must equal paired events");
  }
  const last = schedule.knitOrder.events[schedule.knitOrder.events.length - 1];
  if (!last) {
    errors.push("shaped legs must include knit-order events");
  } else {
    if (last.stitchesAfter !== schedule.knitOrder.targetStitches) {
      errors.push("knit-order schedule must land on the target stitch count");
    }
    if (last.rowNumber !== schedule.rowsAvailable) {
      errors.push("knit-order schedule must use the available leg rows");
    }
  }
  const expectedKnitDirection =
    expectedKnitTarget > expectedKnitStart
      ? "increase"
      : expectedKnitTarget < expectedKnitStart
        ? "decrease"
        : "none";
  if (schedule.knitOrder.direction !== expectedKnitDirection) {
    errors.push("knit-order direction does not match construction start vs target");
  }
  const expectedEventDelta = expectedKnitDirection === "increase" ? 2 : -2;
  if (schedule.knitOrder.events.some((event) => event.stitchChange !== expectedEventDelta)) {
    errors.push("each paired event must change the stitch count by 2");
  }

  return errors;
}
