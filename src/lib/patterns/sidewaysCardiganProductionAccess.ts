/**
 * Sideways Knit Sweater has launched — it is available on member-facing production hosts.
 * The gate is retired (always returns false); the route matcher below is kept so the
 * gate can be re-enabled later by restoring the env check if needed.
 */
import { type DetectSiteEnvironmentOptions } from "../env/siteEnvironment";

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
 * Sideways is now launched, so this is always false (nothing is blocked). The
 * signature is preserved for the callers in the catalog page and middleware.
 */
export function isSidewaysCardiganProductionBlocked(
  _hostname: string | null | undefined,
  _options: DetectSiteEnvironmentOptions = {},
): boolean {
  return false;
}
