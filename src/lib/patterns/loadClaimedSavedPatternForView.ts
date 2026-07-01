/**
 * Self-healing loader for the read-only saved-pattern view page.
 */
import { isEditingSavedCustomPatternProject } from "./customPatternEditingUx";
import { loadSavedCustomPatternProject } from "./loadSavedCustomPatternProject";
import { freeClaimedPatternIdForSystem, isFreeClaimedForSystem } from "./patternSystemFreeClaim";
import { resolvePatternSystemFromPage, type PatternSystemId } from "./patternSystemId";
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

export interface EnsureClaimedSavedPatternDeps {
  isEditing?: () => boolean;
  waitForMemberstack?: () => Promise<boolean>;
  resolveAccess?: () => Promise<SleevelessUserAccess>;
  loadProject?: (id: string) => Promise<{ ok: boolean }>;
  patternSystem?: PatternSystemId;
}

export async function ensureClaimedSavedPatternHydratedForView(
  deps: EnsureClaimedSavedPatternDeps = {},
): Promise<EnsureClaimedSavedPatternResult> {
  const isEditing = deps.isEditing ?? isEditingSavedCustomPatternProject;
  const patternSystem = deps.patternSystem ?? resolvePatternSystemFromPage();

  if (isEditing()) return "active-project-present";

  const waitForMs = deps.waitForMemberstack ?? waitForMemberstackDom;
  const resolveAccess = deps.resolveAccess ?? resolveSleevelessUserAccess;
  const loadProject =
    deps.loadProject ?? ((id: string) => loadSavedCustomPatternProject(id, "view"));

  await waitForMs();
  const access = await resolveAccess();

  if (!access.loggedIn) return "logged-out";
  if (access.hasSystemAccess) return "has-system-access";

  if (!isFreeClaimedForSystem(access.freeClaimsBySystem, patternSystem)) {
    return "no-claimed-pattern";
  }

  const claimedId = freeClaimedPatternIdForSystem(access.freeClaimsBySystem, patternSystem)?.trim();
  if (!claimedId) return "no-claimed-pattern";

  const result = await loadProject(claimedId);
  return result.ok ? "loaded" : "load-failed";
}
