/**
 * Course access — member gating for courses.
 *
 * Courses use the same valid-access determination as the rest of the site
 * (`hasMemberAccess`). Retired KIN Beta Access does not unlock courses.
 * Login alone never unlocks member courses.
 *
 *   - "free"     — open to everyone (no login required).
 *   - "member"   — requires active member access (paid membership, or free
 *                  legacy plan with a valid paid-through date)
 *                  or a mapped individual-course plan for this slug.
 *   - "purchase" — included with membership (same as member courses).
 *                  Non-members may unlock via individual purchase entitlement.
 *
 * This helper reuses the global Memberstack payload parsing
 * (`getActivePlanIds`, `isMemberLoggedIn`) so course gating stays consistent
 * with every other gated section.
 */
import { LEGACY_COURSE_PLAN_SLUGS } from "../config/legacyCourseEntitlements";
import { getActivePlanIds, hasMemberAccess, isMemberLoggedIn, type MemberAccessOptions } from "./memberAccess";

export type CourseAccessLevel = "free" | "member" | "purchase";

/**
 * Resolved viewer state for a course, used to pick CTAs / gate copy:
 *   - "open"          — render content (free, member, or entitled purchase)
 *   - "loggedOut"     — course requires membership (or purchase); not logged in
 *   - "needsMembership" — course requires membership; logged in without access
 *   - "needsPurchase" — purchase course; logged in without membership or purchase
 */
export type CourseViewerState =
  | "open"
  | "loggedOut"
  | "needsMembership"
  | "needsPurchase";

export const COURSE_ACCESS_LEVELS = ["free", "member", "purchase"] as const;

/** Type guard for a valid course access level string. */
export function isCourseAccessLevel(value: unknown): value is CourseAccessLevel {
  return (
    typeof value === "string" &&
    (COURSE_ACCESS_LEVELS as readonly string[]).includes(value.trim().toLowerCase())
  );
}

/**
 * Normalize an arbitrary value to a `CourseAccessLevel`. Unknown or absent
 * values fall back to `fallback` (default "member", i.e. locked by default so
 * nothing leaks through omission). Legacy catalog value `"premium"` maps to
 * `"member"`.
 */
export function normalizeCourseAccessLevel(
  value: unknown,
  fallback: CourseAccessLevel = "member",
): CourseAccessLevel {
  if (typeof value === "string") {
    const v = value.trim().toLowerCase();
    if (v === "free") return "free";
    if (v === "member" || v === "premium") return "member";
    if (v === "purchase") return "purchase";
  }
  return fallback;
}

/**
 * True when the member holds currently valid member access that unlocks
 * member courses (same determination as {@link hasMemberAccess}).
 */
export function hasCourseMembershipAccess(
  memberOrPayload: unknown,
  options?: MemberAccessOptions,
): boolean {
  return hasMemberAccess(memberOrPayload, options);
}

/** @deprecated Use {@link hasCourseMembershipAccess}. */
export function hasPremiumCourseAccess(memberOrPayload: unknown): boolean {
  return hasCourseMembershipAccess(memberOrPayload);
}

/**
 * Individual course purchase entitlement for non-members.
 * Unlocks only the course slugs mapped to the member's active plan IDs
 * (`LEGACY_COURSE_PLAN_SLUGS`). Catalog locks and CourseAccessGate share this.
 */
export function hasIndividualCoursePurchase(
  courseSlug: string | null | undefined,
  memberOrPayload: unknown,
): boolean {
  const slug = typeof courseSlug === "string" ? courseSlug.trim() : "";
  if (!slug) return false;

  return getActivePlanIds(memberOrPayload).some((planId) => {
    const slugs = LEGACY_COURSE_PLAN_SLUGS[planId];
    return Boolean(slugs?.includes(slug));
  });
}

/** Whether the given course access level unlocks content for this viewer. */
export function canAccessCourse(
  access: CourseAccessLevel,
  memberOrPayload: unknown,
  options?: { courseSlug?: string | null } & MemberAccessOptions,
): boolean {
  if (access === "free") return true;
  if (hasCourseMembershipAccess(memberOrPayload, options)) return true;
  return hasIndividualCoursePurchase(options?.courseSlug, memberOrPayload);
}

/** Resolve the viewer's state for a course, for choosing CTAs / gate copy. */
export function getCourseViewerState(
  access: CourseAccessLevel,
  memberOrPayload: unknown,
  options?: { courseSlug?: string | null } & MemberAccessOptions,
): CourseViewerState {
  if (canAccessCourse(access, memberOrPayload, options)) return "open";

  if (access === "purchase") {
    return isMemberLoggedIn(memberOrPayload) ? "needsPurchase" : "loggedOut";
  }

  // member (and unknown fallbacks treated as member-gated)
  return isMemberLoggedIn(memberOrPayload) ? "needsMembership" : "loggedOut";
}
