/**
 * Garment → YarnRequirement bridge for finished sweater pattern pages.
 *
 * Body (front + back): finished bust × garment length — the legacy Express estimate.
 * Drop Shoulder sleeves: trapezoid approximation matching the pattern’s tapered sleeve
 * geometry (flat width = full circumference). One sleeve =
 * `((upperArm + wrist) / 2) × sleeveLength`; both sleeves =
 * `(upperArm + wrist) × sleeveLength`.
 *
 * Sleeve inches must come from the same resolved values the Drop Shoulder generator
 * exposes on `result.debug` (`dropShoulderUpperArmInches`, `dropShoulderWristInches`,
 * `dropShoulderSleeveLengthInches`). Do not invent measurements.
 */

import { resolveEffectiveFinishedBustInches } from "./customBuildEffectiveFinishedBust";
import { resolveEffectiveFinishedLengthInches } from "./customBuildEffectiveFinishedLength";
import { hasAuthoritativeDropShoulderConstruction } from "./patternConstructionIdentity";
import type { YarnDimensionsDetail, YarnDimensionsLengthUnit } from "../tools/yarnRequirementDimensions";
import { YARN_DIMENSIONS_EVENT } from "../tools/yarnRequirementDimensions";

const INCH_TO_CM = 2.54;

export type GarmentYarnSleeveInches = {
  upperArmInches: number;
  wristInches: number;
  sleeveLengthInches: number;
};

export type GarmentYarnEstimationSnapshot = {
  finishedBustInches: number;
  garmentLengthInches: number;
  bodyAreaSquareInches: number;
  sleeveAreaSquareInches: number;
  fabricAreaSquareInches: number;
  includesSleeves: boolean;
  sleeves: GarmentYarnSleeveInches | null;
};

function positiveInches(n: unknown): number | undefined {
  if (typeof n !== "number" || !Number.isFinite(n) || n <= 0) return undefined;
  return n;
}

function section(obj: unknown): Record<string, unknown> {
  if (obj && typeof obj === "object" && !Array.isArray(obj)) {
    return obj as Record<string, unknown>;
  }
  return {};
}

/** Front + back body rectangle (finished bust circumference × garment length). */
export function garmentBodyFabricAreaSquareInches(
  finishedBustInches: number,
  garmentLengthInches: number,
): number {
  if (!(finishedBustInches > 0) || !(garmentLengthInches > 0)) return 0;
  return finishedBustInches * garmentLengthInches;
}

/**
 * Both sleeves as tapered trapezoids (pattern geometry: flat width = circumference).
 * Documented approximation: average of upper-arm and cuff circ × sleeve length × 2.
 */
export function dropShoulderBothSleevesAreaSquareInches(
  sleeves: GarmentYarnSleeveInches,
): number {
  const { upperArmInches, wristInches, sleeveLengthInches } = sleeves;
  if (!(upperArmInches > 0) || !(wristInches > 0) || !(sleeveLengthInches > 0)) return 0;
  return (upperArmInches + wristInches) * sleeveLengthInches;
}

/** Read sleeve inches from Drop Shoulder generator `debug` (canonical after render). */
export function sleeveInchesFromDropShoulderDebug(
  debug: unknown,
): GarmentYarnSleeveInches | null {
  const d = section(debug);
  const upperArmInches = positiveInches(d.dropShoulderUpperArmInches);
  const wristInches = positiveInches(d.dropShoulderWristInches);
  const sleeveLengthInches = positiveInches(d.dropShoulderSleeveLengthInches);
  if (
    upperArmInches === undefined ||
    wristInches === undefined ||
    sleeveLengthInches === undefined
  ) {
    return null;
  }
  return { upperArmInches, wristInches, sleeveLengthInches };
}

export function isDropShoulderGarmentPatternData(patternData: Record<string, unknown>): boolean {
  return hasAuthoritativeDropShoulderConstruction(section(patternData.style));
}

/**
 * Build a yarn snapshot from pattern data + optional rendered Drop Shoulder debug.
 *
 * - Sleeveless: body only (bust × length).
 * - Drop Shoulder: body + both sleeves. If sleeve inches are missing, returns null
 *   (do not silently ship a body-only estimate for Drop Shoulder).
 */
