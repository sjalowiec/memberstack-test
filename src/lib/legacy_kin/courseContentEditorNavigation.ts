export type EditorRichTextTab = "visual" | "html" | "preview";

export type CourseEditorNavigationState = {
  courseId: number | null;
  lessonSlug: string | null;
  lessonIndex: number | null;
  advancedOpen: boolean;
  /** Section block slug. Stable across component add/delete inside the section. */
  blockSlug: string | null;
  /** Component id. Stable when other components are added or deleted. */
  legacyComponentId: number | null;
  componentType: string | null;
  /** Flat index at save time. Used only when the component id no longer exists. */
  itemIndex: number | null;
  editorTab: EditorRichTextTab | null;
};

export type EditorSelectableItem = {
  blockSlug: string;
  legacyComponentId: number;
  type: string;
};

export type EditorSelectionQuery = {
  blockSlug?: string | null;
  legacyComponentId?: number | null;
  componentType?: string | null;
  itemIndex?: number | null;
};

const LAYOUT_COMPONENT_TYPES = new Set([
  "textVideoLayout",
  "textImageLayout",
  "threeVideosLayout",
  "twoVideosLayout",
]);

function parseEditorTab(value: string | null): EditorRichTextTab | null {
  if (value === "visual" || value === "html" || value === "preview") return value;
  return null;
}

function parseOptionalIndex(value: string | null): number | null {
  if (value == null || value.trim() === "") return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

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
  const blockSlug = params.get("section")?.trim() || null;
  const legacyComponentId = parseOptionalIndex(params.get("block"));
  const componentType = params.get("type")?.trim() || null;
  const itemIndex = parseOptionalIndex(params.get("index"));
  const editorTab = parseEditorTab(params.get("tab"));

  return {
    courseId,
    lessonSlug,
    lessonIndex,
    advancedOpen,
    blockSlug,
    legacyComponentId,
    componentType,
    itemIndex,
    editorTab,
  };
}

export function buildEditorSearchParams(
  state: Partial<CourseEditorNavigationState>,
): string {
  const params = new URLSearchParams();
  if (state.courseId != null) params.set("course", String(state.courseId));
  if (state.lessonSlug) params.set("lesson", state.lessonSlug);
  else if (state.lessonIndex != null) params.set("lessonIndex", String(state.lessonIndex));
  if (state.blockSlug) params.set("section", state.blockSlug);
  if (state.legacyComponentId != null && Number.isFinite(state.legacyComponentId)) {
    params.set("block", String(state.legacyComponentId));
  }
  if (state.componentType) params.set("type", state.componentType);
  if (state.itemIndex != null && Number.isFinite(state.itemIndex)) {
    params.set("index", String(state.itemIndex));
  }
  if (state.editorTab) params.set("tab", state.editorTab);
  if (state.advancedOpen) params.set("advanced", "1");
  return params.toString();
}

/**
 * Find the block to reopen after save.
 * Component ids stay put when siblings are added or removed.
 * A missing id falls back to the saved index (the nearest remaining block).
 */
export function resolveEditorSelection<T extends EditorSelectableItem>(
  items: readonly T[],
  query: EditorSelectionQuery,
): T | null {
  if (items.length === 0) return null;

  const blockSlug = query.blockSlug?.trim() || null;
  const componentType = query.componentType?.trim() || null;
  const legacyComponentId = query.legacyComponentId;
  const hasId = legacyComponentId != null && Number.isFinite(legacyComponentId);

  if (componentType && LAYOUT_COMPONENT_TYPES.has(componentType) && blockSlug) {
    const layout = items.find((item) => item.blockSlug === blockSlug && item.type === componentType);
    if (layout) return layout;
  }

  if (hasId) {
    const exact = items.find(
      (item) =>
        item.legacyComponentId === legacyComponentId &&
        (!blockSlug || item.blockSlug === blockSlug) &&
        (!componentType || item.type === componentType),
    );
    if (exact) return exact;

    const byId = items.filter((item) => item.legacyComponentId === legacyComponentId);
    const typed = componentType ? byId.filter((item) => item.type === componentType) : byId;
    if (typed.length === 1) return typed[0]!;
  }

  const itemIndex = query.itemIndex;
  if (itemIndex != null && Number.isFinite(itemIndex) && itemIndex >= 0) {
    return items[Math.min(itemIndex, items.length - 1)]!;
  }

  if (blockSlug) {
    return items.find((item) => item.blockSlug === blockSlug) ?? null;
  }

  return null;
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
