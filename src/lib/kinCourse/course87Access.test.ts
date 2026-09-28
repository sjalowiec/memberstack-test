import { describe, expect, it } from "vitest";
import { readCourseContentFile } from "../legacy_kin/courseContentAdmin";
import { BROTHER_KH260_COURSE_SLUG } from "../../config/legacyCourseEntitlements";
import { courseCheckoutPriceId, shouldShowKinCourseSalesPage } from "./coursePurchase";
import { loadKinCourseBundle } from "./load";

describe("Course 87 local DEV publication", () => {
  it("publishes the player without a paid price", async () => {
    const poc = readCourseContentFile(87);
    expect(poc.course.status).toBe("published");
    expect(poc.course.published).toBe(true);
    expect(poc.course.slug).toBe(BROTHER_KH260_COURSE_SLUG);
    expect(poc.course.thumbnail).toBe("/images/courses/260.webp");

    const bundle = await loadKinCourseBundle(87);
    expect(bundle?.course.id).toBe(87);
    expect(bundle?.course.title).toBe("Brother KH/KR-260 Quick Start");
    expect(courseCheckoutPriceId("87")).toBeNull();
    expect(courseCheckoutPriceId(BROTHER_KH260_COURSE_SLUG)).toBeNull();
    expect(
      shouldShowKinCourseSalesPage({ courseSlug: "87", hasAccess: false }),
    ).toBe(false);
  });
});
