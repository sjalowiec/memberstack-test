import { describe, expect, it } from "vitest";
import course51 from "../../data/legacy_kin/cleaned/course_51_lk150_fun.poc.json";
import type { CoursePreviewData } from "./coursePreviewPoc";
import {
  editorSequenceStepPlace,
  getEditorSequencePosition,
} from "./courseContentEditorSequence";
import {
  getPublicCourseContentItemNeighbors,
  getPublicCourseContentItemSequence,
  getPublicLessonContentNavEntries,
  groupLessonContentNavEntries,
} from "./courseLessonContentItems";

const course = course51 as CoursePreviewData;

describe("course content editor sequence", () => {
  const sequence = getPublicCourseContentItemSequence(course);

  it("follows the student player through Course 51, including lesson boundaries", () => {
    expect(sequence.length).toBeGreaterThan(1);
    expect(sequence[0]!.lesson.slug).toBe("introduction");

    for (const step of sequence) {
      const position = getEditorSequencePosition(course, step.lesson.slug, step.item);
      const neighbors = getPublicCourseContentItemNeighbors(
        course,
        step.lesson.slug,
        step.item.itemSlug,
      );
      expect(position.prev?.lesson.slug ?? null).toBe(neighbors.prev?.lesson.slug ?? null);
      expect(position.prev?.item.itemSlug ?? null).toBe(neighbors.prev?.item.itemSlug ?? null);
      expect(position.next?.lesson.slug ?? null).toBe(neighbors.next?.lesson.slug ?? null);
      expect(position.next?.item.itemSlug ?? null).toBe(neighbors.next?.item.itemSlug ?? null);
    }

    const first = getEditorSequencePosition(course, sequence[0]!.lesson.slug, sequence[0]!.item);
    expect(first.prev).toBeNull();
    expect(first.place).toEqual({
      lessonTitle: "Introduction",
      sectionTitle: "Your Next Steps on your Journey to Master your LK-150",
      blockTitle: "Your Next Steps on your Journey to Master your LK-150",
    });

    const intro = sequence.filter((step) => step.lesson.slug === "introduction");
    expect(intro.length).toBeGreaterThan(1);
    const lastIntro = getEditorSequencePosition(
      course,
      intro[intro.length - 1]!.lesson.slug,
      intro[intro.length - 1]!.item,
    );
    expect(lastIntro.next).not.toBeNull();
    expect(lastIntro.next!.lesson.slug).not.toBe("introduction");
    expect(editorSequenceStepPlace(course, lastIntro.next)?.lessonTitle).not.toBe("Introduction");

    const last = getEditorSequencePosition(
      course,
      sequence[sequence.length - 1]!.lesson.slug,
      sequence[sequence.length - 1]!.item,
    );
    expect(last.next).toBeNull();
    expect(last.prev).not.toBeNull();
  });

  it("steps through every block of a Course 51 section that has several blocks", () => {
    const multi = course.lessons
      .map((lesson) => ({
        lesson,
        group: groupLessonContentNavEntries(getPublicLessonContentNavEntries(course, lesson)).find(
          (entry) => entry.entries.length > 1,
        ),
      }))
      .find((entry) => entry.group);

    expect(multi?.group).toBeTruthy();
    const group = multi!.group!;
    const steps = sequence.filter(
      (step) => step.lesson.slug === multi!.lesson.slug && step.item.blockSlug === group.blockSlug,
    );
    expect(steps.map((step) => step.item.itemSlug)).toEqual(group.entries.map((entry) => entry.itemSlug));
    expect(new Set(group.entries.map((entry) => entry.title)).size).toBe(group.entries.length);

    for (let index = 0; index < steps.length; index += 1) {
      const position = getEditorSequencePosition(course, steps[index]!.lesson.slug, steps[index]!.item);
      expect(position.place?.lessonTitle).toBe(multi!.lesson.title);
      expect(position.place?.sectionTitle).toBe(group.sectionTitle);
      expect(position.place?.blockTitle).toBe(group.entries[index]!.title);
      if (index < steps.length - 1) {
        expect(position.next?.item.itemSlug).toBe(steps[index + 1]!.item.itemSlug);
        expect(position.next?.lesson.slug).toBe(multi!.lesson.slug);
      }
    }

    const afterSection = getEditorSequencePosition(
      course,
      steps[steps.length - 1]!.lesson.slug,
      steps[steps.length - 1]!.item,
    );
    expect(afterSection.next?.item.blockSlug).not.toBe(group.blockSlug);
  });
});
