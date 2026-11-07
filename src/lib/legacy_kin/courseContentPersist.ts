import {
  detectSiteEnvironment,
  type DetectSiteEnvironmentOptions,
} from "../env/siteEnvironment";
import { isCoursePreviewProductionBlocked } from "./coursePreviewProductionAccess";
import type { CourseEditorialState } from "./courseEditorial";
import type { CourseContentGithubCommitInput, CourseContentGithubCommitResult } from "./courseContentGithub";

export type CourseContentPersistMode = "filesystem" | "blob" | "github";

export type CourseContentPersistResult = {
  backupPath: string;
  persistedVia: CourseContentPersistMode;
  branch?: string;
  commitSha?: string;
  revisionId?: string;
  previewedRevisionId?: string | null;
  publishedRevisionId?: string | null;
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
  readEditorialState?: (courseId: number) => Promise<CourseEditorialState | null>;
  writeEditorialState?: (courseId: number, state: CourseEditorialState) => Promise<void>;
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
 * Draft persistence:
 * - localhost / missing hostname → gitignored editorial files
 * - published kin-dev and published production → the editorial blob store
 * A bundled POC file is never the draft. GitHub remains an explicit opt-in.
 */
export function resolveCourseContentPersistMode(
  options: CourseContentWriteOptions = {},
): CourseContentPersistMode {
  if (
    options.persist === "filesystem" ||
    options.persist === "blob" ||
    options.persist === "github"
  ) {
    return options.persist;
  }
  const site = detectSiteEnvironment(options.hostname ?? null, defaultPersistEnv(options.env));
  if (site === "production") return "blob";
  if (site === "dev" && options.hostname) return "blob";
  return "filesystem";
}

/** Deployed writes (kin-dev, not localhost) must present a Watson session. */
/** True only when the bytes just written are the bytes read back. */
export function courseContentWriteMatches(serialized: string, readBack: string): boolean {
  return serialized === readBack;
}

export function courseContentWriteRequiresWatsonSession(
  hostname: string | null | undefined,
  env?: DetectSiteEnvironmentOptions,
): boolean {
  return detectSiteEnvironment(hostname, defaultPersistEnv(env)) !== "localhost";
}
