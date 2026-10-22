/**
 * Dev-only KnitSync pattern experiment — block member-facing production
 * hosts while keeping localhost / Astro dev / Netlify deploy previews available.
 */
import {
  detectSiteEnvironment,
  type DetectSiteEnvironmentOptions,
} from "../env/siteEnvironment";

export const KNITSYNC_PATTERN_PATH = "/dev/knitsync-pattern";

/** True for `/dev/knitsync-pattern` (trailing slash ignored). */
export function isKnitSyncPatternRoute(pathname: string): boolean {
  const normalized = pathname.replace(/\/+$/, "") || "/";
  return normalized === KNITSYNC_PATTERN_PATH;
}

/**
 * When true, the KnitSync route must 404 on production custom domains.
 * Uses the same host/env rules as {@link detectSiteEnvironment}.
 */
export function isKnitSyncPatternProductionBlocked(
  hostname: string | null | undefined,
  options: DetectSiteEnvironmentOptions = {},
): boolean {
  return detectSiteEnvironment(hostname, options) === "production";
}
