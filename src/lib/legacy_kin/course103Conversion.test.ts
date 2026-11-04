import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import course103 from "../../data/legacy_kin/cleaned/course_103_ultimate_brother_930_940_workshop.poc.json";
import { kinCourseLessonHref } from "../kinCourse/hrefs";
import type { CoursePreviewData } from "./coursePreviewPoc";
import { validateLessonForPublicRenderer } from "./courseLessonPublicRenderer";
import { getLegacyCourseBySlug, getLegacyCourses } from "./legacyCourseLoader";
import { isLegacyCourseDraft, isLegacyCoursePublic } from "./legacyCoursePublication";

const data = course103 as CoursePreviewData;
const SLUG = "ultimate-brother-930-940-workshop";

const LESSON_TITLES = [
  "Learn About the Machine",
  "Get Knitting",
  "Your turn: Get started",
  "Automatic Stitch Patterning",
  "Knitting in Pattern",
  "Tuck Stitch",
  "Slip Stitch",
  "Knit Weave",
  "Fairisle",
  "Thread (Punch) Lace",
  "Plaiting",
  "Intarsia",
  "Lace",
  "930/940 and DesignaKnit",
  "Your Ribber",
  "Using Your Ribber",
  "Double Bed Jacquard",
  "Accessories",
] as const;

describe("Course 103 Brother 930/940 review", () => {
  it("stays an unpublished draft and out of the public catalog", () => {
    expect(data.course.legacyChallengeId).toBe(103);
    expect(data.course.title).toBe("Ultimate Brother 930/940 Workshop");
    expect(data.course.slug).toBe(SLUG);
    expect(data.course.status).toBe("draft");
    expect(data.course.published).toBe(false);
    expect(data.course.active).toBe(false);
    expect(data.course.contentStatus).toBe("in_progress");
    expect(data.course.legacy.contentRevision).toBe(1);
    expect(isLegacyCourseDraft(data.course)).toBe(true);
    expect(isLegacyCoursePublic(data.course)).toBe(false);
    expect(getLegacyCourses().map((course) => course.slug)).not.toContain(SLUG);
    expect(getLegacyCourseBySlug(SLUG)).toBeUndefined();
    expect(getLegacyCourseBySlug(SLUG, { includeDrafts: true })?.lessons).toHaveLength(18);
  });

  it("keeps the exported lesson order and opens the Watson preview for the first lesson", () => {
    expect(data.lessons.map((lesson) => lesson.title)).toEqual([...LESSON_TITLES]);
    expect(data.lessons.map((lesson) => lesson.displayOrder)).toEqual(
      Array.from({ length: 18 }, (_, index) => index + 1),
    );
    const firstAssignId = data.lessons[0]?.blocks[0]?.legacy.assignId;
    expect(firstAssignId).toBe(5745);
    expect(kinCourseLessonHref(103, firstAssignId, true)).toBe(
      "/courses/103/lesson/5745?preview=true",
    );
  });

  it("renders every lesson and keeps hotspot diagrams and chapter lists", () => {
    const ids = new Set<number>();
    for (const lesson of data.lessons) {
      const rendered = validateLessonForPublicRenderer(lesson);
      expect(rendered.rendererPassed, lesson.slug).toBe(true);
      for (const block of lesson.blocks) {
        for (const component of block.components) {
          expect(ids.has(component.legacyComponentId), `${lesson.slug} ${component.legacyComponentId}`).toBe(
            false,
          );
          ids.add(component.legacyComponentId);
        }
      }
    }

    const components = data.lessons.flatMap((lesson) =>
      lesson.blocks.flatMap((block) => block.components),
    );
    expect(components.some((component) => component.type === "vimeoJumpLinks")).toBe(true);
    expect(
      components.some(
        (component) =>
          component.type === "migrationPending" &&
          "legacyType" in component &&
          component.legacyType === "Hotspot",
      ),
    ).toBe(true);
    const serialized = JSON.stringify(data);
    expect(serialized).not.toContain("videopopup");
    expect(serialized).not.toContain("/challenge/images/");
    expect(serialized).toContain("Full vs Half pitch");
    expect(serialized).toContain("About End Needle Selection");
    expect(serialized).toContain("Fun with Flat Ribs");
  });

  it("points recovered images at files on disk and lists the ones still missing", () => {
    const review = (
      data.course.legacy as {
        draftReview?: { recoveredImages: string[]; missingFiles: string[] };
      }
    ).draftReview;
    expect(review).toBeTruthy();
    if (!review) return;
    expect(review.recoveredImages.length).toBeGreaterThan(0);
    expect(review.missingFiles).toContain("/tools/technique_card_gif1.gif");
    for (const src of review.recoveredImages) {
      const file = decodeURIComponent(src.replace(/^\//, ""));
      expect(existsSync(join(process.cwd(), "public", file)), src).toBe(true);
    }
    for (const src of review.missingFiles) {
      expect(existsSync(join(process.cwd(), "public", src.replace(/^\//, ""))), src).toBe(false);
    }
    expect(existsSync(join(process.cwd(), "public/images/courses/940_course_thumb.webp"))).toBe(true);
  });
});
