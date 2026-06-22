import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { CoursePreviewData, CourseLesson } from "./coursePreviewPoc";
import { isCoursePreviewProductionBlocked } from "./coursePreviewProductionAccess";
import type { DetectSiteEnvironmentOptions } from "../env/siteEnvironment";

export const COURSE_CONTENT_DIR = join(
  process.cwd(),
  "src",
  "data",
  "legacy_kin",
  "cleaned",
);

export const COURSE_CONTENT_BACKUP_DIR = join(COURSE_CONTENT_DIR, "backups");

/** Legacy challenge id → POC filename on disk. */
export const COURSE_CONTENT_FILES: Record<number, string> = {
  50: "course_50_lk150_quick.poc.json",
  51: "course_51_lk150_fun.poc.json",
};

export type HtmlCleanupAction =
  | "emptyParagraphs"
  | "duplicateBreaks"
  | "fontFamily"
  | "legacyNav"
  | "vimeoSpacing"
  | "boxWrappers";

export type RichTextUpdate = {
  lessonSlug: string;
  blockSlug: string;
  legacyComponentId: number;
  html: string;
};

export type ComponentRemoval = {
  lessonSlug: string;
  blockSlug: string;
  legacyComponentId: number;
  type: string;
};

export type CourseContentSavePayload = {
  richTextUpdates?: RichTextUpdate[];
  removals?: ComponentRemoval[];
};

export type SaveRichTextResult = {
  backupPath: string;
  applied: number;
  missing: string[];
};

export type SaveCourseContentResult = {
  backupPath: string;
  appliedRichText: number;
  appliedRemovals: number;
  missingRichText: string[];
  missingRemovals: string[];
};

export type SaveLessonResult = {
  backupPath: string;
  lessonSlug: string;
  removedEmptyBlocks: string[];
};

export function isCourseContentAdminAllowed(
  hostname: string | null | undefined,
  options: DetectSiteEnvironmentOptions = {},
): boolean {
  return !isCoursePreviewProductionBlocked(hostname, options);
}

export function getAllowedCourseIds(): number[] {
  return Object.keys(COURSE_CONTENT_FILES)
    .map(Number)
    .sort((a, b) => a - b);
}

export function isAllowedCourseId(courseId: number): boolean {
  return Object.prototype.hasOwnProperty.call(COURSE_CONTENT_FILES, courseId);
}

export function getCourseContentPath(courseId: number): string {
  const filename = COURSE_CONTENT_FILES[courseId];
  if (!filename) {
    throw new Error(`Unsupported course id ${courseId}.`);
  }
  return join(COURSE_CONTENT_DIR, filename);
}

export function readCourseContentFile(courseId: number): CoursePreviewData {
  const path = getCourseContentPath(courseId);
  if (!existsSync(path)) {
    throw new Error(`Course file not found: ${path}`);
  }
  const raw = readFileSync(path, "utf-8");
  const data = JSON.parse(raw) as CoursePreviewData;
  return data;
}

function backupTimestamp(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return [
    now.getFullYear(),
    pad(now.getMonth() + 1),
    pad(now.getDate()),
    "T",
    pad(now.getHours()),
    pad(now.getMinutes()),
    pad(now.getSeconds()),
  ].join("");
}

export function backupCourseContentFile(courseId: number): string {
  const sourcePath = getCourseContentPath(courseId);
  mkdirSync(COURSE_CONTENT_BACKUP_DIR, { recursive: true });
  const filename = COURSE_CONTENT_FILES[courseId]!;
  const backupName = `${filename}.${backupTimestamp()}.bak.json`;
  const backupPath = join(COURSE_CONTENT_BACKUP_DIR, backupName);
  copyFileSync(sourcePath, backupPath);
  return backupPath;
}

export function applyRichTextUpdates(
  data: CoursePreviewData,
  updates: RichTextUpdate[],
): { applied: number; missing: string[] } {
  const missing: string[] = [];
  let applied = 0;

  for (const update of updates) {
    const key = `${update.lessonSlug}/${update.blockSlug}#${update.legacyComponentId}`;
    const lesson = data.lessons.find((item) => item.slug === update.lessonSlug);
    if (!lesson) {
      missing.push(key);
      continue;
    }

    const block = lesson.blocks.find((item) => item.slug === update.blockSlug);
    if (!block) {
      missing.push(key);
      continue;
    }

    const component = block.components.find(
      (item) =>
        item.type === "richText" &&
        item.legacyComponentId === update.legacyComponentId,
    );

    if (!component || component.type !== "richText") {
      missing.push(key);
      continue;
    }

    component.html = update.html;
    applied++;
  }

  return { applied, missing };
}

