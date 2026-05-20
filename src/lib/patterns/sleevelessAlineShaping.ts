/**
 * Sleeveless A-line body shaping (hem/hip → bust), straight fit unchanged.
 *
 * Compatibility layer: {@link computeSleevelessAlineBodyShaping} delegates to
 * {@link buildSleevelessBodyBlockPlan} in `bodyBlock/sleevelessBodyBlock.ts`.
 */

import {
  buildSleevelessBodyBlockPlan,
  distributeSleevelessBodyShapingRows,
  SLEEVELESS_BODY_STRAIGHT_TOLERANCE_INCHES,
  type SleevelessBodyBlockPlan,
} from "./bodyBlock/sleevelessBodyBlock";
import { isCustomBuildPatternMode } from "./customBuildEffectiveArmholeDepth";

function section(obj: unknown): Record<string, unknown> {
  if (obj && typeof obj === "object" && !Array.isArray(obj)) {
    return obj as Record<string, unknown>;
  }
  return {};
}

function storedBodyShapeKey(patternData: Record<string, unknown>): string {
  const style = section(patternData.style);
  const legacy = section(patternData.fitConfig);
  const raw =
    (typeof style.bodyShape === "string" && style.bodyShape) ||
    (typeof legacy.shape === "string" && legacy.shape) ||
    "";
  return raw.trim().toLowerCase();
}

/** True when hip and bust differ beyond the body-block straight tolerance. */
export function measurementsImplySleevelessAlineBody(
  finishedBust: number | undefined,
  finishedHip: number | undefined,
): boolean {
  if (finishedBust === undefined || finishedHip === undefined) return false;
  if (finishedBust <= 0 || finishedHip <= 0) return false;
  return (
    Math.abs(finishedHip - finishedBust) > SLEEVELESS_BODY_STRAIGHT_TOLERANCE_INCHES
  );
}

/**
 * Custom Build user chose straight in the style step and hip ≈ bust — honor straight for generation.
 * When review hip differs from bust, measurement inference wins over the stored straight token.
 */
export function isSleevelessExplicitCustomBuildStraight(
  patternData: Record<string, unknown>,
  finishedBust?: number,
  finishedHip?: number,
): boolean {
  if (!isCustomBuildPatternMode(patternData)) return false;
  if (storedBodyShapeKey(patternData) !== "straight") return false;
  return !measurementsImplySleevelessAlineBody(finishedBust, finishedHip);
}

/**
 * Whether stored style tokens request A-line (explicit `aline`, not measurement-inferred).
 */
export function isSleevelessAlineBodyShape(patternData: Record<string, unknown>): boolean {
  return storedBodyShapeKey(patternData) === "aline";
}

/**
 * Whether pullover generation should run the body block (cast-on + side shaping).
 * Does not depend on `style.bodyShape === "aline"` alone — Review/Express may have hip ≠ bust
 * while bodyShape is missing or defaulted to straight.
 */
export function shouldRunSleevelessBodyBlockForPullover(
  finishedBust: number | undefined,
): boolean {
  return finishedBust !== undefined && finishedBust > 0;
}

/**
 * Hip circumference passed into {@link buildSleevelessBodyBlockPlan}.
 * Honors explicit Custom Build straight; otherwise uses effective hip (Review overrides, chart, etc.).
 */
export function resolveBodyBlockHipCircumferenceInches(
  patternData: Record<string, unknown>,
  finishedBust: number,
  finishedHip: number | undefined,
): number {
  if (isSleevelessExplicitCustomBuildStraight(patternData, finishedBust, finishedHip)) {
    return finishedBust;
  }
  return finishedHip !== undefined && finishedHip > 0 ? finishedHip : finishedBust;
}

/**
 * Whether the body block will apply A-line shaping (not merely run with a straight result).
 */
export function shouldApplySleevelessAlineShapingFromMeasurements(
  patternData: Record<string, unknown>,
  finishedBust: number | undefined,
  finishedHip: number | undefined,
): boolean {
  if (isSleevelessExplicitCustomBuildStraight(patternData, finishedBust, finishedHip)) {
    return false;
  }
  if (isSleevelessAlineBodyShape(patternData)) return true;
  return measurementsImplySleevelessAlineBody(finishedBust, finishedHip);
}

