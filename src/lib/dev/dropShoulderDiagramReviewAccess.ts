/**
 * Dev-only Drop Shoulder diagram review — block member-facing production hosts
 * while keeping localhost / Astro dev / Netlify deploy previews available.
 */
import {
  detectSiteEnvironment,
  type DetectSiteEnvironmentOptions,
} from "../env/siteEnvironment";

export const DROP_SHOULDER_DIAGRAM_REVIEW_PATH = "/dev/drop-shoulder-diagram-review";

/** True for `/dev/drop-shoulder-diagram-review` (trailing slash ignored). */
export function isDropShoulderDiagramReviewRoute(pathname: string): boolean {
  const normalized = pathname.replace(/\/+$/, "") || "/";
  return normalized === DROP_SHOULDER_DIAGRAM_REVIEW_PATH;
}

/**
 * When true, the diagram review route must 404 on production custom domains.
 * Uses the same host/env rules as {@link detectSiteEnvironment}.
 */
export function isDropShoulderDiagramReviewProductionBlocked(
  hostname: string | null | undefined,
  options: DetectSiteEnvironmentOptions = {},
): boolean {
  return detectSiteEnvironment(hostname, options) === "production";
}
