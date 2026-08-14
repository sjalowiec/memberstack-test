/**
 * Print/PDF heading for the finished Hat Pattern page.
 *
 * Hats use `kbm_hat_draft`, not the sleeveless/sweater working draft
 * (`kbm_current_pattern.patternProject`). The shared print personalization
 * component must not inherit sweater titles such as "Women's Sleeveless".
 *
 * Saved hats reuse the Custom Pattern project name (`patternProject.title` /
 * linked saved-project name). Unsaved temporary hats print "Hat Pattern".
 */

import { readHatDraft, type HatDraft } from "./hatDraft";
import { isEditingSavedHatProject, resolveHatSavedPatternName } from "./hatSavedProject";

export const HAT_PATTERN_PRINT_TITLE = "Hat Pattern";

export type HatPatternPrintFields = {
  title: string;
  notes: string;
};

export type ResolveHatPatternPrintFieldsInput = {
  draft?: HatDraft | null;
  isSaved?: boolean;
};

function isSavedHatSession(draft: HatDraft | null | undefined, isSaved?: boolean): boolean {
  if (typeof isSaved === "boolean") return isSaved;
  const customized = draft?.patternProject?.titleCustomized === true;
  if (customized && draft?.patternProject?.title?.trim()) return true;
  return isEditingSavedHatProject() && Boolean(resolveHatSavedPatternName(draft));
}

/**
 * Canonical print/PDF fields for a generated hat pattern.
 *
 * - Saved hat with a stored name → that name
 * - Unsaved temporary hat → {@link HAT_PATTERN_PRINT_TITLE}
 */
export function resolveHatPatternPrintFields(
  input: ResolveHatPatternPrintFieldsInput = {},
): HatPatternPrintFields {
  const draft = input.draft !== undefined ? input.draft : readHatDraft();
  const savedName = resolveHatSavedPatternName(draft);
  if (isSavedHatSession(draft, input.isSaved) && savedName) {
    return {
      title: savedName,
      notes: draft?.patternProject?.notes?.trim() ?? "",
    };
  }
  return { title: HAT_PATTERN_PRINT_TITLE, notes: "" };
}

/** Online (on-screen) heading: saved name when present, otherwise "Hat Pattern · {size}". */
export function resolveHatPatternOnlineHeading(
  sizeLabel: string,
  draft: HatDraft | null | undefined = typeof localStorage !== "undefined" ? readHatDraft() : null,
): string {
  if (isSavedHatSession(draft)) {
    const name = resolveHatSavedPatternName(draft);
    if (name) return name;
  }
  const size = sizeLabel.trim();
  return size ? `${HAT_PATTERN_PRINT_TITLE} · ${size}` : HAT_PATTERN_PRINT_TITLE;
}
