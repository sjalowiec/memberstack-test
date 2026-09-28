import { describe, expect, it } from "vitest";
import course2 from "../../data/legacy_kin/cleaned/course_2_not_enough_needles.poc.json";
import course11 from "../../data/legacy_kin/cleaned/course_11_baby_pinafores.poc.json";
import course51 from "../../data/legacy_kin/cleaned/course_51_lk150_fun.poc.json";
import type { CourseBlock, CourseLesson } from "./coursePreviewPoc";
import { slidesWithImageSource, sortedComponents } from "./coursePreviewPoc";
import { validateLessonForEditor } from "./courseContentEditorSchema";
import { validateComponentForPublicRenderer, validateLessonForPublicRenderer } from "./courseLessonPublicRenderer";
import { isEmptyThirdVideoPlaceholder } from "./courseThreeVideosLayout";

function findLesson(course: { lessons: CourseLesson[] }, slug: string): CourseLesson {
  const lesson = course.lessons.find((item) => item.slug === slug);
  if (!lesson) throw new Error(`Lesson not found: ${slug}`);
  return lesson;
}

function findBlock(lesson: CourseLesson, slug: string): CourseBlock {
  const block = lesson.blocks.find((item) => item.slug === slug);
  if (!block) throw new Error(`Block not found: ${slug}`);
  return block;
}

describe("shared preview fixes", () => {
  it("keeps stored order when component order and slot tie", () => {
    const lesson = findLesson(course51, "increasing-and-decreasing");
    const block = findBlock(lesson, "three-videos-1782248522306");
    const orderedIds = sortedComponents(block).map((component) => component.legacyComponentId);
    expect(orderedIds).toEqual([9683, 9684, 9685, 9686, 9687, 9688, 9689, 9690]);
  });

  it("does not flag an empty third video slot", () => {
    const lesson = findLesson(course2, "introduction");
    const editor = validateLessonForEditor(lesson);
    const preview = validateLessonForPublicRenderer(lesson);
    expect(editor.issues.some((issue) => issue.legacyComponentId === 6159)).toBe(false);
    expect(preview.issues.some((issue) => issue.legacyComponentId === 6159)).toBe(false);
    expect(isEmptyThirdVideoPlaceholder({
      type: "video",
      layoutRole: "threeVideosVideo3",
      vimeoId: "",
    })).toBe(true);
  });

  it("still flags a video that is missing its Vimeo id outside the third slot", () => {
    const issues = validateComponentForPublicRenderer(
      {
        type: "video",
        vimeoId: "",
        title: null,
        legacyComponentId: 9,
        order: 1,
      },
      { lessonSlug: "lesson", blockSlug: "section" },
    );
    expect(issues.some((issue) => issue.field === "vimeoId")).toBe(true);
  });

  it("skips gallery slides that have no image source", () => {
    const lesson = findLesson(course11, "a-line-start-to-finish");
    const preview = validateLessonForPublicRenderer(lesson);
    expect(preview.issues.some((issue) => /slide requires src/i.test(issue.message))).toBe(false);
    expect(slidesWithImageSource([
      { src: "" },
      { src: "  " },
      { src: "/images/course-content/11/front.jpg" },
    ])).toEqual([{ src: "/images/course-content/11/front.jpg" }]);
  });
});
