import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  KIN_TAITEXMA_160_COURSE_SLUG,
  LEGACY_SK840_COURSE_PLAN_ID,
  LEGACY_SK840_COURSE_SLUG,
  LEGACY_TH160_COURSE_PLAN_ID,
  PAID_SK840_COURSE_PLAN_ID,
  PAID_TH160_COURSE_PLAN_ID,
  SK840_COURSE_PRICE_ID,
  TH160_COURSE_PRICE_ID,
} from "../../config/legacyCourseEntitlements";
import { MEMBERSHIPS } from "../../config/memberships";
import {
  courseCheckoutPriceId,
  shouldShowCoursePurchaseCta,
  shouldShowCoursePurchaseCtaForViewer,
} from "./coursePurchase";

function payloadWithPlan(planId: string) {
  return {
    data: {
      id: "ms_member",
      auth: { email: "member@knititnow.com" },
      planConnections: [{ planId, status: "ACTIVE" }],
    },
  };
}

const loggedOut = null;
const loggedInNoPlan = {
  data: { id: "ms_nosub", auth: { email: "nosub@knititnow.com" }, planConnections: [] },
};

describe("course checkout Price IDs", () => {
  it("assigns the TH160 Price ID to Course 86 and the SK840 Price ID to Course 111", () => {
    expect(courseCheckoutPriceId(KIN_TAITEXMA_160_COURSE_SLUG)).toBe(TH160_COURSE_PRICE_ID);
    expect(courseCheckoutPriceId("86")).toBe(TH160_COURSE_PRICE_ID);
    expect(courseCheckoutPriceId(LEGACY_SK840_COURSE_SLUG)).toBe(SK840_COURSE_PRICE_ID);
    expect(courseCheckoutPriceId("111")).toBe(SK840_COURSE_PRICE_ID);
    expect(courseCheckoutPriceId(KIN_TAITEXMA_160_COURSE_SLUG)).toBe("prc_course-th160-fe1ou0u3q");
    expect(courseCheckoutPriceId(LEGACY_SK840_COURSE_SLUG)).toBe("prc_course-sk840-hn300ud");
  });

  it("does not return a Plan ID for checkout", () => {
    expect(courseCheckoutPriceId(KIN_TAITEXMA_160_COURSE_SLUG)).not.toBe(PAID_TH160_COURSE_PLAN_ID);
    expect(courseCheckoutPriceId(LEGACY_SK840_COURSE_SLUG)).not.toBe(PAID_SK840_COURSE_PLAN_ID);
    expect(courseCheckoutPriceId(LEGACY_SK840_COURSE_SLUG)).not.toBe(LEGACY_SK840_COURSE_PLAN_ID);
    expect(courseCheckoutPriceId("ribber-basic-bootcamp")).toBeNull();
  });
});

describe("course purchase CTA visibility", () => {
  it("offers purchase to logged-out visitors and logged-in nonmembers", () => {
    expect(
      shouldShowCoursePurchaseCtaForViewer({
        access: "purchase",
        memberOrPayload: loggedOut,
        courseSlug: KIN_TAITEXMA_160_COURSE_SLUG,
      }),
    ).toBe(true);
    expect(
      shouldShowCoursePurchaseCtaForViewer({
        access: "purchase",
        memberOrPayload: loggedInNoPlan,
        courseSlug: LEGACY_SK840_COURSE_SLUG,
      }),
    ).toBe(true);
  });

  it("hides the purchase button when the viewer already has access", () => {
    const member = payloadWithPlan(MEMBERSHIPS.membership.memberstackPlanId);
    const th160Legacy = payloadWithPlan(LEGACY_TH160_COURSE_PLAN_ID);
    const th160Paid = payloadWithPlan(PAID_TH160_COURSE_PLAN_ID);
    const sk840Legacy = payloadWithPlan(LEGACY_SK840_COURSE_PLAN_ID);
    const sk840Paid = payloadWithPlan(PAID_SK840_COURSE_PLAN_ID);

    for (const viewer of [member, th160Legacy, th160Paid]) {
      expect(
        shouldShowCoursePurchaseCtaForViewer({
          access: "purchase",
          memberOrPayload: viewer,
          courseSlug: KIN_TAITEXMA_160_COURSE_SLUG,
        }),
      ).toBe(false);
    }
    for (const viewer of [member, sk840Legacy, sk840Paid]) {
      expect(
        shouldShowCoursePurchaseCtaForViewer({
          access: "purchase",
          memberOrPayload: viewer,
          courseSlug: LEGACY_SK840_COURSE_SLUG,
        }),
      ).toBe(false);
    }
    expect(
      shouldShowCoursePurchaseCta({
        courseSlug: KIN_TAITEXMA_160_COURSE_SLUG,
        hasAccess: true,
      }),
    ).toBe(false);
  });

  it("keeps TH160 and SK840 purchase options independent", () => {
    const th160Paid = payloadWithPlan(PAID_TH160_COURSE_PLAN_ID);
    const sk840Paid = payloadWithPlan(PAID_SK840_COURSE_PLAN_ID);
    expect(
      shouldShowCoursePurchaseCtaForViewer({
        access: "purchase",
        memberOrPayload: th160Paid,
        courseSlug: LEGACY_SK840_COURSE_SLUG,
      }),
    ).toBe(true);
    expect(
      shouldShowCoursePurchaseCtaForViewer({
        access: "purchase",
        memberOrPayload: sk840Paid,
        courseSlug: KIN_TAITEXMA_160_COURSE_SLUG,
      }),
    ).toBe(true);
  });
});

describe("course purchase UI wiring", () => {
  it("renders checkout Price IDs on the purchase button and hides the CTA after access", () => {
    const button = readFileSync(resolve("src/components/courses/CoursePurchaseButton.astro"), "utf8");
    const layout = readFileSync(resolve("src/layouts/KinCourseLayout.astro"), "utf8");
    const gate = readFileSync(resolve("src/components/courses/CourseAccessGate.astro"), "utf8");
    const gateScript = readFileSync(resolve("src/scripts/courseAccessGate.ts"), "utf8");
    const kinGate = readFileSync(resolve("src/scripts/kinCourseAccessGate.ts"), "utf8");

    expect(button).toContain("data-course-price-id={priceId}");
    expect(button).toContain("courseCheckoutPriceId");
    expect(button).not.toContain("data-ms-plan");
    expect(layout).toContain("CoursePurchaseButton");
    expect(layout).toContain("data-course-access={courseAccess}");
    expect(layout).not.toContain('data-course-access="member"');
    expect(gate).toContain("CoursePurchaseButton");
    expect(button).toContain("Purchase this course");
    expect(gateScript).toContain("btn.hidden = unlocked");
    expect(kinGate).toContain('btn.hidden = paint === "open"');
  });

  it("keeps the confirmed SK840 Paid Plan ID with two hyphens", () => {
    expect(PAID_SK840_COURSE_PLAN_ID).toBe("pln_course-sk840--xy1u30uqt");
  });
});
