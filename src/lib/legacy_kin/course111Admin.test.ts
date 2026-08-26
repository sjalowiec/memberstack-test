import { basename } from "node:path";
import { describe, expect, it } from "vitest";
import {
  addCourse111Block,
  cloneCourse111Data,
  COURSE_111_ID,
  COURSE_111_POC_FILENAME,
  course111IsDraft,
  course111LessonPreviewHref,
  course111SaveStatusMessage,
  deleteCourse111Block,
  deleteCourse111Component,
  describeCourse111Component,
  filterCourse111Lessons,
  filterCourse111OriginalLessons,
  findCourse111Lesson,
  findCourse111OriginalLesson,
  findCourse111OriginalLessonByAssignId,
  getCourse111ContentPath,
  listCourse111EditorItemsForAssign,
  listCourse111LessonComponents,
  listCourse111LessonSummaries,
  listCourse111OriginalLessons,
  loadCourse111,
  moveCourse111Block,
  patchCourse111Component,
  preserveCourse111Publication,
  readCourse111Publication,
  resolveCourse111SelectedLessonPreview,
  runCourse111SaveAndPreview,
  summarizeCourse111Block,
  updateCourse111LessonTitle,
} from "./course111Admin";
import type { CourseComponent, CoursePreviewData } from "./coursePreviewPoc";

function sampleWithUnknownFields(): CoursePreviewData {
  return {
    course: {
      legacyChallengeId: COURSE_111_ID,
      title: "Sample 111",
      slug: "sample-111",
      status: "draft",
      published: false,
      contentStatus: "in_progress",
      legacy: { sourceExport: "sample.json" },
      // @ts-expect-error intentional unknown course field
      mysteryCourseField: "keep-me",
    },
    lessons: [
      {
        title: "Lesson A",
        slug: "lesson-a",
        displayOrder: 1,
        legacy: { itemId: 1, lessonOrder: 1 },
        blocks: [
          {
            title: "Text block",
            slug: "text-block",
            order: 1,
            legacy: { assignId: 10, blockType: "HTML" },
            components: [
              {
                type: "richText",
                html: "<p>Hello</p>",
                legacyComponentId: 100,
                order: 1,
                // @ts-expect-error intentional unknown component field
                customMarker: "preserve-rt",
              },
            ],
          },
          {
            title: "Pending block",
            slug: "pending-block",
            order: 2,
            legacy: { assignId: 11, blockType: "Unknown" },
            components: [
              {
                type: "migrationPending",
                legacyType: "Flash",
                notes: ["needs review"],
                legacyFields: { foo: "bar" },
                legacyComponentId: 101,
                order: 1,
                // @ts-expect-error intentional unknown component field
                oddExtra: { nested: true },
              } as CourseComponent,
            ],
          },
          {
            title: "Video block",
            slug: "video-block",
            order: 3,
            legacy: { assignId: 12, blockType: "Video" },
            components: [
              {
                type: "video",
                vimeoId: "111",
                title: "Clip",
                legacyComponentId: 102,
                order: 1,
              },
            ],
          },
        ],
      },
    ],
    manifest: {
      videoCount: 1,
      // @ts-expect-error intentional unknown manifest field
      leftover: "yes",
    },
  };
}

