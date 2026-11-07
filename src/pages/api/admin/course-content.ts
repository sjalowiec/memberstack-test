import type { APIRoute } from "astro";
import {
  courseEditorialClientView,
  createPrivateCourse,
  isAllowedCourseId,
  listEditorCourseSummaries,
  loadCourseContentDocument,
  previewCourseDraft,
  publishCourseDraft,
  readCourseEditorialState,
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
import type { CourseContentPersistResult } from "../../../lib/legacy_kin/courseContentPersist";
import { commitCourseContentFile } from "../../../lib/legacy_kin/courseContentGithub";

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

function editorialFields(result: CourseContentPersistResult) {
  return {
    revisionId: result.revisionId ?? null,
    previewedRevisionId: result.previewedRevisionId ?? null,
    publishedRevisionId: result.publishedRevisionId ?? null,
    editorial: {
      draftRevisionId: result.revisionId ?? null,
      previewedRevisionId: result.previewedRevisionId ?? null,
      publishedRevisionId: result.publishedRevisionId ?? null,
    },
  };
}

async function resolveCourseId(
  value: string | null,
  options: { hostname: string; env: typeof adminEnv },
): Promise<number | null> {
  if (!value) return null;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  if (isAllowedCourseId(parsed)) return parsed;
  const state = await readCourseEditorialState(parsed, options);
  if (state?.draft || state?.published) return parsed;
  return null;
}

export const GET: APIRoute = async ({ url, request }) => {
  const hostname = new URL(request.url).hostname;
  const readOptions = { hostname, env: adminEnv };
  const courseId = await resolveCourseId(url.searchParams.get("courseId"), readOptions);

  try {
    const courses = await listEditorCourseSummaries(readOptions);

    if (courseId === null) {
      return jsonResponse({ ok: true, courses });
    }

    const course = await loadCourseContentDocument(courseId, readOptions);
    const editorial = courseEditorialClientView(
      await readCourseEditorialState(courseId, readOptions),
    );
    return jsonResponse({ ok: true, courses, courseId, course, editorial });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not read course content.";
    return jsonResponse({ ok: false, error: message }, 500);
  }
};

export const POST: APIRoute = async (context) => {
  const hostname = new URL(context.request.url).hostname;
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

  const action = typeof body.action === "string" ? body.action.trim() : "saveLesson";
  const writeOptions = {
    hostname,
    env: adminEnv,
    commitCourseContentFile,
  };

  if (action === "createCourse") {
    const title = typeof body.title === "string" ? body.title : "";
    const slug = typeof body.slug === "string" ? body.slug : "";
    try {
      const created = await createPrivateCourse(
        { title, slug: slug || undefined },
        writeOptions,
      );
      return jsonResponse({
        ok: true,
        action,
        courseId: created.courseId,
        course: created.course,
        ...editorialFields(created.persist),
        savedAt: new Date().toISOString(),
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : "Could not create the course.";
      return jsonResponse({ ok: false, error: message }, 400);
    }
  }

  const courseId = await resolveCourseId(String(body.courseId ?? ""), writeOptions);
  if (courseId === null) {
    return jsonResponse(
      { ok: false, error: "courseId must be a supported course id." },
      400,
    );
  }

  try {
    if (action === "previewDraft" || action === "publishDraft") {
      const revisionId = typeof body.revisionId === "string" ? body.revisionId.trim() : "";
      if (!revisionId) {
        return jsonResponse({ ok: false, error: "revisionId is required." }, 400);
      }
      const result =
        action === "previewDraft"
          ? await previewCourseDraft(courseId, revisionId, writeOptions)
          : await publishCourseDraft(courseId, revisionId, writeOptions);
      return jsonResponse({
        ok: true,
        action,
        courseId,
        ...editorialFields(result),
        savedAt: new Date().toISOString(),
      });
    }

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
        ...editorialFields(result),
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
        ...editorialFields(result),
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
        ...editorialFields(result),
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
        ...editorialFields(result),
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
        ...editorialFields(result),
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
      storedLesson: result.storedLesson,
      branch: result.branch,
      commitSha: result.commitSha,
      ...editorialFields(result),
      savedAt: new Date().toISOString(),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not save course content.";
    return jsonResponse({ ok: false, error: message }, 500);
  }
};
