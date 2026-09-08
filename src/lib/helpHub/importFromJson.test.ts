import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { importHelpHubDocuments, validateHelpHubSnapshot } from "./importFromJson";
import { documentsMatch } from "./document";
import { listHelpHubTipsForAdmin, listPublicHelpHubTips } from "./store";
import type { HelpHubTipDocument, HelpHubTipRow } from "./types";
import type { WatsonQueryFn } from "../watson/memberSearch";

function createMemoryQuery(): WatsonQueryFn {
  const rows: HelpHubTipRow[] = [];
  return async (sql, params = []) => {
    if (sql.includes("INSERT INTO help_hub_tips")) {
      const document = JSON.parse(String(params[9]));
      const id = Number(params[0]);
      const slug = String(params[1]);
      if (rows.some((r) => r.slug.toLowerCase() === slug.toLowerCase() && r.id !== id)) {
        throw Object.assign(new Error("duplicate slug"), { code: "23505" });
      }
      const next: HelpHubTipRow = {
        id,
        slug,
        status: String(params[2]),
        sort_order: (params[3] as number | null) ?? null,
        category: (params[4] as string | null) ?? null,
        title: (params[5] as string | null) ?? null,
        question: (params[6] as string | null) ?? null,
        is_new: (params[7] as boolean | null) ?? null,
        featured: (params[8] as boolean | null) ?? null,
        document,
        created_at: new Date(),
        updated_at: new Date(),
        updated_by: (params[10] as string | null) ?? null,
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
  readFileSync(join(dirname(fileURLToPath(import.meta.url)), "..", "..", "data", "help-hub.json"), "utf8"),
) as HelpHubTipDocument[];

describe("Help Hub JSON importer", () => {
  it("validates unique ids and slugs on the cleaned snapshot", () => {
    const report = validateHelpHubSnapshot(snapshot);
    expect(report.errors).toEqual([]);
    expect(report.uniqueIds).toBe(true);
    expect(report.uniqueSlugs).toBe(true);
    expect(report.ids).toHaveLength(10);
    expect(snapshot.find((t) => t.slug === "choosing-a-knitting-machine99")).toBeUndefined();
    const lk = snapshot.find((t) => t.slug === "patterns-for-lk150");
    expect(lk?.status).toBe("draft");
    expect(lk?.relatedLessons).toEqual([259, 368]);
    expect(lk && "bridge" in lk).toBe(false);
    expect(snapshot.find((t) => t.slug === "how-do-i-knit-tuck-stitch-on-my-lk150")?.id).toBe(1009);
    expect(snapshot.find((t) => t.slug === "slip-stitch-on-the-lk150")?.id).toBe(1010);
  });

  it("round-trips every snapshot document by slug", async () => {
    const queryFn = createMemoryQuery();
    const report = await importHelpHubDocuments(snapshot, queryFn);
    expect(report.expectedCount).toBe(10);
    expect(report.upsertedCount).toBe(10);
    expect(report.roundTripFailures).toEqual([]);
    const imported = await listHelpHubTipsForAdmin(queryFn);
    expect(imported).toHaveLength(10);
    for (const original of snapshot) {
      const match = imported.find((t) => t.slug === original.slug);
      expect(match).toBeTruthy();
      expect(documentsMatch(original, match!)).toBe(true);
    }
    const publicTips = await listPublicHelpHubTips(queryFn);
    expect(publicTips.every((t) => t.status === "published")).toBe(true);
    expect(publicTips.some((t) => t.slug === "patterns-for-lk150")).toBe(false);
  });

  it("is idempotent when run twice", async () => {
    const queryFn = createMemoryQuery();
    await importHelpHubDocuments(snapshot, queryFn);
    const second = await importHelpHubDocuments(snapshot, queryFn);
    expect(second.upsertedCount).toBe(10);
    expect(second.roundTripFailures).toEqual([]);
    expect(await listHelpHubTipsForAdmin(queryFn)).toHaveLength(10);
  });
});
