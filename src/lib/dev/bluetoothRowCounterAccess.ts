/**
 * Dev-only Bluetooth row-counter experiment — block member-facing production
 * hosts while keeping localhost / Astro dev / Netlify deploy previews available.
 */
import {
  detectSiteEnvironment,
  type DetectSiteEnvironmentOptions,
} from "../env/siteEnvironment";

export const BLUETOOTH_ROW_COUNTER_PATH = "/dev/bluetooth-row-counter";

/** True for `/dev/bluetooth-row-counter` (trailing slash ignored). */
export function isBluetoothRowCounterRoute(pathname: string): boolean {
  const normalized = pathname.replace(/\/+$/, "") || "/";
  return normalized === BLUETOOTH_ROW_COUNTER_PATH;
}

/**
 * When true, the row-counter route must 404 on production custom domains.
 * Uses the same host/env rules as {@link detectSiteEnvironment}.
 */
export function isBluetoothRowCounterProductionBlocked(
  hostname: string | null | undefined,
  options: DetectSiteEnvironmentOptions = {},
): boolean {
  return detectSiteEnvironment(hostname, options) === "production";
}
