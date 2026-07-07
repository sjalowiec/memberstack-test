/**
 * Management actions for a specific saved Custom Pattern project (by id), used by
 * "manage existing patterns" surfaces: the My Patterns list and the library drawer.
 *
 * Unlike the editing-banner / design-panel "Save a Copy" (which copies the current
 * working draft via {@link smartSaveCustomPatternProject}), these operate directly on
 * a stored project id and DO NOT mutate the working draft or the active/open project.
 * That keeps the user's current session intact while they manage their saved list.
 *
 * Copy preserves the original pattern data + sizing chart exactly (the stored `pattern`
 * blob is duplicated verbatim) and reuses {@link resolveUniqueCopyName} for naming.
 */
import {
  createCustomPatternProject,
  listCustomPatternProjects,
  loadCustomPatternProject,
  updateCustomPatternProject,
} from "./customPatternProjectClient";
import type { CustomPatternFamily, CustomPatternProject } from "./customPatternProjectTypes";
import {
  readActiveCustomPatternProjectId,
  writeActiveCustomPatternProjectId,
} from "./customPatternProjectActiveId";
import { resolveUniqueCopyName } from "./customPatternSavedProjectsPanel";
import {
  canCopySavedCustomPatternForAccess,
  SAVED_CUSTOM_PATTERN_COPY_DISABLED_TEXT,
} from "./savedCustomPatternCopyAccess";
import { resolveSleevelessUserAccessSnapshot } from "./sleevelessPatternSystemAccessClient";

export type ManageSavedCustomPatternResult =
  | { ok: true; project: CustomPatternProject }
  | { ok: false; error: string };

/**
 * Copies a stored saved project into a brand-new saved project.
 *
 * - New unique project id (assigned server-side).
 * - Same family/source, same pattern data, same sizing chart (verbatim `pattern`).
 * - Name = "[Original Name] - Copy" (incrementing on collisions).
 * - Original project is left unchanged; working draft / active project untouched.
 */
export async function copySavedCustomPatternProjectById(
  projectId: string,
  family: CustomPatternFamily = "sleeveless",
): Promise<ManageSavedCustomPatternResult> {
  const access = await resolveSleevelessUserAccessSnapshot();
  if (!canCopySavedCustomPatternForAccess(access)) {
    return { ok: false, error: SAVED_CUSTOM_PATTERN_COPY_DISABLED_TEXT };
  }

  const loaded = await loadCustomPatternProject(projectId, family);
  if (!loaded.ok) return { ok: false, error: loaded.error };
  const source = loaded.project;

  let existingNames: string[] = [];
  const list = await listCustomPatternProjects(family);
  if (list.ok) {
    existingNames = list.projects.map((project) => project.name);
  }

  const copyName = resolveUniqueCopyName(source.name, existingNames);
  const res = await createCustomPatternProject({
    name: copyName,
    notes: source.notes,
    family: source.family ?? family,
    source: source.source,
    pattern: source.pattern,
    customOverrides: source.customOverrides ?? {},
  });
  if (!res.ok) return { ok: false, error: res.error };
  return { ok: true, project: res.project };
}

/**
 * Renames a stored saved project in place (keeps the same id and pattern data).
 * If the renamed project is the active/open project, the linked name is kept in sync.
 */
export async function renameSavedCustomPatternProject(
  projectId: string,
  requestedName: string,
  family: CustomPatternFamily = "sleeveless",
): Promise<ManageSavedCustomPatternResult> {
  const name = requestedName.trim();
  if (!name) return { ok: false, error: "Enter a pattern name." };

  const loaded = await loadCustomPatternProject(projectId, family);
  if (!loaded.ok) return { ok: false, error: loaded.error };
  const source = loaded.project;

  const pattern = {
    ...source.pattern,
    patternProject: {
      notes: source.pattern.patternProject?.notes ?? source.notes ?? "",
      ...source.pattern.patternProject,
      title: name,
      titleCustomized: true,
    },
  };

  const res = await updateCustomPatternProject({
    id: projectId,
    name,
    notes: source.notes,
    family: source.family ?? family,
    source: source.source,
    pattern,
    customOverrides: source.customOverrides ?? {},
    version: source.version,
    metadataOnly: true,
  });
  if (!res.ok) return { ok: false, error: res.error };

  if (readActiveCustomPatternProjectId() === projectId) {
    writeActiveCustomPatternProjectId(projectId, res.project.name);
  }
  return { ok: true, project: res.project };
}
