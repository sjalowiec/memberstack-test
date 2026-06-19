/**
 * Internal course preview POC — block member-facing production hosts while keeping
 * localhost, Astro dev, and Netlify deploy previews accessible for testing.
 */
import {
  detectSiteEnvironment,
  type DetectSiteEnvironmentOptions,
} from "../env/siteEnvironment";
import { COURSE_PREVIEW_BASE } from "./coursePreviewPoc";

export const COURSE_PREVIEW_PATH_PREFIX = COURSE_PREVIEW_BASE;

/** True for `/dev/course-preview` and every nested route under it. */
export function isCoursePreviewRoute(pathname: string): boolean {
  const normalized = pathname.replace(/\/+$/, "") || "/";
  return (
    normalized === COURSE_PREVIEW_PATH_PREFIX ||
    normalized.startsWith(`${COURSE_PREVIEW_PATH_PREFIX}/`)
  );
}

/**
 * When true, course preview routes must redirect on production custom domains.
 * Uses the same host/env rules as {@link detectSiteEnvironment}.
 */
export function isCoursePreviewProductionBlocked(
  hostname: string | null | undefined,
  options: DetectSiteEnvironmentOptions = {},
): boolean {
  return detectSiteEnvironment(hostname, options) === "production";
}
