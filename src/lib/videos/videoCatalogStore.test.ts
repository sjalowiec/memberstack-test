import { describe, expect, it } from "vitest";
import {
  applyVideoCatalogWrites,
  mergeVideoCatalog,
  planVideoCatalogWrites,
  VIDEO_CATALOG_DELETE_SQL,
  VIDEO_CATALOG_TOMBSTONE_SQL,
  VIDEO_CATALOG_UPSERT_SQL,
  type VideoCatalogWrite,
} from "./videoCatalogStore";

const fileVideos = [
  { content_id: 706, slug: "kept", title: "Kept", vimeo_id: 11, access_level: "member" },
  { content_id: "249-1", slug: "clip", title: "Clip", vimeo_id: 22, access_level: "member" },
];

function normalizeSubmitted(videos: Array<Record<string, unknown>>) {
  return videos.map((video) => ({
    ...video,
    isTipOfWeek: false,
    tipOfWeek: false,
    search_ready: false,
  }));
}

describe("video catalog database edits", () => {
  it("keeps the deployed catalog until an edit is stored", () => {
    expect(mergeVideoCatalog(fileVideos, [])).toEqual(fileVideos);
  });

  it("overrides one video, appends a new one, and hides a removed file video", () => {
    const merged = mergeVideoCatalog(fileVideos, [
      {
        contentId: "706",
        deleted: false,
        sortOrder: 0,
        document: { content_id: 706, slug: "kept", title: "Kept renamed", vimeo_id: 11 },
      },
      {
        contentId: "249-1",
        deleted: true,
        sortOrder: 0,
        document: null,
      },
      {
        contentId: "5003",
        deleted: false,
        sortOrder: 2,
        document: { content_id: 5003, slug: "new-video", title: "New", vimeo_id: 33, status: "published" },
      },
    ]);
    expect(merged.map((row) => (row as { content_id: unknown }).content_id)).toEqual([706, 5003]);
    expect((merged[0] as { title: string }).title).toBe("Kept renamed");
  });

  it("does not store a file row that was submitted without normalized fields", () => {
    const plan = planVideoCatalogWrites(fileVideos, fileVideos, ["706"]);
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(plan.writes).toEqual([{ op: "delete", contentId: "706" }]);
  });

  it("stores a new or changed video and does not rewrite an unchanged file row", () => {
    const submitted = normalizeSubmitted([
      { ...fileVideos[0], title: "Kept renamed" },
      { ...fileVideos[1] },
      { content_id: 5003, slug: "new-video", title: "New", vimeo_id: 33, status: "draft", access_level: "member" },
    ]);
    const plan = planVideoCatalogWrites(fileVideos, submitted, []);
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(plan.writes).toEqual([
      {
        op: "upsert",
        contentId: "706",
        sortOrder: 0,
        document: submitted[0],
      },
      {
        op: "upsert",
        contentId: "5003",
        sortOrder: 2,
        document: submitted[2],
      },
    ]);
  });

  it("hides a removed file video and drops a stored video that was deleted", () => {
    const submitted = normalizeSubmitted([{ ...fileVideos[0] }]);
    const plan = planVideoCatalogWrites(fileVideos, submitted, ["5003", "706"]);
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(plan.writes).toEqual([
      { op: "delete", contentId: "706" },
      { op: "tombstone", contentId: "249-1" },
      { op: "delete", contentId: "5003" },
    ]);
  });

  it("refuses to empty the catalog", () => {
    const plan = planVideoCatalogWrites(fileVideos, [], []);
    expect(plan.ok).toBe(false);
  });

  it("writes edits with parameters and does not send the whole catalog file", async () => {
    const calls: Array<{ sql: string; params: unknown[] }> = [];
    const writes: VideoCatalogWrite[] = [
      { op: "upsert", contentId: "5003", sortOrder: 2, document: { content_id: 5003, title: "New" } },
      { op: "tombstone", contentId: "249-1" },
      { op: "delete", contentId: "706" },
    ];
    await applyVideoCatalogWrites(writes, async (sql, params = []) => {
      calls.push({ sql, params });
      return [];
    });
    expect(calls.map((call) => call.sql)).toEqual([
      VIDEO_CATALOG_UPSERT_SQL,
      VIDEO_CATALOG_TOMBSTONE_SQL,
      VIDEO_CATALOG_DELETE_SQL,
    ]);
    expect(calls[0]?.params[0]).toBe("5003");
    expect(JSON.parse(String(calls[0]?.params[1]))).toMatchObject({ title: "New" });
    expect(calls[1]?.params).toEqual(["249-1"]);
    expect(calls[2]?.params).toEqual(["706"]);
  });
});
