/**
 * Print/PDF heading for the finished Socks Pattern page.
 *
 * Socks use `kbm_socks_draft` / the socks-only saved-project pointer, not the
 * sleeveless/sweater working draft (`kbm_current_pattern.patternProject`).
 * The shared print personalization component must not inherit sweater titles
 * such as "Women's Drop Shoulder 3".
 *
 * Saved socks reuse the Custom Pattern project name (`patternProject.title` /
 * linked saved-project name). Unsaved drafts print the family default ("Socks").
 */

import { readSockDraft, type SockDraft } from "./sockDraft";
import {
  resolveSockPatternDisplayName,
  resolveSockPatternProjectNotes,
} from "./sockSavedProject";

export type SockPatternPrintFields = {
  title: string;
  notes: string;
};

export type ResolveSockPatternPrintFieldsInput = {
  draft?: SockDraft | null;
};

/**
 * Canonical print/PDF fields for a generated Socks pattern.
 *
 * Source of truth: {@link resolveSockPatternDisplayName} (draft title, then
 * socks-only linked saved name, then family default). Never reads sweater storage.
 */
export function resolveSockPatternPrintFields(
  input: ResolveSockPatternPrintFieldsInput = {},
): SockPatternPrintFields {
  const draft =
    input.draft !== undefined
      ? input.draft
      : typeof localStorage !== "undefined"
        ? readSockDraft()
        : null;
  return {
    title: resolveSockPatternDisplayName(draft),
    notes: resolveSockPatternProjectNotes(draft).trim(),
  };
}
