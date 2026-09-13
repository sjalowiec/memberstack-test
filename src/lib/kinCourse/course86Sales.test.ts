import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  COURSE_INDIVIDUAL_SALES,
  KIN_TAITEXMA_160_COURSE_SLUG,
  LEGACY_SK840_COURSE_PLAN_ID,
  LEGACY_SK840_COURSE_SLUG,
  LEGACY_TH160_COURSE_PLAN_ID,
  PAID_SK840_COURSE_PLAN_ID,
  PAID_TH160_COURSE_PLAN_ID,
  TH160_COURSE_PRICE_ID,
} from "../../config/legacyCourseEntitlements";
import { MEMBERSHIPS } from "../../config/memberships";
import { canAccessCourse } from "../courseAccess";
import { getCourseCatalogEntries } from "../coursesCatalog";
import { startCourseCheckout } from "./courseCheckout";
import {
  courseCheckoutPriceId,
  coursePurchasePriceLabel,
  shouldShowKinCourseSalesPage,
  shouldShowKinCourseSalesPageForViewer,
} from "./coursePurchase";
import { KIN_TAITEXMA_SALES_COPY, getKinCourseSalesCopy } from "./courseSalesCopy";

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
const member = payloadWithPlan(MEMBERSHIPS.membership.memberstackPlanId);
const th160Legacy = payloadWithPlan(LEGACY_TH160_COURSE_PLAN_ID);
const th160Paid = payloadWithPlan(PAID_TH160_COURSE_PLAN_ID);
const sk840Legacy = payloadWithPlan(LEGACY_SK840_COURSE_PLAN_ID);
const sk840Paid = payloadWithPlan(PAID_SK840_COURSE_PLAN_ID);

const sales = readFileSync(resolve("src/lib/kinCourse/courseSalesCopy.ts"), "utf8");
const wrapper = readFileSync(resolve("src/components/courses/KinCourse86Sales.astro"), "utf8");
const shared = readFileSync(resolve("src/components/courses/KinCourseSales.astro"), "utf8");
const layout = readFileSync(resolve("src/layouts/KinCourseLayout.astro"), "utf8");
const button = readFileSync(resolve("src/components/courses/CoursePurchaseButton.astro"), "utf8");
const landing = readFileSync(resolve("src/data/kin_courses/86/landing.json"), "utf8");
const catalogThumb =
  getCourseCatalogEntries().find((entry) => entry.slug === KIN_TAITEXMA_160_COURSE_SLUG)
    ?.thumbnail ?? "";

