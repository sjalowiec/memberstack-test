import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  BEGINNER_WORKSHOP_COURSE_SLUG,
  COURSE_INDIVIDUAL_SALES,
  LEGACY_BEGINNER_WORKSHOP_COURSE_PLAN_ID,
  LEGACY_SK840_COURSE_PLAN_ID,
} from "../../config/legacyCourseEntitlements";
import { MEMBERSHIPS } from "../../config/memberships";
import { canAccessCourse } from "../courseAccess";
import { getCourseCatalogEntries } from "../coursesCatalog";
import { kinCourseHomeHref } from "./hrefs";
import {
  courseCheckoutPriceId,
  isBeginnerWorkshopCourseSlug,
  shouldShowKinCourseSalesPage,
  shouldShowKinCourseSalesPageForViewer,
} from "./coursePurchase";
import {
  getKinCourseSalesCopy,
  KIN_BEGINNER_WORKSHOP_SALES_COPY,
} from "./courseSalesCopy";
import { resolveKinCourseSalesCta } from "../../scripts/kinCourseSalesCta";

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
const owner = payloadWithPlan(LEGACY_BEGINNER_WORKSHOP_COURSE_PLAN_ID);
const otherCourseOwner = payloadWithPlan(LEGACY_SK840_COURSE_PLAN_ID);

const sales = readFileSync(resolve("src/components/courses/KinCourseSales.astro"), "utf8");
const wrapper = readFileSync(resolve("src/components/courses/KinCourse33Sales.astro"), "utf8");
const layout = readFileSync(resolve("src/layouts/KinCourseLayout.astro"), "utf8");
const courseIndex = readFileSync(resolve("src/pages/courses/[courseSlug]/index.astro"), "utf8");
const lessonPage = readFileSync(
  resolve("src/pages/courses/[courseSlug]/lesson/[assignId].astro"),
  "utf8",
);

function salesText(): string {
  return JSON.stringify(KIN_BEGINNER_WORKSHOP_SALES_COPY);
}

