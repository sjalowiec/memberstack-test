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
  SK840_COURSE_PRICE_ID,
  TH160_COURSE_PRICE_ID,
} from "../../config/legacyCourseEntitlements";
import { COURSE_ACCESS_PLAN_IDS, MEMBER_PLAN_IDS, MEMBERSHIPS } from "../../config/memberships";
import { canAccessCourse, hasIndividualCoursePurchase } from "../courseAccess";
import { getCourseCatalogEntries } from "../coursesCatalog";
import { startCourseCheckout } from "./courseCheckout";
import {
  courseCheckoutPriceId,
  coursePurchasePriceLabel,
  isSk840CourseSlug,
  shouldShowKinCourseSalesPage,
  shouldShowKinCourseSalesPageForViewer,
} from "./coursePurchase";
import {
  getKinCourseSalesCopy,
  KIN_SK840_SALES_COPY,
  KIN_TAITEXMA_SALES_COPY,
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
const member = payloadWithPlan(MEMBERSHIPS.membership.memberstackPlanId);
const sk840Legacy = payloadWithPlan(LEGACY_SK840_COURSE_PLAN_ID);
const sk840Paid = payloadWithPlan(PAID_SK840_COURSE_PLAN_ID);
const th160Legacy = payloadWithPlan(LEGACY_TH160_COURSE_PLAN_ID);
const th160Paid = payloadWithPlan(PAID_TH160_COURSE_PLAN_ID);

const copySource = readFileSync(resolve("src/lib/kinCourse/courseSalesCopy.ts"), "utf8");
const wrapper = readFileSync(resolve("src/components/courses/KinCourse111Sales.astro"), "utf8");
const shared = readFileSync(resolve("src/components/courses/KinCourseSales.astro"), "utf8");
const layout = readFileSync(resolve("src/layouts/KinCourseLayout.astro"), "utf8");
const button = readFileSync(resolve("src/components/courses/CoursePurchaseButton.astro"), "utf8");
const landing = readFileSync(resolve("src/data/kin_courses/111/landing.json"), "utf8");
const catalog = getCourseCatalogEntries().find((entry) => entry.slug === LEGACY_SK840_COURSE_SLUG);

function salesText(): string {
  return [
    KIN_SK840_SALES_COPY.headline,
    ...KIN_SK840_SALES_COPY.intro,
    KIN_SK840_SALES_COPY.benefitsHeading,
    ...KIN_SK840_SALES_COPY.benefits,
    KIN_SK840_SALES_COPY.supportingCopy,
    KIN_SK840_SALES_COPY.ctaHeading,
    KIN_SK840_SALES_COPY.purchaseButtonLabel,
    KIN_SK840_SALES_COPY.ownerBefore,
    KIN_SK840_SALES_COPY.ownerAfter,
    ...(KIN_SK840_SALES_COPY.purchaseInfo?.items ?? []),
    KIN_SK840_SALES_COPY.purchaseInfo?.heading ?? "",
    KIN_SK840_SALES_COPY.faq?.heading ?? "",
    ...(KIN_SK840_SALES_COPY.faq?.items.flatMap((item) => [item.question, item.answer]) ?? []),
  ].join("\n");
}

describe("Course 111 sales page visibility", () => {
  it("shows the sales page to a logged-out visitor", () => {
    expect(
      shouldShowKinCourseSalesPage({
        courseSlug: LEGACY_SK840_COURSE_SLUG,
        hasAccess: false,
      }),
    ).toBe(true);
    expect(shouldShowKinCourseSalesPage({ courseSlug: "111", hasAccess: false })).toBe(true);
    expect(
      shouldShowKinCourseSalesPageForViewer({
        access: "purchase",
        memberOrPayload: loggedOut,
        courseSlug: LEGACY_SK840_COURSE_SLUG,
      }),
    ).toBe(true);
    expect(isSk840CourseSlug("111")).toBe(true);
    expect(isSk840CourseSlug(LEGACY_SK840_COURSE_SLUG)).toBe(true);
    expect(layout).toContain("KinCourse111Sales");
    expect(layout).toContain("isSk840CourseSlug");
    expect(layout).toContain("showCourse111Sales");
    expect(wrapper).toContain("KIN_SK840_SALES_COPY");
    expect(getKinCourseSalesCopy("111")).toBe(KIN_SK840_SALES_COPY);
    expect(getKinCourseSalesCopy(LEGACY_SK840_COURSE_SLUG)).toBe(KIN_SK840_SALES_COPY);
    expect(getKinCourseSalesCopy("86")).toBe(KIN_TAITEXMA_SALES_COPY);
    expect(KIN_SK840_SALES_COPY.headline).toBe("Feel Confident Using Your Silver Reed SK840");
  });

  it("shows the sales page to a logged-in non-member without Course 111 ownership", () => {
    expect(
      canAccessCourse("purchase", loggedInNoPlan, { courseSlug: LEGACY_SK840_COURSE_SLUG }),
    ).toBe(false);
    expect(
      shouldShowKinCourseSalesPageForViewer({
        access: "purchase",
        memberOrPayload: loggedInNoPlan,
        courseSlug: "111",
      }),
    ).toBe(true);
  });

  it("lets an active member enter Course 111", () => {
    expect(
      canAccessCourse("purchase", member, { courseSlug: LEGACY_SK840_COURSE_SLUG }),
    ).toBe(true);
    expect(
      shouldShowKinCourseSalesPageForViewer({
        access: "purchase",
        memberOrPayload: member,
        courseSlug: LEGACY_SK840_COURSE_SLUG,
      }),
    ).toBe(false);
  });

  it("lets a Course 111 Legacy owner enter the course", () => {
    expect(
      canAccessCourse("purchase", sk840Legacy, { courseSlug: LEGACY_SK840_COURSE_SLUG }),
    ).toBe(true);
    expect(
      shouldShowKinCourseSalesPageForViewer({
        access: "purchase",
        memberOrPayload: sk840Legacy,
        courseSlug: "111",
      }),
    ).toBe(false);
  });

  it("lets a Course 111 Paid owner enter the course", () => {
    expect(
      canAccessCourse("purchase", sk840Paid, { courseSlug: LEGACY_SK840_COURSE_SLUG }),
    ).toBe(true);
    expect(
      shouldShowKinCourseSalesPageForViewer({
        access: "purchase",
        memberOrPayload: sk840Paid,
        courseSlug: LEGACY_SK840_COURSE_SLUG,
      }),
    ).toBe(false);
  });
});

describe("Course 111 purchase configuration", () => {
  it("uses the configured Course 111 Memberstack Price ID on the purchase button", () => {
    expect(COURSE_INDIVIDUAL_SALES.sk840.priceId).toBe(SK840_COURSE_PRICE_ID);
    expect(COURSE_INDIVIDUAL_SALES.sk840.priceId).toBe("prc_course-sk840-hn300ud");
    expect(courseCheckoutPriceId(LEGACY_SK840_COURSE_SLUG)).toBe("prc_course-sk840-hn300ud");
    expect(courseCheckoutPriceId("111")).toBe(SK840_COURSE_PRICE_ID);
    expect(button).toContain("data-course-price-id={priceId}");
    expect(wrapper).not.toContain("prc_");
    expect(shared).not.toContain("prc_course-sk840");
  });

  it("displays $49.99 only from the configured Memberstack amount", () => {
    expect(COURSE_INDIVIDUAL_SALES.sk840.priceLabel).toBe("$49.99");
    expect(coursePurchasePriceLabel(LEGACY_SK840_COURSE_SLUG)).toBe("$49.99");
    expect(coursePurchasePriceLabel("111")).toBe("$49.99");
    expect(shared).toContain("coursePurchasePriceLabel");
    expect(shared).toContain("kin-course-sales__price-value");
    expect(shared).not.toMatch(/\$\d/);
    expect(copySource).toContain("{price} one-time payment");
    expect(copySource).not.toMatch(/lifetime access|lifetime ownership/i);
  });

  it("fails safely when checkout configuration is missing", async () => {
    expect(courseCheckoutPriceId("ribber-basic-bootcamp")).toBeNull();
    expect(coursePurchasePriceLabel("ribber-basic-bootcamp")).toBeNull();
    expect(shared).toMatch(/priceId \? \(/);
    expect(button).toMatch(/priceId \? \(/);
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

describe("Course 111 access is independent of Course 86", () => {
  it("does not grant Course 86 access from a Course 111 purchase", () => {
    expect(hasIndividualCoursePurchase(KIN_TAITEXMA_160_COURSE_SLUG, sk840Paid)).toBe(false);
    expect(hasIndividualCoursePurchase(KIN_TAITEXMA_160_COURSE_SLUG, sk840Legacy)).toBe(false);
    expect(
      canAccessCourse("purchase", sk840Paid, { courseSlug: KIN_TAITEXMA_160_COURSE_SLUG }),
    ).toBe(false);
    expect(
      canAccessCourse("purchase", sk840Paid, { courseSlug: LEGACY_SK840_COURSE_SLUG }),
    ).toBe(true);
    expect(MEMBER_PLAN_IDS).not.toContain(PAID_SK840_COURSE_PLAN_ID);
    expect(COURSE_ACCESS_PLAN_IDS).not.toContain(PAID_SK840_COURSE_PLAN_ID);
    expect(COURSE_INDIVIDUAL_SALES.sk840.paidPlanId).not.toBe(PAID_TH160_COURSE_PLAN_ID);
    expect(COURSE_INDIVIDUAL_SALES.sk840.priceId).not.toBe(TH160_COURSE_PRICE_ID);
  });

  it("keeps Course 86 sales page, price, checkout, and access unchanged", () => {
    expect(
      shouldShowKinCourseSalesPage({
        courseSlug: KIN_TAITEXMA_160_COURSE_SLUG,
        hasAccess: false,
      }),
    ).toBe(true);
    expect(courseCheckoutPriceId(KIN_TAITEXMA_160_COURSE_SLUG)).toBe(TH160_COURSE_PRICE_ID);
    expect(coursePurchasePriceLabel(KIN_TAITEXMA_160_COURSE_SLUG)).toBe("$49.99");
    expect(COURSE_INDIVIDUAL_SALES.th160.priceId).toBe("prc_course-th160-fe1ou0u3q");
    expect(KIN_TAITEXMA_SALES_COPY.headline).toBe(
      "Feel Confident Using Your Taitexma TH/TR-160",
    );
    expect(
      canAccessCourse("purchase", th160Paid, { courseSlug: KIN_TAITEXMA_160_COURSE_SLUG }),
    ).toBe(true);
    expect(
      canAccessCourse("purchase", th160Paid, { courseSlug: LEGACY_SK840_COURSE_SLUG }),
    ).toBe(false);
    expect(
      canAccessCourse("purchase", th160Legacy, { courseSlug: LEGACY_SK840_COURSE_SLUG }),
    ).toBe(false);
    expect(layout).toContain("KinCourse86Sales");
    expect(layout).toContain("showCourse86Sales");
  });
});

describe("Course 111 sales copy, title, and thumbnail", () => {
  it("uses the official Course 111 title and catalog thumbnail", () => {
    expect(catalog?.title).toBe("Mastering the Silver Reed SK840");
    expect(landing).toContain('"title": "Mastering the Silver Reed SK840"');
    expect(landing).toContain(
      '"fullTitle": "Mastering the Silver Reed SK840: A Comprehensive Course"',
    );
    expect(landing).toContain('"/images/courses/mastering-silver-reed-sk840.png"');
    expect(catalog?.thumbnail).toBe("/images/courses/mastering-silver-reed-sk840.png");
    expect(wrapper).not.toContain("/images/courses/mastering-silver-reed-sk840.png");
    expect(shared).not.toContain("/images/courses/mastering-silver-reed-sk840.png");
    expect(shared).toContain("thumbnailSrc");
    expect(shared).toContain("kin-course-sales__image");
    expect(shared).toContain("border-radius: 10px");
    expect(shared).toContain("height: auto");
    expect(shared).toContain("width: 100%");
  });

  it("does not claim lifetime access or that courses appear in the customer’s account", () => {
    const visible = salesText();
    expect(visible).not.toMatch(/Taitexma|TH\/TR-160/);
    expect(visible).not.toMatch(/lifetime access|lifetime ownership/i);
    expect(visible).not.toMatch(/listed in (your|the customer's) account/i);
    expect(visible).not.toMatch(/appear in your account/i);
    expect(copySource).not.toMatch(/lifetime access|lifetime ownership/i);
    expect(KIN_SK840_SALES_COPY.faq?.items[2]?.answer).toContain("Courses page");
    expect(KIN_SK840_SALES_COPY.faq?.items[2]?.answer).not.toMatch(/account dashboard|your account lists/i);
  });
});
