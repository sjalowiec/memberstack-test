/**
 * Triangle Scarf navigation (Hat-style Pattern System).
 * New pattern: Builder → Summary (`?generated=1`) → finished Pattern.
 * Existing pattern: Pattern → Summary/Edit (`?edit=1`) → Pattern.
 * `/patterns/triangle-scarf` stays the public entry and preserves share params.
 */

import {
  PATTERN_WORKSPACE_EDIT_QUERY,
  PATTERN_WORKSPACE_GENERATED_QUERY,
} from "../customPatternProjectNavigation";
import { withSavedPatternProjectId } from "../savedPatternViewUrl";
import {
  SLEEVELESS_EXPRESS_NEW_SESSION_PARAM,
  SLEEVELESS_EXPRESS_NEW_SESSION_VALUE,
} from "../patternStorage";
import {
  parseTriangleScarfSearchParams,
  stripLegacyTriangleScarfMethodParams,
  triangleScarfShareParams,
  type TriangleScarfInputs,
} from "../triangleScarfMath";

export const TRIANGLE_SCARF_PATTERN_NAME = "Weekend Triangle Scarf";

/** Retired all-in-one tab URL. Redirects to the builder, or the pattern when share params are complete. */
export const TRIANGLE_SCARF_LEGACY_ENTRY_HREF = "/patterns/triangle-scarf";

export const TRIANGLE_SCARF_BUILDER_HREF = "/patterns/triangle-scarf/builder";

/** Same `?new=1` fresh start as the Hat and sweater builders. */
export function buildTriangleScarfBuilderNewPatternHref(): string {
  return `${TRIANGLE_SCARF_BUILDER_HREF}?${SLEEVELESS_EXPRESS_NEW_SESSION_PARAM}=${SLEEVELESS_EXPRESS_NEW_SESSION_VALUE}`;
}

export function isTriangleScarfNewSession(search: string): boolean {
  const raw = search.startsWith("?") ? search.slice(1) : search;
  const params = new URLSearchParams(raw);
  return params.get(SLEEVELESS_EXPRESS_NEW_SESSION_PARAM) === SLEEVELESS_EXPRESS_NEW_SESSION_VALUE;
}

export const TRIANGLE_SCARF_PATTERN_HREF = "/patterns/triangle-scarf/pattern/";

export const TRIANGLE_SCARF_SUMMARY_HREF = "/patterns/triangle-scarf/summary/";

export const TRIANGLE_SCARF_SUMMARY_FROM_BUILDER_HREF =
  `${TRIANGLE_SCARF_SUMMARY_HREF}?${PATTERN_WORKSPACE_GENERATED_QUERY}`;

export const TRIANGLE_SCARF_SUMMARY_FROM_PATTERN_HREF =
  `${TRIANGLE_SCARF_SUMMARY_HREF}?${PATTERN_WORKSPACE_EDIT_QUERY}`;

export const TRIANGLE_SCARF_BUILDER_REVIEW_LABEL = "Review My Pattern";

export const TRIANGLE_SCARF_SUMMARY_PRIMARY_FROM_BUILDER_LABEL = "View My Pattern";

/** Primary CTA when a member first saves an unsaved scarf. */
export const TRIANGLE_SCARF_SUMMARY_PRIMARY_SAVE_LABEL = "Save Pattern";

export const TRIANGLE_SCARF_SUMMARY_PRIMARY_FROM_EDIT_LABEL = "Update Pattern";

export const TRIANGLE_SCARF_SUMMARY_CANCEL_FROM_BUILDER_LABEL = "Back to Builder";

export const TRIANGLE_SCARF_SUMMARY_CANCEL_FROM_EDIT_LABEL = "Cancel";

export const TRIANGLE_SCARF_SUMMARY_HINT_FROM_BUILDER =
  "Review your measurements, then click View My Pattern to open your finished pattern.";

export const TRIANGLE_SCARF_SUMMARY_HINT_SAVE =
  "Review your measurements, then click Save Pattern to save your scarf to My Patterns.";

export const TRIANGLE_SCARF_SUMMARY_HINT_FROM_EDIT =
  "Make your changes, then click Update Pattern to update your pattern.";

