/**
 * Legacy first-free-pattern auto-save helper.
 *
 * Dynamic Patterns now require active membership, so {@link canCreatePatternForSystem} is false
 * for non-members and this path always skips. Kept so call sites remain stable.
 */
import { readActiveCustomPatternProjectId } from "./customPatternProjectActiveId";
import { smartSaveCustomPatternProject } from "./customPatternSavedProjectsPanel";
import { isFreeClaimedForSystem } from "./patternSystemFreeClaim";
import {
  patternSystemDisplayName,
  resolvePatternSystemFromPage,
  type PatternSystemId,
} from "./patternSystemId";
import { canCreatePatternForSystem, hasPatternSystemAccess } from "./sleevelessPatternSystemAccess";
import {
  markFreePatternClaimedForSystem,
  resolveSleevelessUserAccess,
} from "./sleevelessPatternSystemAccessClient";
import { resolvePatternProjectSaveName } from "./sleevelessPatternProjectMeta";
import { showPatternAutoSaveSuccessDialog } from "./patternAutoSaveSuccessDialog";

export type AutoSaveFirstFreePatternResult =
  | { status: "skipped"; reason: string }
  | { status: "saved"; patternSystem: PatternSystemId; projectId: string; projectName: string }
  | { status: "failed"; error: string };

export type MaybeAutoSaveFirstFreePatternOptions = {
  patternSystem?: PatternSystemId;
  root?: ParentNode;
  /** When false, skip the success dialog (tests). Default true. */
  showSuccessDialog?: boolean;
};

/**
 * No-op for non-members (membership required). Members skip because they already have access.
 */
export async function maybeAutoSaveFirstFreePattern(
  options: MaybeAutoSaveFirstFreePatternOptions = {},
): Promise<AutoSaveFirstFreePatternResult> {
  const patternSystem = options.patternSystem ?? resolvePatternSystemFromPage();
  const access = await resolveSleevelessUserAccess();

  if (!access.loggedIn) {
    return { status: "skipped", reason: "logged-out" };
  }
  if (hasPatternSystemAccess(access, patternSystem)) {
    return { status: "skipped", reason: "has-system-access" };
  }
  if (!canCreatePatternForSystem(access, patternSystem)) {
    return { status: "skipped", reason: "membership-required" };
  }
  if (isFreeClaimedForSystem(access.freeClaimsBySystem, patternSystem)) {
    return { status: "skipped", reason: "already-claimed" };
  }
  if (readActiveCustomPatternProjectId()) {
    return { status: "skipped", reason: "active-project-linked" };
  }

  const scope = options.root ?? (typeof document !== "undefined" ? document : undefined);
  const name = resolvePatternProjectSaveName(scope);
  if (!name.trim()) {
    return { status: "skipped", reason: "missing-name" };
  }

  const res = await smartSaveCustomPatternProject({
    mode: "create",
    resolveName: () => name.trim(),
    root: scope,
  });

  if (!res.ok) {
    return { status: "failed", error: res.error };
  }

  if (res.created) {
    await markFreePatternClaimedForSystem(patternSystem, res.project.id);
  }

  if (options.showSuccessDialog !== false) {
    showPatternAutoSaveSuccessDialog({
      patternSystem,
      projectName: res.project.name,
    });
  }

  return {
    status: "saved",
    patternSystem,
    projectId: res.project.id,
    projectName: res.project.name,
  };
}

export function buildAutoSaveSuccessMessage(patternSystem: PatternSystemId): string {
  return `Your free ${patternSystemDisplayName(patternSystem)} pattern has been saved.`;
}
