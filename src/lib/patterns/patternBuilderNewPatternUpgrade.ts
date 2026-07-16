/**
 * Decision logic for the logged-in "create another pattern" upgrade screen.
 */
import { MEMBERSHIPS } from "../../config/memberships";
import {
  resolvePatternBuilderUpgradeConfig,
  type PatternBuilderUpgradeConfig,
} from "./patternBuilderUpgradeConfig";
import { isFreeClaimedForSystem } from "./patternSystemFreeClaim";
import type { PatternSystemId } from "./patternSystemId";
import {
  canCreatePatternForSystem,
  hasPatternSystemAccess,
  type SleevelessUserAccess,
} from "./sleevelessPatternSystemAccess";

export type PatternBuilderNewPatternUpgradeUiMode =
  | "none"
  | "membership-only"
  | "membership-and-lifetime";

/** True when the visitor may start a new pattern without seeing an upgrade screen. */
export function shouldBypassPatternBuilderNewPatternUpgradeScreen(
  access: SleevelessUserAccess,
  systemId: PatternSystemId,
): boolean {
  if (!access.loggedIn) return true;
  return canCreatePatternForSystem(access, systemId);
}

/** Which upgrade UI to show when a logged-in user cannot start a new pattern. */
export function resolvePatternBuilderNewPatternUpgradeUiMode(
  access: SleevelessUserAccess,
  systemId: PatternSystemId,
): PatternBuilderNewPatternUpgradeUiMode {
  if (shouldBypassPatternBuilderNewPatternUpgradeScreen(access, systemId)) return "none";

  const config = resolvePatternBuilderUpgradeConfig(systemId);
  if (
    config &&
    !hasPatternSystemAccess(access, config.patternSystemId) &&
    isFreeClaimedForSystem(access.freeClaimsBySystem, config.patternSystemId)
  ) {
    return "membership-and-lifetime";
  }

  return "membership-only";
}

export function memberPlanGrantsPatternBuilderBypass(planId: string): boolean {
  return (
    planId === MEMBERSHIPS.beta.memberstackPlanId ||
    planId === MEMBERSHIPS.basic.memberstackPlanId ||
    planId === MEMBERSHIPS.premium.memberstackPlanId
  );
}

export type { PatternBuilderUpgradeConfig };
