import { describe, expect, it } from "vitest";
import {
  LEGACY_COURSE_PLAN_SLUGS,
  LK150_FUN_COURSE_PLAN_ID,
  LK150_FUN_COURSE_SLUG,
  LK150_PATTERNING_COURSE_PLAN_ID,
  LK150_PATTERNING_COURSE_SLUG,
  LK150_QUICK_START_COURSE_PLAN_ID,
  LK150_QUICK_START_COURSE_SLUG,
} from "../../config/legacyCourseEntitlements";
import { COURSE_ACCESS_PLAN_IDS, MEMBER_PLAN_IDS } from "../../config/memberships";
import { canAccessCourse, hasIndividualCoursePurchase } from "../courseAccess";
import { getCourseAccessBySlug } from "../coursesCatalogAccess";
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

describe("Course 50 LK-150 Quick Start legacy plan", () => {
  it("keeps the published course free and unsold", () => {
    const poc = readCourseContentFile(50);
    expect(poc.course.legacyChallengeId).toBe(50);
    expect(poc.course.title).toBe("LK-150 Quick Start");
    expect(poc.course.slug).toBe(LK150_QUICK_START_COURSE_SLUG);
    expect(poc.course.status).toBe("published");
    expect(poc.course.published).toBe(true);
    expect(getCourseAccessBySlug(LK150_QUICK_START_COURSE_SLUG)).toBe("free");
    expect(canAccessCourse("free", null, { courseSlug: LK150_QUICK_START_COURSE_SLUG })).toBe(true);
    expect(courseCheckoutPriceId(LK150_QUICK_START_COURSE_SLUG)).toBeNull();
    expect(courseCheckoutPriceId("50")).toBeNull();
    expect(MEMBER_PLAN_IDS).not.toContain(LK150_QUICK_START_COURSE_PLAN_ID);
    expect(COURSE_ACCESS_PLAN_IDS).not.toContain(LK150_QUICK_START_COURSE_PLAN_ID);
  });

  it("maps the legacy plan to Course 50 and shows it in the owner library", () => {
    expect(LEGACY_COURSE_PLAN_SLUGS[LK150_QUICK_START_COURSE_PLAN_ID]).toEqual([
      LK150_QUICK_START_COURSE_SLUG,
    ]);
    const owner = payloadWithPlan(LK150_QUICK_START_COURSE_PLAN_ID);
    expect(hasIndividualCoursePurchase(LK150_QUICK_START_COURSE_SLUG, owner)).toBe(true);
    expect(hasIndividualCoursePurchase("50", owner)).toBe(true);
    expect(ownedCourseSlugsFromMember(owner)).toEqual([LK150_QUICK_START_COURSE_SLUG]);
    expect(ownedCoursesForAccount(owner)).toEqual([
      {
        slug: LK150_QUICK_START_COURSE_SLUG,
        title: "LK-150 Quick Start",
        href: "/courses/50",
      },
    ]);
    expect(hasIndividualCoursePurchase(LK150_PATTERNING_COURSE_SLUG, owner)).toBe(false);
    expect(hasIndividualCoursePurchase(LK150_FUN_COURSE_SLUG, owner)).toBe(false);
    expect(ownedCourseSlugsFromMember(payloadWithPlan(LK150_PATTERNING_COURSE_PLAN_ID))).toEqual([
      LK150_PATTERNING_COURSE_SLUG,
    ]);
    expect(ownedCourseSlugsFromMember(payloadWithPlan(LK150_FUN_COURSE_PLAN_ID))).toEqual([
      LK150_FUN_COURSE_SLUG,
    ]);
    expect(
      ownedCourseSlugsFromMember(payloadWithPlan(LK150_QUICK_START_COURSE_PLAN_ID, "CANCELED")),
    ).toEqual([]);
  });
});
