import { describe, expect, it } from "vitest";
import {
  getCourseCatalogEntries,
  resolveCatalogStatus,
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
});

describe("resolveCatalogStatus", () => {
  it("shows in-progress for active draft courses with contentStatus in_progress", () => {
    expect(resolveCatalogStatus("beginner-workshop", "coming-soon")).toBe("in-progress");
    const entry = getCourseCatalogEntries().find((course) => course.slug === "beginner-workshop");
    expect(entry?.status).toBe("in-progress");
    expect(entry?.buttonLabel).toBe("In progress");
  });

  it("shows available for published cleaned courses", () => {
    expect(resolveCatalogStatus("ribber-basic-bootcamp", "coming-soon")).toBe("available");
    const entry = getCourseCatalogEntries().find((course) => course.slug === "ribber-basic-bootcamp");
    expect(entry?.status).toBe("available");
    expect(entry?.buttonLabel).toBe("Start course");
  });

  it("keeps static catalogStatus when no course JSON exists", () => {
    expect(resolveCatalogStatus("missing-course-slug", "coming-soon")).toBe("coming-soon");
  });
});
