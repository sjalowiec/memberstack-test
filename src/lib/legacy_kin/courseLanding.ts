import type { CourseAccessLevel } from "../courseAccess";
import { getCourseAccessBySlug } from "../coursesCatalogAccess";
import { readCourseContentStatus } from "./courseContentAdmin";
import { legacyAssetUrl } from "./legacyCourseAssetUrls";
import {
  getLegacyCourseRecordBySlug,
  getSortedLessonsForCourse,
  legacyCourseHref,
  legacyLessonHref,
  type LegacyCourseRecord,
} from "./legacyCourseLoader";
import type { CourseContentStatus } from "./coursePreviewPoc";

export type CourseLandingView = {
  slug: string;
  title: string;
  description?: string;
  thumbnailUrl?: string;
  contentStatus: CourseContentStatus;
  contentStatusLabel: string;
  lessonCount: number;
  startHref: string;
  interestTag: string;
  /** Gating tier: free (open), premium (Beta/Premium), purchase (reserved). */
  access: CourseAccessLevel;
};

const CONTENT_STATUS_LABELS: Record<CourseContentStatus, string> = {
  in_progress: "Being updated",
  cleaned: "Ready",
};

export function courseLandingHref(courseSlug: string): string {
  return `/courses/${encodeURIComponent(courseSlug.trim())}`;
}

export function courseInterestActiveCampaignTag(courseSlug: string): string {
  return `course-interest-${courseSlug.trim()}`;
}

export function courseLandingStartHref(slug: string, record?: LegacyCourseRecord): string {
  const course = record ?? getLegacyCourseRecordBySlug(slug);
  if (!course) return legacyCourseHref(slug);

  const lessons = getSortedLessonsForCourse(course);
  const firstLesson = lessons[0];
  if (firstLesson) {
    return legacyLessonHref(slug, firstLesson.slug);
  }
  return legacyCourseHref(slug);
}

export function readCourseDescription(record: LegacyCourseRecord): string | undefined {
  const description =
    "description" in record.course && typeof record.course.description === "string"
      ? record.course.description.trim()
      : "";
  return description || undefined;
}

export function readCourseLandingThumbnail(record: LegacyCourseRecord): string | undefined {
  const thumbnail =
    "thumbnail" in record.course && typeof record.course.thumbnail === "string"
      ? record.course.thumbnail.trim()
      : "";
  return thumbnail ? legacyAssetUrl(thumbnail) : undefined;
}

export function getCourseLandingBySlug(slug: string): CourseLandingView | undefined {
  const record = getLegacyCourseRecordBySlug(slug);
  if (!record) return undefined;

  const normalizedSlug = record.course.slug;
  const contentStatus = readCourseContentStatus(record.course);

  return {
    slug: normalizedSlug,
    title: record.course.title,
    description: readCourseDescription(record),
    thumbnailUrl: readCourseLandingThumbnail(record),
    contentStatus,
    contentStatusLabel: CONTENT_STATUS_LABELS[contentStatus],
    lessonCount: record.lessons.length,
    startHref: courseLandingStartHref(normalizedSlug, record),
    interestTag: courseInterestActiveCampaignTag(normalizedSlug),
    access: getCourseAccessBySlug(normalizedSlug),
  };
}
