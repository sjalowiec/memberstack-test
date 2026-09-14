/**
 * Shared Knit-able link helpers.
 * Keep this small — page-specific copy and images stay with each inspiration page.
 */

import { buildSockBuilderNewPatternHref } from "../patterns/sock/sockFreshStart";

/** External pattern/reference links (not affiliate). */
export const KNIT_ABLE_EXTERNAL_REL = "noopener noreferrer";

/** Affiliate shop buttons and yarn images (matches the knitting-machine-table Amazon CTA). */
export const KNIT_ABLE_AFFILIATE_REL = "sponsored noopener noreferrer";

/**
 * Start a new Basic Socks pattern from a Knit-able inspiration CTA.
 * Uses the same `?new=1` catalog convention as `/patterns`.
 */
export function knitAbleSockBuilderHref(): string {
  return buildSockBuilderNewPatternHref();
}
