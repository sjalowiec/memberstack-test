/**
 * Presentation-only hint that this browser already completed email capture
 * for the free Round Neckline Skill Builder. Never authentication.
 * Never stores name or email.
 */

export const ROUND_NECKLINE_SKILL_BUILDER_LEAD_STORAGE_KEY =
  "kin:skill-builder-round-neckline-lead-at";

/** One calendar year in milliseconds — same TTL as Tip of the Week recognition. */
export const ROUND_NECKLINE_SKILL_BUILDER_LEAD_TTL_MS = 365 * 24 * 60 * 60 * 1000;

function getLocalStorage(): Storage | null {
  try {
    if (typeof localStorage === "undefined") return null;
    return localStorage;
  } catch {
    return null;
  }
}

export function parseRoundNecklineLeadRecognizedAt(
  raw: string | null | undefined,
): number | null {
  if (typeof raw !== "string" || !raw.trim()) return null;
  const asNumber = Number(raw);
  if (Number.isFinite(asNumber) && asNumber > 0) return asNumber;
  const asDate = Date.parse(raw);
  if (Number.isFinite(asDate) && asDate > 0) return asDate;
  return null;
}

export function isRoundNecklineLeadRecognizedAt(
  recognizedAt: number | null,
  now: number = Date.now(),
  ttlMs: number = ROUND_NECKLINE_SKILL_BUILDER_LEAD_TTL_MS,
): boolean {
  if (recognizedAt == null || !Number.isFinite(recognizedAt) || recognizedAt <= 0) {
    return false;
  }
  if (recognizedAt > now + 60_000) {
    return false;
  }
  return now - recognizedAt < ttlMs;
}

export function readRoundNecklineLeadRecognizedAt(
  storage: Storage | null = getLocalStorage(),
): number | null {
  if (!storage) return null;
  try {
    return parseRoundNecklineLeadRecognizedAt(
      storage.getItem(ROUND_NECKLINE_SKILL_BUILDER_LEAD_STORAGE_KEY),
    );
  } catch {
    return null;
  }
}

export function markRoundNecklineLeadRecognized(
  now: number = Date.now(),
  storage: Storage | null = getLocalStorage(),
): boolean {
  if (!storage) return false;
  try {
    storage.setItem(ROUND_NECKLINE_SKILL_BUILDER_LEAD_STORAGE_KEY, String(now));
    return true;
  } catch {
    return false;
  }
}

export function isRoundNecklineLeadRecognized(
  now: number = Date.now(),
  storage: Storage | null = getLocalStorage(),
): boolean {
  return isRoundNecklineLeadRecognizedAt(readRoundNecklineLeadRecognizedAt(storage), now);
}
