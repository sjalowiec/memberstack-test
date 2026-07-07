/**
 * Course access � Premium-tier gating for courses.
 *
 * Courses use a NARROWER allow list than the global member gate. The global
 * `hasMemberAccess` (in `memberAccess.ts`) grants access to Basic, Premium,
 * Beta, and legacy members. Courses key off the PREMIUM subset only:
 *
 *   - "free"     ? open to everyone (no login required).
 *   - "premium"  ? Beta or Premium plans only (`PREMIUM_PLAN_IDS`). Basic and
 *                  legacy plans do NOT unlock premium courses.
 *   - "purchase" ? reserved for individually purchased courses (later phase).
 *                  There is no entitlement lookup, checkout, or webhook yet, so
 *                  a purchase course is treated as locked with a "buy soon"
 *                  placeholder for now.
 *
 * Beta counts as Premium (both live in `PREMIUM_PLAN_IDS`). This helper reuses
 * the global Memberstack payload parsing (`getActivePlanIds`, `isMemberLoggedIn`)
 * so course gating stays consistent with every other gated section.
 */
import { PREMIUM_PLAN_IDS } from "../config/memberships";
import { getActivePlanIds, isMemberLoggedIn } from "./memberAccess";

export type CourseAccessLevel = "free" | "premium" | "purchase";

/**
 * Resolved viewer state for a course, used to pick CTAs / gate copy:
 *   - "open"          ? render content (free course, or member with premium)
 *   - "loggedOut"     ? premium course, not logged in ? prompt login/join
 *   - "needsPremium"  ? premium course, logged in but no premium plan ? join
 *   - "needsPurchase" ? purchase course (reserved) ? "buy soon" placeholder
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
 * True when the member holds an active Beta or Premium plan. Basic and legacy
 * plans do NOT grant premium course access (this is the key difference from the
 * global `hasMemberAccess`).
 */
export function hasPremiumCourseAccess(memberOrPayload: unknown): boolean {
  return getActivePlanIds(memberOrPayload).some((id) => premiumPlanIds.has(id));
}

/** Whether the given course access level unlocks content for this viewer. */
export function canAccessCourse(
  access: CourseAccessLevel,
  memberOrPayload: unknown,
): boolean {
  if (access === "free") return true;
  if (access === "premium") return hasPremiumCourseAccess(memberOrPayload);
  // "purchase": reserved � no entitlement system yet, so always locked.
  return false;
}

/** Resolve the viewer's state for a course, for choosing CTAs / gate copy. */
export function getCourseViewerState(
  access: CourseAccessLevel,
  memberOrPayload: unknown,
): CourseViewerState {
  if (access === "free") return "open";

  if (access === "premium") {
    if (hasPremiumCourseAccess(memberOrPayload)) return "open";
    return isMemberLoggedIn(memberOrPayload) ? "needsPremium" : "loggedOut";
  }

  // "purchase": always locked for now; login state cannot change the outcome.
  return "needsPurchase";
}
