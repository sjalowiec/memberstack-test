import { kinCourseLessonHref } from "../kinCourse/hrefs";
import {
  appendStandaloneComponentBlock,
  createRichTextComponent,
  moveSectionAtIndex,
  nextLegacyComponentId,
} from "./courseContentEditorBlocks";
import type {
  CourseBlock,
  CourseComponent,
  CourseLesson,
  CoursePreviewData,
  DownloadComponent,
  ImageComponent,
  RichTextComponent,
  VideoComponent,
} from "./coursePreviewPoc";
import { sortedBlocks, sortedComponents } from "./coursePreviewPoc";
import {
  isLegacyCourseDraft,
  type LegacyCoursePublicationFields,
} from "./legacyCoursePublication";

export const COURSE_111_ID = 111;

export const COURSE_111_POC_FILENAME =
  "course_111_mastering_the_silver_reed_sk840_a_comprehensive_course.poc.json";

export const COURSE_111_EDITABLE_TYPES = [
  "richText",
  "video",
  "image",
  "download",
] as const;

export type Course111EditableType = (typeof COURSE_111_EDITABLE_TYPES)[number];

export type Course111PublicationSnapshot = {
  status?: string;
  published?: boolean;
  active?: boolean;
  contentStatus?: string;
  legacyChallengeId: number;
};

export type Course111LessonSummary = {
  index: number;
  title: string;
  slug: string;
  displayOrder: number;
  blockCount: number;
  published: boolean;
  statusLabel: string;
};

/** One original KIN lesson (assign / block), not a course section. */
export type Course111OriginalLessonSummary = {
  index: number;
  parentSlug: string;
  parentTitle: string;
  blockSlug: string;
  assignId: number;
  title: string;
  componentCount: number;
  componentTypes: string[];
  published: boolean;
  statusLabel: string;
};

export type Course111ComponentView = {
  index: number;
  type: string;
  typeLabel: string;
  legacyComponentId: number;
  order: number;
  identity: string;
  imageSrcs: string[];
  editable: boolean;
  canDelete: boolean;
};

export const COURSE_111_COMPONENT_TYPE_LABELS: Record<string, string> = {
  richText: "Rich text / HTML",
  video: "Video (Vimeo)",
  image: "Image",
  download: "Download / file",
  imageCarousel: "Image carousel",
  imageGallery: "Image gallery",
  exerciseAccordion: "Exercise / accordion",
  embeddedTool: "Embedded tool",
  migrationPending: "Pending / unmapped",
};

export type Course111ComponentPatch = {
  html?: string;
  vimeoId?: string;
  title?: string | null;
  src?: string;
  alt?: string;
  caption?: string | null;
  label?: string;
  filename?: string;
  showInline?: boolean;
};

export function isCourse111EditableType(
  type: string,
): type is Course111EditableType {
  return (COURSE_111_EDITABLE_TYPES as readonly string[]).includes(type);
}

export function cloneCourse111Data(data: CoursePreviewData): CoursePreviewData {
  return structuredClone(data);
}

export function readCourse111Publication(
  course: CoursePreviewData["course"],
): Course111PublicationSnapshot {
  return {
    status: course.status,
    published: course.published,
    active: course.active,
    contentStatus: course.contentStatus,
    legacyChallengeId: course.legacyChallengeId,
  };
}

/** Ensure save paths never flip Course 111 out of draft/unpublished by accident. */
export function preserveCourse111Publication(
  data: CoursePreviewData,
  snapshot: Course111PublicationSnapshot,
): void {
  if (snapshot.status !== undefined) data.course.status = snapshot.status;
  else delete data.course.status;

  if (snapshot.published !== undefined) data.course.published = snapshot.published;
  else delete data.course.published;

  if (snapshot.active !== undefined) data.course.active = snapshot.active;
  else delete data.course.active;

  if (snapshot.contentStatus !== undefined) {
    data.course.contentStatus = snapshot.contentStatus as
      | "in_progress"
      | "cleaned";
  } else {
    delete data.course.contentStatus;
  }

  data.course.legacyChallengeId = snapshot.legacyChallengeId;
}

