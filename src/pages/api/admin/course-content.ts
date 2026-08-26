import type { APIRoute } from "astro";
import {
  isAllowedCourseId,
  isCourseContentAdminAllowed,
  listAdminCourseSummaries,
  loadCourseContentDocument,
  saveCourseMetadata,
  saveLessonUpdate,
} from "../../../lib/legacy_kin/courseContentAdmin";
import {
  addLessonToCourse,
  deleteLessonFromCourse,
  duplicateLessonInCourse,
  moveLessonInCourse,
} from "../../../lib/legacy_kin/courseLessonAdmin";
import {
  formatCourseSplitReport,
  runCourseContentSplit,
} from "../../../lib/legacy_kin/courseContentSplit";
import { courseContentWriteRequiresWatsonSession } from "../../../lib/legacy_kin/courseContentPersist";
import { commitCourseContentFile } from "../../../lib/legacy_kin/courseContentGithub";
import { writeCourseContentOverlay } from "../../../lib/legacy_kin/courseContentLiveStore";
import { requireWatsonSessionJson } from "../../../lib/watson/watsonApiAuth";

export const prerender = false;

const adminEnv = {
  isViteDev: import.meta.env.DEV,
  publicSiteEnv: import.meta.env.PUBLIC_SITE_ENV,
};

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
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

    const course = await loadCourseContentDocument(courseId, {
      hostname: new URL(request.url).hostname,
      env: adminEnv,
    });
    return jsonResponse({ ok: true, courses, courseId, course });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not read course content.";
    return jsonResponse({ ok: false, error: message }, 500);
  }
};

export const POST: APIRoute = async (context) => {
  const hostname = new URL(context.request.url).hostname;
  if (!isCourseContentAdminAllowed(hostname, adminEnv)) {
    return adminBlockedResponse();
  }

  if (courseContentWriteRequiresWatsonSession(hostname, adminEnv)) {
    const auth = await requireWatsonSessionJson(context);
    if (auth instanceof Response) return auth;
  }

  const { request } = context;

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
  const writeOptions = {
    hostname,
    env: adminEnv,
    commitCourseContentFile,
    writeCourseContentOverlay,
  };

  try {
    if (action === "addLesson") {
      const result = await addLessonToCourse(courseId, writeOptions);
      return jsonResponse({
        ok: true,
        action,
        courseId,
        course: result.course,
        lesson: result.lesson,
        lessonSlug: result.lessonSlug,
        backupPath: result.backupPath,
        persistedVia: result.persistedVia,
        branch: result.branch,
        commitSha: result.commitSha,
        savedAt: new Date().toISOString(),
      });
    }

    if (action === "deleteLesson") {
      const lessonSlug = typeof body.lessonSlug === "string" ? body.lessonSlug.trim() : "";
      if (!lessonSlug) {
        return jsonResponse({ ok: false, error: "lessonSlug is required." }, 400);
      }
      const result = await deleteLessonFromCourse(courseId, lessonSlug, writeOptions);
      return jsonResponse({
        ok: true,
        action,
        courseId,
        course: result.course,
        lessonSlug,
        backupPath: result.backupPath,
        persistedVia: result.persistedVia,
        branch: result.branch,
        commitSha: result.commitSha,
        savedAt: new Date().toISOString(),
      });
    }

    if (action === "moveLesson") {
      const fromIndex = Number.parseInt(String(body.fromIndex ?? ""), 10);
      const toIndex = Number.parseInt(String(body.toIndex ?? ""), 10);
      if (!Number.isFinite(fromIndex) || !Number.isFinite(toIndex)) {
        return jsonResponse({ ok: false, error: "fromIndex and toIndex are required." }, 400);
      }
      const result = await moveLessonInCourse(courseId, fromIndex, toIndex, writeOptions);
      return jsonResponse({
        ok: true,
        action,
        courseId,
        course: result.course,
        backupPath: result.backupPath,
        persistedVia: result.persistedVia,
        branch: result.branch,
        commitSha: result.commitSha,
        savedAt: new Date().toISOString(),
      });
    }

    if (action === "duplicateLesson") {
      const lessonSlug = typeof body.lessonSlug === "string" ? body.lessonSlug.trim() : "";
      if (!lessonSlug) {
        return jsonResponse({ ok: false, error: "lessonSlug is required." }, 400);
      }
      const result = await duplicateLessonInCourse(
        courseId,
        lessonSlug,
        body.lesson,
        writeOptions,
      );
      return jsonResponse({
        ok: true,
        action,
        courseId,
        course: result.course,
        lesson: result.lesson,
        lessonSlug: result.lessonSlug,
        backupPath: result.backupPath,
        persistedVia: result.persistedVia,
        branch: result.branch,
        commitSha: result.commitSha,
        savedAt: new Date().toISOString(),
      });
    }

    if (action === "saveCourseMetadata") {
      if (
        !("thumbnail" in body) &&
        !("description" in body) &&
        !("active" in body) &&
        !("published" in body) &&
        !("contentStatus" in body)
      ) {
        return jsonResponse(
          {
            ok: false,
            error: "saveCourseMetadata requires thumbnail, description, active, published, and/or contentStatus.",
          },
          400,
        );
      }
      const update: {
        thumbnail?: unknown;
        description?: unknown;
        active?: unknown;
        published?: unknown;
        contentStatus?: unknown;
      } = {};
      if ("thumbnail" in body) update.thumbnail = body.thumbnail;
      if ("description" in body) update.description = body.description;
      if ("active" in body) update.active = body.active;
      if ("published" in body) update.published = body.published;
      if ("contentStatus" in body) update.contentStatus = body.contentStatus;
      const result = await saveCourseMetadata(courseId, update, writeOptions);
      return jsonResponse({
        ok: true,
        action,
        courseId,
        course: result.course,
        thumbnail: result.thumbnail,
        description: result.description,
        active: result.active,
        published: result.published,
        contentStatus: result.contentStatus,
        backupPath: result.backupPath,
        persistedVia: result.persistedVia,
        branch: result.branch,
        commitSha: result.commitSha,
        savedAt: new Date().toISOString(),
      });
    }

    if (action === "splitLessonContent") {
      const lessonSlug =
        typeof body.lessonSlug === "string" ? body.lessonSlug.trim() : undefined;
      const blockSlug =
        typeof body.blockSlug === "string" ? body.blockSlug.trim() : undefined;
      const dryRun = body.apply !== true;
      const force = body.force === true;
      const allowHandCleaned = body.allowHandCleaned === true;
      const report = await runCourseContentSplit({
        courseId,
        lessonSlug,
        blockSlug,
        dryRun,
        force,
        allowHandCleaned,
        write: writeOptions,
      });
      const course =
        report.writtenCourse ??
        (await loadCourseContentDocument(courseId, writeOptions));
      return jsonResponse({
        ok: true,
        action,
        courseId,
        course,
        report,
        reportText: formatCourseSplitReport(report),
        persistedVia: report.persistedVia,
        commitSha: report.commitSha,
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

    const result = await saveLessonUpdate(courseId, lessonSlug, body.lesson, {
      removeEmptyBlocks,
      ...writeOptions,
    });
    return jsonResponse({
      ok: true,
      action: "saveLesson",
      courseId,
      lessonSlug: result.lessonSlug,
      removedEmptyBlocks: result.removedEmptyBlocks,
      backupPath: result.backupPath,
      persistedVia: result.persistedVia,
      branch: result.branch,
      commitSha: result.commitSha,
      savedAt: new Date().toISOString(),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not save course content.";
    return jsonResponse({ ok: false, error: message }, 500);
  }
};
