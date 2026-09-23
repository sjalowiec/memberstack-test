/**
 * Remember verified Home Study course ids from the authenticated member-access
 * response. The browser does not send a member id or course id as proof.
 * A failed lookup remembers an empty list.
 */
import { verifiedHomeStudyPlaybackCourse, homeStudyPlaybackHref } from "../config/homeStudyCourseMap";
import { isMemberLoggedIn } from "./memberAccess";
import { MEMBER_ACCESS_API_PATH } from "./memberAccessClient";
import { getMembershipStatusAuthHeaders } from "./membership/membershipStatusClient";
import {
  memberIdFromMemberstackPayload,
  memberRecordFromMemberstackPayload,
} from "./patterns/memberstackMember";

export type HomeStudyAccountCourse = {
  courseId: number;
  title: string;
  href: string | null;
  availability: "available" | "not_on_site";
};

type RememberedHomeStudyPurchases = {
  memberId: string;
  courseIds: number[];
  accountCourses: HomeStudyAccountCourse[];
};

let remembered: RememberedHomeStudyPurchases | null = null;
const inFlightByMemberId = new Map<string, Promise<void>>();

function memberIdForPurchaseContext(memberOrPayload: unknown): string {
  const fromPayload = memberIdFromMemberstackPayload(memberOrPayload);
  if (fromPayload) return fromPayload;
  const member = memberRecordFromMemberstackPayload(memberOrPayload);
  const id = member?.id ?? member?._id;
  return typeof id === "string" ? id.trim() : "";
}

export function clearRememberedHomeStudyPurchases(): void {
  remembered = null;
}

export function verifiedHomeStudyCourseIdsForAccess(memberOrPayload: unknown): number[] {
  return rememberedVerifiedHomeStudyCourseIds(memberIdForPurchaseContext(memberOrPayload));
}

export function rememberedVerifiedHomeStudyCourseIds(
  memberId: string | null | undefined,
): number[] {
  if (!memberId || !remembered || remembered.memberId !== memberId) return [];
  return remembered.courseIds;
}

export function rememberedHomeStudyAccountCoursesForMember(
  memberOrPayload: unknown,
): HomeStudyAccountCourse[] {
  return rememberedHomeStudyAccountCourses(memberIdForPurchaseContext(memberOrPayload));
}

export function rememberedHomeStudyAccountCourses(
  memberId: string | null | undefined,
): HomeStudyAccountCourse[] {
  if (!memberId || !remembered || remembered.memberId !== memberId) return [];
  return remembered.accountCourses;
}

function positiveCourseId(value: unknown): number | null {
  const id = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(id) || id <= 0) return null;
  return id;
}

/** Keep a link only when it is the mapped player for that course id. */
export function sanitizeHomeStudyAccountCourses(value: unknown): HomeStudyAccountCourse[] {
  if (!Array.isArray(value)) return [];
  const courses: HomeStudyAccountCourse[] = [];
  for (const row of value) {
    if (!row || typeof row !== "object") continue;
    const record = row as Record<string, unknown>;
    const courseId = positiveCourseId(record.courseId);
    if (!courseId) continue;
    const playback = verifiedHomeStudyPlaybackCourse(courseId);
    const href = homeStudyPlaybackHref(courseId);
    if (record.availability === "available" && playback && href) {
      const title =
        typeof record.title === "string" && record.title.trim()
          ? record.title.trim()
          : `Home Study course ${courseId}`;
      courses.push({ courseId, title, href, availability: "available" });
      continue;
    }
    courses.push({
      courseId,
      title: `Home Study course ${courseId}`,
      href: null,
      availability: "not_on_site",
    });
  }
  return courses;
}

function sanitizeCourseIds(value: unknown, accountCourses: HomeStudyAccountCourse[]): number[] {
  const fromBody = Array.isArray(value)
    ? value.map(positiveCourseId).filter((id): id is number => id != null)
    : [];
  const allowed = new Set(
    accountCourses
      .filter((course) => course.availability === "available")
      .map((course) => course.courseId),
  );
  return fromBody.filter((id) => (allowed.size > 0 ? allowed.has(id) : Boolean(verifiedHomeStudyPlaybackCourse(id))));
}

export async function fetchHomeStudyPurchaseContext(): Promise<Omit<
  RememberedHomeStudyPurchases,
  "memberId"
> | null> {
  if (typeof window === "undefined") return null;
  const headers = await getMembershipStatusAuthHeaders();
  if (!headers.Authorization) return null;

  const res = await fetch(MEMBER_ACCESS_API_PATH, {
    method: "GET",
    headers,
    credentials: "same-origin",
  });
  if (!res.ok) return null;

  let body: Record<string, unknown> | null = null;
  try {
    body = (await res.json()) as Record<string, unknown>;
  } catch {
    return null;
  }
  if (!body || body.ok === false) return null;

  const accountCourses = sanitizeHomeStudyAccountCourses(body.homeStudyAccountCourses);
  return {
    courseIds: sanitizeCourseIds(body.verifiedHomeStudyCourseIds, accountCourses),
    accountCourses,
  };
}

export async function ensureHomeStudyPurchaseContext(
  memberOrPayload: unknown,
  deps: {
    fetchPurchases?: () => Promise<Omit<RememberedHomeStudyPurchases, "memberId"> | null>;
  } = {},
): Promise<void> {
  if (!isMemberLoggedIn(memberOrPayload)) {
    clearRememberedHomeStudyPurchases();
    return;
  }
  const memberId = memberIdForPurchaseContext(memberOrPayload);
  if (!memberId) return;
  if (remembered?.memberId === memberId) return;

  const existing = inFlightByMemberId.get(memberId);
  if (existing) {
    await existing;
    return;
  }

  const work = (async () => {
    try {
      const load = deps.fetchPurchases ?? fetchHomeStudyPurchaseContext;
      const loaded = await load();
      if (loaded) {
        remembered = {
          memberId,
          courseIds: loaded.courseIds,
          accountCourses: loaded.accountCourses,
        };
      }
    } catch {
      // Leave the cache empty so a later lesson navigation can retry.
    } finally {
      inFlightByMemberId.delete(memberId);
    }
  })();

  inFlightByMemberId.set(memberId, work);
  await work;
}
