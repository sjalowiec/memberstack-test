import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { readCourseContentFile } from "./courseContentAdmin";
import { validateLessonForPublicRenderer } from "./courseLessonPublicRenderer";
import {
  createIdAllocator,
  maxAssignIdFromLessons,
  maxLegacyComponentIdFromLessons,
} from "./courseContentSplitIds";
import { BROKEN_DECORATIVE_SEAMS_IMG_SPLIT } from "./courseContentSplitFixtures";
import {
  formatCourseSplitReport,
  HAND_CLEANED_COURSE_IDS,
  runCourseContentSplit,
} from "./courseContentSplit";
import type { CoursePreviewData } from "./coursePreviewPoc";
import { splitLessonBlocks } from "./splitImportedLessonHtml";

const BACKUP_PATH = join(
  process.cwd(),
  "src/data/legacy_kin/cleaned/backups/course_2_not_enough_needles.poc.json.20260625T131532.bak.json",
);

function loadCourse2Backup(): CoursePreviewData {
  return JSON.parse(readFileSync(BACKUP_PATH, "utf-8")) as CoursePreviewData;
}

describe("courseContentSplit", () => {
  it("restored course 2 lessons pass editor and public renderer validation", () => {
    const course = readCourseContentFile(2);
    for (const slug of ["easy-solutions", "decorative-seams"]) {
      const lesson = course.lessons.find((item) => item.slug === slug);
      expect(lesson, slug).toBeTruthy();
      const validation = validateLessonForPublicRenderer(lesson!);
      expect(
        validation.passed,
        validation.issues.map((issue) => issue.message).join("; "),
      ).toBe(true);
      expect(validation.rendererPassed).toBe(true);
      expect(validation.editorItemCount).toBeGreaterThan(0);
    }
  });

  it("detects render-breaking img-split fragment on Decorative Seams", () => {
    const validation = validateLessonForPublicRenderer(BROKEN_DECORATIVE_SEAMS_IMG_SPLIT);
    expect(validation.passed).toBe(false);
    expect(validation.rendererPassed).toBe(false);
    expect(
      validation.issues.some((issue) =>
        issue.message.includes("orphaned closing markup"),
      ),
    ).toBe(true);
  });

  it("does not split blocklisted decorative-seams lesson", async () => {
    const report = await runCourseContentSplit({
      courseId: 2,
      lessonSlug: "decorative-seams",
      dryRun: true,
      force: true,
    });

    expect(report.lessons[0]?.changed).toBe(false);
    expect(report.lessons[0]?.skippedReason).toMatch(/blocklisted/i);
    expect(report.lessons[0]?.validation?.passed).toBe(true);
    expect(formatCourseSplitReport(report)).toContain("Validation:");
  });

  it("simulated split of easy-solutions passes public renderer validation", () => {
    const course = loadCourse2Backup();
    const lesson = course.lessons.find((item) => item.slug === "easy-solutions")!;
    const split = splitLessonBlocks(lesson, {
      nextLegacyComponentId: createIdAllocator(maxLegacyComponentIdFromLessons(course.lessons)),
      nextAssignId: createIdAllocator(maxAssignIdFromLessons(course.lessons)),
      force: true,
    }).lesson;
    const validation = validateLessonForPublicRenderer(split);
    expect(validation.passed, validation.issues.map((issue) => issue.message).join("; ")).toBe(
      true,
    );
  });

  it("blocklisted decorative-seams simulation leaves lesson unchanged", () => {
    const course = loadCourse2Backup();
    const lesson = course.lessons.find((item) => item.slug === "decorative-seams")!;
    const split = splitLessonBlocks(lesson, {
      nextLegacyComponentId: createIdAllocator(maxLegacyComponentIdFromLessons(course.lessons)),
      nextAssignId: createIdAllocator(maxAssignIdFromLessons(course.lessons)),
      force: true,
    }).lesson;
    expect(split.blocks.length).toBe(lesson.blocks.length);
    expect(split.blocks.map((block) => block.slug)).toEqual(
      lesson.blocks.map((block) => block.slug),
    );
  });

  it("skips hand-cleaned courses by default", async () => {
    for (const courseId of HAND_CLEANED_COURSE_IDS) {
      await expect(
        runCourseContentSplit({
          courseId,
          dryRun: true,
        }),
      ).rejects.toThrow(/hand-cleaned/i);
    }
  });
});
