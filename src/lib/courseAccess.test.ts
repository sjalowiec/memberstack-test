import { describe, expect, it } from "vitest";
import {
  LEGACY_SK840_COURSE_PLAN_ID,
  LEGACY_SK840_COURSE_SLUG,
} from "../config/legacyCourseEntitlements";
import {
  COURSE_ACCESS_PLAN_IDS,
  LEGACY_MEMBERSHIPS,
  MEMBER_PLAN_IDS,
  MEMBERSHIPS,
  REMOVED_BASIC_MEMBERSHIP_PLAN_ID,
} from "../config/memberships";
import {
  canAccessCourse,
  getCourseViewerState,
  hasCourseMembershipAccess,
  hasIndividualCoursePurchase,
  hasPremiumCourseAccess,
  isCourseAccessLevel,
  normalizeCourseAccessLevel,
} from "./courseAccess";

function payloadWithPlan(planId: string, extra: Record<string, unknown> = {}) {
  return {
    data: {
      id: "ms_member",
      auth: { email: "member@knititnow.com" },
      planConnections: [{ planId, status: "ACTIVE" }],
      ...extra,
    },
  };
}

const loggedOut = null;
const loggedInNoPlan = {
  data: { id: "ms_nosub", auth: { email: "nosub@knititnow.com" }, planConnections: [] },
};

describe("normalizeCourseAccessLevel", () => {
  it("accepts the three known levels (case/space insensitive)", () => {
    expect(normalizeCourseAccessLevel("free")).toBe("free");
    expect(normalizeCourseAccessLevel(" Member ")).toBe("member");
    expect(normalizeCourseAccessLevel("PURCHASE")).toBe("purchase");
  });

  it("maps legacy premium catalog value to member", () => {
    expect(normalizeCourseAccessLevel("premium")).toBe("member");
    expect(normalizeCourseAccessLevel(" Premium ")).toBe("member");
  });

  it("falls back to member (locked) for unknown/absent values", () => {
    expect(normalizeCourseAccessLevel(undefined)).toBe("member");
    expect(normalizeCourseAccessLevel("")).toBe("member");
    expect(normalizeCourseAccessLevel(42)).toBe("member");
  });

  it("honors an explicit fallback", () => {
    expect(normalizeCourseAccessLevel(undefined, "free")).toBe("free");
  });
});

describe("isCourseAccessLevel", () => {
  it("recognizes valid levels only", () => {
    expect(isCourseAccessLevel("free")).toBe(true);
    expect(isCourseAccessLevel("member")).toBe(true);
    expect(isCourseAccessLevel("purchase")).toBe(true);
    expect(isCourseAccessLevel("premium")).toBe(false);
    expect(isCourseAccessLevel(null)).toBe(false);
  });
});

