/**
 * Socks navigation (Hat-style Pattern System).
 * New pattern: Builder → Summary (`?generated=1`) → finished Pattern.
 * Existing pattern: Pattern → dedicated Edit workspace → Pattern.
 */

import { PATTERN_WORKSPACE_GENERATED_QUERY } from "../customPatternProjectNavigation";
import { SOCK_BUILDER_PATH } from "./sockFreshStart";

export const SOCK_PATTERN_BUILDER_HREF = SOCK_BUILDER_PATH;

/** Finished Basic Socks Pattern page. */
export const SOCK_PATTERN_HREF = "/patterns/socks/pattern/";

/** Dedicated Socks Summary page (full-page workspace; not a drawer). */
export const SOCK_SUMMARY_HREF = "/patterns/socks/summary/";

/**
 * Dedicated Socks Edit workspace for an existing pattern.
 * Not the Builder, and not `?new=1`.
 */
export const SOCK_EDIT_HREF = "/patterns/socks/edit/";

/**
 * Summary opened immediately after the Socks Builder completes.
 * Reuses the sweater/Hat `generated=1` query flag for entry-path tracking.
 */
export const SOCK_SUMMARY_FROM_BUILDER_HREF =
  `${SOCK_SUMMARY_HREF}?${PATTERN_WORKSPACE_GENERATED_QUERY}`;

/** Primary CTA after reviewing Summary — opens the finished pattern. */
export const SOCK_SUMMARY_PRIMARY_LABEL = "View My Pattern";

/** Cancel when reviewing an initial build — return to the builder; draft stays. */
export const SOCK_SUMMARY_CANCEL_LABEL = "Back to Builder";

export const SOCK_SUMMARY_HINT =
  "Review your socks geometry, then click View My Pattern to open your finished pattern.";

/** Primary CTA on the dedicated Socks Edit workspace. */
export const SOCK_EDIT_PRIMARY_LABEL = "Update Pattern";

/** Cancel when editing an existing finished pattern — return without writing. */
export const SOCK_EDIT_CANCEL_LABEL = "Cancel";

export function buildSockSummaryHref(): string {
  return SOCK_SUMMARY_HREF;
}

export function buildSockSummaryFromBuilderHref(): string {
  return SOCK_SUMMARY_FROM_BUILDER_HREF;
}

export function buildSockBuilderHref(): string {
  return SOCK_PATTERN_BUILDER_HREF;
}

export function buildSockPatternHref(): string {
  return SOCK_PATTERN_HREF;
}

export function buildSockEditHref(): string {
  return SOCK_EDIT_HREF;
}
