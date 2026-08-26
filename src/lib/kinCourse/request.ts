import type { DetectSiteEnvironmentOptions } from "../env/siteEnvironment";
import { isCoursePreviewProductionBlocked } from "../legacy_kin/coursePreviewProductionAccess";

export function kinCourseEnv(): DetectSiteEnvironmentOptions {
  return {
    isViteDev: typeof import.meta !== "undefined" && Boolean(import.meta.env?.DEV),
    publicSiteEnv:
      typeof import.meta !== "undefined" ? import.meta.env?.PUBLIC_SITE_ENV : undefined,
  };
}

export function kinCoursePreviewRequested(url: URL): boolean {
  if (url.searchParams.get("preview") !== "true") return false;
  return !isCoursePreviewProductionBlocked(url.hostname, kinCourseEnv());
}

export function kinCourseLoadOptions(url: URL) {
  const preview = kinCoursePreviewRequested(url);
  return {
    hostname: url.hostname,
    env: kinCourseEnv(),
    includeDrafts: preview,
    preview,
  };
}
