import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export const HELP_HUB_JSON_PATH = join(process.cwd(), "src", "data", "help-hub.json");
export const LESSONS_JSON_PATH = join(process.cwd(), "src", "data", "lessons.json");

export function readHelpHubFile(): Record<string, unknown>[] {
  const raw = readFileSync(HELP_HUB_JSON_PATH, "utf-8");
  const data = JSON.parse(raw) as unknown;
  if (!Array.isArray(data)) {
    throw new Error("help-hub.json must contain a JSON array.");
  }
  return data.filter((row): row is Record<string, unknown> => row !== null && typeof row === "object");
}

export function writeHelpHubFile(rows: Record<string, unknown>[]): void {
  writeFileSync(HELP_HUB_JSON_PATH, JSON.stringify(rows, null, 2), "utf-8");
}

export function readLessonsForAdmin(): { id: number; slug: string }[] {
  try {
    const raw = readFileSync(LESSONS_JSON_PATH, "utf-8");
    const data = JSON.parse(raw) as unknown;
    if (!Array.isArray(data)) return [];
    return data
      .filter((row): row is Record<string, unknown> => row !== null && typeof row === "object")
      .map((row) => {
        const id = typeof row.id === "number" ? row.id : parseInt(String(row.id), 10);
        const slug = typeof row.slug === "string" ? row.slug : "";
        return { id: Number.isFinite(id) ? id : NaN, slug };
      })
      .filter((l) => Number.isFinite(l.id) && l.slug);
  } catch {
    return [];
  }
}

export function nextHelpHubId(tips: Record<string, unknown>[]): number {
  if (tips.length === 0) return 1000;
  const ids = tips
    .map((t) => {
      const v = t.id;
      if (typeof v === "number" && Number.isFinite(v)) return v;
      if (typeof v === "string" && v.trim()) return parseInt(v.trim(), 10);
      return NaN;
    })
    .filter((n) => Number.isFinite(n));
  if (ids.length === 0) return 1000;
  return Math.max(...ids) + 1;
}

export function getTipId(row: Record<string, unknown>): number | null {
  const v = row.id;
  if (typeof v === "number" && Number.isFinite(v)) return Math.floor(v);
  if (typeof v === "string" && v.trim()) {
    const n = parseInt(v.trim(), 10);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export function syncRelatedLessonSlug(
  row: Record<string, unknown>,
  lessons: { id: number; slug: string }[]
): void {
  const raw = row.relatedLessonId;
  if (raw === null || raw === undefined || raw === "") {
    delete row.relatedLessonId;
    delete row.relatedLesson;
    return;
  }
  const id = typeof raw === "number" ? raw : parseInt(String(raw), 10);
  if (!Number.isFinite(id)) {
    delete row.relatedLessonId;
    delete row.relatedLesson;
    return;
  }
  row.relatedLessonId = id;
  const lesson = lessons.find((l) => l.id === id);
  if (lesson?.slug) {
    row.relatedLesson = lesson.slug;
  } else {
    delete row.relatedLesson;
  }
}
