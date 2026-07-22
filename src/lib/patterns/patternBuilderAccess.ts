/**
 * Pattern Builder entitlement ù active Knit it Now membership only.
 *
 * Single source of truth: {@link hasMemberAccess} / {@link hasMemberAccessFromActivePlanIds}
 * (`MEMBER_PLAN_IDS`: paid membership, Beta, and legacy member shells).
 *
 * Lifetime builder plans, Memberstack JSON unlock flags, and free claims do **not**
 * grant Dynamic Pattern access.
 */
import type { PatternSystemId } from "./patternSystemId";
import { hasMemberAccess } from "../memberAccess";
import {
  patternBuilderLifetimePlanId,
  type PatternBuilderKey,
} from "../../config/patternBuilderLifetime";

export type { PatternBuilderKey };

/** Maps a custom-pattern system slug to its lifetime builder config key, when applicable. */
export function patternBuilderKeyForSystemId(systemId: PatternSystemId): PatternBuilderKey | null {
  if (systemId === "sleeveless") return "sleeveless";
  if (systemId === "drop-shoulder") return "dropShoulder";
  return null;
}

export interface HasPatternBuilderAccessParams {
  builder: string;
  activePlanIds: readonly string[];
}

function normalizePlanIds(activePlanIds: readonly string[]): string[] {
  return activePlanIds
    .filter((id): id is string => typeof id === "string")
    .map((id) => id.trim())
    .filter(Boolean);
}

/** Reuses {@link hasMemberAccess} without duplicating the global plan allow list. */
export function hasMemberAccessFromActivePlanIds(activePlanIds: readonly string[]): boolean {
  const ids = normalizePlanIds(activePlanIds);
  if (!ids.length) return false;
  return hasMemberAccess({
    planConnections: ids.map((planId) => ({
      planId,
      status: "ACTIVE",
      active: true,
    })),
  });
}

function activePlanIdsIncludeAny(activePlanIds: readonly string[], candidates: readonly string[]): boolean {
  const normalizedActive = new Set(normalizePlanIds(activePlanIds));
  return candidates.some((id) => normalizedActive.has(id.trim()));
}

/**
 * True when `activePlanIds` includes the lifetime Memberstack plan id for this builder.
 * Ownership detection only ù does **not** grant Dynamic Pattern access.
 */
export function hasLifetimePatternBuilderAccess(
  builder: PatternBuilderKey,
  activePlanIds: readonly string[],
): boolean {
  return activePlanIdsIncludeAny(activePlanIds, [patternBuilderLifetimePlanId(builder)]);
}

/**
 * Dynamic Pattern access for one builder.
 * Active membership unlocks every builder. Lifetime ownership alone does not.
 * The `builder` field is accepted for call-site compatibility and is not used for access.
 */
export function hasPatternBuilderAccess(params: HasPatternBuilderAccessParams): boolean {
  void params.builder;
  return hasMemberAccessFromActivePlanIds(params.activePlanIds);
}
