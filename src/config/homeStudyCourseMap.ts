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
 * Courses 86 and 111 are mapped because the live product config, the player
 * document `legacyChallengeId`, and the public course URL all use those ids
 * for those courses. No other player id is included.
 */
import {
  COURSE_INDIVIDUAL_SALES,
  canonicalCourseCatalogSlug,
  type IndividualCourseSale,
} from "./legacyCourseEntitlements";

const PLAYBACK_TITLES: Record<IndividualCourseSale["courseId"], string> = {
  86: "Taitexma TH/TR-160: Getting Started",
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
      if (sale.courseId === courseKey) return sale;
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
  if (!sale) return null;
  return PLAYBACK_TITLES[sale.courseId] ?? null;
}