export function listCourse111LessonSummaries(
  data: CoursePreviewData,
): Course111LessonSummary[] {
  return [...data.lessons]
    .sort((a, b) => a.displayOrder - b.displayOrder)
    .map((lesson, index) => {
      const published = lesson.published !== false;
      return {
        index,
        title: lesson.title,
        slug: lesson.slug,
        displayOrder: lesson.displayOrder,
        blockCount: Array.isArray(lesson.blocks) ? lesson.blocks.length : 0,
        published,
        statusLabel: published ? "Visible" : "Unpublished",
      };
    });
}

export function filterCourse111Lessons(
  lessons: Course111LessonSummary[],
  query: string,
): Course111LessonSummary[] {
  const q = query.trim().toLowerCase();
  if (!q) return lessons;
  return lessons.filter((lesson) => {
    const haystack =
      `${lesson.index + 1} ${lesson.title} ${lesson.slug} ${lesson.statusLabel}`.toLowerCase();
    return haystack.includes(q);
  });
}

export function listCourse111OriginalLessons(
  data: CoursePreviewData,
): Course111OriginalLessonSummary[] {
  const parents = [...data.lessons].sort((a, b) => a.displayOrder - b.displayOrder);
  const out: Course111OriginalLessonSummary[] = [];
  for (const parent of parents) {
    const published = parent.published !== false;
    for (const block of sortedBlocks(parent)) {
      const types = sortedComponents(block).map((component) => component.type);
      out.push({
        index: out.length,
        parentSlug: parent.slug,
        parentTitle: parent.title,
        blockSlug: block.slug,
        assignId: Number(block.legacy?.assignId) || 0,
        title: block.title?.trim() || block.slug,
        componentCount: types.length,
        componentTypes: types,
        published,
        statusLabel: published ? "Visible" : "Unpublished",
      });
    }
  }
  return out;
}

export function filterCourse111OriginalLessons(
  lessons: Course111OriginalLessonSummary[],
  query: string,
): Course111OriginalLessonSummary[] {
  const q = query.trim().toLowerCase();
  if (!q) return lessons;
  return lessons.filter((lesson) => {
    const haystack = [
      lesson.assignId,
      lesson.index + 1,
      lesson.title,
      lesson.blockSlug,
      lesson.parentTitle,
      lesson.parentSlug,
      lesson.statusLabel,
      lesson.componentTypes.join(" "),
    ]
      .join(" ")
      .toLowerCase();
    return haystack.includes(q);
  });
}

export function findCourse111Lesson(
  data: CoursePreviewData,
  lessonSlug: string,
): CourseLesson | undefined {
  return data.lessons.find((lesson) => lesson.slug === lessonSlug);
}

export function findCourse111OriginalLesson(
  data: CoursePreviewData,
  parentSlug: string,
  blockSlug: string,
): { parent: CourseLesson; block: CourseBlock } | undefined {
  const parent = findCourse111Lesson(data, parentSlug);
  const block = parent?.blocks.find((entry) => entry.slug === blockSlug);
  if (!parent || !block) return undefined;
  return { parent, block };
}

export function findCourse111OriginalLessonByAssignId(
  data: CoursePreviewData,
  assignId: number,
): Course111OriginalLessonSummary | undefined {
  return listCourse111OriginalLessons(data).find(
    (lesson) => lesson.assignId === Number(assignId),
  );
}

/** Learner-facing draft preview URL for a KIN assignId lesson. */
export function course111LessonPreviewHref(
  data: CoursePreviewData,
  assignId: number,
): string | null {
  const courseId = Number(data.course.legacyChallengeId);
  const id = Number(assignId);
  if (!Number.isFinite(courseId) || courseId <= 0 || !Number.isFinite(id) || id <= 0) {
    return null;
  }
  return kinCourseLessonHref(courseId, id, true);
}

/**
 * Resolve the learner preview URL for a specific original KIN lesson (block).
 * Returns null when the lesson is missing from the course.
 */
