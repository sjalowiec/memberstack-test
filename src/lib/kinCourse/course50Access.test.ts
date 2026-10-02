import { describe, expect, it } from "vitest";
import {
  homeStudyPlaybackHref,
  verifiedHomeStudyPlaybackCourse,
} from "../../config/homeStudyCourseMap";
import {
  LEGACY_COURSE_PLAN_SLUGS,
  LK150_FUN_COURSE_PLAN_ID,
  LK150_FUN_COURSE_SLUG,
  LK150_PATTERNING_COURSE_PLAN_ID,
  LK150_PATTERNING_COURSE_SLUG,
  LK150_QUICK_START_COURSE_PLAN_ID,
  LK150_QUICK_START_COURSE_SLUG,
} from "../../config/legacyCourseEntitlements";
import { COURSE_ACCESS_PLAN_IDS, MEMBER_PLAN_IDS, MEMBERSHIPS } from "../../config/memberships";
import {
  canAccessCourse,
  getCourseViewerState,
  hasIndividualCoursePurchase,
  hasVerifiedHomeStudyCourseAccess,
} from "../courseAccess";
import { getCourseAccessBySlug } from "../coursesCatalogAccess";
import { readCourseContentFile } from "../legacy_kin/courseContentAdmin";
import { accountCourseForHomeStudyId } from "./homeStudyPurchaseAccess";
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

const loggedInNeither = {
  data: { id: "ms_nosub", auth: { email: "nosub@example.com" }, planConnections: [] },
};

describe("Course 50 LK-150 Quick Start legacy plan", () => {
  it("opens for a legacy owner or an active member, and stays closed otherwise", () => {
    const poc = readCourseContentFile(50);
    const slug = LK150_QUICK_START_COURSE_SLUG;
    const access = getCourseAccessBySlug(slug);
    const owner = payloadWithPlan(LK150_QUICK_START_COURSE_PLAN_ID);
    const member = payloadWithPlan(MEMBERSHIPS.membership.memberstackPlanId);
    const inactiveMember = payloadWithPlan(MEMBERSHIPS.membership.memberstackPlanId, "CANCELED");

    expect(poc.course.legacyChallengeId).toBe(50);
    expect(poc.course.title).toBe("LK-150 Quick Start");
    expect(poc.course.slug).toBe(slug);
    expect(poc.course.status).toBe("published");
    expect(poc.course.published).toBe(true);
    expect(poc.course.legacy.contentRevision).toBe(1);
    expect(access).toBe("member");
    expect(canAccessCourse(access, owner, { courseSlug: slug })).toBe(true);
    expect(canAccessCourse(access, member, { courseSlug: slug })).toBe(true);
    expect(canAccessCourse(access, null, { courseSlug: slug })).toBe(false);
    expect(getCourseViewerState(access, null, { courseSlug: slug })).toBe("loggedOut");
    expect(canAccessCourse(access, loggedInNeither, { courseSlug: slug })).toBe(false);
    expect(getCourseViewerState(access, loggedInNeither, { courseSlug: slug })).toBe("needsMembership");
    expect(canAccessCourse(access, inactiveMember, { courseSlug: slug })).toBe(false);
    expect(courseCheckoutPriceId(slug)).toBeNull();
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

  it("does not treat Home Study course 50 as this player", () => {
    expect(verifiedHomeStudyPlaybackCourse(50)).toBeNull();
    expect(verifiedHomeStudyPlaybackCourse("50")).toBeNull();
    expect(verifiedHomeStudyPlaybackCourse(LK150_QUICK_START_COURSE_SLUG)).toBeNull();
    expect(homeStudyPlaybackHref(50)).toBeNull();
    expect(hasVerifiedHomeStudyCourseAccess(LK150_QUICK_START_COURSE_SLUG, [50])).toBe(false);
    expect(accountCourseForHomeStudyId(50)).toEqual({
      courseId: 50,
      title: "Home Study course 50",
      href: null,
      availability: "not_on_site",
    });
  });
});
