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
  HAT_SWIRL_CROWN_TIP_MESSAGE,
  HAT_SWIRL_CROWN_TIP_TITLE,
  HAT_SWIRL_CROWN_VIDEO_CONTENT_ID,
  HAT_SWIRL_CROWN_VIDEO_TIP_ID,
  HAT_SWIRL_CROWN_WATCH_LABEL,
  buildHatSwirlCrownVideoTipHtml,
  isHatSwirlCrownVideoFree,
  resolveHatSwirlCrownVideo,
} from "./hatSwirlCrownVideoTip";
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

const tipModuleSource = readFileSync(
  join(__dirname, "hatSwirlCrownVideoTip.ts"),
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

describe("hatSwirlCrownVideoTip", () => {
  it("resolves content_id 260 from the catalog with a Vimeo id", () => {
    const video = resolveHatSwirlCrownVideo();
    expect(video).not.toBeNull();
    expect(video!.id).toMatch(/^\d+$/);
    expect(HAT_SWIRL_CROWN_VIDEO_CONTENT_ID).toBe(260);
  });

  it("classifies video 260 as free via canonical access_level public", () => {
    expect(isHatSwirlCrownVideoFree()).toBe(true);
    const row = (videosPublic as PublicVideoRow[]).find(
      (v) => String(v.content_id) === "260",
    );
    expect(row).toBeTruthy();
    expect(String((row as { access_level?: string }).access_level)).toBe("public");
  });

  it("does not change any other video access_level when asserting 260 is public", () => {
    const catalog = videosPublic as Array<{ content_id?: unknown; access_level?: unknown }>;
    const row260 = catalog.find((v) => String(v.content_id) === "260");
    expect(row260 && String(row260.access_level)).toBe("public");

    const others = catalog.filter((v) => String(v.content_id ?? "") !== "260");
    const before = JSON.stringify(others.map((v) => [v.content_id, v.access_level]));
    expect(isHatSwirlCrownVideoFree()).toBe(true);
    const after = JSON.stringify(others.map((v) => [v.content_id, v.access_level]));
    expect(after).toBe(before);

    // Nearby catalog rows remain member (sanity: no bulk public flip).
    const neighbor = catalog.find((v) => String(v.content_id) === "892");
    expect(neighbor && String(neighbor.access_level)).toBe("member");
  });

  it("builds tip markup that opens KinCatalogVideoModal for content_id 260", () => {
    const video = resolveHatSwirlCrownVideo();
    expect(video).not.toBeNull();
    const html = buildHatSwirlCrownVideoTipHtml(video);
    expect(html).toContain(`data-tip-id="${HAT_SWIRL_CROWN_VIDEO_TIP_ID}"`);
    expect(html).toContain(`data-content-id="${HAT_SWIRL_CROWN_VIDEO_CONTENT_ID}"`);
    expect(html).toContain(HAT_SWIRL_CROWN_TIP_TITLE);
    expect(html).toContain(HAT_SWIRL_CROWN_TIP_MESSAGE);
    expect(html).toContain(HAT_SWIRL_CROWN_WATCH_LABEL);
    expect(html).toContain("kbm-kin-catalog-video");
    expect(html).toContain(`data-vimeo-id="${video!.id}"`);
    expect(html).toContain('data-testid="hat-swirl-crown-video-watch"');
    expect(html).toContain("no-print");
    expect(html).toContain("pattern-tip-media-no-print");
    expect(html).not.toContain("undefined");
    expect(html).not.toContain("iframe");
    expect(kinModalSource).toContain('class="kbm-kin-catalog-video"');
    expect(kinModalSource).toContain("kbmKinCatalogVideoModal");
  });

  it("returns empty string when video cannot be resolved", () => {
    expect(buildHatSwirlCrownVideoTipHtml(null)).toBe("");
  });

  it("appears only for spiral crown in finished pattern HTML", () => {
    const spiral = patternHtml("spiral");
    expect(spiral).toContain(`data-tip-id="${HAT_SWIRL_CROWN_VIDEO_TIP_ID}"`);
    expect(spiral).toContain(`data-content-id="${HAT_SWIRL_CROWN_VIDEO_CONTENT_ID}"`);
    expect(spiral).toContain("kbm-kin-catalog-video");
    expect(spiral).toContain(HAT_SWIRL_CROWN_WATCH_LABEL);

    const gathered = patternHtml("gathered");
    expect(gathered).not.toContain(HAT_SWIRL_CROWN_VIDEO_TIP_ID);
    expect(gathered).not.toContain("hat-swirl-crown-video-watch");

    const wedge = patternHtml("wedge-4-decrease");
    expect(wedge).not.toContain(HAT_SWIRL_CROWN_VIDEO_TIP_ID);
    expect(wedge).not.toContain("hat-swirl-crown-video-watch");
  });

  it("wires tip through hatInstructions for spiral only (no second player)", () => {
    expect(instructionsSource).toContain("buildHatSwirlCrownVideoTipHtml");
    expect(instructionsSource).toMatch(/crown === "spiral"[\s\S]*buildHatSwirlCrownVideoTipHtml/);
    expect(tipModuleSource).toContain("HAT_SWIRL_CROWN_VIDEO_CONTENT_ID = 260");
    expect(tipModuleSource).not.toContain("player.vimeo.com");
  });
});
