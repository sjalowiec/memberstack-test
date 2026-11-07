/**
 * Course drafts live outside the bundled POC files.
 * Localhost uses gitignored JSON. Deployed sites use a blob store that a
 * later code deploy does not overwrite.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { getStore } from "@netlify/blobs";

import {
  emptyCourseEditorialState,
  type CourseEditorialState,
  type CourseRevision,
  type PublishedCourseRevision,
} from "./courseEditorial";
import type { CoursePreviewData } from "./coursePreviewPoc";

export const COURSE_EDITORIAL_DIR = join(
  process.cwd(),
  "src",
  "data",
  "legacy_kin",
  "editorial",
);

export const COURSE_EDITORIAL_STORE = "course-content-editorial";

export function courseEditorialKey(courseId: number): string {
  return `editorial/${courseId}.json`;
}

export function courseEditorialFilePath(courseId: number): string {
  return join(COURSE_EDITORIAL_DIR, `${courseId}.json`);
}

type EditorialBlobStore = {
  get(key: string, options: { type: "json" }): Promise<unknown>;
  setJSON(key: string, data: unknown): Promise<unknown>;
  list?(options: { prefix: string }): Promise<{ blobs: { key: string }[] }>;
};

function isDocument(value: unknown): value is CoursePreviewData {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as { course?: { legacyChallengeId?: unknown }; lessons?: unknown };
  return Number.isFinite(Number(record.course?.legacyChallengeId)) && Array.isArray(record.lessons);
}

function isRevision(value: unknown): value is CourseRevision {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as CourseRevision;
  return (
    typeof record.revisionId === "string" &&
    record.revisionId.length > 0 &&
    typeof record.savedAt === "string" &&
    isDocument(record.document)
  );
}

function isPublishedRevision(value: unknown): value is PublishedCourseRevision {
  if (!isRevision(value)) return false;
  return typeof (value as PublishedCourseRevision).sourceRevisionId === "string";
}

export function isCourseEditorialState(value: unknown): value is CourseEditorialState {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as CourseEditorialState;
  if (record.draft !== null && !isRevision(record.draft)) return false;
  if (record.published !== null && !isPublishedRevision(record.published)) return false;
  if (record.previewedRevisionId !== null && typeof record.previewedRevisionId !== "string") {
    return false;
  }
  return record.draft !== undefined && record.published !== undefined;
}

export function readEditorialFile(courseId: number): CourseEditorialState | null {
  const path = courseEditorialFilePath(courseId);
  if (!existsSync(path)) return null;
  try {
    const parsed = JSON.parse(readFileSync(path, "utf8")) as unknown;
    return isCourseEditorialState(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function writeEditorialFile(courseId: number, state: CourseEditorialState): void {
  mkdirSync(COURSE_EDITORIAL_DIR, { recursive: true });
  const path = courseEditorialFilePath(courseId);
  writeFileSync(path, `${JSON.stringify(state, null, 2)}\n`, "utf8");
}

export function listEditorialFileIds(): number[] {
  if (!existsSync(COURSE_EDITORIAL_DIR)) return [];
  return readdirSync(COURSE_EDITORIAL_DIR)
    .map((name) => /^(\d+)\.json$/.exec(name)?.[1])
    .filter((id): id is string => Boolean(id))
    .map((id) => Number(id));
}

function editorialBlobStore(): EditorialBlobStore {
  return getStore({
    name: COURSE_EDITORIAL_STORE,
    consistency: "strong",
  });
}

export function assertEditorialBlobWriteAllowed(): void {
  const context = (process.env.CONTEXT || "").trim();
  if (context === "deploy-preview" || context === "branch-deploy") {
    throw new Error(
      "Save course drafts on the published admin site. A deploy preview shares that site's saved courses and is not used for editing.",
    );
  }
}

export async function readEditorialBlob(
  courseId: number,
  store?: EditorialBlobStore,
): Promise<CourseEditorialState | null> {
  try {
    const resolved = store ?? editorialBlobStore();
    const raw = await resolved.get(courseEditorialKey(courseId), { type: "json" });
    return isCourseEditorialState(raw) ? raw : null;
  } catch {
    return null;
  }
}

export async function writeEditorialBlob(
  courseId: number,
  state: CourseEditorialState,
  store: EditorialBlobStore = editorialBlobStore(),
): Promise<void> {
  assertEditorialBlobWriteAllowed();
  const draftId = Number(state.draft?.document.course.legacyChallengeId);
  const publishedId = Number(state.published?.document.course.legacyChallengeId);
  if (
    (state.draft && draftId !== courseId) ||
    (state.published && publishedId !== courseId)
  ) {
    throw new Error("Refusing editorial write: course id mismatch.");
  }
  await store.setJSON(courseEditorialKey(courseId), state);
}

export async function listEditorialBlobIds(
  store?: EditorialBlobStore,
): Promise<number[]> {
  try {
    const resolved = store ?? editorialBlobStore();
    if (!resolved.list) return [];
    const listed = await resolved.list({ prefix: "editorial/" });
    return listed.blobs
      .map((blob) => /^editorial\/(\d+)\.json$/.exec(blob.key)?.[1])
      .filter((id): id is string => Boolean(id))
      .map((id) => Number(id));
  } catch {
    return [];
  }
}

export { emptyCourseEditorialState };
