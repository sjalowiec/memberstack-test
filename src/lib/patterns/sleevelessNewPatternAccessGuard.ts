/**
 * Gate for STARTING a brand-new pattern in a pattern system.
 */
import {
  canCreatePatternForSystem,
  resolvePatternSystemAlreadyClaimedCopy,
  resolvePatternSystemSaveLoggedOutCopy,
  type SleevelessUserAccess,
} from "./sleevelessPatternSystemAccess";
import { resolveSleevelessUserAccess } from "./sleevelessPatternSystemAccessClient";
import {
  mountPatternBuilderNewPatternUpgradeScreen,
  PATTERN_BUILDER_NEW_PATTERN_LOCKED_SCREEN_SELECTOR,
} from "./patternBuilderNewPatternUpgradeScreen";
import {
  resolvePatternSystemForBuilderGate,
  patternSystemDisplayName,
  type PatternSystemId,
} from "./patternSystemId";
import { logPatternEditGateDebug } from "./patternEditGateDebug";

/** @deprecated Use {@link resolveSaveAlreadyClaimedCopy} from cloud save module. */
export {
  SLEEVELESS_SAVE_ALREADY_CLAIMED_COPY,
  SLEEVELESS_SAVE_LOGGED_OUT_COPY,
} from "./sleevelessPatternProjectCloudSave";

export { PATTERN_BUILDER_NEW_PATTERN_LOCKED_SCREEN_SELECTOR as SLEEVELESS_NEW_PATTERN_LOCKED_SCREEN_SELECTOR };

export function canStartNewPatternForSystem(
  access: SleevelessUserAccess,
  systemId: PatternSystemId,
): boolean {
  return canCreatePatternForSystem(access, systemId);
}

function resolveNewPatternGateSystem(
  systemId?: PatternSystemId,
  doc?: Document,
): PatternSystemId {
  return systemId ?? resolvePatternSystemForBuilderGate(doc);
}

/** @deprecated Use {@link canStartNewPatternForSystem}. */
export function canStartNewSleevelessPattern(
  access: SleevelessUserAccess,
  systemId?: PatternSystemId,
  doc?: Document,
): boolean {
  const system = resolveNewPatternGateSystem(systemId, doc);
  logPatternEditGateDebug("canStartNewSleevelessPattern", {
    patternSystem: system,
    hasSystemAccess: access.hasSystemAccess,
    freeClaimsBySystem: access.freeClaimsBySystem,
    extra: { canStartNew: canStartNewPatternForSystem(access, system) },
  });
  return canStartNewPatternForSystem(access, system);
}

export function resolveNewPatternBlockedCopy(
  access: SleevelessUserAccess,
  systemId?: PatternSystemId,
  doc?: Document,
): string {
  const system = resolveNewPatternGateSystem(systemId, doc);
  return access.loggedIn
    ? resolvePatternSystemAlreadyClaimedCopy(system)
    : resolvePatternSystemSaveLoggedOutCopy(system);
}

/** @deprecated Use {@link resolveNewPatternBlockedCopy}. */
export function resolveSleevelessNewPatternBlockedCopy(
  access: SleevelessUserAccess,
  systemId?: PatternSystemId,
  doc?: Document,
): string {
  return resolveNewPatternBlockedCopy(access, systemId, doc);
}

export async function resolveCanStartNewPatternForSystem(
  systemId?: PatternSystemId,
  doc?: Document,
): Promise<boolean> {
  const system = resolveNewPatternGateSystem(systemId, doc);
  const access = await resolveSleevelessUserAccess();
  logPatternEditGateDebug("resolveCanStartNewPatternForSystem", {
    patternSystem: system,
    hasSystemAccess: access.hasSystemAccess,
    freeClaimsBySystem: access.freeClaimsBySystem,
    extra: { canStartNew: canStartNewPatternForSystem(access, system) },
  });
  return canStartNewPatternForSystem(access, system);
}

/** @deprecated Use {@link resolveCanStartNewPatternForSystem}. */
export async function resolveCanStartNewSleevelessPattern(doc?: Document): Promise<boolean> {
  return resolveCanStartNewPatternForSystem(undefined, doc);
}

export function showSleevelessNewPatternLockedScreen(
  root: ParentNode | null = typeof document !== "undefined" ? document : null,
  copy?: string,
  systemId?: PatternSystemId,
  access?: SleevelessUserAccess,
): HTMLElement | null {
  if (!root || typeof document === "undefined") return null;

  const doc =
    typeof Document !== "undefined" && root instanceof Document
      ? root
      : typeof HTMLElement !== "undefined" &&
          root instanceof HTMLElement &&
          root.ownerDocument
        ? root.ownerDocument
        : document;
  const system = resolveNewPatternGateSystem(systemId, doc);
  logPatternEditGateDebug("showSleevelessNewPatternLockedScreen", {
    patternSystem: system,
    extra: { titleSystemName: patternSystemDisplayName(system) },
  });

  const resolvedAccess = access ?? {
    loggedIn: true,
    hasSystemAccess: false,
    freeClaimsBySystem: {},
  };

  return mountPatternBuilderNewPatternUpgradeScreen(root, resolvedAccess, system, copy);
}

export {
  resolvePatternBuilderNewPatternUpgradeUiMode as resolveSleevelessNewPatternUpgradeUiMode,
  shouldBypassPatternBuilderNewPatternUpgradeScreen as shouldBypassSleevelessNewPatternUpgradeScreen,
} from "./patternBuilderNewPatternUpgrade";
