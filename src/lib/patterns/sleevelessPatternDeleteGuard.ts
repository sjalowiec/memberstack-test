/**
 * Delete-protection rule for a free user's one Sleeveless Pattern.
 *
 * A logged-in user who has used their one-time free pattern allowance (`freeClaimed=true`) but does
 * NOT have Sleeveless Pattern System access must keep their entitled pattern: it cannot be deleted,
 * so they can never delete down to nothing. They retain full open / view / print / manage access —
 * only deletion of the protected pattern is blocked.
 *
 * Deleting a pattern NEVER resets the free allowance: the allowance lives in Memberstack member JSON
 * and is untouched by deletion. This guard only prevents the destructive delete; it changes no claim.
 *
 * The synchronous {@link isSleevelessPatternDeleteProtected} is pure (no DOM / Memberstack) so the
 * rule is unit-testable directly. The async resolver wires Memberstack access and the saved-list
 * count needed for the unknown-id fallback.
 */
import {
  hasSleevelessPatternSystemAccess,
  type SleevelessUserAccess,
} from "./sleevelessPatternSystemAccess";
import { resolveSleevelessUserAccessSnapshot } from "./sleevelessPatternSystemAccessClient";
import { listCustomPatternProjects } from "./customPatternProjectClient";
import type { CustomPatternFamily } from "./customPatternProjectTypes";

/** Explanatory text shown when a free user's protected pattern cannot be deleted. */
export const SLEEVELESS_FREE_PATTERN_DELETE_BLOCKED_TEXT =
  "This is your free Sleeveless Pattern. To keep access to it, it can't be deleted unless you unlock the Sleeveless Pattern System.";

export interface SleevelessPatternDeleteProtectionInput {
  access: SleevelessUserAccess;
  /** Candidate project id being considered for deletion. */
  projectId: string;
  /** Total saved patterns the user currently has (only used by the unknown-id fallback). */
  totalSavedCount: number;
}

/**
 * Pure: may the given saved pattern be protected from deletion?
 *
 * - Logged out → not protected (deletion is independently blocked by identity checks).
 * - System access (member / owner) → never protected; unlimited delete, even of the last pattern.
 * - Free user who has NOT claimed the allowance → not protected (nothing consumed yet).
 * - Free user who HAS claimed:
 *     - If the claimed pattern id is known → protect exactly that pattern.
 *     - If the claimed id is unknown (legacy claim) → protect their LAST remaining pattern so they
 *       can never delete down to zero.
 */
export function isSleevelessPatternDeleteProtected({
  access,
  projectId,
  totalSavedCount,
}: SleevelessPatternDeleteProtectionInput): boolean {
  if (!access?.loggedIn) return false;
  if (hasSleevelessPatternSystemAccess(access)) return false;
  if (!access.freeClaimed) return false;

  const claimedId =
    typeof access.freeClaimedPatternId === "string" ? access.freeClaimedPatternId.trim() : "";
  if (claimedId) return projectId === claimedId;

  // Unknown claimed id (legacy claim): never let them remove their only remaining pattern.
  return totalSavedCount <= 1;
}

export interface SleevelessPatternDeleteDecision {
  blocked: boolean;
  message: string | null;
  /** The resolved access snapshot used to decide (so callers can forward it server-side). */
  access: SleevelessUserAccess;
}

/**
 * Async client guard: resolves Memberstack access and decides whether `projectId` may be deleted.
 *
 * The saved-list count is only fetched when the slow-path fallback needs it (claimed, no system
 * access, unknown claimed id). Callers that already know the count should pass `totalSavedCount` to
 * avoid the extra request. On a list-fetch error we default to protecting the pattern (safe).
 */
export async function resolveSleevelessPatternDeleteDecision(
  projectId: string,
  options: { family?: CustomPatternFamily; totalSavedCount?: number } = {},
): Promise<SleevelessPatternDeleteDecision> {
  const access = await resolveSleevelessUserAccessSnapshot();

  const allow = (): SleevelessPatternDeleteDecision => ({ blocked: false, message: null, access });
  const block = (): SleevelessPatternDeleteDecision => ({
    blocked: true,
    message: SLEEVELESS_FREE_PATTERN_DELETE_BLOCKED_TEXT,
    access,
  });

  // Fast paths that need no saved-list count.
  if (!access.loggedIn || hasSleevelessPatternSystemAccess(access) || !access.freeClaimed) {
    return allow();
  }
  if (typeof access.freeClaimedPatternId === "string" && access.freeClaimedPatternId.trim()) {
    return projectId === access.freeClaimedPatternId.trim() ? block() : allow();
  }

  // Unknown claimed id fallback — needs the current saved count.
  let totalSavedCount = options.totalSavedCount;
  if (typeof totalSavedCount !== "number") {
    const list = await listCustomPatternProjects(options.family ?? "sleeveless");
    totalSavedCount = list.ok ? list.projects.length : 1;
  }
  return isSleevelessPatternDeleteProtected({ access, projectId, totalSavedCount })
    ? block()
    : allow();
}
