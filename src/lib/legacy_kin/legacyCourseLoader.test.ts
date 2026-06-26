import { describe, expect, it } from "vitest";
import {
  getLegacyCourseBySlug,
  getLegacyCourses,
  legacyCourseLoadOptionsFromPreviewRequest,
  legacyCoursePreviewHref,
} from "./legacyCourseLoader";

describe("getLegacyCourses public visibility", () => {
  it("hides migrated draft courses from the public index", () => {
    const slugs = getLegacyCourses().map((course) => course.slug);
    expect(slugs).not.toContain("not-enough-needles");
  });

  it("keeps hand-cleaned courses without publish flags visible", () => {
    const slugs = getLegacyCourses().map((course) => course.slug);
    expect(slugs).toContain("lk-150-quick-start");
    expect(slugs).toContain("lk-150-fun");
  });

  it("includes draft courses when includeDrafts is true", () => {
    const slugs = getLegacyCourses({ includeDrafts: true }).map((course) => course.slug);
    expect(slugs).toContain("not-enough-needles");
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

  it("does not return draft migrated courses on public routes", () => {
    expect(getLegacyCourseBySlug("not-enough-needles")).toBeUndefined();
  });

  it("returns draft migrated courses when includeDrafts is true", () => {
    const course = getLegacyCourseBySlug("not-enough-needles", { includeDrafts: true });
    expect(course?.course.legacyChallengeId).toBe(2);
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
