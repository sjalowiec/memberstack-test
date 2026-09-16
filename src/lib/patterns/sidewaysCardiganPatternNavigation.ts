/**
 * Sideways V-Neck Summary/Edit navigation (hat-equivalent dedicated page).
 *
 * Builder completion lands on Summary/Edit (`?generated=1`), not knitting instructions.
 * Edit Pattern / My Patterns Edit open the same page (`?edit=1`).
 */

import {
  PATTERN_WORKSPACE_EDIT_QUERY,
  PATTERN_WORKSPACE_GENERATED_QUERY,
  SIDEWAYS_CARDIGAN_OPEN_PATTERN_HREF,
} from "./customPatternProjectNavigation";
import { withSavedPatternProjectId } from "./savedPatternViewUrl";

export const SIDEWAYS_CARDIGAN_PATTERN_BUILDER_HREF = "/patterns/sideways-cardigan/builder";
export const SIDEWAYS_CARDIGAN_SUMMARY_EDIT_HREF = "/patterns/sideways-cardigan/summary/";

export const SIDEWAYS_CARDIGAN_SUMMARY_EDIT_FROM_BUILDER_HREF =
  `${SIDEWAYS_CARDIGAN_SUMMARY_EDIT_HREF}?${PATTERN_WORKSPACE_GENERATED_QUERY}`;

export const SIDEWAYS_CARDIGAN_SUMMARY_EDIT_FROM_PATTERN_HREF =
  `${SIDEWAYS_CARDIGAN_SUMMARY_EDIT_HREF}?${PATTERN_WORKSPACE_EDIT_QUERY}`;

export type SidewaysCardiganSummaryEntryPath = "from-builder" | "from-finished-pattern";

export const SIDEWAYS_CARDIGAN_SUMMARY_PRIMARY_LABEL = "Update Pattern";
export const SIDEWAYS_CARDIGAN_SUMMARY_CANCEL_FROM_BUILDER_LABEL = "Back to Builder";
export const SIDEWAYS_CARDIGAN_SUMMARY_CANCEL_FROM_EDIT_LABEL = "Cancel";

export const SIDEWAYS_CARDIGAN_SUMMARY_HINT_FROM_BUILDER =
  "Review or change your measurements, then click Update Pattern to open your knitting instructions.";

export const SIDEWAYS_CARDIGAN_SUMMARY_HINT_FROM_EDIT =
  "Make your changes, then click Update Pattern to update your pattern.";

export function resolveSidewaysCardiganSummaryEntryPath(
  search: string = typeof window !== "undefined" ? window.location.search : "",
): SidewaysCardiganSummaryEntryPath {
  const raw = search.startsWith("?") ? search.slice(1) : search;
  const params = new URLSearchParams(raw);
  if (params.get("generated") === "1") return "from-builder";
  return "from-finished-pattern";
}

export function sidewaysCardiganSummaryCancelLabel(
  path: SidewaysCardiganSummaryEntryPath,
): string {
  return path === "from-builder"
    ? SIDEWAYS_CARDIGAN_SUMMARY_CANCEL_FROM_BUILDER_LABEL
    : SIDEWAYS_CARDIGAN_SUMMARY_CANCEL_FROM_EDIT_LABEL;
}

export function sidewaysCardiganSummaryHint(path: SidewaysCardiganSummaryEntryPath): string {
  return path === "from-builder"
    ? SIDEWAYS_CARDIGAN_SUMMARY_HINT_FROM_BUILDER
    : SIDEWAYS_CARDIGAN_SUMMARY_HINT_FROM_EDIT;
}

export function withSidewaysSavedProjectQuery(href: string, projectId?: string | null): string {
  const id = projectId?.trim() ?? "";
  return id ? withSavedPatternProjectId(href, id) : href;
}

export function buildSidewaysCardiganSummaryEditFromPatternHref(
  projectId?: string | null,
): string {
  return withSidewaysSavedProjectQuery(
    SIDEWAYS_CARDIGAN_SUMMARY_EDIT_FROM_PATTERN_HREF,
    projectId,
  );
}

export function sidewaysCardiganSummaryCancelHref(
  path: SidewaysCardiganSummaryEntryPath,
  projectId?: string | null,
): string {
  if (path === "from-builder") return SIDEWAYS_CARDIGAN_PATTERN_BUILDER_HREF;
  return withSidewaysSavedProjectQuery(SIDEWAYS_CARDIGAN_OPEN_PATTERN_HREF, projectId);
}

export function sidewaysCardiganSummaryPrimarySuccessHref(
  projectId?: string | null,
): string {
  return withSidewaysSavedProjectQuery(SIDEWAYS_CARDIGAN_OPEN_PATTERN_HREF, projectId);
}