describe("course111Admin load", () => {
  it("loads Course 111 cleaned poc and stays draft", () => {
    const data = loadCourse111();
    expect(data.course.legacyChallengeId).toBe(COURSE_111_ID);
    expect(data.course.title).toContain("Silver Reed SK840");
    expect(course111IsDraft(data)).toBe(true);
    expect(basename(getCourse111ContentPath())).toBe(COURSE_111_POC_FILENAME);
    expect(listCourse111LessonSummaries(data).length).toBeGreaterThan(0);
  });

  it("builds draft preview URLs for the selected original lesson assignId", () => {
    const data = loadCourse111();
    const originals = listCourse111OriginalLessons(data);
    const first = originals[0]!;
    const second = originals[1] ?? first;

    const firstHref = course111LessonPreviewHref(data, first.assignId);
    expect(firstHref).toBe(`/courses/111/lesson/${first.assignId}?preview=true`);
    expect(firstHref).not.toContain("courses.knititnow.com");
    expect(firstHref).not.toContain("/courses/legacy/");

    const resolved = resolveCourse111SelectedLessonPreview(
      data,
      second.parentSlug,
      second.blockSlug,
    );
    expect(resolved).toEqual({
      lessonSlug: second.parentSlug,
      blockSlug: second.blockSlug,
      assignId: second.assignId,
      previewHref: `/courses/111/lesson/${second.assignId}?preview=true`,
    });
  });

  it("Save & Preview saves the selected lesson before opening its assignId preview URL", async () => {
    const data = loadCourse111();
    const selected = listCourse111OriginalLessons(data)[2] ?? listCourse111OriginalLessons(data)[0]!;
    const calls: string[] = [];

    const result = await runCourse111SaveAndPreview({
      data,
      selectedLessonSlug: selected.parentSlug,
      selectedBlockSlug: selected.blockSlug,
      saveLesson: async (lessonSlug) => {
        calls.push(`save:${lessonSlug}`);
      },
      openPreview: (href) => {
        calls.push(`open:${href}`);
      },
    });

    expect(result.lessonSlug).toBe(selected.parentSlug);
    expect(result.assignId).toBe(selected.assignId);
    expect(result.previewHref).toBe(
      `/courses/111/lesson/${selected.assignId}?preview=true`,
    );
    expect(calls).toEqual([
      `save:${selected.parentSlug}`,
      `open:/courses/111/lesson/${selected.assignId}?preview=true`,
    ]);
    expect(result.previewOpened).toBe(true);
  });

  it("opens preview immediately after a live blob persist", async () => {
    const data = loadCourse111();
    const selected = listCourse111OriginalLessons(data)[0]!;
    const calls: string[] = [];

    const result = await runCourse111SaveAndPreview({
      data,
      selectedLessonSlug: selected.parentSlug,
      selectedBlockSlug: selected.blockSlug,
      saveLesson: async (lessonSlug) => {
        calls.push(`save:${lessonSlug}`);
        return { persistedVia: "blob" };
      },
      openPreview: (href) => {
        calls.push(`open:${href}`);
      },
    });

    expect(result.previewOpened).toBe(true);
    expect(result.persistedVia).toBe("blob");
    expect(calls).toEqual([
      `save:${selected.parentSlug}`,
      `open:/courses/111/lesson/${selected.assignId}?preview=true`,
    ]);
  });

  it("does not open preview after a GitHub persist on kin-dev", async () => {
    const data = loadCourse111();
    const selected = listCourse111OriginalLessons(data)[0]!;
    const calls: string[] = [];

    const result = await runCourse111SaveAndPreview({
      data,
      selectedLessonSlug: selected.parentSlug,
      selectedBlockSlug: selected.blockSlug,
      saveLesson: async (lessonSlug) => {
        calls.push(`save:${lessonSlug}`);
        return { persistedVia: "github" };
      },
      openPreview: (href) => {
        calls.push(`open:${href}`);
      },
    });

    expect(result.previewOpened).toBe(false);
    expect(result.persistedVia).toBe("github");
    expect(calls).toEqual([`save:${selected.parentSlug}`]);
  });

  it("explains live overlay saves versus GitHub deploy delay", () => {
    expect(
      course111SaveStatusMessage({
        persistedVia: "blob",
        lessonTitle: "Your manuals",
        previewOpened: true,
      }),
    ).toBe(
      "Saved “Your manuals” to live DEV preview. Course remains draft/unpublished.",
    );
    expect(
      course111SaveStatusMessage({
        persistedVia: "github",
        lessonTitle: "Learn About the Machine",
      }),
    ).toMatch(/after the site finishes deploying/);
    expect(
      course111SaveStatusMessage({
        persistedVia: "github",
        lessonTitle: "Learn About the Machine",
        previewOpened: false,
      }),
    ).toMatch(/last deployed lesson/);
  });
});

