/**
 * Christmas Stocking is temporarily unavailable on member-facing production hosts.
 * Localhost, Astro dev, and Netlify hosts (including kin-dev) stay open for testing.
 * Saved projects and the pattern code stay in place.
 */
import {
  detectSiteEnvironment,
  type DetectSiteEnvironmentOptions,
} from "../env/siteEnvironment";

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
 * Uses the same host/env rules as {@link detectSiteEnvironment}.
 */
export function isChristmasStockingProductionBlocked(
  hostname: string | null | undefined,
  options: DetectSiteEnvironmentOptions = {},
): boolean {
  return detectSiteEnvironment(hostname, options) === "production";
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
