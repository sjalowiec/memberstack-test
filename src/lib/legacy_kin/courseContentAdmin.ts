import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { CoursePreviewData, CourseLesson, CourseContentStatus } from "./coursePreviewPoc";
import { isCoursePreviewProductionBlocked } from "./coursePreviewProductionAccess";
import type { DetectSiteEnvironmentOptions } from "../env/siteEnvironment";
import {
  resolveCourseContentPersistMode,
  type CourseContentPersistResult,
  type CourseContentWriteOptions,
} from "./courseContentPersist";
import {
  asPrivateDraft,
  createPrivateCourseDocument,
  editorCourseDocument,
  emptyCourseEditorialState,
  markCourseDraftPreviewed,
  publishPreviewedCourseDraft,
  saveCourseDraft,
  type CourseEditorialState,
} from "./courseEditorial";
import { readCourseContentOverlay } from "./courseContentLiveStore";
import {
  listEditorialBlobIds,
  listEditorialFileIds,
  readEditorialBlob,
  readEditorialFile,
  writeEditorialBlob,
  writeEditorialFile,
} from "./courseEditorialStore";
import {
  isLegacyCourseActive,
  isLegacyCourseDraft,
  isLegacyCoursePublic,
  readLegacyCoursePublished,
  type LegacyCoursePublicationFields,
} from "./legacyCoursePublication";

export type { CourseContentPersistResult, CourseContentWriteOptions } from "./courseContentPersist";

export const COURSE_CONTENT_DIR = join(
  process.cwd(),
  "src",
  "data",
  "legacy_kin",
  "cleaned",
);

export const COURSE_CONTENT_BACKUP_DIR = join(COURSE_CONTENT_DIR, "backups");

/** @deprecated Use discoverAdminCourseCatalog() — kept for tests referencing known filenames. */
export const COURSE_CONTENT_FILES: Record<number, string> = {
  50: "course_50_lk150_quick.poc.json",
  51: "course_51_lk150_fun.poc.json",
};

export type AdminCourseSummary = {
  id: number;
  title: string;
  slug: string;
  filename: string;
  lessonCount: number;
  status?: string;
  published?: boolean;
  active?: boolean;
  isDraft: boolean;
  isPublic: boolean;
  isActive: boolean;
  contentStatus: CourseContentStatus;
};

type DiscoveredCourseFile = {
  id: number;
  filename: string;
  title: string;
  slug: string;
  lessonCount: number;
  status?: string;
  published?: boolean;
  active?: boolean;
  contentStatus?: CourseContentStatus;
};

function readDiscoveredCourseFile(filename: string): DiscoveredCourseFile | null {
  const path = join(COURSE_CONTENT_DIR, filename);
  if (!existsSync(path)) return null;

  try {
    const raw = readFileSync(path, "utf-8");
    const data = JSON.parse(raw) as CoursePreviewData;
    const id = Number(data?.course?.legacyChallengeId);
    if (!Number.isFinite(id)) return null;
    const course = data.course as LegacyCoursePublicationFields & {
      title?: string;
      slug?: string;
      active?: boolean;
    };
    return {
      id,
      filename,
      title: String(course.title ?? `Course ${id}`),
      slug: String(course.slug ?? ""),
      lessonCount: Array.isArray(data.lessons) ? data.lessons.length : 0,
      status: course.status,
      published: course.published,
      active: course.active,
      contentStatus: course.contentStatus,
    };
  } catch {
    return null;
  }
}

function cleanedPocFilenames(): string[] {
  if (!existsSync(COURSE_CONTENT_DIR)) return [];
  return readdirSync(COURSE_CONTENT_DIR)
    .filter((name) => name.endsWith(".poc.json"))
    .sort();
}

/** Scan cleaned/ for course-poc JSON files keyed by legacyChallengeId. */
export function discoverAdminCourseCatalog(): DiscoveredCourseFile[] {
  const byId = new Map<number, DiscoveredCourseFile>();
  for (const filename of cleanedPocFilenames()) {
    const entry = readDiscoveredCourseFile(filename);
    if (!entry) continue;
    byId.set(entry.id, entry);
  }
  return [...byId.values()].sort((a, b) => a.id - b.id);
}

