import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  convertLength,
  formatLength,
} from "../../../components/wizards/utils/unitHelpers";
import { applyHatCrownCastOnAdjustment, calculateHatPattern } from "./hatMath";
import { buildHatPatternHtml } from "./hatInstructions";
import {
  HAT_MATTRESS_STITCH_VIDEO_CONTENT_ID,
} from "./hatMattressStitchVideoTip";
import {
  HAT_PLANNING_RIBBING_TIP_TEXT,
  HAT_PLANNING_RIBBING_TIP_TITLE,
  HAT_PLANNING_RIBBING_VIDEO_CONTENT_ID,
  HAT_PLANNING_RIBBING_VIDEO_TIP_ID,
  HAT_PLANNING_RIBBING_VISIBLE_TEXT,
  HAT_PLANNING_RIBBING_WATCH_LABEL,
  buildHatPlanningRibbingBrimTipHtml,
  buildHatPlanningRibbingVideoHtml,
  isHatPlanningRibbingVideoFree,
  resolveHatPlanningRibbingVideo,
} from "./hatPlanningRibbingVideoTip";
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
  join(__dirname, "hatPlanningRibbingVideoTip.ts"),
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

describe("hatPlanningRibbingVideoTip", () => {
  it("resolves content_id 2211 from the catalog with Vimeo id 216689688", () => {
    const video = resolveHatPlanningRibbingVideo();
    expect(video).not.toBeNull();
    expect(video!.id).toBe("216689688");
    expect(HAT_PLANNING_RIBBING_VIDEO_CONTENT_ID).toBe(2211);
    const row = (videosPublic as PublicVideoRow[]).find(
      (v) => String(v.content_id) === "2211",
    );
    expect(row).toBeTruthy();
    expect(String((row as { vimeo_id?: number | string }).vimeo_id)).toBe("216689688");
    expect(String((row as { title?: string }).title)).toBe(
      "Planning Ribbing for a Neat Seam",
    );
  });

  it("classifies video 2211 as free via canonical access_level public", () => {
    expect(isHatPlanningRibbingVideoFree()).toBe(true);
    const row = (videosPublic as PublicVideoRow[]).find(
      (v) => String(v.content_id) === "2211",
    );
    expect(row).toBeTruthy();
    expect(String((row as { access_level?: string }).access_level)).toBe("public");
  });

  it("builds an inline glossary-styled KinCatalogVideoModal control for content_id 2211", () => {
    const video = resolveHatPlanningRibbingVideo();
    expect(video).not.toBeNull();
    const html = buildHatPlanningRibbingVideoHtml(video);
    expect(html).toContain(`data-content-id="${HAT_PLANNING_RIBBING_VIDEO_CONTENT_ID}"`);
    expect(html).toContain(`aria-label="${HAT_PLANNING_RIBBING_WATCH_LABEL}"`);
    expect(html).toContain("kbm-kin-catalog-video");
    expect(html).toContain("glossary-tooltip-trigger");
    expect(html).toContain('class="glossary-tooltip-label"');
    expect(html).toContain('class="glossary-tooltip-icon" aria-hidden="true"');
    expect(html).toContain(HAT_PLANNING_RIBBING_VISIBLE_TEXT);
    expect(html).toContain(`data-vimeo-id="${video!.id}"`);
    expect(html).toContain('data-testid="hat-planning-ribbing-video-watch"');
    expect(html).not.toContain("pattern-term");
    expect(html).not.toContain("data-tooltip");
    expect(html).not.toContain("undefined");
    expect(html).not.toContain("iframe");
    expect(kinModalSource).toContain('class="kbm-kin-catalog-video"');
    expect(kinModalSource).toContain("kbmKinCatalogVideoModal");
  });

  it("returns plain video title text when video cannot be resolved", () => {
    expect(buildHatPlanningRibbingVideoHtml(null)).toBe(
      "Planning Ribbing for a Neat Seam",
    );
  });

  it("builds shared brim tip with title, advice, and inline video title only", () => {
    const html = buildHatPlanningRibbingBrimTipHtml();
    expect(html).toContain(`data-tip-id="${HAT_PLANNING_RIBBING_VIDEO_TIP_ID}"`);
    expect(html).toContain(`<strong>${HAT_PLANNING_RIBBING_TIP_TITLE}</strong>`);
    expect(html).toContain(HAT_PLANNING_RIBBING_TIP_TEXT);
    expect(html).toContain('data-testid="hat-planning-ribbing-video-watch"');
    expect(html).toContain(HAT_PLANNING_RIBBING_VISIBLE_TEXT);
    expect(html).toContain(`aria-label="${HAT_PLANNING_RIBBING_WATCH_LABEL}"`);
    expect(countContentId(html, HAT_PLANNING_RIBBING_VIDEO_CONTENT_ID)).toBe(1);
  });

  it.each([
    ["gathered", "gathered"],
    ["swirl", "spiral"],
    ["four-gore", "wedge-4-decrease"],
  ] as const)(
    "appears exactly once before cast-on for %s hats (content_id 2211)",
    (_label, crown) => {
      const calc = calcFor(crown);
      const html = patternHtml(crown);
      const patternCastOn = applyHatCrownCastOnAdjustment(calc.castOnSts, crown);

      expect(countContentId(html, HAT_PLANNING_RIBBING_VIDEO_CONTENT_ID)).toBe(1);
      expect(html).toContain(`data-tip-id="${HAT_PLANNING_RIBBING_VIDEO_TIP_ID}"`);
      expect(html).toContain(HAT_PLANNING_RIBBING_TIP_TITLE);
      expect(html).toContain(HAT_PLANNING_RIBBING_TIP_TEXT);
      expect(html).toContain('data-testid="hat-planning-ribbing-video-watch"');
      expect(html).toContain("kbm-kin-catalog-video glossary-tooltip-trigger");
      expect(html).toContain(HAT_PLANNING_RIBBING_VISIBLE_TEXT);

      const castOnSectionIdx = html.indexOf('data-section-id="cast-on"');
      const tipIdx = html.indexOf(`data-tip-id="${HAT_PLANNING_RIBBING_VIDEO_TIP_ID}"`);
      const castOnInstructionIdx = html.indexOf(
        `Cast on <strong>${patternCastOn} stitches</strong>`,
      );
      expect(castOnSectionIdx).toBeGreaterThan(-1);
      expect(tipIdx).toBeGreaterThan(castOnSectionIdx);
      expect(castOnInstructionIdx).toBeGreaterThan(tipIdx);

      // Calculated cast-on count remains unchanged by the tip.
      expect(html).toContain(
        `Cast on <strong>${patternCastOn} stitches</strong>.`,
      );
      expect(patternCastOn).toBe(
        applyHatCrownCastOnAdjustment(calc.castOnSts, crown),
      );
    },
  );

  it("keeps Mattress Stitch video once in finishing and does not remove it", () => {
    for (const crown of ["gathered", "spiral", "wedge-4-decrease"] as const) {
      const html = patternHtml(crown);
      expect(countContentId(html, HAT_MATTRESS_STITCH_VIDEO_CONTENT_ID)).toBe(1);
      expect(html).toContain('data-testid="hat-mattress-stitch-video-watch"');
      const finishingIdx = html.indexOf('data-section-id="finishing"');
      const mattressIdx = html.indexOf(
        `data-content-id="${HAT_MATTRESS_STITCH_VIDEO_CONTENT_ID}"`,
      );
      expect(finishingIdx).toBeGreaterThan(-1);
      expect(mattressIdx).toBeGreaterThan(finishingIdx);
    }
  });

  it("wires shared brim helper once before cast-on (not duplicated per crown)", () => {
    expect(instructionsSource).toContain("buildHatPlanningRibbingBrimTipHtml");
    expect(instructionsSource).toMatch(
      /planningRibbingBrimTipHtml = buildHatPlanningRibbingBrimTipHtml/,
    );
    expect(instructionsSource).toMatch(
      /\$\{planningRibbingBrimTipHtml\}\s*\n\s*<p>Cast on/,
    );
    expect(tipModuleSource).toContain("HAT_PLANNING_RIBBING_VIDEO_CONTENT_ID = 2211");
    expect(tipModuleSource).toContain("glossary-tooltip-label");
    expect(tipModuleSource).not.toContain("player.vimeo.com");
  });
});
