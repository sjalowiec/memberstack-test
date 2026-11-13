/**
 * Weekend Triangle Scarf Summary/Edit Save vs Update.
 * The active scarf project id decides create vs update. Entry path still
 * controls guest local apply and Cancel.
 */
import type { ViewerAccessState } from "../../memberAccess";
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
import { hatPatternHasMemberSavedProjectPrivileges } from "../hat/hatPatternWorkspaceAccess";
import type { TriangleScarfDraft } from "./triangleScarfDraft";
import { writeTriangleScarfDraft } from "./triangleScarfDraft";
import {
  TRIANGLE_SCARF_SUMMARY_HINT_FROM_BUILDER,
  TRIANGLE_SCARF_SUMMARY_HINT_FROM_EDIT,
  TRIANGLE_SCARF_SUMMARY_HINT_SAVE,
  TRIANGLE_SCARF_SUMMARY_PRIMARY_FROM_BUILDER_LABEL,
  TRIANGLE_SCARF_SUMMARY_PRIMARY_FROM_EDIT_LABEL,
  TRIANGLE_SCARF_SUMMARY_PRIMARY_SAVE_LABEL,
  type TriangleScarfSummaryEntryPath,
} from "./triangleScarfNavigation";
import {
  applyTriangleScarfPatternNameToDraft,
  buildDefaultTriangleScarfPatternTitle,
  readTriangleScarfActiveProjectId,
  writeTriangleScarfActiveProjectId,
} from "./triangleScarfSavedProject";

export type TriangleScarfPatternPersistKind = "save" | "update" | "view" | "apply-local";

export type TriangleScarfPatternPersistAction = {
  kind: TriangleScarfPatternPersistKind;
  label: string;
  hint: string;
  persist: "create" | "update" | "local-only";
};

export function resolveTriangleScarfPatternPersistAction(input: {
  hasMemberSavedProjectPrivileges: boolean;
  activeProjectId?: string | null;
  entryPath: TriangleScarfSummaryEntryPath;
}): TriangleScarfPatternPersistAction {
  const activeId = input.activeProjectId?.trim() ?? "";
  if (input.hasMemberSavedProjectPrivileges) {
    if (activeId) {
      return {
        kind: "update",
        label: TRIANGLE_SCARF_SUMMARY_PRIMARY_FROM_EDIT_LABEL,
        hint: TRIANGLE_SCARF_SUMMARY_HINT_FROM_EDIT,
        persist: "update",
      };
    }
    return {
      kind: "save",
      label: TRIANGLE_SCARF_SUMMARY_PRIMARY_SAVE_LABEL,
      hint: TRIANGLE_SCARF_SUMMARY_HINT_SAVE,
      persist: "create",
    };
  }
  if (input.entryPath === "from-builder") {
    return {
      kind: "view",
      label: TRIANGLE_SCARF_SUMMARY_PRIMARY_FROM_BUILDER_LABEL,
      hint: TRIANGLE_SCARF_SUMMARY_HINT_FROM_BUILDER,
      persist: "local-only",
    };
  }
  return {
    kind: "apply-local",
    label: TRIANGLE_SCARF_SUMMARY_PRIMARY_FROM_EDIT_LABEL,
    hint: TRIANGLE_SCARF_SUMMARY_HINT_FROM_EDIT,
    persist: "local-only",
  };
}

export function resolveTriangleScarfPatternPersistActionFromViewer(input: {
  viewerAccessState: ViewerAccessState;
  activeProjectId?: string | null;
  entryPath: TriangleScarfSummaryEntryPath;
}): TriangleScarfPatternPersistAction {
  return resolveTriangleScarfPatternPersistAction({
    hasMemberSavedProjectPrivileges: hatPatternHasMemberSavedProjectPrivileges(
      input.viewerAccessState,
    ),
    activeProjectId: input.activeProjectId,
    entryPath: input.entryPath,
  });
}

/** Name and project notes are for members who can save. Guests stay hidden. */
export function triangleScarfSummaryShouldShowProjectDetails(
  hasMemberSavedProjectPrivileges: boolean,
): boolean {
  return hasMemberSavedProjectPrivileges;
}