describe("Beginner Workshop sales page", () => {
  it("keeps the public overview on the course slug and the player at /courses/33", () => {
    expect(isBeginnerWorkshopCourseSlug(BEGINNER_WORKSHOP_COURSE_SLUG)).toBe(true);
    expect(isBeginnerWorkshopCourseSlug("33")).toBe(true);
    expect(getKinCourseSalesCopy("33")).toBe(KIN_BEGINNER_WORKSHOP_SALES_COPY);
    expect(getKinCourseSalesCopy(BEGINNER_WORKSHOP_COURSE_SLUG)).toBe(
      KIN_BEGINNER_WORKSHOP_SALES_COPY,
    );
    expect(courseIndex).toContain("loadNumberedCoursePlayerBundle");
    expect(courseIndex).toContain('Astro.redirect(kinCourseHomeHref(COURSE_INDIVIDUAL_SALES.beginnerWorkshop.courseId), 301)');
    expect(courseIndex).not.toContain("BeginnerWorkshopSalesPage");
    expect(courseIndex).not.toContain("course_33_beginner_workshop");
    expect(wrapper).toContain("KIN_BEGINNER_WORKSHOP_SALES_COPY");
    expect(layout).toContain("KinCourse33Sales");
    expect(layout).toContain("isBeginnerWorkshopCourseSlug");
    expect(lessonPage).toContain("KinCourseLayout");
    expect(lessonPage).not.toContain("BeginnerWorkshopSalesPage");
    expect(KIN_BEGINNER_WORKSHOP_SALES_COPY.accessCta?.startHref).toBe(
      kinCourseHomeHref(COURSE_INDIVIDUAL_SALES.beginnerWorkshop.courseId),
    );
    expect(KIN_BEGINNER_WORKSHOP_SALES_COPY.accessCta?.startHref).toBe("/courses/33");
    expect(KIN_BEGINNER_WORKSHOP_SALES_COPY.accessCta?.startLabel).toBe(
      "Start the Beginner Workshop",
    );
    expect(KIN_BEGINNER_WORKSHOP_SALES_COPY.accessCta?.joinHref).toBe("/membership");
    expect(KIN_BEGINNER_WORKSHOP_SALES_COPY.accessCta?.joinLabel).toBe("Join Knit It Now");
    expect(KIN_BEGINNER_WORKSHOP_SALES_COPY.accessCta?.memberHref).toBe("/membership");
    expect(KIN_BEGINNER_WORKSHOP_SALES_COPY.accessCta?.memberLabel).toBe("Become a member");
    expect(KIN_BEGINNER_WORKSHOP_SALES_COPY.accessCta?.signInLabel).toBe("Sign in");
    expect(sales).toContain("data-course-111-login");
    expect(sales).toContain("data-sales-cta");
    expect(courseCheckoutPriceId(BEGINNER_WORKSHOP_COURSE_SLUG)).toBeNull();
    expect(courseCheckoutPriceId("33")).toBeNull();
    expect(salesText()).not.toContain("Purchase");
    expect(salesText()).not.toContain("prc_");
  });

  it("uses the compact Taitexma sales layout with one closing access CTA", () => {
    const copy = KIN_BEGINNER_WORKSHOP_SALES_COPY;
    expect(copy.blocks).toBeUndefined();
    expect(copy.courseTitle).toBe("Beginner Workshop");
    expect(copy.headline).toBe("Start Machine Knitting with Confidence");
    expect(sales).toContain("kin-course-sales__course-title");
    expect(sales).toContain("copy.courseTitle");
    expect(sales).toContain('<h2 class="kin-course-sales__headline">{copy.headline}</h2>');
    expect(copy.intro).toEqual([
      "Ready to use your knitting machine but unsure where to begin?",
      "Follow a clear, step-by-step path through the basics, then put your skills to work knitting three hats.",
    ]);
    expect(copy.benefitsHeading).toBe("With this workshop, you’ll learn to:");
    expect(copy.benefits).toEqual([
      "Choose suitable yarn and get your knitting started",
      "Cast on, bind off, and shape your knitting",
      "Swatch and measure gauge for the size you want",
      "Put it all together in three hat projects",
    ]);
    expect(copy.supportingCopy).toBe(
      "Watch, practice, and repeat at your own pace. Return to any lesson when you need a refresher.",
    );
    expect(copy.ctaHeading).toBe("Ready to get knitting?");
    expect(copy.accessLine).toBe(
      "Available to Knit It Now members and previous course owners.",
    );
    const text = salesText();
    expect(text).not.toContain("Know what to practice next");
    expect(text).not.toContain("Double Warm Hat");
    expect(text).not.toContain("Shaped Watch Cap");
    expect(text).not.toContain("Purchase");
    expect(sales).toContain("copy.accessLine");
    expect(sales).toContain("kin-course-sales__benefits");
    expect(sales).toContain('aria-labelledby="kin-course-sales-cta-heading"');
  });

  it("shows Start to members and legacy owners, and membership actions to everyone else", () => {
    expect(canAccessCourse("member", member, { courseSlug: BEGINNER_WORKSHOP_COURSE_SLUG })).toBe(
      true,
    );
    expect(canAccessCourse("member", owner, { courseSlug: "33" })).toBe(true);
    expect(
      canAccessCourse("member", loggedInNoPlan, { courseSlug: BEGINNER_WORKSHOP_COURSE_SLUG }),
    ).toBe(false);
    expect(
      canAccessCourse("member", otherCourseOwner, { courseSlug: BEGINNER_WORKSHOP_COURSE_SLUG }),
    ).toBe(false);

    for (const viewer of [member, owner]) {
      expect(
        resolveKinCourseSalesCta({
          memberstackReady: true,
          access: "member",
          memberOrPayload: viewer,
          courseSlug: BEGINNER_WORKSHOP_COURSE_SLUG,
        }),
      ).toBe("open");
      expect(
        shouldShowKinCourseSalesPageForViewer({
          access: "member",
          memberOrPayload: viewer,
          courseSlug: BEGINNER_WORKSHOP_COURSE_SLUG,
        }),
      ).toBe(false);
    }

    expect(
      resolveKinCourseSalesCta({
        memberstackReady: true,
        access: "member",
        memberOrPayload: loggedOut,
        courseSlug: BEGINNER_WORKSHOP_COURSE_SLUG,
      }),
    ).toBe("loggedOut");
    expect(
      resolveKinCourseSalesCta({
        memberstackReady: true,
        access: "member",
        memberOrPayload: loggedInNoPlan,
        courseSlug: "33",
      }),
    ).toBe("loggedInNoAccess");
    expect(
      resolveKinCourseSalesCta({
        memberstackReady: false,
        access: "member",
        memberOrPayload: loggedOut,
        courseSlug: BEGINNER_WORKSHOP_COURSE_SLUG,
      }),
    ).toBe("pending");
    expect(
      shouldShowKinCourseSalesPage({
        courseSlug: BEGINNER_WORKSHOP_COURSE_SLUG,
        hasAccess: false,
      }),
    ).toBe(true);
    expect(
      shouldShowKinCourseSalesPage({ courseSlug: "33", hasAccess: true }),
    ).toBe(false);
  });

  it("uses the Course 33 thumbnail already configured for the workshop", () => {
    const course = JSON.parse(
      readFileSync(
        resolve("src/data/legacy_kin/cleaned/course_33_beginner_workshop.poc.json"),
        "utf8",
      ),
    ) as { course: { thumbnail?: string; title?: string } };
    expect(course.course.title).toBe("Beginner Workshop");
    expect(course.course.thumbnail).toBe("/images/courses/beginner.webp");
    expect(layout).toContain("thumbnailSrc={thumbnailSrc}");
    expect(sales).toContain("thumbnailSrc || catalogEntry?.thumbnail");
    expect(sales).not.toContain('src="/images/');
    expect(wrapper).not.toContain('src="/images/');
    expect(sales).not.toMatch(/border-left:\s*\d+px/);
  });
});
