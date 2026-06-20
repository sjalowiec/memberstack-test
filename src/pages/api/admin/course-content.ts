import type { APIRoute } from "astro";
import {
  getAllowedCourseIds,
  isAllowedCourseId,
  isCourseContentAdminAllowed,
  readCourseContentFile,
  saveRichTextUpdates,
  type RichTextUpdate,
} from "../../../lib/legacy_kin/courseContentAdmin";

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

function parseUpdates(raw: unknown): RichTextUpdate[] | { error: string } {
  if (!Array.isArray(raw)) {
    return { error: "updates must be an array." };
  }

  const updates: RichTextUpdate[] = [];

  for (let i = 0; i < raw.length; i++) {
    const item = raw[i];
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      return { error: `updates[${i}] must be an object.` };
    }

    const o = item as Record<string, unknown>;
    const lessonSlug = typeof o.lessonSlug === "string" ? o.lessonSlug.trim() : "";
    const blockSlug = typeof o.blockSlug === "string" ? o.blockSlug.trim() : "";
    const legacyComponentId = Number.parseInt(String(o.legacyComponentId ?? ""), 10);
    const html = typeof o.html === "string" ? o.html : null;

    if (!lessonSlug || !blockSlug) {
      return { error: `updates[${i}] requires lessonSlug and blockSlug.` };
    }
    if (!Number.isFinite(legacyComponentId)) {
      return { error: `updates[${i}] requires legacyComponentId.` };
    }
    if (html === null) {
      return { error: `updates[${i}] requires html string.` };
    }

    updates.push({ lessonSlug, blockSlug, legacyComponentId, html });
  }

  return updates;
}

export const GET: APIRoute = async ({ url, request }) => {
  if (
    !isCourseContentAdminAllowed(new URL(request.url).hostname, adminEnv)
  ) {
    return adminBlockedResponse();
  }

  const courseId = parseCourseId(url.searchParams.get("courseId"));

  try {
    const courses = getAllowedCourseIds().map((id) => {
      const data = readCourseContentFile(id);
      return {
        id,
        title: data.course.title,
        filename: data.course.legacy?.sourceExport ?? null,
        lessonCount: data.lessons.length,
      };
    });

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
      { ok: false, error: "courseId must be a supported legacy course id (50 or 51)." },
      400,
    );
  }

  const parsedUpdates = parseUpdates(body.updates);
  if ("error" in parsedUpdates) {
    return jsonResponse({ ok: false, error: parsedUpdates.error }, 400);
  }

  if (parsedUpdates.length === 0) {
    return jsonResponse({ ok: false, error: "No updates provided." }, 400);
  }

  try {
    const result = saveRichTextUpdates(courseId, parsedUpdates);
    return jsonResponse({
      ok: true,
      courseId,
      applied: result.applied,
      missing: result.missing,
      backupPath: result.backupPath,
      savedAt: new Date().toISOString(),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not save course content.";
    return jsonResponse({ ok: false, error: message }, 500);
  }
};