export function applyComponentRemovals(
  data: CoursePreviewData,
  removals: ComponentRemoval[],
): { applied: number; missing: string[] } {
  const missing: string[] = [];
  let applied = 0;

  for (const removal of removals) {
    const key = `${removal.lessonSlug}/${removal.blockSlug}#${removal.type}:${removal.legacyComponentId}`;
    const lesson = data.lessons.find((item) => item.slug === removal.lessonSlug);
    if (!lesson) {
      missing.push(key);
      continue;
    }

    const blockIndex = lesson.blocks.findIndex((item) => item.slug === removal.blockSlug);
    if (blockIndex === -1) {
      missing.push(key);
      continue;
    }

    const block = lesson.blocks[blockIndex]!;
    const componentIndex = block.components.findIndex(
      (item) =>
        item.legacyComponentId === removal.legacyComponentId &&
        item.type === removal.type,
    );

    if (componentIndex === -1) {
      missing.push(key);
      continue;
    }

    block.components.splice(componentIndex, 1);
    if (block.components.length === 0) {
      lesson.blocks.splice(blockIndex, 1);
    }
    applied++;
  }

  return { applied, missing };
}

export function validateLessonInput(raw: unknown): CourseLesson | { error: string } {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { error: "Lesson must be a JSON object." };
  }

  const lesson = raw as Record<string, unknown>;

  if (typeof lesson.title !== "string" || !lesson.title.trim()) {
    return { error: "Lesson requires a non-empty title string." };
  }
  if (typeof lesson.slug !== "string" || !lesson.slug.trim()) {
    return { error: "Lesson requires a non-empty slug string." };
  }
  if (!Number.isFinite(Number(lesson.displayOrder))) {
    return { error: "Lesson requires a numeric displayOrder." };
  }
  if (!Array.isArray(lesson.blocks)) {
    return { error: "Lesson blocks must be an array." };
  }

  for (let blockIndex = 0; blockIndex < lesson.blocks.length; blockIndex++) {
    const block = lesson.blocks[blockIndex];
    if (!block || typeof block !== "object" || Array.isArray(block)) {
      return { error: `blocks[${blockIndex}] must be an object.` };
    }

    const blockObj = block as Record<string, unknown>;
    if (typeof blockObj.title !== "string") {
      return { error: `blocks[${blockIndex}] requires a title string.` };
    }
    if (typeof blockObj.slug !== "string" || !blockObj.slug.trim()) {
      return { error: `blocks[${blockIndex}] requires a slug string.` };
    }
    if (!Number.isFinite(Number(blockObj.order))) {
      return { error: `blocks[${blockIndex}] requires a numeric order.` };
    }
    if (!Array.isArray(blockObj.components)) {
      return { error: `blocks[${blockIndex}].components must be an array.` };
    }

    for (let componentIndex = 0; componentIndex < blockObj.components.length; componentIndex++) {
      const component = blockObj.components[componentIndex];
      if (!component || typeof component !== "object" || Array.isArray(component)) {
        return { error: `blocks[${blockIndex}].components[${componentIndex}] must be an object.` };
      }

      const componentObj = component as Record<string, unknown>;
      if (typeof componentObj.type !== "string" || !componentObj.type.trim()) {
        return {
          error: `blocks[${blockIndex}].components[${componentIndex}] requires a type string.`,
        };
      }
      if (!Number.isFinite(Number(componentObj.legacyComponentId))) {
        return {
          error: `blocks[${blockIndex}].components[${componentIndex}] requires legacyComponentId.`,
        };
      }
      if (!Number.isFinite(Number(componentObj.order))) {
        return {
          error: `blocks[${blockIndex}].components[${componentIndex}] requires order.`,
        };
      }
    }
  }

  return lesson as unknown as CourseLesson;
}

export function findEmptyBlockSlugs(lesson: CourseLesson): string[] {
  return lesson.blocks
    .filter((block) => !Array.isArray(block.components) || block.components.length === 0)
    .map((block) => block.slug);
}

export function removeEmptyBlocksFromLesson(lesson: CourseLesson): {
  lesson: CourseLesson;
  removedBlockSlugs: string[];
} {
  const removedBlockSlugs = findEmptyBlockSlugs(lesson);
  const blocks = lesson.blocks.filter(
    (block) => Array.isArray(block.components) && block.components.length > 0,
  );
  return {
    lesson: { ...lesson, blocks },
    removedBlockSlugs,
  };
}

export function saveLessonUpdate(
  courseId: number,
  lessonSlug: string,
  lessonInput: unknown,
  options: { removeEmptyBlocks?: boolean } = {},
): SaveLessonResult {
  const validated = validateLessonInput(lessonInput);
  if ("error" in validated) {
    throw new Error(validated.error);
  }

  const data = readCourseContentFile(courseId);
  const lessonIndex = data.lessons.findIndex((item) => item.slug === lessonSlug);
  if (lessonIndex === -1) {
    throw new Error(`Lesson not found: ${lessonSlug}`);
  }

  let lesson = { ...validated, slug: lessonSlug };
  let removedEmptyBlocks: string[] = [];

  if (options.removeEmptyBlocks) {
    const cleaned = removeEmptyBlocksFromLesson(lesson);
    lesson = cleaned.lesson;
    removedEmptyBlocks = cleaned.removedBlockSlugs;
  }

  data.lessons[lessonIndex] = lesson;
  const backupPath = writeCourseContentFile(courseId, data);

  return {
    backupPath,
    lessonSlug,
    removedEmptyBlocks,
  };
}

