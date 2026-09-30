import { describe, expect, it } from "vitest";
import {
  homeStudyPlaybackHref,
  homeStudyPlaybackTitle,
  verifiedHomeStudyPlaybackCourse,
} from "../../config/homeStudyCourseMap";
import {
  LK150_PATTERNING_COURSE_PLAN_ID,
  LK150_PATTERNING_COURSE_SLUG,
} from "../../config/legacyCourseEntitlements";
import { MEMBER_PLAN_IDS, COURSE_ACCESS_PLAN_IDS } from "../../config/memberships";
import { hasVerifiedHomeStudyCourseAccess } from "../courseAccess";
import { readCourseContentFile } from "../legacy_kin/courseContentAdmin";
import { accountCourseForHomeStudyId } from "./homeStudyPurchaseAccess";
import { courseCheckoutPriceId } from "./coursePurchase";

describe("Course 34 LK150 Patterning entitlement", () => {
  it("publishes the course and leaves lesson identity in place", () => {
    const poc = readCourseContentFile(34);
    expect(poc.course.legacyChallengeId).toBe(34);
    expect(poc.course.title).toBe("Master LK-150 Patterning");
    expect(poc.course.slug).toBe(LK150_PATTERNING_COURSE_SLUG);
    expect(poc.course.status).toBe("published");
    expect(poc.course.published).toBe(true);
    expect(poc.course.thumbnail).toBe("/images/courses/lk-150_patterning.webp");
    expect(JSON.stringify(poc)).not.toContain("preview=true");
    expect(JSON.stringify(poc)).toContain(
      "/courses/legacy/master-lk-patterning/miscellaneous/free-pass-refresher",
    );
    expect(poc.lessons.map((lesson) => [lesson.displayOrder, lesson.slug])).toEqual([
      [1, "intro-to-patterning"],
      [15, "selecting-needles-for-stitch-patterning"],
      [20, "tuck"],
      [30, "slip-skip"],
      [40, "plating"],
      [45, "fairisle-stranded-knitting"],
      [70, "intarsia"],
      [90, "miscellaneous"],
    ]);
  });

  it("does not sell Course 34 or add its plan to membership access", () => {
    expect(courseCheckoutPriceId(LK150_PATTERNING_COURSE_SLUG)).toBeNull();
    expect(courseCheckoutPriceId("34")).toBeNull();
    expect(MEMBER_PLAN_IDS).not.toContain(LK150_PATTERNING_COURSE_PLAN_ID);
    expect(COURSE_ACCESS_PLAN_IDS).not.toContain(LK150_PATTERNING_COURSE_PLAN_ID);
  });

  it("does not treat Home Study course 34 as this player", () => {
    expect(verifiedHomeStudyPlaybackCourse(34)).toBeNull();
    expect(verifiedHomeStudyPlaybackCourse("34")).toBeNull();
    expect(verifiedHomeStudyPlaybackCourse(LK150_PATTERNING_COURSE_SLUG)).toBeNull();
    expect(homeStudyPlaybackHref(34)).toBeNull();
    expect(homeStudyPlaybackTitle(34)).toBeNull();
    expect(verifiedHomeStudyPlaybackCourse(86)?.courseId).toBe(86);
    expect(verifiedHomeStudyPlaybackCourse(87)?.courseId).toBe(87);
    expect(verifiedHomeStudyPlaybackCourse(111)?.courseId).toBe(111);
    expect(
      hasVerifiedHomeStudyCourseAccess(LK150_PATTERNING_COURSE_SLUG, [34]),
    ).toBe(false);
    expect(accountCourseForHomeStudyId(34)).toEqual({
      courseId: 34,
      title: "Home Study course 34",
      href: null,
      availability: "not_on_site",
    });
  });
});
