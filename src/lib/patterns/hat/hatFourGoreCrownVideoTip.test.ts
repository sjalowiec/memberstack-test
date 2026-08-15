import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  convertLength,
  formatLength,
} from "../../../components/wizards/utils/unitHelpers";
import { buildFourWedgeCrownSetup, calculateHatPattern } from "./hatMath";
import { buildHatPatternHtml } from "./hatInstructions";
import {
  HAT_FOUR_GORE_CROWN_TIP_MESSAGE,
  HAT_FOUR_GORE_CROWN_TIP_TITLE,
  HAT_FOUR_GORE_CROWN_VIDEO_CONTENT_ID,
  HAT_FOUR_GORE_CROWN_VIDEO_TIP_ID,
  HAT_FOUR_GORE_CROWN_WATCH_LABEL,
  buildHatFourGoreCrownVideoTipHtml,
  isHatFourGoreCrownVideoFree,
  resolveHatFourGoreCrownVideo,
} from "./hatFourGoreCrownVideoTip";
import { HAT_SWIRL_CROWN_VIDEO_TIP_ID } from "./hatSwirlCrownVideoTip";
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
  join(__dirname, "hatFourGoreCrownVideoTip.ts"),
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

describe("hatFourGoreCrownVideoTip", () => {
  it("resolves content_id 2209 from the catalog with a Vimeo id", () => {
    const video = resolveHatFourGoreCrownVideo();
    expect(video).not.toBeNull();
    expect(video!.id).toMatch(/^\d+$/);
    expect(video!.id).toBe("1216675237");
    expect(HAT_FOUR_GORE_CROWN_VIDEO_CONTENT_ID).toBe(2209);
  });

  it("classifies video 2209 as free via canonical access_level public", () => {
    expect(isHatFourGoreCrownVideoFree()).toBe(true);
    const row = (videosPublic as PublicVideoRow[]).find(
      (v) => String(v.content_id) === "2209",
    );
    expect(row).toBeTruthy();
    expect(String((row as { access_level?: string }).access_level)).toBe("public");
  });

  it("builds tip markup that opens KinCatalogVideoModal for content_id 2209", () => {
    const video = resolveHatFourGoreCrownVideo();
    expect(video).not.toBeNull();
    const html = buildHatFourGoreCrownVideoTipHtml(video);
    expect(html).toContain(`data-tip-id="${HAT_FOUR_GORE_CROWN_VIDEO_TIP_ID}"`);
    expect(html).toContain(`data-content-id="${HAT_FOUR_GORE_CROWN_VIDEO_CONTENT_ID}"`);
    expect(html).toContain(HAT_FOUR_GORE_CROWN_TIP_TITLE);
    expect(html).toContain(HAT_FOUR_GORE_CROWN_TIP_MESSAGE);
    expect(html).toContain(HAT_FOUR_GORE_CROWN_WATCH_LABEL);
    expect(html).toContain("kbm-kin-catalog-video");
    expect(html).toContain(`data-vimeo-id="${video!.id}"`);
    expect(html).toContain('data-testid="hat-four-gore-crown-video-watch"');
    expect(html).toContain("no-print");
    expect(html).toContain("pattern-tip-media-no-print");
    expect(html).not.toContain("undefined");
    expect(html).not.toContain("iframe");
    expect(kinModalSource).toContain('class="kbm-kin-catalog-video"');
    expect(kinModalSource).toContain("kbmKinCatalogVideoModal");
  });

  it("returns empty string when video cannot be resolved", () => {
    expect(buildHatFourGoreCrownVideoTipHtml(null)).toBe("");
  });

  it("appears only for four-gore crown in finished pattern HTML", () => {
    const wedge = patternHtml("wedge-4-decrease");
    expect(wedge).toContain(`data-tip-id="${HAT_FOUR_GORE_CROWN_VIDEO_TIP_ID}"`);
    expect(wedge).toContain(`data-content-id="${HAT_FOUR_GORE_CROWN_VIDEO_CONTENT_ID}"`);
    expect(wedge).toContain("kbm-kin-catalog-video");
    expect(wedge).toContain(HAT_FOUR_GORE_CROWN_WATCH_LABEL);
    expect(wedge).toContain(HAT_FOUR_GORE_CROWN_TIP_TITLE);
    expect(wedge).toContain(HAT_FOUR_GORE_CROWN_TIP_MESSAGE);

    const gathered = patternHtml("gathered");
    expect(gathered).not.toContain(HAT_FOUR_GORE_CROWN_VIDEO_TIP_ID);
    expect(gathered).not.toContain("hat-four-gore-crown-video-watch");
    expect(gathered).not.toContain(HAT_FOUR_GORE_CROWN_TIP_TITLE);

    const spiral = patternHtml("spiral");
    expect(spiral).not.toContain(HAT_FOUR_GORE_CROWN_VIDEO_TIP_ID);
    expect(spiral).not.toContain("hat-four-gore-crown-video-watch");
    expect(spiral).not.toContain(HAT_FOUR_GORE_CROWN_TIP_TITLE);
    expect(spiral).toContain(HAT_SWIRL_CROWN_VIDEO_TIP_ID);
  });

  it("appears once before crown decreases, not with every wedge decrease block", () => {
    const wedge = patternHtml("wedge-4-decrease");
    const tipMatches = wedge.match(/data-tip-id="hat-four-gore-crown-video"/g) ?? [];
    expect(tipMatches).toHaveLength(1);

    const watchMatches = wedge.match(/data-testid="hat-four-gore-crown-video-watch"/g) ?? [];
    expect(watchMatches).toHaveLength(1);

    const wedge1Idx = wedge.indexOf('data-section-id="crown-wedge-1"');
    const tipIdx = wedge.indexOf(`data-tip-id="${HAT_FOUR_GORE_CROWN_VIDEO_TIP_ID}"`);
    const firstDecreaseIdx = wedge.indexOf(
      "Decrease 1 stitch two stitches in from each edge",
    );
    expect(wedge1Idx).toBeGreaterThan(-1);
    expect(tipIdx).toBeGreaterThan(wedge1Idx);
    expect(firstDecreaseIdx).toBeGreaterThan(tipIdx);

    // Decrease instruction still appears for later wedges; tip must not.
    const decreaseMatches =
      wedge.match(/Decrease 1 stitch two stitches in from each edge/g) ?? [];
    expect(decreaseMatches.length).toBeGreaterThan(1);
  });

  it("uses explicit two-stitches-in decrease wording on all four wedges", () => {
    const wedge = patternHtml("wedge-4-decrease");
    const calc = calcFor("wedge-4-decrease");
    const fws = buildFourWedgeCrownSetup({
      castOnSts: calc.castOnSts,
      crown: calc.crown,
      brimRows: calc.brimRows,
      bodyRows: calc.bodyRows,
    });
    expect(fws).not.toBeNull();
    const finalWedgeStitchCount = fws!.wedgeStitchCount % 2 === 1 ? 1 : 2;
    const decreaseCount = (fws!.wedgeStitchCount - finalWedgeStitchCount) / 2;
    const expected =
      `Decrease 1 stitch two stitches in from each edge every row, ${decreaseCount} times.`;

    expect(decreaseCount).toBeGreaterThan(0);
    expect(wedge).not.toContain("Decrease 1 stitch at each edge");

    for (const sectionId of [
      "crown-wedge-1",
      "crown-wedge-2",
      "crown-wedge-3",
      "crown-wedge-4",
    ]) {
      const sectionStart = wedge.indexOf(`data-section-id="${sectionId}"`);
      expect(sectionStart).toBeGreaterThan(-1);
      const sectionEnd = wedge.indexOf("</section>", sectionStart);
      const sectionHtml = wedge.slice(sectionStart, sectionEnd);
      expect(sectionHtml).toContain(expected);
      expect(sectionHtml).toContain("two stitches in from each edge");
    }

    const decreaseMatches =
      wedge.match(/Decrease 1 stitch two stitches in from each edge/g) ?? [];
    expect(decreaseMatches).toHaveLength(4);

    const tipMatches = wedge.match(/data-tip-id="hat-four-gore-crown-video"/g) ?? [];
    expect(tipMatches).toHaveLength(1);
  });

  it("does not change gathered or swirl crown decrease wording", () => {
    const gathered = patternHtml("gathered");
    const spiral = patternHtml("spiral");

    expect(gathered).not.toContain("two stitches in from each edge");
    expect(gathered).not.toContain(HAT_FOUR_GORE_CROWN_VIDEO_TIP_ID);
    expect(gathered).toContain("Keep 2 stitches in work on each edge for seaming.");

    expect(spiral).not.toContain("two stitches in from each edge");
    expect(spiral).not.toContain(HAT_FOUR_GORE_CROWN_VIDEO_TIP_ID);
    expect(spiral).toContain(HAT_SWIRL_CROWN_VIDEO_TIP_ID);
  });

  it("wires tip through hatInstructions for wedge-4-decrease only (no second player)", () => {
    expect(instructionsSource).toContain("buildHatFourGoreCrownVideoTipHtml");
    expect(instructionsSource).toMatch(
      /crown === "wedge-4-decrease"[\s\S]*buildHatFourGoreCrownVideoTipHtml/,
    );
    expect(tipModuleSource).toContain("HAT_FOUR_GORE_CROWN_VIDEO_CONTENT_ID = 2209");
    expect(tipModuleSource).not.toContain("player.vimeo.com");
  });
});
