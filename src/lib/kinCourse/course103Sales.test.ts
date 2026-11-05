import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  BROTHER_930_940_COURSE_PRICE_ID,
  BROTHER_930_940_COURSE_SLUG,
  COURSE_INDIVIDUAL_SALES,
  KIN_TAITEXMA_160_COURSE_SLUG,
  LEGACY_BROTHER_930_940_COURSE_PLAN_ID,
  LEGACY_SK840_COURSE_SLUG,
  PAID_BROTHER_930_940_COURSE_PLAN_ID,
} from "../../config/legacyCourseEntitlements";
import { MEMBERSHIPS } from "../../config/memberships";
import { canAccessCourse } from "../courseAccess";
import {
  courseCheckoutPriceId,
  coursePurchasePriceLabel,
  isBrother930940CourseSlug,
  shouldShowCoursePurchaseCtaForViewer,
  shouldShowKinCourseSalesPage,
  shouldShowKinCourseSalesPageForViewer,
} from "./coursePurchase";
import { getKinCourseSalesCopy, KIN_BROTHER_930_940_SALES_COPY } from "./courseSalesCopy";

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

describe("Course 103 sales page and purchase button", () => {
  const layout = readFileSync(resolve("src/layouts/KinCourseLayout.astro"), "utf8");
  const button = readFileSync(resolve("src/components/courses/CoursePurchaseButton.astro"), "utf8");
  const sales = readFileSync(resolve("src/components/courses/KinCourseSales.astro"), "utf8");
  const wrapper = readFileSync(resolve("src/components/courses/KinCourse103Sales.astro"), "utf8");
  const copySource = readFileSync(resolve("src/lib/kinCourse/courseSalesCopy.ts"), "utf8");

  it("shows the sales page and purchase button when the viewer lacks access", () => {
    expect(isBrother930940CourseSlug("103")).toBe(true);
    expect(isBrother930940CourseSlug(BROTHER_930_940_COURSE_SLUG)).toBe(true);
    expect(shouldShowKinCourseSalesPage({ courseSlug: "103", hasAccess: false })).toBe(true);
    expect(
      shouldShowKinCourseSalesPageForViewer({
        access: "purchase",
        memberOrPayload: loggedOut,
        courseSlug: BROTHER_930_940_COURSE_SLUG,
      }),
    ).toBe(true);
    expect(
      shouldShowCoursePurchaseCtaForViewer({
        access: "purchase",
        memberOrPayload: loggedInNoPlan,
        courseSlug: "103",
      }),
    ).toBe(true);
    expect(getKinCourseSalesCopy("103")).toBe(KIN_BROTHER_930_940_SALES_COPY);
    expect(layout).toContain("KinCourse103Sales");
    expect(layout).toContain("showCourse103Sales");
    expect(wrapper).toContain("KIN_BROTHER_930_940_SALES_COPY");
    expect(wrapper).not.toContain("prc_");
    expect(button).toContain("data-course-price-id={priceId}");
    expect(button).toContain("courseCheckoutPriceId");
  });

  it("displays $65 from the configured price and checks out with the Price ID", () => {
    expect(COURSE_INDIVIDUAL_SALES.brother930940.priceLabel).toBe("$65");
    expect(COURSE_INDIVIDUAL_SALES.brother930940.priceId).toBe(BROTHER_930_940_COURSE_PRICE_ID);
    expect(COURSE_INDIVIDUAL_SALES.brother930940.priceId).toBe("prc_course-930-940-ap5j0fkk");
    expect(COURSE_INDIVIDUAL_SALES.brother930940.paidPlanId).toBe(
      "pln_course-930-940-ob5g0fwc",
    );
    expect(coursePurchasePriceLabel(BROTHER_930_940_COURSE_SLUG)).toBe("$65");
    expect(coursePurchasePriceLabel("103")).toBe("$65");
    expect(courseCheckoutPriceId("103")).toBe(BROTHER_930_940_COURSE_PRICE_ID);
    expect(courseCheckoutPriceId("103")).not.toBe(PAID_BROTHER_930_940_COURSE_PLAN_ID);
    expect(courseCheckoutPriceId("103")).not.toBe(LEGACY_BROTHER_930_940_COURSE_PLAN_ID);
    expect(sales).toContain("coursePurchasePriceLabel");
    expect(sales).toContain("kin-course-sales__price-value");
    expect(sales).toContain("CoursePurchaseButton");
    expect(copySource).toContain("{price} one-time payment");
    expect(KIN_BROTHER_930_940_SALES_COPY.purchaseButtonLabel).toBe("Purchase the Course");
    expect(KIN_BROTHER_930_940_SALES_COPY.purchaseInfo?.items[0]).toBe("{price} one-time payment");
  });

  it("hides the sales page for members and for legacy or paid Course 103 owners", () => {
    const member = payloadWithPlan(MEMBERSHIPS.membership.memberstackPlanId);
    const legacy = payloadWithPlan(LEGACY_BROTHER_930_940_COURSE_PLAN_ID);
    const paid = payloadWithPlan(PAID_BROTHER_930_940_COURSE_PLAN_ID);

    for (const viewer of [member, legacy, paid]) {
      expect(canAccessCourse("purchase", viewer, { courseSlug: "103" })).toBe(true);
      expect(
        shouldShowKinCourseSalesPageForViewer({
          access: "purchase",
          memberOrPayload: viewer,
          courseSlug: BROTHER_930_940_COURSE_SLUG,
        }),
      ).toBe(false);
      expect(
        shouldShowCoursePurchaseCtaForViewer({
          access: "purchase",
          memberOrPayload: viewer,
          courseSlug: "103",
        }),
      ).toBe(false);
    }

    expect(canAccessCourse("purchase", paid, { courseSlug: LEGACY_SK840_COURSE_SLUG })).toBe(false);
    expect(canAccessCourse("purchase", paid, { courseSlug: KIN_TAITEXMA_160_COURSE_SLUG })).toBe(
      false,
    );
    expect(coursePurchasePriceLabel(LEGACY_SK840_COURSE_SLUG)).toBe("$49.99");
    expect(courseCheckoutPriceId(KIN_TAITEXMA_160_COURSE_SLUG)).toBe("prc_course-th160-fe1ou0u3q");
  });
});
