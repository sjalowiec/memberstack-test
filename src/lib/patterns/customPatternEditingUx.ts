/**
 * Saved-project editing labels for Custom Build panels and Express “Editing:” row.
 * Uses blob project id + linked name keys — never title alone as the identifier.
 */
import {
  readActiveCustomPatternProjectId,
  readActiveCustomPatternProjectLinkedName,
  writeActiveCustomPatternProjectId,
} from "./customPatternProjectActiveId";
import { getPatternProjectMeta } from "./sleevelessPatternProjectMeta";

/** Generic label when the knitter has not set a custom project name. */
export const EXPRESS_EDITING_FALLBACK_LABEL = "Sleeveless Sweater";

export const EDITING_SAVED_PATTERN_PREFIX = "Editing saved pattern:";

/** User-facing name for the active saved project, or "" when none / generic draft only. */
export function resolveCustomPatternDisplayName(): string {
  const meta = getPatternProjectMeta();
  const title = meta.title.trim();
  const activeId = readActiveCustomPatternProjectId();

  if (activeId && title) return title;

  const linked = readActiveCustomPatternProjectLinkedName().trim();
  if (linked) return linked;

  if (title && meta.titleCustomized) return title;
  return "";
}

/**
 * Name to show in the persistent Custom Build “editing saved pattern” banner.
 * Only used when an active saved-project id is present.
 *
 * Priority:
 * 1) Current edited title/name (draft meta.title) when available
 * 2) Linked name from `kbm_custom_pattern_active_project_name`
 * 3) Draft meta.title (even if auto-generated) when present
 * 4) Family fallback (“Sleeveless Sweater”) as a last resort
 */
export function resolveEditingSavedPatternBannerName(): string {
  if (!readActiveCustomPatternProjectId()) return "";
  const meta = getPatternProjectMeta();
  const title = meta.title.trim();
  if (title) return title;
  const linked = readActiveCustomPatternProjectLinkedName().trim();
  if (linked) return linked;
  return EXPRESS_EDITING_FALLBACK_LABEL;
}

export function getGenericUnsavedPatternLabel(): string {
  return EXPRESS_EDITING_FALLBACK_LABEL;
}

export function formatEditingSavedPatternStatus(name: string): string {
  const trimmed = name.trim();
  return trimmed ? `${EDITING_SAVED_PATTERN_PREFIX} ${trimmed}` : "";
}

export function isEditingSavedCustomPatternProject(): boolean {
  return Boolean(readActiveCustomPatternProjectId());
}

/**
 * Backfill linked name from the working draft when an older session only stored the project id.
 */
export function reconcileActiveSavedProjectLinkedNameFromDraft(): void {
  const id = readActiveCustomPatternProjectId();
  if (!id || readActiveCustomPatternProjectLinkedName()) return;
  const title = getPatternProjectMeta().title.trim();
  if (title) writeActiveCustomPatternProjectId(id, title);
}

/** Label for compact Express editing row — custom saved name, not auto-generated draft title. */
export function getExpressEditingProjectLabel(): string {
  const named = resolveCustomPatternDisplayName();
  return named || EXPRESS_EDITING_FALLBACK_LABEL;
}
