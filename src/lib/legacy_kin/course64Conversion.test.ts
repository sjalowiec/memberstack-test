import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import course64 from "../../data/legacy_kin/cleaned/course_64_your_2nd_sweater.poc.json";
import { isAccordionLayoutBlock } from "./courseAccordionLayout";
import {
  getCourseContentItemNeighbors,
  getLessonContentNavEntries,
} from "./courseLessonContentItems";
import { isTextVideoLayoutBlock } from "./courseTextVideoLayout";
import { validateLessonForPublicRenderer } from "./courseLessonPublicRenderer";
import {
  getLegacyCourseBySlug,
  getLegacyCourses,
  legacyCoursePreviewHref,
} from "./legacyCourseLoader";
import { isLegacyCourseDraft, isLegacyCoursePublic } from "./legacyCoursePublication";
import type { CourseLesson, CoursePreviewData } from "./coursePreviewPoc";

const COURSE_SLUG = "your-2nd-sweater";
const INTRO_SLUG = "introduction";
const PART1_SLUG = "part-1-decisions-decisions-decisions";
const IMAGE_PUBLIC_PATH = "/images/course-content/64/child_rolled_nile.jpg";
const IMAGE_FILE = join(process.cwd(), "public/images/course-content/64/child_rolled_nile.jpg");
const LEGACY_IMAGE_FILE = join(
  process.cwd(),
  "public/challenge/images/v2/64/child_rolled_nile.jpg",
);
const VIMEO_ID = "392986594";

const PART1_LOCAL_ASSETS = [
  "/images/course-content/64/yarn_calculator.jpg",
  "/images/course-content/64/course_1.png",
  "/images/course-content/64/course_2.png",
] as const;

const CONVERTED_LESSON_SLUGS = [
  INTRO_SLUG,
  PART1_SLUG,
  "don-t-skip-this",
  "your-pattern",
  "part-2-back",
  "part-3-front",
  "part-4-neckband",
  "part-5-sleeves-finishing",
  "what-s-next",
] as const;

const LOCALIZED_ASSETS = [
  "/images/course-content/64/child_rolled_nile.jpg",
  "/images/course-content/64/yarn_calculator.jpg",
  "/images/course-content/64/course_1.png",
  "/images/course-content/64/course_2.png",
  "/images/course-content/64/You_can_do_this.gif",
  "/images/course-content/64/an_expert_was_beginner.gif",
  "/images/course-content/64/chart_format.jpg",
  "/images/course-content/64/watch_these_before_knitting.gif",
  "/images/course-content/64/on_the_home_stretch.gif",
  "/images/course-content/64/sleeves.png",
  "/images/course-content/64/rolled_hem_seam_800.jpg",
  "/images/course-content/64/well_executed_seam.gif",
  "/images/course-content/64/seam_good.jpg",
  "/images/course-content/64/seam_ugly.jpg",
  "/images/course-content/64/seam1.jpg",
  "/images/course-content/64/seam3.jpg",
] as const;

const PRESERVED_VIMEO_IDS = [
  "392986594",
  "323575618",
  "151859471",
  "396776651",
  "391663684",
  "178357273",
  "151858757",
  "343343552",
  "393050658",
  "151859753",
  "151858551",
  "151859107",
  "393080348",
  "393138040",
  "151858940",
  "393147725",
  "151858422",
] as const;

const OBSOLETE_PATTERN_ENGINE = [
  "DataSelectJson",
  "DataValidation",
  "DocumentPattern",
  "DYNAMICGARMENTVARIABLE",
  "GARMENTTITLE",
  "\"legacyType\": \"Pattern\"",
  "migrationPending",
] as const;

const GLOSSARY_HREFS = [
  'href="/glossary/e-wrap"',
  'href="/glossary/rolled-hem"',
  'href="/glossary/place-marker"',
  'href="/glossary/scrap-off"',
  'href="/glossary/lifeline"',
  'href="/glossary/mattress-stitch"',
] as const;

