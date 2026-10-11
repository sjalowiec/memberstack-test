import { describe, expect, it } from "vitest";
import course33 from "../../data/legacy_kin/cleaned/course_33_beginner_workshop.poc.json";
import { applyLessonUpdate } from "./courseContentAdmin";
import {
  appendComponentToBlock,
  appendStandaloneComponentBlock,
  createRichTextComponent,
  insertComponentIntoBlockRelative,
  insertStandaloneComponentBlockRelative,
  reassignAllContentOrders,
} from "./courseContentEditorBlocks";
import {
  flattenLessonContent,
  getPublicCourseContentItemSequence,
  getPublicLessonContentItems,
} from "./courseLessonContentItems";
import type { CourseLesson, CoursePreviewData } from "./coursePreviewPoc";

const course = course33 as CoursePreviewData;

function cloneLesson(lesson: CourseLesson): CourseLesson {
  return JSON.parse(JSON.stringify(lesson)) as CourseLesson;
}

function sectionOrder(lesson: CourseLesson): string[] {
  return flattenLessonContent(lesson).map((item) => item.blockSlug);
}

function storedComponentIds(lesson: CourseLesson, blockSlug: string): number[] {
  const block = [...lesson.blocks].sort((a, b) => a.order - b.order).find(
    (entry) => entry.slug === blockSlug,
  );
  if (!block) return [];
  return [...block.components]
    .sort((a, b) => a.order - b.order || Number(a.legacySlot ?? 0) - Number(b.legacySlot ?? 0))
    .map((component) => component.legacyComponentId);
}

