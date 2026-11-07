import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  COURSE_INDIVIDUAL_SALES,
  LEGACY_RIBBER_BOOTCAMP_COURSE_PLAN_ID,
  LEGACY_SK840_COURSE_PLAN_ID,
  RIBBER_BOOTCAMP_COURSE_SLUG,
} from "../../config/legacyCourseEntitlements";
import { MEMBERSHIPS } from "../../config/memberships";
import { canAccessCourse } from "../courseAccess";
import { getCourseCatalogEntriesByCategory } from "../coursesCatalog";
import { kinCourseHomeHref } from "./hrefs";
import { startCourseCheckout } from "./courseCheckout";
import {
  courseCheckoutPriceId,
  coursePurchasePriceLabel,
  isRibberBootcampCourseSlug,
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
const legacyOwner = payloadWithPlan(LEGACY_RIBBER_BOOTCAMP_COURSE_PLAN_ID);
const otherCourseOwner = payloadWithPlan(LEGACY_SK840_COURSE_PLAN_ID);

const layout = readFileSync(resolve("src/layouts/KinCourseLayout.astro"), "utf8");
const sales = readFileSync(resolve("src/components/courses/KinCourseSales.astro"), "utf8");
const wrapper = readFileSync(resolve("src/components/courses/KinCourse66Sales.astro"), "utf8");
const home = readFileSync(resolve("src/components/kinCourse/KinCourseHomeView.astro"), "utf8");
const catalog = readFileSync(resolve("src/data/courses-catalog.json"), "utf8");

describe("Ribber Basic Bootcamp sales page", () => {
  it("reuses the published outline and the green thumbnail without a purchase button", () => {
    expect(isRibberBootcampCourseSlug(RIBBER_BOOTCAMP_COURSE_SLUG)).toBe(true);
    expect(isRibberBootcampCourseSlug("66")).toBe(true);
    expect(getKinCourseSalesCopy("66")).toBe(KIN_RIBBER_BOOTCAMP_SALES_COPY);
    expect(getKinCourseSalesCopy(RIBBER_BOOTCAMP_COURSE_SLUG)).toBe(KIN_RIBBER_BOOTCAMP_SALES_COPY);
    expect(KIN_RIBBER_BOOTCAMP_SALES_COPY.courseTitle).toBe("Ribber Basic Bootcamp");
    expect(KIN_RIBBER_BOOTCAMP_SALES_COPY.intro[0]).toBe(KIN_RIBBER_BOOTCAMP_DESCRIPTION);
    expect(KIN_RIBBER_BOOTCAMP_SALES_COPY.benefitsHeading).toBe("What You'll Learn");
    expect(KIN_RIBBER_BOOTCAMP_SALES_COPY.benefits).toEqual([...KIN_RIBBER_BOOTCAMP_LESSON_TOPICS]);
    expect(KIN_RIBBER_BOOTCAMP_SALES_COPY.supportingCopy).toBe(
      "Includes Video tutorials, Printable reference material, and Exercises.",
    );
    expect(KIN_RIBBER_BOOTCAMP_SALES_COPY.accessCta?.startHref).toBe(
      kinCourseHomeHref(COURSE_INDIVIDUAL_SALES.ribberBootcamp.courseId),
    );
    expect(KIN_RIBBER_BOOTCAMP_SALES_COPY.accessCta?.startHref).toBe("/courses/66");
    expect(KIN_RIBBER_BOOTCAMP_SALES_COPY.accessCta?.joinHref).toBe("/membership");
    expect(JSON.stringify(KIN_RIBBER_BOOTCAMP_SALES_COPY)).not.toMatch(/Purchase|prc_|\$\d/);

    const outlined = ribberBootcampSalesCopy({
      description: "<p>Get comfortable with your ribber through hands-on practice.</p>",
      topics: ["Casting On", "Binding Off"],
      included: ["Video tutorials", "Exercises"],
    });
    expect(outlined.intro[0]).toBe("Get comfortable with your ribber through hands-on practice.");
    expect(outlined.benefits).toEqual(["Casting On", "Binding Off"]);
    expect(outlined.supportingCopy).toBe("Includes Video tutorials and Exercises.");

    expect(wrapper).toContain("ribberBootcampSalesCopy");
    expect(wrapper).not.toContain("prc_");
    expect(wrapper).not.toContain('src="/images/');
    expect(layout).toContain("KinCourse66Sales");
    expect(layout).toContain("isRibberBootcampCourseSlug");
    expect(layout).toContain("topics={learnTopics}");
    expect(home).toContain("learnTopics={kinLanding.topics}");
    expect(home).toContain("thumbnailSrc={kinLanding.image.src}");
    expect(sales).toContain("thumbnailSrc || catalogEntry?.thumbnail");
    expect(catalog).toContain('"/images/courses/ribber.webp"');
  });

  it("keeps the Getting Started catalog card and withholds Buy", async () => {
    const gettingStarted = getCourseCatalogEntriesByCategory().find(
      (section) => section.category === "Getting Started",
    );
    expect(gettingStarted?.courses.map((course) => course.slug)).toEqual([
      "beginner-workshop",
      "ribber-basic-bootcamp",
    ]);
    expect(gettingStarted?.courses[1]).toMatchObject({
      title: "Ribber Basic Bootcamp",
      href: "/courses/66",
      thumbnail: "/images/courses/ribber.webp",
      access: "member",
    });

    expect(COURSE_INDIVIDUAL_SALES.ribberBootcamp.legacyPlanId).toBe(
      LEGACY_RIBBER_BOOTCAMP_COURSE_PLAN_ID,
    );
    expect(COURSE_INDIVIDUAL_SALES.ribberBootcamp.legacyPlanId).toBe(
      "pln_course-ribber-bootcamp-legacy-sgc1002r",
    );
    expect(COURSE_INDIVIDUAL_SALES.ribberBootcamp.paidPlanId).toBeUndefined();
    expect(COURSE_INDIVIDUAL_SALES.ribberBootcamp.priceId).toBeUndefined();
    expect(COURSE_INDIVIDUAL_SALES.ribberBootcamp.priceLabel).toBeUndefined();
    expect(courseCheckoutPriceId(RIBBER_BOOTCAMP_COURSE_SLUG)).toBeNull();
    expect(courseCheckoutPriceId("66")).toBeNull();
    expect(coursePurchasePriceLabel("66")).toBeNull();
    expect(courseCheckoutPriceId("66")).not.toBe(LEGACY_RIBBER_BOOTCAMP_COURSE_PLAN_ID);

    const result = await startCourseCheckout("66", {
      waitForMemberstack: async () => undefined,
    });
    expect(result).toEqual({
      ok: false,
      reason: "unknown-course",
      message: "This course is not available for individual purchase.",
    });
  });

  it("shows Start to members and legacy owners, and membership actions to everyone else", () => {
    expect(canAccessCourse("member", member, { courseSlug: RIBBER_BOOTCAMP_COURSE_SLUG })).toBe(
      true,
    );
    expect(canAccessCourse("member", legacyOwner, { courseSlug: "66" })).toBe(true);
    expect(
      canAccessCourse("member", loggedInNoPlan, { courseSlug: RIBBER_BOOTCAMP_COURSE_SLUG }),
    ).toBe(false);
    expect(
      canAccessCourse("member", otherCourseOwner, { courseSlug: RIBBER_BOOTCAMP_COURSE_SLUG }),
    ).toBe(false);

    for (const viewer of [member, legacyOwner]) {
      expect(
        resolveKinCourseSalesCta({
          memberstackReady: true,
          access: "member",
          memberOrPayload: viewer,
          courseSlug: RIBBER_BOOTCAMP_COURSE_SLUG,
        }),
      ).toBe("open");
      expect(
        shouldShowKinCourseSalesPageForViewer({
          access: "member",
          memberOrPayload: viewer,
          courseSlug: RIBBER_BOOTCAMP_COURSE_SLUG,
        }),
      ).toBe(false);
    }

    expect(
      resolveKinCourseSalesCta({
        memberstackReady: true,
        access: "member",
        memberOrPayload: loggedOut,
        courseSlug: "66",
      }),
    ).toBe("loggedOut");
    expect(
      resolveKinCourseSalesCta({
        memberstackReady: true,
        access: "member",
        memberOrPayload: loggedInNoPlan,
        courseSlug: RIBBER_BOOTCAMP_COURSE_SLUG,
      }),
    ).toBe("loggedInNoAccess");
    expect(
      shouldShowKinCourseSalesPage({
        courseSlug: RIBBER_BOOTCAMP_COURSE_SLUG,
        hasAccess: false,
      }),
    ).toBe(true);
    expect(shouldShowKinCourseSalesPage({ courseSlug: "66", hasAccess: true })).toBe(false);
  });
});
