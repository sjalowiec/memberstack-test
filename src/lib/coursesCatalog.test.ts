import { describe, expect, it } from "vitest";
import {
  getCourseCatalogCategories,
  getCourseCatalogEntries,
  getCourseCatalogEntriesByCategory,
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
  it("uses a catalog href override for standalone destinations", () => {
    const entry = getCourseCatalogEntries().find(
      (course) => course.slug === "mastering-the-silver-reed-sk840",
    );
    expect(entry?.href).toBe("https://courses.knititnow.com/courses/111");
    expect(entry?.buttonLabel).toBe("View Course");
    expect(entry?.title).toBe("Mastering the Silver Reed SK840");
    expect(entry?.access).toBe("member");
    expect(entry?.category).toBe("Silver Reed");
    expect(entry?.href).not.toContain("mastering-the-silver-reed-sk840-a-comprehensive-course");
    expect(entry?.href).not.toMatch(/^\/courses\//);
  });

  it("does not link to legacy lesson routes from the catalog", () => {
    for (const entry of getCourseCatalogEntries()) {
      if (entry.href) {
        expect(entry.href).not.toMatch(/^\/courses\/legacy\//);
      }
    }
  });

  it("uses courses-catalog.json fallback when course JSON has no custom description", () => {
    const resolved = resolveCourseCatalogDescription("beginner-workshop", "coming-soon");
    expect(resolved.source).toBe("fallback");
    expect(resolved.description).toBe("A guided start-to-finish path for new machine knitters.");
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
    },
    20_000,
  );

  it("keeps static catalogStatus when no course JSON exists", () => {
    expect(resolveCatalogStatus("missing-course-slug", "coming-soon")).toBe("coming-soon");
  });
});

describe("public course catalog cleanup", () => {
  const hiddenPublicCatalogSlugs = [
    "lk-150-quick-start",
    "lk-150-fun",
    "beginner-workshop",
    "ribber-basic-bootcamp",
    "not-enough-needles",
    "yes-knits-that-fit",
    "neckline-shaping-practice",
    "mastering-the-silver-reed-sk840-a-comprehensive-course",
  ] as const;

  it("lists SK840 as the only public catalog course in Silver Reed", () => {
    const sections = getCourseCatalogEntriesByCategory();
    expect(sections).toHaveLength(1);
    expect(sections[0]?.category).toBe("Silver Reed");
    expect(sections[0]?.courses.map((course) => course.slug)).toEqual([
      "mastering-the-silver-reed-sk840",
    ]);

    const entries = getCourseCatalogEntries();
    expect(entries).toHaveLength(1);
    expect(entries[0]?.slug).toBe("mastering-the-silver-reed-sk840");
    expect(entries[0]?.title).toBe("Mastering the Silver Reed SK840");
    expect(entries[0]?.buttonLabel).toBe("View Course");
    expect(entries[0]?.href).toBe("https://courses.knititnow.com/courses/111");
    expect(entries[0]?.access).toBe("member");

    const slugs = entries.map((course) => course.slug);
    for (const slug of hiddenPublicCatalogSlugs) {
      expect(slugs).not.toContain(slug);
    }
    expect(getCourseCatalogCategories()).toEqual(["Silver Reed"]);
    expect(sections.map((section) => section.category)).toEqual(["Silver Reed"]);
  });
});
