/**
 * Pure helpers for the collapsible Notes field in the pattern Edit workspace side panel.
 *
 * Notes defaults collapsed so it does not consume vertical space and the Quick edits section
 * sits higher on the panel. It opens automatically when the project already has saved note text,
 * or when the workspace was deep-linked straight to notes editing.
 */

/** Character budget for the single-line preview shown next to the collapsed Notes header. */
export const NOTES_COLLAPSED_PREVIEW_MAX_LENGTH = 90;

/** Hash id used to deep-link the Edit workspace into notes editing (see sleevelessCustomizeProjectFieldNav). */
export const NOTES_EDIT_HASH_ID = "edit-notes";

/**
 * Whether the Notes field should default open.
 *
 * - `deepLinkToNotes` true (e.g. arrived via `#edit-notes`) ? open.
 * - Otherwise open only when there is existing (non-whitespace) saved note text.
 */
export function resolveNotesDefaultExpanded(
  noteText: string | null | undefined,
  options: { deepLinkToNotes?: boolean } = {},
): boolean {
  if (options.deepLinkToNotes) return true;
  return Boolean((noteText ?? "").trim());
}

/**
 * Short, single-line preview of the saved note for the collapsed header. Collapses internal
 * whitespace/newlines and clamps to `maxLength` with an ellipsis. Empty string when there is no note.
 */
export function buildNotesCollapsedPreview(
  noteText: string | null | undefined,
  maxLength: number = NOTES_COLLAPSED_PREVIEW_MAX_LENGTH,
): string {
  const normalized = (noteText ?? "").replace(/\s+/g, " ").trim();
  if (!normalized) return "";
  if (maxLength <= 0) return "";
  if (normalized.length <= maxLength) return normalized;
  const clamp = Math.max(0, maxLength - 1);
  return `${normalized.slice(0, clamp).trimEnd()}…`;
}

/** True when the location hash targets notes editing (`#edit-notes`). */
export function hashRequestsNotesEditing(hash: string | null | undefined): boolean {
  return (hash ?? "").replace(/^#/, "").trim() === NOTES_EDIT_HASH_ID;
}