export function resolveCourse111SelectedLessonPreview(
  data: CoursePreviewData,
  selectedParentSlug: string,
  selectedBlockSlug: string,
): { lessonSlug: string; blockSlug: string; assignId: number; previewHref: string } | null {
  const original = findCourse111OriginalLesson(
    data,
    selectedParentSlug,
    selectedBlockSlug,
  );
  if (!original) return null;
  const assignId = Number(original.block.legacy?.assignId) || 0;
  const previewHref = course111LessonPreviewHref(data, assignId);
  if (!previewHref) return null;
  return {
    lessonSlug: original.parent.slug,
    blockSlug: original.block.slug,
    assignId,
    previewHref,
  };
}

/**
 * Save & Preview plan: always save the selected parent lesson first, then open
 * the assignId player URL. Testable without DOM.
 */
export async function runCourse111SaveAndPreview(options: {
  data: CoursePreviewData;
  selectedLessonSlug: string;
  selectedBlockSlug: string;
  saveLesson: (
    lessonSlug: string,
  ) => Promise<{ persistedVia?: "filesystem" | "blob" | "github" } | void>;
  openPreview: (href: string) => void;
}): Promise<{
  lessonSlug: string;
  blockSlug: string;
  assignId: number;
  previewHref: string;
  previewOpened: boolean;
  persistedVia?: "filesystem" | "blob" | "github";
}> {
  const resolved = resolveCourse111SelectedLessonPreview(
    options.data,
    options.selectedLessonSlug,
    options.selectedBlockSlug,
  );
  if (!resolved) {
    throw new Error("Select a lesson before Save & Preview.");
  }

  const saveResult = (await options.saveLesson(resolved.lessonSlug)) ?? {};
  const persistedVia = saveResult.persistedVia;
  const previewOpened = persistedVia !== "github";
  if (previewOpened) options.openPreview(resolved.previewHref);
  return { ...resolved, previewOpened, persistedVia };
}

export function course111SaveStatusMessage(options: {
  persistedVia?: "filesystem" | "blob" | "github";
  lessonTitle: string;
  previewOpened?: boolean;
}): string {
  if (options.persistedVia === "github") {
    if (options.previewOpened === false) {
      return "Saved to GitHub. Preview still shows the last deployed lesson until the site finishes deploying.";
    }
    return "Saved to GitHub. The updated lesson will appear after the site finishes deploying.";
  }
  if (options.persistedVia === "blob") {
    return `Saved “${options.lessonTitle}” to live DEV preview. Course remains draft/unpublished.`;
  }
  if (options.previewOpened) {
    return `Saved “${options.lessonTitle}” and opened learner preview. Course remains draft/unpublished.`;
  }
  return `Saved lesson “${options.lessonTitle}”. Course remains draft/unpublished.`;
}

export function course111IsDraft(data: CoursePreviewData): boolean {
  return isLegacyCourseDraft(data.course as LegacyCoursePublicationFields);
}

export function createCourse111Component(
  type: Course111EditableType,
  lessons: CourseLesson[],
): CourseComponent {
  const legacyComponentId = nextLegacyComponentId(
    lessons as unknown as Record<string, unknown>[],
  );

  switch (type) {
    case "richText":
      return createRichTextComponent(
        lessons as unknown as Record<string, unknown>[],
      ) as RichTextComponent;
    case "video":
      return {
        type: "video",
        vimeoId: "",
        title: null,
        legacyComponentId,
        order: 1,
      } satisfies VideoComponent;
    case "image":
      return {
        type: "image",
        src: "",
        alt: "",
        caption: null,
        legacyComponentId,
        order: 1,
      } satisfies ImageComponent;
    case "download":
      return {
        type: "download",
        label: "Download",
        filename: "",
        legacyComponentId,
        order: 1,
      } satisfies DownloadComponent;
  }
}

export function addCourse111Block(
  lesson: CourseLesson,
  type: Course111EditableType,
  allLessons: CourseLesson[],
  timestamp = Date.now(),
): CourseBlock {
  const component = createCourse111Component(type, allLessons);
  const block = appendStandaloneComponentBlock(
    lesson as unknown as Record<string, unknown>,
    component as unknown as Record<string, unknown>,
    timestamp,
  ) as unknown as CourseBlock;

  block.title =
    type === "richText"
      ? "Text"
      : type === "video"
        ? "Video"
        : type === "image"
          ? "Image"
          : "Download";
  block.legacy = {
    ...block.legacy,
    blockType:
      type === "video" ? "Video" : type === "download" ? "Download" : "HTML",
  };
  return block;
}