function getDiscoveredCourseFile(courseId: number): DiscoveredCourseFile {
  const entry = discoverAdminCourseCatalog().find((item) => item.id === courseId);
  if (!entry) {
    throw new Error(`Unsupported course id ${courseId}.`);
  }
  return entry;
}

export function listAdminCourseSummaries(): AdminCourseSummary[] {
  return discoverAdminCourseCatalog()
    .map((entry) => ({
      id: entry.id,
      title: entry.title,
      slug: entry.slug,
      filename: entry.filename,
      lessonCount: entry.lessonCount,
      status: entry.status,
      published: entry.published,
      active: entry.active,
      isDraft: isLegacyCourseDraft(entry),
      isPublic: isLegacyCoursePublic(entry),
      isActive: isLegacyCourseActive(entry),
      contentStatus: readCourseContentStatus({ contentStatus: entry.contentStatus }),
    }))
    .sort(
      (a, b) =>
        a.title.localeCompare(b.title, undefined, { sensitivity: "base" }) ||
        a.id - b.id,
    );
}

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

export type SaveRichTextResult = CourseContentPersistResult & {
  applied: number;
  missing: string[];
};

export type SaveCourseContentResult = CourseContentPersistResult & {
  appliedRichText: number;
  appliedRemovals: number;
  missingRichText: string[];
  missingRemovals: string[];
};

export type SaveLessonResult = CourseContentPersistResult & {
  lessonSlug: string;
  removedEmptyBlocks: string[];
  storedLesson: CoursePreviewData["lessons"][number];
};

export type CourseMetadataUpdate = {
  thumbnail?: string | null;
  /** Short blurb for /courses catalog cards and course landing pages. */
  description?: string | null;
  active?: boolean;
  published?: boolean;
  contentStatus?: CourseContentStatus;
};

export type SaveCourseMetadataResult = CourseContentPersistResult & {
  thumbnail: string | null;
  description: string | null;
  active: boolean;
  published: boolean;
  contentStatus: CourseContentStatus;
  course: CoursePreviewData;
};

export function isCourseContentAdminAllowed(
  hostname: string | null | undefined,
  options: DetectSiteEnvironmentOptions = {},
): boolean {
  return !isCoursePreviewProductionBlocked(hostname, options);
}

export function getAllowedCourseIds(): number[] {
  return discoverAdminCourseCatalog().map((entry) => entry.id);
}

export function isAllowedCourseId(courseId: number): boolean {
  return discoverAdminCourseCatalog().some((entry) => entry.id === courseId);
}

