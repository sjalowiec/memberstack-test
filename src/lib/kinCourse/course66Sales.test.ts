import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  COURSE_INDIVIDUAL_SALES,
  LEGACY_RIBBER_BOOTCAMP_COURSE_PLAN_ID,
  LEGACY_SK840_COURSE_SLUG,
  PAID_RIBBER_BOOTCAMP_COURSE_PLAN_ID,
  RIBBER_BOOTCAMP_COURSE_PRICE_ID,
  RIBBER_BOOTCAMP_COURSE_SLUG,
} from "../../config/legacyCourseEntitlements";
import { MEMBERSHIPS } from "../../config/memberships";
import { canAccessCourse } from "../courseAccess";
import {
  courseCheckoutPriceId,
  coursePurchasePriceLabel,
  isRibberBootcampCourseSlug,
  shouldShowCoursePurchaseCtaForViewer,
  shouldShowKinCourseSalesPage,
  shouldShowKinCourseSalesPageForViewer,
} from "./coursePurchase";
import {
  getKinCourseSalesCopy,
  KIN_RIBBER_BOOTCAMP_DESCRIPTION,
  KIN_RIBBER_BOOTCAMP_LESSON_TOPICS,
  KIN_RIBBER_BOOTCAMP_SALES_COPY,
  ribberBootcampSalesCopy,
} from "./courseSalesCopy";

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

