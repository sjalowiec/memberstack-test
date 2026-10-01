import { describe, expect, it } from "vitest";
import {
  LK150_FUN_COURSE_PLAN_ID,
  LK150_FUN_COURSE_SLUG,
} from "../../config/legacyCourseEntitlements";
import { COURSE_ACCESS_PLAN_IDS, MEMBER_PLAN_IDS } from "../../config/memberships";
import { readCourseContentFile } from "../legacy_kin/courseContentAdmin";
import { courseCheckoutPriceId } from "./coursePurchase";

describe("Course 51 LK-150 Fun publication", () => {
  it("publishes the reviewed course without a checkout price", () => {
    const poc = readCourseContentFile(51);
    expect(poc.course.legacyChallengeId).toBe(51);
    expect(poc.course.title).toBe("LK-150 Fun");
    expect(poc.course.slug).toBe(LK150_FUN_COURSE_SLUG);
    expect(poc.course.status).toBe("published");
    expect(poc.course.published).toBe(true);
    expect(poc.course.thumbnail).toBe("/images/courses/lk-150_fun.webp");
    expect(courseCheckoutPriceId(LK150_FUN_COURSE_SLUG)).toBeNull();
    expect(courseCheckoutPriceId("51")).toBeNull();
    expect(MEMBER_PLAN_IDS).not.toContain(LK150_FUN_COURSE_PLAN_ID);
    expect(COURSE_ACCESS_PLAN_IDS).not.toContain(LK150_FUN_COURSE_PLAN_ID);
  });
});
