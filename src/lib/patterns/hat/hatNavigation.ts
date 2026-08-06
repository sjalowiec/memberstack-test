/**
 * Hat pattern family navigation — mirrors sleeveless/drop-shoulder route conventions.
 *
 * Live flow: Builder → Pattern workspace (`?generated=1`).
 * `/patterns/hat/review` is a legacy redirect only (same as sweater review routes).
 */

import { PATTERN_WORKSPACE_BUILDER_HANDOFF_QUERY } from "../patternWorkspaceBuilderGenerationHandoff";
import { PATTERN_WORKSPACE_EDIT_QUERY, PATTERN_WORKSPACE_GENERATED_QUERY } from "../customPatternProjectNavigation";

export const HAT_BUILDER_HREF = "/patterns/hat/builder/";
export const HAT_PATTERN_HREF = "/patterns/hat/pattern/";
export const HAT_REVIEW_LEGACY_PATH = "/patterns/hat/review";
export const HAT_PUBLIC_ENTRY_HREF = "/patterns/hat";

/** Query: builder handoff after “Review My Pattern”. */
export const HAT_PATTERN_WORKSPACE_GENERATED_HREF = `${HAT_PATTERN_HREF}?${PATTERN_WORKSPACE_GENERATED_QUERY}`;

/** Optional: open Edit Pattern workspace on arrival (free for all hat visitors). */
export const HAT_PATTERN_WORKSPACE_EDIT_HREF = `${HAT_PATTERN_HREF}?${PATTERN_WORKSPACE_EDIT_QUERY}`;

/** Builder opened to revise choices from the pattern Edit workspace. */
export const HAT_EDIT_CHOICES_QUERY = "edit=choices";
export const HAT_EDIT_CHOICES_HREF = `${HAT_BUILDER_HREF}?${HAT_EDIT_CHOICES_QUERY}`;

/** Fresh session (Start over / New Pattern). */
export const HAT_NEW_SESSION_PARAM = "new";
export const HAT_NEW_PATTERN_HREF = `${HAT_BUILDER_HREF}?${HAT_NEW_SESSION_PARAM}=1`;

/** Pattern page → builder when draft missing/corrupt. */
export const HAT_DRAFT_MISSING_QUERY = "draft";
export const HAT_DRAFT_MISSING_VALUE = "missing";

export function buildHatBuilderMissingDraftHref(): string {
  return `${HAT_BUILDER_HREF}?${HAT_DRAFT_MISSING_QUERY}=${HAT_DRAFT_MISSING_VALUE}`;
}

export function buildHatPatternGeneratedHref(openEdit = false): string {
  if (!openEdit) return HAT_PATTERN_WORKSPACE_GENERATED_HREF;
  const url = new URL(HAT_PATTERN_WORKSPACE_GENERATED_HREF, "http://local");
  url.searchParams.set("edit", "1");
  return `${url.pathname}${url.search}`;
}

export {
  PATTERN_WORKSPACE_BUILDER_HANDOFF_QUERY,
  PATTERN_WORKSPACE_GENERATED_QUERY,
  PATTERN_WORKSPACE_EDIT_QUERY,
};
