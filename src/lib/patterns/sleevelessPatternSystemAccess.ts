import { MEMBER_PLAN_IDS } from "../../config/memberships";
import {
  hasMemberAccessFromActivePlanIds,
  hasPatternBuilderAccess,
  patternBuilderKeyForSystemId,
} from "./patternBuilderAccess";
import {
  type FreeClaimsBySystem,
  freeClaimedPatternIdForSystem,
  isFreeClaimedForSystem,
} from "./patternSystemFreeClaim";
import {
  patternSystemDisplayName,
  type PatternSystemId,
} from "./patternSystemId";

/**
 * Pure access rules for Custom Pattern systems (no DOM / Memberstack imports).
 *
 * Business rules:
 * - Logged-out visitors cannot create patterns.
 * - Each account gets ONE one-time saved pattern per pattern system (Sleeveless, Drop Shoulder, …).
 * - Ownership preserves viewing/printing forever for saved patterns.
 * - Active entitlement re-enables unlimited creation and full editing.
 * - User-owned text fields (name/title + notes) stay editable for any logged-in user.
 *
 * DOM/Memberstack wiring lives in `sleevelessPatternSystemAccessClient.ts`.
 */

/** Paid membership plans that grant full pattern system access. */
export const SLEEVELESS_SYSTEM_MEMBERSHIP_PLAN_IDS = MEMBER_PLAN_IDS;

/** Standalone unlock plan ids (empty until per-system checkout is wired). */
export const SLEEVELESS_SYSTEM_UNLOCK_PLAN_IDS: readonly string[] = [];

/** Member JSON key for standalone Sleeveless Pattern System unlock. */
export const SLEEVELESS_SYSTEM_UNLOCK_JSON_KEY = "sleevelessPatternSystemUnlocked";

/** @deprecated Legacy keys — use {@link FREE_PATTERN_CLAIMS_BY_SYSTEM_JSON_KEY} via patternSystemFreeClaim. */
export const FREE_SLEEVELESS_CLAIMED_JSON_KEY = "freeSleevelessPatternClaimed";
/** @deprecated Legacy keys — use per-system claims. */
export const FREE_SLEEVELESS_CLAIMED_PATTERN_ID_JSON_KEY = "freeSleevelessPatternId";

/** Resolved access snapshot for the current visitor. */
export interface SleevelessUserAccess {
  loggedIn: boolean;
  memberId?: string;
  /** Active Memberstack plan ids (canonical source for paid entitlement resolution). */
  activePlanIds?: readonly string[];
  /** Legacy standalone Sleeveless unlock stored on member JSON. Sleeveless only. */
  sleevelessUnlockedViaJson?: boolean;
  /**
   * True when the visitor has full access to at least one pattern builder system.
   * Prefer {@link hasPatternSystemAccess} for builder-specific checks.
   */
  hasSystemAccess: boolean;
  /** Per-system one-time free pattern claims (canonical). */
  freeClaimsBySystem: FreeClaimsBySystem;
}

export const LOGGED_OUT_SLEEVELESS_ACCESS: SleevelessUserAccess = {
  loggedIn: false,
  activePlanIds: [],
  hasSystemAccess: false,
  freeClaimsBySystem: {},
};

/** @deprecated Use {@link isFreeClaimedForSystem} with a {@link PatternSystemId}. */
export function accessFreeClaimedForSystem(
  access: SleevelessUserAccess,
  systemId: PatternSystemId,
): boolean {
  return isFreeClaimedForSystem(access.freeClaimsBySystem, systemId);
}

/** @deprecated Use {@link freeClaimedPatternIdForSystem}. */
export function accessFreeClaimedPatternIdForSystem(
  access: SleevelessUserAccess,
  systemId: PatternSystemId,
): string | undefined {
  return freeClaimedPatternIdForSystem(access.freeClaimsBySystem, systemId);
}

/** @deprecated Prefer per-system checks — true when ANY system has a claim. */
export function accessHasAnyFreeClaim(access: SleevelessUserAccess): boolean {
  return Object.values(access.freeClaimsBySystem).some((c) => c?.claimed === true);
}

/** @deprecated Use per-system id lookup with {@link resolvePatternSystemFromPage}. */
export function legacyFreeClaimed(access: SleevelessUserAccess): boolean {
  return accessHasAnyFreeClaim(access);
}

/** @deprecated Use {@link freeClaimedPatternIdForSystem}. */
export function legacyFreeClaimedPatternId(access: SleevelessUserAccess): string | undefined {
  return (
    freeClaimedPatternIdForSystem(access.freeClaimsBySystem, "sleeveless") ??
    freeClaimedPatternIdForSystem(access.freeClaimsBySystem, "drop-shoulder")
  );
}

