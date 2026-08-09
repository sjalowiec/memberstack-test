/**
 * Delete-protection helpers for saved Custom Pattern projects.
 *
 * Free-claim / system-access no longer blocks deletion — every owned saved pattern may be
 * deleted. These helpers remain as a stable API that always allows delete.
 */
import {
  patternSystemDisplayName,
  resolvePatternSystemFromProject,
  type PatternSystemId,
} from "./patternSystemId";
import type { SleevelessUserAccess } from "./sleevelessPatternSystemAccess";
import { resolveSleevelessUserAccessSnapshot } from "./sleevelessPatternSystemAccessClient";
import type { CustomPatternFamily } from "./customPatternProjectTypes";

/** @deprecated Delete is no longer blocked for free claimed patterns; retained for copy references. */
export function freePatternDeleteBlockedText(systemId: PatternSystemId): string {
  const name = patternSystemDisplayName(systemId);
  return `This is your free ${name} pattern. To keep access to it, it can't be deleted unless you unlock the full pattern system with membership.`;
}

/** @deprecated Use {@link freePatternDeleteBlockedText}. */
export const SLEEVELESS_FREE_PATTERN_DELETE_BLOCKED_TEXT = freePatternDeleteBlockedText("sleeveless");

export interface PatternDeleteProtectionInput {
  access: SleevelessUserAccess;
  projectId: string;
  patternSystem: PatternSystemId;
  totalSavedCountForSystem: number;
}

/** Always false — owned saved patterns are deletable regardless of free-claim or system access. */
export function isPatternDeleteProtectedForSystem(
  _input: PatternDeleteProtectionInput,
): boolean {
  return false;
}

/** @deprecated Use {@link isPatternDeleteProtectedForSystem}. */
export function isSleevelessPatternDeleteProtected(input: {
  access: SleevelessUserAccess;
  projectId: string;
  totalSavedCount: number;
  patternSystem?: PatternSystemId;
}): boolean {
  return isPatternDeleteProtectedForSystem({
    access: input.access,
    projectId: input.projectId,
    patternSystem: input.patternSystem ?? "sleeveless",
    totalSavedCountForSystem: input.totalSavedCount,
  });
}

export interface SleevelessPatternDeleteDecision {
  blocked: boolean;
  message: string | null;
  access: SleevelessUserAccess;
}

export async function resolvePatternDeleteDecision(
  _projectId: string,
  _options: {
    family?: CustomPatternFamily;
    patternSystem?: PatternSystemId;
    totalSavedCountForSystem?: number;
  } = {},
): Promise<SleevelessPatternDeleteDecision> {
  const access = await resolveSleevelessUserAccessSnapshot();
  return { blocked: false, message: null, access };
}

/** @deprecated Use {@link resolvePatternDeleteDecision}. */
export async function resolveSleevelessPatternDeleteDecision(
  projectId: string,
  options: { family?: CustomPatternFamily; totalSavedCount?: number; patternSystem?: PatternSystemId } = {},
): Promise<SleevelessPatternDeleteDecision> {
  return resolvePatternDeleteDecision(projectId, {
    family: options.family,
    patternSystem: options.patternSystem,
    totalSavedCountForSystem: options.totalSavedCount,
  });
}

export { resolvePatternSystemFromProject };
