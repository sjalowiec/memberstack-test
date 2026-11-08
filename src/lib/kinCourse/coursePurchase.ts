/**
 * Individual course purchase lookups.
 *
 * Price IDs are for Memberstack checkout only. Plan IDs grant access through
 * {@link hasIndividualCoursePurchase} / {@link canAccessCourse}.
 */
import {
  BEGINNER_WORKSHOP_COURSE_SLUG,
  BROTHER_930_940_COURSE_SLUG,
  canonicalCourseCatalogSlug,
  COURSE_INDIVIDUAL_SALES,
  KIN_TAITEXMA_160_COURSE_SLUG,
  LEGACY_COURSE_PLAN_SLUGS,
  LEGACY_SK840_COURSE_SLUG,
  RIBBER_BOOTCAMP_COURSE_SLUG,
  type IndividualCourseSale,
} from "../../config/legacyCourseEntitlements";
import { MEMBER_PLAN_IDS } from "../../config/memberships";
import {
  canAccessCourse,
  hasCourseMembershipAccess,
  hasIndividualCoursePurchase,
  type CourseAccessLevel,
} from "../courseAccess";
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

/** Configured display price only. Never invents a dollar amount. */
export function coursePurchasePriceLabel(courseSlug: string | null | undefined): string | null {
  const label = findIndividualCourseSale(courseSlug)?.priceLabel;
  if (typeof label !== "string") return null;
  const trimmed = label.trim();
  return trimmed || null;
}

export function isTaitexma160CourseSlug(courseSlug: string | null | undefined): boolean {
  return canonicalCourseCatalogSlug(courseSlug) === KIN_TAITEXMA_160_COURSE_SLUG;
}

export function isSk840CourseSlug(courseSlug: string | null | undefined): boolean {
  return canonicalCourseCatalogSlug(courseSlug) === LEGACY_SK840_COURSE_SLUG;
}

export function isBeginnerWorkshopCourseSlug(courseSlug: string | null | undefined): boolean {
  return canonicalCourseCatalogSlug(courseSlug) === BEGINNER_WORKSHOP_COURSE_SLUG;
}

export function isBrother930940CourseSlug(courseSlug: string | null | undefined): boolean {
  return canonicalCourseCatalogSlug(courseSlug) === BROTHER_930_940_COURSE_SLUG;
}

export function isRibberBootcampCourseSlug(courseSlug: string | null | undefined): boolean {
  return canonicalCourseCatalogSlug(courseSlug) === RIBBER_BOOTCAMP_COURSE_SLUG;
}

/**
 * Sales pages replace the generic locked card for visitors without access.
 * Members and owners of that course keep the player.
 */
export function shouldShowKinCourseSalesPage(args: {
  courseSlug: string | null | undefined;
  hasAccess: boolean;
}): boolean {
  if (args.hasAccess) return false;
  return (
    isTaitexma160CourseSlug(args.courseSlug) ||
    isSk840CourseSlug(args.courseSlug) ||
    isBrother930940CourseSlug(args.courseSlug) ||
    isBeginnerWorkshopCourseSlug(args.courseSlug) ||
    isRibberBootcampCourseSlug(args.courseSlug) ||
    courseHasIndividualPurchase(args.courseSlug)
  );
}

export function shouldShowKinCourseSalesPageForViewer(args: {
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
  return shouldShowKinCourseSalesPage({
    courseSlug: args.courseSlug,
    hasAccess,
  });
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

export const MEMBER_COURSE_INCLUDED_COPY = "This course is included with your membership.";
export const MEMBER_COURSE_OWNED_COPY = "You own this course";
export const MEMBER_COURSE_KEEP_ACCESS_COPY =
  "Keep access to this course even if your membership ends.";

/**
 * True when this course has its own one-time price and that price's paid plan
 * unlocks only this course. Membership plans never qualify. An incomplete
 * sale stays false so the member offer is omitted.
 */
export function courseStandalonePurchaseReady(courseSlug: string | null | undefined): boolean {
  const sale = findIndividualCourseSale(courseSlug);
  if (!sale?.paidPlanId || !sale.priceId || !sale.priceLabel) return false;
  const priceId = courseCheckoutPriceId(courseSlug);
  const label = coursePurchasePriceLabel(courseSlug);
  if (!priceId || !label || priceId !== sale.priceId || label !== sale.priceLabel.trim()) return false;
  if (!sale.paidPlanId.startsWith("pln_")) return false;
  if ((MEMBER_PLAN_IDS as readonly string[]).includes(sale.paidPlanId)) return false;
  if (priceId === sale.paidPlanId || priceId === sale.legacyPlanId) return false;
  const granted = LEGACY_COURSE_PLAN_SLUGS[sale.paidPlanId];
  return Boolean(granted?.length === 1 && granted[0] === sale.slug);
}

export function memberCourseBuyLabel(priceLabel: string): string {
  return `Buy for ${priceLabel}`;
}

export type MemberCourseKeepAccessView =
  | { kind: "hidden" }
  | { kind: "owned" }
  | { kind: "included"; buyLabel: string };

/**
 * Member offer on the course page. People without access keep the existing
 * sales-page purchase button. A paid plan or legacy entitlement hides the
 * member buy button. Membership access shows it only when standalone checkout
 * is ready. Verified Home Study playback is not an ownership check here.
 */
export function resolveMemberCourseKeepAccess(args: {
  memberOrPayload: unknown;
  courseSlug?: string | null;
} & MemberAccessOptions): MemberCourseKeepAccessView {
  if (!courseStandalonePurchaseReady(args.courseSlug)) return { kind: "hidden" };

  if (hasIndividualCoursePurchase(args.courseSlug, args.memberOrPayload)) {
    return { kind: "owned" };
  }

  if (!hasCourseMembershipAccess(args.memberOrPayload, args)) return { kind: "hidden" };

  const label = coursePurchasePriceLabel(args.courseSlug);
  if (!label) return { kind: "hidden" };
  return { kind: "included", buyLabel: memberCourseBuyLabel(label) };
}
