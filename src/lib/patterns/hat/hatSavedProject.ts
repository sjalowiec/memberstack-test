/**
 * Saved Hat Pattern identity — reuses Custom Pattern project name + `patternProject`
 * (same fields as sweater rename/save). Does not invent a separate hat naming system.
 *
 * Hats must not share the sweater active-project pointer
 * (`kbm_custom_pattern_active_project_id` / `_name`). Opening a sweater must not
 * make a Hat adopt that sweater's id or title.
 */
import {
  clearActiveCustomPatternProjectId,
  readActiveCustomPatternProjectId,
} from "../customPatternProjectActiveId";
import type { CustomPatternProject } from "../customPatternProjectTypes";
import { isHatCustomPatternProject } from "../patternSystemId";
import { stripSavedPatternProjectIdFromLocation } from "../savedPatternViewUrl";
import {
  coerceHatDraft,
  createEmptyHatDraft,
  readHatDraft,
  writeHatDraft,
  type HatDraft,
} from "./hatDraft";

export { isHatCustomPatternProject };

/** Family-only default saved name (same convention as "Sleeveless" / "Drop Shoulder" when audience is unknown). */
export const HAT_PATTERN_FAMILY_NAME = "Hat";

/** Hat-only active saved-project pointer — never the sweater `kbm_custom_pattern_active_project_*` keys. */
export const HAT_ACTIVE_PROJECT_ID_KEY = "kbm_hat_active_project_id";
export const HAT_ACTIVE_PROJECT_NAME_KEY = "kbm_hat_active_project_name";

export function buildDefaultHatPatternTitle(): string {
  return HAT_PATTERN_FAMILY_NAME;
}

export function readHatActiveProjectId(): string {
  if (typeof localStorage === "undefined") return "";
  try {
    return localStorage.getItem(HAT_ACTIVE_PROJECT_ID_KEY)?.trim() ?? "";
  } catch {
    return "";
  }
}

export function readHatActiveProjectLinkedName(): string {
  if (typeof localStorage === "undefined") return "";
  try {
    return localStorage.getItem(HAT_ACTIVE_PROJECT_NAME_KEY)?.trim() ?? "";
  } catch {
    return "";
  }
}

export function writeHatActiveProjectId(id: string, linkedName?: string): void {
  if (typeof localStorage === "undefined") return;
  try {
    if (id) {
      localStorage.setItem(HAT_ACTIVE_PROJECT_ID_KEY, id);
      if (linkedName !== undefined) {
        const trimmed = linkedName.trim();
        if (trimmed) localStorage.setItem(HAT_ACTIVE_PROJECT_NAME_KEY, trimmed);
        else localStorage.removeItem(HAT_ACTIVE_PROJECT_NAME_KEY);
      }
    } else {
      localStorage.removeItem(HAT_ACTIVE_PROJECT_ID_KEY);
      localStorage.removeItem(HAT_ACTIVE_PROJECT_NAME_KEY);
    }
  } catch {
    /* ignore */
  }
}

export function clearHatActiveProjectId(): void {
  writeHatActiveProjectId("");
}

/** True when this browser session is editing a saved Hat (not a leftover sweater project). */
export function isEditingSavedHatProject(): boolean {
  return Boolean(readHatActiveProjectId());
}

/**
 * Drop Hat saved-project linkage so Start Over / New Pattern is a fresh Hat.
 * If the shared sweater pointer still names this same hat (legacy hydrate), clear that too.
 * Does not delete the saved Blob project, and does not touch an unrelated sweater session.
 */
export function clearHatSavedProjectIdentity(): void {
  const hatId = readHatActiveProjectId();
  const sharedId = readActiveCustomPatternProjectId();
  clearHatActiveProjectId();
  if (hatId && sharedId && sharedId === hatId) {
    clearActiveCustomPatternProjectId();
  }
  stripSavedPatternProjectIdFromLocation();
}

function patternRecord(raw: unknown): Record<string, unknown> | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  return raw as Record<string, unknown>;
}

function coerceHatDraftFromSavedPattern(pattern: unknown): HatDraft | null {
  const direct = coerceHatDraft(pattern);
  if (direct) return direct;
  const nested = patternRecord(pattern)?.hatDraft;
  return nested ? coerceHatDraft(nested) : null;
}

/**
 * Restore a saved hat into `kbm_hat_draft` (does not write sweater `kbm_current_pattern`
 * or the sweater active-project pointer).
 * The stored project name is the source of truth for display/print after reopen.
 */
export function hydrateHatSavedProject(project: CustomPatternProject): HatDraft {
  const base = coerceHatDraftFromSavedPattern(project.pattern) ?? createEmptyHatDraft();
  const name = project.name.trim();
  const notes =
    typeof project.notes === "string"
      ? project.notes
      : base.patternProject?.notes ?? "";
  const draft: HatDraft = {
    ...base,
    patternType: "hat",
    patternSystem: "hat",
    patternProject: {
      title: name || base.patternProject?.title?.trim() || "",
      notes,
      ...(name ? { titleCustomized: true } : {}),
    },
  };
  writeHatDraft(draft);
  writeHatActiveProjectId(project.id, project.name);
  return draft;
}

/** User-facing saved hat name from the hat draft + hat-only linked project, or "" when unsaved. */
export function resolveHatSavedPatternName(
  draft: HatDraft | null | undefined = typeof localStorage !== "undefined" ? readHatDraft() : null,
): string {
  const fromDraft = draft?.patternProject?.title?.trim() ?? "";
  if (fromDraft) return fromDraft;
  return readHatActiveProjectLinkedName().trim();
}

export function applyHatPatternNameToDraft(draft: HatDraft, name: string): HatDraft {
  const trimmed = name.trim();
  if (!trimmed) return draft;
  return {
    ...draft,
    patternProject: {
      title: trimmed,
      notes: draft.patternProject?.notes ?? "",
      titleCustomized: true,
    },
  };
}
