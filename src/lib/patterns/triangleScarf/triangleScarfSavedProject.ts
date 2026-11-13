/**
 * Saved Weekend Triangle Scarf identity — reuses Custom Pattern project name +
 * `patternProject` (same fields as the Hat). Does not use the sweater
 * active-project pointer.
 */
import {
  clearActiveCustomPatternProjectId,
  readActiveCustomPatternProjectId,
} from "../customPatternProjectActiveId";
import type { CustomPatternProject } from "../customPatternProjectTypes";
import { isTriangleScarfCustomPatternProject } from "../patternSystemId";
import { stripSavedPatternProjectIdFromLocation } from "../savedPatternViewUrl";
import { PROJECT_NOTES_MAX_LENGTH } from "../sleevelessPatternProjectMeta";
import {
  clearTriangleScarfDraft,
  createTriangleScarfDraft,
  normalizeTriangleScarfDraft,
  readTriangleScarfDraft,
  writeTriangleScarfDraft,
  type TriangleScarfDraft,
} from "./triangleScarfDraft";
import { TRIANGLE_SCARF_PATTERN_NAME } from "./triangleScarfNavigation";

export { isTriangleScarfCustomPatternProject };

/** Default saved name and My Patterns group label. */
export const TRIANGLE_SCARF_PATTERN_FAMILY_NAME = TRIANGLE_SCARF_PATTERN_NAME;

/** Scarf-only active saved-project pointer — never the sweater or Hat keys. */
export const TRIANGLE_SCARF_ACTIVE_PROJECT_ID_KEY = "kbm_triangle_scarf_active_project_id";
export const TRIANGLE_SCARF_ACTIVE_PROJECT_NAME_KEY = "kbm_triangle_scarf_active_project_name";

export function buildDefaultTriangleScarfPatternTitle(): string {
  return TRIANGLE_SCARF_PATTERN_FAMILY_NAME;
}

export function readTriangleScarfActiveProjectId(): string {
  if (typeof localStorage === "undefined") return "";
  try {
    return localStorage.getItem(TRIANGLE_SCARF_ACTIVE_PROJECT_ID_KEY)?.trim() ?? "";
  } catch {
    return "";
  }
}

export function readTriangleScarfActiveProjectLinkedName(): string {
  if (typeof localStorage === "undefined") return "";
  try {
    return localStorage.getItem(TRIANGLE_SCARF_ACTIVE_PROJECT_NAME_KEY)?.trim() ?? "";
  } catch {
    return "";
  }
}

export function writeTriangleScarfActiveProjectId(id: string, linkedName?: string): void {
  if (typeof localStorage === "undefined") return;
  try {
    if (id) {
      localStorage.setItem(TRIANGLE_SCARF_ACTIVE_PROJECT_ID_KEY, id);
      if (linkedName !== undefined) {
        const trimmed = linkedName.trim();
        if (trimmed) localStorage.setItem(TRIANGLE_SCARF_ACTIVE_PROJECT_NAME_KEY, trimmed);
        else localStorage.removeItem(TRIANGLE_SCARF_ACTIVE_PROJECT_NAME_KEY);
      }
    } else {
      localStorage.removeItem(TRIANGLE_SCARF_ACTIVE_PROJECT_ID_KEY);
      localStorage.removeItem(TRIANGLE_SCARF_ACTIVE_PROJECT_NAME_KEY);
    }
  } catch {
    /* ignore */
  }
}

export function clearTriangleScarfActiveProjectId(): void {
  writeTriangleScarfActiveProjectId("");
}

export function isEditingSavedTriangleScarfProject(): boolean {
  return Boolean(readTriangleScarfActiveProjectId());
}

/**
 * Drop the local saved-project link so New Pattern / Start Over is a fresh scarf.
 * Does not delete the saved Blob project, and does not touch a sweater or Hat session
 * unless the shared pointer still names this same scarf.
 */
