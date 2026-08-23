/**
 * Hat Summary/Edit Save vs Update — source of truth is the active Hat project id.
 *
 * Entry path (builder vs Edit Pattern) still controls Cancel / guest local apply.
 * It must not make an unsaved Hat look like an update.
 */
import type { ViewerAccessState } from "../../memberAccess";
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
import { hatPatternHasMemberSavedProjectPrivileges } from "./hatPatternWorkspaceAccess";
import type { HatDraft } from "./hatDraft";
import { writeHatDraft } from "./hatDraft";
import {
  HAT_SUMMARY_HINT_FROM_BUILDER,
  HAT_SUMMARY_HINT_FROM_EDIT,
  HAT_SUMMARY_HINT_SAVE,
  HAT_SUMMARY_PRIMARY_FROM_BUILDER_LABEL,
  HAT_SUMMARY_PRIMARY_FROM_EDIT_LABEL,
  HAT_SUMMARY_PRIMARY_SAVE_LABEL,
  type HatSummaryEntryPath,
} from "./hatPatternNavigation";
import {
  applyHatPatternNameToDraft,
  buildDefaultHatPatternTitle,
  readHatActiveProjectId,
  writeHatActiveProjectId,
} from "./hatSavedProject";

export type HatPatternPersistKind = "save" | "update" | "view" | "apply-local";

export type HatPatternPersistAction = {
  kind: HatPatternPersistKind;
  label: string;
  hint: string;
  /** Cloud create/update, or local draft write only. */
  persist: "create" | "update" | "local-only";
};

export type ResolveHatPatternPersistActionInput = {
  hasMemberSavedProjectPrivileges: boolean;
  activeProjectId?: string | null;
  entryPath: HatSummaryEntryPath;
};

export function resolveHatPatternPersistAction(
  input: ResolveHatPatternPersistActionInput,
): HatPatternPersistAction {
  const activeId = input.activeProjectId?.trim() ?? "";
  if (input.hasMemberSavedProjectPrivileges) {
    if (activeId) {
      return {
        kind: "update",
        label: HAT_SUMMARY_PRIMARY_FROM_EDIT_LABEL,
        hint: HAT_SUMMARY_HINT_FROM_EDIT,
        persist: "update",
      };
    }
    return {
      kind: "save",
      label: HAT_SUMMARY_PRIMARY_SAVE_LABEL,
      hint: HAT_SUMMARY_HINT_SAVE,
      persist: "create",
    };
  }
  if (input.entryPath === "from-builder") {
    return {
      kind: "view",
      label: HAT_SUMMARY_PRIMARY_FROM_BUILDER_LABEL,
      hint: HAT_SUMMARY_HINT_FROM_BUILDER,
      persist: "local-only",
    };
  }
  return {
    kind: "apply-local",
    label: HAT_SUMMARY_PRIMARY_FROM_EDIT_LABEL,
    hint: HAT_SUMMARY_HINT_FROM_EDIT,
    persist: "local-only",
  };
}

export function resolveHatPatternPersistActionFromViewer(input: {
  viewerAccessState: ViewerAccessState;
  activeProjectId?: string | null;
  entryPath: HatSummaryEntryPath;
}): HatPatternPersistAction {
  return resolveHatPatternPersistAction({
    hasMemberSavedProjectPrivileges: hatPatternHasMemberSavedProjectPrivileges(
      input.viewerAccessState,
    ),
    activeProjectId: input.activeProjectId,
    entryPath: input.entryPath,
  });
}

/**
 * Name/Notes on Hat Summary/Edit is for members who can persist a Hat —
 * including a new Hat that does not have a saved project id yet. Guests stay hidden.
 */
export function hatSummaryShouldShowProjectDetails(
  hasMemberSavedProjectPrivileges: boolean,
): boolean {
  return hasMemberSavedProjectPrivileges;
}

/** After cloud create/update, stay on Summary/Edit and offer Keep Editing / View. Guests still continue. */
export function resolveHatSummaryAfterPersistNext(
  persist: HatPatternPersistAction["persist"],
): "confirm" | "guest-continue" {
  return persist === "local-only" ? "guest-continue" : "confirm";
}

/**
 * Cloud save payload for a Hat draft. Always stamps Hat identity so My Patterns
 * can classify the project — `family` stays `"sleeveless"` (shared blob store).
 */
export function hatDraftAsSavePattern(draft: HatDraft): SleevelessPatternRecord {
  return {
    ...draft,
    patternType: "hat",
    patternSystem: "hat",
  } as unknown as SleevelessPatternRecord;
}

async function uniqueHatSaveName(requested: string): Promise<string> {
  const base = requested.trim() || buildDefaultHatPatternTitle();
  if (!nameMatchesDefaultOrNumbered(base, buildDefaultHatPatternTitle())) {
    return base;
  }
  const list = await listCustomPatternProjects("sleeveless");
  if (!list.ok) return base;
  return resolveUniqueDefaultPatternName(
    buildDefaultHatPatternTitle(),
    list.projects.map((project) => project.name),
  );
}

export type PersistHatPatternProjectResult =
  | { ok: true; project: CustomPatternProject; created: boolean }
  | { ok: false; error: string };

/**
 * Create or update the Hat saved project from `kbm_hat_draft`.
 * Uses the existing Custom Pattern create/update helpers. Does not touch the
 * sweater active-project pointer. Update never creates a new project.
 */
export async function persistHatPatternProject(options: {
  draft: HatDraft;
  name?: string;
  mode?: "create" | "update";
}): Promise<PersistHatPatternProjectResult> {
  const activeId = readHatActiveProjectId();
  const mode = options.mode ?? (activeId ? "update" : "create");

  if (mode === "update") {
    if (!activeId) {
      return { ok: false, error: "This hat is not saved yet. Use Save Pattern to create it." };
    }
    const loaded = await loadCustomPatternProject(activeId, "sleeveless");
    if (!loaded.ok) return { ok: false, error: loaded.error };
    const name =
      options.name?.trim() ||
      loaded.project.name.trim() ||
      buildDefaultHatPatternTitle();
    const namedDraft = applyHatPatternNameToDraft(options.draft, name);
    const res = await updateCustomPatternProject({
      id: activeId,
      name,
      notes: namedDraft.patternProject?.notes ?? loaded.project.notes ?? "",
      family: loaded.project.family ?? "sleeveless",
      source: loaded.project.source ?? "express",
      pattern: hatDraftAsSavePattern(namedDraft),
      customOverrides: loaded.project.customOverrides ?? {},
      version: loaded.project.version,
    });
    if (!res.ok) return { ok: false, error: res.error };
    writeHatDraft(namedDraft);
    writeHatActiveProjectId(activeId, res.project.name);
    return { ok: true, project: { ...res.project, id: activeId }, created: false };
  }

  const name = await uniqueHatSaveName(options.name ?? "");
  const namedDraft = applyHatPatternNameToDraft(options.draft, name);
  const res = await createCustomPatternProject({
    name,
    notes: namedDraft.patternProject?.notes ?? "",
    family: "sleeveless",
    source: "express",
    pattern: hatDraftAsSavePattern(namedDraft),
    customOverrides: {},
  });
  if (!res.ok) return { ok: false, error: res.error };
  writeHatDraft(namedDraft);
  writeHatActiveProjectId(res.project.id, res.project.name);
  return { ok: true, project: res.project, created: true };
}
