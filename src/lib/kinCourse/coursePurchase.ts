/**
 * Individual course purchase lookups.
 *
 * Price IDs are for Memberstack checkout only. Plan IDs grant access through
 * {@link hasIndividualCoursePurchase} / {@link canAccessCourse}.
 */
import {
  COURSE_INDIVIDUAL_SALES,
  type IndividualCourseSale,
} from "../../config/legacyCourseEntitlements";
import { canAccessCourse, type CourseAccessLevel } from "../courseAccess";
import type { MemberAccessOptions } from "../memberAccess";

function normalizeCourseKey(value: string | null | undefined): string {
  return typeof value === "string" ? value.trim() : "";
}

export function findIndividualCourseSale(
  courseSlug: string | null | undefined,
): IndividualCourseSale | null {
  const slug = normalizeCourseKey(courseSlug);
  if (!slug) return null;

  for (const sale of Object.values(COURSE_INDIVIDUAL_SALES)) {
    if (sale.slug === slug || sale.aliases.includes(slug)) return sale;
  }
  return null;
}

/** Memberstack Price ID for checkout. Never returns a Plan ID. */
export function courseCheckoutPriceId(courseSlug: string | null | undefined): string | null {
  const priceId = findIndividualCourseSale(courseSlug)?.priceId ?? null;
  if (!priceId || !priceId.startsWith("prc_")) return null;
  return priceId;
}

export function courseHasIndividualPurchase(courseSlug: string | null | undefined): boolean {
  return courseCheckoutPriceId(courseSlug) !== null;
}

/**
 * Show the purchase CTA only when this course is for sale and the viewer does
 * not already have access via membership, Legacy, or Paid course plans.
 */
export function shouldShowCoursePurchaseCta(args: {
  courseSlug: string | null | undefined;
  hasAccess: boolean;
}): boolean {
  if (args.hasAccess) return false;
  return courseHasIndividualPurchase(args.courseSlug);
}

export function shouldShowCoursePurchaseCtaForViewer(args: {
  access: CourseAccessLevel;
  memberOrPayload: unknown;
  courseSlug?: string | null;
} & MemberAccessOptions): boolean {
  const hasAccess = canAccessCourse(args.access, args.memberOrPayload, {
    courseSlug: args.courseSlug,
    legacyPaidThroughYmd: args.legacyPaidThroughYmd,
    now: args.now,
    todayYmd: args.todayYmd,
  });
  return shouldShowCoursePurchaseCta({
    courseSlug: args.courseSlug,
    hasAccess,
  });
}
