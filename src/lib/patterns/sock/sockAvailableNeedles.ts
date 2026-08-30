/**
 * Socks available-needles capacity check.
 * Reuses shared sweater field validation + copy; required stitch count is the
 * even-upped foot-circumference tube from Socks math (no second rounding system).
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
import { roundToEvenPreferUp, sockGaugeToPerInch } from "./sockMath";
import type { SockDraftUnit } from "./sockDraft";

export {
  AVAILABLE_NEEDLES_HELPER_TEXT,
  AVAILABLE_NEEDLES_LABEL,
  AVAILABLE_NEEDLES_REQUIRED_MESSAGE,
  EXPRESS_AVAILABLE_NEEDLES_INPUT_ID,
  isValidExpressAvailableNeedles,
  validateAvailableNeedlesFieldValue,
};

export const SOCK_AVAILABLE_NEEDLES_INPUT_ID = EXPRESS_AVAILABLE_NEEDLES_INPUT_ID;

export function resolveSockRequiredNeedles(args: {
  footCircumferenceInches: number;
  stitchGaugeDisplay: number;
  displayUnit: SockDraftUnit;
}): number {
  const circ = Number(args.footCircumferenceInches);
  const gauge = Number(args.stitchGaugeDisplay);
  if (!(circ > 0) || !(gauge > 0)) return 0;
  const stGaugePerInch = sockGaugeToPerInch(gauge, args.displayUnit);
  if (!(stGaugePerInch > 0)) return 0;
  return roundToEvenPreferUp(circ * stGaugePerInch);
}

export function parseSockAvailableNeedles(raw: string | undefined | null): number {
  const trimmed = String(raw ?? "").trim();
  if (!isValidExpressAvailableNeedles(trimmed)) return 0;
  return Number(trimmed);
}

export function buildSockNeedleCapacityMessage(
  requiredNeedles: number,
  availableNeedles: number,
): string {
  return `These socks require ${requiredNeedles} needles, but your machine has ${availableNeedles} available.`;
}

export type SockNeedleCapacityValidation = ExpressNeedleValidation & {
  message: string;
};

export function validateSockNeedleCapacity(
  availableNeedlesRaw: string | undefined | null,
  requiredNeedles: number,
): SockNeedleCapacityValidation {
  const availableNeedles = parseSockAvailableNeedles(availableNeedlesRaw);
  const required = Number.isFinite(requiredNeedles) ? Math.max(0, Math.round(requiredNeedles)) : 0;
  const ok = availableNeedles > 0 && required > 0 && required <= availableNeedles;
  return {
    ok,
    requiredNeedles: required,
    availableNeedles,
    message: ok ? "" : buildSockNeedleCapacityMessage(required, availableNeedles),
  };
}
