import { describe, expect, it } from "vitest";
import {
  buildGlossaryRelatedVideosHtml,
  effectiveCatalogVideoAccess,
  glossaryInternalVideoIdList,
  resolveGlossaryCatalogVideos,
} from "./glossaryCatalogVideos";
import type { PublicVideoRow } from "../lessonVideo";

describe("glossaryInternalVideoIdList", () => {
  it("prefers videoIds over vimeoIds", () => {
    expect(
      glossaryInternalVideoIdList({
        videoIds: ["10"],
        vimeoIds: ["20"],
      }),
    ).toEqual(["10"]);
  });

  it("reads vimeoIds when videoIds absent", () => {
    expect(glossaryInternalVideoIdList({ vimeoIds: ["811", "811", "812"] })).toEqual(["811", "812"]);
  });
});

describe("effectiveCatalogVideoAccess", () => {
  it("treats featured tip as open", () => {
    expect(effectiveCatalogVideoAccess({ access_level: "member", isTipOfWeek: true })).toBe("open");
  });

  it("respects access_level", () => {
    expect(effectiveCatalogVideoAccess({ access_level: "open" })).toBe("open");
    expect(effectiveCatalogVideoAccess({ access_level: "member" })).toBe("member");
    expect(effectiveCatalogVideoAccess({})).toBe("member");
  });
});

describe("resolveGlossaryCatalogVideos", () => {
  const catalog: PublicVideoRow[] = [
    { content_id: 811, title: "Short Row Refresher", vimeo_id: 251895484, access_level: "open" },
    { content_id: 812, title: "Locked", vimeo_id: 999, access_level: "member" },
  ];

  it("resolves catalog row for internal id 811 and uses modal when open + vimeo", () => {
    const rows = resolveGlossaryCatalogVideos({ vimeoIds: ["811"] }, catalog);
    expect(rows).toHaveLength(1);
    expect(rows[0].contentId).toBe("811");
    expect(rows[0].vimeoNumericId).toBe("251895484");
    expect(rows[0].access).toBe("open");
    expect(rows[0].useModal).toBe(true);
  });

  it("uses video page for member rows", () => {
    const rows = resolveGlossaryCatalogVideos({ vimeoIds: ["812"] }, catalog);
    expect(rows[0].useModal).toBe(false);
    expect(rows[0].access).toBe("member");
  });

  it("uses video page without lock when open but missing vimeo id", () => {
    const sparse: PublicVideoRow[] = [{ content_id: 1, title: "No vimeo", access_level: "open" }];
    const rows = resolveGlossaryCatalogVideos({ vimeoIds: ["1"] }, sparse);
    expect(rows[0].useModal).toBe(false);
    expect(rows[0].access).toBe("open");
    const html = buildGlossaryRelatedVideosHtml({ vimeoIds: ["1"] }, sparse);
    expect(html).toContain('href="/videos/1"');
    expect(html).not.toContain("Members only");
  });
});

describe("buildGlossaryRelatedVideosHtml", () => {
  it("includes Related video heading for one item", () => {
    const catalog: PublicVideoRow[] = [
      { content_id: 811, title: "T", vimeo_id: 251895484, access_level: "open" },
    ];
    const html = buildGlossaryRelatedVideosHtml({ vimeoIds: ["811"] }, catalog);
    expect(html).toContain("Related video");
    expect(html).toContain("kbm-kin-catalog-video");
    expect(html).toContain('data-vimeo-id="251895484"');
    expect(html).not.toContain('href="/videos/811"');
  });

  it("embeds data-video-chapters JSON on modal triggers when the catalog row has chapters", () => {
    const catalog: PublicVideoRow[] = [
      {
        content_id: 535,
        title: "Easy Round Neck",
        vimeo_id: 151858551,
        access_level: "open",
        chapters: [{ label: "Sample overview", time: 44 }],
      },
    ];
    const html = buildGlossaryRelatedVideosHtml({ vimeoIds: ["535"] }, catalog);
    expect(html).toContain("data-video-chapters=");
    expect(html).toContain("Sample overview");
    expect(html).toContain("44");
  });

  it("links member catalog rows to /videos/{id}", () => {
    const catalog: PublicVideoRow[] = [
      { content_id: 812, title: "Member clip", vimeo_id: 252258022, access_level: "member" },
    ];
    const html = buildGlossaryRelatedVideosHtml({ vimeoIds: ["812"] }, catalog);
    expect(html).toContain('href="/videos/812"');
    expect(html).toContain("Members only");
    expect(html).not.toContain("kbm-kin-catalog-video");
  });
});
