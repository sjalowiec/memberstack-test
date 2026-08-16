import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  catalogVideoIsPublic,
  filterPublicCatalogVideos,
  findPublicCatalogVideoByContentId,
  normalizeVideoCatalogStatus,
  searchPublicCatalogVideos,
  type VideoCatalogRecord,
} from "./videoPublic";

const publishedLegacy: VideoCatalogRecord = {
  content_id: 100,
  slug: "legacy-video",
  title: "Legacy Video",
};

const draftVideo: VideoCatalogRecord = {
  content_id: 5001,
  slug: "change-colors-lk150",
  title: "Changing Colors on the LK150",
  status: "draft",
};

const archivedVideo: VideoCatalogRecord = {
  content_id: 900,
  slug: "old-video",
  title: "Old Video",
  status: "archived",
};

describe("normalizeVideoCatalogStatus", () => {
  it("defaults missing status to published", () => {
    expect(normalizeVideoCatalogStatus(undefined)).toBe("published");
    expect(normalizeVideoCatalogStatus("")).toBe("published");
  });
});

describe("catalogVideoIsPublic", () => {
  it("treats missing status as public", () => {
    expect(catalogVideoIsPublic(publishedLegacy)).toBe(true);
  });

  it("hides draft and archived videos", () => {
    expect(catalogVideoIsPublic(draftVideo)).toBe(false);
    expect(catalogVideoIsPublic(archivedVideo)).toBe(false);
  });

  it("treats legacy public alias as published", () => {
    expect(catalogVideoIsPublic({ content_id: 1, status: "public" })).toBe(true);
  });

  it("hides unknown status values", () => {
    expect(catalogVideoIsPublic({ content_id: 1, status: "pending" })).toBe(false);
  });
});

describe("filterPublicCatalogVideos", () => {
  it("excludes draft video 5001 and archived rows", () => {
    const rows = [publishedLegacy, draftVideo, archivedVideo];
    const publicRows = filterPublicCatalogVideos(rows);
    expect(publicRows).toEqual([publishedLegacy]);
    expect(publicRows.some((v) => String(v.content_id) === "5001")).toBe(false);
  });
});

describe("findPublicCatalogVideoByContentId", () => {
  it("does not return draft video 5001", () => {
    const rows = [publishedLegacy, draftVideo];
    expect(findPublicCatalogVideoByContentId(rows, 5001)).toBeUndefined();
    expect(findPublicCatalogVideoByContentId(rows, 100)).toEqual(publishedLegacy);
  });
});

describe("searchPublicCatalogVideos", () => {
  it("does not return draft videos in search results", () => {
    const rows = [publishedLegacy, draftVideo];
    const results = searchPublicCatalogVideos(rows, "change color");
    expect(results).toEqual([]);
  });

  it("returns published matches", () => {
    const rows = [
      publishedLegacy,
      { ...publishedLegacy, content_id: 101, title: "Change Color Basics" },
      draftVideo,
    ];
    const results = searchPublicCatalogVideos(rows, "change color");
    expect(results).toHaveLength(1);
    expect(results[0]?.content_id).toBe(101);
  });
});

describe("videos-public.json draft row 5001", () => {
  it("is marked draft and excluded from public catalog helpers", () => {
    const raw = readFileSync(join(process.cwd(), "src", "data", "videos-public.json"), "utf-8");
    const catalog = JSON.parse(raw) as VideoCatalogRecord[];
    const row = catalog.find((v) => String(v.content_id) === "5001");
    expect(row).toBeDefined();
    expect(normalizeVideoCatalogStatus(row?.status)).toBe("draft");
    expect(catalogVideoIsPublic(row!)).toBe(false);
    expect(findPublicCatalogVideoByContentId(catalog, 5001)).toBeUndefined();
    expect(searchPublicCatalogVideos(catalog, "change color").some((v) => String(v.content_id) === "5001")).toBe(
      false,
    );
  });
});
