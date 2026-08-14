/**
 * Saved Hat Pattern identity — reuses Custom Pattern project name + `patternProject`
 * (same fields as sweater rename/save). Does not invent a separate hat naming system.
 */
import {
  readActiveCustomPatternProjectLinkedName,
  writeActiveCustomPatternProjectId,
} from "../customPatternProjectActiveId";
import type { CustomPatternProject } from "../customPatternProjectTypes";
import { isHatCustomPatternProject } from "../patternSystemId";
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

export function buildDefaultHatPatternTitle(): string {
  return HAT_PATTERN_FAMILY_NAME;
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
 * Restore a saved hat into `kbm_hat_draft` (does not write sweater `kbm_current_pattern`).
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
  writeActiveCustomPatternProjectId(project.id, project.name);
  return draft;
}

/** User-facing saved hat name from draft + linked project, or "" when unsaved/unnamed. */
export function resolveHatSavedPatternName(
  draft: HatDraft | null | undefined = typeof localStorage !== "undefined" ? readHatDraft() : null,
): string {
  const fromDraft = draft?.patternProject?.title?.trim() ?? "";
  if (fromDraft) return fromDraft;
  return readActiveCustomPatternProjectLinkedName().trim();
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
