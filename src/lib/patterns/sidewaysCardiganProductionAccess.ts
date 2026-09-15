/**
 * Sideways Knit Sweater is in development — block member-facing production hosts while
 * keeping localhost, Astro dev, and Netlify deploy previews accessible for testing.
 */
import {
  detectSiteEnvironment,
  type DetectSiteEnvironmentOptions,
} from "../env/siteEnvironment";

export const SIDEWAYS_CARDIGAN_PATH_PREFIX = "/patterns/sideways-cardigan";

/** True for `/patterns/sideways-cardigan` and every nested route under it. */
export function isSidewaysCardiganRoute(pathname: string): boolean {
  const normalized = pathname.replace(/\/+$/, "") || "/";
  return (
    normalized === SIDEWAYS_CARDIGAN_PATH_PREFIX ||
    normalized.startsWith(`${SIDEWAYS_CARDIGAN_PATH_PREFIX}/`)
  );
}

/**
 * When true, Sideways must not appear as a live catalog card and direct routes should redirect.
 * Uses the same host/env rules as {@link detectSiteEnvironment} (production custom domains only).
 */
export function isSidewaysCardiganProductionBlocked(
  hostname: string | null | undefined,
  options: DetectSiteEnvironmentOptions = {},
): boolean {
  return detectSiteEnvironment(hostname, options) === "production";
}
