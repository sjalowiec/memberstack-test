import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  getLegacyCourseBySlug,
  getLegacyLessonBySlug,
  getLegacyLessonNeighbors,
  getSortedLessonsForCourse,
} from "./legacyCourseLoader";
import {
  contentItemDisplayTitle,
  contentItemNavTitle,
  getCourseContentItemNeighbors,
  getLessonContentItemsWithSlugs,
} from "./courseLessonContentItems";
import course111 from "../../data/legacy_kin/cleaned/course_111_mastering_the_silver_reed_sk840_a_comprehensive_course.poc.json";
import type { CoursePreviewData } from "./coursePreviewPoc";

const SK840_SLUG = "mastering-the-silver-reed-sk840-a-comprehensive-course";
const HIDDEN_LESSON_SLUGS = ["activepresenter-all-over", "temp-to-delete-later"] as const;

function collectPublishedLessonRefs(data: CoursePreviewData): string[] {
  const refs: string[] = [];
  const attrRe = /(?:src|href)=["']([^"']+)["']/gi;

  for (const lesson of data.lessons) {
    if (lesson.published === false) continue;
    for (const block of lesson.blocks ?? []) {
      for (const component of block.components ?? []) {
        if ("html" in component && typeof component.html === "string") {
          for (const match of component.html.matchAll(attrRe)) {
            refs.push(match[1]!);
          }
        }
        if ("src" in component && typeof component.src === "string") {
          refs.push(component.src);
        }
        if ("filename" in component && typeof component.filename === "string") {
          refs.push(component.filename);
        }
        if ("slides" in component && Array.isArray(component.slides)) {
          for (const slide of component.slides) {
            if (slide?.src) refs.push(slide.src);
          }
        }
        if ("sections" in component && Array.isArray(component.sections)) {
          for (const section of component.sections) {
            if (section?.iconSrc) refs.push(section.iconSrc);
            if (typeof section?.bodyHtml === "string") {
              for (const match of section.bodyHtml.matchAll(attrRe)) {
                refs.push(match[1]!);
              }
            }
          }
        }
      }
    }
  }
  return refs;
}

describe("lesson published visibility", () => {
  it("defaults omitted lesson published to visible", () => {
    const course = getLegacyCourseBySlug("lk-150-quick-start", { includeDrafts: true });
    expect(course).toBeTruthy();
    const publicLessons = getSortedLessonsForCourse(course!, { includeDrafts: false });
    const allLessons = getSortedLessonsForCourse(course!, { includeDrafts: true });
    expect(publicLessons.length).toBe(allLessons.length);
    expect(publicLessons.every((lesson) => lesson.published !== false)).toBe(true);
  });

  it("excludes unpublished Course 111 lessons from public navigation", () => {
    const course = getLegacyCourseBySlug(SK840_SLUG, { includeDrafts: true });
    expect(course).toBeTruthy();

    const publicLessons = getSortedLessonsForCourse(course!, { includeDrafts: false });
    const publicSlugs = publicLessons.map((lesson) => lesson.slug);
    for (const slug of HIDDEN_LESSON_SLUGS) {
      expect(publicSlugs).not.toContain(slug);
    }

    const allLessons = getSortedLessonsForCourse(course!, { includeDrafts: true });
    const allSlugs = allLessons.map((lesson) => lesson.slug);
    for (const slug of HIDDEN_LESSON_SLUGS) {
      expect(allSlugs).toContain(slug);
    }
  });

  it("keeps unpublished Course 111 lessons available in draft preview", () => {
    for (const slug of HIDDEN_LESSON_SLUGS) {
      const lesson = getLegacyLessonBySlug(SK840_SLUG, slug, { includeDrafts: true });
      expect(lesson?.slug).toBe(slug);
      expect(lesson?.published).toBe(false);
    }
  });

  it("blocks direct public route access to unpublished Course 111 lessons", () => {
    for (const slug of HIDDEN_LESSON_SLUGS) {
      expect(getLegacyLessonBySlug(SK840_SLUG, slug)).toBeUndefined();
    }
  });

  it("excludes unpublished lessons from next/previous navigation", () => {
    const course = getLegacyCourseBySlug(SK840_SLUG, { includeDrafts: true });
    expect(course).toBeTruthy();
    const publicLessons = getSortedLessonsForCourse(course!, { includeDrafts: false });
    const lastPublic = publicLessons[publicLessons.length - 1];
    expect(lastPublic).toBeTruthy();

    const neighbors = getLegacyLessonNeighbors(SK840_SLUG, lastPublic!.slug);
    expect(neighbors.next).toBeNull();
    expect(neighbors.prev?.slug).not.toBe("activepresenter-all-over");
    expect(neighbors.prev?.slug).not.toBe("temp-to-delete-later");
  });
});

