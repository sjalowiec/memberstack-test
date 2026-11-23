/**
 * Saved slotted-mitten identity.
 * Uses the shared Custom Pattern project name and notes.
 * The mitten active-project pointer is separate from the sweater pointer.
 */
import {
  clearActiveCustomPatternProjectId,
  readActiveCustomPatternProjectId,
} from "../customPatternProjectActiveId";
import type { CustomPatternProject } from "../customPatternProjectTypes";
import { isMittenCustomPatternProject } from "../patternSystemId";
import { stripSavedPatternProjectIdFromLocation } from "../savedPatternViewUrl";
import {
  MITTEN_PATTERN_NAME,
  readMittenDraft,
  writeMittenDraft,
  type MittenDraft,
} from "./mittenDraft";

export { isMittenCustomPatternProject };

export const MITTEN_ACTIVE_PROJECT_ID_KEY = "kbm_mitten_active_project_id";
export const MITTEN_ACTIVE_PROJECT_NAME_KEY = "kbm_mitten_active_project_name";

export function buildDefaultMittenPatternTitle(): string {
  return MITTEN_PATTERN_NAME;
}

export function readMittenActiveProjectId(): string {
  if (typeof localStorage === "undefined") return "";
  try {
    return localStorage.getItem(MITTEN_ACTIVE_PROJECT_ID_KEY)?.trim() ?? "";
  } catch {
    return "";
  }
}

export function readMittenActiveProjectLinkedName(): string {
  if (typeof localStorage === "undefined") return "";
  try {
    return localStorage.getItem(MITTEN_ACTIVE_PROJECT_NAME_KEY)?.trim() ?? "";
  } catch {
    return "";
  }
}

export function writeMittenActiveProjectId(id: string, linkedName?: string): void {
  if (typeof localStorage === "undefined") return;
  try {
    if (id) {
      localStorage.setItem(MITTEN_ACTIVE_PROJECT_ID_KEY, id);
      if (linkedName !== undefined) {
        const trimmed = linkedName.trim();
        if (trimmed) localStorage.setItem(MITTEN_ACTIVE_PROJECT_NAME_KEY, trimmed);
        else localStorage.removeItem(MITTEN_ACTIVE_PROJECT_NAME_KEY);
      }
    } else {
      localStorage.removeItem(MITTEN_ACTIVE_PROJECT_ID_KEY);
      localStorage.removeItem(MITTEN_ACTIVE_PROJECT_NAME_KEY);
    }
  } catch {
    /* ignore */
  }
}

export function clearMittenActiveProjectId(): void {
  writeMittenActiveProjectId("");
}

export function clearMittenSavedProjectIdentity(): void {
  const mittenId = readMittenActiveProjectId();
  const sharedId = readActiveCustomPatternProjectId();
  clearMittenActiveProjectId();
  if (mittenId && sharedId && sharedId === mittenId) {
    clearActiveCustomPatternProjectId();
  }
  stripSavedPatternProjectIdFromLocation();
}

function patternRecord(raw: unknown): Record<string, unknown> | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  return raw as Record<string, unknown>;
}

function draftFromSavedPattern(pattern: unknown): MittenDraft | null {
  const record = patternRecord(pattern);
  if (!record) return null;
  if (record.version !== 1 || record.patternType !== "mittens") return null;
  return record as unknown as MittenDraft;
}

/** Restore a saved mitten into this browser. The stored name is the display name. */
export function hydrateMittenSavedProject(project: CustomPatternProject): MittenDraft | null {
  const base = draftFromSavedPattern(project.pattern);
  if (!base) return null;
  const name = project.name.trim() || base.patternProject?.title?.trim() || buildDefaultMittenPatternTitle();
  const notes = typeof project.notes === "string" ? project.notes : base.patternProject?.notes ?? "";
  const draft: MittenDraft = {
    ...base,
    patternType: "mittens",
    patternSystem: "mittens",
    patternProject: {
      title: name,
      notes,
      titleCustomized: true,
    },
  };
  writeMittenDraft(draft);
  writeMittenActiveProjectId(project.id, project.name);
  return draft;
}

export function resolveMittenPatternDisplayName(
  draft: MittenDraft | null | undefined = typeof localStorage !== "undefined" ? readMittenDraft() : null,
): string {
  const fromDraft = draft?.patternProject?.title?.trim() ?? "";
  if (fromDraft) return fromDraft;
  const linked = readMittenActiveProjectLinkedName().trim();
  if (linked) return linked;
  return buildDefaultMittenPatternTitle();
}

export function applyMittenPatternNameToDraft(draft: MittenDraft, name: string): MittenDraft {
  const title = name.trim() || buildDefaultMittenPatternTitle();
  return {
    ...draft,
    patternProject: {
      notes: draft.patternProject?.notes ?? "",
      title,
      titleCustomized: true,
    },
  };
}
