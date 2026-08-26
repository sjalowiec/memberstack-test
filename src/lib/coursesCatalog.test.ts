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
  const sk840ProductionHref = "https://courses.knititnow.com/courses/111";
  const sk840DevHref =
    "/courses/legacy/mastering-the-silver-reed-sk840-a-comprehensive-course?preview=true";

  it("keeps the production KIN URL on production hosts", () => {
    const entry = getCourseCatalogEntries({ hostname: "www.knititnow.com" }).find(
      (course) => course.slug === "mastering-the-silver-reed-sk840",
    );
    expect(entry?.href).toBe(sk840ProductionHref);
    expect(entry?.buttonLabel).toBe("View Course");
    expect(entry?.title).toBe("Mastering the Silver Reed SK840");
    expect(entry?.access).toBe("member");
    expect(entry?.category).toBe("Silver Reed");
    expect(entry?.href).not.toContain("mastering-the-silver-reed-sk840-a-comprehensive-course");
    expect(entry?.href).not.toMatch(/^\/courses\//);
    expect(entry?.hasThumbnail).toBe(true);
    expect(entry?.thumbnail).toBe("/images/courses/mastering-silver-reed-sk840.png");
    expect(entry?.thumbnail).not.toContain("2022-course_thumbnail");
    expect(entry?.thumbnail).not.toContain("courses.knititnow.com");
  });

  it("stays on DEV for the SK840 catalog card", () => {
    const entry = getCourseCatalogEntries({ hostname: "kin-dev.netlify.app" }).find(
      (course) => course.slug === "mastering-the-silver-reed-sk840",
    );
    expect(entry?.href).toBe(sk840DevHref);
    expect(entry?.href).toMatch(/^\/courses\/legacy\//);
    expect(entry?.href).not.toContain("courses.knititnow.com");
    expect(entry?.href).not.toMatch(/^https?:\/\//);
    expect(entry?.buttonLabel).toBe("View Course");
  });

  it("stays on localhost for the SK840 catalog card", () => {
    const entry = getCourseCatalogEntries({
      hostname: "localhost",
      isViteDev: true,
    }).find((course) => course.slug === "mastering-the-silver-reed-sk840");
    expect(entry?.href).toBe(sk840DevHref);
    expect(entry?.href).not.toContain("courses.knititnow.com");
  });

  it("does not use the production KIN host from the catalog on DEV", () => {
    for (const entry of getCourseCatalogEntries({ hostname: "kin-dev.netlify.app" })) {
      if (entry.href) {
        expect(entry.href).not.toContain("courses.knititnow.com");
        expect(entry.href).not.toMatch(/^https?:\/\/(?:www\.)?knititnow\.com\//);
      }
    }
  });

  it("does not link to legacy routes from the production catalog", () => {
    for (const entry of getCourseCatalogEntries({ hostname: "www.knititnow.com" })) {
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
    expect(entries[0]?.href).toBe(
      "/courses/legacy/mastering-the-silver-reed-sk840-a-comprehensive-course?preview=true",
    );
    expect(entries[0]?.href).not.toContain("courses.knititnow.com");

    const productionEntries = getCourseCatalogEntries({ hostname: "knititnow.com" });
    expect(productionEntries[0]?.href).toBe("https://courses.knititnow.com/courses/111");
    expect(entries[0]?.access).toBe("member");
    expect(entries[0]?.hasThumbnail).toBe(true);
    expect(entries[0]?.thumbnail).toBe("/images/courses/mastering-silver-reed-sk840.png");

    const slugs = entries.map((course) => course.slug);
    for (const slug of hiddenPublicCatalogSlugs) {
      expect(slugs).not.toContain(slug);
    }
    expect(getCourseCatalogCategories()).toEqual(["Silver Reed"]);
    expect(sections.map((section) => section.category)).toEqual(["Silver Reed"]);
  });
});
