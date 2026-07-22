/**
 * Decision logic for the logged-in "create another pattern" upgrade screen.
 */
import { MEMBERSHIPS } from "../../config/memberships";
import type { PatternBuilderUpgradeConfig } from "./patternBuilderUpgradeConfig";
import type { PatternSystemId } from "./patternSystemId";
import {
  canCreatePatternForSystem,
  type SleevelessUserAccess,
} from "./sleevelessPatternSystemAccess";

export type PatternBuilderNewPatternUpgradeUiMode =
  | "none"
  | "membership-only"
  /** @deprecated Lifetime no longer grants access; treated as membership-only in UI. */
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
  void systemId;
  // Dynamic Patterns require membership; do not offer lifetime as an access path.
  return "membership-only";
}

export function memberPlanGrantsPatternBuilderBypass(planId: string): boolean {
  return (
    planId === MEMBERSHIPS.beta.memberstackPlanId ||
    planId === MEMBERSHIPS.membership.memberstackPlanId
  );
}

export type { PatternBuilderUpgradeConfig };
