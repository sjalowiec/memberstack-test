/**
 * Drop Shoulder is in development — block member-facing production hosts while keeping
 * localhost, Astro dev, and Netlify deploy previews accessible for testing.
 */
import {
  detectSiteEnvironment,
  type DetectSiteEnvironmentOptions,
} from "../env/siteEnvironment";

export const DROP_SHOULDER_PATH_PREFIX = "/patterns/drop-shoulder";

/** True for `/patterns/drop-shoulder` and every nested route under it. */
export function isDropShoulderRoute(pathname: string): boolean {
  const normalized = pathname.replace(/\/+$/, "") || "/";
  return (
    normalized === DROP_SHOULDER_PATH_PREFIX ||
    normalized.startsWith(`${DROP_SHOULDER_PATH_PREFIX}/`)
  );
}

/**
 * When true, Drop Shoulder must not appear in catalogs and direct routes should redirect.
 * Uses the same host/env rules as {@link detectSiteEnvironment} (production custom domains only).
 */
export function isDropShoulderProductionBlocked(
  hostname: string | null | undefined,
  options: DetectSiteEnvironmentOptions = {},
): boolean {
  return detectSiteEnvironment(hostname, options) === "production";
}
