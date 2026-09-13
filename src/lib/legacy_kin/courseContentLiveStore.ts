/**
 * Live editorial overlay for Watson-managed course POC JSON.
 * Deployed DEV reads/writes Netlify Blobs so Save → Preview does not wait
 * for git commit or a Netlify deploy. Localhost keeps using the filesystem.
 */
import { getStore, type Store } from "@netlify/blobs";
import type { CoursePreviewData } from "./coursePreviewPoc";

export const COURSE_CONTENT_LIVE_STORE = "course-content-live";
export const COURSE_CONTENT_LIVE_KEY_PREFIX = "courses/";

export type CourseContentLiveStore = Pick<Store, "get" | "setJSON">;

export function courseContentLiveKey(courseId: number): string {
  return `${COURSE_CONTENT_LIVE_KEY_PREFIX}${courseId}.json`;
}

export function getCourseContentLiveStore(): CourseContentLiveStore {
  return getStore({
    name: COURSE_CONTENT_LIVE_STORE,
    consistency: "strong",
  });
}

function isCoursePreviewData(value: unknown): value is CoursePreviewData {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as { course?: { legacyChallengeId?: unknown }; lessons?: unknown };
  return (
    Number.isFinite(Number(record.course?.legacyChallengeId)) &&
    Array.isArray(record.lessons)
  );
}

export async function readCourseContentOverlay(
  courseId: number,
  store: CourseContentLiveStore = getCourseContentLiveStore(),
): Promise<CoursePreviewData | null> {
  try {
    const raw = await store.get(courseContentLiveKey(courseId), { type: "json" });
    if (!isCoursePreviewData(raw)) return null;
    if (Number(raw.course.legacyChallengeId) !== courseId) return null;
    return raw;
  } catch {
    return null;
  }
}

export async function writeCourseContentOverlay(
  courseId: number,
  data: CoursePreviewData,
  store: CourseContentLiveStore = getCourseContentLiveStore(),
): Promise<void> {
  if (Number(data.course.legacyChallengeId) !== courseId) {
    throw new Error("Refusing overlay write: course id mismatch.");
  }
  await store.setJSON(courseContentLiveKey(courseId), data);
}
