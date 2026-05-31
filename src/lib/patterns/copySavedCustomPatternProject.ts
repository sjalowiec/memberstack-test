/**
 * Duplicate a saved Custom Pattern project into a brand-new saved project.
 *
 * - New unique project id (server-generated on create).
 * - Same pattern system/type, sizing chart, current settings, and generated data — the
 *   original record's `pattern` is copied verbatim so the copy must NOT change the sizing
 *   chart (a Women's copy stays Women's, a Men's copy stays Men's, etc.).
 * - New title "[Original Name] - Copy", then "- Copy 2", "- Copy 3", … when the name is taken.
 * - The new copy becomes the active/open project; the original record is left untouched.
 */
import {
  createCustomPatternProject,
  listCustomPatternProjects,
  loadCustomPatternProject,
} from "./customPatternProjectClient";
import type {
  CustomPatternFamily,
  CustomPatternProject,
  SaveCustomPatternProjectRequest,
} from "./customPatternProjectTypes";
import { hydrateSavedCustomPatternProjectSession } from "./hydrateSavedCustomPatternProject";

export type CopySavedCustomPatternResult =
  | { ok: true; project: CustomPatternProject }
  | { ok: false; error: string };

export type CopySavedCustomPatternOptions = {
  family?: CustomPatternFamily;
  /** Existing saved-project names to dedupe against; fetched from the list when omitted. */
  existingNames?: string[];
};

/**
 * Builds a unique copy title: "[Original Name] - Copy", then "- Copy 2", "- Copy 3", …
 * skipping names already present in {@link existingNames} (case-insensitive).
 */
export function resolveUniqueCopyName(
  originalName: string,
  existingNames: Iterable<string> = [],
): string {
  const base = (originalName ?? "").trim() || "Untitled pattern";
  const taken = new Set<string>();
  for (const raw of existingNames) {
    if (typeof raw === "string") taken.add(raw.trim().toLowerCase());
  }

  const first = `${base} - Copy`;
  if (!taken.has(first.toLowerCase())) return first;

  let n = 2;
  while (taken.has(`${base} - Copy ${n}`.toLowerCase())) n += 1;
  return `${base} - Copy ${n}`;
}

function buildCopyPayload(
  original: CustomPatternProject,
  copyName: string,
): SaveCustomPatternProjectRequest {
  const pattern = original.pattern;
  const notes =
    typeof original.notes === "string"
      ? original.notes
      : typeof pattern.patternProject?.notes === "string"
        ? pattern.patternProject.notes
        : "";

  return {
    name: copyName,
    notes,
    family: original.family,
    source: original.source,
    // Copy the original pattern verbatim so the sizing chart, current settings, and
    // generated pattern data are preserved exactly. Only the project title changes.
    pattern: {
      ...pattern,
      patternProject: {
        title: copyName,
        notes,
        titleCustomized: true,
      },
    },
    customOverrides: { ...(original.customOverrides ?? {}) },
  };
}

/**
 * Loads a saved project, creates a duplicate with a unique "- Copy" name, and opens the copy
 * as the active project. The caller is responsible for gating on copy access
 * ({@link canCopySavedCustomPatternProject}).
 */
export async function copySavedCustomPatternProject(
  projectId: string,
  options: CopySavedCustomPatternOptions = {},
): Promise<CopySavedCustomPatternResult> {
  const family = options.family ?? "sleeveless";

  const loaded = await loadCustomPatternProject(projectId, family);
  if (!loaded.ok) return { ok: false, error: loaded.error };
  const original = loaded.project;

  let existingNames = options.existingNames;
  if (!existingNames) {
    const list = await listCustomPatternProjects(family);
    existingNames = list.ok ? list.projects.map((p) => p.name) : [original.name];
  }

  const copyName = resolveUniqueCopyName(original.name, existingNames);
  const created = await createCustomPatternProject(buildCopyPayload(original, copyName));
  if (!created.ok) return { ok: false, error: created.error };

  // The copy becomes the active/open project; the original record is untouched.
  hydrateSavedCustomPatternProjectSession(created.project);
  return { ok: true, project: created.project };
}
