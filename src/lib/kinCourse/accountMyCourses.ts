/**
 * Account “My Courses” — permanent individual-course ownership only.
 *
 * Membership plans unlock course playback, but they are not ownership.
 * Owned cards come from catalog entries mapped by {@link COURSE_INDIVIDUAL_SALES}.
 */
import { COURSE_INDIVIDUAL_SALES } from "../../config/legacyCourseEntitlements";
import { hasIndividualCoursePurchase } from "../courseAccess";
import {
  getCourseCatalogEntries,
  type CourseCatalogEntry,
} from "../coursesCatalog";
import type { CourseHrefResolveOptions } from "../legacy_kin/courseEnvironmentHref";

export type AccountOwnedCourseCard = {
  slug: string;
  title: string;
  href: string;
};

function catalogCardFromEntry(entry: CourseCatalogEntry): AccountOwnedCourseCard | null {
  const href = entry.href?.trim();
  const title = entry.title.trim();
  if (!href || !title) return null;

  return {
    slug: entry.slug,
    title,
    href,
  };
}

/** Catalog cards for individually owned courses, in COURSE_INDIVIDUAL_SALES order. */
export function accountOwnableCourseCatalogCards(
  entries: CourseCatalogEntry[] = getCourseCatalogEntries(),
): AccountOwnedCourseCard[] {
  const bySlug = new Map(entries.map((entry) => [entry.slug, entry]));
  const cards: AccountOwnedCourseCard[] = [];

  for (const sale of Object.values(COURSE_INDIVIDUAL_SALES)) {
    const entry = bySlug.get(sale.slug);
    if (!entry) continue;
    const card = catalogCardFromEntry(entry);
    if (card) cards.push(card);
  }

  return cards;
}

export function loadAccountOwnableCourseCatalogCards(
  env: CourseHrefResolveOptions = {},
): AccountOwnedCourseCard[] {
  return accountOwnableCourseCatalogCards(getCourseCatalogEntries(env));
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
