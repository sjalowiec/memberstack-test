/**
 * Account “My Courses” — permanent individual-course ownership only.
 *
 * Browser-safe: titles, URLs, and qualifying plan IDs live in this module.
 * Do not import catalog loaders, courseContentAdmin, fs, path, or other
 * server-only modules here — the account client bundle imports this file.
 *
 * Membership plans unlock course playback, but they are not ownership.
 */
import { COURSE_INDIVIDUAL_SALES } from "../../config/legacyCourseEntitlements";
import { hasIndividualCoursePurchase } from "../courseAccess";

export type AccountOwnedCourseCard = {
  slug: string;
  title: string;
  href: string;
};

/** Browser-safe display + entitlement metadata for individually owned courses. */
export type AccountOwnableCourse = {
  courseId: 86 | 111;
  slug: string;
  title: string;
  href: string;
  planIds: readonly string[];
};

export const ACCOUNT_OWNABLE_COURSES: readonly AccountOwnableCourse[] = [
  {
    courseId: COURSE_INDIVIDUAL_SALES.th160.courseId,
    slug: COURSE_INDIVIDUAL_SALES.th160.slug,
    title: "Taitexma TH/TR-160: Getting Started",
    href: "/courses/86",
    planIds: [
      COURSE_INDIVIDUAL_SALES.th160.legacyPlanId,
      COURSE_INDIVIDUAL_SALES.th160.paidPlanId,
    ],
  },
  {
    courseId: COURSE_INDIVIDUAL_SALES.sk840.courseId,
    slug: COURSE_INDIVIDUAL_SALES.sk840.slug,
    title: "Mastering the Silver Reed SK840",
    href: "/courses/111",
    planIds: [
      COURSE_INDIVIDUAL_SALES.sk840.legacyPlanId,
      COURSE_INDIVIDUAL_SALES.sk840.paidPlanId,
    ],
  },
];

/** Catalog cards for individually owned courses, in COURSE_INDIVIDUAL_SALES order. */
export function accountOwnableCourseCatalogCards(): AccountOwnedCourseCard[] {
  return ACCOUNT_OWNABLE_COURSES.map(({ slug, title, href }) => ({
    slug,
    title,
    href,
  }));
}

/**
 * Unique owned course slugs for the member's active plan connections.
 * Duplicate Legacy/Paid connections for the same course collapse to one slug.
 */
export function ownedCourseSlugsFromMember(memberOrPayload: unknown): string[] {
  const slugs: string[] = [];
  for (const sale of Object.values(COURSE_INDIVIDUAL_SALES)) {
    if (hasIndividualCoursePurchase(sale.slug, memberOrPayload)) {
      slugs.push(sale.slug);
    }
  }
  return slugs;
}

/** Catalog cards the member permanently owns. Empty when none. */
export function ownedCoursesForAccount(
  memberOrPayload: unknown,
  catalogCards: AccountOwnedCourseCard[] = accountOwnableCourseCatalogCards(),
): AccountOwnedCourseCard[] {
  const owned = new Set(ownedCourseSlugsFromMember(memberOrPayload));
  return catalogCards.filter((card) => owned.has(card.slug));
}

export function shouldShowAccountMyCourses(courses: AccountOwnedCourseCard[]): boolean {
  return courses.length > 0;
}
