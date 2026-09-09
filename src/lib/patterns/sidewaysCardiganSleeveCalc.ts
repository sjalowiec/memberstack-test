/**
 * Numeric Sideways V-Neck sleeve measurements (cuff-up / top-down only).
 *
 * Reuses Drop Shoulder finished measurements, rounding, cuff rows, and the even
 * shaping schedule. Sideways-knit sleeves are not calculated here.
 */

import { resolveEffectiveCuffDepthInches } from "./customBuildEffectiveCuffDepth";
import { positiveMeasurementInches } from "./customBuildEffectiveArmholeDepth";
import { computeDropShoulderArmholeDepthInches } from "./dropShoulderArmholeDepth";
import { resolveDropShoulderFinishedWristInches } from "./dropShoulderSleeveEase";
import {
  calculateDropShoulderSleevePieceNumbers,
  type DropShoulderSleevePieceNumbers,
} from "./dropShoulderSleevePieceNumbers";
import {
  dropShoulderSleeveShapingPlanForDirection,
  type DropShoulderSleeveShapingPlan,
} from "./dropShoulderSleeveShaping";
import { sleeveShapingPerSide } from "./evenShapingSchedule";
import type { SidewaysCardiganBodyCalc } from "./sidewaysCardiganBodyCalc";
import type { SidewaysCardiganSleeveDirection } from "./sidewaysCardiganConstructionIdentity";
import { parseSidewaysCardiganSleeveDirection } from "./sidewaysCardiganConstructionIdentity";

export const SIDEWAYS_CARDIGAN_SLEEVE_MISSING_LENGTH = "missing-sleeve-length";
export const SIDEWAYS_CARDIGAN_SLEEVE_MISSING_GAUGE = "missing-gauge";
export const SIDEWAYS_CARDIGAN_SLEEVE_WRIST_NOT_NARROWER = "wrist-not-less-than-upper-arm";
export const SIDEWAYS_CARDIGAN_SLEEVE_NOT_ENOUGH_ROWS = "not-enough-rows-for-shaping";
export const SIDEWAYS_CARDIGAN_SLEEVE_TOP_ARMHOLE_MISMATCH = "sleeve-top-armhole-mismatch";
export const SIDEWAYS_CARDIGAN_SLEEVE_NEEDLES_EXCEEDED = "needles-exceeded";
export const SIDEWAYS_CARDIGAN_SLEEVE_NOT_CONNECTED = "sideways-not-connected";

export const SIDEWAYS_SLEEVE_NOT_CONNECTED_NOTICE =
  "Sideways sleeve calculations are not yet connected.";

export type SidewaysCardiganConventionalSleeveDirection = "cuff-up" | "top-down";

export type SidewaysCardiganSleeveCalcErrorCode =
  | typeof SIDEWAYS_CARDIGAN_SLEEVE_MISSING_LENGTH
  | typeof SIDEWAYS_CARDIGAN_SLEEVE_MISSING_GAUGE
  | typeof SIDEWAYS_CARDIGAN_SLEEVE_WRIST_NOT_NARROWER
  | typeof SIDEWAYS_CARDIGAN_SLEEVE_NOT_ENOUGH_ROWS
  | typeof SIDEWAYS_CARDIGAN_SLEEVE_TOP_ARMHOLE_MISMATCH
  | typeof SIDEWAYS_CARDIGAN_SLEEVE_NEEDLES_EXCEEDED
  | typeof SIDEWAYS_CARDIGAN_SLEEVE_NOT_CONNECTED;

export type SidewaysCardiganSleeveCalcError = {
  code: SidewaysCardiganSleeveCalcErrorCode;
  message: string;
};

export type SidewaysCardiganSleeveCalcInput = {
  direction: SidewaysCardiganConventionalSleeveDirection;
  finishedUpperArmInches: number;
  finishedWristInches: number;
  sleeveLengthInches: number;
  stitchesPerInch: number;
  rowsPerInch: number;
  cuffDepthInches: number;
  /** Body armhole slit depth (inches). Must be finished upper arm ÷ 2. */
  armholeDepthInches: number;
  availableNeedles?: number;
};

export type SidewaysCardiganSleeveFinished = {
  upperArmInches: number;
  wristInches: number;
  sleeveLengthInches: number;
  sleeveTopWidthInches: number;
  armholeSlitDepthInches: number;
  cuffDepthInches: number;
};

