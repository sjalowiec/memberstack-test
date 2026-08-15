import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  convertLength,
  formatLength,
} from "../../../components/wizards/utils/unitHelpers";
import { calculateHatPattern, gatheredCrownRemainingStitches, hatCrownEndingRow } from "./hatMath";
import { buildHatPatternHtml } from "./hatInstructions";
import {
  HAT_MATTRESS_STITCH_VIDEO_CONTENT_ID,
} from "./hatMattressStitchVideoTip";
import {
  HAT_PLANNING_RIBBING_VIDEO_CONTENT_ID,
} from "./hatPlanningRibbingVideoTip";
import {
  HAT_GATHERED_TOP_VIDEO_CONTENT_ID,
  HAT_GATHERED_TOP_VIDEO_TIP_ID,
  HAT_GATHERED_TOP_VISIBLE_TEXT,
  HAT_GATHERED_TOP_WATCH_LABEL,
  buildHatGatheredTopVideoHtml,
  isHatGatheredTopVideoFree,
  resolveHatGatheredTopVideo,
} from "./hatGatheredTopVideoTip";
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
  join(__dirname, "hatGatheredTopVideoTip.ts"),
  "utf8",
);
const instructionsSource = readFileSync(
  join(__dirname, "hatInstructions.ts"),
  "utf8",
);
const kinModalSource = readFileSync(
  join(__dirname, "../../../components/common/KinCatalogVideoModal.astro"),
  "utf8",
);

