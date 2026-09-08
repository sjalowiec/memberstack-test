import { describe, expect, it } from "vitest";
import type { WatsonQueryFn } from "../watson/memberSearch";
import {
  getHelpHubTipBySlug,
  insertHelpHubTip,
  listHelpHubTipsForAdmin,
  listPublicHelpHubTips,
  nextHelpHubDatabaseId,
  softDeleteHelpHubTip,
  updateHelpHubTip,
} from "./store";
import type { HelpHubTipRow } from "./types";
import { helpHubTipIsPublic } from "../helpHubPublic";

function createMemoryQuery(): { queryFn: WatsonQueryFn; rows: HelpHubTipRow[] } {
  const rows: HelpHubTipRow[] = [];
  const queryFn: WatsonQueryFn = async (sql, params = []) => {
    if (sql.includes("COALESCE(MAX(id)")) {
      const max = rows.reduce((m, r) => Math.max(m, r.id), 999);
      return [{ max_id: max }] as never;
    }
    if (sql.includes("INSERT INTO help_hub_tips")) {
      const [
        id,
        slug,
        status,
        sortOrder,
        category,
        title,
        question,
        isNew,
        featured,
        documentJson,
        updatedBy,
      ] = params;
      const numericId = Number(id);
      if (rows.some((r) => r.slug.toLowerCase() === String(slug).toLowerCase() && r.id !== numericId)) {
        const err = Object.assign(new Error("duplicate slug"), { code: "23505" });
        throw err;
      }
      const document = JSON.parse(String(documentJson));
      const next: HelpHubTipRow = {
        id: numericId,
        slug: String(slug),
        status: String(status),
        sort_order: (sortOrder as number | null) ?? null,
        category: (category as string | null) ?? null,
        title: (title as string | null) ?? null,
        question: (question as string | null) ?? null,
        is_new: (isNew as boolean | null) ?? null,
        featured: (featured as boolean | null) ?? null,
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
    if (sql.includes("UPDATE help_hub_tips SET") && sql.includes("deleted_at = NOW()")) {
      const id = Number(params[0]);
      const updatedBy = params[1] as string | null;
      const row = rows.find((r) => r.id === id && r.deleted_at == null);
      if (!row) return [] as never;
      row.deleted_at = new Date("2026-09-08T12:00:00Z");
      row.updated_by = updatedBy;
      return [row] as never;
    }
    if (sql.includes("UPDATE help_hub_tips SET") && sql.includes("document = $10")) {
      const id = Number(params[0]);
      const row = rows.find((r) => r.id === id && r.deleted_at == null);
      if (!row) return [] as never;
      if (rows.some((r) => r.slug.toLowerCase() === String(params[1]).toLowerCase() && r.id !== id)) {
        throw Object.assign(new Error("duplicate slug"), { code: "23505" });
      }
      row.slug = String(params[1]);
      row.status = String(params[2]);
      row.sort_order = (params[3] as number | null) ?? null;
      row.category = (params[4] as string | null) ?? null;
      row.title = (params[5] as string | null) ?? null;
      row.question = (params[6] as string | null) ?? null;
      row.is_new = (params[7] as boolean | null) ?? null;
      row.featured = (params[8] as boolean | null) ?? null;
      row.document = JSON.parse(String(params[9]));
      row.updated_by = (params[10] as string | null) ?? null;
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

describe("Help Hub postgres store", () => {
  it("creates, updates, unpublishes, and soft-deletes without exposing drafts publicly", async () => {
    const { queryFn } = createMemoryQuery();
    const created = await insertHelpHubTip(
      {
        question: "Where can I find patterns for my LK150?",
        relatedLessons: [259, 368],
        bubbleAnswer: "Gauge matters.",
      },
      {
        id: 1008,
        slug: "patterns-for-lk150",
        status: "draft",
        title: "Where can I find patterns for my LK150?",
        category: "pattern-design-confusion",
      },
      actor,
      queryFn,
    );
    expect(created.status).toBe("draft");
    expect(created.relatedLessons).toEqual([259, 368]);
    expect(await listPublicHelpHubTips(queryFn)).toEqual([]);
    expect(helpHubTipIsPublic(created)).toBe(false);

    const published = await updateHelpHubTip(
      1008,
      created,
      {
        slug: "patterns-for-lk150",
        status: "published",
        title: created.title as string,
        category: "pattern-design-confusion",
      },
      actor,
      queryFn,
    );
    expect(published?.status).toBe("published");
    expect((await listPublicHelpHubTips(queryFn)).map((t) => t.slug)).toEqual(["patterns-for-lk150"]);

    const unpublished = await updateHelpHubTip(
      1008,
      published!,
      {
        slug: "patterns-for-lk150",
        status: "draft",
        title: created.title as string,
        category: "pattern-design-confusion",
      },
      actor,
      queryFn,
    );
    expect(unpublished?.status).toBe("draft");
    expect(await listPublicHelpHubTips(queryFn)).toEqual([]);

    const deleted = await softDeleteHelpHubTip(1008, actor, queryFn);
    expect(deleted?.deletedAt).toBeTruthy();
    expect(await getHelpHubTipBySlug("patterns-for-lk150", queryFn)).toBeNull();
    expect(await listHelpHubTipsForAdmin(queryFn)).toEqual([]);
    expect(helpHubTipIsPublic(deleted!)).toBe(false);
  });

  it("assigns the next unused numeric id", async () => {
    const { queryFn } = createMemoryQuery();
    await insertHelpHubTip(
      { slug: "a" },
      { id: 1010, slug: "a", status: "draft", title: "A", category: "getting-started" },
      actor,
      queryFn,
    );
    expect(await nextHelpHubDatabaseId(queryFn)).toBe(1011);
  });

  it("hides soft-deleted rows from admin lists unless includeDeleted is set", async () => {
    const { queryFn } = createMemoryQuery();
    await insertHelpHubTip(
      { slug: "gone" },
      { id: 1012, slug: "gone", status: "draft", title: "Gone", category: "getting-started" },
      actor,
      queryFn,
    );
    await softDeleteHelpHubTip(1012, actor, queryFn);
    expect(await listHelpHubTipsForAdmin(queryFn)).toEqual([]);
    expect(await listHelpHubTipsForAdmin(queryFn, { includeDeleted: true })).toHaveLength(1);
  });

  it("rejects a duplicate slug", async () => {
    const { queryFn } = createMemoryQuery();
    await insertHelpHubTip(
      {},
      { id: 1, slug: "same-slug", status: "draft", title: "One", category: "getting-started" },
      actor,
      queryFn,
    );
    await expect(
      insertHelpHubTip(
        {},
        { id: 2, slug: "same-slug", status: "draft", title: "Two", category: "getting-started" },
        actor,
        queryFn,
      ),
    ).rejects.toMatchObject({ code: "23505" });
  });
});
