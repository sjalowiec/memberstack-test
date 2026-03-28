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

function parseTipSortOrder(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const n = parseInt(value.trim(), 10);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/** Next `sortOrder` for a newly created tip: max existing + 10, or 10 when the file is empty. */
export function nextHelpHubSortOrder(tips: Record<string, unknown>[]): number {
  if (tips.length === 0) return 10;
  let max = 0;
  for (const t of tips) {
    const n = parseTipSortOrder(t.sortOrder);
    if (n !== null) max = Math.max(max, n);
  }
  return max + 10;
}

/** Stable ascending sort by `sortOrder`; tips without `sortOrder` sort last, then by id. */
export function sortHelpHubTipsBySortOrder(tips: Record<string, unknown>[]): Record<string, unknown>[] {
  return [...tips].sort((a, b) => {
    const na = parseTipSortOrder(a.sortOrder);
    const nb = parseTipSortOrder(b.sortOrder);
    const sa = na ?? Number.POSITIVE_INFINITY;
    const sb = nb ?? Number.POSITIVE_INFINITY;
    if (sa !== sb) return sa - sb;
    const ida = getTipId(a);
    const idb = getTipId(b);
    return (ida ?? 0) - (idb ?? 0);
  });
}

/** Normalize `relatedLessons` from API/admin payloads (slug strings). */
export function normalizeRelatedLessons(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((s) => String(s).trim())
    .filter((s) => s.length > 0);
}

/** Remove deprecated tip fields so saves stay aligned with the current schema. */
export function stripLegacyHelpHubTipFields(row: Record<string, unknown>): void {
  delete row.relatedLessonId;
  delete row.relatedLesson;
  delete row.lessonCta;
  delete row.lessonIDs;
}
