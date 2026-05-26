import { clearActiveCustomPatternProjectId, readActiveCustomPatternProjectId } from "./customPatternProjectActiveId";
import { deleteCustomPatternProject } from "./customPatternProjectClient";
import type { CustomPatternFamily } from "./customPatternProjectTypes";

export type DeleteSavedCustomPatternResult = { ok: true } | { ok: false; error: string };

/**
 * Deletes a saved Custom Pattern project and clears the linked active project id
 * if (and only if) the deleted project is currently active in localStorage.
 *
 * Does not navigate or reload the page.
 */
export async function deleteSavedCustomPatternProject(
  projectId: string,
  family: CustomPatternFamily = "sleeveless",
): Promise<DeleteSavedCustomPatternResult> {
  const activeId = readActiveCustomPatternProjectId();
  const wasActive = activeId && activeId === projectId;

  const res = await deleteCustomPatternProject(projectId, family);
  if (!res.ok) return { ok: false, error: res.error };

  if (wasActive) clearActiveCustomPatternProjectId();
  return { ok: true };
}

