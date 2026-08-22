import type { CustomPatternProjectSource } from "./customPatternProjectTypes";
import type { CustomPatternProject } from "./customPatternProjectTypes";
import { hasAuthoritativeDropShoulderConstruction } from "./patternConstructionIdentity";
import { isHatCustomPatternProject } from "./patternSystemId";
import { PATTERN_WORKSPACE_BUILDER_HANDOFF_QUERY } from "./patternWorkspaceBuilderGenerationHandoff";
import { withSavedPatternProjectId } from "./savedPatternViewUrl";

export { PATTERN_WORKSPACE_BUILDER_HANDOFF_QUERY };

/** Pattern Builder marketing home (main nav “Patterns”, explore entry points). */
export const PATTERN_BUILDERS_HOME_HREF = "/patterns/about";

/** Pattern catalog — choose a builder to start. */
export const PATTERN_CATALOG_HREF = "/patterns";

export const OPEN_PATTERN_HREF = "/patterns/sleeveless/pattern/";
export const DROP_SHOULDER_OPEN_PATTERN_HREF = "/patterns/drop-shoulder/pattern/";
export const HAT_OPEN_PATTERN_HREF = "/patterns/hat/pattern/";
export const HAT_SUMMARY_EDIT_HREF = "/patterns/hat/summary/";

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

/** Saved hat Summary/Edit workspace (hat uses a dedicated summary page, not an overlay drawer). */
export const HAT_OPEN_PATTERN_EDIT_WORKSPACE_HREF =
  `${HAT_SUMMARY_EDIT_HREF}?${PATTERN_WORKSPACE_EDIT_QUERY}`;

/** Query flag for first arrival on the workspace after builder completion (see handoff module). */
export const PATTERN_WORKSPACE_GENERATED_QUERY = `${PATTERN_WORKSPACE_BUILDER_HANDOFF_QUERY}=1`;

/** Pattern workspace opened immediately after builder completion. */
export const SLEEVELESS_PATTERN_WORKSPACE_GENERATED_HREF =
  `${OPEN_PATTERN_HREF}?${PATTERN_WORKSPACE_GENERATED_QUERY}`;

/** Drop-shoulder pattern workspace opened immediately after builder completion. */
export const DROP_SHOULDER_PATTERN_WORKSPACE_GENERATED_HREF =
  `${DROP_SHOULDER_OPEN_PATTERN_HREF}?${PATTERN_WORKSPACE_GENERATED_QUERY}`;

/** Resume editing an express saved project — pattern workspace with Edit drawer auto-opened. */
export const EXPRESS_CONTINUE_EDITING_HREF = OPEN_PATTERN_EDIT_WORKSPACE_HREF;

/** Drop-shoulder express saved project — same edit workspace entry point. */
export const DROP_SHOULDER_CONTINUE_EDITING_HREF = DROP_SHOULDER_OPEN_PATTERN_EDIT_WORKSPACE_HREF;

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
function hatEditHrefForProject(
  project: Pick<CustomPatternProject, "pattern" | "customOverrides"> & { id?: string },
): string {
  const id = project.id?.trim() ?? "";
  return id
    ? withSavedPatternProjectId(HAT_OPEN_PATTERN_EDIT_WORKSPACE_HREF, id)
    : HAT_OPEN_PATTERN_EDIT_WORKSPACE_HREF;
}

export function getContinueEditingHref(
  source: CustomPatternProjectSource,
  project?: Pick<CustomPatternProject, "pattern" | "customOverrides"> & { id?: string },
): string {
  // Drop Shoulder is an Express-only construction with no Custom Build route, so a Drop Shoulder
  // project always edits on the drop-shoulder workspace — never a /patterns/sleeveless/ builder
  // route, regardless of the stored source.
  if (project && isHatCustomPatternProject(project)) {
    return hatEditHrefForProject(project);
  }
  if (project && isDropShoulderCustomPatternProject(project)) {
    return DROP_SHOULDER_CONTINUE_EDITING_HREF;
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
  if (isHatCustomPatternProject(project)) return HAT_OPEN_PATTERN_HREF;
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
  project?: Pick<CustomPatternProject, "pattern" | "customOverrides"> & { id?: string },
): string {
  // Drop Shoulder is an Express-only construction with no Custom Build route, so every Drop Shoulder
  // project edits on the drop-shoulder pattern workspace — never a /patterns/sleeveless/ builder
  // route, regardless of the stored source.
  if (project && isHatCustomPatternProject(project)) {
    return hatEditHrefForProject(project);
  }
  if (project && isDropShoulderCustomPatternProject(project)) {
    return DROP_SHOULDER_OPEN_PATTERN_EDIT_WORKSPACE_HREF;
  }
  return source === "custom-build" ? CUSTOM_BUILD_EDIT_WORKSPACE_HREF : OPEN_PATTERN_EDIT_WORKSPACE_HREF;
}

/**
 * "Go Back and Adjust" destination for the too-wide-for-machine needle warning shown on a saved
 * pattern page. Returns the saved pattern's OWN Summary/Edit workspace for the correct construction
 * (Sleeveless, Drop Shoulder, or Custom Build) with the active project id preserved — reusing
 * {@link getSavedCustomPatternOpenHref} (and {@link withSavedPatternProjectId}) as the single
 * edit-routing source of truth so we never construct a builder URL locally.
 *
 * Returns `null` when there is no active saved project (a brand-new / unsaved pattern), so the caller
 * keeps the plain Express builder href and does not start / lose a project.
 */
export function getSavedPatternNeedleAdjustHref(
  activeProjectId: string | undefined | null,
  project: Pick<CustomPatternProject, "pattern" | "customOverrides">,
  source: CustomPatternProjectSource,
): string | null {
  const id = activeProjectId?.trim();
  if (!id) return null;
  return withSavedPatternProjectId(getSavedCustomPatternOpenHref(source, project), id);
}