const PART1_NAV = [
  { itemSlug: "decisions-decisions-decisions", title: "Decisions, decisions, decisions" },
  { itemSlug: "planning-worksheet", title: "Planning Worksheet" },
  { itemSlug: "swatching-is-not-optional", title: "Swatching is NOT Optional" },
  { itemSlug: "swatching-in-pattern-knitting", title: "Swatching in Pattern Knitting" },
  { itemSlug: "cuffs-hems-and-necklines", title: "Cuffs, Hems and necklines" },
  { itemSlug: "open-shoulder-for-kids", title: "Open Shoulder for Kids" },
] as const;

const BOOTSTRAP_MARKERS = [
  "img-thumbnail",
  "container-border",
  "MachineknittingColor",
  "section-title",
  "videopopup",
  "data-toggle",
  "btn-xs",
  "btn-default",
  'class="row"',
  "col-sm-",
  "col-md-",
  "img-thumbnail zoom",
  "panel-default",
  "panel-heading",
];

function asCourse(data: unknown): CoursePreviewData {
  return data as CoursePreviewData;
}

function lessonBySlug(data: CoursePreviewData, slug: string): CourseLesson {
  const lesson = data.lessons.find((item) => item.slug === slug);
  expect(lesson).toBeDefined();
  return lesson!;
}

function stringifyLesson(lesson: CourseLesson): string {
  return JSON.stringify(lesson);
}

function collectHtml(lesson: CourseLesson): string {
  return stringifyLesson(lesson);
}

function collectCourseVimeoIds(data: CoursePreviewData): string[] {
  return data.lessons.flatMap((lesson) =>
    lesson.blocks.flatMap((block) =>
      (block.components ?? [])
        .filter((component) => component.type === "video")
        .map((component) => ("vimeoId" in component ? String(component.vimeoId) : "")),
    ),
  );
}

function collectCourseHtml(data: CoursePreviewData): string {
  return JSON.stringify(data);
}

