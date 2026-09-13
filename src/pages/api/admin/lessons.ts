import type { APIRoute } from "astro";
import { requireAdminForRequest, adminAuthErrorBody } from "../../../lib/admin/requireAdminRequest";
import { getLessonId, sortLessonsById } from "../../../lib/lessons/jsonFile";
import { isLessonStatus } from "../../../lib/lessons/document";
import {
  isUniqueViolation,
  loadLessonsForAdmin,
  saveNewLesson,
} from "../../../lib/lessons/loadLessons";

export const prerender = false;

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

function requireNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string" || value.trim() === "") return null;
  return value.trim();
}

function slugTaken(
  lessons: Record<string, unknown>[],
  slug: string,
  exceptId: number | null,
): boolean {
  const needle = slug.trim().toLowerCase();
  return lessons.some((row) => {
    const sid = typeof row.slug === "string" ? row.slug.trim().toLowerCase() : "";
    if (sid !== needle) return false;
    const id = getLessonId(row);
    if (exceptId !== null && id === exceptId) return false;
    return true;
  });
}

export const GET: APIRoute = async ({ request, cookies }) => {
  const auth = await requireAdminForRequest(request, cookies);
  if (!auth.ok) {
    return jsonResponse(adminAuthErrorBody(auth), auth.status);
  }

  try {
    const lessons = sortLessonsById(await loadLessonsForAdmin());
    return jsonResponse({ ok: true, lessons });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not read lessons.";
    return jsonResponse({ ok: false, error: message }, 500);
  }
};

export const POST: APIRoute = async ({ request, cookies }) => {
  const auth = await requireAdminForRequest(request, cookies);
  if (!auth.ok) {
    return jsonResponse(adminAuthErrorBody(auth), auth.status);
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

  const title = requireNonEmptyString(body.title);
  const slug = requireNonEmptyString(body.slug);
  const status = requireNonEmptyString(body.status);
  const category = typeof body.category === "string" ? body.category.trim() : "";

  if (!title) return jsonResponse({ ok: false, error: "title is required." }, 400);
  if (!slug) return jsonResponse({ ok: false, error: "slug is required." }, 400);
  if (!status) return jsonResponse({ ok: false, error: "status is required." }, 400);
  if (!isLessonStatus(status)) {
    return jsonResponse({ ok: false, error: "status must be draft, published, or review." }, 400);
  }

  let lessons: Record<string, unknown>[];
  try {
    lessons = await loadLessonsForAdmin();
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not read lessons.";
    return jsonResponse({ ok: false, error: message }, 500);
  }

  if (slugTaken(lessons, slug, null)) {
    return jsonResponse({ ok: false, error: `slug "${slug}" is already in use.` }, 400);
  }

  const row: Record<string, unknown> = { ...body };
  delete row.id;
  row.title = title;
  row.slug = slug;
  row.status = status;
  if (category) row.category = category;
  else delete row.category;
  if (typeof row.access !== "string" || !row.access) {
    row.access = "member";
  }

  try {
    const lesson = await saveNewLesson(row, { slug, status, title, category }, auth.member);
    const ordered = sortLessonsById(await loadLessonsForAdmin());
    return jsonResponse({ ok: true, lessons: ordered, lesson });
  } catch (e) {
    if (isUniqueViolation(e)) {
      return jsonResponse({ ok: false, error: `slug "${slug}" is already in use.` }, 400);
    }
    const message = e instanceof Error ? e.message : "Could not save lesson.";
    return jsonResponse({ ok: false, error: message }, 500);
  }
};
