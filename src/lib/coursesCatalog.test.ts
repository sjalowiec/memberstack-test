import { describe, expect, it } from "vitest";
import {
  getCourseCatalogCategories,
  getCourseCatalogEntries,
  getCourseCatalogEntriesByCategory,
  groupCourseCatalogSections,
  LK150_COURSES_HEADING,
  MACHINE_SPECIFIC_COURSES_HEADING,
  resolveCatalogStatus,
  resolveCourseCatalogDescription,
  resolveCourseThumbnail,
  type CourseCatalogEntry,
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
  const sk840Href = "/courses/111";

  it("keeps the same-origin Course 111 player on production hosts", () => {
    const entry = getCourseCatalogEntries({ hostname: "www.knititnow.com" }).find(
      (course) => course.slug === "mastering-the-silver-reed-sk840",
    );
    expect(entry?.href).toBe(sk840Href);
    expect(entry?.buttonLabel).toBe("View Course");
    expect(entry?.title).toBe("Mastering the Silver Reed SK840");
    expect(entry?.access).toBe("purchase");
    expect(entry?.category).toBe("Silver Reed");
    expect(entry?.href).not.toContain("mastering-the-silver-reed-sk840-a-comprehensive-course");
    expect(entry?.href).toMatch(/^\/courses\/111$/);
    expect(entry?.href).not.toContain("courses.knititnow.com");
    expect(entry?.hasThumbnail).toBe(true);
    expect(entry?.thumbnail).toBe("/images/courses/mastering-silver-reed-sk840.png");
    expect(entry?.thumbnail).not.toContain("2022-course_thumbnail");
    expect(entry?.thumbnail).not.toContain("courses.knititnow.com");
  });

  it("stays on DEV for the SK840 catalog card", () => {
    const entry = getCourseCatalogEntries({ hostname: "kin-dev.netlify.app" }).find(
      (course) => course.slug === "mastering-the-silver-reed-sk840",
    );
    expect(entry?.href).toBe(sk840Href);
    expect(entry?.href).toMatch(/^\/courses\/111$/);
    expect(entry?.href).not.toContain("courses.knititnow.com");
    expect(entry?.href).not.toMatch(/^https?:\/\//);
    expect(entry?.buttonLabel).toBe("View Course");
  });

  it("stays on localhost for the SK840 catalog card", () => {
    const entry = getCourseCatalogEntries({
      hostname: "localhost",
      isViteDev: true,
    }).find((course) => course.slug === "mastering-the-silver-reed-sk840");
    expect(entry?.href).toBe(sk840Href);
    expect(entry?.href).not.toContain("courses.knititnow.com");
  });

  it("lists Course 86 on the production catalog and links to /courses/86", () => {
    const taitexmaHref = "/courses/86";
    const entry = getCourseCatalogEntries({ hostname: "www.knititnow.com" }).find(
      (course) => course.slug === "taitexma-th-tr-160-getting-started",
    );
    expect(entry?.href).toBe(taitexmaHref);
    expect(entry?.buttonLabel).toBe("View Course");
    expect(entry?.title).toBe("Taitexma TH/TR-160: Getting Started");
    expect(entry?.access).toBe("purchase");
    expect(entry?.category).toBe("Taitexma");
    expect(entry?.href).toMatch(/^\/courses\/86$/);
    expect(entry?.href).not.toContain("courses.knititnow.com");
    expect(entry?.hasThumbnail).toBe(true);
    expect(entry?.thumbnail).toBe("/images/courses/taitexma_160.webp");
    expect(entry?.status).toBe("available");
    expect(entry?.description).toContain("Taitexma TH/TR-160");
  });

  it("stays on DEV and localhost for the Taitexma TH/TR-160 catalog card", () => {
    const taitexmaHref = "/courses/86";
    const dev = getCourseCatalogEntries({ hostname: "kin-dev.netlify.app" }).find(
      (course) => course.slug === "taitexma-th-tr-160-getting-started",
    );
    expect(dev?.href).toBe(taitexmaHref);
    expect(dev?.buttonLabel).toBe("View Course");
    expect(dev?.href).not.toContain("courses.knititnow.com");
    expect(dev?.href).not.toMatch(/^https?:\/\//);

    const local = getCourseCatalogEntries({
      hostname: "localhost",
      isViteDev: true,
    }).find((course) => course.slug === "taitexma-th-tr-160-getting-started");
    expect(local?.href).toBe(taitexmaHref);
    expect(local?.href).not.toContain("courses.knititnow.com");
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

  it("keeps a published production catalog course available even while contentStatus is in_progress", () => {
    expect(resolveCatalogStatus("taitexma-th-tr-160-getting-started", "available")).toBe(
      "available",
    );
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
    "beginner-workshop",
    "ribber-basic-bootcamp",
    "not-enough-needles",
    "yes-knits-that-fit",
    "neckline-shaping-practice",
    "mastering-the-silver-reed-sk840-a-comprehensive-course",
  ] as const;

  it("lists SK840 and Course 86 as the public catalog courses", () => {
    const sections = getCourseCatalogEntriesByCategory();
    expect(sections.map((section) => section.category)).toEqual([
      "Silver Reed",
      "Taitexma",
      "Brother",
      "LK-150",
    ]);
    expect(sections[0]?.courses.map((course) => course.slug)).toEqual([
      "mastering-the-silver-reed-sk840",
    ]);
    expect(sections[1]?.courses.map((course) => course.slug)).toEqual([
      "taitexma-th-tr-160-getting-started",
    ]);
    expect(sections[2]?.courses.map((course) => course.slug)).toEqual([
      "brother-kh-kr-260-quick-start",
    ]);
    expect(sections[2]?.courses[0]?.href).toBe("/courses/87");
    expect(sections[2]?.courses[0]?.buttonLabel).toBe("View Course");
    expect(sections[2]?.courses[0]?.access).toBe("purchase");
    expect(sections[2]?.courses[0]?.thumbnail).toBe("/images/courses/260.webp");
    expect(sections[3]?.courses.map((course) => course.slug)).toEqual([
      "master-lk-patterning",
      "lk-150-quick-start",
      "lk-150-fun",
    ]);
    expect(sections[3]?.courses[0]?.href).toBe("/courses/34");
    expect(sections[3]?.courses[0]?.buttonLabel).toBe("View Course");
    expect(sections[3]?.courses[0]?.access).toBe("purchase");
    expect(sections[3]?.courses[0]?.thumbnail).toBe("/images/courses/lk-150_patterning.webp");
    expect(sections[3]?.courses[1]?.href).toBe("/courses/50");
    expect(sections[3]?.courses[1]?.title).toBe("LK-150 Quick Start");
    expect(sections[3]?.courses[1]?.buttonLabel).toBe("View Course");
    expect(sections[3]?.courses[1]?.access).toBe("member");
    expect(sections[3]?.courses[1]?.status).toBe("available");
    expect(sections[3]?.courses[1]?.thumbnail).toBe("/images/courses/lk-150_quick.webp");
    expect(sections[3]?.courses[2]?.href).toBe("/courses/51");
    expect(sections[3]?.courses[2]?.title).toBe("LK-150 Fun");
    expect(sections[3]?.courses[2]?.buttonLabel).toBe("View Course");
    expect(sections[3]?.courses[2]?.access).toBe("member");
    expect(sections[3]?.courses[2]?.status).toBe("available");
    expect(sections[3]?.courses[2]?.thumbnail).toBe("/images/courses/lk-150_fun.webp");
    expect(sections[1]?.courses[0]?.href).toBe("/courses/86");
    expect(sections[1]?.courses[0]?.buttonLabel).toBe("View Course");
    expect(sections[1]?.courses[0]?.access).toBe("purchase");
    expect(sections[1]?.courses[0]?.thumbnail).toBe("/images/courses/taitexma_160.webp");

    const entries = getCourseCatalogEntries();
    expect(entries).toHaveLength(6);
    expect(entries[0]?.slug).toBe("mastering-the-silver-reed-sk840");
    expect(entries[0]?.title).toBe("Mastering the Silver Reed SK840");
    expect(entries[0]?.buttonLabel).toBe("View Course");
    expect(entries[0]?.href).toBe("/courses/111");
    expect(entries[0]?.href).not.toContain("courses.knititnow.com");

    const productionEntries = getCourseCatalogEntries({ hostname: "knititnow.com" });
    expect(productionEntries.map((course) => course.href)).toEqual([
      "/courses/111",
      "/courses/86",
      "/courses/87",
      "/courses/34",
      "/courses/50",
      "/courses/51",
    ]);
    expect(productionEntries[0]?.href).not.toContain("courses.knititnow.com");
    expect(entries[0]?.access).toBe("purchase");
    expect(entries[0]?.hasThumbnail).toBe(true);
    expect(entries[0]?.thumbnail).toBe("/images/courses/mastering-silver-reed-sk840.png");

    const slugs = entries.map((course) => course.slug);
    for (const slug of hiddenPublicCatalogSlugs) {
      expect(slugs).not.toContain(slug);
    }
    expect(getCourseCatalogCategories()).toEqual([
      "Silver Reed",
      "Taitexma",
      "Brother",
      "LK-150",
    ]);
    expect(entries.some((course) => course.slug === "taitexma-th-tr-160-getting-started")).toBe(
      true,
    );
    expect(entries.some((course) => course.href === "/courses/86")).toBe(true);
  });
});

describe("groupCourseCatalogSections", () => {
  function sectionCourse(
    slug: string,
    category: string,
  ): CourseCatalogEntry {
    return {
      slug,
      title: slug,
      category,
      status: "available",
      hasThumbnail: false,
      buttonLabel: "View Course",
      access: "purchase",
    };
  }

  it("folds Silver Reed, Taitexma, and Brother into one section and keeps LK-150 separate", () => {
    const sections = groupCourseCatalogSections([
      {
        category: "Intro",
        courses: [sectionCourse("intro", "Intro")],
      },
      {
        category: "Silver Reed",
        courses: [sectionCourse("sk", "Silver Reed")],
      },
      {
        category: "Taitexma",
        courses: [sectionCourse("tx", "Taitexma")],
      },
      {
        category: "Brother",
        courses: [sectionCourse("br", "Brother"), sectionCourse("br-2", "Brother")],
      },
      {
        category: "LK-150",
        courses: [sectionCourse("lk", "LK-150"), sectionCourse("lk-2", "LK-150")],
      },
    ]);

    expect(sections.map((section) => section.category)).toEqual([
      "Intro",
      MACHINE_SPECIFIC_COURSES_HEADING,
      LK150_COURSES_HEADING,
    ]);
    expect(sections[1]?.courses.map((course) => course.slug)).toEqual(["sk", "tx", "br", "br-2"]);
    expect(sections[1]?.courses.map((course) => course.category)).toEqual([
      "Silver Reed",
      "Taitexma",
      "Brother",
      "Brother",
    ]);
    expect(sections[2]?.courses.map((course) => course.slug)).toEqual(["lk", "lk-2"]);
    expect(sections[2]?.courses.every((course) => course.access === "purchase")).toBe(true);
  });

  it("groups the published catalog into Machine-Specific Courses and LK-150 Courses", () => {
    const sections = groupCourseCatalogSections(getCourseCatalogEntriesByCategory());

    expect(sections.map((section) => section.category)).toEqual([
      MACHINE_SPECIFIC_COURSES_HEADING,
      LK150_COURSES_HEADING,
    ]);
    expect(sections[0]?.courses.map((course) => course.slug)).toEqual([
      "mastering-the-silver-reed-sk840",
      "taitexma-th-tr-160-getting-started",
      "brother-kh-kr-260-quick-start",
    ]);
    expect(sections[0]?.courses.map((course) => course.category)).toEqual([
      "Silver Reed",
      "Taitexma",
      "Brother",
    ]);
    expect(sections[0]?.courses.map((course) => course.href)).toEqual([
      "/courses/111",
      "/courses/86",
      "/courses/87",
    ]);
    expect(sections[0]?.courses.map((course) => course.access)).toEqual([
      "purchase",
      "purchase",
      "purchase",
    ]);
    expect(sections[1]?.courses.map((course) => ({
      slug: course.slug,
      category: course.category,
      href: course.href,
      access: course.access,
      status: course.status,
    }))).toEqual([
      {
        slug: "master-lk-patterning",
        category: "LK-150",
        href: "/courses/34",
        access: "purchase",
        status: "available",
      },
      {
        slug: "lk-150-quick-start",
        category: "LK-150",
        href: "/courses/50",
        access: "member",
        status: "available",
      },
      {
        slug: "lk-150-fun",
        category: "LK-150",
        href: "/courses/51",
        access: "member",
        status: "available",
      },
    ]);

    const published = sections.flatMap((section) => section.courses);
    expect(published.filter((course) => course.status === "available")).toHaveLength(6);
    expect(published.map((course) => course.slug)).toContain("lk-150-quick-start");
  });
});