describe("Course 86 sales page visibility", () => {
  it("shows the sales page to visitors without Course 86 access", () => {
    expect(
      shouldShowKinCourseSalesPage({
        courseSlug: KIN_TAITEXMA_160_COURSE_SLUG,
        hasAccess: false,
      }),
    ).toBe(true);
    expect(
      shouldShowKinCourseSalesPage({ courseSlug: "86", hasAccess: false }),
    ).toBe(true);
    expect(
      shouldShowKinCourseSalesPageForViewer({
        access: "purchase",
        memberOrPayload: loggedOut,
        courseSlug: KIN_TAITEXMA_160_COURSE_SLUG,
      }),
    ).toBe(true);
    expect(
      shouldShowKinCourseSalesPageForViewer({
        access: "purchase",
        memberOrPayload: loggedInNoPlan,
        courseSlug: "86",
      }),
    ).toBe(true);
    expect(
      shouldShowKinCourseSalesPageForViewer({
        access: "purchase",
        memberOrPayload: sk840Paid,
        courseSlug: KIN_TAITEXMA_160_COURSE_SLUG,
      }),
    ).toBe(true);

    expect(layout).toContain("KinCourse86Sales");
    expect(layout).toContain("isTaitexma160CourseSlug");
    expect(layout).toContain("showCourse86Sales");
    expect(wrapper).toContain("KIN_TAITEXMA_SALES_COPY");
    expect(getKinCourseSalesCopy("86")).toBe(KIN_TAITEXMA_SALES_COPY);
    expect(getKinCourseSalesCopy(KIN_TAITEXMA_160_COURSE_SLUG)).toBe(KIN_TAITEXMA_SALES_COPY);
    expect(KIN_TAITEXMA_SALES_COPY.headline).toBe(
      "Feel Confident Using Your Taitexma TH/TR-160",
    );
    expect(KIN_TAITEXMA_SALES_COPY.intro[0]).toContain(
      "Your Taitexma TH/TR-160 should be something you enjoy",
    );
    expect(KIN_TAITEXMA_SALES_COPY.benefits).toContain(
      "Set up and operate your Taitexma TH/TR-160 more confidently",
    );
    expect(KIN_TAITEXMA_SALES_COPY.ctaHeading).toBe(
      "Ready to feel more confident with your Taitexma TH/TR-160?",
    );
    expect(KIN_TAITEXMA_SALES_COPY.purchaseButtonLabel).toBe("Purchase the Course");
    expect(KIN_TAITEXMA_SALES_COPY.ownerBefore).toContain("Already own this course?");
    expect(shared).toContain("data-course-111-login");
    expect(sales.match(/Taitexma TH\/TR-160/g)?.length).toBeGreaterThanOrEqual(4);
    expect(sales.match(/Taitexma TH\/TR-160/g)?.length).toBeLessThanOrEqual(6);
    expect(sales).not.toMatch(/Titexima|Taitexima|Taitexama|Texima/i);
    expect(sales).not.toMatch(/Your TH\/TR-160|your TH\/TR-160/);
  });

  it("lets authorized members and Course 86 owners enter the course instead", () => {
    for (const viewer of [member, th160Legacy, th160Paid]) {
      expect(
        canAccessCourse("purchase", viewer, { courseSlug: KIN_TAITEXMA_160_COURSE_SLUG }),
      ).toBe(true);
      expect(
        shouldShowKinCourseSalesPageForViewer({
          access: "purchase",
          memberOrPayload: viewer,
          courseSlug: KIN_TAITEXMA_160_COURSE_SLUG,
        }),
      ).toBe(false);
    }
    expect(
      shouldShowKinCourseSalesPage({
        courseSlug: KIN_TAITEXMA_160_COURSE_SLUG,
        hasAccess: true,
      }),
    ).toBe(false);
  });

  it("keeps Course 86 sales copy, price, and checkout independent of Course 111", () => {
    expect(
      canAccessCourse("purchase", member, { courseSlug: LEGACY_SK840_COURSE_SLUG }),
    ).toBe(true);
    expect(
      canAccessCourse("purchase", sk840Legacy, { courseSlug: LEGACY_SK840_COURSE_SLUG }),
    ).toBe(true);
    expect(
      canAccessCourse("purchase", th160Paid, { courseSlug: LEGACY_SK840_COURSE_SLUG }),
    ).toBe(false);
    expect(
      canAccessCourse("purchase", sk840Paid, { courseSlug: KIN_TAITEXMA_160_COURSE_SLUG }),
    ).toBe(false);

    expect(layout).toContain("KinCourse86Sales");
    expect(layout).toContain("KinCourse111Sales");
    expect(layout).toContain("course-111-gate__card");
    expect(layout).toContain("Join Knit It Now");
    expect(layout).toContain("kinCourseNoAccessMessage");
    expect(layout).not.toContain("Feel Confident Using Your Taitexma TH/TR-160");
    expect(layout).not.toContain("Feel Confident Using Your TH/TR-160");
    expect(KIN_TAITEXMA_SALES_COPY.purchaseInfo).toBeUndefined();
    expect(KIN_TAITEXMA_SALES_COPY.faq).toBeUndefined();
    expect(courseCheckoutPriceId(KIN_TAITEXMA_160_COURSE_SLUG)).toBe(TH160_COURSE_PRICE_ID);
    expect(coursePurchasePriceLabel(KIN_TAITEXMA_160_COURSE_SLUG)).toBe("$49.99");
  });
});

