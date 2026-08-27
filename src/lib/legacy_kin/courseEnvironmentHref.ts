import { kinCourseHomeHref } from "../kinCourse/hrefs";
import {
  detectSiteEnvironment,
  type DetectSiteEnvironmentOptions,
} from "../env/siteEnvironment";
import { courseLandingHref } from "./courseLanding";
import {
  getLegacyCourses,
  legacyCoursePreviewHref,
  legacyLessonHref,
  legacyLessonItemHref,
  type LegacyCourseSummary,
} from "./legacyCourseLoader";

export const PRODUCTION_COURSE_HOSTNAMES = new Set([
  "courses.knititnow.com",
  "www.knititnow.com",
  "knititnow.com",
]);

export type CourseHrefResolveOptions = DetectSiteEnvironmentOptions & {
  hostname?: string | null;
};

const COURSE_ID_PATH_RE = /\/courses\/(\d+)(?:\/|$)/i;

export function parseLegacyChallengeIdFromHref(
  href: string | undefined,
): number | undefined {
  const trimmed = href?.trim();
  if (!trimmed) return undefined;
  try {
    const url = /^https?:\/\//i.test(trimmed)
      ? new URL(trimmed)
      : new URL(trimmed, "https://knititnow.com");
    const match = url.pathname.match(COURSE_ID_PATH_RE);
    if (!match) return undefined;
    const id = Number(match[1]);
    return Number.isFinite(id) ? id : undefined;
  } catch {
    return undefined;
  }
}

export function isProductionKnitItNowCourseUrl(
  href: string | undefined,
): boolean {
  const trimmed = href?.trim();
  if (!trimmed) return false;
  try {
    const url = new URL(trimmed);
    const host = url.hostname.toLowerCase();
    if (!PRODUCTION_COURSE_HOSTNAMES.has(host)) return false;
    return url.pathname.toLowerCase().startsWith("/courses/");
  } catch {
    return false;
  }
}

function findLegacyCourseForCatalog(
  catalogSlug: string,
  catalogHref?: string,
): LegacyCourseSummary | undefined {
  const courses = getLegacyCourses({ includeDrafts: true });
  const challengeId = parseLegacyChallengeIdFromHref(catalogHref);
  if (challengeId != null) {
    const byId = courses.find((course) => course.legacyChallengeId === challengeId);
    if (byId) return byId;
  }
  const exact = courses.find((course) => course.slug === catalogSlug);
  if (exact) return exact;
  return courses.find((course) => course.slug.startsWith(`${catalogSlug}-`));
}

export function localLegacyCourseHrefForCatalog(
  catalogSlug: string,
  catalogHref?: string,
): string | undefined {
  const course = findLegacyCourseForCatalog(catalogSlug, catalogHref);
  if (!course) return undefined;
  return (
    legacyCoursePreviewHref(course.slug, null, {
      includeDraftPreview: course.isDraft,
    }) ?? undefined
  );
}

/**
 * Catalog card destination for the current environment.
 * Same-origin `/courses/{id}` overrides are used as-is. Absolute Knit It Now
 * course URLs (including the old `courses.knititnow.com` player) rewrite onto
 * `/courses/{id}`. DEV may add `?preview=true` for unpublished courses.
 */
export function resolveCatalogCourseHref(
  catalogSlug: string,
  catalogHref: string | undefined,
  options: CourseHrefResolveOptions = {},
): string | undefined {
  const override = catalogHref?.trim() || undefined;
  const siteEnv = detectSiteEnvironment(options.hostname, {
    isViteDev: options.isViteDev,
    publicSiteEnv: options.publicSiteEnv,
  });

  const challengeId = parseLegacyChallengeIdFromHref(override);
  if (override && isProductionKnitItNowCourseUrl(override) && challengeId != null) {
    const course = findLegacyCourseForCatalog(catalogSlug, override);
    const preview = siteEnv !== "production" && course?.isDraft !== false;
    return kinCourseHomeHref(challengeId, preview);
  }

  if (override) return override;

  const local = localLegacyCourseHrefForCatalog(catalogSlug, override);
  if (local) return local;
  return courseLandingHref(catalogSlug);
}

export function withDraftPreviewQuery(
  path: string,
  includeDrafts: boolean,
): string {
  if (!includeDrafts) return path;
  if (/[?&]preview=true(?:&|$)/.test(path)) return path;
  return path.includes("?") ? `${path}&preview=true` : `${path}?preview=true`;
}

/** Course Contents / sidebar lesson link (same origin, optional draft preview). */
export function legacyLessonNavHref(
  courseSlug: string,
  lessonSlug: string,
  includeDrafts = false,
): string {
  return withDraftPreviewQuery(legacyLessonHref(courseSlug, lessonSlug), includeDrafts);
}

/** Previous / Next section link (same origin, optional draft preview). */
export function legacyLessonItemNavHref(
  courseSlug: string,
  lessonSlug: string,
  itemSlug: string,
  includeDrafts = false,
): string {
  return withDraftPreviewQuery(
    legacyLessonItemHref(courseSlug, lessonSlug, itemSlug),
    includeDrafts,
  );
}
