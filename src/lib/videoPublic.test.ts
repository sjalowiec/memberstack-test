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

describe("videos-public.json shallow neckline, no shoulder shaping", () => {
  it("is published in Shaping / Garment Pieces and appears in catalog search", () => {
    const raw = readFileSync(join(process.cwd(), "src", "data", "videos-public.json"), "utf-8");
    const catalog = JSON.parse(raw) as Array<
      VideoCatalogRecord & {
        vimeo_id?: number;
        vimeo_hash?: string;
        access_level?: string;
        posterUrl?: string;
      }
    >;
    const row = catalog.find((v) => String(v.content_id) === "2212");
    expect(row).toBeDefined();
    expect(row?.slug).toBe("shallow-neckline-no-shoulder-shaping");
    expect(row?.title).toBe("Shallow Neckline, No Shoulder Shaping");
    expect(row?.description).toBe(
      "Shape a shallow round back neckline by binding off the center stitches and working simple decreases along each neck edge.",
    );
    expect(row?.category).toBe("Shaping");
    expect(row?.subcategory).toBe("Garment Pieces");
    expect(row?.access_level).toBe("public");
    expect(row?.vimeo_id).toBe(1218264661);
    expect(String(row?.posterUrl ?? "").trim()).toBe(
      "https://i.vimeocdn.com/video/2190141682-b3f54012dfdda2c25db9167881d2bb022817f23e071ed9a986e11ce42e0b64e6-d_1280x720?r=pad",
    );
    expect(row?.vimeo_hash).toBe("b1bc386c3c");
    expect(catalogVideoIsPublic(row!)).toBe(true);
    expect(findPublicCatalogVideoByContentId(catalog, 2212)).toEqual(row);

    const byTitle = searchPublicCatalogVideos(catalog, "shallow neckline");
    expect(byTitle.some((v) => String(v.content_id) === "2212")).toBe(true);
    const byDescription = searchPublicCatalogVideos(catalog, "no shoulder shaping");
    expect(byDescription.some((v) => String(v.content_id) === "2212")).toBe(true);
    const byCategoryQuery = searchPublicCatalogVideos(catalog, "garment pieces");
    expect(byCategoryQuery.some((v) => String(v.content_id) === "2212")).toBe(true);
  });

  it("uses the official Vimeo CDN poster and unlisted player hash without a share link", () => {
    const raw = readFileSync(join(process.cwd(), "src", "data", "videos-public.json"), "utf-8");
    const catalog = JSON.parse(raw) as Array<{
      content_id?: string | number;
      posterUrl?: string;
      vimeo_id?: number;
      vimeo_hash?: string;
    }>;
    const row = catalog.find((v) => String(v.content_id) === "2212");
    expect(row?.posterUrl).toMatch(/^https:\/\/i\.vimeocdn\.com\/video\//);
    expect(row?.posterUrl).toContain("_1280x720");
    expect(row?.vimeo_id).toBe(1218264661);
    expect(row?.vimeo_hash).toBe("b1bc386c3c");

    const detailPage = readFileSync(join(process.cwd(), "src", "pages", "videos", "[id].astro"), "utf-8");
    expect(detailPage).toContain("privacyHash={privacyHash}");
    expect(detailPage).toContain('vimeo_hash');
    expect(detailPage).not.toMatch(/href=["']https:\/\/vimeo\.com\//);

    const embed = readFileSync(
      join(process.cwd(), "src", "components", "videos", "GatedVimeoEmbed.astro"),
      "utf-8",
    );
    expect(embed).toContain('searchParams.set("h", privacyHash)');
    expect(embed).toContain("data-iframe-src={iframeSrc}");
    expect(embed).not.toMatch(/href=["']https:\/\/vimeo\.com\//);
  });
});
