import {
  detectSiteEnvironment,
  type DetectSiteEnvironmentOptions,
} from "../env/siteEnvironment";
import { isCoursePreviewProductionBlocked } from "./coursePreviewProductionAccess";
import type { CourseContentGithubCommitInput, CourseContentGithubCommitResult } from "./courseContentGithub";

export type CourseContentPersistMode = "filesystem" | "blob" | "github";

export type CourseContentPersistResult = {
  backupPath: string;
  persistedVia: CourseContentPersistMode;
  branch?: string;
  commitSha?: string;
};

export type CourseContentWriteOptions = {
  persist?: CourseContentPersistMode;
  hostname?: string | null;
  env?: DetectSiteEnvironmentOptions;
  commitCourseContentFile?: (
    input: CourseContentGithubCommitInput,
  ) => Promise<CourseContentGithubCommitResult>;
  writeCourseContentOverlay?: (
    courseId: number,
    data: import("./coursePreviewPoc").CoursePreviewData,
  ) => Promise<void>;
  readCourseContentOverlay?: (
    courseId: number,
  ) => Promise<import("./coursePreviewPoc").CoursePreviewData | null>;
};

function defaultPersistEnv(
  options?: DetectSiteEnvironmentOptions,
): DetectSiteEnvironmentOptions {
  if (options) return options;
  return {
    isViteDev: typeof import.meta !== "undefined" && Boolean(import.meta.env?.DEV),
    publicSiteEnv:
      typeof import.meta !== "undefined" ? import.meta.env?.PUBLIC_SITE_ENV : undefined,
  };
}

export function isCourseContentProductionWriteBlocked(
  hostname: string | null | undefined,
  env?: DetectSiteEnvironmentOptions,
): boolean {
  return isCoursePreviewProductionBlocked(hostname, defaultPersistEnv(env));
}

/**
 * Live editorial persistence:
 * - localhost / missing hostname → filesystem (immediate)
 * - deployed DEV (kin-dev) → Netlify Blobs (immediate Save → Preview)
 * GitHub remains an explicit opt-in, never the default preview path.
 */
export function resolveCourseContentPersistMode(
  options: CourseContentWriteOptions = {},
): CourseContentPersistMode {
  const env = defaultPersistEnv(options.env);
  if (isCourseContentProductionWriteBlocked(options.hostname, env)) {
    throw new Error("Course content writes are blocked in production.");
  }
  if (
    options.persist === "filesystem" ||
    options.persist === "blob" ||
    options.persist === "github"
  ) {
    return options.persist;
  }
  const site = detectSiteEnvironment(options.hostname ?? null, env);
  if (site === "dev" && options.hostname) return "blob";
  return "filesystem";
}

/** Deployed writes (kin-dev, not localhost) must present a Watson session. */
export function courseContentWriteRequiresWatsonSession(
  hostname: string | null | undefined,
  env?: DetectSiteEnvironmentOptions,
): boolean {
  return detectSiteEnvironment(hostname, defaultPersistEnv(env)) !== "localhost";
}
