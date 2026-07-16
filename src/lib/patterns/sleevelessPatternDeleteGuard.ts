/**
 * Delete-protection rule for a free user's one saved pattern per pattern system.
 */
import {
  freeClaimedPatternIdForSystem,
  isFreeClaimedForSystem,
} from "./patternSystemFreeClaim";
import {
  patternSystemDisplayName,
  resolvePatternSystemFromProject,
  type PatternSystemId,
} from "./patternSystemId";
import {
  hasSleevelessPatternSystemAccess,
  type SleevelessUserAccess,
} from "./sleevelessPatternSystemAccess";
import { resolveSleevelessUserAccessSnapshot } from "./sleevelessPatternSystemAccessClient";
import { listCustomPatternProjects } from "./customPatternProjectClient";
import type { CustomPatternFamily, CustomPatternProjectSummary } from "./customPatternProjectTypes";

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

export function isPatternDeleteProtectedForSystem({
  access,
  projectId,
  patternSystem,
  totalSavedCountForSystem,
}: PatternDeleteProtectionInput): boolean {
  if (!access?.loggedIn) return false;
  if (hasSleevelessPatternSystemAccess(access, patternSystem)) return false;
  if (!isFreeClaimedForSystem(access.freeClaimsBySystem, patternSystem)) return false;

  const claimedId = freeClaimedPatternIdForSystem(access.freeClaimsBySystem, patternSystem);
  if (claimedId) return projectId === claimedId;

  return totalSavedCountForSystem <= 1;
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

function countSummariesForSystem(
  summaries: CustomPatternProjectSummary[],
  patternSystem: PatternSystemId,
): number {
  return summaries.filter((row) => {
    const system =
      (row as CustomPatternProjectSummary & { patternSystem?: string }).patternSystem ??
      "sleeveless";
    return system === patternSystem;
  }).length;
}

export async function resolvePatternDeleteDecision(
  projectId: string,
  options: {
    family?: CustomPatternFamily;
    patternSystem?: PatternSystemId;
    totalSavedCountForSystem?: number;
  } = {},
): Promise<SleevelessPatternDeleteDecision> {
  const access = await resolveSleevelessUserAccessSnapshot();
  const patternSystem = options.patternSystem ?? "sleeveless";

  const allow = (): SleevelessPatternDeleteDecision => ({ blocked: false, message: null, access });
  const block = (): SleevelessPatternDeleteDecision => ({
    blocked: true,
    message: freePatternDeleteBlockedText(patternSystem),
    access,
  });

  if (
    !access.loggedIn ||
    hasSleevelessPatternSystemAccess(access, patternSystem) ||
    !isFreeClaimedForSystem(access.freeClaimsBySystem, patternSystem)
  ) {
    return allow();
  }

  const claimedId = freeClaimedPatternIdForSystem(access.freeClaimsBySystem, patternSystem);
  if (claimedId) {
    return projectId === claimedId ? block() : allow();
  }

  let totalSavedCountForSystem = options.totalSavedCountForSystem;
  if (typeof totalSavedCountForSystem !== "number") {
    const list = await listCustomPatternProjects(options.family ?? "sleeveless");
    totalSavedCountForSystem = list.ok
      ? countSummariesForSystem(list.projects, patternSystem)
      : 1;
  }

  return isPatternDeleteProtectedForSystem({
    access,
    projectId,
    patternSystem,
    totalSavedCountForSystem,
  })
    ? block()
    : allow();
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