export function clearTriangleScarfSavedProjectIdentity(): void {
  const scarfId = readTriangleScarfActiveProjectId();
  const sharedId = readActiveCustomPatternProjectId();
  clearTriangleScarfActiveProjectId();
  if (scarfId && sharedId && sharedId === scarfId) {
    clearActiveCustomPatternProjectId();
  }
  stripSavedPatternProjectIdFromLocation();
}

/** Clear the local draft and saved-project link. The cloud project stays. */
export function startFreshTriangleScarfPattern(
  storage: Pick<Storage, "removeItem"> = typeof localStorage !== "undefined"
    ? localStorage
    : { removeItem: () => undefined },
): void {
  clearTriangleScarfSavedProjectIdentity();
  clearTriangleScarfDraft(storage as Storage);
}

function patternRecord(raw: unknown): Record<string, unknown> | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  return raw as Record<string, unknown>;
}

function coerceTriangleScarfDraftFromSavedPattern(pattern: unknown): TriangleScarfDraft | null {
  const direct = normalizeTriangleScarfDraft(pattern);
  if (direct) return direct;
  const nested = patternRecord(pattern)?.triangleScarfDraft;
  return nested ? normalizeTriangleScarfDraft(nested) : null;
}

/**
 * Restore a saved scarf into `kbm_triangle_scarf_draft`.
 * The stored project name is the source of truth after reopen.
 */
export function hydrateTriangleScarfSavedProject(project: CustomPatternProject): TriangleScarfDraft {
  const base = coerceTriangleScarfDraftFromSavedPattern(project.pattern) ?? createTriangleScarfDraft();
  const name = project.name.trim();
  const notes =
    typeof project.notes === "string" ? project.notes : base.patternProject?.notes ?? "";
  const draft: TriangleScarfDraft = {
    ...base,
    patternType: "triangle-scarf",
    patternSystem: "triangle-scarf",
    patternProject: {
      title: name || base.patternProject?.title?.trim() || "",
      notes,
      ...(name ? { titleCustomized: true } : {}),
    },
  };
  writeTriangleScarfDraft(draft);
  writeTriangleScarfActiveProjectId(project.id, project.name);
  return draft;
}

export function resolveTriangleScarfSavedPatternName(
  draft: TriangleScarfDraft | null | undefined = typeof localStorage !== "undefined"
    ? readTriangleScarfDraft()
    : null,
): string {
  const fromDraft = draft?.patternProject?.title?.trim() ?? "";
  if (fromDraft) return fromDraft;
  return readTriangleScarfActiveProjectLinkedName().trim();
}

function truncateProjectNotes(notes: string): string {
  return notes.length <= PROJECT_NOTES_MAX_LENGTH
    ? notes
    : notes.slice(0, PROJECT_NOTES_MAX_LENGTH);
}

export function resolveTriangleScarfPatternProjectNotes(
  draft: TriangleScarfDraft | null | undefined,
): string {
  return typeof draft?.patternProject?.notes === "string" ? draft.patternProject.notes : "";
}

export function applyTriangleScarfPatternProjectDetailsToDraft(
  draft: TriangleScarfDraft,
  details: { title?: string; notes?: string },
): TriangleScarfDraft {
  if (details.title !== undefined && !details.title.trim() && details.notes === undefined) {
    return draft;
  }
  const title =
    details.title !== undefined ? details.title.trim() : (draft.patternProject?.title ?? "");
  const notes = truncateProjectNotes(
    details.notes !== undefined ? details.notes : resolveTriangleScarfPatternProjectNotes(draft),
  );
  const titleCustomized =
    (details.title !== undefined && Boolean(title)) ||
    draft.patternProject?.titleCustomized === true;
  return {
    ...draft,
    patternProject: {
      title,
      notes,
      ...(titleCustomized ? { titleCustomized: true } : {}),
    },
  };
}

export function applyTriangleScarfPatternNameToDraft(
  draft: TriangleScarfDraft,
  name: string,
): TriangleScarfDraft {
  return applyTriangleScarfPatternProjectDetailsToDraft(draft, { title: name });
}
