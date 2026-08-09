/**
 * Deletes a saved Custom Pattern project and clears the linked active project id
 * if (and only if) the deleted project is currently active in localStorage.
 *
 * Ownership is enforced by the server delete endpoint (blob key scoped to the authenticated
 * member). Deletion does not require current access to the pattern system.
 *
 * Does not navigate or reload the page. Never resets the free-pattern allowance.
 */
import { clearActiveCustomPatternProjectId, readActiveCustomPatternProjectId } from "./customPatternProjectActiveId";
import { deleteCustomPatternProject } from "./customPatternProjectClient";
import type { CustomPatternFamily } from "./customPatternProjectTypes";
import type { PatternSystemId } from "./patternSystemId";

export type DeleteSavedCustomPatternResult = { ok: true } | { ok: false; error: string };

export async function deleteSavedCustomPatternProject(
  projectId: string,
  family: CustomPatternFamily = "sleeveless",
  _options: { totalSavedCount?: number; patternSystem?: PatternSystemId } = {},
): Promise<DeleteSavedCustomPatternResult> {
  const activeId = readActiveCustomPatternProjectId();
  const wasActive = activeId && activeId === projectId;

  const res = await deleteCustomPatternProject(projectId, family);
  if (!res.ok) return { ok: false, error: res.error };

  if (wasActive) clearActiveCustomPatternProjectId();
  return { ok: true };
}
