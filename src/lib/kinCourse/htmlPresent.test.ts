import { describe, expect, it } from "vitest";
import { applyKinCourseSrcRewrites, presentKinCourseHtml } from "./htmlPresent";
import { buildKinCourseLanding, readKinCoursePresentation } from "./presentation";

describe("Course 111 DEV asset presentation", () => {
  const presentation = readKinCoursePresentation(111);

  it("uses the same SK840 catalog image as /courses, not a production /challenge/ path", () => {
    const landing = buildKinCourseLanding({
      id: 111,
      title: "Mastering the Silver Reed SK840: A Comprehensive Course",
      slug: "mastering-the-silver-reed-sk840-a-comprehensive-course",
      thumbnail: "/images/courses/2022-course_thumbnail.webp",
      sections: [],
    });
    expect(landing.image.src).toBe("/images/courses/mastering-silver-reed-sk840.png");
    expect(landing.image.src).not.toContain("/challenge/");
  });

  it("rewrites leftover /challenge/images/v2/111/ URLs onto local course-content copies", () => {
    const html = presentKinCourseHtml(
      '<img src="/challenge/images/v2/111/learn_dak_logos.png"><span data-image="/challenge/images/v2/111/sensor.jpg"></span>',
      6104,
      presentation,
    );
    expect(html).toContain("/images/course-content/111/learn_dak_logos.png");
    expect(html).toContain('data-image="/images/course-content/111/sensor.jpg"');
    expect(html).not.toContain("/challenge/images/v2/111/");
  });

  it("does not require ?preview=true to select those rewrites", () => {
    expect(
      applyKinCourseSrcRewrites("/challenge/images/v2/111/cast_on_checklist.jpg", presentation),
    ).toBe("/images/course-content/111/cast_on_checklist.jpg");
  });
});
