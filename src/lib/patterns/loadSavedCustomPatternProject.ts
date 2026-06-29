import {
  loadCustomPatternProject,
} from "./customPatternProjectClient";
import { hydrateSavedCustomPatternProjectSession } from "./hydrateSavedCustomPatternProject";
import { claimPatternDraftForCurrentMember } from "./patternDraftOwnerGuard";
import { logSleevelessPatternActivity } from "./sleevelessPatternActivity";
import type { CustomPatternFamily } from "./customPatternProjectTypes";
import {
  getContinueEditingHref,
  getOpenPatternHrefForProject,
  getSavedCustomPatternOpenHref,
} from "./customPatternProjectNavigation";

/**
 * - `view`: read-only destination — the saved pattern's instructions page. Primary action from
 *   My Patterns. Hydrates the working draft so the pattern renders, but does not unlock the builder.
 * - `open`: the editable edit surface for the saved project. Express opens the combined review
 *   page (choices summary + measurements together); Custom Build opens its Foundation workspace.
 *   Either way the saved values are prefilled and every step is unlocked.
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
  // in the editable edit surface with all saved values restored. Viewing/continuing only need the
  // working draft hydrated so the pattern renders — they do not unlock the builder.
  hydrateSavedCustomPatternProjectSession(res.project, { editChoicesReopen: action === "open" });

  // The cloud load was owner-scoped server-side (X-KBM-Member-Id), so this draft belongs to the
  // current member. Tag it so the draft-owner guard on the next page keeps (not clears) it.
  claimPatternDraftForCurrentMember();

  logSleevelessPatternActivity("pattern_opened", {
    patternId: res.project.id,
    patternTitle: res.project.name,
    metadata: { action },
  });

  let redirectHref: string;
  if (action === "view") {
    redirectHref = getOpenPatternHrefForProject(res.project);
  } else if (action === "open") {
    redirectHref = getSavedCustomPatternOpenHref(res.project.source, res.project);
  } else {
    redirectHref = getContinueEditingHref(res.project.source, res.project);
  }

  return { ok: true, redirectHref };
}
