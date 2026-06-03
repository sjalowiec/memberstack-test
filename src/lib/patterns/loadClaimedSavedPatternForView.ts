/**
 * Self-healing loader for the read-only saved-pattern view page.
 *
 * A free knitter who has already claimed their one free Sleeveless Pattern can still view and print
 * it. The view (`/patterns/sleeveless/pattern/`) renders from the local working draft; the
 * saved-project link (`kbm_custom_pattern_active_project_id`) is what tells the page it is showing a
 * saved project and enables the "render from the canonical draft" fallback.
 *
 * That active-project link can legitimately be absent when the knitter reaches the view WITHOUT going
 * through "View Pattern" — most notably after the new-pattern gate clears the leftover edit session
 * via `exitEditingSavedCustomPattern()` (so the confusing edit banner no longer frames the unlock
 * gate). With no link — and a possibly incomplete `patternBuilderData` mirror — the page can stick on
 * "Loading pattern…".
 *
 * This guard reloads the claimed pattern from the account BY ID (`freeClaimedPatternId` from the
 * access snapshot — never a stale local active edit id) whenever no saved project is currently linked,
 * so the view always hydrates. It is intentionally a no-op:
 *  - when a saved project is already linked (the normal View/Open flow already hydrated the draft),
 *  - for logged-out visitors,
 *  - for members / system-access users (their behaviour is unchanged — they always open via an
 *    explicit action that links the active project),
 *  - and when the account has no recorded claimed pattern id.
 */
import { isEditingSavedCustomPatternProject } from "./customPatternEditingUx";
import { loadSavedCustomPatternProject } from "./loadSavedCustomPatternProject";
import { waitForMemberstackDom } from "./sleevelessPatternLoginGate";
import type { SleevelessUserAccess } from "./sleevelessPatternSystemAccess";
import { resolveSleevelessUserAccess } from "./sleevelessPatternSystemAccessClient";

export type EnsureClaimedSavedPatternResult =
  | "active-project-present"
  | "logged-out"
  | "has-system-access"
  | "no-claimed-pattern"
  | "loaded"
  | "load-failed";

/** Injection seams so the guard can be unit-tested without Memberstack / network. */
export interface EnsureClaimedSavedPatternDeps {
  isEditing?: () => boolean;
  waitForMemberstack?: () => Promise<boolean>;
  resolveAccess?: () => Promise<SleevelessUserAccess>;
  loadProject?: (id: string) => Promise<{ ok: boolean }>;
}

/**
 * Loads the free knitter's claimed pattern into the working draft when no saved project is linked,
 * so the read-only view can always render. Returns a label describing the outcome (mostly for tests
 * + diagnostics). Never throws for the expected branches; loader errors surface as `"load-failed"`.
 */
export async function ensureClaimedSavedPatternHydratedForView(
  deps: EnsureClaimedSavedPatternDeps = {},
): Promise<EnsureClaimedSavedPatternResult> {
  const isEditing = deps.isEditing ?? isEditingSavedCustomPatternProject;

  // A saved project is already linked → the normal View/Open flow hydrated the working draft (and
  // may point at any of the knitter's saved patterns). Never override it.
  if (isEditing()) return "active-project-present";

  const waitForMs = deps.waitForMemberstack ?? waitForMemberstackDom;
  const resolveAccess = deps.resolveAccess ?? resolveSleevelessUserAccess;
  const loadProject =
    deps.loadProject ?? ((id: string) => loadSavedCustomPatternProject(id, "view"));

  await waitForMs();
  const access = await resolveAccess();

  if (!access.loggedIn) return "logged-out";
  // Members / unlocked users reach the view through an explicit open that links the active project;
  // do not touch their working draft here.
  if (access.hasSystemAccess) return "has-system-access";

  const claimedId = access.freeClaimedPatternId?.trim();
  if (!access.freeClaimed || !claimedId) return "no-claimed-pattern";

  const result = await loadProject(claimedId);
  return result.ok ? "loaded" : "load-failed";
}
