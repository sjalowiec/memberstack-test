/**
 * Dev-only Sleeveless Front Stitches & Rows preview — block production hosts
 * while keeping localhost / Astro dev / Netlify deploy previews available.
 */
import {
  detectSiteEnvironment,
  type DetectSiteEnvironmentOptions,
} from "../env/siteEnvironment";

export const SLEEVELESS_FRONT_STS_ROWS_PREVIEW_PATH = "/dev/sleeveless-front-sts-rows-preview";

/** True for `/dev/sleeveless-front-sts-rows-preview` (trailing slash ignored). */
export function isSleevelessFrontStsRowsPreviewRoute(pathname: string): boolean {
  const normalized = pathname.replace(/\/+$/, "") || "/";
  return normalized === SLEEVELESS_FRONT_STS_ROWS_PREVIEW_PATH;
}

export function isSleevelessFrontStsRowsPreviewProductionBlocked(
  hostname: string | null | undefined,
  options: DetectSiteEnvironmentOptions = {},
): boolean {
  return detectSiteEnvironment(hostname, options) === "production";
}
