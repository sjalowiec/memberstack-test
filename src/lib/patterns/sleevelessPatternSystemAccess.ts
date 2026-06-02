/**
 * Pure access rules for the Sleeveless Pattern System (no DOM / Memberstack imports).
 *
 * Business rules (first pass):
 * - Logged-out visitors cannot create patterns.
 * - Each account gets ONE one-time pattern creation allowance. It is recorded as "claimed" on the
 *   first saved pattern by ANY logged-in user (free or member) — so it represents "this account has
 *   used its free creation / has an established library", not a per-pattern special case.
 * - Ownership preserves viewing/printing forever: saved measurements, gauge, notes, and
 *   customizations are never lost, and any saved pattern stays viewable/printable while logged in.
 * - Active entitlement is the only thing that re-enables creation and regeneration/editing:
 *     - Members / Sleeveless Pattern System owners get full editing + unlimited creation.
 *     - Once entitlement ends, ALL saved patterns become settings-read-only (no gauge, measurement,
 *       style, or regeneration edits) and no new patterns can be created.
 * - User-owned text fields (pattern name/title + project notes) stay editable for any logged-in user
 *   on any pattern — that is library/project management, not pattern generation.
 *
 * The DOM/Memberstack wiring lives in `sleevelessPatternSystemAccessClient.ts`; this module stays
 * pure so the rules can be unit-tested directly.
 */

/** Paid membership plans that grant full Sleeveless Pattern System access. */
export const SLEEVELESS_SYSTEM_MEMBERSHIP_PLAN_IDS = [
  "pln_kin-membership-annual-qf9g01et",
  "pln_kin-membership-monthly-a59701wy",
  "pln_kin-beta-access-vyek0a38",
] as const;

/**
 * Standalone "unlock the Sleeveless Pattern System" plan/price ids.
 * Empty until the per-system checkout is wired; member JSON unlock flag covers the interim.
 */
export const SLEEVELESS_SYSTEM_UNLOCK_PLAN_IDS: readonly string[] = [];

/** Member JSON key set when a member owns/unlocks the standalone Sleeveless Pattern System. */
export const SLEEVELESS_SYSTEM_UNLOCK_JSON_KEY = "sleevelessPatternSystemUnlocked";

/** Member JSON keys for the one-time free pattern claim (account-tied, not localStorage). */
export const FREE_SLEEVELESS_CLAIMED_JSON_KEY = "freeSleevelessPatternClaimed";
export const FREE_SLEEVELESS_CLAIMED_PATTERN_ID_JSON_KEY = "freeSleevelessPatternId";

/** Resolved access snapshot for the current visitor. */
export interface SleevelessUserAccess {
  /** Memberstack reports a logged-in member (or dev bypass). */
  loggedIn: boolean;
  /** Memberstack member id when logged in. */
  memberId?: string;
  /** Member or owns/unlocks the Sleeveless Pattern System → full editing + unlimited creation. */
  hasSystemAccess: boolean;
  /** The account has used its one-time creation allowance (set on the first saved pattern). */
  freeClaimed: boolean;
  /** Saved-pattern id recorded when the allowance was first used (informational only). */
  freeClaimedPatternId?: string;
}

/** Stable snapshot for logged-out visitors. */
export const LOGGED_OUT_SLEEVELESS_ACCESS: SleevelessUserAccess = {
  loggedIn: false,
  hasSystemAccess: false,
  freeClaimed: false,
};

/** The one-time free claim as stored in Memberstack member JSON. */
export interface SleevelessFreeClaim {
  freeSleevelessPatternClaimed: boolean;
  freeSleevelessPatternId?: string;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

/** True when any of the member's plan ids grant Sleeveless Pattern System access. */
export function planIdsGrantSleevelessSystemAccess(planIds: readonly string[]): boolean {
  const granting = new Set<string>([
    ...SLEEVELESS_SYSTEM_MEMBERSHIP_PLAN_IDS,
    ...SLEEVELESS_SYSTEM_UNLOCK_PLAN_IDS,
  ]);
  return planIds.some((id) => typeof id === "string" && granting.has(id.trim()));
}

/** Reads the standalone unlock flag from Memberstack member JSON. */
export function readSleevelessSystemUnlockFromMemberJson(json: unknown): boolean {
  const record = asRecord(json);
  return record[SLEEVELESS_SYSTEM_UNLOCK_JSON_KEY] === true;
}

/** Reads the one-time free claim from Memberstack member JSON. */
export function readFreeClaimFromMemberJson(json: unknown): SleevelessFreeClaim {
  const record = asRecord(json);
  const claimed = record[FREE_SLEEVELESS_CLAIMED_JSON_KEY] === true;
  const rawId = record[FREE_SLEEVELESS_CLAIMED_PATTERN_ID_JSON_KEY];
  const id = typeof rawId === "string" && rawId.trim() ? rawId.trim() : undefined;
  return { freeSleevelessPatternClaimed: claimed, freeSleevelessPatternId: id };
}

/**
 * Returns a new member-JSON object with the free claim merged in.
 * Existing keys are preserved so we never clobber other account metadata.
 */
export function mergeFreeClaimIntoMemberJson(
  json: unknown,
  claim: SleevelessFreeClaim,
): Record<string, unknown> {
  const merged: Record<string, unknown> = { ...asRecord(json) };
  merged[FREE_SLEEVELESS_CLAIMED_JSON_KEY] = claim.freeSleevelessPatternClaimed;
  if (claim.freeSleevelessPatternId) {
    merged[FREE_SLEEVELESS_CLAIMED_PATTERN_ID_JSON_KEY] = claim.freeSleevelessPatternId;
  }
  return merged;
}

/** Member or owns/unlocks the Sleeveless Pattern System. */
export function hasSleevelessPatternSystemAccess(user: SleevelessUserAccess): boolean {
  return Boolean(user?.hasSystemAccess);
}

/**
 * Whether the user may create/save a NEW Sleeveless Pattern right now.
 * - Logged out → no.
 * - System access → always (unlimited creation).
 * - Otherwise → only if the account's one-time creation allowance is still unused.
 */
export function canCreateSleevelessPattern(user: SleevelessUserAccess): boolean {
  if (!user?.loggedIn) return false;
  if (hasSleevelessPatternSystemAccess(user)) return true;
  return !user.freeClaimed;
}

/**
 * Whether the user may edit pattern-building choices (who/size, front, neckline, fit, gauge,
 * measurements) and regenerate.
 * - System access → always.
 * - Otherwise → only while still creating their one allowed pattern (allowance unused). Once the
 *   allowance is used (or entitlement has ended), every saved pattern is settings-read-only.
 * - Logged out → no.
 */
export function canEditSleevelessPatternSettings(
  user: SleevelessUserAccess,
  _pattern?: unknown,
): boolean {
  if (hasSleevelessPatternSystemAccess(user)) return true;
  if (!user?.loggedIn) return false;
  return !user.freeClaimed;
}

/**
 * Whether the user may edit user-owned text fields (pattern name/title, project notes).
 * Any logged-in user may rename and add notes — including a free user's claimed pattern.
 */
export function canEditSleevelessPatternNotes(
  user: SleevelessUserAccess,
  _pattern?: unknown,
): boolean {
  return Boolean(user?.loggedIn);
}
