import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { importLessonDocuments, validateLessonSnapshot } from "./importFromJson";
import { documentsMatch } from "./document";
import { listMemberLessonsForAdmin, listPublicMemberLessons } from "./store";
import { lessonStatusFromDocument } from "./document";
import type { LessonDocument, MemberLessonRow } from "./types";
import type { WatsonQueryFn } from "../watson/memberSearch";

function createMemoryQuery(): WatsonQueryFn {
  const rows: MemberLessonRow[] = [];
  return async (sql, params = []) => {
    if (sql.includes("INSERT INTO member_lessons")) {
      const document = JSON.parse(String(params[5]));
      const id = Number(params[0]);
      const slug = String(params[1]);
      if (rows.some((r) => r.slug.toLowerCase() === slug.toLowerCase() && r.id !== id)) {
        throw Object.assign(new Error("duplicate slug"), { code: "23505" });
      }
      const next: MemberLessonRow = {
        id,
        slug,
        status: String(params[2]),
        title: (params[3] as string | null) ?? null,
        category: (params[4] as string | null) ?? null,
        document,
        created_at: new Date(),
        updated_at: new Date(),
        updated_by: (params[6] as string | null) ?? null,
        deleted_at: null,
      };
      const idx = rows.findIndex((r) => r.id === id);
      if (idx >= 0) rows[idx] = { ...next, created_at: rows[idx].created_at };
      else rows.push(next);
      return [idx >= 0 ? rows[idx] : next] as never;
    }
    if (sql.includes("lower(status) = 'published'")) {
      return rows.filter((r) => r.deleted_at == null && r.status === "published") as never;
    }
    if (sql.includes("WHERE deleted_at IS NULL")) {
      return rows.filter((r) => r.deleted_at == null) as never;
    }
    return rows as never;
  };
}

const snapshot = JSON.parse(
  readFileSync(join(dirname(fileURLToPath(import.meta.url)), "..", "..", "data", "lessons.json"), "utf8"),
) as LessonDocument[];

describe("Lesson JSON importer", () => {
  it("validates unique ids and slugs and does not include unfinished 5004", () => {
    const report = validateLessonSnapshot(snapshot);
    expect(report.errors).toEqual([]);
    expect(report.uniqueIds).toBe(true);
    expect(report.uniqueSlugs).toBe(true);
    expect(report.ids).toHaveLength(8);
    expect(snapshot.find((l) => l.id === 5004)).toBeUndefined();
    expect(report.ids).toEqual([101, 102, 103, 104, 105, 5001, 5002, 5003]);
  });

  it("round-trips every snapshot document by slug", async () => {
    const queryFn = createMemoryQuery();
    const report = await importLessonDocuments(snapshot, queryFn);
    expect(report.expectedCount).toBe(8);
    expect(report.upsertedCount).toBe(8);
    expect(report.roundTripFailures).toEqual([]);
    const imported = await listMemberLessonsForAdmin(queryFn);
    expect(imported).toHaveLength(8);
    for (const original of snapshot) {
      const match = imported.find((l) => l.slug === original.slug);
      expect(match).toBeTruthy();
      const comparable: LessonDocument = { ...match };
      if (!Object.prototype.hasOwnProperty.call(original, "status")) {
        delete comparable.status;
      }
      expect(documentsMatch(original, comparable)).toBe(true);
      expect(match?.status).toBe(lessonStatusFromDocument(original));
    }
    const publicLessons = await listPublicMemberLessons(queryFn);
    expect(publicLessons.every((l) => l.status === "published")).toBe(true);
    expect(publicLessons).toHaveLength(8);
  });

  it("is idempotent when run twice", async () => {
    const queryFn = createMemoryQuery();
    await importLessonDocuments(snapshot, queryFn);
    const second = await importLessonDocuments(snapshot, queryFn);
    expect(second.upsertedCount).toBe(8);
    expect(second.roundTripFailures).toEqual([]);
    expect(await listMemberLessonsForAdmin(queryFn)).toHaveLength(8);
  });
});
