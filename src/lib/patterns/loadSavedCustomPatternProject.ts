import {
  loadCustomPatternProject,
} from "./customPatternProjectClient";
import { hydrateSavedCustomPatternProjectSession } from "./hydrateSavedCustomPatternProject";
import type { CustomPatternFamily } from "./customPatternProjectTypes";
import {
  getContinueEditingHref,
  getSavedCustomPatternOpenHref,
} from "./customPatternProjectNavigation";

export type SavedCustomPatternOpenAction = "open" | "continue";

export type LoadSavedCustomPatternResult =
  | { ok: true; redirectHref: string }
  | { ok: false; error: string };

/**
 * Loads a saved project into the working draft, sets the active project id, and returns the redirect URL.
 * Does not navigate — callers use `window.location.assign` when appropriate.
 */
export async function loadSavedCustomPatternProject(
  projectId: string,
  action: SavedCustomPatternOpenAction,
  family: CustomPatternFamily = "sleeveless",
): Promise<LoadSavedCustomPatternResult> {
  const res = await loadCustomPatternProject(projectId, family);
  if (!res.ok) {
    return { ok: false, error: res.error };
  }

  hydrateSavedCustomPatternProjectSession(res.project);

  const redirectHref =
    action === "open"
      ? getSavedCustomPatternOpenHref(res.project.source)
      : getContinueEditingHref(res.project.source);

  return { ok: true, redirectHref };
}
