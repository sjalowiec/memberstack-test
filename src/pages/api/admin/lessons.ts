import type { APIRoute } from "astro";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export const prerender = false;

const LESSONS_JSON_PATH = join(process.cwd(), "src", "data", "lessons.json");

export type LessonRecord = {
  id: number;
  slug: string;
  title: string;
  summary: string;
  type: string;
  vimeoEmbedUrl: string;
  access: "free" | "member";
  encouragement: string;
    exerciseTitle: string;
  exerciseItems: string[];
  noteTitle: string;
  noteText: string;
  supportImage: string;
  supportImageAlt: string;
  templateLink: string;
  templateLinkText: string;
};

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function trimStr(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function parseId(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return Math.floor(value);
  if (typeof value === "string" && value.trim()) {
    const n = parseInt(value.trim(), 10);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function normalizeLesson(
  raw: unknown,
  index: number
): { ok: true; lesson: LessonRecord } | { ok: false; error: string } {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, error: `Item ${index + 1} must be an object.` };
  }
  const o = raw as Record<string, unknown>;
  const id = parseId(o.id);
  if (id === null) {
    return { ok: false, error: `Item ${index + 1} has a missing or invalid id.` };
  }

  const title = trimStr(o.title);
  const slug = trimStr(o.slug);
  const summary = trimStr(o.summary);
  const type = trimStr(o.type);
  const accessRaw = trimStr(o.access);

  if (!title) return { ok: false, error: `Lesson id ${id}: title is required.` };
  if (!slug) return { ok: false, error: `Lesson id ${id}: slug is required.` };
  if (!summary) return { ok: false, error: `Lesson id ${id}: summary is required.` };
  if (!type) return { ok: false, error: `Lesson id ${id}: type is required.` };

  if (accessRaw !== "free" && accessRaw !== "member") {
    return {
      ok: false,
      error: `Lesson id ${id}: access must be "free" or "member".`,
    };
  }

  let exerciseItems: string[] = [];
  if (o.exerciseItems === undefined || o.exerciseItems === null) {
    exerciseItems = [];
  } else if (Array.isArray(o.exerciseItems)) {
    exerciseItems = o.exerciseItems.map((x) => trimStr(x)).filter((s) => s.length > 0);
  } else {
    return { ok: false, error: `Lesson id ${id}: exerciseItems must be an array.` };
  }

  const lesson: LessonRecord = {
    id,
    slug,
    title,
    summary,
    type,
    vimeoEmbedUrl: trimStr(o.vimeoEmbedUrl),
    access: accessRaw,
    encouragement: trimStr(o.encouragement),
    exerciseTitle: trimStr(o.exerciseTitle),
    exerciseItems,
    noteTitle: trimStr(o.noteTitle),
    noteText: trimStr(o.noteText),
    supportImage: trimStr(o.supportImage),
    supportImageAlt: trimStr(o.supportImageAlt),
    templateLink: trimStr(o.templateLink),
    templateLinkText: trimStr(o.templateLinkText),
  };

  return { ok: true, lesson };
}

function readLessonsArray(): unknown[] {
  const raw = readFileSync(LESSONS_JSON_PATH, "utf-8");
  const data = JSON.parse(raw) as unknown;
  if (!Array.isArray(data)) {
    throw new Error("lessons.json must contain a JSON array.");
  }
  return data;
}

export const GET: APIRoute = async () => {
  try {
    const data = readLessonsArray();
    const lessons = [...data].sort((a, b) => {
      const ra = a && typeof a === "object" && !Array.isArray(a) ? (a as Record<string, unknown>) : {};
      const rb = b && typeof b === "object" && !Array.isArray(b) ? (b as Record<string, unknown>) : {};
      const ia = parseId(ra.id) ?? 0;
      const ib = parseId(rb.id) ?? 0;
      return ia - ib;
    });
    return jsonResponse({ ok: true, lessons });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not read lessons.json";
    return jsonResponse({ ok: false, error: message }, 500);
  }
};

export const POST: APIRoute = async ({ request }) => {
  if (!request.headers.get("content-type")?.includes("application/json")) {
    return jsonResponse({ ok: false, error: "Content-Type must be application/json" }, 400);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ ok: false, error: "Invalid JSON body" }, 400);
  }

  if (!Array.isArray(body)) {
    return jsonResponse({ ok: false, error: "Request body must be a JSON array of lessons." }, 400);
  }

  const seen = new Set<number>();
  const lessons: LessonRecord[] = [];

  for (let i = 0; i < body.length; i++) {
    const n = normalizeLesson(body[i], i);
    if (!n.ok) return jsonResponse({ ok: false, error: n.error }, 400);
    if (seen.has(n.lesson.id)) {
      return jsonResponse(
        { ok: false, error: `Duplicate lesson id ${n.lesson.id}. Each id must be unique.` },
        400
      );
    }
    seen.add(n.lesson.id);
    lessons.push(n.lesson);
  }

  lessons.sort((a, b) => a.id - b.id);

  try {
    writeFileSync(LESSONS_JSON_PATH, JSON.stringify(lessons, null, 2), "utf-8");
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not write lessons.json";
    return jsonResponse({ ok: false, error: message }, 500);
  }

  return jsonResponse({ ok: true, lessons });
};
