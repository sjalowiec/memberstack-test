import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  convertLength,
  formatLength,
} from "../../../components/wizards/utils/unitHelpers";
import { calculateHatPattern } from "./hatMath";
import { buildHatPatternHtml } from "./hatInstructions";
import {
  HAT_MATTRESS_STITCH_VIDEO_CONTENT_ID,
  HAT_MATTRESS_STITCH_VIDEO_TIP_ID,
  HAT_MATTRESS_STITCH_VISIBLE_TEXT,
  HAT_MATTRESS_STITCH_WATCH_LABEL,
  buildHatMattressStitchVideoHtml,
  isHatMattressStitchVideoFree,
  resolveHatMattressStitchVideo,
} from "./hatMattressStitchVideoTip";
import videosPublic from "../../../data/videos-public.json";
import type { PublicVideoRow } from "../../lessonVideo";

const formatters = {
  convertLength: convertLength as (v: number, from: string, to: string) => number,
  formatLength: formatLength as (v: number, unit: string) => string,
};

function calcFor(crown: string) {
  return calculateHatPattern({
    finishedHatCircInches: 20.5,
    stitchGaugeDisplay: 5,
    rowGaugeDisplay: 7,
    displayUnit: "inches",
    totalHatLengthInches: 8.5,
    brimDepthInches: 2,
    brimType: "single",
    crown,
    suggestedCrownDepthInches: 2.5,
    fit: "watchcap",
  });
}

function patternHtml(crown: string) {
  return buildHatPatternHtml({
    calc: calcFor(crown),
    currentUnit: "inches",
    scrapOffPatternTooltip: "Scrap Off",
    tipsIntroHtml: "",
    showTips: true,
    formatters,
  });
}

function countContentId(html: string, contentId: string | number): number {
  const re = new RegExp(`data-content-id="${contentId}"`, "g");
  return (html.match(re) ?? []).length;
}

const tipModuleSource = readFileSync(
  join(__dirname, "hatMattressStitchVideoTip.ts"),
  "utf8",
);
const instructionsSource = readFileSync(
  join(__dirname, "hatInstructions.ts"),
  "utf8",
);
const patternPageSource = readFileSync(
  join(__dirname, "../../../pages/patterns/hat/pattern.astro"),
  "utf8",
);
const kinModalSource = readFileSync(
  join(__dirname, "../../../components/common/KinCatalogVideoModal.astro"),
  "utf8",
);

