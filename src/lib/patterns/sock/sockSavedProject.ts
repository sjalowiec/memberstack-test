/**
 * Saved Socks Pattern identity — reuses Custom Pattern project name + `patternProject`
 * (same fields as sweater / Hat rename/save). Does not invent a separate Socks naming system.
 *
 * Socks must not share the sweater active-project pointer
 * (`kbm_custom_pattern_active_project_id` / `_name`). Opening a sweater must not
 * make Socks adopt that sweater's id or title.
 */
import {
  clearActiveCustomPatternProjectId,
  readActiveCustomPatternProjectId,
} from "../customPatternProjectActiveId";
import type { CustomPatternProject } from "../customPatternProjectTypes";
import { isSockCustomPatternProject } from "../patternSystemId";
import { stripSavedPatternProjectIdFromLocation } from "../savedPatternViewUrl";
import { PROJECT_NOTES_MAX_LENGTH } from "../sleevelessPatternProjectMeta";
import {
  coerceSockDraft,
  createEmptySockDraft,
  readSockDraft,
  SOCK_PATTERN_FAMILY_NAME,
  writeSockDraft,
  type SockDraft,
} from "./sockDraft";

export { isSockCustomPatternProject, SOCK_PATTERN_FAMILY_NAME };

/** Socks-only active saved-project pointer — never the sweater `kbm_custom_pattern_active_project_*` keys. */
export const SOCK_ACTIVE_PROJECT_ID_KEY = "kbm_socks_active_project_id";
export const SOCK_ACTIVE_PROJECT_NAME_KEY = "kbm_socks_active_project_name";

export function buildDefaultSockPatternTitle(): string {
  return SOCK_PATTERN_FAMILY_NAME;
}

export function readSockActiveProjectId(): string {
  if (typeof localStorage === "undefined") return "";
  try {
    return localStorage.getItem(SOCK_ACTIVE_PROJECT_ID_KEY)?.trim() ?? "";
  } catch {
    return "";
  }
}

export function readSockActiveProjectLinkedName(): string {
  if (typeof localStorage === "undefined") return "";
  try {
    return localStorage.getItem(SOCK_ACTIVE_PROJECT_NAME_KEY)?.trim() ?? "";
  } catch {
    return "";
  }
}

export function writeSockActiveProjectId(id: string, linkedName?: string): void {
  if (typeof localStorage === "undefined") return;
  try {
    if (id) {
      localStorage.setItem(SOCK_ACTIVE_PROJECT_ID_KEY, id);
      if (linkedName !== undefined) {
        const trimmed = linkedName.trim();
        if (trimmed) localStorage.setItem(SOCK_ACTIVE_PROJECT_NAME_KEY, trimmed);
        else localStorage.removeItem(SOCK_ACTIVE_PROJECT_NAME_KEY);
      }
    } else {
      localStorage.removeItem(SOCK_ACTIVE_PROJECT_ID_KEY);
      localStorage.removeItem(SOCK_ACTIVE_PROJECT_NAME_KEY);
    }
  } catch {
    /* ignore */
  }
}

export function clearSockActiveProjectId(): void {
  writeSockActiveProjectId("");
}

/** True when this browser session is editing a saved Socks pattern (not a leftover sweater project). */
export function isEditingSavedSockProject(): boolean {
  return Boolean(readSockActiveProjectId());
}

/**
 * Drop Socks saved-project linkage so Start Over / New Pattern is a fresh Socks draft.
 * If the shared sweater pointer still names this same socks project (legacy hydrate), clear that too.
 * Does not delete the saved Blob project, and does not touch an unrelated sweater session.
 */
export function clearSockSavedProjectIdentity(): void {
  const sockId = readSockActiveProjectId();
  const sharedId = readActiveCustomPatternProjectId();
  clearSockActiveProjectId();
  if (sockId && sharedId && sharedId === sockId) {
    clearActiveCustomPatternProjectId();
  }
  stripSavedPatternProjectIdFromLocation();
}