describe("course111Admin edit / order / preserve", () => {
  it("filters lessons by search query", () => {
    const lessons = listCourse111LessonSummaries(sampleWithUnknownFields());
    expect(filterCourse111Lessons(lessons, "lesson a")).toHaveLength(1);
    expect(filterCourse111Lessons(lessons, "nope")).toHaveLength(0);
  });

  it("updates title and editable fields without dropping unknown keys", () => {
    const data = cloneCourse111Data(sampleWithUnknownFields());
    const lesson = findCourse111Lesson(data, "lesson-a")!;
    updateCourse111LessonTitle(lesson, "  Lesson A renamed  ");
    expect(lesson.title).toBe("Lesson A renamed");

    expect(
      patchCourse111Component(lesson, "text-block", 100, {
        html: "<p>Updated</p>",
      }),
    ).toBe(true);

    const richText = lesson.blocks[0]!.components[0] as CourseComponent & {
      customMarker?: string;
    };
    expect(richText.type).toBe("richText");
    expect(richText.html).toBe("<p>Updated</p>");
    expect(richText.customMarker).toBe("preserve-rt");

    const pending = lesson.blocks[1]!.components[0] as CourseComponent & {
      oddExtra?: { nested: boolean };
    };
    expect(pending.type).toBe("migrationPending");
    expect(pending.oddExtra).toEqual({ nested: true });
    expect(
      (data.course as CoursePreviewData["course"] & { mysteryCourseField?: string })
        .mysteryCourseField,
    ).toBe("keep-me");
  });

  it("reorders blocks with move up / move down", () => {
    const data = cloneCourse111Data(sampleWithUnknownFields());
    const lesson = findCourse111Lesson(data, "lesson-a")!;
    expect(lesson.blocks.map((block) => block.slug)).toEqual([
      "text-block",
      "pending-block",
      "video-block",
    ]);

    expect(moveCourse111Block(lesson, 2, -1)).toBe(true);
    expect(lesson.blocks.map((block) => block.slug)).toEqual([
      "text-block",
      "video-block",
      "pending-block",
    ]);
    expect(lesson.blocks.map((block) => block.order)).toEqual([1, 2, 3]);

    expect(moveCourse111Block(lesson, 0, -1)).toBe(false);
  });

  it("adds editable blocks and deletes with structure intact", () => {
    const data = cloneCourse111Data(sampleWithUnknownFields());
    const lesson = findCourse111Lesson(data, "lesson-a")!;
    const added = addCourse111Block(lesson, "download", data.lessons, 12345);
    expect(added.slug).toContain("content-");
    expect(added.components[0]?.type).toBe("download");
    expect(lesson.blocks).toHaveLength(4);

    expect(deleteCourse111Block(lesson, added.slug)).toBe(true);
    expect(lesson.blocks).toHaveLength(3);
    expect(lesson.blocks.map((block) => block.order)).toEqual([1, 2, 3]);
  });

  it("round-trips JSON while preserving unknowns and publication", () => {
    const original = sampleWithUnknownFields();
    const publication = readCourse111Publication(original.course);
    const working = cloneCourse111Data(original);
    const lesson = findCourse111Lesson(working, "lesson-a")!;

    patchCourse111Component(lesson, "video-block", 102, {
      vimeoId: "999999",
      title: "Renamed clip",
    });
    moveCourse111Block(lesson, 0, 1);
    addCourse111Block(lesson, "image", working.lessons, 99);

    const roundTripped = JSON.parse(JSON.stringify(working)) as CoursePreviewData;
    preserveCourse111Publication(roundTripped, publication);

    expect(readCourse111Publication(roundTripped.course)).toEqual(publication);
    expect(roundTripped.course.status).toBe("draft");
    expect(roundTripped.course.published).toBe(false);
    expect(
      (roundTripped.course as CoursePreviewData["course"] & { mysteryCourseField?: string })
        .mysteryCourseField,
    ).toBe("keep-me");
    expect(roundTripped.manifest).toMatchObject({ leftover: "yes" });

    const pending = findCourse111Lesson(roundTripped, "lesson-a")!.blocks.find(
      (block) => block.slug === "pending-block",
    )!.components[0] as CourseComponent & { oddExtra?: { nested: boolean } };
    expect(pending.type).toBe("migrationPending");
    expect(pending.oddExtra).toEqual({ nested: true });
    expect(pending.legacyFields).toEqual({ foo: "bar" });

    const video = findCourse111Lesson(roundTripped, "lesson-a")!.blocks.find(
      (block) => block.slug === "video-block",
    )!.components[0]!;
    expect(video).toMatchObject({ type: "video", vimeoId: "999999", title: "Renamed clip" });
  });

  it("marks unsupported blocks as preserved and blocks delete while allowing move", () => {
    const data = cloneCourse111Data(sampleWithUnknownFields());
    const lesson = findCourse111Lesson(data, "lesson-a")!;
    const editable = summarizeCourse111Block(lesson.blocks[0]!);
    const preserved = summarizeCourse111Block(lesson.blocks[1]!);

    expect(editable.editable).toBe(true);
    expect(editable.canDelete).toBe(true);
    expect(editable.canMove).toBe(true);

    expect(preserved.preservedOnly).toBe(true);
    expect(preserved.canDelete).toBe(false);
    expect(preserved.canMove).toBe(true);
    expect(deleteCourse111Block(lesson, "pending-block")).toBe(false);
    expect(lesson.blocks.some((block) => block.slug === "pending-block")).toBe(true);
    expect(moveCourse111Block(lesson, 1, -1)).toBe(true);
    expect(lesson.blocks.map((block) => block.slug)[0]).toBe("pending-block");
  });
});

