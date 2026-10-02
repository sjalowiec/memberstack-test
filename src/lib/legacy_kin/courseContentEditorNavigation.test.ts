import { describe, expect, it } from "vitest";
import {
  buildEditorSearchParams,
  lessonDisplayTitle,
  mergeNavigationAfterSave,
  normalizeLessonTitleInput,
  parseEditorNavigationState,
  resolveEditorSelection,
  resolveInitialLessonSlug,
} from "./courseContentEditorNavigation";

const emptyBlockSelection = {
  blockSlug: null,
  legacyComponentId: null,
  componentType: null,
  itemIndex: null,
  editorTab: null,
};

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
      ...emptyBlockSelection,
    });
  });

  it("round-trips the open block and HTML tab", () => {
    const query = buildEditorSearchParams({
      courseId: 50,
      lessonSlug: "cast-on-options",
      blockSlug: "must-know-cast-ons",
      legacyComponentId: 4926,
      componentType: "richText",
      itemIndex: 5,
      editorTab: "html",
      advancedOpen: false,
    });
    expect(parseEditorNavigationState(`?${query}`)).toMatchObject({
      courseId: 50,
      lessonSlug: "cast-on-options",
      blockSlug: "must-know-cast-ons",
      legacyComponentId: 4926,
      componentType: "richText",
      itemIndex: 5,
      editorTab: "html",
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

  it("accepts any catalog course id when allowlist is omitted", () => {
    expect(parseEditorNavigationState("?course=2&lesson=lesson-one").courseId).toBe(2);
  });

  it("rejects course ids not in the provided catalog allowlist", () => {
    expect(parseEditorNavigationState("?course=99&lesson=lesson-one", [50, 51]).courseId).toBeNull();
    expect(parseEditorNavigationState("?course=50&lesson=lesson-one", [50, 51]).courseId).toBe(50);
  });
});

describe("resolveEditorSelection", () => {
  const items = [
    { blockSlug: "intro", legacyComponentId: 1, type: "richText" },
    { blockSlug: "cast-ons", legacyComponentId: 2, type: "video" },
    { blockSlug: "cast-ons", legacyComponentId: 4926, type: "richText" },
    { blockSlug: "practice", legacyComponentId: 4, type: "download" },
  ];

  it("keeps the same component when an earlier block is inserted", () => {
    const withInsert = [
      { blockSlug: "new", legacyComponentId: 9, type: "richText" },
      ...items,
    ];
    expect(
      resolveEditorSelection(withInsert, {
        blockSlug: "cast-ons",
        legacyComponentId: 4926,
        componentType: "richText",
        itemIndex: 2,
      }),
    ).toEqual(withInsert[3]);
  });

  it("selects the nearest remaining item when the saved component was deleted", () => {
    const remaining = items.filter((item) => item.legacyComponentId !== 4926);
    expect(
      resolveEditorSelection(remaining, {
        blockSlug: "cast-ons",
        legacyComponentId: 4926,
        componentType: "richText",
        itemIndex: 2,
      }),
    ).toEqual(remaining[2]);
  });

  it("selects the last remaining item when the deleted component was at the end", () => {
    const remaining = items.slice(0, 3);
    expect(
      resolveEditorSelection(remaining, {
        blockSlug: "practice",
        legacyComponentId: 4,
        componentType: "download",
        itemIndex: 3,
      }),
    ).toEqual(remaining[2]);
  });

  it("keeps a layout block by section id when component ids shift", () => {
    const layouts = [
      { blockSlug: "yarn", legacyComponentId: 10, type: "textVideoLayout" },
      { blockSlug: "gauge", legacyComponentId: 80, type: "textVideoLayout" },
    ];
    expect(
      resolveEditorSelection(layouts, {
        blockSlug: "gauge",
        legacyComponentId: 11,
        componentType: "textVideoLayout",
        itemIndex: 0,
      })?.blockSlug,
    ).toBe("gauge");
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
