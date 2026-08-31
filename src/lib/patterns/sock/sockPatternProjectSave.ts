/**
 * Socks Update Pattern cloud persist — source of truth is the active Socks project id.
 *
 * Reuses the existing Custom Pattern create/update helpers (same as Hat).
 * Does not touch the sweater active-project pointer. Update never creates a new project.
 */
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
import type { SockDraft } from "./sockDraft";
import { writeSockDraft } from "./sockDraft";
import {
  applySockPatternNameToDraft,
  buildDefaultSockPatternTitle,
  readSockActiveProjectId,
  writeSockActiveProjectId,
} from "./sockSavedProject";

/**
 * Cloud save payload for a Socks draft. Always stamps Socks identity so My Patterns
 * can classify the project — `family` stays `"sleeveless"` (shared blob store).
 */
export function sockDraftAsSavePattern(draft: SockDraft): SleevelessPatternRecord {
  return {
    ...draft,
    patternType: "socks",
    patternSystem: "socks",
  } as unknown as SleevelessPatternRecord;
}

async function uniqueSockSaveName(requested: string): Promise<string> {
  const base = requested.trim() || buildDefaultSockPatternTitle();
  if (!nameMatchesDefaultOrNumbered(base, buildDefaultSockPatternTitle())) {
    return base;
  }
  const list = await listCustomPatternProjects("sleeveless");
  if (!list.ok) return base;
  return resolveUniqueDefaultPatternName(
    buildDefaultSockPatternTitle(),
    list.projects.map((project) => project.name),
  );
}

export type PersistSockPatternProjectResult =
  | { ok: true; project: CustomPatternProject; created: boolean }
  | { ok: false; error: string };

/**
 * Create or update the Socks saved project from `kbm_socks_draft`.
 * Uses the existing Custom Pattern create/update helpers. Does not touch the
 * sweater active-project pointer. Update never creates a new project.
 */
export async function persistSockPatternProject(options: {
  draft: SockDraft;
  name?: string;
  mode?: "create" | "update";
}): Promise<PersistSockPatternProjectResult> {
  const activeId = readSockActiveProjectId();
  const mode = options.mode ?? (activeId ? "update" : "create");

  if (mode === "update") {
    if (!activeId) {
      return { ok: false, error: "This socks pattern is not saved yet. Use Update Pattern to create it." };
    }
    const loaded = await loadCustomPatternProject(activeId, "sleeveless");
    if (!loaded.ok) return { ok: false, error: loaded.error };
    const name =
      options.name?.trim() ||
      loaded.project.name.trim() ||
      buildDefaultSockPatternTitle();
    const namedDraft = applySockPatternNameToDraft(options.draft, name);
    const res = await updateCustomPatternProject({
      id: activeId,
      name,
      notes: namedDraft.patternProject?.notes ?? loaded.project.notes ?? "",
      family: loaded.project.family ?? "sleeveless",
      source: loaded.project.source ?? "express",
      pattern: sockDraftAsSavePattern(namedDraft),
      customOverrides: loaded.project.customOverrides ?? {},
      version: loaded.project.version,
    });
    if (!res.ok) return { ok: false, error: res.error };
    writeSockDraft(namedDraft);
    writeSockActiveProjectId(activeId, res.project.name);
    return { ok: true, project: { ...res.project, id: activeId }, created: false };
  }

  const name = await uniqueSockSaveName(options.name ?? "");
  const namedDraft = applySockPatternNameToDraft(options.draft, name);
  const res = await createCustomPatternProject({
    name,
    notes: namedDraft.patternProject?.notes ?? "",
    family: "sleeveless",
    source: "express",
    pattern: sockDraftAsSavePattern(namedDraft),
    customOverrides: {},
  });
  if (!res.ok) return { ok: false, error: res.error };
  writeSockDraft(namedDraft);
  writeSockActiveProjectId(res.project.id, res.project.name);
  return { ok: true, project: res.project, created: true };
}
