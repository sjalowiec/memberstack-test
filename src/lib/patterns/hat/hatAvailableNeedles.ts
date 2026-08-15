/**
 * Hat available-needles capacity check.
 * Reuses shared sweater field validation + copy; required stitch count is the
 * final crown-adjusted cast-on used by hat instructions/diagrams.
 */
import {
  AVAILABLE_NEEDLES_HELPER_TEXT,
  AVAILABLE_NEEDLES_LABEL,
  AVAILABLE_NEEDLES_REQUIRED_MESSAGE,
  EXPRESS_AVAILABLE_NEEDLES_INPUT_ID,
  isValidExpressAvailableNeedles,
  type ExpressNeedleValidation,
} from "../sleevelessExpressAvailableNeedles";
import { validateAvailableNeedlesFieldValue } from "../availableNeedlesFieldValidation";
import {
  applyHatCrownCastOnAdjustment,
  hatGaugeToPerInch,
  roundToEvenPreferUp,
  type HatDisplayUnit,
} from "./hatMath";

export {
  AVAILABLE_NEEDLES_HELPER_TEXT,
  AVAILABLE_NEEDLES_LABEL,
  AVAILABLE_NEEDLES_REQUIRED_MESSAGE,
  EXPRESS_AVAILABLE_NEEDLES_INPUT_ID,
  isValidExpressAvailableNeedles,
  validateAvailableNeedlesFieldValue,
};

/** Same DOM id as Express sweater builders so shared gauge helpers work on the hat page. */
export const HAT_AVAILABLE_NEEDLES_INPUT_ID = EXPRESS_AVAILABLE_NEEDLES_INPUT_ID;

/**
 * Final rounded stitch count the pattern uses (even-up cast-on, then crown snap).
 * Does not invent or shrink the count to fit the machine.
 */
export function resolveHatRequiredNeedles(args: {
  finishedHatCircInches: number;
  stitchGaugeDisplay: number;
  displayUnit: HatDisplayUnit;
  crown: string;
}): number {
  const circ = Number(args.finishedHatCircInches);
  const gauge = Number(args.stitchGaugeDisplay);
  if (!(circ > 0) || !(gauge > 0)) return 0;
  const stGaugePerInch = hatGaugeToPerInch(gauge, args.displayUnit);
  if (!(stGaugePerInch > 0)) return 0;
  const castOnSts = roundToEvenPreferUp(circ * stGaugePerInch);
  return applyHatCrownCastOnAdjustment(castOnSts, args.crown);
}

export function parseHatAvailableNeedles(raw: string | undefined | null): number {
  const trimmed = String(raw ?? "").trim();
  if (!isValidExpressAvailableNeedles(trimmed)) return 0;
  return Number(trimmed);
}

export function buildHatNeedleCapacityMessage(
  requiredNeedles: number,
  availableNeedles: number,
): string {
  return `This hat requires ${requiredNeedles} needles, but your machine has ${availableNeedles} available.`;
}

export type HatNeedleCapacityValidation = ExpressNeedleValidation & {
  message: string;
};

/**
 * Compare final pattern stitch count against entered available needles.
 * `ok` is true only when both counts are positive and required ≤ available.
 */
export function validateHatNeedleCapacity(
  availableNeedlesRaw: string | undefined | null,
  requiredNeedles: number,
): HatNeedleCapacityValidation {
  const availableNeedles = parseHatAvailableNeedles(availableNeedlesRaw);
  const required = Number.isFinite(requiredNeedles) ? Math.max(0, Math.round(requiredNeedles)) : 0;
  const ok = availableNeedles > 0 && required > 0 && required <= availableNeedles;
  return {
    ok,
    requiredNeedles: required,
    availableNeedles,
    message: ok ? "" : buildHatNeedleCapacityMessage(required, availableNeedles),
  };
}

/** True when available needles are entered and the hat fits the machine. */
export function isHatNeedleCapacitySatisfied(
  availableNeedlesRaw: string | undefined | null,
  requiredNeedles: number,
): boolean {
  return validateHatNeedleCapacity(availableNeedlesRaw, requiredNeedles).ok;
}