export function moveCourse111Block(
  lesson: CourseLesson,
  blockIndex: number,
  delta: -1 | 1,
): boolean {
  return moveSectionAtIndex(
    lesson as unknown as Record<string, unknown>,
    blockIndex,
    delta,
  );
}

export function deleteCourse111Block(
  lesson: CourseLesson,
  blockSlug: string,
): boolean {
  const block = lesson.blocks.find((entry) => entry.slug === blockSlug);
  if (!block) return false;
  if (!summarizeCourse111Block(block).canDelete) return false;

  const index = lesson.blocks.findIndex((entry) => entry.slug === blockSlug);
  if (index === -1) return false;
  lesson.blocks.splice(index, 1);
  const ordered = sortedBlocks(lesson);
  ordered.forEach((entry, orderIndex) => {
    entry.order = orderIndex + 1;
  });
  lesson.blocks = ordered;
  return true;
}

export function updateCourse111LessonTitle(
  lesson: CourseLesson,
  title: string,
): void {
  lesson.title = title.trim() || lesson.title;
}

export function updateCourse111BlockTitle(block: CourseBlock, title: string): void {
  block.title = title.trim() || block.title;
}

export function addCourse111ComponentToBlock(
  lesson: CourseLesson,
  blockSlug: string,
  type: Course111EditableType,
  allLessons: CourseLesson[],
): CourseComponent | null {
  const block = lesson.blocks.find((entry) => entry.slug === blockSlug);
  if (!block) return null;
  const component = createCourse111Component(type, allLessons);
  const maxOrder = block.components.reduce(
    (max, entry) => Math.max(max, Number(entry.order) || 0),
    0,
  );
  component.order = maxOrder + 1;
  block.components.push(component);
  return component;
}

export function deleteCourse111Component(
  lesson: CourseLesson,
  blockSlug: string,
  componentIndex: number,
): boolean {
  const block = lesson.blocks.find((entry) => entry.slug === blockSlug);
  if (!block) return false;
  const ordered = sortedComponents(block);
  const target = ordered[componentIndex];
  if (!target) return false;
  const actualIndex = block.components.indexOf(target);
  if (actualIndex === -1) return false;
  block.components.splice(actualIndex, 1);
  sortedComponents(block).forEach((entry, orderIndex) => {
    entry.order = orderIndex + 1;
  });
  return true;
}

function stripMarkup(value: string): string {
  return value
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function extractCourse111ImageSrcs(value: string): string[] {
  const srcs: string[] = [];
  const re = /<img\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(value))) {
    const src = match[1]?.trim();
    if (src) srcs.push(src);
  }
  return srcs;
}

export function describeCourse111Component(
  component: CourseComponent,
): Omit<Course111ComponentView, "index"> {
  const type = String(component.type || "");
  const typeLabel = COURSE_111_COMPONENT_TYPE_LABELS[type] || type || "Unknown";
  const imageSrcs: string[] = [];
  let identity = "";

  if (component.type === "richText") {
    identity = stripMarkup(component.html || "") || "(empty HTML)";
    imageSrcs.push(...extractCourse111ImageSrcs(component.html || ""));
  } else if (component.type === "video") {
    identity = [component.vimeoId && `Vimeo ${component.vimeoId}`, component.title]
      .filter(Boolean)
      .join(" · ") || "(no Vimeo ID)";
  } else if (component.type === "image") {
    identity = [component.src, component.alt, component.caption]
      .filter(Boolean)
      .join(" · ") || "(no image source)";
    if (component.src) imageSrcs.push(component.src);
  } else if (component.type === "download") {
    identity = [component.label, component.filename].filter(Boolean).join(" · ") ||
      "(no file)";
  } else if (component.type === "imageCarousel" || component.type === "imageGallery") {
    const slides = Array.isArray(component.slides) ? component.slides : [];
    identity = `${slides.length} slide${slides.length === 1 ? "" : "s"}`;
    for (const slide of slides) {
      if (slide?.src) imageSrcs.push(slide.src);
    }
  } else if (component.type === "exerciseAccordion") {
    const sections = Array.isArray(component.sections) ? component.sections : [];
    identity =
      sections
        .map((section) => stripMarkup(section.title || ""))
        .filter(Boolean)
        .join(" · ") || `${sections.length} section(s)`;
  } else if (component.type === "embeddedTool") {
    identity = component.toolKey || "(no tool key)";
  } else if (component.type === "migrationPending") {
    identity = [component.legacyType, ...(component.notes || [])]
      .filter(Boolean)
      .join(" · ") || "Pending migration";
  } else {
    identity = `Unsupported type ${type}`;
  }

  if (identity.length > 220) identity = `${identity.slice(0, 217)}…`;

  return {
    type,
    typeLabel,
    legacyComponentId: Number(component.legacyComponentId) || 0,
    order: Number(component.order) || 0,
    identity,
    imageSrcs,
    editable: isCourse111EditableType(type),
    canDelete: true,
  };
}

