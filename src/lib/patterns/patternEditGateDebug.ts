/**
 * DEV diagnostics for Edit Pattern entitlement gating.
 * Enable: Astro dev server (default on). Disable: `window.__KBM_PATTERN_EDIT_GATE_DEBUG__ = false`.
 */
import { readActiveCustomPatternProjectId } from "./customPatternProjectActiveId";
import { readHydratedConstructionBaseline } from "./customPatternProjectConstructionBaseline";
import {
  getSleevelessAccessDebug,
  getCachedSleevelessUserAccess,
} from "./sleevelessPatternSystemAccessClient";
import { canEditPatternSettingsForSystem } from "./sleevelessPatternSystemAccess";
import type { SleevelessUserAccess } from "./sleevelessPatternSystemAccess";
import type { PatternSystemId } from "./patternSystemId";
import { resolvePatternSystemFromWorkingSession } from "./patternSystemId";
import { getCurrentPattern } from "./patternStorage";
import { hasAuthoritativeDropShoulderConstruction } from "./patternConstructionIdentity";

declare global {
  interface Window {
    /** Set to `false` to silence `[kbm] pattern-edit-gate` console logs in dev. */
    __KBM_PATTERN_EDIT_GATE_DEBUG__?: boolean;
  }
}

export function isPatternEditGateDebugEnabled(): boolean {
  if (typeof import.meta !== "undefined" && !import.meta.env?.DEV) return false;
  if (typeof window !== "undefined" && window.__KBM_PATTERN_EDIT_GATE_DEBUG__ === false) {
    return false;
  }
  return true;
}

function section(obj: unknown): Record<string, unknown> {
  return obj && typeof obj === "object" && !Array.isArray(obj)
    ? (obj as Record<string, unknown>)
    : {};
}

export type PatternEditGateDebugPayload = {
  path: string;
  url?: string;
  projectId?: string;
  patternSystem?: PatternSystemId;
  accessSource?: string;
  hasSystemAccess?: boolean;
  freeClaimsBySystem?: SleevelessUserAccess["freeClaimsBySystem"];
  canEdit?: boolean;
  locked?: boolean;
  drawerAllowed?: boolean;
  cachedAccess?: boolean;
  baseline?: ReturnType<typeof readHydratedConstructionBaseline>;
  draftDropShoulder?: boolean;
  workingSessionSystem?: PatternSystemId;
  extra?: Record<string, unknown>;
};

/** Structured console log for Edit Pattern gate paths (dev only). */
export function logPatternEditGateDebug(
  path: string,
  partial: Omit<PatternEditGateDebugPayload, "path"> = {},
): void {
  if (!isPatternEditGateDebugEnabled()) return;
  if (typeof console === "undefined" || typeof console.info !== "function") return;

  const accessDebug = getSleevelessAccessDebug();
  const cached = getCachedSleevelessUserAccess();
  const pattern = getCurrentPattern();
  const style = section(pattern.style);

  const payload: PatternEditGateDebugPayload = {
    path,
    url: typeof window !== "undefined" ? window.location.href : undefined,
    projectId: readActiveCustomPatternProjectId() || partial.projectId,
    workingSessionSystem: resolvePatternSystemFromWorkingSession(),
    baseline: readHydratedConstructionBaseline(),
    draftDropShoulder: hasAuthoritativeDropShoulderConstruction(style),
    accessSource: accessDebug?.source ?? partial.accessSource,
    cachedAccess: Boolean(cached),
    ...partial,
  };

  console.info("[kbm] pattern-edit-gate", payload);
}

export function logPatternEditGateAccess(
  path: string,
  access: SleevelessUserAccess,
  patternSystem: PatternSystemId,
): void {
  const canEdit = canEditPatternSettingsForSystem(access, patternSystem);
  logPatternEditGateDebug(path, {
    patternSystem,
    hasSystemAccess: access.hasSystemAccess === true,
    freeClaimsBySystem: access.freeClaimsBySystem,
    canEdit,
    locked: !canEdit,
  });
}
