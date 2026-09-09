/**
 * Sideways Cardigan builder validation — knitter-facing messages.
 * Needle capacity uses garment-length stitches, not bust stitches.
 */

import { computeDropShoulderArmholeDepthInches } from "./dropShoulderArmholeDepth";
import {
  calculateSidewaysCardiganBody,
  SIDEWAYS_CARDIGAN_NON_POSITIVE_SHOULDER_ROWS,
  type SidewaysCardiganBodyCalc,
  type SidewaysCardiganBodyCalcInput,
} from "./sidewaysCardiganBodyCalc";
import { parsePositiveInchesField } from "./sidewaysCardiganStyleMeasurements";

export type SidewaysCardiganValidationCode =
  | "missing-required"
  | "v-neck-not-shorter-than-length"
  | "armhole-not-shorter-than-length"
  | "non-positive-shoulder-rows"
  | "needles-exceeded";

export type SidewaysCardiganValidationError = {
  code: SidewaysCardiganValidationCode;
  message: string;
};

export type SidewaysCardiganBuilderValidationInput = {
  chartAudience?: string;
  selectedSize?: string;
  fit?: string;
  sleeveDirection?: string;
  garmentStyle?: string;
  finishedLengthInches?: string | number;
  vNeckDepthInches?: string | number;
  neckOpeningWidthInches?: string | number;
  finishedUpperArmInches?: string | number;
  sleeveLengthInches?: string | number;
  wristInches?: string | number;
  finishedBustInches?: string | number;
  stitchesPerInch?: number;
  rowsPerInch?: number;
  availableNeedles?: string | number;
};

export function requiredNeedlesForSidewaysCardiganBody(
  calc: SidewaysCardiganBodyCalc,
): number {
  return calc.garmentLengthStitches;
}

function missingRequiredMessage(): SidewaysCardiganValidationError {
  return {
    code: "missing-required",
    message:
      "Choose a sizing chart and size, pick a fit, enter every measurement, and fill in your stitch gauge, row gauge, and needles available before creating the pattern.",
  };
}

export function validateSidewaysCardiganNeedles(args: {
  requiredNeedles: number;
  availableNeedles: number;
}): SidewaysCardiganValidationError | null {
  if (!(args.requiredNeedles > 0) || !(args.availableNeedles > 0)) {
    return missingRequiredMessage();
  }
  if (args.requiredNeedles <= args.availableNeedles) return null;
  return {
    code: "needles-exceeded",
    message: `This sideways body needs ${args.requiredNeedles} needles — that is the garment length in stitches. Your machine has ${args.availableNeedles} needles available. Choose a shorter length, a tighter stitch gauge, or a machine with more needles.`,
  };
}

export function validateSidewaysCardiganBuilder(
  values: SidewaysCardiganBuilderValidationInput,
): SidewaysCardiganValidationError | null {
  const audience = String(values.chartAudience ?? "").trim();
  const size = String(values.selectedSize ?? "").trim();
  const fit = String(values.fit ?? "").trim();
  const sleeve = String(values.sleeveDirection ?? "").trim();
  const length = parsePositiveInchesField(values.finishedLengthInches);
  const vNeck = parsePositiveInchesField(values.vNeckDepthInches);
  const neckOpening = parsePositiveInchesField(values.neckOpeningWidthInches);
  const upperArm = parsePositiveInchesField(values.finishedUpperArmInches);
  const sleeveLength = parsePositiveInchesField(values.sleeveLengthInches);
  const wrist = parsePositiveInchesField(values.wristInches);
  const finishedBust = parsePositiveInchesField(values.finishedBustInches);
  const spi = values.stitchesPerInch;
  const rpi = values.rowsPerInch;
  const availableNeedles = Number(String(values.availableNeedles ?? "").trim());

  if (
    (audience !== "misses" && audience !== "plus") ||
    !size ||
    (fit !== "close" && fit !== "standard" && fit !== "relaxed") ||
    (sleeve !== "cuff-up" && sleeve !== "top-down" && sleeve !== "sideways") ||
    length === undefined ||
    vNeck === undefined ||
    neckOpening === undefined ||
    upperArm === undefined ||
    sleeveLength === undefined ||
    wrist === undefined ||
    finishedBust === undefined ||
    !(typeof spi === "number" && spi > 0) ||
    !(typeof rpi === "number" && rpi > 0) ||
    !Number.isInteger(availableNeedles) ||
    availableNeedles <= 0
  ) {
    return missingRequiredMessage();
  }

  if (vNeck >= length) {
    return {
      code: "v-neck-not-shorter-than-length",
      message:
        "V-neck depth must be shorter than the finished garment length. Reduce the neck depth or lengthen the garment.",
    };
  }

  const armholeDepthInches = computeDropShoulderArmholeDepthInches(upperArm);
  if (armholeDepthInches !== undefined && armholeDepthInches >= length) {
    return {
      code: "armhole-not-shorter-than-length",
      message:
        "The armhole slit (half of the finished upper arm) must be shorter than the finished garment length. Reduce the upper-arm measurement or lengthen the garment.",
    };
  }

  const calcInput: SidewaysCardiganBodyCalcInput = {
    garmentLengthInches: length,
    vNeckDepthInches: vNeck,
    finishedBustCircumferenceInches: finishedBust,
    finishedUpperArmInches: upperArm,
    neckOpeningWidthInches: neckOpening,
    stitchesPerInch: spi,
    rowsPerInch: rpi,
  };
  const result = calculateSidewaysCardiganBody(calcInput);
  if (!result.ok) {
    return {
      code: "non-positive-shoulder-rows",
      message:
        result.error.code === SIDEWAYS_CARDIGAN_NON_POSITIVE_SHOULDER_ROWS
          ? "The neck opening is too wide for this bust size, so there is no room left for the shoulders. Make the neck opening narrower or increase the finished bust."
          : result.error.message,
    };
  }

  return validateSidewaysCardiganNeedles({
    requiredNeedles: requiredNeedlesForSidewaysCardiganBody(result.calc),
    availableNeedles,
  });
}