export function buildGarmentYarnEstimationSnapshot(
  patternData: Record<string, unknown>,
  opts?: { dropShoulderDebug?: unknown },
): GarmentYarnEstimationSnapshot | null {
  const finishedBustInches = resolveEffectiveFinishedBustInches(patternData);
  const garmentLengthInches = resolveEffectiveFinishedLengthInches(patternData);
  if (finishedBustInches === undefined || garmentLengthInches === undefined) return null;
  if (!(finishedBustInches > 0) || !(garmentLengthInches > 0)) return null;

  const bodyAreaSquareInches = garmentBodyFabricAreaSquareInches(
    finishedBustInches,
    garmentLengthInches,
  );
  if (!(bodyAreaSquareInches > 0)) return null;

  const isDropShoulder = isDropShoulderGarmentPatternData(patternData);
  if (!isDropShoulder) {
    return {
      finishedBustInches,
      garmentLengthInches,
      bodyAreaSquareInches,
      sleeveAreaSquareInches: 0,
      fabricAreaSquareInches: bodyAreaSquareInches,
      includesSleeves: false,
      sleeves: null,
    };
  }

  const sleeves = sleeveInchesFromDropShoulderDebug(opts?.dropShoulderDebug);
  if (!sleeves) return null;
  const sleeveAreaSquareInches = dropShoulderBothSleevesAreaSquareInches(sleeves);
  if (!(sleeveAreaSquareInches > 0)) return null;

  return {
    finishedBustInches,
    garmentLengthInches,
    bodyAreaSquareInches,
    sleeveAreaSquareInches,
    fabricAreaSquareInches: bodyAreaSquareInches + sleeveAreaSquareInches,
    includesSleeves: true,
    sleeves,
  };
}

export function buildGarmentYarnDimensionsDetail(
  snapshot: GarmentYarnEstimationSnapshot,
  lengthUnit: YarnDimensionsLengthUnit = "in",
): YarnDimensionsDetail {
  const bustIn = snapshot.finishedBustInches;
  const lenIn = snapshot.garmentLengthInches;
  const areaIn = snapshot.fabricAreaSquareInches;

  if (lengthUnit === "cm") {
    return {
      projectWidth: Math.round(bustIn * INCH_TO_CM * 10) / 10,
      projectLength: Math.round(lenIn * INCH_TO_CM * 10) / 10,
      lengthUnit: "cm",
      source: "custom",
      // Always pass explicit area so Drop Shoulder sleeves are counted (and sleeveless
      // stays identical to W×L).
      projectAreaSquareInches: areaIn,
    };
  }

  return {
    projectWidth: bustIn,
    projectLength: lenIn,
    lengthUnit: "in",
    source: "custom",
    projectAreaSquareInches: areaIn,
  };
}

export function garmentYarnDimensionsAreValid(detail: YarnDimensionsDetail | null | undefined): boolean {
  if (!detail) return false;
  const area = detail.projectAreaSquareInches;
  if (typeof area === "number" && Number.isFinite(area) && area > 0) return true;
  return detail.projectWidth > 0 && detail.projectLength > 0;
}

export function dispatchGarmentYarnDimensions(
  patternData: Record<string, unknown>,
  lengthUnit: YarnDimensionsLengthUnit = "in",
  opts?: { dropShoulderDebug?: unknown },
): YarnDimensionsDetail | null {
  const snapshot = buildGarmentYarnEstimationSnapshot(patternData, opts);
  if (!snapshot) {
    const empty: YarnDimensionsDetail = {
      projectWidth: 0,
      projectLength: 0,
      lengthUnit,
      source: "custom",
      projectAreaSquareInches: 0,
    };
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent(YARN_DIMENSIONS_EVENT, { detail: empty }));
    }
    return null;
  }
  const detail = buildGarmentYarnDimensionsDetail(snapshot, lengthUnit);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(YARN_DIMENSIONS_EVENT, { detail }));
  }
  return detail;
}