/** Temporary runtime audit surfaced on the Pattern tab (remove after live verification). */
export type SleevelessBodyBlockRuntimeDebug = {
  garmentStyle: string;
  frontStyle: string;
  garmentKindSource: string;
  patternMode: string;
  styleBodyShape: string;
  effectiveBustInches: number | undefined;
  effectiveHipInches: number | undefined;
  shouldRunSleevelessBodyBlockForPullover: boolean;
  hipSentToBodyBlock: number | undefined;
  explicitCustomBuildStraight: boolean;
  measurementsImplyAline: boolean;
  bodyBlockCalled: boolean;
  bodyShapeKind: string | undefined;
  shapingDirection: string | undefined;
  bodyBlockHemStitches: number | undefined;
  bodyBlockBustStitches: number | undefined;
  shapingEventsCount: number | undefined;
  finalCastOnStitches: number;
};

function formatRcColon(rc: number): string {
  const n = Math.max(0, Math.floor(rc));
  return `RC:${String(n).padStart(3, "0")}`;
}

export type SleevelessAlineShapingType = "straight" | "decrease-to-bust" | "increase-to-bust";

export type SleevelessAlineBodyZonePlan = {
  rows: number;
  endSts: number;
  shapingRowNumbers: number[];
  instructionLines: string[];
};

export type SleevelessAlineBodyShapingPlan = {
  shapingType: SleevelessAlineShapingType;
  hemCastOnSts: number;
  bustBodySts: number;
  /** Total stitch count change on the piece (both side edges combined). */
  totalStitchDifference: number;
  /** One decrease/increase at each side edge per shaping row. */
  pairedShapingRows: number;
  shapingRowNumbers: number[];
  shapingStartRow: number;
  shapingEndRow: number;
  availableShapingRows: number;
  /** Straight body rows immediately before the armhole (1″ from row gauge). */
  straightRowsBeforeArmhole: number;
  /** RC where the “begin A-line shaping” instruction is anchored (end of hem). */
  shapingBeginRc: number;
  /** RC where the 1″ straight knit before the armhole begins. */
  straightBeforeArmholeBeginRc: number;
  /** RC where armhole shaping begins. */
  armholeBeginRc: number;
  /**
   * Diagram `HIP_ROWS`: rows from hem/cast-on edge to the hip line.
   * For sleeveless A-line the hip line is the cast-on / hem width (0 rows above that edge).
   */
  hipRowsFromHem: number;
  /** One continuous A-line shaping span (all paired side shaping rows). */
  bodyFirstHalf: SleevelessAlineBodyZonePlan;
  /** Straight knit before the armhole (no side shaping). */
  bodySecondHalf: SleevelessAlineBodyZonePlan;
  warnings: string[];
};

export type ComputeSleevelessAlineBodyShapingArgs = {
  bustBodySts: number;
  finishedHipInches: number | undefined;
  finishedBustInches: number | undefined;
  stitchesPerInch: number;
  rowsPerInch: number;
  bodyToArmholeRows: number;
  /** Ribbed hem rows — shaping RCs start after this (not inside the hem). */
  hemRows: number;
};

const DECREASE_GLOSSARY_TOOLTIP_HTML =
  '<span class="glossary-tooltip-placeholder" data-glossary-id="178" data-term="Decrease">Decrease</span>';

const INCREASE_GLOSSARY_TOOLTIP_HTML =
  '<span class="glossary-tooltip-placeholder" data-glossary-id="186" data-term="Increase">Increase</span>';

/** First body-shaping instruction line: glossary tooltip on “Decrease” (id 178). */
function withDecreaseGlossaryTooltip(line: string): string {
  const idx = line.indexOf("Decrease");
  if (idx < 0) return line;
  return (
    line.slice(0, idx) + DECREASE_GLOSSARY_TOOLTIP_HTML + line.slice(idx + "Decrease".length)
  );
}

/** First body-shaping instruction line: glossary tooltip on “Increase” (id 186). */
function withIncreaseGlossaryTooltip(line: string): string {
  const idx = line.indexOf("Increase");
  if (idx < 0) return line;
  return (
    line.slice(0, idx) + INCREASE_GLOSSARY_TOOLTIP_HTML + line.slice(idx + "Increase".length)
  );
}

/** Back uses both side edges; one cardigan front panel shapes only at the armhole edge. */
export type SleevelessAlineShapingEdgeScope = "symmetricSides" | "armholeEdgeOnly";