describe("hasCourseMembershipAccess", () => {
  it("is true for active membership plan", () => {
    expect(
      hasCourseMembershipAccess(payloadWithPlan(MEMBERSHIPS.membership.memberstackPlanId)),
    ).toBe(true);
  });

  it("does not treat retired Beta as member course access", () => {
    expect(hasCourseMembershipAccess(payloadWithPlan(MEMBERSHIPS.beta.memberstackPlanId))).toBe(
      false,
    );
  });

  it("is true for remaining legacy Basic paid shells (monthly Basic unlocks courses)", () => {
    expect(
      hasCourseMembershipAccess(payloadWithPlan(LEGACY_MEMBERSHIPS.monthlyBasic.memberstackPlanId)),
    ).toBe(true);
  });

  it("is false for the removed annual Basic plan", () => {
    expect(
      hasCourseMembershipAccess(payloadWithPlan(REMOVED_BASIC_MEMBERSHIP_PLAN_ID)),
    ).toBe(false);
  });

  it("is true for legacy Premium / monthly subscription shells", () => {
    expect(
      hasCourseMembershipAccess(payloadWithPlan(LEGACY_MEMBERSHIPS.monthlyPremium.memberstackPlanId)),
    ).toBe(true);
    expect(
      hasCourseMembershipAccess(
        payloadWithPlan(LEGACY_MEMBERSHIPS.monthlySubscription.memberstackPlanId),
      ),
    ).toBe(true);
  });

  it("is false for a canceled membership plan", () => {
    expect(
      hasCourseMembershipAccess({
        data: {
          planConnections: [
            { planId: MEMBERSHIPS.membership.memberstackPlanId, status: "CANCELED" },
          ],
        },
      }),
    ).toBe(false);
  });

  it("is false for logged-out / empty payloads", () => {
    expect(hasCourseMembershipAccess(loggedOut)).toBe(false);
    expect(hasCourseMembershipAccess(loggedInNoPlan)).toBe(false);
  });

  it("deprecated hasPremiumCourseAccess aliases hasCourseMembershipAccess", () => {
    const payload = payloadWithPlan(MEMBERSHIPS.membership.memberstackPlanId);
    expect(hasPremiumCourseAccess(payload)).toBe(hasCourseMembershipAccess(payload));
  });

  it("does not treat the legacy SK840 course plan as membership access", () => {
    expect(MEMBER_PLAN_IDS).not.toContain(LEGACY_SK840_COURSE_PLAN_ID);
    expect(COURSE_ACCESS_PLAN_IDS).not.toContain(LEGACY_SK840_COURSE_PLAN_ID);
    expect(hasCourseMembershipAccess(payloadWithPlan(LEGACY_SK840_COURSE_PLAN_ID))).toBe(
      false,
    );
  });
});

describe("canAccessCourse", () => {
  it("free courses are open to everyone", () => {
    expect(canAccessCourse("free", loggedOut)).toBe(true);
    expect(canAccessCourse("free", loggedInNoPlan)).toBe(true);
    expect(
      canAccessCourse("free", payloadWithPlan(LEGACY_MEMBERSHIPS.monthlyBasic.memberstackPlanId)),
    ).toBe(true);
  });

  it("member courses unlock for membership / legacy paid plans (not retired Beta)", () => {
    expect(
      canAccessCourse("member", payloadWithPlan(MEMBERSHIPS.membership.memberstackPlanId)),
    ).toBe(true);
    expect(canAccessCourse("member", payloadWithPlan(MEMBERSHIPS.beta.memberstackPlanId))).toBe(
      false,
    );
    expect(
      canAccessCourse(
        "member",
        payloadWithPlan(LEGACY_MEMBERSHIPS.monthlySubscription.memberstackPlanId),
      ),
    ).toBe(true);
    expect(
      canAccessCourse("member", payloadWithPlan(LEGACY_MEMBERSHIPS.monthlyBasic.memberstackPlanId)),
    ).toBe(true);
    expect(canAccessCourse("member", payloadWithPlan(REMOVED_BASIC_MEMBERSHIP_PLAN_ID))).toBe(
      false,
    );
    expect(canAccessCourse("member", loggedOut)).toBe(false);
    expect(canAccessCourse("member", loggedInNoPlan)).toBe(false);
  });

  it("purchase courses unlock for membership / legacy paid (not retired Beta)", () => {
    expect(
      canAccessCourse("purchase", payloadWithPlan(MEMBERSHIPS.membership.memberstackPlanId)),
    ).toBe(true);
    expect(canAccessCourse("purchase", payloadWithPlan(MEMBERSHIPS.beta.memberstackPlanId))).toBe(
      false,
    );
    expect(
      canAccessCourse(
        "purchase",
        payloadWithPlan(LEGACY_MEMBERSHIPS.monthlyPremium.memberstackPlanId),
      ),
    ).toBe(true);
  });

  it("purchase courses stay locked for logged-out and no-plan members", () => {
    expect(canAccessCourse("purchase", loggedOut)).toBe(false);
    expect(canAccessCourse("purchase", loggedInNoPlan)).toBe(false);
  });

  it("active KIN members still access member courses", () => {
    const member = payloadWithPlan(MEMBERSHIPS.membership.memberstackPlanId);
    expect(canAccessCourse("member", member, { courseSlug: LEGACY_SK840_COURSE_SLUG })).toBe(
      true,
    );
    expect(canAccessCourse("member", member, { courseSlug: "ribber-basic-bootcamp" })).toBe(
      true,
    );
    expect(canAccessCourse("member", member, { courseSlug: "lk-150-fun" })).toBe(true);
  });

  it("legacy SK840 plan holders access only the SK840 course", () => {
    const sk840Buyer = payloadWithPlan(LEGACY_SK840_COURSE_PLAN_ID);
    expect(
      canAccessCourse("member", sk840Buyer, { courseSlug: LEGACY_SK840_COURSE_SLUG }),
    ).toBe(true);
    expect(
      hasIndividualCoursePurchase(LEGACY_SK840_COURSE_SLUG, sk840Buyer),
    ).toBe(true);
  });

  it("legacy SK840 plan holders do not unlock unrelated member courses", () => {
    const sk840Buyer = payloadWithPlan(LEGACY_SK840_COURSE_PLAN_ID);
    expect(
      canAccessCourse("member", sk840Buyer, { courseSlug: "ribber-basic-bootcamp" }),
    ).toBe(false);
    expect(canAccessCourse("member", sk840Buyer, { courseSlug: "lk-150-fun" })).toBe(false);
    expect(canAccessCourse("member", sk840Buyer)).toBe(false);
    expect(hasIndividualCoursePurchase("ribber-basic-bootcamp", sk840Buyer)).toBe(false);
  });

  it("does not unlock SK840 from a canceled legacy course plan", () => {
    const canceled = {
      data: {
        id: "ms_member",
        planConnections: [{ planId: LEGACY_SK840_COURSE_PLAN_ID, status: "CANCELED" }],
      },
    };
    expect(
      canAccessCourse("member", canceled, { courseSlug: LEGACY_SK840_COURSE_SLUG }),
    ).toBe(false);
  });
});