describe("course111Admin original lesson components", () => {
  it("loads all components for lesson 6104 in display order", () => {
    const data = loadCourse111();
    const summary = findCourse111OriginalLessonByAssignId(data, 6104);
    expect(summary).toMatchObject({
      assignId: 6104,
      blockSlug: "about-automatic-patterning-on-this-machine",
      parentSlug: "automatic-stitch-patterning",
    });

    const items = listCourse111EditorItemsForAssign(data, 6104);
    expect(items).toHaveLength(2);
    expect(items.map((item) => item.legacyComponentId)).toEqual([9332, 9348]);
    expect(items.map((item) => item.order)).toEqual([1, 2]);
    expect(items.map((item) => item.type)).toEqual(["richText", "richText"]);
    expect(items[1]?.identity).toMatch(/LearnDesignaKnit/i);
    expect(items[1]?.imageSrcs).toContain(
      "https://learndesignaknit.com/img/Learn_DesignAKnit.jpg",
    );
  });

  it("preserves component order when listing Watson editor items", () => {
    const data = loadCourse111();
    const items = listCourse111EditorItemsForAssign(data, 6124);
    expect(items.map((item) => item.type)).toEqual(["richText", "video"]);
    expect(items.map((item) => item.legacyComponentId)).toEqual([9373, 9372]);
    expect(items[0]?.order).toBeLessThan(items[1]?.order ?? 0);
  });

  it("edits an existing component without touching siblings", () => {
    const data = cloneCourse111Data(loadCourse111());
    const summary = findCourse111OriginalLessonByAssignId(data, 6104)!;
    const found = findCourse111OriginalLesson(
      data,
      summary.parentSlug,
      summary.blockSlug,
    )!;

    expect(
      patchCourse111Component(found.parent, found.block.slug, 9332, {
        html: "<p>Updated lesson copy</p>",
      }),
    ).toBe(true);

    const components = listCourse111LessonComponents(found.block);
    expect(components[0]?.identity).toBe("Updated lesson copy");
    expect(components[1]?.legacyComponentId).toBe(9348);
    expect(components[1]?.identity).toMatch(/LearnDesignaKnit/i);
    const promo = found.block.components.find(
      (component) => component.legacyComponentId === 9348,
    ) as { html?: string };
    expect(promo.html).toContain("https://learndesignaknit.com/img/Learn_DesignAKnit.jpg");
  });

  it("deletes a component and leaves the rest of the lesson intact", () => {
    const data = cloneCourse111Data(loadCourse111());
    const summary = findCourse111OriginalLessonByAssignId(data, 6104)!;
    const found = findCourse111OriginalLesson(
      data,
      summary.parentSlug,
      summary.blockSlug,
    )!;

    expect(deleteCourse111Component(found.parent, found.block.slug, 1)).toBe(true);
    const remaining = listCourse111LessonComponents(found.block);
    expect(remaining.map((item) => item.legacyComponentId)).toEqual([9332]);
    expect(remaining[0]?.order).toBe(1);
    expect(found.block.components).toHaveLength(1);
  });

  it("represents every component type in a mixed lesson for Watson", () => {
    const data = cloneCourse111Data(sampleWithUnknownFields());
    const lesson = findCourse111Lesson(data, "lesson-a")!;
    const types = listCourse111OriginalLessons(data).flatMap((entry) =>
      entry.componentTypes,
    );
    expect(types).toEqual(["richText", "migrationPending", "video"]);

    const views = lesson.blocks.flatMap((block) =>
      listCourse111LessonComponents(block),
    );
    expect(views.map((item) => item.typeLabel)).toEqual([
      "Rich text / HTML",
      "Pending / unmapped",
      "Video (Vimeo)",
    ]);
    expect(views.every((item) => item.canDelete)).toBe(true);
    expect(describeCourse111Component(lesson.blocks[1]!.components[0]!).identity).toMatch(
      /Flash/,
    );

    const live = loadCourse111();
    const represented = new Set(
      listCourse111OriginalLessons(live).flatMap((entry) => entry.componentTypes),
    );
    expect(represented.has("richText")).toBe(true);
    expect(represented.has("video")).toBe(true);
    expect(represented.has("imageCarousel")).toBe(true);
    expect(represented.has("exerciseAccordion")).toBe(true);
    expect(represented.has("imageGallery")).toBe(true);
    expect(represented.has("migrationPending")).toBe(true);

    expect(filterCourse111OriginalLessons(listCourse111OriginalLessons(live), "6104")).toEqual(
      [findCourse111OriginalLessonByAssignId(live, 6104)],
    );
  });
});