/** Written pattern lines for one continuous A-line shaping span. */
export function formatSleevelessAlineBodyShapingInstructionLines(
  shapingType: SleevelessAlineShapingType,
  rowNumbers: readonly number[],
  shapingSpanRows?: number,
  edgeScope: SleevelessAlineShapingEdgeScope = "symmetricSides",
): string[] {
  if (shapingType === "straight" || rowNumbers.length === 0) return [];
  const verb = shapingType === "decrease-to-bust" ? "Decrease" : "Increase";
  const workLabel = shapingType === "decrease-to-bust" ? "decreases" : "increases";
  const times = rowNumbers.length;
  const span =
    shapingSpanRows !== undefined && shapingSpanRows > 0 ? shapingSpanRows : undefined;
  const list = rowNumbers.map((r) => formatRcColon(r)).join(", ");
  const edgePhrase =
    edgeScope === "armholeEdgeOnly" ? "at the armhole edge" : "at each side edge";
  const lines: string[] = [];
  if (span !== undefined) {
    const decreaseLine = `${verb} 1 stitch ${edgePhrase} ${times} time${times === 1 ? "" : "s"} evenly across the next ${span} row${span === 1 ? "" : "s"}.`;
    lines.push(
      shapingType === "decrease-to-bust"
        ? withDecreaseGlossaryTooltip(decreaseLine)
        : withIncreaseGlossaryTooltip(decreaseLine),
    );
  } else {
    const fallbackLine = `${verb} 1 stitch ${edgePhrase} on the following rows: ${list}.`;
    lines.push(
      shapingType === "decrease-to-bust"
        ? withDecreaseGlossaryTooltip(fallbackLine)
        : withIncreaseGlossaryTooltip(fallbackLine),
    );
    return lines;
  }
  lines.push(`Work ${workLabel} on: ${list}.`);
  return lines;
}

/**
 * One cardigan front panel: same shaping row placement as the back, hem/bust stitch counts halved.
 */
export function scaleAlineBodyShapingPlanForCardiganHalf(
  plan: SleevelessAlineBodyShapingPlan,
  halfCastOnSts: number,
  halfBustBodySts: number,
): SleevelessAlineBodyShapingPlan {
  const hem = Math.max(0, Math.floor(halfCastOnSts));
  const bust = Math.max(0, Math.floor(halfBustBodySts));
  const totalStitchDifference = Math.max(0, hem - bust);
  return {
    ...plan,
    hemCastOnSts: hem,
    bustBodySts: bust,
    totalStitchDifference,
    bodyFirstHalf: { ...plan.bodyFirstHalf, endSts: bust },
    bodySecondHalf: { ...plan.bodySecondHalf, endSts: bust },
  };
}

/** True when a shaping instruction line contains trusted HTML (glossary placeholders). */
export function sleevelessAlineShapingLineNeedsTrustedHtml(line: string): boolean {
  return line.includes("glossary-tooltip-placeholder");
}

function formatBodyShapingInstruction(
  shapingType: SleevelessAlineShapingType,
  rowNumbers: readonly number[],
  shapingSpanRows?: number,
): string[] {
  return formatSleevelessAlineBodyShapingInstructionLines(
    shapingType,
    rowNumbers,
    shapingSpanRows,
  );
}

/** @deprecated Prefer {@link distributeSleevelessBodyShapingRows} — re-exported for existing imports. */
export function distributeSleevelessAlineBodyShapingRows(
  hemRows: number,
  bodyToArmholeRows: number,
  pairedShapingRows: number,
  rowsPerInch = 7,
): number[] {
  return distributeSleevelessBodyShapingRows(
    hemRows,
    bodyToArmholeRows,
    rowsPerInch,
    pairedShapingRows,
  );
}

function buildZonePlan(
  rows: number,
  endSts: number,
  shapingType: SleevelessAlineShapingType,
  shapingRowNumbers: readonly number[],
  shapingSpanRows?: number,
): SleevelessAlineBodyZonePlan {
  return {
    rows,
    endSts,
    shapingRowNumbers: [...shapingRowNumbers],
    instructionLines: formatBodyShapingInstruction(
      shapingType,
      shapingRowNumbers,
      shapingSpanRows,
    ),
  };
}

function shapingTypeFromBodyBlock(plan: SleevelessBodyBlockPlan): SleevelessAlineShapingType {
  if (plan.shapingDirection === "decrease") return "decrease-to-bust";
  if (plan.shapingDirection === "increase") return "increase-to-bust";
  return "straight";
}

/**
 * Maps a {@link SleevelessBodyBlockPlan} into the plan used by pattern display rows:
 * shaping immediately after the hem, then straight knit before the armhole.
 */
