export type CourseEditorNavigationState = {
  courseId: number | null;
  lessonSlug: string | null;
  lessonIndex: number | null;
  advancedOpen: boolean;
};

export type LessonNavLike = { slug?: string | null };

export function parseEditorNavigationState(
  search: string,
  allowedCourseIds?: number[],
): CourseEditorNavigationState {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const courseRaw = params.get("course") ?? params.get("courseId");
  const parsedCourseId = courseRaw ? Number.parseInt(courseRaw, 10) : Number.NaN;
  const courseAllowed =
    allowedCourseIds == null ||
    allowedCourseIds.length === 0 ||
    allowedCourseIds.includes(parsedCourseId);
  const courseId =
    Number.isFinite(parsedCourseId) && parsedCourseId > 0 && courseAllowed
      ? parsedCourseId
      : null;

  const lessonSlug = params.get("lesson")?.trim() || null;

  const lessonIndexRaw = params.get("lessonIndex");
  const parsedLessonIndex = lessonIndexRaw != null ? Number.parseInt(lessonIndexRaw, 10) : Number.NaN;
  const lessonIndex =
    Number.isFinite(parsedLessonIndex) && parsedLessonIndex >= 0 ? parsedLessonIndex : null;

  const advancedOpen = params.get("advanced") === "1" || params.get("json") === "1";

  return { courseId, lessonSlug, lessonIndex, advancedOpen };
}

export function buildEditorSearchParams(
  state: Partial<CourseEditorNavigationState>,
): string {
  const params = new URLSearchParams();
  if (state.courseId != null) params.set("course", String(state.courseId));
  if (state.lessonSlug) params.set("lesson", state.lessonSlug);
  else if (state.lessonIndex != null) params.set("lessonIndex", String(state.lessonIndex));
  if (state.advancedOpen) params.set("advanced", "1");
  return params.toString();
}

export function resolveInitialLessonSlug(
  lessons: LessonNavLike[],
  preference: { lessonSlug?: string | null; lessonIndex?: number | null } = {},
): string | null {
  if (lessons.length === 0) return null;

  const preferredSlug = preference.lessonSlug?.trim();
  if (preferredSlug && lessons.some((lesson) => lesson.slug === preferredSlug)) {
    return preferredSlug;
  }

  const preferredIndex = preference.lessonIndex;
  if (
    preferredIndex != null &&
    Number.isFinite(preferredIndex) &&
    preferredIndex >= 0 &&
    preferredIndex < lessons.length
  ) {
    return String(lessons[preferredIndex]!.slug ?? "");
  }

  return String(lessons[0]!.slug ?? "");
}

export function lessonIndexFromSlug(
  lessons: LessonNavLike[],
  slug: string | null | undefined,
): number | null {
  if (!slug) return null;
  const index = lessons.findIndex((lesson) => lesson.slug === slug);
  return index >= 0 ? index : null;
}

export function mergeNavigationAfterSave(
  current: CourseEditorNavigationState,
  savedLessonSlug: string,
  lessons: LessonNavLike[],
): CourseEditorNavigationState {
  return {
    ...current,
    lessonSlug: savedLessonSlug,
    lessonIndex: lessonIndexFromSlug(lessons, savedLessonSlug),
  };
}

const INTERNAL_PLACEHOLDER_TITLE_RE = /^\(untitled assign \d+\)$/i;

export function isInternalLessonPlaceholderTitle(title: unknown): boolean {
  if (typeof title !== "string") return false;
  return INTERNAL_PLACEHOLDER_TITLE_RE.test(title.trim());
}

/** Friendly label for sidebar, heading, and delete prompts. */
export function lessonDisplayTitle(title: unknown): string {
  const trimmed = typeof title === "string" ? title.trim() : "";
  if (!trimmed || isInternalLessonPlaceholderTitle(trimmed)) {
    return "Untitled Lesson";
  }
  return trimmed;
}

/** Value for the editable title field (empty when untitled or internal). */
export function lessonTitleForEditing(title: unknown): string {
  const trimmed = typeof title === "string" ? title.trim() : "";
  if (!trimmed || isInternalLessonPlaceholderTitle(trimmed)) {
    return "";
  }
  return trimmed;
}

/** Persistable title from user input — never stores internal placeholders. */
export function normalizeLessonTitleInput(value: string): string {
  const trimmed = value.trim();
  if (!trimmed || isInternalLessonPlaceholderTitle(trimmed)) {
    return "Untitled Lesson";
  }
  return trimmed;
}