describe("Course 86 sales purchase configuration", () => {
  it("uses configured checkout data and fails safely when it is missing", () => {
    expect(COURSE_INDIVIDUAL_SALES.th160.priceId).toBe(TH160_COURSE_PRICE_ID);
    expect(COURSE_INDIVIDUAL_SALES.th160.priceId).toBe("prc_course-th160-fe1ou0u3q");
    expect(COURSE_INDIVIDUAL_SALES.th160.priceLabel).toBe("$49.99");
    expect(courseCheckoutPriceId(KIN_TAITEXMA_160_COURSE_SLUG)).toBe(
      "prc_course-th160-fe1ou0u3q",
    );
    expect(courseCheckoutPriceId("86")).toBe(courseCheckoutPriceId(KIN_TAITEXMA_160_COURSE_SLUG));
    expect(shared).toContain("courseCheckoutPriceId");
    expect(shared).toContain("coursePurchasePriceLabel");
    expect(shared).toContain("CoursePurchaseButton");
    expect(KIN_TAITEXMA_SALES_COPY.purchaseButtonLabel).toBe("Purchase the Course");
    expect(shared).not.toContain("prc_");
    expect(shared).not.toMatch(/\$\d/);
    expect(shared).toContain("kin-course-sales__price");
    expect(shared).toContain("kin-course-sales__price-value");
    expect(shared).toContain("font-size: 2rem");
    expect(button).toContain("data-course-price-id={priceId}");
    expect(button).toMatch(/priceId \? \(/);
    expect(button).toContain(": null");
    expect(courseCheckoutPriceId("ribber-basic-bootcamp")).toBeNull();
    expect(coursePurchasePriceLabel(KIN_TAITEXMA_160_COURSE_SLUG)).toBe("$49.99");
    expect(coursePurchasePriceLabel("86")).toBe("$49.99");
  });

  it("does not invent a price, product ID, or payment link", async () => {
    const result = await startCourseCheckout("ribber-basic-bootcamp", {
      waitForMemberstack: async () => undefined,
    });
    expect(result).toEqual({
      ok: false,
      reason: "unknown-course",
      message: "This course is not available for individual purchase.",
    });
  });
});

describe("Course 86 sales thumbnail", () => {
  it("uses the catalog/landing image instead of duplicating its path", () => {
    expect(catalogThumb).toBe("/images/courses/taitexma_160.webp");
    expect(landing).toContain('"/images/courses/taitexma_160.webp"');
    expect(wrapper).toContain("thumbnailSrc");
    expect(shared).toContain("getCourseCatalogEntries");
    expect(wrapper).not.toContain("/images/courses/taitexma_160.webp");
    expect(shared).not.toContain("/images/courses/taitexma_160.webp");
    expect(shared).toContain("kin-course-sales__image");
    expect(shared).toContain("height: auto");
    expect(shared).toContain("width: 100%");
    expect(shared).toContain("border-radius: 10px");
    expect(shared).toContain("overflow: hidden");
    expect(shared).toContain('"headline"');
    expect(shared).toContain('"image"');
    expect(shared).toContain("max-width: 900px");
  });
});

describe("Course 86 sales title and spelling", () => {
  it("puts Taitexma TH/TR-160 in the document title and Course 86 meta description", () => {
    const homeView = readFileSync(resolve("src/components/kinCourse/KinCourseHomeView.astro"), "utf8");
    expect(homeView).toContain("title={kinLanding.fullTitle}");
    expect(landing).toContain('"fullTitle": "Taitexma TH/TR-160: Getting Started"');
    expect(layout).toContain("courseSalesDescription");
    expect(KIN_TAITEXMA_SALES_COPY.metaDescription).toContain(
      "Feel confident using your Taitexma TH/TR-160",
    );
    expect(layout).toContain('name="description"');
    expect(layout).toContain("showCourse86Sales");
    expect(layout).not.toMatch(/Titexima|Taitexima|Taitexama/i);
  });
});
