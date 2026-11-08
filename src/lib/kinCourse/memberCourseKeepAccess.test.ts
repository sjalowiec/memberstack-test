import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  BEGINNER_WORKSHOP_COURSE_SLUG,
  BROTHER_930_940_COURSE_SLUG,
  BROTHER_KH260_COURSE_SLUG,
  COURSE_INDIVIDUAL_SALES,
  KIN_TAITEXMA_160_COURSE_SLUG,
  LEGACY_BROTHER_930_940_COURSE_PLAN_ID,
  LEGACY_RIBBER_BOOTCAMP_COURSE_PLAN_ID,
  LEGACY_SK840_COURSE_PLAN_ID,
  LEGACY_SK840_COURSE_SLUG,
  LEGACY_TH160_COURSE_PLAN_ID,
  PAID_BROTHER_930_940_COURSE_PLAN_ID,
  PAID_RIBBER_BOOTCAMP_COURSE_PLAN_ID,
  PAID_SK840_COURSE_PLAN_ID,
  PAID_TH160_COURSE_PLAN_ID,
  RIBBER_BOOTCAMP_COURSE_SLUG,
} from "../../config/legacyCourseEntitlements";
import { MEMBERSHIPS } from "../../config/memberships";
import { canAccessCourse } from "../courseAccess";
import {
  courseStandalonePurchaseReady,
  MEMBER_COURSE_INCLUDED_COPY,
  MEMBER_COURSE_KEEP_ACCESS_COPY,
  MEMBER_COURSE_OWNED_COPY,
  resolveMemberCourseKeepAccess,
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

const member = payloadWithPlan(MEMBERSHIPS.membership.memberstackPlanId);
const loggedOut = null;
const loggedInNoPlan = {
  data: { id: "ms_nosub", auth: { email: "nosub@knititnow.com" }, planConnections: [] },
};

const readyCourses = [
  {
    slug: RIBBER_BOOTCAMP_COURSE_SLUG,
    buyLabel: "Buy for $49.99",
    legacyPlanId: LEGACY_RIBBER_BOOTCAMP_COURSE_PLAN_ID,
    paidPlanId: PAID_RIBBER_BOOTCAMP_COURSE_PLAN_ID,
  },
  {
    slug: KIN_TAITEXMA_160_COURSE_SLUG,
    buyLabel: "Buy for $49.99",
    legacyPlanId: LEGACY_TH160_COURSE_PLAN_ID,
    paidPlanId: PAID_TH160_COURSE_PLAN_ID,
  },
  {
    slug: LEGACY_SK840_COURSE_SLUG,
    buyLabel: "Buy for $49.99",
    legacyPlanId: LEGACY_SK840_COURSE_PLAN_ID,
    paidPlanId: PAID_SK840_COURSE_PLAN_ID,
  },
  {
    slug: BROTHER_930_940_COURSE_SLUG,
    buyLabel: "Buy for $65",
    legacyPlanId: LEGACY_BROTHER_930_940_COURSE_PLAN_ID,
    paidPlanId: PAID_BROTHER_930_940_COURSE_PLAN_ID,
  },
] as const;

describe("member keep-access offer", () => {
  it("offers a ready course to an active member and keeps the non-member purchase path", () => {
    for (const course of readyCourses) {
      expect(courseStandalonePurchaseReady(course.slug)).toBe(true);
      expect(
        resolveMemberCourseKeepAccess({
          memberOrPayload: member,
          courseSlug: course.slug,
        }),
      ).toEqual({ kind: "included", buyLabel: course.buyLabel });
      expect(
        shouldShowCoursePurchaseCtaForViewer({
          access: "member",
          memberOrPayload: loggedOut,
          courseSlug: course.slug,
        }),
      ).toBe(true);
      expect(
        shouldShowCoursePurchaseCtaForViewer({
          access: "member",
          memberOrPayload: loggedInNoPlan,
          courseSlug: course.slug,
        }),
      ).toBe(true);
      expect(
        resolveMemberCourseKeepAccess({
          memberOrPayload: loggedInNoPlan,
          courseSlug: course.slug,
        }),
      ).toEqual({ kind: "hidden" });
    }
  });

  it("hides the member buy button for paid plans and legacy plans", () => {
    for (const course of readyCourses) {
      for (const planId of [course.paidPlanId, course.legacyPlanId]) {
        const owner = payloadWithPlan(planId);
        expect(canAccessCourse("member", owner, { courseSlug: course.slug })).toBe(true);
        expect(canAccessCourse("member", owner, { courseSlug: "beginner-workshop" })).toBe(false);
        expect(
          resolveMemberCourseKeepAccess({
            memberOrPayload: owner,
            courseSlug: course.slug,
          }),
        ).toEqual({ kind: "owned" });
      }

      const memberOwner = {
        data: {
          id: "ms_both",
          auth: { email: "both@knititnow.com" },
          planConnections: [
            { planId: MEMBERSHIPS.membership.memberstackPlanId, status: "ACTIVE" },
            { planId: course.paidPlanId, status: "ACTIVE" },
          ],
        },
      };
      expect(
        resolveMemberCourseKeepAccess({
          memberOrPayload: memberOwner,
          courseSlug: course.slug,
        }),
      ).toEqual({ kind: "owned" });
    }
  });

  it("omits the member offer when standalone checkout is not configured", () => {
    for (const slug of [BEGINNER_WORKSHOP_COURSE_SLUG, BROTHER_KH260_COURSE_SLUG, "33", "87"]) {
      expect(courseStandalonePurchaseReady(slug)).toBe(false);
      expect(
        resolveMemberCourseKeepAccess({
          memberOrPayload: member,
          courseSlug: slug,
        }),
      ).toEqual({ kind: "hidden" });
    }
    expect(COURSE_INDIVIDUAL_SALES.beginnerWorkshop.paidPlanId).toBeUndefined();
    expect(COURSE_INDIVIDUAL_SALES.brother260.priceId).toBeUndefined();
  });

  it("keeps Start Course primary and wires the secondary buy button to the course price", () => {
    const home = readFileSync(resolve("src/components/kinCourse/KinCourseHomeView.astro"), "utf8");
    const sales = readFileSync(resolve("src/components/courses/KinCourseSales.astro"), "utf8");
    const offer = readFileSync(resolve("src/components/courses/MemberCourseKeepAccess.astro"), "utf8");
    const gate = readFileSync(resolve("src/scripts/kinCourseAccessGate.ts"), "utf8");
    const layout = readFileSync(resolve("src/layouts/KinCourseLayout.astro"), "utf8");
    const purchaseButton = readFileSync(
      resolve("src/components/courses/CoursePurchaseButton.astro"),
      "utf8",
    );

    expect(home.indexOf(">Start Course<")).toBeGreaterThan(-1);
    expect(home.indexOf(">Start Course<")).toBeLessThan(home.lastIndexOf("<MemberCourseKeepAccess"));
    expect(home).toContain("View Course Contents");
    expect(sales).toContain("MemberCourseKeepAccess");
    expect(sales).toContain("CoursePurchaseButton");
    expect(sales).toContain("data-course-111-login");
    expect(offer).toContain("{MEMBER_COURSE_INCLUDED_COPY}");
    expect(offer).toContain("{MEMBER_COURSE_OWNED_COPY}");
    expect(offer).toContain("{MEMBER_COURSE_KEEP_ACCESS_COPY}");
    expect(MEMBER_COURSE_INCLUDED_COPY).toBe("This course is included with your membership.");
    expect(MEMBER_COURSE_OWNED_COPY).toBe("You own this course");
    expect(MEMBER_COURSE_KEEP_ACCESS_COPY).toBe(
      "Keep access to this course even if your membership ends.",
    );
    expect(offer).toContain("Buy for {priceLabel}");
    expect(offer).toContain("courseCheckoutPriceId");
    expect(offer).toContain("data-member-course-keep-buy");
    expect(offer).not.toMatch(/prc_|pln_/);
    expect(gate).toContain('btn.hasAttribute("data-member-course-keep-buy")');
    expect(gate).toContain('btn.hidden = paint === "open"');
    expect(layout).toContain("runMemberCourseKeepAccessBoot");
    expect(purchaseButton).toContain("Purchase this course");
    expect(purchaseButton).not.toContain("Buy for");
  });
});
