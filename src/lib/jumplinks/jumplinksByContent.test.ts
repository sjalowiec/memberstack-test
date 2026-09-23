import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import videosRaw from "../../data/videos-public.json";
import { catalogChaptersFromVideoRow } from "../catalogVideoChapters";
import { filterPublicCatalogVideos, findPublicCatalogVideoByContentId } from "../videoPublic";
import {
  jumplinksByContentId,
  resolveVideoDetailJumpLinks,
} from "./jumplinksByContent";
import {
  parseAuthorizedJumpLinks,
  renderVideoJumpLinkButtons,
} from "./videoJumpLinkButtons";

const ICORD_LINKS = [
  { time: 36, label: "Slip stitch on your machine" },
  { time: 43, label: "Pick up and knit I-cord" },
  { time: 64, label: "Turn a corner" },
  { time: 80, label: "Loop Trim" },
  { time: 112, label: "Helecopter trim (give it a twist)" },
];

describe("jumplinksByContentId", () => {
  it("returns the five I-Cord Trims links for content 266", () => {
    expect(jumplinksByContentId(266)).toEqual(ICORD_LINKS);
    expect(jumplinksByContentId("266")).toEqual(ICORD_LINKS);
  });
});

describe("resolveVideoDetailJumpLinks precedence", () => {
  it("prefers catalog chapters over jumpLinks and migrated data", () => {
    expect(
      resolveVideoDetailJumpLinks(
        {
          content_id: 266,
          chapters: [{ label: "From chapters", time: 1 }],
          jumpLinks: [{ label: "From jumpLinks", time: 99 }],
        },
        266,
      ),
    ).toEqual({
      source: "chapters",
      links: [{ label: "From chapters", time: 1 }],
    });
  });

  it("prefers catalog jumpLinks over migrated data", () => {
    expect(
      resolveVideoDetailJumpLinks(
        {
          content_id: 266,
          jumpLinks: [{ label: "From jumpLinks", time: 99 }],
        },
        266,
      ),
    ).toEqual({
      source: "jumpLinks",
      links: [{ label: "From jumpLinks", time: 99 }],
    });
  });

  it("uses migrated data only as fallback", () => {
    expect(resolveVideoDetailJumpLinks({ content_id: 266, access_level: "member" }, 266)).toEqual({
      source: "migrated",
      links: ICORD_LINKS,
    });
  });

  it("returns no links when every source is empty", () => {
    expect(resolveVideoDetailJumpLinks({ content_id: 259 }, 259)).toEqual({
      source: "none",
      links: [],
    });
  });

  it("uses migrated fallback for public video 2189", () => {
    const resolved = resolveVideoDetailJumpLinks(
      findPublicCatalogVideoByContentId(videosRaw, 2189),
      2189,
    );
    expect(resolved.source).toBe("migrated");
    expect(resolved.links[0]).toEqual({ time: 19, label: "Stitch and Row count Suggestions" });
  });

  it("gives a public video public jump links from catalog chapters", () => {
    const row = findPublicCatalogVideoByContentId(videosRaw, 535);
    const resolved = resolveVideoDetailJumpLinks(row, 535);
    expect(resolved.source).toBe("chapters");
    expect(resolved.links[0]).toEqual({ label: "Sample Neckline overview", time: 44 });
  });

  it("keeps catalog chapter videos on chapters, not migrated fallback", () => {
    const row = findPublicCatalogVideoByContentId(videosRaw, 520);
    const resolved = resolveVideoDetailJumpLinks(row, 520);
    expect(resolved.source).toBe("chapters");
    expect(resolved.links).toEqual(catalogChaptersFromVideoRow(row));
    expect(resolved.links.map((l) => l.label)).toContain("Seaming on the machine");
  });

  it("keeps catalog jumpLinks videos on jumpLinks, not migrated fallback", () => {
    const row = findPublicCatalogVideoByContentId(videosRaw, 2148);
    const resolved = resolveVideoDetailJumpLinks(row, 2148);
    expect(resolved.source).toBe("jumpLinks");
    expect(resolved.links[0]).toEqual({ label: "Overview Steps", time: 15 });
  });
});

describe("authorized jump-link rendering", () => {
  it("accepts time or legacy t and renders seek buttons", () => {
    const parsed = parseAuthorizedJumpLinks([
      { label: "Slip stitch on your machine", time: 36 },
      { label: "Loop Trim", t: 80 },
      { label: "", time: 1 },
    ]);
    expect(parsed).toEqual([
      { label: "Slip stitch on your machine", time: 36 },
      { label: "Loop Trim", time: 80 },
    ]);
    const html = renderVideoJumpLinkButtons(parsed);
    expect(html).toContain('data-video-jump="36"');
    expect(html).toContain('data-video-jump="80"');
    expect(html).toContain("Slip stitch on your machine");
    expect(html).toContain("Loop Trim");
  });
});