describe("Course 64 conversion invariants", () => {
  const data = asCourse(course64);

  it("remains draft / in_progress / unpublished", () => {
    expect(data.course.legacyChallengeId).toBe(64);
    expect(data.course.title).toBe("Your 2nd Sweater");
    expect(data.course.slug).toBe(COURSE_SLUG);
    expect(data.course.status).toBe("draft");
    expect(data.course.published).toBe(false);
    expect(data.course.contentStatus).toBe("in_progress");
    expect(isLegacyCourseDraft(data.course)).toBe(true);
    expect(isLegacyCoursePublic(data.course)).toBe(false);
  });

  it("stays hidden from public catalog and public legacy routes", () => {
    const publicSlugs = getLegacyCourses().map((course) => course.slug);
    expect(publicSlugs).not.toContain(COURSE_SLUG);
    expect(getLegacyCourseBySlug(COURSE_SLUG)).toBeUndefined();

    const draft = getLegacyCourseBySlug(COURSE_SLUG, { includeDrafts: true });
    expect(draft?.course.slug).toBe(COURSE_SLUG);
    expect(draft?.course.status).toBe("draft");
  });

  it("converts Introduction in the shared course system without migrationPending", () => {
    const course = getLegacyCourseBySlug(COURSE_SLUG, { includeDrafts: true });
    expect(course).toBeDefined();
    const lesson = lessonBySlug(course!, INTRO_SLUG);
    const rendered = validateLessonForPublicRenderer(lesson);

    expect(rendered.rendererPassed).toBe(true);
    expect(rendered.passed).toBe(true);
    expect(rendered.issues.filter((issue) => issue.severity === "error")).toEqual([]);
    expect(rendered.componentTypes).toEqual(["richText", "video"]);
    expect(rendered.blockSlugs).toEqual(["join-the-fun", "knitting-overview"]);

    for (const block of lesson.blocks) {
      for (const component of block.components ?? []) {
        expect(component.type).not.toBe("migrationPending");
      }
    }
  });

  it("localizes the Introduction image and no longer depends on /challenge/", () => {
    const html = lessonBySlug(data, INTRO_SLUG).blocks[0]?.components?.[0];
    expect(html?.type).toBe("richText");
    expect(html && "html" in html ? html.html : "").toContain(IMAGE_PUBLIC_PATH);
    expect(stringifyLesson(lessonBySlug(data, INTRO_SLUG))).not.toMatch(/\/challenge\//);
    expect(existsSync(IMAGE_FILE)).toBe(true);
    expect(existsSync(LEGACY_IMAGE_FILE)).toBe(true);
  });

  it("preserves Vimeo 392986594 as a course video component", () => {
    const video = lessonBySlug(data, INTRO_SLUG).blocks[1]?.components?.[0];
    expect(video?.type).toBe("video");
    expect(video && "vimeoId" in video ? video.vimeoId : "").toBe(VIMEO_ID);
    expect(video && "title" in video ? video.title : "").toBe(
      'Get the "Big Picture" before you go any further',
    );
  });

  it("removes Bootstrap-dependent markup from the converted Introduction", () => {
    const intro = stringifyLesson(lessonBySlug(data, INTRO_SLUG));
    for (const marker of BOOTSTRAP_MARKERS) {
      expect(intro).not.toContain(marker);
    }
    expect(intro).not.toContain("<style>");
    expect(intro).toContain("Are you NEW?");
    expect(intro).toContain("Ready for an adventure?");
    expect(intro).toContain("complete a basic pullover");
    expect(intro).not.toContain("comple a basic pullover");
    expect(intro).toContain("a basic drop shoulder pullover with a round neckline.)");
  });

  it("keeps Course Contents and lesson navigation for Introduction", () => {
    const course = getLegacyCourseBySlug(COURSE_SLUG, { includeDrafts: true });
    expect(course).toBeDefined();
    const lesson = lessonBySlug(course!, INTRO_SLUG);
    const nav = getLessonContentNavEntries(lesson);

    expect(nav.map((entry) => entry.itemSlug)).toEqual([
      "join-the-fun",
      "knitting-overview",
    ]);
    expect(nav.map((entry) => entry.title)).toEqual([
      "Join the fun!",
      "Knitting Overview",
    ]);

    const fromJoin = getCourseContentItemNeighbors(course!, INTRO_SLUG, "join-the-fun");
    expect(fromJoin.prev).toBeNull();
    expect(fromJoin.next?.lesson.slug).toBe(INTRO_SLUG);
    expect(fromJoin.next?.item.itemSlug).toBe("knitting-overview");

    const fromOverview = getCourseContentItemNeighbors(
      course!,
      INTRO_SLUG,
      "knitting-overview",
    );
    expect(fromOverview.prev?.item.itemSlug).toBe("join-the-fun");
    expect(fromOverview.next?.lesson.slug).toBe(PART1_SLUG);
    expect(fromOverview.next?.item.itemSlug).toBe("decisions-decisions-decisions");

    expect(
      legacyCoursePreviewHref(COURSE_SLUG, INTRO_SLUG, {
        itemSlug: "join-the-fun",
        includeDraftPreview: true,
      }),
    ).toBe("/courses/legacy/your-2nd-sweater/introduction/join-the-fun?preview=true");
  });

  it("converts Part 1 in the shared course system without migrationPending", () => {
    const course = getLegacyCourseBySlug(COURSE_SLUG, { includeDrafts: true });
    expect(course).toBeDefined();
    const lesson = lessonBySlug(course!, PART1_SLUG);
    const rendered = validateLessonForPublicRenderer(lesson);

    expect(rendered.rendererPassed).toBe(true);
    expect(rendered.passed).toBe(true);
    expect(rendered.issues.filter((issue) => issue.severity === "error")).toEqual([]);
    expect(rendered.componentTypes).toEqual(["exerciseAccordion", "richText", "video"]);

    for (const block of lesson.blocks) {
      for (const component of block.components ?? []) {
        expect(component.type).not.toBe("migrationPending");
      }
    }
  });

  it("keeps the four Decisions accordion sections without Bootstrap collapse", () => {
    const lesson = lessonBySlug(data, PART1_SLUG);
    const accordionBlock = lesson.blocks.find(
      (block) => block.slug === "decisions-decisions-decisions",
    );
    expect(accordionBlock).toBeDefined();
    expect(isAccordionLayoutBlock(accordionBlock!)).toBe(true);

    const accordion = accordionBlock!.components?.[0];
    expect(accordion?.type).toBe("exerciseAccordion");
    const sections =
      accordion && "sections" in accordion
        ? (accordion.sections as Array<{ title?: string; bodyHtml?: string; iconSrc?: string }>)
        : [];
    expect(sections.map((section) => String(section.title))).toEqual([
      "<h3>Pattern Features</h3>",
      "<h3>Sizes</h3>",
      "<h3>Yarn</h3>",
      "<h3>Get Creative</h3>",
    ]);
    expect(sections.every((section) => !section.iconSrc)).toBe(true);

    const serialized = stringifyLesson(lesson);
    expect(serialized).not.toContain("data-toggle");
    expect(serialized).not.toContain("class=\"collapse");
    expect(serialized).toContain("Are you NEW?");
    expect(serialized).toContain("Ready for an adventure?");
    expect(serialized).toContain("Ready for Adventure?");
  });

  it("localizes Part 1 images and drops /challenge/ dependencies", () => {
    const lesson = lessonBySlug(data, PART1_SLUG);
    const serialized = stringifyLesson(lesson);
    expect(serialized).not.toMatch(/\/challenge\//);

    for (const src of PART1_LOCAL_ASSETS) {
      expect(serialized).toContain(src);
      expect(existsSync(join(process.cwd(), "public", src.replace(/^\//, "")))).toBe(true);
    }

    expect(
      existsSync(join(process.cwd(), "public/challenge/images/v2/64/yarn_calculator.jpg")),
    ).toBe(true);
    expect(existsSync(join(process.cwd(), "public/challenge/images/v2/course_1.png"))).toBe(
      true,
    );
    expect(existsSync(join(process.cwd(), "public/challenge/images/v2/course_2.png"))).toBe(
      true,
    );
  });

  it("converts Planning Worksheet videos and removes videopopup controls", () => {
    const lesson = lessonBySlug(data, PART1_SLUG);
    const serialized = collectHtml(lesson);
    expect(serialized).not.toContain('class="videopopup');
    expect(serialized).not.toContain("videopopup btn");
    expect(serialized).not.toContain("data-vimeoid");
    expect(serialized).not.toContain("Print the Worksheet");

    const videos = lesson.blocks.flatMap((block) =>
      (block.components ?? []).filter((component) => component.type === "video"),
    );
    expect(
      videos.map((video) => ("vimeoId" in video ? video.vimeoId : "")),
    ).toEqual(["323575618", "151859471", "396776651"]);
    expect(videos.map((video) => ("title" in video ? video.title : ""))).toEqual([
      "Swatching is NOT Optional",
      "Swatching in Pattern Knitting",
      "Shoulder Opening for Kids Pullovers",
    ]);

    expect(lesson.blocks.some((block) => block.slug === "planning-worksheet")).toBe(true);
    const worksheet = lesson.blocks.find((block) => block.slug === "planning-worksheet");
    expect(worksheet?.components?.[0]?.type).toBe("richText");
  });

  it("keeps Course Contents and navigation through converted Part 1", () => {
    const course = getLegacyCourseBySlug(COURSE_SLUG, { includeDrafts: true });
    expect(course).toBeDefined();
    const lesson = lessonBySlug(course!, PART1_SLUG);
    const nav = getLessonContentNavEntries(lesson);

    expect(nav.map((entry) => entry.itemSlug)).toEqual(PART1_NAV.map((item) => item.itemSlug));
    expect(nav.map((entry) => entry.title)).toEqual(PART1_NAV.map((item) => item.title));

    const fromAccordion = getCourseContentItemNeighbors(
      course!,
      PART1_SLUG,
      "decisions-decisions-decisions",
    );
    expect(fromAccordion.prev?.lesson.slug).toBe(INTRO_SLUG);
    expect(fromAccordion.next?.item.itemSlug).toBe("planning-worksheet");

    const fromOpenShoulder = getCourseContentItemNeighbors(
      course!,
      PART1_SLUG,
      "open-shoulder-for-kids",
    );
    expect(fromOpenShoulder.prev?.item.itemSlug).toBe("cuffs-hems-and-necklines");
    expect(fromOpenShoulder.next?.lesson.slug).toBe("don-t-skip-this");
    expect(fromOpenShoulder.next?.item.itemSlug).toBe("step-1-your-success-depends-on-this");

    expect(
      legacyCoursePreviewHref(COURSE_SLUG, PART1_SLUG, {
        itemSlug: "planning-worksheet",
        includeDraftPreview: true,
      }),
    ).toBe(
      "/courses/legacy/your-2nd-sweater/part-1-decisions-decisions-decisions/planning-worksheet?preview=true",
    );
  });

  it("keeps the converted 9-lesson outline and renders every lesson", () => {
    expect(data.lessons.map((lesson) => lesson.slug)).toEqual([...CONVERTED_LESSON_SLUGS]);

    const course = getLegacyCourseBySlug(COURSE_SLUG, { includeDrafts: true });
    expect(course).toBeDefined();

    for (const slug of CONVERTED_LESSON_SLUGS) {
      const lesson = lessonBySlug(course!, slug);
      const rendered = validateLessonForPublicRenderer(lesson);
      expect(rendered.rendererPassed, slug).toBe(true);
      expect(rendered.passed, slug).toBe(true);
      expect(
        rendered.issues.filter((issue) => issue.severity === "error"),
        slug,
      ).toEqual([]);
    }
  });

  it("removes migrationPending and the obsolete Course 64 pattern engine", () => {
    const serialized = collectCourseHtml(data);
    for (const marker of OBSOLETE_PATTERN_ENGINE) {
      expect(serialized).not.toContain(marker);
    }

    for (const lesson of data.lessons) {
      for (const block of lesson.blocks) {
        for (const component of block.components ?? []) {
          expect(component.type, `${lesson.slug}/${block.slug}`).not.toBe("migrationPending");
        }
      }
    }
  });

  it("removes obsolete Perfect Fit video 374009611 and hands off to the Drop Shoulder Builder", () => {
    const serialized = collectCourseHtml(data);
    expect(serialized).not.toContain("374009611");
    expect(serialized).not.toContain("/patterns/drop-shoulder/builder?new=1");
    expect(serialized).not.toContain("returnTo");

    const lesson = lessonBySlug(data, "your-pattern");
    expect(lesson.blocks).toHaveLength(1);
    expect(lesson.blocks[0]?.slug).toBe("build-your-custom-pattern");
    const html = lesson.blocks[0]?.components?.[0];
    expect(html?.type).toBe("richText");
    const handoff = html && "html" in html ? html.html : "";
    expect(handoff).toContain('href="/patterns/drop-shoulder/builder"');
    expect(handoff).not.toContain("?new=1");
    expect(handoff).toContain("pullover");
    expect(handoff).toContain("round neckline");
    expect(handoff).toContain("Part 2: Back");
    expect(handoff).toContain("My Patterns");
  });

  it("converts remaining lessons without Bootstrap JS, videopopup, or recoverable /challenge/ images", () => {
    for (const slug of CONVERTED_LESSON_SLUGS) {
      const serialized = stringifyLesson(lessonBySlug(data, slug));
      for (const marker of BOOTSTRAP_MARKERS) {
        if (marker === "videopopup") {
          expect(serialized).not.toContain('class="videopopup');
          expect(serialized).not.toContain("videopopup btn");
          continue;
        }
        expect(serialized, `${slug} ${marker}`).not.toContain(marker);
      }
      expect(serialized, slug).not.toContain("data-vimeoid");
      expect(serialized, slug).not.toContain("/challenge/images");
      expect(serialized, slug).not.toContain("/kal_prickly_pear/");
      expect(serialized, slug).not.toContain("<style>");
    }
  });

  it("localizes recoverable Course 64 images onto disk", () => {
    const serialized = collectCourseHtml(data);
    for (const src of LOCALIZED_ASSETS) {
      expect(serialized).toContain(src);
      expect(existsSync(join(process.cwd(), "public", src.replace(/^\//, "")))).toBe(true);
    }
  });

  it("converts identifiable glossary/help terms to the current glossary-link modal", () => {
    const html = data.lessons
      .flatMap((lesson) =>
        lesson.blocks.flatMap((block) =>
          (block.components ?? []).flatMap((component) => {
            if ("html" in component && typeof component.html === "string") return [component.html];
            return [];
          }),
        ),
      )
      .join("\n");
    expect(html).toContain('class="glossary-link"');
    for (const href of GLOSSARY_HREFS) {
      expect(html).toContain(href);
    }
    expect(collectCourseHtml(data)).not.toContain("data-GlossaryId");
    expect(collectCourseHtml(data)).not.toContain("glossaryhelp");
  });

  it("preserves the intended Course 64 videos, including the converted iframe and lifeline popup", () => {
    const vimeoIds = collectCourseVimeoIds(data);
    for (const id of PRESERVED_VIMEO_IDS) {
      expect(vimeoIds).toContain(id);
    }
    expect(vimeoIds).not.toContain("374009611");
    expect(vimeoIds.filter((id) => id === "396776651")).toHaveLength(2);
  });

  it("converts Don't Skip This, including the borrowed blanket wording and duplicate open-shoulder video", () => {
    const lesson = lessonBySlug(data, "don-t-skip-this");
    const rendered = validateLessonForPublicRenderer(lesson);
    expect(rendered.blockSlugs).toEqual([
      "step-1-your-success-depends-on-this",
      "step-2-gauge-swatch-verses-tension-swatch",
      "step-3-knitting-swatches",
      "rolled-hem-study",
      "open-shoulder-video",
    ]);

    const step2 = lesson.blocks.find((block) => block.slug === "step-2-gauge-swatch-verses-tension-swatch");
    const step3 = lesson.blocks.find((block) => block.slug === "step-3-knitting-swatches");
    expect(isTextVideoLayoutBlock(step2!)).toBe(true);
    expect(isTextVideoLayoutBlock(step3!)).toBe(true);

    const serialized = stringifyLesson(lesson);
    expect(serialized).toContain("best tension to knit your blanket");
    expect(serialized).toContain("even for something as simple as a blanket");
    expect(serialized).toContain("/challenge/12/course/swatches-tension-and-gauge");
    expect(serialized).not.toContain("swatch_measure.jpg");
    expect(serialized).not.toContain("tension_swatch.jpg");
    expect(serialized).not.toContain("gauge_swatch_tension");
  });

  it("converts Part 2 Back glossary/help and the e-Wrap Cast On iframe to a course video", () => {
    const lesson = lessonBySlug(data, "part-2-back");
    const knitBack = lesson.blocks.find((block) => block.slug === "knit-the-back");
    expect(isTextVideoLayoutBlock(knitBack!)).toBe(true);
    expect(knitBack?.components?.some((component) => "vimeoId" in component && component.vimeoId === "343343552")).toBe(
      true,
    );
    expect(stringifyLesson(lesson)).toContain("/images/course-content/64/You_can_do_this.gif");
    expect(stringifyLesson(lesson)).not.toContain("/images/legend/childs_back.jpg");
    expect(stringifyLesson(lesson)).toContain("393050658");
  });

  it("converts Part 3 Front neckline videos, the lifeline popup, and localized images", () => {
    const lesson = lessonBySlug(data, "part-3-front");
    const knitFront = lesson.blocks.find((block) => block.slug === "knit-the-front");
    const neckline = lesson.blocks.find((block) => block.slug === "neckline-shaping");
    expect(isTextVideoLayoutBlock(knitFront!)).toBe(true);
    expect(knitFront?.components?.some((component) => "vimeoId" in component && component.vimeoId === "151859753")).toBe(
      true,
    );

    const necklineVideos = (neckline?.components ?? []).filter((component) => component.type === "video");
    expect(necklineVideos.map((video) => ("vimeoId" in video ? video.vimeoId : ""))).toEqual([
      "151858551",
      "151859107",
    ]);
    expect(new Set(necklineVideos.map((video) => video.legacyComponentId)).size).toBe(2);
    expect(stringifyLesson(lesson)).toContain("393080348");
    expect(stringifyLesson(lesson)).toContain("/images/course-content/64/chart_format.jpg");
    expect(stringifyLesson(lesson)).toContain("/images/course-content/64/watch_these_before_knitting.gif");
  });

  it("converts Part 4 Neckband and Part 5 Sleeves | Finishing without reorganizing duplicated sleeve copy", () => {
    const neckband = stringifyLesson(lessonBySlug(data, "part-4-neckband"));
    expect(neckband).toContain("393138040");
    expect(neckband).toContain("<h3>Sleeves</h3>");
    expect(neckband).toContain("<h3>Finishing</h3>");
    expect(neckband).toContain("/images/course-content/64/on_the_home_stretch.gif");
    expect(neckband).toContain("/images/course-content/64/rolled_hem_seam_800.jpg");

    const sleeves = lessonBySlug(data, "part-5-sleeves-finishing");
    const knitSleeves = sleeves.blocks.find((block) => block.slug === "knit-the-sleeves");
    expect(isTextVideoLayoutBlock(knitSleeves!)).toBe(true);
    const serialized = stringifyLesson(sleeves);
    expect(serialized).toContain("151858940");
    expect(serialized).toContain("393147725");
    expect(serialized).toContain("151858422");
    expect(serialized).toContain("Make those rolled hems beautiful");
    expect(serialized).not.toContain("<h3>Make those rolled hems beautiful<h3>");
    expect(serialized).toContain("/images/course-content/64/seam_good.jpg");
    expect(serialized).not.toContain("/kal_prickly_pear/");
  });

  it("converts What's Next without inventing missing promo artwork", () => {
    const lesson = lessonBySlug(data, "what-s-next");
    const serialized = stringifyLesson(lesson);
    expect(serialized).toContain("/challenge/28/course/fit-once-get-knitting");
    expect(serialized).toContain("/challenge/25/course/big-hug-use-a-hk-pattern-with-your-machine");
    expect(serialized).not.toContain("fit_once.png");
    expect(serialized).not.toContain("big_hug.png");
    expect(serialized).toContain("Subscriber Discount");
  });

  it("keeps Course Contents and next/prev navigation across the full converted course", () => {
    const course = getLegacyCourseBySlug(COURSE_SLUG, { includeDrafts: true });
    expect(course).toBeDefined();

    const intro = getLessonContentNavEntries(lessonBySlug(course!, INTRO_SLUG));
    expect(intro.map((entry) => entry.itemSlug)).toEqual(["join-the-fun", "knitting-overview"]);

    const part1 = getLessonContentNavEntries(lessonBySlug(course!, PART1_SLUG));
    expect(part1.map((entry) => entry.itemSlug)).toEqual(PART1_NAV.map((item) => item.itemSlug));

    const dontSkip = getLessonContentNavEntries(lessonBySlug(course!, "don-t-skip-this"));
    expect(dontSkip.map((entry) => entry.itemSlug)).toEqual([
      "step-1-your-success-depends-on-this",
      "step-2-gauge-swatch-verses-tension-swatch",
      "step-3-knitting-swatches",
      "rolled-hem-study",
      "open-shoulder-video",
    ]);

    const fromPart1 = getCourseContentItemNeighbors(course!, PART1_SLUG, "open-shoulder-for-kids");
    expect(fromPart1.next?.lesson.slug).toBe("don-t-skip-this");
    expect(fromPart1.next?.item.itemSlug).toBe("step-1-your-success-depends-on-this");

    const fromDontSkip = getCourseContentItemNeighbors(course!, "don-t-skip-this", "open-shoulder-video");
    expect(fromDontSkip.next?.lesson.slug).toBe("your-pattern");
    expect(fromDontSkip.next?.item.itemSlug).toBe("build-your-custom-pattern");

    const fromPattern = getCourseContentItemNeighbors(course!, "your-pattern", "build-your-custom-pattern");
    expect(fromPattern.next?.lesson.slug).toBe("part-2-back");
    expect(fromPattern.next?.item.itemSlug).toBe("knit-the-back");

    const fromBack = getCourseContentItemNeighbors(course!, "part-2-back", "watch-as-we-knit-our-back");
    expect(fromBack.next?.lesson.slug).toBe("part-3-front");
    expect(fromBack.next?.item.itemSlug).toBe("knit-the-front");

    const frontNav = getLessonContentNavEntries(lessonBySlug(course!, "part-3-front"));
    expect(frontNav.map((entry) => entry.itemSlug)).toEqual([
      "knit-the-front",
      "neckline-shaping",
      "neckline-shaping--5727",
      "neckline-shaping--5812",
      "watch-as-we-knit-our-front",
    ]);

    const fromFront = getCourseContentItemNeighbors(course!, "part-3-front", "watch-as-we-knit-our-front");
    expect(fromFront.next?.lesson.slug).toBe("part-4-neckband");
    expect(fromFront.next?.item.itemSlug).toBe("neckband");

    const fromNeckband = getCourseContentItemNeighbors(
      course!,
      "part-4-neckband",
      "watch-as-we-knit-the-neckband",
    );
    expect(fromNeckband.next?.lesson.slug).toBe("part-5-sleeves-finishing");
    expect(fromNeckband.next?.item.itemSlug).toBe("knit-the-sleeves");

    const sleeveNav = getLessonContentNavEntries(lessonBySlug(course!, "part-5-sleeves-finishing"));
    expect(sleeveNav.map((entry) => entry.itemSlug)).toEqual([
      "knit-the-sleeves",
      "watch-as-we-knit-our-sleeves",
      "finishing",
      "finishing--5740",
      "finishing--5739",
    ]);

    const fromSleeves = getCourseContentItemNeighbors(course!, "part-5-sleeves-finishing", "finishing--5739");
    expect(fromSleeves.next?.lesson.slug).toBe("what-s-next");
    expect(fromSleeves.next?.item.itemSlug).toBe("continue-the-journey");

    const fromWhatsNext = getCourseContentItemNeighbors(course!, "what-s-next", "continue-the-journey");
    expect(fromWhatsNext.next).toBeNull();

    expect(
      legacyCoursePreviewHref(COURSE_SLUG, "your-pattern", {
        itemSlug: "build-your-custom-pattern",
        includeDraftPreview: true,
      }),
    ).toBe("/courses/legacy/your-2nd-sweater/your-pattern/build-your-custom-pattern?preview=true");
  });
});
