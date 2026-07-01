import type { CustomPatternProjectSource } from "./customPatternProjectTypes";
import type { CustomPatternProject } from "./customPatternProjectTypes";
import { hasAuthoritativeDropShoulderConstruction } from "./patternConstructionIdentity";

/** Pattern Builder marketing home (main nav “Patterns”, explore entry points). */
export const PATTERN_BUILDERS_HOME_HREF = "/patterns/about";

/** Pattern catalog — choose a builder to start. */
export const PATTERN_CATALOG_HREF = "/patterns";

export const OPEN_PATTERN_HREF = "/patterns/sleeveless/pattern/";
export const DROP_SHOULDER_OPEN_PATTERN_HREF = "/patterns/drop-shoulder/pattern/";

/**
 * Query flag appended to {@link OPEN_PATTERN_HREF} when the knitter chose Edit (not View).
 * The pattern page reads this on load and auto-opens the in-place Edit Pattern Workspace
 * (quick edits + measurement editor). See `sleevelessPatternEditDrawerPrototype.ts`.
 */
export const PATTERN_WORKSPACE_EDIT_QUERY = "edit=1";

/** Pattern page opened with the Edit Pattern Workspace auto-opened. */
export const OPEN_PATTERN_EDIT_WORKSPACE_HREF = `${OPEN_PATTERN_HREF}?${PATTERN_WORKSPACE_EDIT_QUERY}`;

/** Drop-shoulder saved pattern page with Edit Pattern Workspace auto-opened. */
export const DROP_SHOULDER_OPEN_PATTERN_EDIT_WORKSPACE_HREF =
  `${DROP_SHOULDER_OPEN_PATTERN_HREF}?${PATTERN_WORKSPACE_EDIT_QUERY}`;

export const EXPRESS_CONTINUE_EDITING_HREF = "/patterns/sleeveless/review/";

/** Drop-shoulder unified review page — resume editing where the knitter left off. */
export const DROP_SHOULDER_CONTINUE_EDITING_HREF = "/patterns/drop-shoulder/review/";

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
export function getContinueEditingHref(
  source: CustomPatternProjectSource,
  project?: Pick<CustomPatternProject, "pattern" | "customOverrides">,
): string {
  if (project && isDropShoulderCustomPatternProject(project)) {
    return source === "express" ? DROP_SHOULDER_CONTINUE_EDITING_HREF : CUSTOM_BUILD_FIRST_EDIT_HREF;
  }
  return source === "express" ? EXPRESS_CONTINUE_EDITING_HREF : CUSTOM_BUILD_FIRST_EDIT_HREF;
}

export function isDropShoulderCustomPatternProject(
  project: Pick<CustomPatternProject, "pattern" | "customOverrides">,
): boolean {
  const style =
    project.pattern?.style && typeof project.pattern.style === "object" && !Array.isArray(project.pattern.style)
      ? (project.pattern.style as Record<string, unknown>)
      : undefined;
  return hasAuthoritativeDropShoulderConstruction(style, project.customOverrides);
}

/** Read-only pattern instructions page for a saved project (view action). */
export function getOpenPatternHrefForProject(
  project: Pick<CustomPatternProject, "pattern" | "customOverrides">,
): string {
  return isDropShoulderCustomPatternProject(project)
    ? DROP_SHOULDER_OPEN_PATTERN_HREF
    : OPEN_PATTERN_HREF;
}

/**
 * Landing page when opening a saved project for editing from My Patterns / library.
 *
 * - Express: the saved pattern page with the in-place Edit Pattern Workspace auto-opened
 *   ({@link OPEN_PATTERN_EDIT_WORKSPACE_HREF}) — the split "quick edits + measurement editor"
 *   workspace with an Update Pattern button. The step-by-step Express wizard
 *   ({@link EXPRESS_EDIT_WORKSPACE_HREF}) is still reachable from inside that workspace when the
 *   knitter wants to revise choices one at a time.
 * - Custom Build: the editable Foundation workspace with every step unlocked and prefilled
 *   (via `?edit=choices`).
 *
 * In all cases the saved project is hydrated first, so it is never the read-only pattern output
 * or a blank build/start flow. (Plain View — without auto-open — uses {@link OPEN_PATTERN_HREF}.)
 */
export function getSavedCustomPatternOpenHref(
  source: CustomPatternProjectSource,
  project?: Pick<CustomPatternProject, "pattern" | "customOverrides">,
): string {
  if (project && isDropShoulderCustomPatternProject(project)) {
    return source === "custom-build"
      ? CUSTOM_BUILD_EDIT_WORKSPACE_HREF
      : DROP_SHOULDER_OPEN_PATTERN_EDIT_WORKSPACE_HREF;
  }
  return source === "custom-build" ? CUSTOM_BUILD_EDIT_WORKSPACE_HREF : OPEN_PATTERN_EDIT_WORKSPACE_HREF;
}