describe("getCourseViewerState", () => {
  it("free → open regardless of login", () => {
    expect(getCourseViewerState("free", loggedOut)).toBe("open");
    expect(
      getCourseViewerState(
        "free",
        payloadWithPlan(LEGACY_MEMBERSHIPS.monthlyBasic.memberstackPlanId),
      ),
    ).toBe("open");
  });

  it("member → open for membership; retired Beta → needsMembership", () => {
    expect(
      getCourseViewerState("member", payloadWithPlan(MEMBERSHIPS.membership.memberstackPlanId)),
    ).toBe("open");
    expect(getCourseViewerState("member", payloadWithPlan(MEMBERSHIPS.beta.memberstackPlanId))).toBe(
      "needsMembership",
    );
  });

  it("member → loggedOut when signed out", () => {
    expect(getCourseViewerState("member", loggedOut)).toBe("loggedOut");
  });

  it("member → needsMembership for logged-in non-members", () => {
    expect(getCourseViewerState("member", loggedInNoPlan)).toBe("needsMembership");
  });

  it("purchase → open for membership; retired Beta → needsPurchase", () => {
    expect(
      getCourseViewerState("purchase", payloadWithPlan(MEMBERSHIPS.membership.memberstackPlanId)),
    ).toBe("open");
    expect(
      getCourseViewerState("purchase", payloadWithPlan(MEMBERSHIPS.beta.memberstackPlanId)),
    ).toBe("needsPurchase");
  });

  it("purchase → loggedOut when signed out", () => {
    expect(getCourseViewerState("purchase", loggedOut)).toBe("loggedOut");
  });

  it("purchase → needsPurchase for logged-in non-members", () => {
    expect(getCourseViewerState("purchase", loggedInNoPlan)).toBe("needsPurchase");
  });
});
