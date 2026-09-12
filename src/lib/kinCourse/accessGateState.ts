/**
 * Shared KIN player access-gate decisions.
 *
 * Unresolved Memberstack is never a denial: keep the lesson hidden (fail-closed)
 * and do not show the unauthorized card until the SDK has finished loading.
 */
import { LEGACY_SK840_COURSE_SLUG } from "../../config/legacyCourseEntitlements";
import { canAccessCourse } from "../courseAccess";
import { isMemberLoggedIn } from "../memberAccess";
import {
  memberIdFromMemberstackPayload,
  memberRecordFromMemberstackPayload,
} from "../patterns/memberstackMember";

export const KIN_TAITEXMA_160_COURSE_SLUG = "taitexma-th-tr-160-getting-started" as const;

export const KIN_COURSE_ACCESS_SESSION_KEY = "kin-course-access-v1";

export type KinCourseGatePaint = "pending" | "open" | "locked";

export type KinCourseConfirmedAccess = {
  memberId: string;
  unlocked: boolean;
};

export type KinCourseAccessSession = Record<string, KinCourseConfirmedAccess>;

export function kinCourseNoAccessPlanPhrase(courseSlug: string): string {
  const slug = courseSlug.trim();
  if (slug === KIN_TAITEXMA_160_COURSE_SLUG || slug === "86") {
    return "the Taitexma TH/TR-160 course";
  }
  return "the SK840 course plan";
}

export function kinCourseNoAccessMessage(courseSlug: string): string {
  return `You are signed in, but this course needs an active Knit It Now membership or ${kinCourseNoAccessPlanPhrase(courseSlug)}.`;
}

/** Paint the denial card only after Memberstack finished loading. */
export function kinCourseGatePaint(args: {
  memberstackReady: boolean;
  unlocked: boolean;
}): KinCourseGatePaint {
  if (!args.memberstackReady) return "pending";
  return args.unlocked ? "open" : "locked";
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

/** `undefined` means plan connections have not loaded yet. */
export function memberstackPlanConnections(memberOrPayload: unknown): unknown[] | undefined {
  if (memberOrPayload == null) return undefined;
  const member = memberRecordFromMemberstackPayload(memberOrPayload);
  const root = asRecord(memberOrPayload);
  const data = asRecord(root.data ?? root);
  const connections = member?.planConnections ?? data.planConnections;
  return Array.isArray(connections) ? connections : undefined;
}

/**
 * True when Memberstack returned a finished auth/plan payload.
 * A logged-in member without `planConnections` is still loading.
 */
export function isKinCourseMemberstackResolved(payload: unknown): boolean {
  if (payload == null) return false;
  if (!isMemberLoggedIn(payload)) return true;
  return memberstackPlanConnections(payload) !== undefined;
}

export function memberIdForKinCourseAccess(memberOrPayload: unknown): string {
  const fromPayload = memberIdFromMemberstackPayload(memberOrPayload);
  if (fromPayload) return fromPayload;
  const member = memberRecordFromMemberstackPayload(memberOrPayload);
  const id = member?.id ?? member?._id;
  return typeof id === "string" ? id.trim() : "";
}

export function parseKinCourseAccessSession(raw: string | null | undefined): KinCourseAccessSession {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const session: KinCourseAccessSession = {};
    for (const [slug, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (!slug || !value || typeof value !== "object" || Array.isArray(value)) continue;
      const record = value as Record<string, unknown>;
      const memberId = typeof record.memberId === "string" ? record.memberId.trim() : "";
      if (!memberId || typeof record.unlocked !== "boolean") continue;
      session[slug] = { memberId, unlocked: record.unlocked };
    }
    return session;
  } catch {
    return {};
  }
}

export function readConfirmedKinCourseAccess(
  raw: string | null | undefined,
  courseSlug: string,
): KinCourseConfirmedAccess | null {
  const slug = courseSlug.trim();
  if (!slug) return null;
  return parseKinCourseAccessSession(raw)[slug] ?? null;
}

export function writeConfirmedKinCourseAccess(
  raw: string | null | undefined,
  courseSlug: string,
  entry: KinCourseConfirmedAccess,
): string {
  const session = parseKinCourseAccessSession(raw);
  session[courseSlug.trim()] = entry;
  return JSON.stringify(session);
}

export function clearConfirmedKinCourseAccessSlug(
  raw: string | null | undefined,
  courseSlug: string,
): string {
  const session = parseKinCourseAccessSession(raw);
  delete session[courseSlug.trim()];
  return JSON.stringify(session);
}

/**
 * Reuse a confirmed result during lesson navigation when the same member is
 * still in this tab. Never reuse another member's grant.
 */
export function kinCoursePaintFromConfirmedSession(args: {
  memberId: string;
  session: KinCourseConfirmedAccess | null;
}): KinCourseGatePaint | "unknown" {
  const { session, memberId } = args;
  if (!session) return "unknown";
  if (!memberId || session.memberId !== memberId) return "unknown";
  return session.unlocked ? "open" : "locked";
}

/**
 * Cache/session pre-paint. Paid/course-plan cache may open immediately.
 * Logged-in-without-plans is unresolved, not denied. Confirmed session state
 * may be reused for the same member.
 */
export function kinCoursePrePaintUi(args: {
  memberOrPayload: unknown;
  courseSlug: string;
  sessionRaw?: string | null;
}): "open" | "locked" | "unknown" {
  const { memberOrPayload, courseSlug, sessionRaw } = args;
  if (isMemberLoggedIn(memberOrPayload) && canAccessCourse("member", memberOrPayload, { courseSlug })) {
    return "open";
  }

  const memberId = memberIdForKinCourseAccess(memberOrPayload);
  const session = readConfirmedKinCourseAccess(sessionRaw, courseSlug);
  const fromSession = kinCoursePaintFromConfirmedSession({ memberId, session });
  if (fromSession === "open" || fromSession === "locked") return fromSession;

  return "unknown";
}

export function kinCoursePlayerSlugs(): { course86: string; course111: string } {
  return {
    course86: KIN_TAITEXMA_160_COURSE_SLUG,
    course111: LEGACY_SK840_COURSE_SLUG,
  };
}
