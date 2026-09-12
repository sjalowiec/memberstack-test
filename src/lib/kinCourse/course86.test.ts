import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { getCourseCatalogEntries } from "../coursesCatalog";
import { readCourseContentFile } from "../legacy_kin/courseContentAdmin";
import {
  applyKinCourseSrcRewrites,
  presentKinCourseHtml,
  readKinCourseGlossary,
} from "./htmlPresent";
import {
  kinCourseCompleteHref,
  kinCourseContentsHref,
  kinCourseHomeHref,
  kinCourseLessonHref,
} from "./hrefs";
import { loadKinCourseBundle } from "./load";
import { findLesson, flattenLessons, getLessonContext } from "./player";
import { pocToKinCourse } from "./pocToKinCourse";
import { readKinCoursePresentation } from "./presentation";
import { kinCoursePreviewRequested } from "./request";

const COURSE_86_ID = 86;

describe("Course 86 unpublished preview", () => {
  it("keeps the cleaned POC as an unpublished draft", () => {
    const poc = readCourseContentFile(COURSE_86_ID);
    expect(poc.course.legacyChallengeId).toBe(86);
    expect(poc.course.status).toBe("draft");
    expect(poc.course.published).toBe(false);
    expect(poc.course.contentStatus).toBe("in_progress");
    expect(poc.lessons[0]?.title).toBe("Unboxing");
    expect(poc.lessons.map((lesson) => lesson.title)).toEqual([
      "Unboxing",
      "Learn about the Machine",
      "Casting On and Binding Off",
      "Tuck (Pull-up) Stitch",
      "Slip (Skip) Stitch",
      "Intarsia",
      "Plaiting",
      "Knit Weave",
      "Unboxing the Ribber",
      "Get Familiar with Your Ribber",
      "Using the Ribber",
    ]);
  });

  it("does not appear on the public /courses catalog", () => {
    const entries = getCourseCatalogEntries();
    expect(entries.some((course) => course.slug === "taitexma-th-tr-160-getting-started")).toBe(
      false,
    );
    expect(entries.some((course) => course.href === "/courses/86")).toBe(false);
  });

  it("loads with includeDrafts/preview and stays hidden without it", async () => {
    expect(await loadKinCourseBundle(COURSE_86_ID)).toBeNull();
    const bundle = await loadKinCourseBundle(COURSE_86_ID, { includeDrafts: true });
    expect(bundle?.course.id).toBe(86);
    expect(bundle?.course.title).toBe("Taitexma TH/TR-160: Getting Started");
    expect(bundle?.landing.image.src).toBe("/images/courses/taitexma_160.webp");
    expect(bundle?.landing.topics).toHaveLength(11);
    expect(findLesson(bundle!.course, 4212)?.title).toMatch(/unbox/i);
    expect(flattenLessons(bundle!.course).length).toBe(40);
  });

  it("preserves preview=true on numeric player navigation", () => {
    expect(kinCourseHomeHref(86, true)).toBe("/courses/86?preview=true");
    expect(kinCourseContentsHref(86, true)).toBe("/courses/86/contents?preview=true");
    expect(kinCourseLessonHref(86, 4212, true)).toBe("/courses/86/lesson/4212?preview=true");
    expect(kinCourseCompleteHref(86, true)).toBe("/courses/86/complete?preview=true");

    const poc = readCourseContentFile(COURSE_86_ID);
    const course = pocToKinCourse(poc, { includeDrafts: true });
    const context = getLessonContext(course, 4212, true);
    expect(context?.nextNav.href).toContain("preview=true");
    expect(context?.nextNav.href).toContain("/courses/86/lesson/");
  });

  it("does not treat preview=true as granted without admin auth", () => {
    const previewUrl = new URL("http://localhost:4321/courses/86?preview=true");
    expect(kinCoursePreviewRequested(previewUrl)).toBe(true);
    expect(kinCoursePreviewRequested(new URL("https://www.knititnow.com/courses/86?preview=true"))).toBe(
      true,
    );
    expect(kinCoursePreviewRequested(new URL("http://localhost:4321/courses/86"))).toBe(false);
  });

  it("renders videos, galleries, exercises, and converted interactive components", async () => {
    const bundle = await loadKinCourseBundle(COURSE_86_ID, { includeDrafts: true });
    const lessons = flattenLessons(bundle!.course);
    expect(lessons.some((lesson) => lesson.components.some((component) => component.type === "vimeo"))).toBe(
      true,
    );
    expect(
      lessons.some((lesson) => lesson.components.some((component) => component.type === "imageslideshow")),
    ).toBe(true);
    expect(lessons.some((lesson) => lesson.components.some((component) => component.type === "exercise"))).toBe(
      true,
    );
    expect(
      lessons.some((lesson) => lesson.components.some((component) => component.type === "vimeoJumpLinks")),
    ).toBe(true);
    expect(lessons.some((lesson) => lesson.components.some((component) => component.type === "hotspot"))).toBe(
      true,
    );
    expect(
      lessons.some((lesson) =>
        lesson.components.some(
          (component) => component.legacyType === "VimeoJumpLinks" && component.pending,
        ),
      ),
    ).toBe(false);
    expect(
      lessons.some((lesson) =>
        lesson.components.some((component) => component.legacyType === "Hotspot" && component.pending),
      ),
    ).toBe(false);
  });
});

