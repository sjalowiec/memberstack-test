import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  jumplinksByContentId,
  videoDetailMigratedJumpLinks,
  VIDEO_DETAIL_MIGRATED_JUMPLINKS_CONTENT_ID,
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
    expect(VIDEO_DETAIL_MIGRATED_JUMPLINKS_CONTENT_ID).toBe(266);
    expect(jumplinksByContentId(266)).toEqual(ICORD_LINKS);
    expect(jumplinksByContentId("266")).toEqual(ICORD_LINKS);
  });

  it("does not wire other videos through the video-detail PoC helper", () => {
    expect(videoDetailMigratedJumpLinks(266)).toEqual(ICORD_LINKS);
    expect(videoDetailMigratedJumpLinks(2189)).toEqual([]);
    expect(videoDetailMigratedJumpLinks(520)).toEqual([]);
    expect(videoDetailMigratedJumpLinks("nope")).toEqual([]);
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

  it("does not put migrated member labels in the page template", () => {
    expect(page).not.toContain("Helecopter trim (give it a twist)");
    expect(page).not.toContain("Slip stitch on your machine");
    expect(page).not.toContain("Pick up and knit I-cord");
    expect(page).toContain('data-jump-source="migrated"');
    expect(page).toContain("hydrateMigratedJumpLinks");
  });

  it("seeks the Vimeo iframe by Vimeo id, not content id", () => {
    expect(page).toContain("catalogVimeoIframePlayerId(vimeoId, id)");
    expect(page).not.toContain("kbm-gated-vimeo-${id}");
  });

  it("keeps SSR catalog chapter buttons for existing chapter videos", () => {
    expect(page).toContain("catalogChapters.map");
    expect(page).toContain("hasCatalogChapters");
  });
});