describe("Course 111 conversion invariants", () => {
  const data = course111 as CoursePreviewData;

  it("is published for the same-origin numeric player", () => {
    expect(data.course.status).toBe("published");
    expect(data.course.published).toBe(true);
  });

  it("has no migrationPending blocks in published lessons", () => {
    for (const lesson of data.lessons) {
      if (lesson.published === false) continue;
      for (const block of lesson.blocks ?? []) {
        for (const component of block.components ?? []) {
          expect(component.type).not.toBe("migrationPending");
        }
      }
    }
  });

  it("preserves ActivePresenter pending content in hidden lesson 20", () => {
    const lesson20 = data.lessons.find((lesson) => lesson.slug === "activepresenter-all-over");
    expect(lesson20?.published).toBe(false);
    const pending = (lesson20?.blocks ?? []).flatMap((block) =>
      (block.components ?? []).filter((component) => component.type === "migrationPending"),
    );
    expect(pending).toHaveLength(3);
    expect(pending.every((component) => component.legacyType === "ActivePresenter")).toBe(true);
  });

  it("has no legacy challenge/downloads/v2/host asset refs in published lessons", () => {
    const refs = collectPublishedLessonRefs(data);
    for (const ref of refs) {
      expect(ref.includes("/challenge/")).toBe(false);
      expect(ref.startsWith("/downloads/")).toBe(false);
      expect(ref.startsWith("/v2/")).toBe(false);
      expect(ref.includes("legacy.knititnow.com")).toBe(false);
      expect(ref.startsWith("/path/")).toBe(false);
      expect(ref.startsWith("/swatches/")).toBe(false);
    }
  });

  it("points published course-content refs at files that exist", () => {
    const refs = collectPublishedLessonRefs(data)
      .map((ref) => ref.split(/[?#]/)[0]!)
      .filter((ref) => ref.startsWith("/images/course-content/111/"));
    expect(refs.length).toBeGreaterThan(50);
    for (const ref of refs) {
      const diskPath = join(process.cwd(), "public", ref.replace(/^\//, ""));
      expect(existsSync(diskPath), ref).toBe(true);
    }
  });

  it("retains all hotspot labels as static ordered lists", () => {
    const expected = {
      "terms-you-must-know": 21,
      "tools-and-accessories": 15,
      "the-lace-carriage": 8,
    } as const;

    for (const [blockSlug, count] of Object.entries(expected)) {
      let found = false;
      for (const lesson of data.lessons) {
        for (const block of lesson.blocks ?? []) {
          if (block.slug !== blockSlug) continue;
          const labelHtml = (block.components ?? [])
            .filter((component) => component.type === "richText")
            .map((component) => ("html" in component ? String(component.html) : ""))
            .find((html) => html.includes("legacy-hotspot-labels"));
          expect(labelHtml, blockSlug).toBeTruthy();
          const hotspotListMatch = labelHtml!.match(
            /<ol[^>]*legacy-hotspot-labels[\s\S]*?<\/ol>/i,
          );
          expect(hotspotListMatch, `${blockSlug} hotspot ol`).toBeTruthy();
          expect((hotspotListMatch![0].match(/<li>/g) ?? []).length).toBe(count);

          if (blockSlug === "terms-you-must-know") {
            expect(block.components).toHaveLength(1);
            expect(labelHtml!).toContain("/images/course-content/111/carriage_main1_numbered.png");
            expect(labelHtml!).not.toContain("carriage_main1.jpg");
            expect(labelHtml!).toContain("Learn about the optional Easy Cut accessory");
            expect(labelHtml!).toContain("https://www.knititnow.com/EASYCUT");
            expect(labelHtml!).toContain("Russell Lever, left");
            expect((block.components ?? []).some((c) => c.type === "image")).toBe(false);
            expect((block.components ?? []).some((c) => c.type === "migrationPending")).toBe(
              false,
            );
          } else if (blockSlug === "tools-and-accessories") {
            expect(block.components).toHaveLength(1);
            expect(labelHtml!).toContain("/images/course-content/111/tools_numbered.png");
            expect(labelHtml!).not.toContain("tools.jpg");
            expect(labelHtml!).toContain("Yarn Separator(s)");
            expect(labelHtml!).toContain("Claw Weights");
            expect(labelHtml!).toContain("https://www.knititnow.com/glossary/249/ravel-cord/term");
            expect(labelHtml!).toContain("/glossary/283/cast-on-comb/term");
            expect(labelHtml!).toContain("NOT used with DesignaKnit");
            expect(labelHtml!).toContain(
              "Silver Reed SK840 knitting machine tools and accessories numbered 1 through 15.",
            );
            expect((block.components ?? []).some((c) => c.type === "image")).toBe(false);
            expect((block.components ?? []).some((c) => c.type === "migrationPending")).toBe(
              false,
            );
          } else {
            const image = (block.components ?? []).find((component) => component.type === "image");
            expect(
              image && "src" in image && String(image.src).startsWith("/images/course-content/111/"),
            ).toBe(true);
          }
          found = true;
        }
      }
      expect(found, blockSlug).toBe(true);
    }
  });

  it("exposes Terms You Must Know as a single content item with correct neighbors", () => {
    const course = getLegacyCourseBySlug(SK840_SLUG, { includeDrafts: true });
    expect(course).toBeTruthy();
    const lesson = course!.lessons.find((entry) => entry.slug === "learn-about-the-machine");
    expect(lesson).toBeTruthy();

    const items = getLessonContentItemsWithSlugs(lesson!);
    const termsItems = items.filter((item) => item.blockSlug === "terms-you-must-know");
    expect(termsItems).toHaveLength(1);

    const terms = termsItems[0]!;
    const { prev, next } = getCourseContentItemNeighbors(course!, lesson!.slug, terms.itemSlug);
    expect(prev).toBeTruthy();
    expect(next).toBeTruthy();
    expect(contentItemDisplayTitle(prev!.lesson, prev!.item)).toBe("Printable Reference Cards");
    expect(contentItemDisplayTitle(next!.lesson, next!.item)).toBe("Tools and Accessories");
    expect(contentItemDisplayTitle(prev!.lesson, prev!.item)).not.toBe(
      contentItemDisplayTitle(next!.lesson, next!.item),
    );
  });

  it("exposes Tools and Accessories as a single content item with correct neighbors", () => {
    const course = getLegacyCourseBySlug(SK840_SLUG, { includeDrafts: true });
    expect(course).toBeTruthy();
    const lesson = course!.lessons.find((entry) => entry.slug === "learn-about-the-machine");
    expect(lesson).toBeTruthy();

    const items = getLessonContentItemsWithSlugs(lesson!);
    const toolsItems = items.filter((item) => item.blockSlug === "tools-and-accessories");
    expect(toolsItems).toHaveLength(1);

    const tools = toolsItems[0]!;
    const { prev, next } = getCourseContentItemNeighbors(course!, lesson!.slug, tools.itemSlug);
    expect(prev).toBeTruthy();
    expect(next).toBeTruthy();
    expect(contentItemDisplayTitle(prev!.lesson, prev!.item)).toBe("Terms you must know");
    expect(contentItemDisplayTitle(next!.lesson, next!.item)).toBe("Setting up your machine");
    expect(contentItemDisplayTitle(prev!.lesson, prev!.item)).not.toBe(
      contentItemDisplayTitle(next!.lesson, next!.item),
    );
  });

  it("keeps Setting up your machine as text+video with printable cheat sheet", () => {
    const block = data.lessons
      .flatMap((lesson) => lesson.blocks ?? [])
      .find((entry) => entry.slug === "setting-up-your-machine");
    expect(block).toBeTruthy();

    const richText = (block!.components ?? []).find((component) => component.type === "richText");
    const video = (block!.components ?? []).find((component) => component.type === "video");
    expect(richText && "html" in richText).toBe(true);
    expect(video && "vimeoId" in video ? String(video.vimeoId) : "").toBe("798134504");

    const html = String((richText as { html: string }).html);
    expect(html).toContain("Watch the video, then print this cheat sheet");
    expect(html).toContain("/images/course-content/111/lid_instructions1.jpg");
    expect(html).toContain('data-print-image="/images/course-content/111/lid_instructions1.jpg"');
    expect(html).toContain("Print Cheat Sheet");
    expect(html).not.toContain("fa-download");
    expect(html.toLowerCase()).not.toContain(">download<");
    expect(html).not.toContain('width="400"');

    const course = getLegacyCourseBySlug(SK840_SLUG, { includeDrafts: true });
    const lesson = course!.lessons.find((entry) => entry.slug === "learn-about-the-machine");
    const items = getLessonContentItemsWithSlugs(lesson!);
    const setupItems = items.filter((item) => item.blockSlug === "setting-up-your-machine");
    expect(setupItems).toHaveLength(1);
    expect(setupItems[0]!.type).toBe("textVideoLayout");
  });

  it("exposes Yarn for Your Machine as a single content item with chart and sized hooks image", () => {
    const block = data.lessons
      .flatMap((lesson) => lesson.blocks ?? [])
      .find((entry) => entry.slug === "yarn-for-your-machine");
    expect(block).toBeTruthy();
    expect(block!.components).toHaveLength(1);

    const html = String((block!.components![0] as { html: string }).html);
    expect(html).toContain(
      "The 4.5 mm gauge of this machine is perfect for lightweight yarns.",
    );
    expect(html).toContain("Don't Skip This");
    expect(html).toContain("/images/course-content/111/yarn_in_needle_hooks.jpg");
    expect(html).toContain("sk840-yarn__hooks-img");
    expect(html).toContain("sk840-yarn__chart");
    expect(html).toContain("Super Bulky");
    expect(html).toContain("May not be appropriate.");
    expect(html).not.toContain("videopopup");
    expect(html).not.toContain("vimeocdn.com");
    expect(html).toContain(
      "Close-up of knitting machine needle hooks compared with five yarn samples",
    );
    expect(existsSync(join(process.cwd(), "public/images/course-content/111/yarn_in_needle_hooks.jpg"))).toBe(
      true,
    );

    const course = getLegacyCourseBySlug(SK840_SLUG, { includeDrafts: true });
    const lesson = course!.lessons.find((entry) => entry.slug === "learn-about-the-machine");
    const items = getLessonContentItemsWithSlugs(lesson!);
    const yarnItems = items.filter((item) => item.blockSlug === "yarn-for-your-machine");
    expect(yarnItems).toHaveLength(1);

    const yarn = yarnItems[0]!;
    const { prev, next } = getCourseContentItemNeighbors(course!, lesson!.slug, yarn.itemSlug);
    expect(contentItemDisplayTitle(prev!.lesson, prev!.item)).toBe("Setting up your machine");
    expect(contentItemDisplayTitle(next!.lesson, next!.item)).toBe("Plain Knitting");
    expect(contentItemNavTitle(lesson!, yarn, items)).toBe("Yarn for Your Machine");
  });

  it("exposes Plain Knitting as a single content item with checklist and carriage photo", () => {
    const block = data.lessons
      .flatMap((lesson) => lesson.blocks ?? [])
      .find((entry) => entry.slug === "plain-knitting");
    expect(block).toBeTruthy();
    expect(block!.components).toHaveLength(1);

    const html = String((block!.components![0] as { html: string }).html);
    expect(html).toContain("PLAIN KNITTING");
    expect(html).toContain("Every time you sit down to knit");
    expect(html).toContain("1. Cam Lever");
    expect(html).toContain("5. Yarn Feeder");
    expect(html).toContain("/images/course-content/111/plain_knitting.jpg");
    expect(html).toContain("/images/course-content/111/plain_setting.jpg");
    expect(html).toContain("/images/course-content/111/weaving _knob.jpg");
    expect(html).toContain("sk840-plain__photo");
    expect(html).toContain("numbered markers for cam lever");

    const course = getLegacyCourseBySlug(SK840_SLUG, { includeDrafts: true });
    const lesson = course!.lessons.find((entry) => entry.slug === "learn-about-the-machine");
    const items = getLessonContentItemsWithSlugs(lesson!);
    const plainItems = items.filter((item) => item.blockSlug === "plain-knitting");
    expect(plainItems).toHaveLength(1);
    expect(contentItemNavTitle(lesson!, plainItems[0]!, items)).toBe("Plain Knitting");

    const { prev, next } = getCourseContentItemNeighbors(
      course!,
      lesson!.slug,
      plainItems[0]!.itemSlug,
    );
    expect(contentItemDisplayTitle(prev!.lesson, prev!.item)).toBe("Yarn for Your Machine");
    expect(contentItemDisplayTitle(next!.lesson, next!.item)).toBe("The Proper Way to Knit");
  });

  it("exposes The Proper Way to Knit as one text+video item with posture tips", () => {
    const block = data.lessons
      .flatMap((lesson) => lesson.blocks ?? [])
      .find((entry) => entry.slug === "the-proper-way-to-knit");
    expect(block).toBeTruthy();
    expect(block!.components).toHaveLength(3);

    const video = (block!.components ?? []).find((component) => component.type === "video");
    expect(video && "vimeoId" in video ? String(video.vimeoId) : "").toBe("530014000");

    const html = (block!.components ?? [])
      .filter((component) => component.type === "richText")
      .map((component) => ("html" in component ? String(component.html) : ""))
      .join("\n");
    expect(html).toContain("Save your back, neck and shoulders");
    expect(html).toContain("use both hands");
    expect(html).toContain("Arm, hand and wrist position");
    expect(html).toContain("/images/course-content/111/woman_silhouette1.gif");
    expect(html).toContain("More tips");
    expect(html).toContain("Good lighting is a must");
    expect(html).toContain("player.vimeo.com/video/151858745");
    expect(html).toContain("A clean (and oiled) machine bed");
    expect(html).not.toContain("pathpopup");
    expect(html).not.toContain("subvideopopup");
    expect(html).not.toContain("btn btn-sm");
    expect(html).not.toContain("vimeocdn.com");

    const course = getLegacyCourseBySlug(SK840_SLUG, { includeDrafts: true });
    const lesson = course!.lessons.find((entry) => entry.slug === "learn-about-the-machine");
    const items = getLessonContentItemsWithSlugs(lesson!);
    const properItems = items.filter((item) => item.blockSlug === "the-proper-way-to-knit");
    expect(properItems).toHaveLength(1);
    expect(properItems[0]!.type).toBe("textVideoLayout");
    expect(contentItemNavTitle(lesson!, properItems[0]!, items)).toBe("The Proper Way to Knit");

    const { prev, next } = getCourseContentItemNeighbors(
      course!,
      lesson!.slug,
      properItems[0]!.itemSlug,
    );
    expect(contentItemDisplayTitle(prev!.lesson, prev!.item)).toBe("Plain Knitting");
    expect(contentItemDisplayTitle(next!.lesson, next!.item)).toBe("Electronics Set up for DAK");
  });

  it("exposes Electronics Set up for DAK as one page based on the first version", () => {
    const block = data.lessons
      .flatMap((lesson) => lesson.blocks ?? [])
      .find((entry) => entry.slug === "electronics-set-up-for-dak");
    expect(block).toBeTruthy();
    expect(block!.components).toHaveLength(1);

    const html = String((block!.components![0] as { html: string }).html);
    expect(html).toContain("This machines uses external devices for automatic patterning");
    expect(html).toContain("REQUIRED:");
    expect(html).toContain("SilverLink 4 or 5 box");
    expect(html).toContain("N-1 Cam (Needle 1)");
    expect(html).toContain("NOT used with DesignaKnit");
    expect(html).toContain("/images/course-content/111/cables2.jpg");
    expect(html).toContain("/images/course-content/111/silver_knit_connect.jpg");
    expect(html).toContain("/images/course-content/111/silverlink.jpg");
    expect(html).toContain("Connect the electronics");
    expect(html).toContain("Position the Curl Cord on the tension mast");
    expect(html).not.toContain("id=\"paper\"");
    expect(html).not.toContain('href="#"');

    const course = getLegacyCourseBySlug(SK840_SLUG, { includeDrafts: true });
    const lesson = course!.lessons.find((entry) => entry.slug === "learn-about-the-machine");
    const items = getLessonContentItemsWithSlugs(lesson!);
    const elecItems = items.filter((item) => item.blockSlug === "electronics-set-up-for-dak");
    expect(elecItems).toHaveLength(1);
    expect(contentItemNavTitle(lesson!, elecItems[0]!, items)).toBe("Electronics Set up for DAK");

    const { prev, next } = getCourseContentItemNeighbors(
      course!,
      lesson!.slug,
      elecItems[0]!.itemSlug,
    );
    expect(contentItemDisplayTitle(prev!.lesson, prev!.item)).toBe("The Proper Way to Knit");
    expect(contentItemDisplayTitle(next!.lesson, next!.item)).toBe("Needles");
  });

  it("keeps Needles as a single reference image without sales links", () => {
    const block = data.lessons
      .flatMap((lesson) => lesson.blocks ?? [])
      .find((entry) => entry.slug === "needles");
    expect(block).toBeTruthy();
    expect(block!.title).toBe("Needles");
    expect(block!.components).toHaveLength(1);

    const html = String((block!.components![0] as { html: string }).html);
    expect(html).toContain("/images/course-content/111/840_needles1.jpg");
    expect(html).toContain("Reference guide for Silver Reed SK840 knitting machine needles.");
    expect(html).not.toContain("Buy");
    expect(html).not.toContain("store/product");
    expect(html).not.toContain("shopping-cart");
    expect(html).not.toContain("10needles4");
    expect(html).not.toContain("Knit it Now");
  });

  it("presents Point Cams with glossary-based explanation before the insert video", () => {
    const block = data.lessons
      .flatMap((lesson) => lesson.blocks ?? [])
      .find((entry) => entry.slug === "insert-point-cams");
    expect(block).toBeTruthy();
    expect(block!.title).toBe("Point Cams");
    expect(block!.legacy?.editorLayout).toBe("textVideoStacked");
    expect(block!.components).toHaveLength(2);

    const video = (block!.components ?? []).find((component) => component.type === "video");
    expect(video && "vimeoId" in video ? String(video.vimeoId) : "").toBe("825599756");

    const html = String(
      ((block!.components ?? []).find((component) => component.type === "richText") as { html: string })
        .html,
    );
    expect(html).toContain("point cams determine the range of pattern knitting");
    expect(html).toContain("/images/course-content/111/point-cams-machine-knitting.jpg");
    expect(html).toContain("Point cams and Needle 1 Cam positioned on a Silver Reed knitting machine.");
    expect(html).toContain("/images/course-content/111/sk840_operation_manual.pdf");
    expect(html).toContain("/glossary/point-cams/");
    expect(html).toContain("View Point Cams in the Knitting Glossary");
    expect(existsSync(join(process.cwd(), "public/images/course-content/111/point-cams-machine-knitting.jpg"))).toBe(
      true,
    );
    expect(existsSync(join(process.cwd(), "public/images/course-content/111/sk840_operation_manual.pdf"))).toBe(
      true,
    );

    const course = getLegacyCourseBySlug(SK840_SLUG, { includeDrafts: true });
    const lesson = course!.lessons.find((entry) => entry.slug === "learn-about-the-machine");
    const items = getLessonContentItemsWithSlugs(lesson!);
    const pointItems = items.filter((item) => item.blockSlug === "insert-point-cams");
    expect(pointItems).toHaveLength(1);
    expect(pointItems[0]!.type).toBe("textVideoLayout");
    expect(contentItemNavTitle(lesson!, pointItems[0]!, items)).toBe("Point Cams");
  });

  it("consolidates Thread Your Machine into one two-video player page", () => {
    const block = data.lessons
      .flatMap((lesson) => lesson.blocks ?? [])
      .find((entry) => entry.slug === "thread-your-machine");
    expect(block).toBeTruthy();
    expect(block!.title).toBe("Thread Your Machine");
    expect(block!.legacy?.editorLayout).toBe("twoVideosSideBySide");
    expect(block!.components).toHaveLength(2);

    const videos = [...(block!.components ?? [])]
      .filter((component) => component.type === "video")
      .sort((a, b) => Number(a.order ?? 0) - Number(b.order ?? 0));
    expect(videos).toHaveLength(2);
    expect(videos.map((video) => ("vimeoId" in video ? String(video.vimeoId) : ""))).toEqual([
      "798192674",
      "1380393647",
    ]);
    expect(videos.map((video) => ("title" in video ? String(video.title) : ""))).toEqual([
      "Carriage and yarn feeder(s)",
      "Tension Mast Assembly - Control the yarn",
    ]);
    expect(videos.some((video) => ("vimeoId" in video ? String(video.vimeoId) : "") === "681013133")).toBe(
      false,
    );

    const course = getLegacyCourseBySlug(SK840_SLUG, { includeDrafts: true });
    const lesson = course!.lessons.find((entry) => entry.slug === "get-knitting");
    const items = getLessonContentItemsWithSlugs(lesson!);
    const threadItems = items.filter((item) => item.blockSlug === "thread-your-machine");
    expect(threadItems).toHaveLength(1);
    expect(threadItems[0]!.type).toBe("twoVideosLayout");
    expect(contentItemNavTitle(lesson!, threadItems[0]!, items)).toBe("Thread Your Machine");

    const { prev, next } = getCourseContentItemNeighbors(
      course!,
      lesson!.slug,
      threadItems[0]!.itemSlug,
    );
    expect(contentItemDisplayTitle(prev!.lesson, prev!.item)).toBe("Point Cams");
    expect(contentItemDisplayTitle(next!.lesson, next!.item)).toBe("Secure Your Yarn Tail");
  });

  it("consolidates Casting On Stitches into one two-video player page", () => {
    const block = data.lessons
      .flatMap((lesson) => lesson.blocks ?? [])
      .find((entry) => entry.slug === "casting-on-stitches");
    expect(block).toBeTruthy();
    expect(block!.title).toBe("Casting On Stitches");
    expect(block!.legacy?.editorLayout).toBe("twoVideosSideBySide");
    expect(block!.components).toHaveLength(2);

    const videos = [...(block!.components ?? [])]
      .filter((component) => component.type === "video")
      .sort((a, b) => Number(a.order ?? 0) - Number(b.order ?? 0));
    expect(videos).toHaveLength(2);
    expect(videos.map((video) => ("vimeoId" in video ? String(video.vimeoId) : ""))).toEqual([
      "151860058",
      "1022707004",
    ]);
    expect(videos.map((video) => ("title" in video ? String(video.title) : ""))).toEqual([
      "e-wrap cast on",
      "Super Fast Slip Cast on",
    ]);

    const htmlBlobs = (block!.components ?? [])
      .filter((component) => component.type === "richText")
      .map((component) => ("html" in component ? String(component.html) : ""));
    expect(htmlBlobs.join("")).not.toContain("classrooms/44");
    expect(htmlBlobs.join("")).not.toContain("Classroom");
    expect(htmlBlobs.join("")).not.toContain("c86_lightbulb_icon");

    const course = getLegacyCourseBySlug(SK840_SLUG, { includeDrafts: true });
    const lesson = course!.lessons.find((entry) => entry.slug === "get-knitting");
    const items = getLessonContentItemsWithSlugs(lesson!);
    const castingItems = items.filter((item) => item.blockSlug === "casting-on-stitches");
    expect(castingItems).toHaveLength(1);
    expect(castingItems[0]!.type).toBe("twoVideosLayout");
    expect(contentItemNavTitle(lesson!, castingItems[0]!, items)).toBe("Casting On Stitches");

    const { prev, next } = getCourseContentItemNeighbors(
      course!,
      lesson!.slug,
      castingItems[0]!.itemSlug,
    );
    expect(contentItemDisplayTitle(prev!.lesson, prev!.item)).toBe("Open vs Closed Cast On");
    expect(contentItemDisplayTitle(next!.lesson, next!.item)).toBe("Knit a Swatch");
  });

  it("presents Knit a Swatch as one text+video page with catalog video 2189", () => {
    const block = data.lessons
      .flatMap((lesson) => lesson.blocks ?? [])
      .find((entry) => entry.slug === "knit-a-swatch");
    expect(block).toBeTruthy();
    expect(block!.title).toBe("Knit a Swatch");
    expect(block!.components).toHaveLength(2);
    expect(
      (block!.components ?? []).some(
        (component) => Number(component.legacyComponentId) === 9327,
      ),
    ).toBe(false);

    const html = String(
      ((block!.components ?? []).find((component) => component.type === "richText") as {
        html: string;
      }).html,
    );
    expect(html).toContain("establishing gauge IS CRITICAL");
    expect(html).toContain('To knit a "proper" swatch');
    expect(html).toContain("Cast on 60 stitches with the method of your choice");
    expect(html).toContain("Isolate and mark 40 stitches");
    expect(html).toContain("/images/course-content/111/gauge.jpg");
    expect(html).not.toContain("c103_gauge_swatch.jpg");
    expect(html).toContain("sk840-swatch__img");
    expect(html).toContain(
      "Knitted gauge swatch with contrasting marker rows and stitches and arrows showing the horizontal and vertical measuring area.",
    );
    expect(existsSync(join(process.cwd(), "public/images/course-content/111/gauge.jpg"))).toBe(true);
    expect(html).toContain('data-GlossaryId="662"');
    expect(html).not.toContain("SWATCHING IS NOT OPTIONAL");
    expect(html).not.toContain("cheat_sheet_plain.jpg");
    expect(html).not.toContain("fa-spinner");
    expect(html).not.toContain("Knit for 80 rows");
    expect(html).not.toContain("<div class=\"text-center\"></div>");

    const video = (block!.components ?? []).find((component) => component.type === "video");
    expect(video && "vimeoId" in video ? String(video.vimeoId) : "").toBe("1046394794");
    expect(video && "title" in video ? String(video.title) : "").toBe(
      "How to Knit a Proper Swatch: The Secret to Machine Knitting Success",
    );
    expect(video && "legacyComponentId" in video ? Number(video.legacyComponentId) : 0).toBe(2189);

    const course = getLegacyCourseBySlug(SK840_SLUG, { includeDrafts: true });
    const lesson = course!.lessons.find((entry) => entry.slug === "your-turn-get-started");
    const items = getLessonContentItemsWithSlugs(lesson!);
    const swatchItems = items.filter((item) => item.blockSlug === "knit-a-swatch");
    expect(swatchItems).toHaveLength(1);
    expect(swatchItems[0]!.type).toBe("textVideoLayout");
    expect(contentItemNavTitle(lesson!, swatchItems[0]!, items)).toBe("Knit a Swatch");

    const { prev, next } = getCourseContentItemNeighbors(
      course!,
      lesson!.slug,
      swatchItems[0]!.itemSlug,
    );
    expect(contentItemDisplayTitle(prev!.lesson, prev!.item)).toBe("Casting On Stitches");
    expect(contentItemDisplayTitle(next!.lesson, next!.item)).toBe("Accurate Gauge Measurement");
  });

  it("presents Accurate Gauge Measurement with video, photo, glossary, and calculator links", () => {
    const block = data.lessons
      .flatMap((lesson) => lesson.blocks ?? [])
      .find((entry) => entry.slug === "accurate-gauge-measurement");
    expect(block).toBeTruthy();
    expect(block!.title).toBe("Accurate Gauge Measurement");
    expect(block!.legacy?.editorLayout).toBe("textVideo");
    expect(block!.components).toHaveLength(2);

    const video = (block!.components ?? []).find((component) => component.type === "video");
    expect(video && "vimeoId" in video ? String(video.vimeoId) : "").toBe("260683875");
    expect(video && "title" in video ? video.title : "missing").toBeNull();

    const htmlBlobs = (block!.components ?? [])
      .filter((component) => component.type === "richText")
      .map((component) => ("html" in component ? String(component.html) : ""));
    const html = htmlBlobs.join("\n");
    expect(html).not.toContain("legacy-video-chapters");
    expect(html).not.toContain("00:00:26");
    expect(html).not.toContain("00:01:29");
    expect(html).not.toContain("00:03:41");
    expect(html).not.toContain("Chapters");
    expect(html).toContain("/images/course-content/111/accurate-gauge-measurement.png");
    expect(html).toContain(
      "Two views of a knitted gauge swatch showing horizontal and vertical measurements between contrasting marker stitches.",
    );
    expect(html).toContain("More Gauge Help");
    expect(html).toContain("Calculate Your Gauge");
    expect(html).toContain("/glossary/gauge/");
    expect(html).toContain("Learn More About Gauge");
    expect(html).toContain("/tools/gauge-calculator");
    expect(html).toContain("Use the Gauge Calculator");
    expect(html).toContain("Review the Gauge glossary entry for more information about measuring gauge.");
    expect(html).toContain("Enter your swatch measurements in the Gauge Calculator");
    expect(html).not.toContain("c103_gauge_swatch.jpg");
    expect(html).not.toContain("/images/course-content/111/gauge.jpg");
    expect(html).not.toContain("1aca139d-502d-4f43-8fe3-0f333951f7a8");
    expect(html).not.toContain("46819c48-7831-47ac-a2e9-c0f73dd2abe0");
    expect(
      existsSync(join(process.cwd(), "public/images/course-content/111/accurate-gauge-measurement.png")),
    ).toBe(true);

    const course = getLegacyCourseBySlug(SK840_SLUG, { includeDrafts: true });
    const lesson = course!.lessons.find((entry) => entry.slug === "your-turn-get-started");
    const items = getLessonContentItemsWithSlugs(lesson!);
    const gaugeItems = items.filter((item) => item.blockSlug === "accurate-gauge-measurement");
    expect(gaugeItems).toHaveLength(1);
    expect(gaugeItems[0]!.type).toBe("textVideoLayout");
    expect(contentItemNavTitle(lesson!, gaugeItems[0]!, items)).toBe("Accurate Gauge Measurement");

    const { prev, next } = getCourseContentItemNeighbors(
      course!,
      lesson!.slug,
      gaugeItems[0]!.itemSlug,
    );
    expect(contentItemDisplayTitle(prev!.lesson, prev!.item)).toBe("Knit a Swatch");
    expect(contentItemDisplayTitle(next!.lesson, next!.item)).toBe("Gauge Rulers (Gauge Scales)");
  });

  it("presents Gauge Rulers with intro, image, glossary video, and printable resource", () => {
    const block = data.lessons
      .flatMap((lesson) => lesson.blocks ?? [])
      .find((entry) => entry.slug === "gauge-rulers-gauge-scales");
    expect(block).toBeTruthy();
    expect(block!.title).toBe("Gauge Rulers (Gauge Scales)");
    expect(block!.legacy?.editorLayout).toBe("textVideoStacked");
    expect(block!.components).toHaveLength(3);

    const video = (block!.components ?? []).find((component) => component.type === "video");
    expect(video && "vimeoId" in video ? String(video.vimeoId) : "").toBe("1055227693");
    expect(video && "title" in video ? String(video.title) : "").toBe("Gauge Rulers");

    const html = (block!.components ?? [])
      .filter((component) => component.type === "richText")
      .map((component) => ("html" in component ? String(component.html) : ""))
      .join("\n");
    expect(html).toContain("sometimes called gauge scales");
    expect(html).toContain("The Silver Reed SK840 does not include gauge rulers");
    expect(html).toContain("/images/course-content/111/gauge-ruler-machine-knitting.jpg");
    expect(html).toContain(
      "Blue, green, and yellow plastic machine-knitting gauge rulers standing upright beside a transfer tool, with a cone of white yarn in the background.",
    );
    expect(html).toContain("Need Gauge Rulers for Your SK840?");
    expect(html).toContain("printable digital product, not a physical ruler");
    expect(html).toContain("https://knititnow.com/downloads/charting-rulers");
    expect(html).toContain("View Printable Charting Rulers");
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
    expect(html).not.toContain("Construct your own gauge ruler");
    expect(html).not.toContain("text-center");
    expect(html).not.toContain("/tools/gauge-calculator");
    expect(html).not.toContain("/glossary/gauge/");
    expect(
      existsSync(join(process.cwd(), "public/images/course-content/111/gauge-ruler-machine-knitting.jpg")),
    ).toBe(true);

    const course = getLegacyCourseBySlug(SK840_SLUG, { includeDrafts: true });
    const lesson = course!.lessons.find((entry) => entry.slug === "your-turn-get-started");
    const items = getLessonContentItemsWithSlugs(lesson!);
    const rulerItems = items.filter((item) => item.blockSlug === "gauge-rulers-gauge-scales");
    expect(rulerItems).toHaveLength(1);
    expect(rulerItems[0]!.type).toBe("textVideoLayout");
    expect(contentItemNavTitle(lesson!, rulerItems[0]!, items)).toBe("Gauge Rulers (Gauge Scales)");

    const { prev, next } = getCourseContentItemNeighbors(
      course!,
      lesson!.slug,
      rulerItems[0]!.itemSlug,
    );
    expect(contentItemDisplayTitle(prev!.lesson, prev!.item)).toBe("Accurate Gauge Measurement");
    expect(contentItemDisplayTitle(next!.lesson, next!.item)).toBe(
      "About Automatic Patterning on this Machine",
    );
  });

  it("keeps About Automatic Patterning as a single instructional page without LearnDAK promo", () => {
    const block = data.lessons
      .flatMap((lesson) => lesson.blocks ?? [])
      .find((entry) => entry.slug === "about-automatic-patterning-on-this-machine");
    expect(block).toBeTruthy();
    expect(block!.title).toBe("About Automatic Patterning on this Machine");
    expect(block!.components).toHaveLength(1);

    const component = block!.components![0] as { type: string; legacyComponentId: number; html: string };
    expect(component.type).toBe("richText");
    expect(component.legacyComponentId).toBe(9332);
    expect(component.html).toContain("EC1 / PE1 Pattern Controller");
    expect(component.html).toContain("DesignaKnit");
    expect(component.html).toContain("Selected needles + Carriage settings = Stitch Patterns");
    expect(component.html).toContain("N-1 Cams");
    expect(component.html).not.toContain("LearnDesignaKnit.com");
    expect(component.html).not.toContain("learndesignaknit.com");
    expect(component.html).not.toContain("learn_dak_logos.png");
    expect(component.html).not.toContain("Keep forever courses");
    expect(
      (block!.components ?? []).some((entry) => Number(entry.legacyComponentId) === 9348),
    ).toBe(false);

    const course = getLegacyCourseBySlug(SK840_SLUG, { includeDrafts: true });
    const lesson = course!.lessons.find((entry) => entry.slug === "automatic-stitch-patterning");
    const items = getLessonContentItemsWithSlugs(lesson!);
    const aboutItems = items.filter(
      (item) => item.blockSlug === "about-automatic-patterning-on-this-machine",
    );
    expect(aboutItems).toHaveLength(1);
    expect(contentItemNavTitle(lesson!, aboutItems[0]!, items)).toBe(
      "About Automatic Patterning on this Machine",
    );

    const { prev, next } = getCourseContentItemNeighbors(
      course!,
      lesson!.slug,
      aboutItems[0]!.itemSlug,
    );
    expect(contentItemDisplayTitle(prev!.lesson, prev!.item)).toBe("Gauge Rulers (Gauge Scales)");
    expect(contentItemDisplayTitle(next!.lesson, next!.item)).toBe(
      "How does Automatic Patterning Work?",
    );
  });

  it("reorganizes Stitch Patterning into three methods with shared Before You Begin", () => {
    const lesson = data.lessons.find((entry) => entry.slug === "automatic-stitch-patterning");
    expect(lesson).toBeTruthy();

    const blockTitles = (lesson!.blocks ?? []).map((block) => block.title);
    expect(blockTitles).toEqual([
      "About Automatic Patterning on this Machine",
      "How does Automatic Patterning Work?",
      "Stitch Patterning: Three Ways to Use DesignaKnit",
      "Before You Begin",
      "Knit a Stitch Pattern",
      "Position a Stitch Pattern",
      "Knit a Garment in Pattern",
      "Bits and Pieces",
      "End Needle Selection",
      '<i class="fa fa-ban" aria-hidden="true"></i> Wrong Way!',
    ]);

    const removedSlugs = [
      "patterning-goals",
      "exercises",
      "position-pattern-on-needlebed",
      "shaping-garment-pieces",
      "i-class-fa-fa-circle-style-color-9f2065-aria-hidden-true-i-knit-in-a-stitch-pattern",
      "i-class-fa-fa-circle-style-color-9f2065-aria-hidden-true-i-position-a-stitch-pattern",
      "i-class-fa-fa-circle-style-color-9f2065-aria-hidden-true-i-knit-a-garment-in-pattern",
    ];
    for (const slug of removedSlugs) {
      expect((lesson!.blocks ?? []).some((block) => block.slug === slug)).toBe(false);
    }

    const lessonHtml = (lesson!.blocks ?? [])
      .flatMap((block) => block.components ?? [])
      .filter((component) => component.type === "richText")
      .map((component) => ("html" in component ? String(component.html) : ""))
      .join("\n");
    expect(lessonHtml).not.toContain("/images/course-content/111/1.jpg");
    expect(lessonHtml).not.toContain("/images/course-content/111/2.jpg");
    expect(lessonHtml).not.toContain("/images/course-content/111/3.jpg");
    expect(lessonHtml).not.toContain("1 ALLOVER.pdf");
    expect(lessonHtml).not.toContain("2 POSITION.pdf");
    expect(lessonHtml).not.toContain("3GARMENT.pdf");
    expect(lessonHtml).not.toContain("WORKSHEETS.pdf");
    expect(lessonHtml).not.toContain("learndesignaknit.com");
    expect(lessonHtml).not.toContain("learn_dak_logos.png");

    const methodHtml = (lesson!.blocks ?? [])
      .filter((block) =>
        [
          "stitch-patterning-three-ways",
          "before-you-begin",
          "knit-a-stitch-pattern",
          "position-a-stitch-pattern",
          "knit-a-garment-in-pattern",
        ].includes(String(block.slug)),
      )
      .flatMap((block) => block.components ?? [])
      .filter((component) => component.type === "richText")
      .map((component) => ("html" in component ? String(component.html) : ""))
      .join("\n");
    expect(methodHtml).not.toContain("videopopup");
    expect(methodHtml).toContain("Connect the computer, SilverLink, curl cord, and machine");
    expect(methodHtml).toContain("Set the point cams to the edges of the knitting");
    expect(methodHtml).toContain("Set the cam lever for the stitch type");
    expect(methodHtml).toContain("Follow the Interactive Knitting prompts");

    const videoByBlock = Object.fromEntries(
      (lesson!.blocks ?? []).map((block) => [
        block.slug,
        (block.components ?? [])
          .filter((component) => component.type === "video")
          .map((component) => ("vimeoId" in component ? String(component.vimeoId) : "")),
      ]),
    );
    expect(videoByBlock["knit-a-stitch-pattern"]).toEqual(["799677711"]);
    expect(videoByBlock["position-a-stitch-pattern"]).toEqual(["799905939"]);
    expect(videoByBlock["knit-a-garment-in-pattern"]).toEqual(["799990951", "800130992"]);

    const knitBlock = (lesson!.blocks ?? []).find((block) => block.slug === "knit-a-stitch-pattern");
    expect(knitBlock?.legacy?.editorLayout).toBe("textVideo");
    const positionBlock = (lesson!.blocks ?? []).find(
      (block) => block.slug === "position-a-stitch-pattern",
    );
    expect(positionBlock?.legacy?.editorLayout).toBe("textVideo");
    const garmentBlock = (lesson!.blocks ?? []).find(
      (block) => block.slug === "knit-a-garment-in-pattern",
    );
    expect(garmentBlock?.legacy?.editorLayout).toBe("twoVideosSideBySide");

    const temp = data.lessons.find((entry) => entry.slug === "temp-to-delete-later");
    expect(temp?.published).toBe(false);
    expect((temp?.blocks ?? []).some((block) => block.slug === "steps-for-patterning")).toBe(false);

    const course = getLegacyCourseBySlug(SK840_SLUG, { includeDrafts: true });
    const loaded = course!.lessons.find((entry) => entry.slug === "automatic-stitch-patterning");
    const items = getLessonContentItemsWithSlugs(loaded!);
    const introItem = items.find((item) => item.blockSlug === "stitch-patterning-three-ways");
    expect(introItem).toBeTruthy();
    expect(contentItemNavTitle(loaded!, introItem!, items)).toBe(
      "Stitch Patterning: Three Ways to Use DesignaKnit",
    );

    const { prev, next } = getCourseContentItemNeighbors(
      course!,
      loaded!.slug,
      introItem!.itemSlug,
    );
    expect(contentItemDisplayTitle(prev!.lesson, prev!.item)).toBe(
      "How does Automatic Patterning Work?",
    );
    expect(contentItemDisplayTitle(next!.lesson, next!.item)).toBe("Before You Begin");

    const garmentItem = items.find((item) => item.blockSlug === "knit-a-garment-in-pattern");
    const garmentNeighbors = getCourseContentItemNeighbors(
      course!,
      loaded!.slug,
      garmentItem!.itemSlug,
    );
    expect(contentItemDisplayTitle(garmentNeighbors.next!.lesson, garmentNeighbors.next!.item)).toBe(
      "Bits and Pieces",
    );
  });

  it("removes the Weaving Cast on Checklist block from Get Knitting", () => {
    const lesson = data.lessons.find((entry) => entry.slug === "get-knitting");
    expect(lesson).toBeTruthy();
    expect(
      (lesson!.blocks ?? []).some((entry) => entry.slug === "weaving-cast-on-checklist"),
    ).toBe(false);
    expect(
      (lesson!.blocks ?? []).some((entry) => entry.title === "Weaving Cast on Checklist"),
    ).toBe(false);

    const htmlBlobs = (lesson!.blocks ?? [])
      .flatMap((entry) => entry.components ?? [])
      .filter((component) => component.type === "richText")
      .map((component) => ("html" in component ? String(component.html) : ""));
    expect(htmlBlobs.join("")).not.toContain("cast_on_checklist.jpg");
    expect(
      (lesson!.blocks ?? [])
        .flatMap((entry) => entry.components ?? [])
        .some((component) => Number(component.legacyComponentId) === 9326),
    ).toBe(false);

    const course = getLegacyCourseBySlug(SK840_SLUG, { includeDrafts: true });
    const getKnitting = course!.lessons.find((entry) => entry.slug === "get-knitting");
    const items = getLessonContentItemsWithSlugs(getKnitting!);
    expect(items.some((item) => item.blockSlug === "weaving-cast-on-checklist")).toBe(false);
  });

  it("presents Secure Your Yarn Tail as one accessible six-option carousel", () => {
    const block = data.lessons
      .flatMap((lesson) => lesson.blocks ?? [])
      .find((entry) => entry.slug === "secure-the-yarn-tail");
    expect(block).toBeTruthy();
    expect(block!.title).toBe("Secure Your Yarn Tail");
    expect(block!.components).toHaveLength(1);

    const carousel = block!.components![0] as {
      type: string;
      introHtml?: string;
      countFormat?: string;
      className?: string;
      slides: Array<{ src: string; alt?: string | null; caption?: string | null }>;
    };
    expect(carousel.type).toBe("imageCarousel");
    expect(carousel.countFormat).toBe("option");
    expect(carousel.className).toBe("sk840-yarn-tail");
    expect(carousel.introHtml).toContain(
      "There are several ways to secure your yarn tail when you begin knitting.",
    );
    expect(carousel.introHtml).not.toContain("Use the arrows");
    expect(carousel.slides).toHaveLength(6);

    const filenames = carousel.slides.map((slide) => slide.src.split("/").pop());
    expect(filenames).toEqual([
      "tail1a.jpg",
      "tail1.jpg",
      "tail2.jpg",
      "tail3.jpg",
      "tail4.jpg",
      "clip.jpg",
    ]);
    for (const name of filenames) {
      expect(existsSync(join(process.cwd(), "public/images/course-content/111", name!))).toBe(true);
    }

    expect(carousel.slides[0]!.caption).toBeNull();
    expect(carousel.slides[1]!.caption).toContain("Some knitters tie the yarn tail to the table clamp.");
    expect(carousel.slides[1]!.caption).toContain("Caution:");
    expect(carousel.slides[1]!.caption).toContain("fa-thumbs-o-down");
    expect(carousel.slides[2]!.caption).toContain("cast-on comb");
    expect(carousel.slides[2]!.caption).toContain("Caution:");
    expect(carousel.slides[3]!.caption).toContain("Recommended:");
    expect(carousel.slides[3]!.caption).toContain("fa-thumbs-o-up");
    expect(carousel.slides[3]!.caption).toContain("chip clip");
    expect(carousel.slides[4]!.caption).toContain("Recommended:");
    expect(carousel.slides[4]!.caption).toContain("clothespin");
    expect(carousel.slides[5]!.caption).toContain("Silver Reed SK840 has its own yarn clips");
    expect(carousel.slides.every((slide) => String(slide.alt ?? "").trim().length > 20)).toBe(true);
    expect(carousel.slides.some((slide) => /yarn tail image/i.test(String(slide.alt ?? "")))).toBe(
      false,
    );

    const course = getLegacyCourseBySlug(SK840_SLUG, { includeDrafts: true });
    const lesson = course!.lessons.find((entry) => entry.slug === "get-knitting");
    const items = getLessonContentItemsWithSlugs(lesson!);
    const secureItems = items.filter((item) => item.blockSlug === "secure-the-yarn-tail");
    expect(secureItems).toHaveLength(1);
    expect(secureItems[0]!.type).toBe("imageCarousel");
    expect(contentItemNavTitle(lesson!, secureItems[0]!, items)).toBe("Secure Your Yarn Tail");

    const { prev, next } = getCourseContentItemNeighbors(
      course!,
      lesson!.slug,
      secureItems[0]!.itemSlug,
    );
    expect(contentItemDisplayTitle(prev!.lesson, prev!.item)).toBe("Thread Your Machine");
    expect(contentItemDisplayTitle(next!.lesson, next!.item)).toBe("Needle Positions");
  });

  it("retains both converted inline Vimeo video IDs", () => {
    const ids = new Set<string>();
    for (const lesson of data.lessons) {
      if (lesson.published === false) continue;
      for (const block of lesson.blocks ?? []) {
        for (const component of block.components ?? []) {
          if (component.type === "video" && "vimeoId" in component) {
            ids.add(String(component.vimeoId));
          }
        }
      }
    }
    expect(ids.has("312574558")).toBe(true);
    expect(ids.has("825599756")).toBe(true);
  });

  it("removes chapter timestamps from Accurate Gauge Measurement", () => {
    const lesson = data.lessons.find((item) => item.slug === "your-turn-get-started");
    const block = lesson?.blocks.find((item) => item.slug === "accurate-gauge-measurement");
    expect(block).toBeTruthy();
    const html = (block!.components ?? [])
      .filter((component) => component.type === "richText")
      .map((component) => ("html" in component ? String(component.html) : ""))
      .join("\n");
    expect(html).not.toContain("legacy-video-chapters");
    expect(html).not.toContain("00:00:26");
    expect(html).not.toContain("About measuring Swatches");
    const video = (block!.components ?? []).find((component) => component.type === "video");
    expect(video && "vimeoId" in video && video.vimeoId === "260683875").toBe(true);
  });
});
