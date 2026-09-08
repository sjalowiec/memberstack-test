import { describe, expect, it } from "vitest";
import type { WatsonQueryFn } from "../watson/memberSearch";
import {
  getMemberLessonBySlug,
  insertMemberLesson,
  listMemberLessonsForAdmin,
  listPublicMemberLessons,
  nextMemberLessonDatabaseId,
  softDeleteMemberLesson,
  updateMemberLesson,
} from "./store";
import type { MemberLessonRow } from "./types";

function createMemoryQuery(): { queryFn: WatsonQueryFn; rows: MemberLessonRow[] } {
  const rows: MemberLessonRow[] = [];
  const queryFn: WatsonQueryFn = async (sql, params = []) => {
    if (sql.includes("COALESCE(MAX(id)")) {
      const max = rows.reduce((m, r) => Math.max(m, r.id), 5000);
      return [{ max_id: max }] as never;
    }
    if (sql.includes("INSERT INTO member_lessons")) {
      const [id, slug, status, title, category, documentJson, updatedBy] = params;
      const numericId = Number(id);
      if (rows.some((r) => r.slug.toLowerCase() === String(slug).toLowerCase() && r.id !== numericId)) {
        throw Object.assign(new Error("duplicate slug"), { code: "23505" });
      }
      const document = JSON.parse(String(documentJson));
      const next: MemberLessonRow = {
        id: numericId,
        slug: String(slug),
        status: String(status),
        title: (title as string | null) ?? null,
        category: (category as string | null) ?? null,
        document,
        created_at: new Date("2026-09-08T00:00:00Z"),
        updated_at: new Date("2026-09-08T00:00:00Z"),
        updated_by: (updatedBy as string | null) ?? null,
        deleted_at: null,
      };
      const idx = rows.findIndex((r) => r.id === numericId);
      if (idx >= 0) {
        next.created_at = rows[idx].created_at;
        rows[idx] = next;
        return [rows[idx]] as never;
      }
      rows.push(next);
      return [next] as never;
    }
    if (sql.includes("UPDATE member_lessons SET") && sql.includes("deleted_at = NOW()")) {
      const id = Number(params[0]);
      const updatedBy = params[1] as string | null;
      const row = rows.find((r) => r.id === id && r.deleted_at == null);
      if (!row) return [] as never;
      row.deleted_at = new Date("2026-09-08T12:00:00Z");
      row.updated_by = updatedBy;
      return [row] as never;
    }
    if (sql.includes("UPDATE member_lessons SET") && sql.includes("document = $6")) {
      const id = Number(params[0]);
      const row = rows.find((r) => r.id === id && r.deleted_at == null);
      if (!row) return [] as never;
      if (rows.some((r) => r.slug.toLowerCase() === String(params[1]).toLowerCase() && r.id !== id)) {
        throw Object.assign(new Error("duplicate slug"), { code: "23505" });
      }
      row.slug = String(params[1]);
      row.status = String(params[2]);
      row.title = (params[3] as string | null) ?? null;
      row.category = (params[4] as string | null) ?? null;
      row.document = JSON.parse(String(params[5]));
      row.updated_by = (params[6] as string | null) ?? null;
      return [row] as never;
    }
    if (sql.includes("lower(slug) = lower($1)")) {
      const slug = String(params[0]).toLowerCase();
      return rows.filter((r) => r.slug.toLowerCase() === slug && r.deleted_at == null) as never;
    }
    if (sql.includes("WHERE id = $1") && sql.includes("deleted_at IS NULL")) {
      const id = Number(params[0]);
      return rows.filter((r) => r.id === id && r.deleted_at == null) as never;
    }
    if (sql.includes("lower(status) = 'published'")) {
      return rows.filter((r) => r.deleted_at == null && r.status === "published") as never;
    }
    if (sql.includes("WHERE deleted_at IS NULL")) {
      return rows.filter((r) => r.deleted_at == null) as never;
    }
    return rows as never;
  };
  return { queryFn, rows };
}

const actor = { email: "sue@knititnow.com" };

describe("Member lesson postgres store", () => {
  it("creates, updates, unpublishes, and soft-deletes without exposing drafts publicly", async () => {
    const { queryFn } = createMemoryQuery();
    const created = await insertMemberLesson(
      { intro: "Unsaved intro", blocks: [{ type: "text", content: "Hello" }] },
      {
        id: 5004,
        slug: "new-member-lesson",
        status: "draft",
        title: "New Member Lesson",
        category: "lk150",
      },
      actor,
      queryFn,
    );
    expect(created.status).toBe("draft");
    expect(created.intro).toBe("Unsaved intro");
    expect(await listPublicMemberLessons(queryFn)).toEqual([]);

    const published = await updateMemberLesson(
      5004,
      created,
      {
        slug: "new-member-lesson",
        status: "published",
        title: created.title as string,
        category: "lk150",
      },
      actor,
      queryFn,
    );
    expect(published?.status).toBe("published");
    expect((await listPublicMemberLessons(queryFn)).map((l) => l.slug)).toEqual(["new-member-lesson"]);

    const unpublished = await updateMemberLesson(
      5004,
      published!,
      {
        slug: "new-member-lesson",
        status: "draft",
        title: created.title as string,
        category: "lk150",
      },
      actor,
      queryFn,
    );
    expect(unpublished?.status).toBe("draft");
    expect(await listPublicMemberLessons(queryFn)).toEqual([]);

    const deleted = await softDeleteMemberLesson(5004, actor, queryFn);
    expect(deleted?.deletedAt).toBeTruthy();
    expect(await getMemberLessonBySlug("new-member-lesson", queryFn)).toBeNull();
    expect(await listMemberLessonsForAdmin(queryFn)).toEqual([]);
  });

  it("assigns the next unused numeric id after existing 5003", async () => {
    const { queryFn } = createMemoryQuery();
    await insertMemberLesson(
      {},
      { id: 5003, slug: "end-needle-slip-lk150", status: "published", title: "Slip", category: "" },
      actor,
      queryFn,
    );
    expect(await nextMemberLessonDatabaseId(queryFn)).toBe(5004);
  });

  it("hides soft-deleted rows from admin lists unless includeDeleted is set", async () => {
    const { queryFn } = createMemoryQuery();
    await insertMemberLesson(
      {},
      { id: 5005, slug: "gone", status: "draft", title: "Gone", category: "" },
      actor,
      queryFn,
    );
    await softDeleteMemberLesson(5005, actor, queryFn);
    expect(await listMemberLessonsForAdmin(queryFn)).toEqual([]);
    expect(await listMemberLessonsForAdmin(queryFn, { includeDeleted: true })).toHaveLength(1);
  });

  it("rejects a duplicate slug", async () => {
    const { queryFn } = createMemoryQuery();
    await insertMemberLesson(
      {},
      { id: 1, slug: "same-slug", status: "draft", title: "One", category: "" },
      actor,
      queryFn,
    );
    await expect(
      insertMemberLesson(
        {},
        { id: 2, slug: "same-slug", status: "draft", title: "Two", category: "" },
        actor,
        queryFn,
      ),
    ).rejects.toMatchObject({ code: "23505" });
  });
});
