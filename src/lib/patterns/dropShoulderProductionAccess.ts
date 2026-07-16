/**
 * Drop Shoulder has launched — it is now available on member-facing production hosts.
 * The gate is retired (always returns false); the route matcher below is kept so the
 * gate can be re-enabled later by restoring the env check if needed.
 */
import { type DetectSiteEnvironmentOptions } from "../env/siteEnvironment";

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
 * Drop Shoulder is now launched, so this is always false (nothing is blocked). The
 * signature is preserved for the callers in the catalog page and middleware.
 */
export function isDropShoulderProductionBlocked(
  _hostname: string | null | undefined,
  _options: DetectSiteEnvironmentOptions = {},
): boolean {
  return false;
}
