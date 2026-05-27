import type { CustomPatternProjectSource } from "./customPatternProjectTypes";

export const OPEN_PATTERN_HREF = "/patterns/sleeveless/pattern/";

export const EXPRESS_CONTINUE_EDITING_HREF = "/patterns/sleeveless/review/";

/** Custom Build Foundation — first Edit tab when opening a saved custom-build project. */
export const CUSTOM_BUILD_FIRST_EDIT_HREF = "/patterns/sleeveless/custom-build/design";

/** @deprecated Use {@link CUSTOM_BUILD_FIRST_EDIT_HREF} — same destination. */
export const CUSTOM_BUILD_CONTINUE_EDITING_HREF = CUSTOM_BUILD_FIRST_EDIT_HREF;

/** Where to send the knitter after loading a saved project to continue editing. */
export function getContinueEditingHref(source: CustomPatternProjectSource): string {
  return source === "express" ? EXPRESS_CONTINUE_EDITING_HREF : CUSTOM_BUILD_FIRST_EDIT_HREF;
}

/** Landing page when opening a saved project from My Patterns / library (edit, not pattern output). */
export function getSavedCustomPatternOpenHref(source: CustomPatternProjectSource): string {
  return source === "custom-build" ? CUSTOM_BUILD_FIRST_EDIT_HREF : OPEN_PATTERN_HREF;
}
