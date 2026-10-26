/**
 * Christmas Stocking has launched — it is available on member-facing production hosts.
 * The gate is retired (always returns false); the route matcher and unavailable
 * response below are kept so the gate can be re-enabled later by restoring the
 * env check. Membership rules for starting and editing a stocking are unchanged.
 */
import { type DetectSiteEnvironmentOptions } from "../env/siteEnvironment";

export const CHRISTMAS_STOCKING_PATH_PREFIX = "/patterns/christmas-stocking";
export const CHRISTMAS_STOCKING_TEMPORARILY_UNAVAILABLE_MESSAGE = "Temporarily unavailable";

/** True for `/patterns/christmas-stocking` and every nested route under it. */
export function isChristmasStockingRoute(pathname: string): boolean {
  const normalized = pathname.replace(/\/+$/, "") || "/";
  return (
    normalized === CHRISTMAS_STOCKING_PATH_PREFIX ||
    normalized.startsWith(`${CHRISTMAS_STOCKING_PATH_PREFIX}/`)
  );
}

/**
 * When true, Christmas Stocking must not appear in the public catalog and
 * direct builder, landing, and instruction routes show a short unavailable message.
 * Christmas Stocking is now launched, so this is always false. The signature is
 * preserved for the catalog page and middleware.
 */
export function isChristmasStockingProductionBlocked(
  _hostname: string | null | undefined,
  _options: DetectSiteEnvironmentOptions = {},
): boolean {
  return false;
}

/** Short page shown instead of the builder or generated instructions on production. */
export function christmasStockingTemporarilyUnavailableResponse(): Response {
  const message = CHRISTMAS_STOCKING_TEMPORARILY_UNAVAILABLE_MESSAGE;
  const body = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="robots" content="noindex"><title>${message}</title></head><body><p>${message}</p></body></html>`;
  return new Response(body, {
    status: 503,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
      "x-robots-tag": "noindex",
    },
  });
}