/** The one-time free claim as stored in legacy Memberstack member JSON. */
export interface SleevelessFreeClaim {
  freeSleevelessPatternClaimed: boolean;
  freeSleevelessPatternId?: string;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function planIdsGrantSleevelessSystemAccess(planIds: readonly string[]): boolean {
  return (
    hasPatternBuilderAccess({ builder: "sleeveless", activePlanIds: planIds }) ||
    hasPatternBuilderAccess({ builder: "dropShoulder", activePlanIds: planIds })
  );
}

export interface ResolvePatternSystemAccessParams {
  activePlanIds: readonly string[];
  patternSystemId: PatternSystemId;
  sleevelessUnlockedViaJson?: boolean;
}

/** Full paid access for one pattern system from active plans and optional legacy JSON unlock. */
export function resolvePatternSystemAccess(params: ResolvePatternSystemAccessParams): {
  hasSystemAccess: boolean;
} {
  const { activePlanIds, patternSystemId, sleevelessUnlockedViaJson = false } = params;
  const builderKey = patternBuilderKeyForSystemId(patternSystemId);
  if (builderKey) {
    if (hasPatternBuilderAccess({ builder: builderKey, activePlanIds })) {
      return { hasSystemAccess: true };
    }
  } else if (hasMemberAccessFromActivePlanIds(activePlanIds)) {
    return { hasSystemAccess: true };
  }
  if (patternSystemId === "sleeveless" && sleevelessUnlockedViaJson) {
    return { hasSystemAccess: true };
  }
  return { hasSystemAccess: false };
}

/** Full paid access for one pattern system from a resolved access snapshot. */
export function hasPatternSystemAccess(
  access: SleevelessUserAccess,
  systemId: PatternSystemId,
): boolean {
  if (!access?.loggedIn) return false;
  if (Array.isArray(access.activePlanIds)) {
    return resolvePatternSystemAccess({
      activePlanIds: access.activePlanIds,
      patternSystemId: systemId,
      sleevelessUnlockedViaJson: access.sleevelessUnlockedViaJson,
    }).hasSystemAccess;
  }
  // Legacy/test snapshots without plan ids: honor the boolean only when no per-system data exists.
  return access.hasSystemAccess === true;
}

function hasAnyPatternBuilderSystemAccess(access: SleevelessUserAccess): boolean {
  return (
    hasPatternSystemAccess(access, "sleeveless") ||
    hasPatternSystemAccess(access, "drop-shoulder")
  );
}

export function computeHasSystemAccessFlag(access: Omit<SleevelessUserAccess, "hasSystemAccess">): boolean {
  return hasAnyPatternBuilderSystemAccess(access as SleevelessUserAccess);
}

export function readSleevelessSystemUnlockFromMemberJson(json: unknown): boolean {
  const record = asRecord(json);
  return record[SLEEVELESS_SYSTEM_UNLOCK_JSON_KEY] === true;
}

/** @deprecated Legacy read — use {@link readFreeClaimsBySystemFromMemberJson}. */
export function readFreeClaimFromMemberJson(json: unknown): SleevelessFreeClaim {
  const record = asRecord(json);
  const claimed = record[FREE_SLEEVELESS_CLAIMED_JSON_KEY] === true;
  const rawId = record[FREE_SLEEVELESS_CLAIMED_PATTERN_ID_JSON_KEY];
  const id = typeof rawId === "string" && rawId.trim() ? rawId.trim() : undefined;
  return { freeSleevelessPatternClaimed: claimed, freeSleevelessPatternId: id };
}

/** @deprecated Legacy merge — use {@link mergeFreeClaimForSystemIntoMemberJson}. */
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

/** @deprecated Legacy reset — use {@link mergeFreeClaimResetForSystemIntoMemberJson}. */
export function mergeFreeClaimResetIntoMemberJson(json: unknown): Record<string, unknown> {
  const merged: Record<string, unknown> = { ...asRecord(json) };
  merged[FREE_SLEEVELESS_CLAIMED_JSON_KEY] = false;
  merged[FREE_SLEEVELESS_CLAIMED_PATTERN_ID_JSON_KEY] = null;
  return merged;
}

export function hasSleevelessPatternSystemAccess(
  user: SleevelessUserAccess,
  systemId?: PatternSystemId,
): boolean {
  if (systemId) return hasPatternSystemAccess(user, systemId);
  return hasAnyPatternBuilderSystemAccess(user);
}

/** Whether the user may create/save a NEW pattern for the given system right now. */
export function canCreatePatternForSystem(
  user: SleevelessUserAccess,
  systemId: PatternSystemId,
): boolean {
  if (!user?.loggedIn) return false;
  if (hasPatternSystemAccess(user, systemId)) return true;
  return !isFreeClaimedForSystem(user.freeClaimsBySystem ?? {}, systemId);
}

/** Whether the user may edit pattern-building choices and regenerate for the given system. */
export function canEditPatternSettingsForSystem(
  user: SleevelessUserAccess,
  systemId: PatternSystemId,
): boolean {
  if (hasPatternSystemAccess(user, systemId)) return true;
  if (!user?.loggedIn) return false;
  return !isFreeClaimedForSystem(user.freeClaimsBySystem ?? {}, systemId);
}

/** @deprecated Use {@link canCreatePatternForSystem} with an explicit system id. */
export function canCreateSleevelessPattern(
  user: SleevelessUserAccess,
  systemId: PatternSystemId = "sleeveless",
): boolean {
  return canCreatePatternForSystem(user, systemId);
}

/** @deprecated Use {@link canEditPatternSettingsForSystem} with an explicit system id. */
export function canEditSleevelessPatternSettings(
  user: SleevelessUserAccess,
  systemId: PatternSystemId = "sleeveless",
): boolean {
  return canEditPatternSettingsForSystem(user, systemId);
}

export function canEditSleevelessPatternNotes(
  user: SleevelessUserAccess,
  _pattern?: unknown,
): boolean {
  return Boolean(user?.loggedIn);
}

/** User-facing copy when a free user already claimed their pattern for a system. */
export function resolvePatternSystemAlreadyClaimedCopy(systemId: PatternSystemId): string {
  const name = patternSystemDisplayName(systemId);
  return `You've already created your free ${name} pattern.\n\nEditing is included with membership. You can still view, print, and knit from this pattern.\n\nCreate another ${name} pattern with membership.`;
}

/** User-facing copy when a logged-out visitor tries to save. */
export function resolvePatternSystemSaveLoggedOutCopy(systemId: PatternSystemId): string {
  const name = patternSystemDisplayName(systemId);
  return `Log in to create your free ${name} pattern.`;
}

export {
  isFreeClaimedForSystem,
  freeClaimedPatternIdForSystem,
  type FreeClaimsBySystem,
};
