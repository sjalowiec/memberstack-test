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

const salesPage = readFileSync(
  resolve("src/components/courses/BeginnerWorkshopSalesPage.astro"),
  "utf8",
);
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
    expect(courseIndex).toContain("showBeginnerWorkshopSales");
    expect(courseIndex).toContain("BeginnerWorkshopSalesPage");
    expect(courseIndex).not.toContain("course_33_beginner_workshop");
    expect(salesPage).not.toContain("vimeo");
    expect(salesPage).not.toContain("set:html");
    expect(salesPage).toContain('thumbnailSrc="/images/courses/beginner.webp"');
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

  it("corrects the overview to the current course: one hat project, no named legacy hats", () => {
    const text = salesText();
    expect(text).toContain("your first hat");
    expect(text).toContain("Project: Let’s Knit a Hat!");
    expect(text).toContain("Hat Pattern Builder");
    expect(text).toContain("Yarn Estimator");
    expect(text).toContain("worksheets");
    expect(text).toContain("not appropriate for the LK150");
    expect(text).not.toContain("three hat");
    expect(text).not.toContain("three finished hats");
    expect(text).not.toContain("Double Warm Hat");
    expect(text).not.toContain("Shaped Watch Cap");
    expect(text).not.toContain("Brother");
    expect(text).not.toContain("Silver Reed");
    expect(text).not.toContain("machine manual");
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

  it("lists the overview from the course catalog like the other View Course cards", () => {
    const entry = getCourseCatalogEntries().find(
      (course) => course.slug === BEGINNER_WORKSHOP_COURSE_SLUG,
    );
    expect(entry?.href).toBe("/courses/beginner-workshop");
    expect(entry?.buttonLabel).toBe("View Course");
    expect(entry?.access).toBe("member");
    expect(entry?.title).toBe("Beginner Workshop");
    expect(entry?.thumbnail).toBe("/images/courses/beginner.webp");
    expect(entry?.category).toBe("Getting Started");
  });
});
