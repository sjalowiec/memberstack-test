import { describe, expect, it } from "vitest";
import { LEGACY_MEMBERSHIPS, MEMBERSHIPS } from "../config/memberships";
import {
  canAccessCourse,
  getCourseViewerState,
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
    expect(normalizeCourseAccessLevel(" Premium ")).toBe("premium");
    expect(normalizeCourseAccessLevel("PURCHASE")).toBe("purchase");
  });

  it("falls back to premium (locked) for unknown/absent values", () => {
    expect(normalizeCourseAccessLevel(undefined)).toBe("premium");
    expect(normalizeCourseAccessLevel("")).toBe("premium");
    expect(normalizeCourseAccessLevel("member")).toBe("premium");
    expect(normalizeCourseAccessLevel(42)).toBe("premium");
  });

  it("honors an explicit fallback", () => {
    expect(normalizeCourseAccessLevel(undefined, "free")).toBe("free");
  });
});

describe("isCourseAccessLevel", () => {
  it("recognizes valid levels only", () => {
    expect(isCourseAccessLevel("free")).toBe(true);
    expect(isCourseAccessLevel("premium")).toBe(true);
    expect(isCourseAccessLevel("purchase")).toBe(true);
    expect(isCourseAccessLevel("member")).toBe(false);
    expect(isCourseAccessLevel(null)).toBe(false);
  });
});

describe("hasPremiumCourseAccess", () => {
  it("is true for active Premium plan", () => {
    expect(hasPremiumCourseAccess(payloadWithPlan(MEMBERSHIPS.premium.memberstackPlanId))).toBe(
      true,
    );
  });

  it("treats Beta as Premium", () => {
    expect(hasPremiumCourseAccess(payloadWithPlan(MEMBERSHIPS.beta.memberstackPlanId))).toBe(true);
  });

  it("is false for Basic (Basic must NOT unlock premium courses)", () => {
    expect(hasPremiumCourseAccess(payloadWithPlan(MEMBERSHIPS.basic.memberstackPlanId))).toBe(
      false,
    );
  });

  it("is true for legacy Premium plans", () => {
    expect(
      hasPremiumCourseAccess(payloadWithPlan(LEGACY_MEMBERSHIPS.monthlyPremium.memberstackPlanId)),
    ).toBe(true);
    expect(
      hasPremiumCourseAccess(
        payloadWithPlan(LEGACY_MEMBERSHIPS.monthlySubscription.memberstackPlanId),
      ),
    ).toBe(true);
  });

  it("is false for legacy Basic plans", () => {
    expect(
      hasPremiumCourseAccess(payloadWithPlan(LEGACY_MEMBERSHIPS.monthlyBasic.memberstackPlanId)),
    ).toBe(false);
    expect(
      hasPremiumCourseAccess(payloadWithPlan(LEGACY_MEMBERSHIPS.annualBasic.memberstackPlanId)),
    ).toBe(false);
  });

  it("is false for a canceled premium plan", () => {
    expect(
      hasPremiumCourseAccess({
        data: {
          planConnections: [
            { planId: MEMBERSHIPS.premium.memberstackPlanId, status: "CANCELED" },
          ],
        },
      }),
    ).toBe(false);
  });

  it("is false for logged-out / empty payloads", () => {
    expect(hasPremiumCourseAccess(loggedOut)).toBe(false);
    expect(hasPremiumCourseAccess(loggedInNoPlan)).toBe(false);
  });
});

describe("canAccessCourse", () => {
  it("free courses are open to everyone", () => {
    expect(canAccessCourse("free", loggedOut)).toBe(true);
    expect(canAccessCourse("free", loggedInNoPlan)).toBe(true);
    expect(canAccessCourse("free", payloadWithPlan(MEMBERSHIPS.basic.memberstackPlanId))).toBe(
      true,
    );
  });

  it("premium courses unlock for Beta/Premium/legacy Premium only", () => {
    expect(canAccessCourse("premium", payloadWithPlan(MEMBERSHIPS.premium.memberstackPlanId))).toBe(
      true,
    );
    expect(canAccessCourse("premium", payloadWithPlan(MEMBERSHIPS.beta.memberstackPlanId))).toBe(
      true,
    );
    expect(
      canAccessCourse(
        "premium",
        payloadWithPlan(LEGACY_MEMBERSHIPS.monthlySubscription.memberstackPlanId),
      ),
    ).toBe(true);
    expect(canAccessCourse("premium", payloadWithPlan(MEMBERSHIPS.basic.memberstackPlanId))).toBe(
      false,
    );
    expect(
      canAccessCourse("premium", payloadWithPlan(LEGACY_MEMBERSHIPS.monthlyBasic.memberstackPlanId)),
    ).toBe(false);
    expect(canAccessCourse("premium", loggedOut)).toBe(false);
  });

  it("purchase courses are always locked for now (no entitlement system)", () => {
    expect(canAccessCourse("purchase", payloadWithPlan(MEMBERSHIPS.premium.memberstackPlanId))).toBe(
      false,
    );
    expect(canAccessCourse("purchase", loggedOut)).toBe(false);
  });
});

describe("getCourseViewerState", () => {
  it("free ? open regardless of login", () => {
    expect(getCourseViewerState("free", loggedOut)).toBe("open");
    expect(getCourseViewerState("free", payloadWithPlan(MEMBERSHIPS.basic.memberstackPlanId))).toBe(
      "open",
    );
  });

  it("premium ? open for Beta/Premium", () => {
    expect(
      getCourseViewerState("premium", payloadWithPlan(MEMBERSHIPS.premium.memberstackPlanId)),
    ).toBe("open");
    expect(
      getCourseViewerState("premium", payloadWithPlan(MEMBERSHIPS.beta.memberstackPlanId)),
    ).toBe("open");
  });

  it("premium ? loggedOut when signed out", () => {
    expect(getCourseViewerState("premium", loggedOut)).toBe("loggedOut");
  });

  it("premium ? needsPremium for logged-in Basic member", () => {
    expect(
      getCourseViewerState("premium", payloadWithPlan(MEMBERSHIPS.basic.memberstackPlanId)),
    ).toBe("needsPremium");
    expect(getCourseViewerState("premium", loggedInNoPlan)).toBe("needsPremium");
  });

  it("purchase ? needsPurchase regardless of login/plan", () => {
    expect(getCourseViewerState("purchase", loggedOut)).toBe("needsPurchase");
    expect(
      getCourseViewerState("purchase", payloadWithPlan(MEMBERSHIPS.premium.memberstackPlanId)),
    ).toBe("needsPurchase");
  });
});
