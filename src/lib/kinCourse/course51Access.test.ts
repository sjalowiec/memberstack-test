import { describe, expect, it } from "vitest";
import {
  homeStudyPlaybackHref,
  verifiedHomeStudyPlaybackCourse,
} from "../../config/homeStudyCourseMap";
import {
  LEGACY_COURSE_PLAN_SLUGS,
  LEGACY_KIN_LK150_FUN_PLAN_ID,
  LK150_FUN_COURSE_PLAN_ID,
  LK150_FUN_COURSE_SLUG,
} from "../../config/legacyCourseEntitlements";
import { COURSE_ACCESS_PLAN_IDS, MEMBER_PLAN_IDS } from "../../config/memberships";
import { hasVerifiedHomeStudyCourseAccess } from "../courseAccess";
import { readCourseContentFile } from "../legacy_kin/courseContentAdmin";
import { accountCourseForHomeStudyId } from "./homeStudyPurchaseAccess";
import { courseCheckoutPriceId } from "./coursePurchase";

describe("Course 51 LK-150 Fun publication", () => {
  it("publishes the reviewed course with the one-time LK150 Fun price", () => {
    const poc = readCourseContentFile(51);
    expect(poc.course.legacyChallengeId).toBe(51);
    expect(poc.course.title).toBe("LK-150 Fun");
    expect(poc.course.slug).toBe(LK150_FUN_COURSE_SLUG);
    expect(poc.course.status).toBe("published");
    expect(poc.course.published).toBe(true);
    expect(poc.course.thumbnail).toBe("/images/courses/lk-150_fun.webp");
    expect(courseCheckoutPriceId(LK150_FUN_COURSE_SLUG)).toBe("prc_course-lk150-fun-594h0mo4");
    expect(courseCheckoutPriceId("51")).toBe("prc_course-lk150-fun-594h0mo4");
    expect(courseCheckoutPriceId("51")).not.toBe("pln_course-lk150-fun-p21x0ren");
    expect(MEMBER_PLAN_IDS).not.toContain(LK150_FUN_COURSE_PLAN_ID);
    expect(MEMBER_PLAN_IDS).not.toContain(LEGACY_KIN_LK150_FUN_PLAN_ID);
    expect(COURSE_ACCESS_PLAN_IDS).not.toContain(LK150_FUN_COURSE_PLAN_ID);
    expect(COURSE_ACCESS_PLAN_IDS).not.toContain(LEGACY_KIN_LK150_FUN_PLAN_ID);
    expect(LEGACY_COURSE_PLAN_SLUGS[LK150_FUN_COURSE_PLAN_ID]).toEqual([LK150_FUN_COURSE_SLUG]);
    expect(LEGACY_COURSE_PLAN_SLUGS[LEGACY_KIN_LK150_FUN_PLAN_ID]).toEqual([LK150_FUN_COURSE_SLUG]);
  });

  it("does not treat Home Study course 51 as LK-150 Fun", () => {
    expect(verifiedHomeStudyPlaybackCourse(51)).toBeNull();
    expect(verifiedHomeStudyPlaybackCourse("51")).toBeNull();
    expect(verifiedHomeStudyPlaybackCourse(LK150_FUN_COURSE_SLUG)).toBeNull();
    expect(homeStudyPlaybackHref(51)).toBeNull();
    expect(hasVerifiedHomeStudyCourseAccess(LK150_FUN_COURSE_SLUG, [51])).toBe(false);
    expect(accountCourseForHomeStudyId(51)).toEqual({
      courseId: 51,
      title: "Home Study course 51",
      href: null,
      availability: "not_on_site",
    });
  });
});
