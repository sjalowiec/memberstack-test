import { describe, expect, it } from "vitest";
import { canAccessCourse } from "../courseAccess";
import {
  LEGACY_SK840_COURSE_PLAN_ID,
  LEGACY_SK840_COURSE_SLUG,
} from "../../config/legacyCourseEntitlements";
import { MEMBERSHIPS } from "../../config/memberships";
import {
  KIN_TAITEXMA_160_COURSE_SLUG,
  isKinCourseMemberstackResolved,
  kinCourseGatePaint,
  kinCourseNoAccessMessage,
  kinCoursePaintFromConfirmedSession,
  kinCoursePlayerSlugs,
  kinCoursePrePaintUi,
  writeConfirmedKinCourseAccess,
} from "./accessGateState";

function payloadWithPlan(planId: string) {
  return {
    data: {
      id: "ms_member",
      auth: { email: "member@knititnow.com" },
      planConnections: [{ planId, status: "ACTIVE" }],
    },
  };
}

const loggedOutPayload = { data: { member: null } };
const loggedInLoading = {
  data: { id: "ms_member", auth: { email: "member@knititnow.com" } },
};
const loggedInNoPlan = {
  data: { id: "ms_nosub", auth: { email: "nosub@knititnow.com" }, planConnections: [] },
};

const slugs = kinCoursePlayerSlugs();
const member = payloadWithPlan(MEMBERSHIPS.membership.memberstackPlanId);
const sk840Only = payloadWithPlan(LEGACY_SK840_COURSE_PLAN_ID);

describe("KIN course gate copy", () => {
  it("uses Taitexma copy for Course 86 and SK840 copy for Course 111", () => {
    expect(slugs.course86).toBe(KIN_TAITEXMA_160_COURSE_SLUG);
    expect(slugs.course111).toBe(LEGACY_SK840_COURSE_SLUG);
    expect(kinCourseNoAccessMessage(slugs.course86)).toContain("Taitexma TH/TR-160 course");
    expect(kinCourseNoAccessMessage(slugs.course86)).not.toContain("SK840 course plan");
    expect(kinCourseNoAccessMessage(slugs.course111)).toContain("SK840 course plan");
    expect(kinCourseNoAccessMessage(slugs.course111)).not.toContain("Taitexma");
  });
});

describe("KIN course gate loading / authorized / denied", () => {
  it("stays pending while Memberstack is unresolved for Course 86 and Course 111", () => {
    for (const slug of [slugs.course86, slugs.course111]) {
      expect(kinCourseGatePaint({ memberstackReady: false, unlocked: false })).toBe("pending");
      expect(isKinCourseMemberstackResolved(null)).toBe(false);
      expect(isKinCourseMemberstackResolved(loggedInLoading)).toBe(false);
      expect(kinCoursePrePaintUi({ memberOrPayload: loggedInLoading, courseSlug: slug })).toBe(
        "unknown",
      );
      expect(canAccessCourse("member", loggedInLoading, { courseSlug: slug })).toBe(false);
    }
  });

  it("does not treat a resolved logged-out payload as still loading", () => {
    expect(isKinCourseMemberstackResolved(loggedOutPayload)).toBe(true);
    expect(kinCourseGatePaint({ memberstackReady: true, unlocked: false })).toBe("locked");
  });

  it("opens authorized members for Course 86 and Course 111 without a denial paint", () => {
    for (const slug of [slugs.course86, slugs.course111]) {
      expect(canAccessCourse("member", member, { courseSlug: slug })).toBe(true);
      expect(kinCourseGatePaint({ memberstackReady: true, unlocked: true })).toBe("open");
      expect(kinCoursePrePaintUi({ memberOrPayload: member, courseSlug: slug })).toBe("open");
    }
  });

  it("denies only after Memberstack is ready, with course-specific entitlements", () => {
    expect(canAccessCourse("member", loggedInNoPlan, { courseSlug: slugs.course86 })).toBe(false);
    expect(canAccessCourse("member", loggedInNoPlan, { courseSlug: slugs.course111 })).toBe(false);
    expect(canAccessCourse("member", sk840Only, { courseSlug: slugs.course111 })).toBe(true);
    expect(canAccessCourse("member", sk840Only, { courseSlug: slugs.course86 })).toBe(false);
    expect(kinCourseGatePaint({ memberstackReady: true, unlocked: false })).toBe("locked");
    expect(kinCoursePrePaintUi({ memberOrPayload: loggedInNoPlan, courseSlug: slugs.course86 })).toBe(
      "unknown",
    );
    expect(kinCoursePrePaintUi({ memberOrPayload: loggedInNoPlan, courseSlug: slugs.course111 })).toBe(
      "unknown",
    );
  });

  it("reuses confirmed course-access during navigation for the same member", () => {
    const sessionRaw = writeConfirmedKinCourseAccess(null, slugs.course86, {
      memberId: "ms_member",
      unlocked: true,
    });
    expect(
      kinCoursePrePaintUi({
        memberOrPayload: loggedInLoading,
        courseSlug: slugs.course86,
        sessionRaw,
      }),
    ).toBe("open");
    expect(
      kinCoursePaintFromConfirmedSession({
        memberId: "ms_member",
        session: { memberId: "ms_member", unlocked: true },
      }),
    ).toBe("open");
    expect(
      kinCoursePaintFromConfirmedSession({
        memberId: "ms_other",
        session: { memberId: "ms_member", unlocked: true },
      }),
    ).toBe("unknown");
    expect(
      kinCoursePrePaintUi({
        memberOrPayload: loggedInNoPlan,
        courseSlug: slugs.course86,
        sessionRaw: writeConfirmedKinCourseAccess(null, slugs.course86, {
          memberId: "ms_nosub",
          unlocked: false,
        }),
      }),
    ).toBe("locked");
  });
});