describe("hatGatheredTopVideoTip", () => {
  it("resolves existing catalog content_id 587 with Vimeo id 151859005", () => {
    const video = resolveHatGatheredTopVideo();
    expect(video).not.toBeNull();
    expect(video!.id).toBe("151859005");
    expect(HAT_GATHERED_TOP_VIDEO_CONTENT_ID).toBe(587);
    const row = (videosPublic as PublicVideoRow[]).find(
      (v) => String(v.content_id) === "587",
    );
    expect(row).toBeTruthy();
    expect(String((row as { title?: string }).title)).toBe(
      "Gathered Top for Mittens and Hats",
    );
    expect(String((row as { access_level?: string }).access_level)).toBe("member");
    expect(String((row as { vimeo_id?: number | string }).vimeo_id)).toBe("151859005");
  });

  it("reports catalog access_level member (not free/public)", () => {
    expect(isHatGatheredTopVideoFree()).toBe(false);
  });

  it("builds an inline glossary-styled KinCatalogVideoModal control for content_id 587", () => {
    const video = resolveHatGatheredTopVideo();
    expect(video).not.toBeNull();
    const html = buildHatGatheredTopVideoHtml(video);
    expect(html).toContain(`data-tip-id="${HAT_GATHERED_TOP_VIDEO_TIP_ID}"`);
    expect(html).toContain(`data-content-id="${HAT_GATHERED_TOP_VIDEO_CONTENT_ID}"`);
    expect(html).toContain(`aria-label="${HAT_GATHERED_TOP_WATCH_LABEL}"`);
    expect(html).toContain("kbm-kin-catalog-video");
    expect(html).toContain("glossary-tooltip-trigger");
    expect(html).toContain('class="glossary-tooltip-label"');
    expect(html).toContain('class="glossary-tooltip-icon" aria-hidden="true"');
    expect(html).toContain(HAT_GATHERED_TOP_VISIBLE_TEXT);
    expect(html).toContain(`data-vimeo-id="${video!.id}"`);
    expect(html).toContain('data-testid="hat-gathered-top-video-watch"');
    expect(html).not.toContain("pattern-term");
    expect(html).not.toContain("data-tooltip");
    expect(html).not.toContain("undefined");
    expect(html).not.toContain("iframe");
    expect(html).not.toContain("pattern-tip");
    expect(kinModalSource).toContain('class="kbm-kin-catalog-video"');
    expect(kinModalSource).toContain("kbmKinCatalogVideoModal");
  });

  it("returns plain gather phrase when video cannot be resolved", () => {
    expect(buildHatGatheredTopVideoHtml(null)).toBe("gather the remaining stitches");
    expect(buildHatGatheredTopVideoHtml(null, 43)).toBe(
      "gather the remaining 43 stitches",
    );
  });

  it("appears exactly once in gathered-crown instructions at the break-and-gather step", () => {
    const calc = calcFor("gathered");
    const remaining = gatheredCrownRemainingStitches(calc.castOnSts);
    const ending = hatCrownEndingRow(calc);
    const html = patternHtml("gathered");
    expect(countContentId(html, HAT_GATHERED_TOP_VIDEO_CONTENT_ID)).toBe(1);
    expect(html).toContain('data-testid="hat-gathered-top-video-watch"');
    expect(html).toContain(`aria-label="${HAT_GATHERED_TOP_WATCH_LABEL}"`);
    expect(html).toContain("kbm-kin-catalog-video glossary-tooltip-trigger");
    expect(html).toContain(`gather the remaining ${remaining} stitches`);

    expect(html).toContain(
      `Transfer every other stitch to its neighboring needle, leaving the emptied needles out of work. ${remaining} stitches remain.`,
    );
    expect(html).toContain(`Knit ${calc.crownRowCount} rows. RC is now ${ending}.`);
    expect(html).toContain(`Break the yarn, leaving a 12" tail, and `);
    expect(html).not.toContain("After knitting the full hat length");

    const crownIdx = html.indexOf('data-section-id="crown"');
    const videoIdx = html.indexOf(
      `data-content-id="${HAT_GATHERED_TOP_VIDEO_CONTENT_ID}"`,
    );
    const knitIdx = html.indexOf(`Knit ${calc.crownRowCount} rows. RC is now ${ending}.`);
    expect(crownIdx).toBeGreaterThan(-1);
    expect(knitIdx).toBeGreaterThan(crownIdx);
    expect(videoIdx).toBeGreaterThan(knitIdx);
  });

  it("does not appear in swirl or four-gore instructions", () => {
    for (const crown of ["spiral", "wedge-4-decrease"] as const) {
      const html = patternHtml(crown);
      expect(countContentId(html, HAT_GATHERED_TOP_VIDEO_CONTENT_ID)).toBe(0);
      expect(html).not.toContain('data-testid="hat-gathered-top-video-watch"');
      expect(html).not.toContain(`data-tip-id="${HAT_GATHERED_TOP_VIDEO_TIP_ID}"`);
    }
  });

  it("preserves calculated gathered values and does not alter Mattress Stitch or Planning Ribbing links", () => {
    const calc = calcFor("gathered");
    const html = patternHtml("gathered");
    expect(html).toContain(`Cast on <strong>${calc.castOnSts} stitches</strong>.`);
    expect(html).toContain(`Work ${calc.brimRows} rows in your chosen brim finish.`);
    expect(countContentId(html, HAT_MATTRESS_STITCH_VIDEO_CONTENT_ID)).toBe(1);
    expect(countContentId(html, HAT_PLANNING_RIBBING_VIDEO_CONTENT_ID)).toBe(1);
    expect(html).toContain('data-testid="hat-mattress-stitch-video-watch"');
    expect(html).toContain('data-testid="hat-planning-ribbing-video-watch"');
  });

  it("wires gathered helper only inside gathered crown branch", () => {
    expect(instructionsSource).toContain("buildHatGatheredTopVideoHtml");
    expect(instructionsSource).toMatch(
      /crown === "gathered"[\s\S]*buildHatGatheredTopVideoHtml/,
    );
    expect(instructionsSource).toMatch(
      /Break the yarn, leaving \$\{breakYarnTailPhrase\}, and \$\{gatherRemainingStitchesVideoHtml\}/,
    );
    expect(tipModuleSource).toContain("HAT_GATHERED_TOP_VIDEO_CONTENT_ID = 587");
    expect(tipModuleSource).toContain("glossary-tooltip-label");
    expect(tipModuleSource).not.toContain("player.vimeo.com");
  });
});