export function resolveTriangleScarfSummaryAfterPersistNext(
  persist: TriangleScarfPatternPersistAction["persist"],
): "confirm" | "guest-continue" {
  return persist === "local-only" ? "guest-continue" : "confirm";
}

export function triangleScarfDraftAsSavePattern(draft: TriangleScarfDraft): SleevelessPatternRecord {
  return {
    ...draft,
    patternType: "triangle-scarf",
    patternSystem: "triangle-scarf",
  } as unknown as SleevelessPatternRecord;
}

async function uniqueTriangleScarfSaveName(requested: string): Promise<string> {
  const base = requested.trim() || buildDefaultTriangleScarfPatternTitle();
  if (!nameMatchesDefaultOrNumbered(base, buildDefaultTriangleScarfPatternTitle())) {
    return base;
  }
  const list = await listCustomPatternProjects("sleeveless");
  if (!list.ok) return base;
  return resolveUniqueDefaultPatternName(
    buildDefaultTriangleScarfPatternTitle(),
    list.projects.map((project) => project.name),
  );
}

export type PersistTriangleScarfPatternProjectResult =
  | { ok: true; project: CustomPatternProject; created: boolean }
  | { ok: false; error: string };

/**
 * Create or update the saved scarf from `kbm_triangle_scarf_draft`.
 * Update never creates a new project. Neither path deletes a saved project.
 */
export async function persistTriangleScarfPatternProject(options: {
  draft: TriangleScarfDraft;
  name?: string;
  mode?: "create" | "update";
}): Promise<PersistTriangleScarfPatternProjectResult> {
  const activeId = readTriangleScarfActiveProjectId();
  const mode = options.mode ?? (activeId ? "update" : "create");

  if (mode === "update") {
    if (!activeId) {
      return { ok: false, error: "This scarf is not saved yet. Use Save Pattern to create it." };
    }
    const loaded = await loadCustomPatternProject(activeId, "sleeveless");
    if (!loaded.ok) return { ok: false, error: loaded.error };
    const name =
      options.name?.trim() ||
      loaded.project.name.trim() ||
      buildDefaultTriangleScarfPatternTitle();
    const namedDraft = applyTriangleScarfPatternNameToDraft(options.draft, name);
    const res = await updateCustomPatternProject({
      id: activeId,
      name,
      notes: namedDraft.patternProject?.notes ?? loaded.project.notes ?? "",
      family: loaded.project.family ?? "sleeveless",
      source: loaded.project.source ?? "express",
      pattern: triangleScarfDraftAsSavePattern(namedDraft),
      customOverrides: loaded.project.customOverrides ?? {},
      version: loaded.project.version,
    });
    if (!res.ok) return { ok: false, error: res.error };
    writeTriangleScarfDraft(namedDraft);
    writeTriangleScarfActiveProjectId(activeId, res.project.name);
    void logPatternActivity({
      eventType: "pattern_updated",
      patternSystem: "triangle-scarf",
      patternId: activeId,
      patternTitle: res.project.name,
      sourcePage: "/patterns/triangle-scarf/summary/",
    });
    return { ok: true, project: { ...res.project, id: activeId }, created: false };
  }

  const name = await uniqueTriangleScarfSaveName(options.name ?? "");
  const namedDraft = applyTriangleScarfPatternNameToDraft(options.draft, name);
  const res = await createCustomPatternProject({
    name,
    notes: namedDraft.patternProject?.notes ?? "",
    family: "sleeveless",
    source: "express",
    pattern: triangleScarfDraftAsSavePattern(namedDraft),
    customOverrides: {},
  });
  if (!res.ok) return { ok: false, error: res.error };
  writeTriangleScarfDraft(namedDraft);
  writeTriangleScarfActiveProjectId(res.project.id, res.project.name);
  void logPatternActivity({
    eventType: "pattern_saved",
    patternSystem: "triangle-scarf",
    patternId: res.project.id,
    patternTitle: res.project.name,
    sourcePage: "/patterns/triangle-scarf/summary/",
  });
  return { ok: true, project: res.project, created: true };
}