export type TriangleScarfSummaryEntryPath = "from-builder" | "from-finished-pattern";

/**
 * `/patterns/triangle-scarf` bookmarks and shared links.
 * A complete share query opens the finished pattern. Anything else opens the builder.
 * Legacy `method`, `construction`, and `na` params are dropped either way.
 */
export function buildTriangleScarfLegacyEntryRedirect(requestUrl: string): string {
  const url = new URL(requestUrl);
  const stripped = stripLegacyTriangleScarfMethodParams(url.searchParams);
  const parsed = parseTriangleScarfSearchParams(stripped);
  const pathname = parsed ? TRIANGLE_SCARF_PATTERN_HREF : TRIANGLE_SCARF_BUILDER_HREF;
  const search = stripped.toString();
  return search ? `${pathname}?${search}` : pathname;
}

export function buildTriangleScarfPatternHref(inputs?: TriangleScarfInputs | null): string {
  if (!inputs) return TRIANGLE_SCARF_PATTERN_HREF;
  return `${TRIANGLE_SCARF_PATTERN_HREF}?${triangleScarfShareParams(inputs).toString()}`;
}

/** Public share link. The entry URL redirects to the finished pattern. */
export function buildTriangleScarfShareHref(origin: string, inputs: TriangleScarfInputs): string {
  const base = origin.replace(/\/+$/, "");
  return `${base}${TRIANGLE_SCARF_LEGACY_ENTRY_HREF}?${triangleScarfShareParams(inputs).toString()}`;
}

export function resolveTriangleScarfSummaryEntryPath(
  search: string = typeof window !== "undefined" ? window.location.search : "",
): TriangleScarfSummaryEntryPath {
  const raw = search.startsWith("?") ? search.slice(1) : search;
  const params = new URLSearchParams(raw);
  if (params.get("generated") === "1") return "from-builder";
  return "from-finished-pattern";
}

export function triangleScarfSummaryPrimaryLabel(path: TriangleScarfSummaryEntryPath): string {
  return path === "from-builder"
    ? TRIANGLE_SCARF_SUMMARY_PRIMARY_FROM_BUILDER_LABEL
    : TRIANGLE_SCARF_SUMMARY_PRIMARY_FROM_EDIT_LABEL;
}

export function triangleScarfSummaryCancelLabel(path: TriangleScarfSummaryEntryPath): string {
  return path === "from-builder"
    ? TRIANGLE_SCARF_SUMMARY_CANCEL_FROM_BUILDER_LABEL
    : TRIANGLE_SCARF_SUMMARY_CANCEL_FROM_EDIT_LABEL;
}

export function triangleScarfSummaryHint(path: TriangleScarfSummaryEntryPath): string {
  return path === "from-builder"
    ? TRIANGLE_SCARF_SUMMARY_HINT_FROM_BUILDER
    : TRIANGLE_SCARF_SUMMARY_HINT_FROM_EDIT;
}

export function withTriangleScarfSavedProjectQuery(href: string, projectId?: string | null): string {
  const id = projectId?.trim() ?? "";
  return id ? withSavedPatternProjectId(href, id) : href;
}

export function buildTriangleScarfSummaryEditFromPatternHref(projectId?: string | null): string {
  return withTriangleScarfSavedProjectQuery(TRIANGLE_SCARF_SUMMARY_FROM_PATTERN_HREF, projectId);
}

/** Cancel never writes the draft. Back to Builder keeps the in-progress scarf. */
export function triangleScarfSummaryCancelHref(
  path: TriangleScarfSummaryEntryPath,
  projectId?: string | null,
): string {
  if (path === "from-builder") return TRIANGLE_SCARF_BUILDER_HREF;
  return withTriangleScarfSavedProjectQuery(TRIANGLE_SCARF_PATTERN_HREF, projectId);
}

export function triangleScarfSummaryPrimarySuccessHref(
  inputs?: TriangleScarfInputs | null,
  projectId?: string | null,
): string {
  return withTriangleScarfSavedProjectQuery(buildTriangleScarfPatternHref(inputs), projectId);
}
