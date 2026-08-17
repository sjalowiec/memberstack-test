/**
 * Presentation-only browser hint that a lead form was already completed.
 * Never authentication. Never stores name or email — timestamp only.
 */

/** One calendar year in milliseconds — same TTL as Tip of the Week / Skill Builder. */
export const LEAD_RECOGNITION_TTL_MS = 365 * 24 * 60 * 60 * 1000;

export function getLeadRecognitionStorage(): Storage | null {
  try {
    if (typeof localStorage === "undefined") return null;
    return localStorage;
  } catch {
    return null;
  }
}

export function parseLeadRecognizedAt(
  raw: string | null | undefined,
): number | null {
  if (typeof raw !== "string" || !raw.trim()) return null;
  const asNumber = Number(raw);
  if (Number.isFinite(asNumber) && asNumber > 0) return asNumber;
  const asDate = Date.parse(raw);
  if (Number.isFinite(asDate) && asDate > 0) return asDate;
  return null;
}

export function isLeadRecognizedAt(
  recognizedAt: number | null,
  now: number = Date.now(),
  ttlMs: number = LEAD_RECOGNITION_TTL_MS,
): boolean {
  if (recognizedAt == null || !Number.isFinite(recognizedAt) || recognizedAt <= 0) {
    return false;
  }
  if (recognizedAt > now + 60_000) {
    return false;
  }
  return now - recognizedAt < ttlMs;
}

export function readLeadRecognizedAt(
  storageKey: string,
  storage: Storage | null = getLeadRecognitionStorage(),
): number | null {
  if (!storage) return null;
  try {
    return parseLeadRecognizedAt(storage.getItem(storageKey));
  } catch {
    return null;
  }
}

export function markLeadRecognized(
  storageKey: string,
  now: number = Date.now(),
  storage: Storage | null = getLeadRecognitionStorage(),
): boolean {
  if (!storage) return false;
  try {
    storage.setItem(storageKey, String(now));
    return true;
  } catch {
    return false;
  }
}

export function isLeadRecognized(
  storageKey: string,
  now: number = Date.now(),
  storage: Storage | null = getLeadRecognitionStorage(),
  ttlMs: number = LEAD_RECOGNITION_TTL_MS,
): boolean {
  return isLeadRecognizedAt(readLeadRecognizedAt(storageKey, storage), now, ttlMs);
}
