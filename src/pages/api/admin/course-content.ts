import type { APIRoute } from "astro";
import {
  isAllowedCourseId,
  isCourseContentAdminAllowed,
  listAdminCourseSummaries,
  readCourseContentFile,
  saveLessonUpdate,
} from "../../../lib/legacy_kin/courseContentAdmin";
import {
  addLessonToCourse,
  deleteLessonFromCourse,
  duplicateLessonInCourse,
  moveLessonInCourse,
} from "../../../lib/legacy_kin/courseLessonAdmin";

export const prerender = false;

const adminEnv = {
  isViteDev: import.meta.env.DEV,
  publicSiteEnv: import.meta.env.PUBLIC_SITE_ENV,
};

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function adminBlockedResponse() {
  return jsonResponse(
    {
      ok: false,
      error: "Course content admin is only available in dev and staging environments.",
    },
    403,
  );
}

function parseCourseId(value: string | null): number | null {
  if (!value) return null;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || !isAllowedCourseId(parsed)) return null;
  return parsed;
}

export const GET: APIRoute = async ({ url, request }) => {
  if (
    !isCourseContentAdminAllowed(new URL(request.url).hostname, adminEnv)
  ) {
    return adminBlockedResponse();
  }

  const courseId = parseCourseId(url.searchParams.get("courseId"));

  try {
    const courses = listAdminCourseSummaries();

    if (courseId === null) {
      return jsonResponse({ ok: true, courses });
    }

    const course = readCourseContentFile(courseId);
    return jsonResponse({ ok: true, courses, courseId, course });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not read course content.";
    return jsonResponse({ ok: false, error: message }, 500);
  }
};

export const POST: APIRoute = async ({ request }) => {
  if (
    !isCourseContentAdminAllowed(new URL(request.url).hostname, adminEnv)
  ) {
    return adminBlockedResponse();
  }

  if (!request.headers.get("content-type")?.includes("application/json")) {
    return jsonResponse({ ok: false, error: "Content-Type must be application/json" }, 400);
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return jsonResponse({ ok: false, error: "Invalid JSON body" }, 400);
  }

  const courseId = Number.parseInt(String(body.courseId ?? ""), 10);
  if (!Number.isFinite(courseId) || !isAllowedCourseId(courseId)) {
    return jsonResponse(
      { ok: false, error: "courseId must be a supported legacy course id." },
      400,
    );
  }

  const action = typeof body.action === "string" ? body.action.trim() : "saveLesson";

  try {
    if (action === "addLesson") {
      const result = addLessonToCourse(courseId);
      return jsonResponse({
        ok: true,
        action,
        courseId,
        course: result.course,
        lesson: result.lesson,
        lessonSlug: result.lessonSlug,
        backupPath: result.backupPath,
        savedAt: new Date().toISOString(),
      });
    }

    if (action === "deleteLesson") {
      const lessonSlug = typeof body.lessonSlug === "string" ? body.lessonSlug.trim() : "";
      if (!lessonSlug) {
        return jsonResponse({ ok: false, error: "lessonSlug is required." }, 400);
      }
      const result = deleteLessonFromCourse(courseId, lessonSlug);
      return jsonResponse({
        ok: true,
        action,
        courseId,
        course: result.course,
        lessonSlug,
        backupPath: result.backupPath,
        savedAt: new Date().toISOString(),
      });
    }

    if (action === "moveLesson") {
      const fromIndex = Number.parseInt(String(body.fromIndex ?? ""), 10);
      const toIndex = Number.parseInt(String(body.toIndex ?? ""), 10);
      if (!Number.isFinite(fromIndex) || !Number.isFinite(toIndex)) {
        return jsonResponse({ ok: false, error: "fromIndex and toIndex are required." }, 400);
      }
      const result = moveLessonInCourse(courseId, fromIndex, toIndex);
      return jsonResponse({
        ok: true,
        action,
        courseId,
        course: result.course,
        backupPath: result.backupPath,
        savedAt: new Date().toISOString(),
      });
    }

    if (action === "duplicateLesson") {
      const lessonSlug = typeof body.lessonSlug === "string" ? body.lessonSlug.trim() : "";
      if (!lessonSlug) {
        return jsonResponse({ ok: false, error: "lessonSlug is required." }, 400);
      }
      const result = duplicateLessonInCourse(
        courseId,
        lessonSlug,
        body.lesson,
      );
      return jsonResponse({
        ok: true,
        action,
        courseId,
        course: result.course,
        lesson: result.lesson,
        lessonSlug: result.lessonSlug,
        backupPath: result.backupPath,
        savedAt: new Date().toISOString(),
      });
    }

    const lessonSlug = typeof body.lessonSlug === "string" ? body.lessonSlug.trim() : "";
    if (!lessonSlug) {
      return jsonResponse({ ok: false, error: "lessonSlug is required." }, 400);
    }

    if (!body.lesson || typeof body.lesson !== "object") {
      return jsonResponse({ ok: false, error: "lesson object is required." }, 400);
    }

    const removeEmptyBlocks = body.removeEmptyBlocks !== false;

    const result = saveLessonUpdate(courseId, lessonSlug, body.lesson, {
      removeEmptyBlocks,
    });
    return jsonResponse({
      ok: true,
      action: "saveLesson",
      courseId,
      lessonSlug: result.lessonSlug,
      removedEmptyBlocks: result.removedEmptyBlocks,
      backupPath: result.backupPath,
      savedAt: new Date().toISOString(),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not save course content.";
    return jsonResponse({ ok: false, error: message }, 500);
  }
};
