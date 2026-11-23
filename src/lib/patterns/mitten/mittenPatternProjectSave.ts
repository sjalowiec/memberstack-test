/**
 * Account save for a slotted mitten.
 * Reuses the Custom Pattern create/update helpers. Family stays "sleeveless".
 * Update never creates a second project.
 */
import { logPatternActivity } from "../patternActivityLog";
import {
  createCustomPatternProject,
  listCustomPatternProjects,
  loadCustomPatternProject,
  updateCustomPatternProject,
} from "../customPatternProjectClient";
import type { CustomPatternProject } from "../customPatternProjectTypes";
import type { SleevelessPatternRecord } from "../patternStorage";
import {
  nameMatchesDefaultOrNumbered,
  resolveUniqueDefaultPatternName,
} from "../customPatternSavedProjectsPanel";
import { writeMittenDraft, type MittenDraft } from "./mittenDraft";
import {
  applyMittenPatternNameToDraft,
  buildDefaultMittenPatternTitle,
  readMittenActiveProjectId,
  writeMittenActiveProjectId,
} from "./mittenSavedProject";

export function mittenDraftAsSavePattern(draft: MittenDraft): SleevelessPatternRecord {
  return {
    ...draft,
    patternType: "mittens",
    patternSystem: "mittens",
  } as unknown as SleevelessPatternRecord;
}

async function uniqueMittenSaveName(requested: string): Promise<string> {
  const base = requested.trim() || buildDefaultMittenPatternTitle();
  if (!nameMatchesDefaultOrNumbered(base, buildDefaultMittenPatternTitle())) {
    return base;
  }
  const list = await listCustomPatternProjects("sleeveless");
  if (!list.ok) return base;
  return resolveUniqueDefaultPatternName(
    buildDefaultMittenPatternTitle(),
    list.projects.map((project) => project.name),
  );
}

export type PersistMittenPatternProjectResult =
  | { ok: true; project: CustomPatternProject; created: boolean }
  | { ok: false; error: string };

export async function persistMittenPatternProject(options: {
  draft: MittenDraft;
  name?: string;
  mode?: "create" | "update";
}): Promise<PersistMittenPatternProjectResult> {
  const activeId = readMittenActiveProjectId();
  const mode = options.mode ?? (activeId ? "update" : "create");

  if (mode === "update") {
    if (!activeId) {
      return { ok: false, error: "This mitten pattern is not saved yet." };
    }
    const loaded = await loadCustomPatternProject(activeId, "sleeveless");
    if (!loaded.ok) return { ok: false, error: loaded.error };
    const name =
      options.name?.trim() ||
      loaded.project.name.trim() ||
      buildDefaultMittenPatternTitle();
    const namedDraft = applyMittenPatternNameToDraft(options.draft, name);
    const res = await updateCustomPatternProject({
      id: activeId,
      name,
      notes: namedDraft.patternProject?.notes ?? loaded.project.notes ?? "",
      family: loaded.project.family ?? "sleeveless",
      source: loaded.project.source ?? "express",
      pattern: mittenDraftAsSavePattern(namedDraft),
      customOverrides: loaded.project.customOverrides ?? {},
      version: loaded.project.version,
    });
    if (!res.ok) return { ok: false, error: res.error };
    writeMittenDraft(namedDraft);
    writeMittenActiveProjectId(activeId, res.project.name);
    void logPatternActivity({
      eventType: "pattern_updated",
      patternSystem: "mittens",
      patternId: activeId,
      patternTitle: res.project.name,
      sourcePage: "/patterns/mittens/summary/",
    });
    return { ok: true, project: { ...res.project, id: activeId }, created: false };
  }

  const name = await uniqueMittenSaveName(options.name ?? "");
  const namedDraft = applyMittenPatternNameToDraft(options.draft, name);
  const res = await createCustomPatternProject({
    name,
    notes: namedDraft.patternProject?.notes ?? "",
    family: "sleeveless",
    source: "express",
    pattern: mittenDraftAsSavePattern(namedDraft),
    customOverrides: {},
  });
  if (!res.ok) return { ok: false, error: res.error };
  writeMittenDraft(namedDraft);
  writeMittenActiveProjectId(res.project.id, res.project.name);
  void logPatternActivity({
    eventType: "pattern_saved",
    patternSystem: "mittens",
    patternId: res.project.id,
    patternTitle: res.project.name,
    sourcePage: "/patterns/mittens/summary/",
  });
  return { ok: true, project: res.project, created: true };
}