export function bodyBlockPlanToAlineShapingPlan(
  bodyPlan: SleevelessBodyBlockPlan,
  bodyToArmholeRows: number,
  hemRows: number,
): SleevelessAlineBodyShapingPlan {
  const shapingType = shapingTypeFromBodyBlock(bodyPlan);
  const hemCastOnSts = bodyPlan.hemStitches;
  const bustBodySts = bodyPlan.bustStitches;
  const totalStitchDifference = bodyPlan.totalStitchChange;
  const pairedShapingRows = bodyPlan.shapingRowNumbers.length;
  const shapingRowNumbers = [...bodyPlan.shapingRowNumbers];

  const hem = Math.max(0, Math.floor(hemRows));
  const straightRowsBeforeArmhole = Math.max(0, bodyPlan.shapingEndBufferRows);
  const shapingBeginRc = hem;
  const shapingEndRow = bodyPlan.shapingEndRow;
  const straightBeforeArmholeBeginRc = shapingEndRow + 1;
  const armholeBeginRc = hem + Math.max(0, Math.floor(bodyToArmholeRows));
  const shapingSectionRows = Math.max(0, bodyPlan.availableShapingRows);

  const bodyFirstHalf = buildZonePlan(
    shapingSectionRows,
    bustBodySts,
    shapingType,
    shapingRowNumbers,
    shapingSectionRows,
  );
  const bodySecondHalf = buildZonePlan(
    straightRowsBeforeArmhole,
    bustBodySts,
    "straight",
    [],
  );

  return {
    shapingType,
    hemCastOnSts,
    bustBodySts,
    totalStitchDifference,
    pairedShapingRows,
    shapingRowNumbers,
    shapingStartRow: bodyPlan.shapingStartRow,
    shapingEndRow,
    availableShapingRows: bodyPlan.availableShapingRows,
    straightRowsBeforeArmhole,
    shapingBeginRc,
    straightBeforeArmholeBeginRc,
    armholeBeginRc,
    hipRowsFromHem: 0,
    bodyFirstHalf,
    bodySecondHalf,
    warnings: [...bodyPlan.warnings],
  };
}

/**
 * When A-line applies, returns cast-on at hip/hem width and side shaping across the body
 * (after the ribbed hem) to bust width at the armhole. Hip is at the cast-on edge, not mid-body.
 *
 * Compatibility wrapper — delegates to {@link buildSleevelessBodyBlockPlan}.
 */
export function computeSleevelessAlineBodyShaping(
  args: ComputeSleevelessAlineBodyShapingArgs,
): SleevelessAlineBodyShapingPlan | null {
  const {
    bustBodySts,
    finishedHipInches,
    finishedBustInches,
    stitchesPerInch,
    rowsPerInch,
    bodyToArmholeRows,
    hemRows,
  } = args;

  if (bustBodySts <= 0 || bodyToArmholeRows <= 0 || stitchesPerInch <= 0) {
    return null;
  }

  const hipCirc =
    finishedHipInches !== undefined && finishedHipInches > 0
      ? finishedHipInches
      : finishedBustInches;
  if (hipCirc === undefined || hipCirc <= 0) {
    return null;
  }

  const bustCirc =
    finishedBustInches !== undefined && finishedBustInches > 0
      ? finishedBustInches
      : (bustBodySts * 2) / stitchesPerInch;

  const bodyPlan = buildSleevelessBodyBlockPlan({
    garmentStyle: "pullover",
    pieceRole: "back",
    bustCircumferenceInches: bustCirc,
    hipCircumferenceInches: hipCirc,
    stitchesPerInch,
    rowsPerInch,
    rowsToArmhole: bodyToArmholeRows,
    hemRows,
    mode: "auto",
    precomputedBustStitches: bustBodySts,
  });

  if (bodyPlan.bustStitches <= 0 && bustBodySts <= 0) {
    return null;
  }

  const alinePlan = bodyBlockPlanToAlineShapingPlan(bodyPlan, bodyToArmholeRows, hemRows);
  return {
    ...alinePlan,
    bustBodySts,
    hemCastOnSts: alinePlan.shapingType === "straight" ? bustBodySts : alinePlan.hemCastOnSts,
  };
}

export function hipInchesAboveBustForValidation(
  finishedHip: number | undefined,
  finishedBust: number | undefined,
): number | undefined {
  if (finishedHip === undefined || finishedBust === undefined) return undefined;
  return finishedHip - finishedBust;
}

export { SLEEVELESS_ALINE_HIP_MAX_INCHES_ABOVE_BUST } from "./sleevelessHipSizingLimits";
