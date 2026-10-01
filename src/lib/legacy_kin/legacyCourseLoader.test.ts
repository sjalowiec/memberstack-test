import { describe, expect, it } from "vitest";
import {
  getLegacyCourseBySlug,
  getLegacyCourses,
  getLegacyLessonBySlug,
  getSortedLessonsForCourse,
  legacyCourseLoadOptionsFromPreviewRequest,
  legacyCoursePreviewHref,
  sequentialLessonNumber,
} from "./legacyCourseLoader";

describe("getLegacyCourses public visibility", () => {
  it("hides migrated draft courses from the public index", () => {
    const slugs = getLegacyCourses().map((course) => course.slug);
    expect(slugs).not.toContain("nothing-fits-draft");
  });

  it("keeps published and hand-cleaned courses visible", () => {
    const slugs = getLegacyCourses().map((course) => course.slug);
    expect(slugs).toContain("not-enough-needles");
    expect(slugs).toContain("lk-150-quick-start");
    expect(slugs).toContain("lk-150-fun");
    expect(slugs).toContain("ribber-basic-bootcamp");
  });

  it("includes draft courses when includeDrafts is true", () => {
    const slugs = getLegacyCourses({ includeDrafts: true }).map((course) => course.slug);
    expect(slugs).toContain("nothing-fits-draft");
    expect(slugs).toContain("lk-150-quick-start");
  });
});

describe("getLegacyCourseBySlug", () => {
  it("returns hand-cleaned course 50 by slug", () => {
    const course = getLegacyCourseBySlug("lk-150-quick-start");
    expect(course?.course.legacyChallengeId).toBe(50);
    expect(course?.course.title).toBe("LK-150 Quick Start");
  });

  it("returns hand-cleaned course 51 by slug", () => {
    const course = getLegacyCourseBySlug("lk-150-fun");
    expect(course?.course.legacyChallengeId).toBe(51);
  });

  it("returns published migrated Course 2 on public routes", () => {
    const course = getLegacyCourseBySlug("not-enough-needles");
    expect(course?.course.legacyChallengeId).toBe(2);
    expect(course?.course.status).toBe("published");
  });

  it("does not return draft migrated courses on public routes", () => {
    expect(getLegacyCourseBySlug("nothing-fits-draft")).toBeUndefined();
  });

  it("returns draft migrated courses when includeDrafts is true", () => {
    const course = getLegacyCourseBySlug("nothing-fits-draft", { includeDrafts: true });
    expect(course?.course.legacyChallengeId).toBe(24);
    expect(course?.course.status).toBe("draft");
  });
});

describe("legacyCoursePreviewHref", () => {
  it("opens LK-150 Quick Start lesson on the public route without preview query", () => {
    expect(
      legacyCoursePreviewHref("lk-150-quick-start", "yarn-and-a-bit-more-tech", {
        includeDraftPreview: false,
      }),
    ).toBe("/courses/legacy/lk-150-quick-start/yarn-and-a-bit-more-tech");
  });

  it("opens draft Course 2 lesson with preview=true", () => {
    expect(
      legacyCoursePreviewHref("not-enough-needles", "decorative-seams", {
        includeDraftPreview: true,
      }),
    ).toBe("/courses/legacy/not-enough-needles/decorative-seams?preview=true");
  });

  it("opens a specific lesson item on the public route", () => {
    expect(
      legacyCoursePreviewHref("lk-150-quick-start", "yarn-and-a-bit-more-tech", {
        itemSlug: "yarn-and-tension",
        includeDraftPreview: false,
      }),
    ).toBe(
      "/courses/legacy/lk-150-quick-start/yarn-and-a-bit-more-tech/yarn-and-tension",
    );
  });

  it("opens draft Course 2 item with preview=true", () => {
    expect(
      legacyCoursePreviewHref("not-enough-needles", "decorative-seams", {
        itemSlug: "hairpin-lace-seam",
        includeDraftPreview: true,
      }),
    ).toBe(
      "/courses/legacy/not-enough-needles/decorative-seams/hairpin-lace-seam?preview=true",
    );
  });

  it("returns null when course slug is missing", () => {
    expect(legacyCoursePreviewHref("", "decorative-seams")).toBeNull();
  });
});

describe("Course 34 lesson order", () => {
  const drafts = { includeDrafts: true as const };

  it("keeps stored displayOrder as the legacy reference and numbers lessons by position", () => {
    const course = getLegacyCourseBySlug("master-lk-patterning", drafts);
    expect(course).toBeDefined();
    const lessons = getSortedLessonsForCourse(course!, drafts);
    expect(lessons.map((lesson) => lesson.slug)).toEqual([
      "intro-to-patterning",
      "selecting-needles-for-stitch-patterning",
      "tuck",
      "slip-skip",
      "plating",
      "fairisle-stranded-knitting",
      "intarsia",
      "miscellaneous",
    ]);
    expect(lessons.map((lesson) => lesson.displayOrder)).toEqual([
      1, 15, 20, 30, 40, 45, 70, 90,
    ]);
    expect(lessons.map((lesson) => lesson.legacy.lessonOrder)).toEqual([
      1, 15, 20, 30, 40, 45, 70, 90,
    ]);
    expect(lessons.map((_, index) => sequentialLessonNumber(index))).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8,
    ]);
  });

  it("opens Course 51 Quick Project by its readable address and by the stored lesson id", () => {
    const drafts = { includeDrafts: true };
    const byId = getLegacyLessonBySlug("lk-150-fun", "lesson-1790793285497", drafts);
    const byTitle = getLegacyLessonBySlug("lk-150-fun", "quick-project", drafts);
    expect(byId?.title).toBe("Quick Project");
    expect(byId?.slug).toBe("lesson-1790793285497");
    expect(byTitle?.slug).toBe("lesson-1790793285497");
    expect(byTitle?.legacy.itemId).toBe(796);
  });

  it("still opens lessons by slug and by the original displayOrder reference", () => {
    expect(getLegacyLessonBySlug("master-lk-patterning", "tuck", drafts)?.title).toBe("TUCK");
    expect(getLegacyLessonBySlug("master-lk-patterning", "15", drafts)?.slug).toBe(
      "selecting-needles-for-stitch-patterning",
    );
    expect(getLegacyLessonBySlug("master-lk-patterning", "90", drafts)?.slug).toBe(
      "miscellaneous",
    );
  });
});

describe("legacyCourseLoadOptionsFromPreviewRequest", () => {
  it("allows draft preview on localhost staging", () => {
    expect(
      legacyCourseLoadOptionsFromPreviewRequest("true", "localhost", {
        isViteDev: true,
      }),
    ).toEqual({ includeDrafts: true });
  });

  it("blocks draft preview on production hosts", () => {
    expect(
      legacyCourseLoadOptionsFromPreviewRequest("true", "www.knititnow.com"),
    ).toEqual({});
  });
});