export function listCourse111LessonComponents(
  block: CourseBlock,
): Course111ComponentView[] {
  return sortedComponents(block).map((component, index) => ({
    index,
    ...describeCourse111Component(component),
  }));
}

export function listCourse111EditorItemsForAssign(
  data: CoursePreviewData,
  assignId: number,
): Course111ComponentView[] {
  const summary = findCourse111OriginalLessonByAssignId(data, assignId);
  if (!summary) return [];
  const found = findCourse111OriginalLesson(
    data,
    summary.parentSlug,
    summary.blockSlug,
  );
  if (!found) return [];
  return listCourse111LessonComponents(found.block);
}

/**
 * Patch only known editable fields on a matching component.
 * Unknown component keys and non-matching components are left untouched.
 */
export function patchCourse111Component(
  lesson: CourseLesson,
  blockSlug: string,
  legacyComponentId: number,
  patch: Course111ComponentPatch,
): boolean {
  const block = lesson.blocks.find((entry) => entry.slug === blockSlug);
  if (!block) return false;

  const component = block.components.find(
    (entry) => entry.legacyComponentId === legacyComponentId,
  );
  if (!component || !isCourse111EditableType(component.type)) return false;

  if (component.type === "richText") {
    if ("html" in patch && typeof patch.html === "string") {
      component.html = patch.html;
    }
    return true;
  }

  if (component.type === "video") {
    if ("vimeoId" in patch && typeof patch.vimeoId === "string") {
      component.vimeoId = patch.vimeoId.trim();
    }
    if ("title" in patch) {
      component.title =
        patch.title == null || String(patch.title).trim() === ""
          ? null
          : String(patch.title).trim();
    }
    return true;
  }

  if (component.type === "image") {
    if ("src" in patch && typeof patch.src === "string") {
      component.src = patch.src.trim();
    }
    if ("alt" in patch && typeof patch.alt === "string") {
      component.alt = patch.alt;
    }
    if ("caption" in patch) {
      component.caption =
        patch.caption == null || String(patch.caption).trim() === ""
          ? null
          : String(patch.caption);
    }
    return true;
  }

  if (component.type === "download") {
    if ("label" in patch && typeof patch.label === "string") {
      component.label = patch.label.trim() || component.label;
    }
    if ("filename" in patch && typeof patch.filename === "string") {
      component.filename = patch.filename.trim();
    }
    if ("showInline" in patch && typeof patch.showInline === "boolean") {
      component.showInline = patch.showInline;
    }
    return true;
  }

  return false;
}

export function summarizeCourse111Block(block: CourseBlock): {
  title: string;
  slug: string;
  types: string[];
  editable: boolean;
  preservedOnly: boolean;
  /** False when the block includes unsupported/preserved components. */
  canDelete: boolean;
  canMove: boolean;
} {
  const types = sortedComponents(block).map((component) => component.type);
  const editable =
    types.length > 0 && types.every((type) => isCourse111EditableType(type));
  const preservedOnly =
    types.length > 0 && types.every((type) => !isCourse111EditableType(type));
  const hasPreservedComponent = types.some(
    (type) => !isCourse111EditableType(type),
  );
  return {
    title: block.title?.trim() || block.slug,
    slug: block.slug,
    types,
    editable,
    preservedOnly,
    canDelete: !hasPreservedComponent,
    canMove: true,
  };
}
