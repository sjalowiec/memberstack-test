/**
 * Pattern workspace settings edit gate (gauge, measurements, size, style, regenerate).
 * Title, notes, rename, view, and print stay available for logged-in free users.
 */
import {
  canEditPatternSettingsForSystem,
  type SleevelessUserAccess,
} from "./sleevelessPatternSystemAccess";
import { resolveSleevelessUserAccessSnapshot } from "./sleevelessPatternSystemAccessClient";
import { offerPatternEditingUnlockModal } from "./patternEditingUnlockModal";
import { logPatternEditGateAccess, logPatternEditGateDebug } from "./patternEditGateDebug";
import {
  resolvePatternSystemForEntitlement,
  resolvePatternSystemFromWorkingSession,
  type PatternSystemId,
} from "./patternSystemId";

export function isPatternWorkspaceSettingsEditingLocked(
  access: SleevelessUserAccess,
  patternSystem?: PatternSystemId,
): boolean {
  const system = patternSystem ?? resolvePatternSystemFromWorkingSession();
  return !canEditPatternSettingsForSystem(access, system);
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
  offerPatternEditingUnlockModal(access, { patternSystem });
  return true;
}
