/**
 * Hat finished-pattern and Summary/Edit navigation (sweater-equivalent entry paths).
 *
 * Sweater tracks builder arrival with `?generated=1` and edit auto-open with `?edit=1`
 * on the pattern workspace. Hat uses a dedicated Summary/Edit page with the same
 * `generated=1` flag to distinguish:
 * - Initial build: builder → Summary/Edit (`?generated=1`) → finished pattern
 * - Edit existing: finished pattern → Summary/Edit → finished pattern
 */

import {
  PATTERN_WORKSPACE_EDIT_QUERY,
  PATTERN_WORKSPACE_GENERATED_QUERY,
} from "../customPatternProjectNavigation";

export const HAT_PATTERN_HREF = "/patterns/hat/pattern/";
export const HAT_PATTERN_BUILDER_HREF = "/patterns/hat/builder";

/** Retired all-in-one wizard URL. Redirects to {@link HAT_PATTERN_BUILDER_HREF}. */
export const HAT_LEGACY_ENTRY_HREF = "/patterns/hat";

/**
 * Permanent-entry redirect for `/patterns/hat` bookmarks and old links.
 * Keeps the query string (same approach as `/patterns/sleeveless-express`).
 */
export function buildHatLegacyEntryRedirect(requestUrl: string): string {
  const url = new URL(requestUrl);
  url.pathname = HAT_PATTERN_BUILDER_HREF;
  return `${url.pathname}${url.search}`;
}

/** Dedicated hat Summary/Edit page (full-page workspace; not a drawer). */
export const HAT_SUMMARY_EDIT_HREF = "/patterns/hat/summary/";

/**
 * Summary/Edit opened immediately after the hat builder completes.
 * Reuses the sweater `generated=1` query flag for entry-path tracking.
 */
export const HAT_SUMMARY_EDIT_FROM_BUILDER_HREF =
  `${HAT_SUMMARY_EDIT_HREF}?${PATTERN_WORKSPACE_GENERATED_QUERY}`;

/**
 * Summary/Edit opened from Edit Pattern on the finished page.
 * Reuses the sweater `edit=1` query for an explicit edit entry (optional; plain
 * Summary/Edit href without `generated` is also treated as edit-existing).
 */
export const HAT_SUMMARY_EDIT_FROM_PATTERN_HREF =
  `${HAT_SUMMARY_EDIT_HREF}?${PATTERN_WORKSPACE_EDIT_QUERY}`;

export type HatSummaryEntryPath = "from-builder" | "from-finished-pattern";

/** Primary CTA after reviewing an initial build — opens the finished pattern (not My Patterns save). */
export const HAT_SUMMARY_PRIMARY_FROM_BUILDER_LABEL = "View My Pattern";

/** Primary CTA when a logged-in member first saves an unsaved Hat. */
export const HAT_SUMMARY_PRIMARY_SAVE_LABEL = "Save Pattern";

/** Primary CTA when editing an already-saved Hat (or applying local edits as a guest). */
export const HAT_SUMMARY_PRIMARY_FROM_EDIT_LABEL = "Update Pattern";

/** Cancel when reviewing an initial build — return to the builder; draft stays. */
export const HAT_SUMMARY_CANCEL_FROM_BUILDER_LABEL = "Back to Builder";

/** Cancel when editing an existing finished pattern. */
export const HAT_SUMMARY_CANCEL_FROM_EDIT_LABEL = "Cancel";

export const HAT_SUMMARY_HINT_FROM_BUILDER =
  "Review your choices, then click View My Pattern to open your finished pattern.";

export const HAT_SUMMARY_HINT_SAVE =
  "Review your choices, then click Save Pattern to save your hat to My Patterns.";

export const HAT_SUMMARY_HINT_FROM_EDIT =
  "Make your changes, then click Update Pattern to update your pattern.";

/** Builder footer CTA — lands on Summary/Edit (not the finished pattern). */
export const HAT_BUILDER_REVIEW_CTA_LABEL = "Review My Pattern";

export function buildHatSummaryEditHref(): string {
  return HAT_SUMMARY_EDIT_HREF;
}

export function buildHatSummaryEditFromBuilderHref(): string {
  return HAT_SUMMARY_EDIT_FROM_BUILDER_HREF;
}

export function buildHatSummaryEditFromPatternHref(): string {
  return HAT_SUMMARY_EDIT_FROM_PATTERN_HREF;
}

export function buildHatPatternHref(): string {
  return HAT_PATTERN_HREF;
}

export function buildHatBuilderHref(): string {
  return HAT_PATTERN_BUILDER_HREF;
}

/**
 * Resolve Summary/Edit entry path from the URL search string (sweater `generated=1` convention).
 * `generated=1` → arrived from the builder. Anything else (including `edit=1` or bare summary) → edit existing.
 */
export function resolveHatSummaryEntryPath(
  search: string = typeof window !== "undefined" ? window.location.search : "",
): HatSummaryEntryPath {
  const raw = search.startsWith("?") ? search.slice(1) : search;
  const params = new URLSearchParams(raw);
  if (params.get("generated") === "1") return "from-builder";
  return "from-finished-pattern";
}

export function hatSummaryPrimaryLabel(path: HatSummaryEntryPath): string {
  return path === "from-builder"
    ? HAT_SUMMARY_PRIMARY_FROM_BUILDER_LABEL
    : HAT_SUMMARY_PRIMARY_FROM_EDIT_LABEL;
}

export function hatSummaryCancelLabel(path: HatSummaryEntryPath): string {
  return path === "from-builder"
    ? HAT_SUMMARY_CANCEL_FROM_BUILDER_LABEL
    : HAT_SUMMARY_CANCEL_FROM_EDIT_LABEL;
}

export function hatSummaryHint(path: HatSummaryEntryPath): string {
  return path === "from-builder" ? HAT_SUMMARY_HINT_FROM_BUILDER : HAT_SUMMARY_HINT_FROM_EDIT;
}

/** Where Cancel / Back navigates for the given entry path. Draft is never written on cancel. */
export function hatSummaryCancelHref(path: HatSummaryEntryPath): string {
  return path === "from-builder" ? HAT_PATTERN_BUILDER_HREF : HAT_PATTERN_HREF;
}

/** Where the primary action navigates after a successful validate + write. */
export function hatSummaryPrimarySuccessHref(_path: HatSummaryEntryPath): string {
  return HAT_PATTERN_HREF;
}