export function writeCourseContentFile(
  courseId: number,
  data: CoursePreviewData,
): string {
  const backupPath = backupCourseContentFile(courseId);
  const targetPath = getCourseContentPath(courseId);
  writeFileSync(targetPath, `${JSON.stringify(data, null, 2)}\n`, "utf-8");
  return backupPath;
}

export function saveRichTextUpdates(
  courseId: number,
  updates: RichTextUpdate[],
): SaveRichTextResult {
  const data = readCourseContentFile(courseId);
  const { applied, missing } = applyRichTextUpdates(data, updates);

  if (applied === 0) {
    throw new Error(
      missing.length > 0
        ? `No matching richText blocks found: ${missing.join(", ")}`
        : "No updates to save.",
    );
  }

  const backupPath = writeCourseContentFile(courseId, data);
  return { backupPath, applied, missing };
}

export function saveCourseContentUpdates(
  courseId: number,
  payload: CourseContentSavePayload,
): SaveCourseContentResult {
  const richTextUpdates = payload.richTextUpdates ?? [];
  const removals = payload.removals ?? [];

  if (richTextUpdates.length === 0 && removals.length === 0) {
    throw new Error("No updates to save.");
  }

  const data = readCourseContentFile(courseId);
  const richTextResult = applyRichTextUpdates(data, richTextUpdates);
  const removalResult = applyComponentRemovals(data, removals);
  const appliedRichText = richTextResult.applied;
  const appliedRemovals = removalResult.applied;

  if (appliedRichText === 0 && appliedRemovals === 0) {
    const missingParts = [
      ...richTextResult.missing,
      ...removalResult.missing,
    ];
    throw new Error(
      missingParts.length > 0
        ? `No matching components found: ${missingParts.join(", ")}`
        : "No updates to save.",
    );
  }

  const backupPath = writeCourseContentFile(courseId, data);
  return {
    backupPath,
    appliedRichText,
    appliedRemovals,
    missingRichText: richTextResult.missing,
    missingRemovals: removalResult.missing,
  };
}

export function applyHtmlCleanup(html: string, action: HtmlCleanupAction): string {
  switch (action) {
    case "emptyParagraphs":
      return html.replace(/<p\b[^>]*>(?:\s|&nbsp;|<br\s*\/?>)*<\/p>/gi, "");
    case "duplicateBreaks":
      return html.replace(/(<br\s*\/?>\s*){2,}/gi, "<br>");
    case "fontFamily":
      return html
        .replace(/\s*font-family\s*:\s*[^;}"']+;?/gi, "")
        .replace(/\s*style="\s*"/gi, "")
        .replace(/\s*style=''/gi, "");
    case "legacyNav":
      return html
        .replace(/<a\b[^>]*class="[^"]*\bbtn\b[^"]*"[^>]*>[\s\S]*?<\/a>/gi, "")
        .replace(
          /<div\b[^>]*class="[^"]*\b(?:nav|navigation|pager|pagination)\b[^"]*"[^>]*>[\s\S]*?<\/div>/gi,
          "",
        );
    case "vimeoSpacing":
      return html
        .replace(/\s*(<iframe\b[^>]*(?:vimeo|player\.vimeo)[^>]*><\/iframe>)\s*/gi, "\n$1\n")
        .replace(/(<\/iframe>)\s+(<iframe\b)/gi, "$1\n$2");
    case "boxWrappers":
      return html
        .replace(/<\/?div\b[^>]*class="[^"]*\bboxtop\b[^"]*"[^>]*>/gi, "")
        .replace(/<\/?div\b[^>]*class="[^"]*\bboxbottom\b[^"]*"[^>]*>/gi, "");
    default:
      return html;
  }
}

export const HTML_CLEANUP_ACTIONS: {
  id: HtmlCleanupAction;
  label: string;
}[] = [
  { id: "emptyParagraphs", label: "Remove empty paragraphs" },
  { id: "duplicateBreaks", label: "Remove duplicate line breaks" },
  { id: "fontFamily", label: "Remove inline font-family styles" },
  { id: "legacyNav", label: "Remove old nav/button remnants" },
  { id: "vimeoSpacing", label: "Normalize Vimeo iframe spacing" },
  { id: "boxWrappers", label: "Remove boxtop/boxbottom wrappers" },
];
