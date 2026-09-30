/**
 * Home Study course id → site player.
 *
 * Only ids listed here may open a course page from a verified historical
 * purchase. Numeric equality with `legacyChallengeId` / ChallengesID is not
 * a mapping. Challenges 47 is "Bonnie's One-Piece Cocoon" and 49 is
 * "Summer Vacation" in kin-legacy-course-index.csv, while the library row
 * that prompted this work called course 49 Bonnie's Cocoon. Those ids stay
 * unresolved and never play back.
 *
 * Courses 86, 87, and 111 are mapped because the player document
 * `legacyChallengeId` and the public course URL use those ids.
 * Challenges course 34, Master LK-150 Patterning, is an individual-plan
 * course. Home Study course 34 is DIY Beginners Blanket, so that id is not
 * a playback id.
 */
import {
  COURSE_INDIVIDUAL_SALES,
  canonicalCourseCatalogSlug,
  type IndividualCourseSale,
} from "./legacyCourseEntitlements";

type HomeStudyPlaybackCourseId = 86 | 87 | 111;

const HOME_STUDY_PLAYBACK_COURSE_IDS: readonly HomeStudyPlaybackCourseId[] = [86, 87, 111];

function isHomeStudyPlaybackCourseId(courseId: number): courseId is HomeStudyPlaybackCourseId {
  return (HOME_STUDY_PLAYBACK_COURSE_IDS as readonly number[]).includes(courseId);
}

const PLAYBACK_TITLES: Record<HomeStudyPlaybackCourseId, string> = {
  86: "Taitexma TH/TR-160: Getting Started",
  87: "Brother KH/KR-260 Quick Start",
  111: "Mastering the Silver Reed SK840",
};

export const UNRESOLVED_HOME_STUDY_COURSE_IDS = [47, 49] as const;

export type HomeStudyCourseIdConflict = {
  homeStudyCourseId: number;
  libraryTitleFromAudit: string;
  challengesIndexTitle: string;
  challengesIndexIdForLibraryTitle: number;
};

export const HOME_STUDY_COURSE_ID_CONFLICTS: readonly HomeStudyCourseIdConflict[] = [
  {
    homeStudyCourseId: 49,
    libraryTitleFromAudit: "Bonnie's One Piece Cocoon",
    challengesIndexTitle: "Summer Vacation",
    challengesIndexIdForLibraryTitle: 47,
  },
];

export function isUnresolvedHomeStudyCourseId(courseId: number): boolean {
  return (UNRESOLVED_HOME_STUDY_COURSE_IDS as readonly number[]).includes(courseId);
}

/** Site course a verified purchase may open. Unmapped and conflict ids return null. */
export function verifiedHomeStudyPlaybackCourse(
  courseKey: string | number | null | undefined,
): IndividualCourseSale | null {
  if (typeof courseKey === "number") {
    if (!Number.isInteger(courseKey) || courseKey <= 0) return null;
    if (isUnresolvedHomeStudyCourseId(courseKey)) return null;
    for (const sale of Object.values(COURSE_INDIVIDUAL_SALES)) {
      if (sale.courseId === courseKey && isHomeStudyPlaybackCourseId(sale.courseId)) return sale;
    }
    return null;
  }

  const raw = typeof courseKey === "string" ? courseKey.trim() : "";
  if (!raw) return null;
  if (/^\d+$/.test(raw)) {
    return verifiedHomeStudyPlaybackCourse(Number(raw));
  }

  const slug = canonicalCourseCatalogSlug(raw);
  for (const sale of Object.values(COURSE_INDIVIDUAL_SALES)) {
    if (!isHomeStudyPlaybackCourseId(sale.courseId)) continue;
    if (sale.slug === slug || sale.aliases.includes(raw)) return sale;
  }
  return null;
}

export function homeStudyPlaybackHref(courseId: number): string | null {
  const sale = verifiedHomeStudyPlaybackCourse(courseId);
  return sale ? `/courses/${sale.courseId}` : null;
}

export function homeStudyPlaybackTitle(courseId: number): string | null {
  const sale = verifiedHomeStudyPlaybackCourse(courseId);
  if (!sale || !isHomeStudyPlaybackCourseId(sale.courseId)) return null;
  return PLAYBACK_TITLES[sale.courseId];
}
