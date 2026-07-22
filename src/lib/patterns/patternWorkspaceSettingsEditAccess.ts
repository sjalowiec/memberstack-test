/**
 * In-place Summary/Edit workspace gate on the pattern page (Edit Pattern drawer).
 *
 * Requires paid membership (`hasSystemAccess`). Free users may view/print/knit their quick
 * pattern but cannot open this workspace — including via `?edit=1`, the Edit button, or
 * `openDrawer()`. Other settings-edit surfaces (e.g. per-system free-claim builder rights)
 * still use {@link canEditPatternSettingsForSystem} elsewhere.
 */
import {
  hasSleevelessPatternSystemAccess,
  type SleevelessUserAccess,
} from "./sleevelessPatternSystemAccess";
import { resolveSleevelessUserAccessSnapshot } from "./sleevelessPatternSystemAccessClient";
import { showPatternEditingUnlockModal } from "./patternEditingUnlockModal";
import { logPatternEditGateAccess, logPatternEditGateDebug } from "./patternEditGateDebug";
import {
  resolvePatternSystemForEntitlement,
  type PatternSystemId,
} from "./patternSystemId";

/** Beta, paid members (and JSON unlock) may open the pattern-page edit workspace. */
export function canOpenPatternWorkspaceEditWorkspace(access: SleevelessUserAccess): boolean {
  return hasSleevelessPatternSystemAccess(access);
}

export function isPatternWorkspaceSettingsEditingLocked(
  access: SleevelessUserAccess,
  _patternSystem?: PatternSystemId,
): boolean {
  return !canOpenPatternWorkspaceEditWorkspace(access);
}

export async function resolvePatternWorkspaceSettingsEditGate(): Promise<{
  access: SleevelessUserAccess;
  patternSystem: PatternSystemId;
  locked: boolean;
}> {
  logPatternEditGateDebug("resolvePatternWorkspaceSettingsEditGate.start");
  const access = await resolveSleevelessUserAccessSnapshot();
  const patternSystem = resolvePatternSystemForEntitlement();
  const locked = isPatternWorkspaceSettingsEditingLocked(access, patternSystem);
  logPatternEditGateAccess("resolvePatternWorkspaceSettingsEditGate.result", access, patternSystem);
  logPatternEditGateDebug("resolvePatternWorkspaceSettingsEditGate.result", {
    patternSystem,
    locked,
    drawerAllowed: !locked,
  });
  return { access, patternSystem, locked };
}

/** Returns true when the action was blocked and the unlock modal was offered. */
export function blockPatternWorkspaceSettingsEditOrOfferUnlock(
  access: SleevelessUserAccess,
  patternSystem: PatternSystemId,
): boolean {
  const locked = isPatternWorkspaceSettingsEditingLocked(access, patternSystem);
  logPatternEditGateDebug("blockPatternWorkspaceSettingsEditOrOfferUnlock", {
    patternSystem,
    locked,
    drawerAllowed: !locked,
  });
  if (!locked) return false;
  if (access.loggedIn) {
    showPatternEditingUnlockModal({ force: true, patternSystem });
  }
  return true;
}
