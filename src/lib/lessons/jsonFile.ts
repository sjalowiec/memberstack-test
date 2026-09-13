import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { LessonDocument } from "./types";

export const LESSONS_JSON_PATH = join(process.cwd(), "src", "data", "lessons.json");

export function readLessonsFile(): LessonDocument[] {
  const raw = readFileSync(LESSONS_JSON_PATH, "utf-8");
  const data = JSON.parse(raw) as unknown;
  if (!Array.isArray(data)) {
    throw new Error("lessons.json must contain a JSON array.");
  }
  return data.filter(
    (row): row is LessonDocument => row !== null && typeof row === "object" && !Array.isArray(row),
  );
}

export function writeLessonsFile(rows: LessonDocument[]): void {
  writeFileSync(LESSONS_JSON_PATH, JSON.stringify(rows, null, 2), "utf-8");
}

export function getLessonId(row: Record<string, unknown>): number | null {
  const v = row.id;
  if (typeof v === "number" && Number.isFinite(v)) return Math.floor(v);
  if (typeof v === "string" && v.trim()) {
    const n = parseInt(v.trim(), 10);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export function nextLessonId(lessons: Record<string, unknown>[]): number {
  const ids = lessons
    .map((row) => getLessonId(row))
    .filter((n): n is number => n != null);
  const max = ids.length ? Math.max(...ids) : 5000;
  return Math.max(max, 5000) + 1;
}

export function sortLessonsById(lessons: Record<string, unknown>[]): Record<string, unknown>[] {
  return [...lessons].sort((a, b) => (getLessonId(a) ?? 0) - (getLessonId(b) ?? 0));
}
