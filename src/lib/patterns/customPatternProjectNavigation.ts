import type { CustomPatternProjectSource } from "./customPatternProjectTypes";

export const OPEN_PATTERN_HREF = "/patterns/sleeveless/pattern/";

export const EXPRESS_CONTINUE_EDITING_HREF = "/patterns/sleeveless/review/";

/** Custom Build Foundation — first Edit tab when opening a saved custom-build project. */
export const CUSTOM_BUILD_FIRST_EDIT_HREF = "/patterns/sleeveless/custom-build/design";

/** @deprecated Use {@link CUSTOM_BUILD_FIRST_EDIT_HREF} — same destination. */
export const CUSTOM_BUILD_CONTINUE_EDITING_HREF = CUSTOM_BUILD_FIRST_EDIT_HREF;

/**
 * Query flag (`?edit=choices`) handled by the builder pages — it unlocks every step and prefills
 * each one from the working draft. Keep in sync with `SLEEVELESS_EXPRESS_EDIT_CHOICES_*` in
 * `restoreSleevelessExpressBuilderFromPattern`.
 */
export const SAVED_CUSTOM_PATTERN_EDIT_CHOICES_QUERY = "edit=choices";

/** Express wizard opened for editing — all steps unlocked and prefilled (gauge included). */
export const EXPRESS_EDIT_WORKSPACE_HREF = `/patterns/sleeveless-express?${SAVED_CUSTOM_PATTERN_EDIT_CHOICES_QUERY}`;

/** Custom Build opened for editing — Foundation onward, all steps unlocked and prefilled. */
export const CUSTOM_BUILD_EDIT_WORKSPACE_HREF = `${CUSTOM_BUILD_FIRST_EDIT_HREF}?${SAVED_CUSTOM_PATTERN_EDIT_CHOICES_QUERY}`;

/** Where to send the knitter after loading a saved project to continue editing. */
export function getContinueEditingHref(source: CustomPatternProjectSource): string {
  return source === "express" ? EXPRESS_CONTINUE_EDITING_HREF : CUSTOM_BUILD_FIRST_EDIT_HREF;
}

/**
 * Landing page when opening a saved project from My Patterns / library.
 *
 * Opens the editable builder workspace with every step unlocked and prefilled from the saved
 * project (via `?edit=choices`) so the knitter can change a single value such as gauge and save
 * back to the same project — never the read-only pattern output or a blank build/start flow.
 */
export function getSavedCustomPatternOpenHref(source: CustomPatternProjectSource): string {
  return source === "custom-build" ? CUSTOM_BUILD_EDIT_WORKSPACE_HREF : EXPRESS_EDIT_WORKSPACE_HREF;
}
