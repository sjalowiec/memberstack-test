/**
 * Presentation-only hint that this browser already completed email capture
 * for the free Hat Pattern. Never authentication.
 * Never stores name or email.
 */

import {
  isLeadRecognized,
  isLeadRecognizedAt,
  markLeadRecognized,
  parseLeadRecognizedAt,
  readLeadRecognizedAt,
  LEAD_RECOGNITION_TTL_MS,
  getLeadRecognitionStorage,
} from "../../leads/leadRecognitionHint";

export const HAT_PATTERN_LEAD_STORAGE_KEY = "kin:hat-pattern-lead-at";

/** One calendar year in milliseconds — same TTL as Skill Builder recognition. */
export const HAT_PATTERN_LEAD_TTL_MS = LEAD_RECOGNITION_TTL_MS;

export {
  parseLeadRecognizedAt as parseHatPatternLeadRecognizedAt,
  isLeadRecognizedAt as isHatPatternLeadRecognizedAt,
};

export function readHatPatternLeadRecognizedAt(
  storage: Storage | null = getLeadRecognitionStorage(),
): number | null {
  return readLeadRecognizedAt(HAT_PATTERN_LEAD_STORAGE_KEY, storage);
}

export function markHatPatternLeadRecognized(
  now: number = Date.now(),
  storage: Storage | null = getLeadRecognitionStorage(),
): boolean {
  return markLeadRecognized(HAT_PATTERN_LEAD_STORAGE_KEY, now, storage);
}

export function isHatPatternLeadRecognized(
  now: number = Date.now(),
  storage: Storage | null = getLeadRecognitionStorage(),
): boolean {
  return isLeadRecognized(
    HAT_PATTERN_LEAD_STORAGE_KEY,
    now,
    storage,
    HAT_PATTERN_LEAD_TTL_MS,
  );
}