describe("Course 66 sales page and purchase button", () => {
  const layout = readFileSync(resolve("src/layouts/KinCourseLayout.astro"), "utf8");
  const sales = readFileSync(resolve("src/components/courses/KinCourseSales.astro"), "utf8");
  const wrapper = readFileSync(resolve("src/components/courses/KinCourse66Sales.astro"), "utf8");

  it("shows the published outline and the one-time purchase button", () => {
    expect(isRibberBootcampCourseSlug("66")).toBe(true);
    expect(isRibberBootcampCourseSlug(RIBBER_BOOTCAMP_COURSE_SLUG)).toBe(true);
    expect(shouldShowKinCourseSalesPage({ courseSlug: "66", hasAccess: false })).toBe(true);
    expect(
      shouldShowKinCourseSalesPageForViewer({
        access: "member",
        memberOrPayload: loggedOut,
        courseSlug: RIBBER_BOOTCAMP_COURSE_SLUG,
      }),
    ).toBe(true);
    expect(
      shouldShowCoursePurchaseCtaForViewer({
        access: "member",
        memberOrPayload: loggedInNoPlan,
        courseSlug: "66",
      }),
    ).toBe(true);
    expect(getKinCourseSalesCopy("66")).toBe(KIN_RIBBER_BOOTCAMP_SALES_COPY);
    expect(KIN_RIBBER_BOOTCAMP_SALES_COPY.courseTitle).toBe("Ribber Basic Bootcamp");
    expect(KIN_RIBBER_BOOTCAMP_SALES_COPY.intro[0]).toBe(KIN_RIBBER_BOOTCAMP_DESCRIPTION);
    expect(KIN_RIBBER_BOOTCAMP_SALES_COPY.benefits).toEqual([...KIN_RIBBER_BOOTCAMP_LESSON_TOPICS]);
    expect(KIN_RIBBER_BOOTCAMP_SALES_COPY.supportingCopy).toBe(
      "Includes Video tutorials, Printable reference material, and Exercises.",
    );
    expect(KIN_RIBBER_BOOTCAMP_SALES_COPY.purchaseButtonLabel).toBe("Purchase the Course");
    expect(KIN_RIBBER_BOOTCAMP_SALES_COPY.purchaseInfo?.items[0]).toBe("{price} one-time payment");
    expect(KIN_RIBBER_BOOTCAMP_SALES_COPY.accessCta).toBeUndefined();
    expect(layout).toContain("KinCourse66Sales");
    expect(wrapper).toContain("ribberBootcampSalesCopy");
    expect(wrapper).not.toContain("prc_");
    expect(sales).toContain("kin-course-sales__price-value");
    expect(sales).toContain("data-course-111-login");

    const outlined = ribberBootcampSalesCopy({
      description: "<p>Get comfortable with your ribber through hands-on practice.</p>",
      topics: ["Casting On", "Binding Off"],
      included: ["Video tutorials", "Exercises"],
    });
    expect(outlined.intro[0]).toBe("Get comfortable with your ribber through hands-on practice.");
    expect(outlined.intro[1]).toBe(KIN_RIBBER_BOOTCAMP_SALES_COPY.intro[1]);
    expect(outlined.benefits).toEqual(["Casting On", "Binding Off"]);
    expect(outlined.supportingCopy).toBe("Includes Video tutorials and Exercises.");
    expect(outlined.purchaseButtonLabel).toBe("Purchase the Course");
  });

  it("checks out at $49.99 with the Price ID and keeps the legacy plan separate", () => {
    expect(COURSE_INDIVIDUAL_SALES.ribberBootcamp.priceLabel).toBe("$49.99");
    expect(COURSE_INDIVIDUAL_SALES.ribberBootcamp.priceId).toBe(RIBBER_BOOTCAMP_COURSE_PRICE_ID);
    expect(COURSE_INDIVIDUAL_SALES.ribberBootcamp.priceId).toBe(
      "prc_course-ribber-bootcamp-84c300s0",
    );
    expect(COURSE_INDIVIDUAL_SALES.ribberBootcamp.paidPlanId).toBe(
      PAID_RIBBER_BOOTCAMP_COURSE_PLAN_ID,
    );
    expect(COURSE_INDIVIDUAL_SALES.ribberBootcamp.paidPlanId).toBe(
      "pln_course-ribber-bootcamp-a4c200uh",
    );
    expect(COURSE_INDIVIDUAL_SALES.ribberBootcamp.legacyPlanId).toBe(
      LEGACY_RIBBER_BOOTCAMP_COURSE_PLAN_ID,
    );
    expect(coursePurchasePriceLabel("66")).toBe("$49.99");
    expect(courseCheckoutPriceId("66")).toBe(RIBBER_BOOTCAMP_COURSE_PRICE_ID);
    expect(courseCheckoutPriceId(RIBBER_BOOTCAMP_COURSE_SLUG)).not.toBe(
      PAID_RIBBER_BOOTCAMP_COURSE_PLAN_ID,
    );
    expect(courseCheckoutPriceId("66")).not.toBe(LEGACY_RIBBER_BOOTCAMP_COURSE_PLAN_ID);
  });

  it("keeps the player for members and for legacy or paid Course 66 owners", () => {
    const member = payloadWithPlan(MEMBERSHIPS.membership.memberstackPlanId);
    const legacy = payloadWithPlan(LEGACY_RIBBER_BOOTCAMP_COURSE_PLAN_ID);
    const paid = payloadWithPlan(PAID_RIBBER_BOOTCAMP_COURSE_PLAN_ID);

    for (const viewer of [member, legacy, paid]) {
      expect(canAccessCourse("member", viewer, { courseSlug: "66" })).toBe(true);
      expect(
        shouldShowKinCourseSalesPageForViewer({
          access: "member",
          memberOrPayload: viewer,
          courseSlug: RIBBER_BOOTCAMP_COURSE_SLUG,
        }),
      ).toBe(false);
      expect(
        shouldShowCoursePurchaseCtaForViewer({
          access: "member",
          memberOrPayload: viewer,
          courseSlug: "66",
        }),
      ).toBe(false);
    }

    expect(canAccessCourse("member", paid, { courseSlug: LEGACY_SK840_COURSE_SLUG })).toBe(false);
    expect(canAccessCourse("member", loggedOut, { courseSlug: "66" })).toBe(false);
    expect(canAccessCourse("member", loggedInNoPlan, { courseSlug: "66" })).toBe(false);
  });
});
