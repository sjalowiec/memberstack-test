/**
 * This browser already opened the Getting Started Guide.
 * Same one-year recognition as the other free resources.
 * Never authentication. Never stores a name or email.
 */

import {
  getLeadRecognitionStorage,
  isLeadRecognized,
  markLeadRecognized,
  readLeadRecognizedAt,
  LEAD_RECOGNITION_TTL_MS,
} from "../leads/leadRecognitionHint";
import { GETTING_STARTED_GUIDE_STORAGE_KEY } from "./guideLeadShared";

export const GETTING_STARTED_GUIDE_TTL_MS = LEAD_RECOGNITION_TTL_MS;

export function readGettingStartedGuideRecognizedAt(
  storage: Storage | null = getLeadRecognitionStorage(),
): number | null {
  return readLeadRecognizedAt(GETTING_STARTED_GUIDE_STORAGE_KEY, storage);
}

export function markGettingStartedGuideRecognized(
  now: number = Date.now(),
  storage: Storage | null = getLeadRecognitionStorage(),
): boolean {
  return markLeadRecognized(GETTING_STARTED_GUIDE_STORAGE_KEY, now, storage);
}

export function isGettingStartedGuideRecognized(
  now: number = Date.now(),
  storage: Storage | null = getLeadRecognitionStorage(),
): boolean {
  return isLeadRecognized(
    GETTING_STARTED_GUIDE_STORAGE_KEY,
    now,
    storage,
    GETTING_STARTED_GUIDE_TTL_MS,
  );
}