describe("Course 86 presented assets", () => {
  const presentation = readKinCoursePresentation(COURSE_86_ID);
  const glossary = readKinCourseGlossary(COURSE_86_ID);

  it("includes glossary entries 654 and 713", () => {
    expect(glossary.map((entry) => entry.glossaryId).sort()).toEqual([654, 713]);
    expect(glossary.find((entry) => entry.glossaryId === 654)?.slug).toBe("punch-lace-thread-lace");
  });

  it("resolves rewritten local images and PDFs, and reports the missing ewrap.jpg", async () => {
    const bundle = await loadKinCourseBundle(COURSE_86_ID, { includeDrafts: true });
    const refs = new Set<string>();
    for (const lesson of flattenLessons(bundle!.course)) {
      for (const component of lesson.components) {
        if (component.html) {
          const html = presentKinCourseHtml(component.html, lesson.id, presentation, glossary);
          const attrRe = /(?:src|href|data-image)=["']([^"']+)["']/gi;
          let match: RegExpExecArray | null;
          while ((match = attrRe.exec(html))) {
            refs.add(match[1]!.split(/[?#]/)[0]!);
          }
        }
        if (component.image) refs.add(applyKinCourseSrcRewrites(component.image, presentation));
        for (const slide of component.slides ?? []) {
          if (slide.src) refs.add(applyKinCourseSrcRewrites(slide.src, presentation));
        }
        for (const item of component.items ?? []) {
          if (item.image) refs.add(applyKinCourseSrcRewrites(item.image, presentation));
          if (item.heading) {
            const html = presentKinCourseHtml(item.heading, lesson.id, presentation, glossary);
            const attrRe = /(?:src|href|data-image)=["']([^"']+)["']/gi;
            let match: RegExpExecArray | null;
            while ((match = attrRe.exec(html))) {
              refs.add(match[1]!.split(/[?#]/)[0]!);
            }
          }
        }
      }
    }

    expect([...refs].filter((ref) => ref.includes("/challenge/images/v2/86/"))).toEqual([]);
    expect(refs.has("/images/course-content/86/warning.png")).toBe(true);
    expect(refs.has("/images/course-content/86/needle_position.jpg")).toBe(true);
    expect(refs.has("/images/course-content/111/arrow1.png")).toBe(true);
    expect(refs.has("/stitch-patterns/swatches/6/1017Swatch.jpg")).toBe(true);
    expect(refs.has("/images/course-content/86/tuck1.jpg")).toBe(true);
    expect(refs.has("/images/course-content/86/th160_manual.pdf")).toBe(true);
    expect(refs.has("/images/course-content/86/TR160_manual.pdf")).toBe(true);
    expect(refs.has("/images/course-content/86/taitexma_160_reference_card.pdf")).toBe(true);
    expect(refs.has("/images/course-content/86/reference-cards.pdf")).toBe(true);
    expect(refs.has("/images/glossary/ewrap.jpg")).toBe(true);
    expect(existsSync(join(process.cwd(), "public/images/glossary/ewrap.jpg"))).toBe(false);
    expect(existsSync(join(process.cwd(), "public/images/course-content/86/warning.png"))).toBe(
      true,
    );
    expect(existsSync(join(process.cwd(), "public/images/course-content/86/needle_position.jpg"))).toBe(
      true,
    );
    expect(existsSync(join(process.cwd(), "public/images/course-content/86/tuck1.jpg"))).toBe(true);
    expect(existsSync(join(process.cwd(), "public/images/course-content/86/th160_manual.pdf"))).toBe(
      true,
    );
  });

  it("presents Heads up! x2 with the local warning.png player URL", async () => {
    const bundle = await loadKinCourseBundle(COURSE_86_ID, { includeDrafts: true });
    const lesson = flattenLessons(bundle!.course).find((entry) => entry.id === 4312);
    const html = presentKinCourseHtml(lesson!.components[0]!.html || "", 4312, presentation, glossary);
    expect(html).toContain('<img src="/images/course-content/86/warning.png">');
    expect(html).toContain('<img src="/images/course-content/86/mast1.jpg">');
    expect(html).not.toContain("/challenge/images/v2/86/");
  });
});

describe("numeric course player pages", () => {
  it("uses parameterized [courseSlug] player routes instead of hardcoded 111 or duplicate [courseId] pages", () => {
    const home = readFileSync(join(process.cwd(), "src/pages/courses/[courseSlug]/index.astro"), "utf8");
    const lesson = readFileSync(
      join(process.cwd(), "src/pages/courses/[courseSlug]/lesson/[assignId].astro"),
      "utf8",
    );
    const contents = readFileSync(
      join(process.cwd(), "src/pages/courses/[courseSlug]/contents.astro"),
      "utf8",
    );
    expect(home).toContain("parseKinCourseId");
    expect(home).toContain("loadKinCourseBundle");
    expect(home).toContain("KinCourseHomeView");
    expect(home).toContain("await kinCourseLoadOptions(Astro.url, Astro.request, Astro.cookies)");
    expect(lesson).toContain("parseKinCourseId(Astro.params.courseSlug)");
    expect(contents).toContain("parseKinCourseId(Astro.params.courseSlug)");
    expect(lesson).toContain("await kinCourseLoadOptions(Astro.url, Astro.request, Astro.cookies)");
    expect(contents).toContain("await kinCourseLoadOptions(Astro.url, Astro.request, Astro.cookies)");
    expect(existsSync(join(process.cwd(), "src/pages/courses/111/index.astro"))).toBe(false);
    expect(existsSync(join(process.cwd(), "src/pages/courses/[courseId]/contents.astro"))).toBe(
      false,
    );
  });
});
