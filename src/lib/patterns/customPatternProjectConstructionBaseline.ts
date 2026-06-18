/**
 * Session snapshot of the construction stamped on a saved project at hydration time.
 * Used to block Update from writing drop-shoulder fields onto a sleeveless project id.
 */
import type { CustomPatternProject } from "./customPatternProjectTypes";
import { hasAuthoritativeDropShoulderConstruction } from "./patternConstructionIdentity";

export const HYDRATED_PROJECT_CONSTRUCTION_BASELINE_KEY =
  "kbm_hydrated_project_construction_baseline";

export type HydratedProjectConstructionBaseline = {
  projectId: string;
  hadAuthoritativeDropShoulder: boolean;
};

function section(obj: unknown): Record<string, unknown> {
  return obj && typeof obj === "object" && !Array.isArray(obj) ? (obj as Record<string, unknown>) : {};
}

export function buildHydratedConstructionBaseline(
  project: CustomPatternProject,
): HydratedProjectConstructionBaseline {
  return {
    projectId: project.id,
    hadAuthoritativeDropShoulder: hasAuthoritativeDropShoulderConstruction(
      section(project.pattern.style),
      project.customOverrides,
    ),
  };
}

export function writeHydratedConstructionBaseline(project: CustomPatternProject): void {
  if (typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.setItem(
      HYDRATED_PROJECT_CONSTRUCTION_BASELINE_KEY,
      JSON.stringify(buildHydratedConstructionBaseline(project)),
    );
  } catch {
    /* ignore */
  }
}

export function readHydratedConstructionBaseline(): HydratedProjectConstructionBaseline | null {
  if (typeof sessionStorage === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(HYDRATED_PROJECT_CONSTRUCTION_BASELINE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    const row = parsed as Record<string, unknown>;
    const projectId = typeof row.projectId === "string" ? row.projectId.trim() : "";
    if (!projectId) return null;
    return {
      projectId,
      hadAuthoritativeDropShoulder: row.hadAuthoritativeDropShoulder === true,
    };
  } catch {
    return null;
  }
}

export function clearHydratedConstructionBaseline(): void {
  if (typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.removeItem(HYDRATED_PROJECT_CONSTRUCTION_BASELINE_KEY);
  } catch {
    /* ignore */
  }
}

/** True when the draft gained drop-shoulder keys since the linked project was hydrated. */
export function draftHasUnsavedDropShoulderConstructionDrift(
  draftHasAuthoritativeDropShoulder: boolean,
  activeProjectId: string,
): boolean {
  if (!draftHasAuthoritativeDropShoulder) return false;
  const baseline = readHydratedConstructionBaseline();
  if (!baseline || baseline.projectId !== activeProjectId) return false;
  return !baseline.hadAuthoritativeDropShoulder;
}
