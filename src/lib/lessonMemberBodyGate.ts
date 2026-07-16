/** Marker attributes for the deferred member-lesson body mount pattern. */
export const LESSON_MEMBER_BODY_TEMPLATE_ATTR = "data-lesson-member-body-template";
export const LESSON_MEMBER_BODY_MOUNT_ATTR = "data-lesson-member-body-mount";
export const LESSON_MEMBER_BODY_ROOT_ATTR = "data-lesson-member-body";

type LessonBlock = {
  type?: string;
  title?: string;
  content?: string;
};

type LessonLike = {
  slug?: string;
  blocks?: LessonBlock[];
};

/** Section labels and headings used to regression-test gated lesson content. */
export function lessonProtectedSectionLabels(lesson: LessonLike): string[] {
  const labels: string[] = [];
  const blocks = Array.isArray(lesson.blocks) ? lesson.blocks : [];
  for (const block of blocks) {
    if (block.type === "vimeo" && typeof block.title === "string" && block.title.trim()) {
      labels.push(block.title.trim());
    }
    if (block.type === "text" && typeof block.content === "string") {
      const h3 = block.content.match(/<h3[^>]*>([^<]+)<\/h3>/i);
      if (h3?.[1]?.trim()) labels.push(h3[1].trim());
    }
  }
  return labels;
}

/** True when protected lesson media should stay out of the active DOM until access is granted. */
export function lessonBodyUsesDeferredTemplate(requiresMemberAccess: boolean): boolean {
  return requiresMemberAccess;
}