describe("video detail jump-link page wiring", () => {
  const page = readFileSync(join(process.cwd(), "src", "pages", "videos", "[id].astro"), "utf8");
  const hydrate = readFileSync(
    join(process.cwd(), "src", "scripts", "videoDetailGatedJumpLinks.ts"),
    "utf8",
  );

  it("does not put member labels in the page template", () => {
    expect(page).not.toContain("Helecopter trim (give it a twist)");
    expect(page).not.toContain("Slip stitch on your machine");
    expect(page).not.toContain("Pick up and knit I-cord");
    expect(page).not.toContain("Seaming on the machine");
    expect(page).not.toContain("Overview Steps");
    expect(page).toContain('data-jump-source={isOpenPlayback ? "public" : "gated"}');
    expect(page).toContain("hydrateGatedJumpLinks");
    expect(page).toContain("ssrJumpLinks.map");
  });

  it("seeks the Vimeo iframe by Vimeo id, not content id", () => {
    expect(page).toContain("catalogVimeoIframePlayerId(vimeoId, id)");
    expect(page).not.toContain("kbm-gated-vimeo-${id}");
  });

  it("keeps public SSR buttons and a hidden empty member container", () => {
    expect(page).toContain('data-jump-source={isOpenPlayback ? "public" : "gated"}');
    expect(page).toContain("ssrJumpLinks.map");
    expect(page).toContain("hidden={isOpenPlayback ? undefined : true}");
    expect(page).toContain('id="jumplinks"></div>');
    expect(page).not.toContain("Jump links are available with access");
    const gated = page.slice(page.indexOf('data-jump-source={isOpenPlayback ? "public" : "gated"}'));
    const gatedBranch = gated.slice(gated.indexOf(") : ("), gated.indexOf("</nav>"));
    expect(gatedBranch).not.toContain("Jump to");
    expect(hydrate).toContain("catalog-video-embed");
    expect(hydrate).not.toContain("/api/jumplinks/");
  });

  it("does not keep the unauthenticated jumplinks API", () => {
    expect(existsSync(join(process.cwd(), "src", "pages", "api", "jumplinks", "[content_id].json.ts"))).toBe(
      false,
    );
    expect(existsSync(join(process.cwd(), "src", "pages", "api", "jumplinks.json.ts"))).toBe(false);
    expect(existsSync(join(process.cwd(), "src", "scripts", "videoDetailMigratedJumpLinks.ts"))).toBe(
      false,
    );
    expect(existsSync(join(process.cwd(), "public", "api", "jumplinks", "266.json"))).toBe(false);
    expect(page).not.toContain("/api/jumplinks/");
  });

  it("keeps player, description without heading, jump links, then transcript", () => {
    const playerAt = page.indexOf("<GatedVimeoEmbed");
    const descriptionAt = page.indexOf('class="video-description"');
    const jumpAt = page.indexOf('class="video-jumplinks"');
    const transcriptAt = page.indexOf('data-testid="video-english-transcript"');
    expect(playerAt).toBeGreaterThan(-1);
    expect(descriptionAt).toBeGreaterThan(playerAt);
    expect(jumpAt).toBeGreaterThan(descriptionAt);
    expect(transcriptAt).toBeGreaterThan(jumpAt);
    expect(page).not.toContain("<h2>Description</h2>");
  });
});

describe("published catalog jump-link sources", () => {
  it("counts chapters, jumpLinks, migrated fallback, and videos with no links", () => {
    const published = filterPublicCatalogVideos(videosRaw as { content_id?: string | number; status?: string }[]);
    const counts = { chapters: 0, jumpLinks: 0, migrated: 0, none: 0 };
    for (const video of published) {
      counts[resolveVideoDetailJumpLinks(video, video.content_id).source]++;
    }
    expect(counts.chapters).toBeGreaterThan(0);
    expect(counts.jumpLinks).toBeGreaterThan(0);
    expect(counts.migrated).toBeGreaterThan(0);
    expect(counts.none).toBeGreaterThan(0);
    expect(counts.chapters + counts.jumpLinks + counts.migrated + counts.none).toBe(published.length);
    expect(resolveVideoDetailJumpLinks(findPublicCatalogVideoByContentId(videosRaw, 266), 266).source).toBe(
      "migrated",
    );
    expect(resolveVideoDetailJumpLinks(findPublicCatalogVideoByContentId(videosRaw, 2189), 2189).source).toBe(
      "migrated",
    );
    expect(resolveVideoDetailJumpLinks(findPublicCatalogVideoByContentId(videosRaw, 259), 259)).toEqual({
      source: "none",
      links: [],
    });
  });
});