export type SidewaysCardiganSleeveCalc = DropShoulderSleevePieceNumbers & {
  direction: SidewaysCardiganConventionalSleeveDirection;
  finished: SidewaysCardiganSleeveFinished;
  shapingPlan: DropShoulderSleeveShapingPlan;
  shapingPerSide: number;
  requiredNeedles: number;
};

export type SidewaysCardiganSleeveCalcResult =
  | { ok: true; calc: SidewaysCardiganSleeveCalc }
  | { ok: false; error: SidewaysCardiganSleeveCalcError };

function section(obj: unknown): Record<string, unknown> {
  return obj && typeof obj === "object" && !Array.isArray(obj)
    ? (obj as Record<string, unknown>)
    : {};
}

function toPositiveNumber(v: unknown): number | undefined {
  if (typeof v === "number" && Number.isFinite(v) && v > 0) return v;
  const n = typeof v === "string" ? parseFloat(v.replace(/[^\d.-]/g, "")) : Number(v);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

function inchesMatch(a: number, b: number): boolean {
  return Math.abs(a - b) < 1e-9;
}

export function isSidewaysCardiganConventionalSleeveDirection(
  value: unknown,
): value is SidewaysCardiganConventionalSleeveDirection {
  return value === "cuff-up" || value === "top-down";
}

export function requiredNeedlesForSidewaysCardiganSleeve(
  piece: Pick<DropShoulderSleevePieceNumbers, "topSts" | "wristSts">,
): number {
  return Math.max(piece.topSts, piece.wristSts);
}

export function calculateSidewaysCardiganSleeve(
  input: SidewaysCardiganSleeveCalcInput,
): SidewaysCardiganSleeveCalcResult {
  if (!(input.stitchesPerInch > 0) || !(input.rowsPerInch > 0)) {
    return {
      ok: false,
      error: {
        code: SIDEWAYS_CARDIGAN_SLEEVE_MISSING_GAUGE,
        message:
          "Stitch gauge and row gauge are required to calculate sleeve stitches and rows.",
      },
    };
  }

  if (!(input.sleeveLengthInches > 0)) {
    return {
      ok: false,
      error: {
        code: SIDEWAYS_CARDIGAN_SLEEVE_MISSING_LENGTH,
        message:
          "Sleeve length is missing. Enter a sleeve length to calculate cuff-up or top-down sleeves.",
      },
    };
  }

  const expectedSlit = computeDropShoulderArmholeDepthInches(input.finishedUpperArmInches);
  const sleeveTopWidthInches = input.finishedUpperArmInches;
  if (
    expectedSlit === undefined ||
    !inchesMatch(input.armholeDepthInches, expectedSlit) ||
    !inchesMatch(sleeveTopWidthInches, 2 * input.armholeDepthInches)
  ) {
    return {
      ok: false,
      error: {
        code: SIDEWAYS_CARDIGAN_SLEEVE_TOP_ARMHOLE_MISMATCH,
        message:
          "The sleeve-top width must equal twice the armhole slit depth (the sleeve top is sewn around both sides of the slit).",
      },
    };
  }

  const piece = calculateDropShoulderSleevePieceNumbers({
    finishedUpperArmInches: input.finishedUpperArmInches,
    finishedWristInches: input.finishedWristInches,
    sleeveLengthInches: input.sleeveLengthInches,
    stitchesPerInch: input.stitchesPerInch,
    rowsPerInch: input.rowsPerInch,
    cuffDepthInches: input.cuffDepthInches,
  });

  const shapingRequired = piece.topSts !== piece.wristSts;
  if (shapingRequired && !(piece.wristSts < piece.topSts)) {
    return {
      ok: false,
      error: {
        code: SIDEWAYS_CARDIGAN_SLEEVE_WRIST_NOT_NARROWER,
        message:
          "Wrist stitches must be less than upper-arm stitches when the sleeve is shaped. Increase the finished upper arm or reduce the wrist measurement.",
      },
    };
  }

  const shapingPerSide = sleeveShapingPerSide(piece.topSts, piece.wristSts);
  if (shapingPerSide > 0 && piece.sleeveBodyRows < shapingPerSide) {
    return {
      ok: false,
      error: {
        code: SIDEWAYS_CARDIGAN_SLEEVE_NOT_ENOUGH_ROWS,
        message:
          "This sleeve is not long enough to distribute the shaping from wrist to upper arm. Enter a longer sleeve length or reduce the difference between wrist and upper arm.",
      },
    };
  }

  const requiredNeedles = requiredNeedlesForSidewaysCardiganSleeve(piece);
  if (
    input.availableNeedles !== undefined &&
    Number.isInteger(input.availableNeedles) &&
    input.availableNeedles > 0 &&
    requiredNeedles > input.availableNeedles
  ) {
    return {
      ok: false,
      error: {
        code: SIDEWAYS_CARDIGAN_SLEEVE_NEEDLES_EXCEEDED,
        message: `This sleeve needs ${requiredNeedles} needles — that is the finished upper-arm stitch count. Your machine has ${input.availableNeedles} needles available. Choose a smaller upper arm, a tighter stitch gauge, or a machine with more needles.`,
      },
    };
  }

  const shapingPlan = dropShoulderSleeveShapingPlanForDirection(
    {
      topSts: piece.topSts,
      wristSts: piece.wristSts,
      sleeveBodyRows: piece.sleeveBodyRows,
    },
    input.direction,
  );

  return {
    ok: true,
    calc: {
      ...piece,
      direction: input.direction,
      finished: {
        upperArmInches: input.finishedUpperArmInches,
        wristInches: input.finishedWristInches,
        sleeveLengthInches: input.sleeveLengthInches,
        sleeveTopWidthInches,
        armholeSlitDepthInches: input.armholeDepthInches,
        cuffDepthInches: input.cuffDepthInches,
      },
      shapingPlan,
      shapingPerSide,
      requiredNeedles,
    },
  };
}

export type SidewaysCardiganSleeveCalcInputInspection = {
  input: SidewaysCardiganSleeveCalcInput | null;
  missing: string[];
  sleeveDirection: SidewaysCardiganSleeveDirection;
};

/**
 * Resolve cuff-up / top-down sleeve calc inputs from a working draft.
 * Returns `input: null` when the saved sleeve direction is sideways (not substituted).
 */
export function inspectSidewaysCardiganSleeveCalcInputFromPattern(
  patternData: Record<string, unknown>,
  body: Pick<SidewaysCardiganBodyCalc, "armholeDepthInches">,
  finishedUpperArmInches: number,
  gauge: { stitchesPerInch: number; rowsPerInch: number },
): SidewaysCardiganSleeveCalcInputInspection {
  const style = section(patternData.style);
  const sleeveDirection =
    parseSidewaysCardiganSleeveDirection(style.sleeveDirection) ?? "cuff-up";
  if (sleeveDirection === "sideways") {
    return { input: null, missing: [], sleeveDirection };
  }

  const fit = section(patternData.fit);
  const sm = section(fit.selectedMeasurements);
  const overrides = section(fit.cbMeasurementOverrides);
  const overrideWrist = positiveMeasurementInches(overrides.wrist);
  const bodyWrist = toPositiveNumber(sm.wrist);
  const fitPreference = String(fit.easeChoice ?? fit.fitChoice ?? "standard");
  const audience = String(style.recipientCategory ?? fit.sizingChart ?? "").trim();
  const finishedWrist =
    overrideWrist ??
    resolveDropShoulderFinishedWristInches({
      chartAudience: audience,
      fit: fitPreference,
      bodyWristIn: bodyWrist,
    }) ??
    bodyWrist;
  const sleeveLength =
    positiveMeasurementInches(overrides.sleeveLength) ?? toPositiveNumber(sm.sleeve_length);
  const cuffDepthInches = resolveEffectiveCuffDepthInches(patternData, audience);
  const ygm = section(patternData.yarnGaugeMachine);
  const machine = section(patternData.machine);
  const availableNeedlesRaw = ygm.availableNeedles ?? machine.availableNeedles;
  const availableNeedles = Number(String(availableNeedlesRaw ?? "").trim());

  const missing: string[] = [];
  if (!(gauge.stitchesPerInch > 0) || !(gauge.rowsPerInch > 0)) missing.push("gauge");
  if (sleeveLength === undefined) missing.push("sleeve length");
  if (finishedWrist === undefined) missing.push("wrist");

  if (missing.length > 0 || !isSidewaysCardiganConventionalSleeveDirection(sleeveDirection)) {
    return { input: null, missing, sleeveDirection };
  }

  return {
    input: {
      direction: sleeveDirection,
      finishedUpperArmInches,
      finishedWristInches: finishedWrist,
      sleeveLengthInches: sleeveLength,
      stitchesPerInch: gauge.stitchesPerInch,
      rowsPerInch: gauge.rowsPerInch,
      cuffDepthInches,
      armholeDepthInches: body.armholeDepthInches,
      ...(Number.isInteger(availableNeedles) && availableNeedles > 0
        ? { availableNeedles }
        : {}),
    },
    missing,
    sleeveDirection,
  };
}
