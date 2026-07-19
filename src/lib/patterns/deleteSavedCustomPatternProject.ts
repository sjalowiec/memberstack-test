import { clearActiveCustomPatternProjectId, readActiveCustomPatternProjectId } from "./customPatternProjectActiveId";
import { deleteCustomPatternProject } from "./customPatternProjectClient";
import type { CustomPatternFamily } from "./customPatternProjectTypes";
import type { PatternSystemId } from "./patternSystemId";
import { resolveSleevelessPatternDeleteDecision } from "./sleevelessPatternDeleteGuard";

export type DeleteSavedCustomPatternResult = { ok: true } | { ok: false; error: string };

/**
 * Deletes a saved Custom Pattern project and clears the linked active project id
 * if (and only if) the deleted project is currently active in localStorage.
 *
 * Enforces the free-pattern delete protection before deleting (a free user without Sleeveless
 * Pattern System access cannot delete their entitled pattern) and forwards the resolved access
 * snapshot so the server endpoint can independently refuse the same deletion.
 *
 * Does not navigate or reload the page. Never resets the free-pattern allowance.
 */
export async function deleteSavedCustomPatternProject(
  projectId: string,
  family: CustomPatternFamily = "sleeveless",
  options: { totalSavedCount?: number; patternSystem?: PatternSystemId } = {},
): Promise<DeleteSavedCustomPatternResult> {
  const decision = await resolveSleevelessPatternDeleteDecision(projectId, {
    family,
    totalSavedCount: options.totalSavedCount,
    patternSystem: options.patternSystem,
  });
  if (decision.blocked) {
    return { ok: false, error: decision.message ?? "This pattern can't be deleted." };
  }

  const activeId = readActiveCustomPatternProjectId();
  const wasActive = activeId && activeId === projectId;

  const res = decision.access.loggedIn
    ? await deleteCustomPatternProject(projectId, family, decision.access)
    : await deleteCustomPatternProject(projectId, family);
  if (!res.ok) return { ok: false, error: res.error };

  if (wasActive) clearActiveCustomPatternProjectId();
  return { ok: true };
}
