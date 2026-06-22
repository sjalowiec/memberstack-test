import { describe, expect, it } from "vitest";
import {
  buildEditorSearchParams,
  lessonDisplayTitle,
  mergeNavigationAfterSave,
  normalizeLessonTitleInput,
  parseEditorNavigationState,
  resolveInitialLessonSlug,
} from "./courseContentEditorNavigation";

const sampleLessons = [
  { slug: "lesson-one" },
  { slug: "lesson-two" },
  { slug: "lesson-three" },
  { slug: "lesson-four" },
];

describe("courseContentEditorNavigation", () => {
  it("round-trips editor navigation params", () => {
    const query = buildEditorSearchParams({
      courseId: 50,
      lessonSlug: "lesson-four",
      advancedOpen: true,
    });
    expect(parseEditorNavigationState(`?${query}`)).toEqual({
      courseId: 50,
      lessonSlug: "lesson-four",
      lessonIndex: null,
      advancedOpen: true,
    });
  });

  it("keeps lesson 4 selected after save reload simulation", () => {
    const selectedIndex = 3;
    const selectedSlug = resolveInitialLessonSlug(sampleLessons, { lessonIndex: selectedIndex });
    expect(selectedSlug).toBe("lesson-four");

    const afterSave = mergeNavigationAfterSave(
      parseEditorNavigationState("?course=50"),
      selectedSlug!,
      sampleLessons,
    );
    const query = buildEditorSearchParams(afterSave);
    const parsed = parseEditorNavigationState(`?${query}`);
    const restoredSlug = resolveInitialLessonSlug(sampleLessons, parsed);

    expect(restoredSlug).toBe("lesson-four");
  });

  it("falls back to lesson index when slug is missing from URL", () => {
    const parsed = parseEditorNavigationState("?course=50&lessonIndex=3");
    expect(resolveInitialLessonSlug(sampleLessons, parsed)).toBe("lesson-four");
  });
});

describe("lesson title display helpers", () => {
  it("shows Untitled Lesson for empty and internal placeholder titles", () => {
    expect(lessonDisplayTitle("")).toBe("Untitled Lesson");
    expect(lessonDisplayTitle("  ")).toBe("Untitled Lesson");
    expect(lessonDisplayTitle("(untitled assign 3463)")).toBe("Untitled Lesson");
  });

  it("preserves real lesson titles", () => {
    expect(lessonDisplayTitle("New Lesson")).toBe("New Lesson");
    expect(lessonDisplayTitle("  Swatching  ")).toBe("Swatching");
  });

  it("normalizes input for save without storing placeholders", () => {
    expect(normalizeLessonTitleInput("")).toBe("Untitled Lesson");
    expect(normalizeLessonTitleInput("(untitled assign 99)")).toBe("Untitled Lesson");
    expect(normalizeLessonTitleInput("My lesson")).toBe("My lesson");
  });
});