export function getCourseContentPath(courseId: number): string {
  const entry = getDiscoveredCourseFile(courseId);
  return join(COURSE_CONTENT_DIR, entry.filename);
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

export async function readCourseEditorialState(
  courseId: number,
  options: CourseContentWriteOptions = {},
): Promise<CourseEditorialState | null> {
  if (options.readEditorialState) return options.readEditorialState(courseId);
  const mode = resolveCourseContentPersistMode(options);
  if (mode === "filesystem") return readEditorialFile(courseId);
  if (mode === "blob") return readEditorialBlob(courseId);
  return null;
}

async function writeCourseEditorialState(
  courseId: number,
  state: CourseEditorialState,
  options: CourseContentWriteOptions,
): Promise<void> {
  if (options.writeEditorialState) {
    await options.writeEditorialState(courseId, state);
    return;
  }
  const mode = resolveCourseContentPersistMode(options);
  if (mode === "filesystem") {
    writeEditorialFile(courseId, state);
    return;
  }
  if (mode === "blob") {
    await writeEditorialBlob(courseId, state);
    return;
  }
  throw new Error("This save target cannot store a course draft.");
}

export function courseEditorialClientView(state: CourseEditorialState | null): {
  draftRevisionId: string | null;
  previewedRevisionId: string | null;
  publishedRevisionId: string | null;
} {
  return {
    draftRevisionId: state?.draft?.revisionId ?? null,
    previewedRevisionId: state?.previewedRevisionId ?? null,
    publishedRevisionId: state?.published?.revisionId ?? null,
  };
}

function persistResultFromState(
  mode: CourseContentPersistResult["persistedVia"],
  state: CourseEditorialState,
): CourseContentPersistResult {
  return {
    backupPath: "",
    persistedVia: mode,
    revisionId: state.draft?.revisionId,
    previewedRevisionId: state.previewedRevisionId,
    publishedRevisionId: state.published?.revisionId ?? null,
  };
}

async function listEditorialCourseIds(options: CourseContentWriteOptions): Promise<number[]> {
  if (options.readEditorialState) return [];
  const mode = resolveCourseContentPersistMode(options);
  if (mode === "filesystem") return listEditorialFileIds();
  if (mode === "blob") return listEditorialBlobIds();
  return [];
}

/**
 * Editor source: the saved draft, then a legacy overlay, then the bundled file.
 * A bundled file never replaces a draft or a legacy overlay.
 */
export async function loadCourseContentDocument(
  courseId: number,
  options: CourseContentWriteOptions = {},
): Promise<CoursePreviewData> {
  const editorial = await readCourseEditorialState(courseId, options);
  let fallback: CoursePreviewData | null = null;

  if (options.readCourseContentOverlay) {
    fallback = await options.readCourseContentOverlay(courseId);
  } else {
    try {
      if (resolveCourseContentPersistMode(options) === "blob") {
        fallback = await readCourseContentOverlay(courseId);
      }
    } catch {
      fallback = null;
    }
  }

  if (!fallback) {
    try {
      fallback = readCourseContentFile(courseId);
    } catch {
      fallback = null;
    }
  }

  const document = editorCourseDocument(editorial, fallback);
  if (!document) throw new Error(`Course file not found for ${courseId}.`);
  return document;
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
  const filename = getDiscoveredCourseFile(courseId).filename;
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

export function applyLessonUpdate(
  data: CoursePreviewData,
  lessonSlug: string,
  lessonInput: unknown,
  options: { removeEmptyBlocks?: boolean } = {},
): { data: CoursePreviewData; lessonSlug: string; removedEmptyBlocks: string[] } {
  const validated = validateLessonInput(lessonInput);
  if ("error" in validated) {
    throw new Error(validated.error);
  }

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
  return { data, lessonSlug, removedEmptyBlocks };
}

export async function saveLessonUpdate(
  courseId: number,
  lessonSlug: string,
  lessonInput: unknown,
  options: { removeEmptyBlocks?: boolean } & CourseContentWriteOptions = {},
): Promise<SaveLessonResult> {
  const data = await loadCourseContentDocument(courseId, options);
  const applied = applyLessonUpdate(data, lessonSlug, lessonInput, {
    removeEmptyBlocks: options.removeEmptyBlocks,
  });
  const persist = await writeCourseContentFile(courseId, applied.data, options);
  const stored = await loadCourseContentDocument(courseId, options);
  const storedLesson = stored.lessons.find((lesson) => lesson.slug === applied.lessonSlug);
  if (!storedLesson) {
    throw new Error("Save failed: the lesson was not in the course after writing.");
  }

  return {
    ...persist,
    lessonSlug: applied.lessonSlug,
    removedEmptyBlocks: applied.removedEmptyBlocks,
    storedLesson,
  };
}

function serializeCourseContentFile(data: CoursePreviewData): string {
  return `${JSON.stringify(data, null, 2)}\n`;
}

export async function writeCourseContentFile(
  courseId: number,
  data: CoursePreviewData,
  options: CourseContentWriteOptions = {},
): Promise<CourseContentPersistResult> {
  const mode = resolveCourseContentPersistMode(options);

  if (mode === "github") {
    if (!options.commitCourseContentFile) {
      throw new Error("GitHub course-content writer was not provided.");
    }
    const filename = getDiscoveredCourseFile(courseId).filename;
    const serialized = serializeCourseContentFile(data);
    const commit = await options.commitCourseContentFile({
      filename,
      contents: serialized,
      courseId,
    });
    return {
      backupPath: "",
      persistedVia: "github",
      branch: commit.branch,
      commitSha: commit.commitSha,
    };
  }

  const current = (await readCourseEditorialState(courseId, options)) ?? emptyCourseEditorialState();
  const next = saveCourseDraft(current, data, new Date().toISOString());
  await writeCourseEditorialState(courseId, next, options);
  return persistResultFromState(mode, next);
}

export async function listEditorCourseSummaries(
  options: CourseContentWriteOptions = {},
): Promise<AdminCourseSummary[]> {
  const byId = new Map(listAdminCourseSummaries().map((entry) => [entry.id, entry]));
  let editorialIds: number[] = [];
  try {
    editorialIds = await listEditorialCourseIds(options);
  } catch {
    editorialIds = [];
  }
  for (const id of editorialIds) {
    let state: CourseEditorialState | null = null;
    try {
      state = await readCourseEditorialState(id, options);
    } catch {
      state = null;
    }
    if (!state?.draft) continue;
    const course = state.draft.document.course;
    const existing = byId.get(id);
    byId.set(id, {
      id,
      title: course.title,
      slug: course.slug,
      filename: existing?.filename ?? `editorial/${id}.json`,
      lessonCount: state.draft.document.lessons.length,
      status: course.status,
      published: course.published,
      active: course.active,
      isDraft: isLegacyCourseDraft(course),
      isPublic: isLegacyCoursePublic(course),
      isActive: isLegacyCourseActive(course),
      contentStatus: readCourseContentStatus(course),
    });
  }
  return [...byId.values()].sort(
    (a, b) =>
      a.title.localeCompare(b.title, undefined, { sensitivity: "base" }) || a.id - b.id,
  );
}

function slugFromTitle(title: string): string {
  return title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function createPrivateCourse(
  input: { title: string; slug?: string },
  options: CourseContentWriteOptions = {},
): Promise<{ courseId: number; course: CoursePreviewData; persist: CourseContentPersistResult }> {
  const title = input.title.trim();
  const slug = (input.slug?.trim() || slugFromTitle(title)).trim();
  const document = createPrivateCourseDocument({ id: 0, title, slug });
  const catalog = discoverAdminCourseCatalog();
  if (catalog.some((entry) => entry.slug.toLowerCase() === slug)) {
    throw new Error("A course with that slug already exists.");
  }
  const editorialIds = await listEditorialCourseIds(options);
  for (const id of editorialIds) {
    const state = await readCourseEditorialState(id, options);
    const existing = state?.draft?.document.course.slug ?? state?.published?.document.course.slug;
    if (existing && existing.toLowerCase() === slug) {
      throw new Error("A course with that slug already exists.");
    }
  }
  const courseId = Math.max(0, ...catalog.map((entry) => entry.id), ...editorialIds) + 1;
  document.course.legacyChallengeId = courseId;
  const next = saveCourseDraft(emptyCourseEditorialState(), document, new Date().toISOString());
  await writeCourseEditorialState(courseId, next, options);
  return {
    courseId,
    course: next.draft!.document,
    persist: persistResultFromState(resolveCourseContentPersistMode(options), next),
  };
}

export async function previewCourseDraft(
  courseId: number,
  revisionId: string,
  options: CourseContentWriteOptions = {},
): Promise<CourseContentPersistResult> {
  const state = await readCourseEditorialState(courseId, options);
  if (!state) throw new Error("Save a draft before preview.");
  const next = markCourseDraftPreviewed(state, revisionId);
  await writeCourseEditorialState(courseId, next, options);
  return persistResultFromState(resolveCourseContentPersistMode(options), next);
}

export async function publishCourseDraft(
  courseId: number,
  revisionId: string,
  options: CourseContentWriteOptions = {},
): Promise<CourseContentPersistResult> {
  const state = await readCourseEditorialState(courseId, options);
  if (!state) throw new Error("Save a draft before publishing.");
  const next = publishPreviewedCourseDraft(state, revisionId, new Date().toISOString());
  await writeCourseEditorialState(courseId, next, options);
  return persistResultFromState(resolveCourseContentPersistMode(options), next);
}

export function importPrivateCourseDraft(
  document: CoursePreviewData,
  savedAt: string,
): CourseEditorialState {
  return saveCourseDraft(emptyCourseEditorialState(), asPrivateDraft(document), savedAt);
}

function normalizeCourseThumbnail(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value !== "string") {
    throw new Error("thumbnail must be a string path or null.");
  }
  const trimmed = value.trim();
  return trimmed || null;
}

function normalizeCourseDescription(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value !== "string") {
    throw new Error("description must be a string or null.");
  }
  const trimmed = value.trim();
  return trimmed || null;
}

function normalizeCourseActive(value: unknown): boolean {
  if (typeof value !== "boolean") {
    throw new Error("active must be a boolean.");
  }
  return value;
}

function normalizeCoursePublished(value: unknown): boolean {
  if (typeof value !== "boolean") {
    throw new Error("published must be a boolean.");
  }
  return value;
}

function normalizeCourseContentStatus(value: unknown): CourseContentStatus {
  if (value !== "in_progress" && value !== "cleaned") {
    throw new Error('contentStatus must be "in_progress" or "cleaned".');
  }
  return value;
}

export function readCourseContentStatus(
  course: Pick<CoursePreviewData["course"], "contentStatus">,
): CourseContentStatus {
  return course.contentStatus === "cleaned" ? "cleaned" : "in_progress";
}

export function readCoursePublished(
  course: LegacyCoursePublicationFields,
): boolean {
  return readLegacyCoursePublished(course);
}

export function readCourseActive(
  course: LegacyCoursePublicationFields,
): boolean {
  return isLegacyCourseActive(course);
}

function readCourseDescriptionFromData(data: CoursePreviewData): string | null {
  const value =
    "description" in data.course && typeof data.course.description === "string"
      ? data.course.description.trim()
      : "";
  return value || null;
}

export async function saveCourseMetadata(
  courseId: number,
  update: CourseMetadataUpdate,
  writeOptions: CourseContentWriteOptions = {},
): Promise<SaveCourseMetadataResult> {
  if (
    !("thumbnail" in update) &&
    !("description" in update) &&
    !("active" in update) &&
    !("published" in update) &&
    !("contentStatus" in update)
  ) {
    throw new Error("No course metadata fields to save.");
  }

  const data = await loadCourseContentDocument(courseId, writeOptions);
  let thumbnail = readCourseThumbnailFromData(data);
  let description = readCourseDescriptionFromData(data);

  if ("thumbnail" in update) {
    thumbnail = normalizeCourseThumbnail(update.thumbnail);
    if (thumbnail) {
      data.course.thumbnail = thumbnail;
    } else {
      delete data.course.thumbnail;
    }
  }

  if ("description" in update) {
    description = normalizeCourseDescription(update.description);
    if (description) {
      data.course.description = description;
    } else {
      delete data.course.description;
    }
  }

  let active = readCourseActive(data.course);
  if ("active" in update) {
    active = normalizeCourseActive(update.active);
    if (active) {
      delete data.course.active;
    } else {
      data.course.active = false;
    }
  }

  let published = readCoursePublished(data.course);
  if ("published" in update) {
    published = normalizeCoursePublished(update.published);
    if (published) {
      data.course.status = "published";
      data.course.published = true;
    } else {
      data.course.status = "draft";
      data.course.published = false;
    }
  }

  let contentStatus = readCourseContentStatus(data.course);
  if ("contentStatus" in update) {
    contentStatus = normalizeCourseContentStatus(update.contentStatus);
    data.course.contentStatus = contentStatus;
  }

  const persist = await writeCourseContentFile(courseId, data, writeOptions);
  return {
    ...persist,
    thumbnail,
    description,
    active,
    published,
    contentStatus,
    course: data,
  };
}

function readCourseThumbnailFromData(data: CoursePreviewData): string | null {
  const value =
    "thumbnail" in data.course && typeof data.course.thumbnail === "string"
      ? data.course.thumbnail.trim()
      : "";
  return value || null;
}

export async function saveRichTextUpdates(
  courseId: number,
  updates: RichTextUpdate[],
  writeOptions: CourseContentWriteOptions = {},
): Promise<SaveRichTextResult> {
  const data = await loadCourseContentDocument(courseId, writeOptions);
  const { applied, missing } = applyRichTextUpdates(data, updates);

  if (applied === 0) {
    throw new Error(
      missing.length > 0
        ? `No matching richText blocks found: ${missing.join(", ")}`
        : "No updates to save.",
    );
  }

  const persist = await writeCourseContentFile(courseId, data, writeOptions);
  return { ...persist, applied, missing };
}

export async function saveCourseContentUpdates(
  courseId: number,
  payload: CourseContentSavePayload,
  writeOptions: CourseContentWriteOptions = {},
): Promise<SaveCourseContentResult> {
  const richTextUpdates = payload.richTextUpdates ?? [];
  const removals = payload.removals ?? [];

  if (richTextUpdates.length === 0 && removals.length === 0) {
    throw new Error("No updates to save.");
  }

  const data = await loadCourseContentDocument(courseId, writeOptions);
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

  const persist = await writeCourseContentFile(courseId, data, writeOptions);
  return {
    ...persist,
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
