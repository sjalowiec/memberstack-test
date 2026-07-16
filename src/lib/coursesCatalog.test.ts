import { describe, expect, it } from "vitest";
import {
  getCourseCatalogEntries,
  resolveCatalogStatus,
  resolveCourseCatalogDescription,
  resolveCourseThumbnail,
} from "./coursesCatalog";

describe("resolveCourseThumbnail", () => {
  it("prefers course JSON thumbnail over catalog overlay", () => {
    expect(
      resolveCourseThumbnail("lk-150-quick-start", "available", "/images/fallback.jpg"),
    ).toBe("/images/courses/lk-150_quick.webp");
  });

  it("uses catalog overlay when course JSON has no thumbnail", () => {
    expect(
      resolveCourseThumbnail("missing-course-slug", "coming-soon", "/images/overlay.jpg"),
    ).toBe("/images/overlay.jpg");
  });

  it("returns undefined when no thumbnail is configured", () => {
    expect(resolveCourseThumbnail("missing-course-slug", "coming-soon")).toBeUndefined();
  });

  it("resolves not-enough-needles thumbnail from course JSON metadata", () => {
    expect(resolveCourseThumbnail("not-enough-needles", "in-progress")).toBe(
      "/images/courses/not_enough.webp",
    );
  });
});

describe("getCourseCatalogEntries href", () => {
  it("links available courses to the dynamic landing page", () => {
    const entry = getCourseCatalogEntries().find((course) => course.slug === "lk-150-quick-start");
    expect(entry?.href).toBe("/courses/lk-150-quick-start");
  });

  it("links non-available catalog entries to the landing page when course JSON exists", () => {
    const entry = getCourseCatalogEntries().find((course) => course.slug === "beginner-workshop");
    expect(entry?.href).toBe("/courses/beginner-workshop");
  });

  it("does not link to legacy lesson routes from the catalog", () => {
    for (const entry of getCourseCatalogEntries()) {
      if (entry.href) {
        expect(entry.href).not.toMatch(/^\/courses\/legacy\//);
      }
    }
  });

  it("shows not-enough-needles with its course JSON thumbnail on the catalog card", () => {
    const entry = getCourseCatalogEntries().find((course) => course.slug === "not-enough-needles");
    expect(entry?.hasThumbnail).toBe(true);
    expect(entry?.thumbnail).toBe("/images/courses/not_enough.webp");
  });

  it("uses courses-catalog.json fallback when course JSON has no custom description", () => {
    const entry = getCourseCatalogEntries().find((course) => course.slug === "beginner-workshop");
    expect(entry?.description).toBe("A guided start-to-finish path for new machine knitters.");
    const resolved = resolveCourseCatalogDescription("beginner-workshop", "coming-soon");
    expect(resolved.source).toBe("fallback");
  });

  it("uses custom course JSON description when set", () => {
    const resolved = resolveCourseCatalogDescription("ribber-basic-bootcamp", "available");
    if (resolved.customDescription) {
      expect(resolved.source).toBe("custom");
      expect(resolved.description).toBe(resolved.customDescription);
    } else {
      expect(resolved.source).toBe("fallback");
      expect(resolved.description).toContain("Get comfortable with your ribber");
    }
    expect(resolved.description).not.toContain("\uFFFD");
  });
});

describe("resolveCatalogStatus", () => {
  it("shows in-progress for active draft courses with contentStatus in_progress", () => {
    expect(resolveCatalogStatus("nothing-fits-draft", "coming-soon")).toBe("in-progress");
  });

  it(
    "shows available for published cleaned courses",
    () => {
      expect(resolveCatalogStatus("not-enough-needles", "coming-soon")).toBe("available");
      expect(resolveCatalogStatus("ribber-basic-bootcamp", "coming-soon")).toBe("available");
      expect(resolveCatalogStatus("beginner-workshop", "coming-soon")).toBe("available");

      const entries = getCourseCatalogEntries();
      for (const slug of ["not-enough-needles", "ribber-basic-bootcamp", "beginner-workshop"]) {
        const entry = entries.find((course) => course.slug === slug);
        expect(entry?.status).toBe("available");
        expect(entry?.buttonLabel).toBe("Start course");
      }
    },
    20_000,
  );

  it("keeps static catalogStatus when no course JSON exists", () => {
    expect(resolveCatalogStatus("missing-course-slug", "coming-soon")).toBe("coming-soon");
  });
});