function patternRecord(raw: unknown): Record<string, unknown> | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  return raw as Record<string, unknown>;
}

function coerceSockDraftFromSavedPattern(pattern: unknown): SockDraft | null {
  const direct = coerceSockDraft(pattern);
  if (direct) return direct;
  const nested = patternRecord(pattern)?.sockDraft;
  return nested ? coerceSockDraft(nested) : null;
}

/**
 * Restore a saved socks project into `kbm_socks_draft` (does not write sweater `kbm_current_pattern`
 * or the sweater active-project pointer).
 * The stored project name is the source of truth for display/print after reopen.
 */
export function hydrateSockSavedProject(project: CustomPatternProject): SockDraft {
  const base = coerceSockDraftFromSavedPattern(project.pattern) ?? createEmptySockDraft();
  const name = project.name.trim();
  const notes =
    typeof project.notes === "string"
      ? project.notes
      : base.patternProject?.notes ?? "";
  const draft: SockDraft = {
    ...base,
    patternType: "socks",
    patternSystem: "socks",
    patternProject: {
      title: name || base.patternProject?.title?.trim() || buildDefaultSockPatternTitle(),
      notes,
      ...(name ? { titleCustomized: true } : {}),
    },
  };
  writeSockDraft(draft);
  writeSockActiveProjectId(project.id, project.name);
  return draft;
}

/**
 * User-facing Socks pattern name from the socks draft + socks-only linked project,
 * falling back to the shared family default.
 */
export function resolveSockPatternDisplayName(
  draft: SockDraft | null | undefined = typeof localStorage !== "undefined" ? readSockDraft() : null,
): string {
  const fromDraft = draft?.patternProject?.title?.trim() ?? "";
  if (fromDraft) return fromDraft;
  const linked = readSockActiveProjectLinkedName().trim();
  if (linked) return linked;
  return buildDefaultSockPatternTitle();
}

/** @alias {@link resolveSockPatternDisplayName} — saved/custom name, or "". */
export function resolveSockSavedPatternName(
  draft: SockDraft | null | undefined = typeof localStorage !== "undefined" ? readSockDraft() : null,
): string {
  const fromDraft = draft?.patternProject?.title?.trim() ?? "";
  if (fromDraft) return fromDraft;
  return readSockActiveProjectLinkedName().trim();
}

function truncateSockProjectNotes(notes: string): string {
  return notes.length <= PROJECT_NOTES_MAX_LENGTH
    ? notes
    : notes.slice(0, PROJECT_NOTES_MAX_LENGTH);
}

/** Notes from a socks draft, or "" when missing. */
export function resolveSockPatternProjectNotes(
  draft: SockDraft | null | undefined,
): string {
  return typeof draft?.patternProject?.notes === "string" ? draft.patternProject.notes : "";
}

/**
 * Apply Pattern title and/or Notes onto a socks draft using the shared
 * `patternProject` shape (same fields as sweater / Hat saved projects).
 */
export function applySockPatternProjectDetailsToDraft(
  draft: SockDraft,
  details: { title?: string; notes?: string },
): SockDraft {
  if (details.title !== undefined && !details.title.trim() && details.notes === undefined) {
    return draft;
  }
  const title =
    details.title !== undefined
      ? details.title.trim()
      : (draft.patternProject?.title ?? buildDefaultSockPatternTitle());
  const notes = truncateSockProjectNotes(
    details.notes !== undefined ? details.notes : resolveSockPatternProjectNotes(draft),
  );
  const titleCustomized =
    (details.title !== undefined && Boolean(title)) ||
    draft.patternProject?.titleCustomized === true;
  return {
    ...draft,
    patternProject: {
      title: title || buildDefaultSockPatternTitle(),
      notes,
      ...(titleCustomized ? { titleCustomized: true } : {}),
    },
  };
}

export function applySockPatternNameToDraft(draft: SockDraft, name: string): SockDraft {
  return applySockPatternProjectDetailsToDraft(draft, { title: name });
}
