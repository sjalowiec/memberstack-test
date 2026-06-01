import {
  loadCustomPatternProject,
} from "./customPatternProjectClient";
import { hydrateSavedCustomPatternProjectSession } from "./hydrateSavedCustomPatternProject";
import type { CustomPatternFamily } from "./customPatternProjectTypes";
import {
  getContinueEditingHref,
  getSavedCustomPatternOpenHref,
  OPEN_PATTERN_HREF,
} from "./customPatternProjectNavigation";

/**
 * - `view`: read-only destination — the saved pattern's instructions page. Primary action from
 *   My Patterns. Hydrates the working draft so the pattern renders, but does not unlock the builder.
 * - `open`: editable builder workspace (every step unlocked + prefilled via `?edit=choices`).
 * - `continue`: resume editing where the knitter left off.
 */
export type SavedCustomPatternOpenAction = "view" | "open" | "continue";

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

  // Opening for edit unlocks and prefills every builder step (gauge included) so the knitter lands
  // in the editable workspace. Viewing/continuing only need the working draft hydrated so the
  // pattern renders — they do not unlock the builder.
  hydrateSavedCustomPatternProjectSession(res.project, { editChoicesReopen: action === "open" });

  let redirectHref: string;
  if (action === "view") {
    // Saved pattern's instructions page — same destination regardless of how it was built.
    redirectHref = OPEN_PATTERN_HREF;
  } else if (action === "open") {
    redirectHref = getSavedCustomPatternOpenHref(res.project.source);
  } else {
    redirectHref = getContinueEditingHref(res.project.source);
  }

  return { ok: true, redirectHref };
}