describe("course content order stability", () => {
  it("keeps section order when a new section is added to an unsorted block list", () => {
    const lesson = cloneLesson(course.lessons[5]!);
    const before = sectionOrder(lesson);
    lesson.blocks = [...lesson.blocks].reverse();

    const created = appendStandaloneComponentBlock(
      lesson as unknown as Record<string, unknown>,
      createRichTextComponent([lesson]),
      88001,
    );

    const after = sectionOrder(lesson);
    expect(after.slice(0, -1)).toEqual(before);
    expect(after.at(-1)).toBe(String(created.slug));
    expect(lesson.displayOrder).toBe(course.lessons[5]!.displayOrder);
  });

  it("inserts a section between two sections and keeps that place after reload", () => {
    const lesson = cloneLesson(course.lessons[5]!);
    lesson.blocks = [...lesson.blocks].reverse();
    const before = [...new Set(sectionOrder(lesson))];
    const anchor = before[0]!;

    const created = insertStandaloneComponentBlockRelative(
      lesson as unknown as Record<string, unknown>,
      createRichTextComponent([lesson]),
      anchor,
      true,
      88002,
    );

    expect([...new Set(sectionOrder(lesson))]).toEqual([
      before[0],
      String(created.slug),
      ...before.slice(1),
    ]);

    const reloaded = JSON.parse(JSON.stringify(lesson)) as CourseLesson;
    reassignAllContentOrders(reloaded);
    expect(sectionOrder(reloaded)).toEqual(sectionOrder(lesson));

    reloaded.blocks = reloaded.blocks.filter((block) => block.slug !== created.slug);
    reassignAllContentOrders(reloaded);
    expect([...new Set(sectionOrder(reloaded))]).toEqual(before);
  });

  it("inserts a block between two blocks and delete leaves the others in place", () => {
    const lesson = cloneLesson(course.lessons.find((entry) => entry.slug === "finishing")!);
    const host = lesson.blocks.find((entry) => entry.slug === "print-the-worksheets")!;
    const first = host.components[0]!;
    const second = createRichTextComponent([lesson]);
    expect(appendComponentToBlock(lesson, host.slug, second)).toBe(true);
    const before = storedComponentIds(lesson, host.slug);
    expect(before).toEqual([first.legacyComponentId, Number(second.legacyComponentId)]);

    host.components = [...host.components].reverse();
    const inserted = createRichTextComponent([lesson]);
    expect(
      insertComponentIntoBlockRelative(
        lesson,
        host.slug,
        inserted,
        first.legacyComponentId,
        first.type,
      ),
    ).toBe(true);

    const withInserted = storedComponentIds(lesson, host.slug);
    expect(withInserted).toEqual([
      first.legacyComponentId,
      Number(inserted.legacyComponentId),
      Number(second.legacyComponentId),
    ]);

    const saved = applyLessonUpdate(
      {
        ...course,
        lessons: course.lessons.map((entry) => (entry.slug === lesson.slug ? lesson : entry)),
      },
      lesson.slug,
      lesson,
    );
    const stored = saved.data.lessons.find((entry) => entry.slug === lesson.slug)!;
    expect(storedComponentIds(stored, host.slug)).toEqual(withInserted);
    expect(stored.displayOrder).toBe(lesson.displayOrder);

    const without = cloneLesson(stored);
    const savedHost = without.blocks.find((entry) => entry.slug === host.slug)!;
    savedHost.components = savedHost.components.filter(
      (entry) => entry.legacyComponentId !== inserted.legacyComponentId,
    );
    reassignAllContentOrders(without);
    expect(storedComponentIds(without, host.slug)).toEqual(before);
    expect(without.blocks.map((entry) => entry.slug)).toEqual(stored.blocks.map((entry) => entry.slug));
  });

  it("appends a block at the end when no anchor is selected", () => {
    const lesson = cloneLesson(
      course.lessons.find((entry) => entry.slug === "project-lets-knit-a-hat")!,
    );
    const target = lesson.blocks[0]!;
    const before = storedComponentIds(lesson, target.slug);
    const component = createRichTextComponent([lesson]);
    expect(appendComponentToBlock(lesson, target.slug, component)).toBe(true);
    expect(storedComponentIds(lesson, target.slug)).toEqual([
      ...before,
      Number(component.legacyComponentId),
    ]);
    expect(lesson.blocks.map((entry) => entry.slug)).toEqual([target.slug]);
  });

  it("does not change Course 33's player sequence when orders are compacted", () => {
    const draft = JSON.parse(JSON.stringify(course)) as CoursePreviewData;
    const before = getPublicCourseContentItemSequence(draft).map(
      (step) =>
        `${step.lesson.slug}|${step.lesson.displayOrder}|${step.item.blockSlug}|${step.item.type}|${step.item.legacyComponentId}`,
    );
    const editorBefore = draft.lessons.map((lesson) =>
      getPublicLessonContentItems(draft, lesson)
        .map((item) => `${item.blockSlug}:${item.legacyComponentId}`)
        .join(","),
    );

    for (const lesson of draft.lessons) reassignAllContentOrders(lesson);

    const after = getPublicCourseContentItemSequence(draft).map(
      (step) =>
        `${step.lesson.slug}|${step.lesson.displayOrder}|${step.item.blockSlug}|${step.item.type}|${step.item.legacyComponentId}`,
    );
    expect(after).toEqual(before);
    expect(draft.lessons.map((lesson) => lesson.displayOrder)).toEqual(
      course.lessons.map((lesson) => lesson.displayOrder),
    );
    expect(draft.lessons.map((lesson) => lesson.title)).toEqual(
      course.lessons.map((lesson) => lesson.title),
    );
    const editorAfter = draft.lessons.map((lesson) =>
      flattenLessonContent(lesson)
        .map((item) => `${item.blockSlug}:${item.legacyComponentId}`)
        .join(","),
    );
    expect(editorAfter).toEqual(editorBefore);

    for (const lesson of draft.lessons) {
      const blockOrders = lesson.blocks.map((block) => block.order);
      expect(new Set(blockOrders).size).toBe(blockOrders.length);
      expect(blockOrders).toEqual(lesson.blocks.map((_, index) => index + 1));
      for (const block of lesson.blocks) {
        const orders = block.components.map((component) => component.order);
        expect(new Set(orders).size).toBe(orders.length);
      }
    }
  });
});
