import { lessonDisplayTitle } from "./courseContentEditorNavigation";
import type { ComponentRef } from "./courseContentEditorTypes";
import {
  contentItemDisplayTitle,
  contentItemMatchesRef,
  contentItemNavTitle,
  flattenLessonContent,
  getLessonContentItemsWithSlugs,
  getPublicCourseContentItemSequence,
  getPublicLessonContentItems,
  type CourseContentItemStep,
} from "./courseLessonContentItems";
import type { CoursePreviewData } from "./coursePreviewPoc";

export type EditorSequencePlace = {
  lessonTitle: string;
  sectionTitle: string;
  /** Public title students see for this block. */
  blockTitle: string;
};

export type EditorSequencePosition = {
  index: number;
  total: number;
  place: EditorSequencePlace | null;
  prev: CourseContentItemStep | null;
  next: CourseContentItemStep | null;
};

type SequenceRef = ComponentRef & {
  component?: Record<string, unknown>;
};

function placeForStep(
  course: CoursePreviewData,
  step: CourseContentItemStep,
): EditorSequencePlace {
  const items = getPublicLessonContentItems(course, step.lesson);
  return {
    lessonTitle: lessonDisplayTitle(step.lesson.title),
    sectionTitle: contentItemDisplayTitle(step.lesson, step.item) || "Untitled section",
    blockTitle: contentItemNavTitle(step.lesson, step.item, items) || "Untitled block",
  };
}

function componentTieBreak(component: Record<string, unknown> | undefined): string {
  if (!component) return "";
  const vimeoId = String(component.vimeoId ?? "").trim();
  if (vimeoId) return `vimeo:${vimeoId}`;
  const video = component.video;
  if (video && typeof video === "object" && !Array.isArray(video)) {
    const nested = String((video as Record<string, unknown>).vimeoId ?? "").trim();
    if (nested) return `vimeo:${nested}`;
  }
  return "";
}

function stepOwnsJumpLink(step: CourseContentItemStep, ref: SequenceRef): boolean {
  return (step.item.attachedJumpLinks ?? []).some(
    (jump) => Number(jump.legacyComponentId) === ref.legacyComponentId,
  );
}

function resolveSequenceIndex(
  sequence: CourseContentItemStep[],
  lessonSlug: string,
  ref: SequenceRef,
): number {
  const matches: number[] = [];
  sequence.forEach((step, index) => {
    if (step.lesson.slug !== lessonSlug) return;
    if (contentItemMatchesRef(step.item, ref)) matches.push(index);
  });

  if (matches.length === 1) return matches[0]!;
  if (matches.length > 1) {
    if (ref.component) {
      const sameObject = matches.find(
        (index) => sequence[index]!.item.component === ref.component,
      );
      if (sameObject != null) return sameObject;
      const key = componentTieBreak(ref.component);
      if (key) {
        const sameMedia = matches.find(
          (index) => componentTieBreak(sequence[index]!.item.component) === key,
        );
        if (sameMedia != null) return sameMedia;
      }
    }
    return matches[0]!;
  }

  return sequence.findIndex(
    (step) => step.lesson.slug === lessonSlug && stepOwnsJumpLink(step, ref),
  );
}

function placeForEditorItem(
  course: CoursePreviewData,
  lessonSlug: string,
  ref: SequenceRef,
): EditorSequencePlace | null {
  const lesson = course.lessons.find((entry) => entry.slug === lessonSlug);
  if (!lesson) return null;
  const editorItems = getLessonContentItemsWithSlugs(lesson);
  const match = editorItems.find((item) => contentItemMatchesRef(item, ref));
  const item = match ?? flattenLessonContent(lesson).find((entry) => contentItemMatchesRef(entry, ref));
  if (!item) return null;
  return {
    lessonTitle: lessonDisplayTitle(lesson.title),
    sectionTitle: contentItemDisplayTitle(lesson, item) || "Untitled section",
    blockTitle: contentItemNavTitle(lesson, item, editorItems) || "Untitled block",
  };
}

/**
 * Where the selected editor block sits in the student player's Previous/Next order.
 * Attached jump links stay on their video, the same way the player skips that page.
 */
export function getEditorSequencePosition(
  course: CoursePreviewData,
  lessonSlug: string | null,
  ref: SequenceRef | null,
): EditorSequencePosition {
  const sequence = getPublicCourseContentItemSequence(course);
  const empty: EditorSequencePosition = {
    index: -1,
    total: sequence.length,
    place: null,
    prev: null,
    next: null,
  };
  if (!lessonSlug || !ref) return empty;

  const index = resolveSequenceIndex(sequence, lessonSlug, ref);
  if (index < 0) {
    return {
      ...empty,
      place: placeForEditorItem(course, lessonSlug, ref),
    };
  }

  const current = sequence[index]!;
  return {
    index,
    total: sequence.length,
    place: placeForStep(course, current),
    prev: index > 0 ? sequence[index - 1]! : null,
    next: index < sequence.length - 1 ? sequence[index + 1]! : null,
  };
}

export function editorSequenceStepPlace(
  course: CoursePreviewData,
  step: CourseContentItemStep | null,
): EditorSequencePlace | null {
  if (!step) return null;
  return placeForStep(course, step);
}
