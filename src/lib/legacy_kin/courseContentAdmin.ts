import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { CoursePreviewData } from "./coursePreviewPoc";
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

export type SaveRichTextResult = {
  backupPath: string;
  applied: number;
  missing: string[];
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