describe("hatMattressStitchVideoTip", () => {
  it("resolves content_id 2210 from the catalog with a Vimeo id", () => {
    const video = resolveHatMattressStitchVideo();
    expect(video).not.toBeNull();
    expect(video!.id).toMatch(/^\d+$/);
    expect(video!.id).toBe("1216656183");
    expect(HAT_MATTRESS_STITCH_VIDEO_CONTENT_ID).toBe(2210);
  });

  it("classifies video 2210 as free via canonical access_level public", () => {
    expect(isHatMattressStitchVideoFree()).toBe(true);
    const row = (videosPublic as PublicVideoRow[]).find(
      (v) => String(v.content_id) === "2210",
    );
    expect(row).toBeTruthy();
    expect(String((row as { access_level?: string }).access_level)).toBe("public");
  });

  it("builds an inline glossary-styled KinCatalogVideoModal control for content_id 2210", () => {
    const video = resolveHatMattressStitchVideo();
    expect(video).not.toBeNull();
    const html = buildHatMattressStitchVideoHtml(video);
    expect(html).toContain(`data-tip-id="${HAT_MATTRESS_STITCH_VIDEO_TIP_ID}"`);
    expect(html).toContain(`data-content-id="${HAT_MATTRESS_STITCH_VIDEO_CONTENT_ID}"`);
    expect(html).toContain(`aria-label="${HAT_MATTRESS_STITCH_WATCH_LABEL}"`);
    expect(html).toContain("kbm-kin-catalog-video");
    expect(html).toContain("glossary-tooltip-trigger");
    expect(html).toContain('class="glossary-tooltip-label"');
    expect(html).toContain('class="glossary-tooltip-icon" aria-hidden="true"');
    expect(html).toContain(HAT_MATTRESS_STITCH_VISIBLE_TEXT);
    expect(html).toContain(`data-vimeo-id="${video!.id}"`);
    expect(html).toContain('data-testid="hat-mattress-stitch-video-watch"');
    expect(html).not.toContain("Watch the Mattress Stitch Video");
    expect(html).not.toContain("hat-mattress-stitch-video__watch");
    expect(html).not.toContain("pattern-term");
    expect(html).not.toContain("data-tooltip");
    expect(html).not.toContain("undefined");
    expect(html).not.toContain("iframe");
    expect(kinModalSource).toContain('class="kbm-kin-catalog-video"');
    expect(kinModalSource).toContain("kbmKinCatalogVideoModal");
  });

  it("returns plain mattress stitch text when video cannot be resolved", () => {
    expect(buildHatMattressStitchVideoHtml(null)).toBe("mattress stitch");
  });

  it.each([
    ["gathered", "gathered", "Use the tail to seam the body using"],
    ["swirl", "spiral", "Seam the body using"],
    ["four-gore", "wedge-4-decrease", "Seam each crown wedge first, then seam the body using"],
  ] as const)(
    "appears exactly once as inline mattress stitch for %s hats (content_id 2210)",
    (_label, crown, leadIn) => {
      const html = patternHtml(crown);
      expect(countContentId(html, HAT_MATTRESS_STITCH_VIDEO_CONTENT_ID)).toBe(1);
      expect(html).toContain(leadIn);
      expect(html).toContain('data-testid="hat-mattress-stitch-video-watch"');
      expect(html).toContain("kbm-kin-catalog-video glossary-tooltip-trigger");
      expect(html).toContain('class="glossary-tooltip-label"');
      expect(html).toContain(HAT_MATTRESS_STITCH_VISIBLE_TEXT);
      expect(html).toContain(`aria-label="${HAT_MATTRESS_STITCH_WATCH_LABEL}"`);
      expect(html).not.toContain("hat-mattress-stitch-video__watch");
      expect(html).not.toContain("Watch the Mattress Stitch Video");
      // Finishing section only — not in crown-shaping blocks.
      const finishingIdx = html.indexOf('data-section-id="finishing"');
      const videoIdx = html.indexOf(`data-content-id="${HAT_MATTRESS_STITCH_VIDEO_CONTENT_ID}"`);
      expect(finishingIdx).toBeGreaterThan(-1);
      expect(videoIdx).toBeGreaterThan(finishingIdx);
    },
  );

  it("wires shared finishing helper once as inline phrase (not a standalone button)", () => {
    expect(instructionsSource).toContain("buildHatMattressStitchVideoHtml");
    expect(instructionsSource).toMatch(
      /mattressStitchVideoHtml = buildHatMattressStitchVideoHtml/,
    );
    expect(instructionsSource).toMatch(
      /using \$\{mattressStitchVideoHtml\} or your preferred method/,
    );
    expect(instructionsSource).not.toMatch(
      /Use the tail to seam the body\.<\/p>\s*\$\{mattressStitchVideoHtml\}/,
    );
    expect(tipModuleSource).toContain("HAT_MATTRESS_STITCH_VIDEO_CONTENT_ID = 2210");
    expect(tipModuleSource).toContain("glossary-tooltip-label");
    expect(tipModuleSource).not.toContain("player.vimeo.com");
    expect(patternPageSource).not.toContain("hat-mattress-stitch-video__watch");
    expect(patternPageSource).not.toContain(".hat-mattress-stitch-video");
  });

  it("preserves finishing sentence structure around the inline link", () => {
    const gathered = patternHtml("gathered");
    expect(gathered).toContain("Pull the tail tight to gather the top of the hat.");
    expect(gathered).toContain("or your preferred method.");

    const spiral = patternHtml("spiral");
    expect(spiral).toContain("Seam the body using");
    expect(spiral).toContain("or your preferred method.");
    expect(spiral).toContain(">Block</span> if desired and weave in all ends.");

    const wedge = patternHtml("wedge-4-decrease");
    expect(wedge).toContain(
      "Seam each crown wedge first, then seam the body using",
    );
    expect(wedge).toContain("or your preferred method.");
    expect(wedge).toContain(">Block</span> if desired and weave in all ends.");
  });
});
