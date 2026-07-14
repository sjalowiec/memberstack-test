/**
 * Centralized Pattern Builder entitlement  full access to a specific builder.
 *
 * Full access is granted when the visitor has global member access (Basic, Premium, Beta,
 * or legacy plans via {@link hasMemberAccess}) OR owns the lifetime Memberstack product for
 * that builder only.
 *
 * This layer does not replace the one-free-pattern allowance for logged-in non-members;
 * free-pattern rules remain in `sleevelessPatternSystemAccess` until wired in a later step.
 */
import {
  isKnownPatternBuilderKey,
  patternBuilderLifetimePlanId,
  type PatternBuilderKey,
} from "../../config/patternBuilderLifetime";
import type { PatternSystemId } from "./patternSystemId";
import { hasMemberAccess } from "../memberAccess";

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

/** True when `activePlanIds` includes the lifetime Memberstack plan id for exactly this builder. */
export function hasLifetimePatternBuilderAccess(
  builder: PatternBuilderKey,
  activePlanIds: readonly string[],
): boolean {
  return activePlanIdsIncludeAny(activePlanIds, [patternBuilderLifetimePlanId(builder)]);
}

/**
 * Full paid access to one Pattern Builder (unlimited create/save/edit/copy/print).
 * Unknown builder keys fail closed (false). Global membership unlocks every builder.
 */
export function hasPatternBuilderAccess(params: HasPatternBuilderAccessParams): boolean {
  const activePlanIds = normalizePlanIds(params.activePlanIds);
  if (hasMemberAccessFromActivePlanIds(activePlanIds)) return true;
  if (!isKnownPatternBuilderKey(params.builder)) return false;
  return hasLifetimePatternBuilderAccess(params.builder, activePlanIds);
}
