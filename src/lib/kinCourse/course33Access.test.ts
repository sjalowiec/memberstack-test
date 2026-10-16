import { describe, expect, it } from "vitest";
import {
  homeStudyPlaybackHref,
  verifiedHomeStudyPlaybackCourse,
} from "../../config/homeStudyCourseMap";
import {
  BEGINNER_WORKSHOP_COURSE_SLUG,
  BROTHER_KH260_COURSE_SLUG,
  COURSE_INDIVIDUAL_SALES,
  LEGACY_BEGINNER_WORKSHOP_COURSE_PLAN_ID,
  LEGACY_COURSE_PLAN_SLUGS,
  LK150_FUN_COURSE_SLUG,
  LK150_PATTERNING_COURSE_SLUG,
} from "../../config/legacyCourseEntitlements";
import { COURSE_ACCESS_PLAN_IDS, MEMBER_PLAN_IDS, MEMBERSHIPS } from "../../config/memberships";
import {
  canAccessCourse,
  hasCourseMembershipAccess,
  hasIndividualCoursePurchase,
  hasVerifiedHomeStudyCourseAccess,
} from "../courseAccess";
import { readCourseContentFile } from "../legacy_kin/courseContentAdmin";
import { ownedCourseSlugsFromMember, ownedCoursesForAccount } from "./accountMyCourses";
import { courseCheckoutPriceId } from "./coursePurchase";

function payloadWithPlan(planId: string, status = "ACTIVE") {
  return {
    data: {
      id: "ms_member",
      auth: { email: "owner@example.com" },
      planConnections: [{ planId, status }],
    },
  };
}

const otherIndividualSlugs = [
  BROTHER_KH260_COURSE_SLUG,
  LK150_FUN_COURSE_SLUG,
  LK150_PATTERNING_COURSE_SLUG,
  "taitexma-th-tr-160-getting-started",
  "mastering-the-silver-reed-sk840",
  "lk-150-quick-start",
] as const;

describe("Course 33 Beginner Workshop legacy plan", () => {
  it("maps the legacy plan to Beginner Workshop only and does not sell it", () => {
    expect(LEGACY_BEGINNER_WORKSHOP_COURSE_PLAN_ID).toBe(
      "pln_course-beginner-workshop-legacy-wzr70hsx",
    );
    expect(LEGACY_COURSE_PLAN_SLUGS[LEGACY_BEGINNER_WORKSHOP_COURSE_PLAN_ID]).toEqual([
      BEGINNER_WORKSHOP_COURSE_SLUG,
    ]);
    expect(COURSE_INDIVIDUAL_SALES.beginnerWorkshop).toMatchObject({
      courseId: 33,
      slug: BEGINNER_WORKSHOP_COURSE_SLUG,
      aliases: ["33"],
      legacyPlanId: LEGACY_BEGINNER_WORKSHOP_COURSE_PLAN_ID,
    });
    expect(COURSE_INDIVIDUAL_SALES.beginnerWorkshop.paidPlanId).toBeUndefined();
    expect(COURSE_INDIVIDUAL_SALES.beginnerWorkshop.priceId).toBeUndefined();
    expect(courseCheckoutPriceId(BEGINNER_WORKSHOP_COURSE_SLUG)).toBeNull();
    expect(courseCheckoutPriceId("33")).toBeNull();
    expect(MEMBER_PLAN_IDS).not.toContain(LEGACY_BEGINNER_WORKSHOP_COURSE_PLAN_ID);
    expect(COURSE_ACCESS_PLAN_IDS).not.toContain(LEGACY_BEGINNER_WORKSHOP_COURSE_PLAN_ID);
  });

  it("lets a legacy owner open Course 33 without opening other individual courses", () => {
    const owner = payloadWithPlan(LEGACY_BEGINNER_WORKSHOP_COURSE_PLAN_ID);
    expect(hasIndividualCoursePurchase(BEGINNER_WORKSHOP_COURSE_SLUG, owner)).toBe(true);
    expect(hasIndividualCoursePurchase("33", owner)).toBe(true);
    expect(canAccessCourse("member", owner, { courseSlug: BEGINNER_WORKSHOP_COURSE_SLUG })).toBe(
      true,
    );
    expect(canAccessCourse("member", owner, { courseSlug: "33" })).toBe(true);
    expect(hasCourseMembershipAccess(owner)).toBe(false);
    for (const slug of otherIndividualSlugs) {
      expect(hasIndividualCoursePurchase(slug, owner)).toBe(false);
      expect(canAccessCourse("member", owner, { courseSlug: slug })).toBe(false);
    }
    expect(ownedCourseSlugsFromMember(owner)).toEqual([BEGINNER_WORKSHOP_COURSE_SLUG]);
    expect(ownedCoursesForAccount(owner)).toEqual([
      {
        slug: BEGINNER_WORKSHOP_COURSE_SLUG,
        title: "Beginner Workshop",
        href: "/courses/33",
      },
    ]);
    expect(
      ownedCourseSlugsFromMember(
        payloadWithPlan(LEGACY_BEGINNER_WORKSHOP_COURSE_PLAN_ID, "CANCELED"),
      ),
    ).toEqual([]);
  });

  it("keeps membership access and leaves Home Study course 33 unmapped", () => {
    const member = payloadWithPlan(MEMBERSHIPS.membership.memberstackPlanId);
    expect(canAccessCourse("member", member, { courseSlug: BEGINNER_WORKSHOP_COURSE_SLUG })).toBe(
      true,
    );
    expect(hasIndividualCoursePurchase(BEGINNER_WORKSHOP_COURSE_SLUG, member)).toBe(false);
    expect(canAccessCourse("member", member, { courseSlug: "ribber-basic-bootcamp" })).toBe(true);
    expect(verifiedHomeStudyPlaybackCourse(33)).toBeNull();
    expect(verifiedHomeStudyPlaybackCourse(BEGINNER_WORKSHOP_COURSE_SLUG)).toBeNull();
    expect(homeStudyPlaybackHref(33)).toBeNull();
    expect(hasVerifiedHomeStudyCourseAccess(BEGINNER_WORKSHOP_COURSE_SLUG, [33])).toBe(false);
    const poc = readCourseContentFile(33);
    expect(poc.course.slug).toBe(BEGINNER_WORKSHOP_COURSE_SLUG);
    expect(poc.course.status).toBe("draft");
    expect(poc.course.published).toBe(false);
  });
});
