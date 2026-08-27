import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { course111LessonPreviewHref, loadCourse111, listCourse111OriginalLessons } from "./course111Admin";
import {
  isProductionKnitItNowCourseUrl,
  legacyLessonItemNavHref,
  legacyLessonNavHref,
  localLegacyCourseHrefForCatalog,
  parseLegacyChallengeIdFromHref,
  resolveCatalogCourseHref,
  withDraftPreviewQuery,
} from "./courseEnvironmentHref";
import {
  getLegacyCourseBySlug,
  legacyCourseHref,
  legacyLessonHref,
  legacyLessonItemHref,
} from "./legacyCourseLoader";
import {
  getCourseContentItemNeighbors,
  getLessonContentItemsWithSlugs,
} from "./courseLessonContentItems";

const SK840_CATALOG_SLUG = "mastering-the-silver-reed-sk840";
const SK840_COURSE_SLUG =
  "mastering-the-silver-reed-sk840-a-comprehensive-course";
const SK840_PRODUCTION_HREF = "https://courses.knititnow.com/courses/111";
const SK840_DEV_HREF = `/courses/111`;

function assertSameOriginCourseHref(href: string) {
  expect(href.startsWith("/courses/")).toBe(true);
  expect(href).not.toContain("://");
  expect(href).not.toMatch(/https?:\/\//i);
  expect(href).not.toContain("courses.knititnow.com");
  expect(href).not.toContain("knititnow.com");
}

describe("parseLegacyChallengeIdFromHref", () => {
  it("reads the numeric course id from the production KIN URL", () => {
    expect(parseLegacyChallengeIdFromHref(SK840_PRODUCTION_HREF)).toBe(111);
    expect(parseLegacyChallengeIdFromHref("https://courses.knititnow.com/courses/111/")).toBe(
      111,
    );
  });

  it("returns undefined for unrelated hrefs", () => {
    expect(parseLegacyChallengeIdFromHref("/courses/legacy/lk-150-quick-start")).toBeUndefined();
    expect(parseLegacyChallengeIdFromHref(undefined)).toBeUndefined();
  });
});

describe("isProductionKnitItNowCourseUrl", () => {
  it("detects absolute KIN course host URLs", () => {
    expect(isProductionKnitItNowCourseUrl(SK840_PRODUCTION_HREF)).toBe(true);
    expect(
      isProductionKnitItNowCourseUrl("https://www.knititnow.com/courses/111"),
    ).toBe(true);
  });

  it("ignores local paths and unrelated hosts", () => {
    expect(isProductionKnitItNowCourseUrl("/courses/legacy/lk-150-quick-start")).toBe(false);
    expect(isProductionKnitItNowCourseUrl("https://example.com/courses/111")).toBe(
      false,
    );
  });
});

describe("resolveCatalogCourseHref", () => {
  it("keeps the production KIN URL on production hosts", () => {
    expect(
      resolveCatalogCourseHref(SK840_CATALOG_SLUG, SK840_PRODUCTION_HREF, {
        hostname: "www.knititnow.com",
      }),
    ).toBe(SK840_PRODUCTION_HREF);
    expect(
      resolveCatalogCourseHref(SK840_CATALOG_SLUG, SK840_PRODUCTION_HREF, {
        hostname: "knititnow.com",
      }),
    ).toBe(SK840_PRODUCTION_HREF);
  });

  it("rewrites the production KIN URL to the local Course 111 player on DEV", () => {
    const href = resolveCatalogCourseHref(SK840_CATALOG_SLUG, SK840_PRODUCTION_HREF, {
      hostname: "kin-dev.netlify.app",
    });
    expect(href).toBe(SK840_DEV_HREF);
    assertSameOriginCourseHref(href!);
  });

  it("rewrites the production KIN URL on localhost", () => {
    const href = resolveCatalogCourseHref(SK840_CATALOG_SLUG, SK840_PRODUCTION_HREF, {
      hostname: "localhost",
      isViteDev: true,
    });
    expect(href).toBe(SK840_DEV_HREF);
    assertSameOriginCourseHref(href!);
  });

  it("defaults unknown hosts to the local Course 111 player", () => {
    const href = resolveCatalogCourseHref(SK840_CATALOG_SLUG, SK840_PRODUCTION_HREF);
    expect(href).toBe(SK840_DEV_HREF);
    assertSameOriginCourseHref(href!);
  });

  it("maps catalog slug + production href to the cleaned Course 111 JSON slug", () => {
    expect(
      localLegacyCourseHrefForCatalog(SK840_CATALOG_SLUG, SK840_PRODUCTION_HREF),
    ).toBe(`/courses/legacy/${SK840_COURSE_SLUG}`);
  });
});

describe("Course 111 lesson navigation stays on the current origin", () => {
  const course = getLegacyCourseBySlug(SK840_COURSE_SLUG, { includeDrafts: true });

  it("loads Course 111 for href checks", () => {
    expect(course).toBeTruthy();
  });

  it("builds same-origin course, lesson, Previous/Next, and Course Contents hrefs", () => {
    expect(course).toBeTruthy();
    const lesson = course!.lessons.find((entry) => entry.slug === "learn-about-the-machine");
    expect(lesson).toBeTruthy();

    const courseHref = withDraftPreviewQuery(legacyCourseHref(SK840_COURSE_SLUG), true);
    const contentsHref = legacyLessonNavHref(SK840_COURSE_SLUG, lesson!.slug, true);
    const items = getLessonContentItemsWithSlugs(lesson!);
    const firstItem = items[0];
    expect(firstItem).toBeTruthy();
    const { prev, next } = getCourseContentItemNeighbors(
      course!,
      lesson!.slug,
      firstItem!.itemSlug,
    );

    assertSameOriginCourseHref(courseHref);
    assertSameOriginCourseHref(contentsHref);
    assertSameOriginCourseHref(
      legacyLessonHref(SK840_COURSE_SLUG, lesson!.slug),
    );
    expect(contentsHref).toBe(
      `/courses/legacy/${SK840_COURSE_SLUG}/${lesson!.slug}?preview=true`,
    );

    if (prev) {
      const prevHref = legacyLessonItemNavHref(
        SK840_COURSE_SLUG,
        prev.lesson.slug,
        prev.item.itemSlug,
        true,
      );
      assertSameOriginCourseHref(prevHref);
    }

    expect(next).toBeTruthy();
    const nextHref = legacyLessonItemNavHref(
      SK840_COURSE_SLUG,
      next!.lesson.slug,
      next!.item.itemSlug,
      true,
    );
    assertSameOriginCourseHref(nextHref);
    expect(nextHref).toContain(`/courses/legacy/${SK840_COURSE_SLUG}/`);
    expect(nextHref).toContain("?preview=true");
  });

  it("keeps Watson preview lesson URLs on the current origin", () => {
    const data = loadCourse111();
    const first = listCourse111OriginalLessons(data)[0]!;
    const href = course111LessonPreviewHref(data, first.assignId);
    expect(href).toBe(`/courses/111/lesson/${first.assignId}?preview=true`);
    assertSameOriginCourseHref(href!);
  });

  it("keeps item hrefs relative when preview is off (production player)", () => {
    const href = legacyLessonItemHref(
      SK840_COURSE_SLUG,
      "learn-about-the-machine",
      "your-manuals",
    );
    expect(href).toBe(
      `/courses/legacy/${SK840_COURSE_SLUG}/learn-about-the-machine/your-manuals`,
    );
    assertSameOriginCourseHref(href);
  });
});

describe("course pages pass environment into catalog and lesson hrefs", () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const repoRoot = join(here, "..", "..", "..");

  it("resolves /courses catalog hrefs from the current hostname", () => {
    const source = readFileSync(join(repoRoot, "src/pages/courses/index.astro"), "utf8");
    expect(source).toContain("catalogHrefEnv");
    expect(source).toContain("hostname: Astro.url.hostname");
    expect(source).toContain("getCourseCatalogEntriesByCategory(catalogHrefEnv)");
  });

  it("keeps draft preview=true on Course 111 overview lesson links", () => {
    const source = readFileSync(
      join(repoRoot, "src/pages/courses/legacy/[courseSlug]/index.astro"),
      "utf8",
    );
    expect(source).toContain("legacyCoursePreviewHref");
    expect(source).toContain("includeDraftPreview: loaderOptions.includeDrafts");
    expect(source).toContain("previewQuery={previewQuery}");
    expect(source).not.toContain("legacyLessonHref(");
  });
});
