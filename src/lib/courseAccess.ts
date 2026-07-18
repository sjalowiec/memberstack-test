/**
 * Course access — Premium-tier gating for courses.
 *
 * Courses use a NARROWER allow list than the global member gate. The global
 * `hasMemberAccess` (in `memberAccess.ts`) grants access to Basic, Premium,
 * Beta, and legacy members. Courses key off the PREMIUM subset only:
 *
 *   - "free"     — open to everyone (no login required).
 *   - "premium"  — Beta, current Premium, and legacy Premium (`PREMIUM_PLAN_IDS`).
 *                  Basic and legacy Basic do NOT unlock courses.
 *   - "purchase" — included with Premium/Beta (same as premium courses).
 *                  Non-Premium members may unlock via individual purchase
 *                  entitlement when that system exists; until then they stay locked.
 *
 * This helper reuses the global Memberstack payload parsing
 * (`getActivePlanIds`, `isMemberLoggedIn`) so course gating stays consistent
 * with every other gated section.
 */
import { PREMIUM_PLAN_IDS } from "../config/memberships";
import { getActivePlanIds, isMemberLoggedIn } from "./memberAccess";

export type CourseAccessLevel = "free" | "premium" | "purchase";

/**
 * Resolved viewer state for a course, used to pick CTAs / gate copy:
 *   - "open"          — render content (free, Premium member, or entitled purchase)
 *   - "loggedOut"     — course requires Premium (or purchase); not logged in
 *   - "needsPremium"  — course requires Premium; logged in but no Premium plan
 *   - "needsPurchase" — purchase course; logged in without Premium or purchase entitlement
 */
export type CourseViewerState =
  | "open"
  | "loggedOut"
  | "needsPremium"
  | "needsPurchase";

export const COURSE_ACCESS_LEVELS = ["free", "premium", "purchase"] as const;

const premiumPlanIds = new Set<string>(PREMIUM_PLAN_IDS);

/** Type guard for a valid course access level string. */
export function isCourseAccessLevel(value: unknown): value is CourseAccessLevel {
  return (
    typeof value === "string" &&
    (COURSE_ACCESS_LEVELS as readonly string[]).includes(value.trim().toLowerCase())
  );
}

/**
 * Normalize an arbitrary value to a `CourseAccessLevel`. Unknown or absent
 * values fall back to `fallback` (default "premium", i.e. locked by default so
 * nothing leaks through omission).
 */
export function normalizeCourseAccessLevel(
  value: unknown,
  fallback: CourseAccessLevel = "premium",
): CourseAccessLevel {
  if (typeof value === "string") {
    const v = value.trim().toLowerCase();
    if (v === "free") return "free";
    if (v === "premium") return "premium";
    if (v === "purchase") return "purchase";
  }
  return fallback;
}

/**
 * True when the member holds an active Beta, current Premium, or legacy Premium
 * plan. Basic and legacy Basic do NOT grant course access (the key difference
 * from the global `hasMemberAccess`).
 */
export function hasPremiumCourseAccess(memberOrPayload: unknown): boolean {
  return getActivePlanIds(memberOrPayload).some((id) => premiumPlanIds.has(id));
}

/**
 * Individual course purchase entitlement for non-Premium members.
 * No entitlement lookup exists yet — always false. Hook future purchase
 * records here so catalog locks and CourseAccessGate stay aligned.
 */
export function hasIndividualCoursePurchase(
  _courseSlug: string | null | undefined,
  _memberOrPayload: unknown,
): boolean {
  return false;
}

/** Whether the given course access level unlocks content for this viewer. */
export function canAccessCourse(
  access: CourseAccessLevel,
  memberOrPayload: unknown,
  options?: { courseSlug?: string | null },
): boolean {
  if (access === "free") return true;
  if (hasPremiumCourseAccess(memberOrPayload)) return true;
  if (access === "premium") return false;
  // "purchase": Premium already returned true above; otherwise require entitlement.
  return hasIndividualCoursePurchase(options?.courseSlug, memberOrPayload);
}

/** Resolve the viewer's state for a course, for choosing CTAs / gate copy. */
export function getCourseViewerState(
  access: CourseAccessLevel,
  memberOrPayload: unknown,
  options?: { courseSlug?: string | null },
): CourseViewerState {
  if (canAccessCourse(access, memberOrPayload, options)) return "open";

  if (access === "purchase") {
    return isMemberLoggedIn(memberOrPayload) ? "needsPurchase" : "loggedOut";
  }

  // premium (and unknown fallbacks treated as premium-gated)
  return isMemberLoggedIn(memberOrPayload) ? "needsPremium" : "loggedOut";
}
