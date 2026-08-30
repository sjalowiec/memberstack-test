/**
 * Socks Summary navigation (Hat Summary equivalent).
 * Builder → Summary (`?generated=1`). Finished Pattern is not part of this pass.
 */

import { PATTERN_WORKSPACE_GENERATED_QUERY } from "../customPatternProjectNavigation";
import { SOCK_BUILDER_PATH } from "./sockFreshStart";

export const SOCK_PATTERN_BUILDER_HREF = SOCK_BUILDER_PATH;

/** Dedicated Socks Summary page (full-page workspace; not a drawer). */
export const SOCK_SUMMARY_HREF = "/patterns/socks/summary/";

/**
 * Summary opened immediately after the Socks Builder completes.
 * Reuses the sweater/Hat `generated=1` query flag for entry-path tracking.
 */
export const SOCK_SUMMARY_FROM_BUILDER_HREF =
  `${SOCK_SUMMARY_HREF}?${PATTERN_WORKSPACE_GENERATED_QUERY}`;

/** Primary CTA label — same Hat Summary position; finished Pattern is not available yet. */
export const SOCK_SUMMARY_PRIMARY_LABEL = "View My Pattern";

/** Cancel when reviewing an initial build — return to the builder; draft stays. */
export const SOCK_SUMMARY_CANCEL_LABEL = "Back to Builder";

export const SOCK_SUMMARY_HINT =
  "Review your socks geometry. Return to the Builder to make changes. The finished pattern is not available yet.";

export const SOCK_SUMMARY_PATTERN_NOT_READY_MESSAGE =
  "The finished Socks pattern is not available yet.";

export function buildSockSummaryHref(): string {
  return SOCK_SUMMARY_HREF;
}

export function buildSockSummaryFromBuilderHref(): string {
  return SOCK_SUMMARY_FROM_BUILDER_HREF;
}

export function buildSockBuilderHref(): string {
  return SOCK_PATTERN_BUILDER_HREF;
}
