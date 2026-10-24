import { describe, expect, it } from "vitest";
import videosPublic from "../../data/videos-public.json";
import type { PublicVideoRow } from "../lessonVideo";
import { buildSidewaysCardiganBodyInstructions } from "./sidewaysCardiganBodyInstructions";
import type { SidewaysCardiganBodyCalcInput } from "./sidewaysCardiganBodyCalc";
import {
  buildSidewaysCardiganBodyDisplayRows,
  buildSidewaysPulloverBodyDisplayRows,
  renderSidewaysCardiganBodyDisplayHtml,
} from "./sidewaysCardiganPatternOutput";
import {
  isSidewaysVNeckline,
  resolveSidewaysLearningVideo,
  SIDEWAYS_BUST_DARTS_VIDEO_CONTENT_ID,
  SIDEWAYS_V_NECK_SHAPING_VIDEO_CONTENT_ID,
  SIDEWAYS_WAIST_SHAPING_VIDEO_CONTENT_ID,
  sidewaysOptionalShapingParagraphs,
  sidewaysPulloverVNeckShapingParagraph,
} from "./sidewaysBodyLearningVideos";

const SAMPLE: SidewaysCardiganBodyCalcInput = {
  garmentLengthInches: 22,
  vNeckDepthInches: 8,
  finishedBustCircumferenceInches: 40,
  finishedUpperArmInches: 14,
  neckOpeningWidthInches: 7,
  backNeckDepthInches: 1,
  stitchesPerInch: 5,
  rowsPerInch: 7,
};

const catalog = videosPublic as PublicVideoRow[];

function catalogRow(contentId: number) {
  return catalog.find((row) => String(row.content_id) === String(contentId));
}

function instructions(style: "pullover" | "cardigan") {
  const result = buildSidewaysCardiganBodyInstructions(SAMPLE, style);
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error(result.error.message);
  return result.instructions;
}

function sectionHtml(html: string, sectionId: string): string {
  const marker = `id="${sectionId}"`;
  const start = html.indexOf(marker);
  expect(start).toBeGreaterThan(-1);
  const next = html.indexOf("<section ", start + marker.length);
  return next === -1 ? html.slice(start) : html.slice(start, next);
}

describe("Sideways Learning Library videos", () => {
  it("resolves content ids 5003, 1012, and 960 from the catalog", () => {
    const vNeck = catalogRow(SIDEWAYS_V_NECK_SHAPING_VIDEO_CONTENT_ID);
    const bust = catalogRow(SIDEWAYS_BUST_DARTS_VIDEO_CONTENT_ID);
    const waist = catalogRow(SIDEWAYS_WAIST_SHAPING_VIDEO_CONTENT_ID);
    expect(vNeck?.title).toBe("Shaping a Sideways V-Neck");
    expect(vNeck?.vimeo_id).toBe(1239125400);
    expect(bust?.title).toBe("Sideways Bust Darts");
    expect(bust?.vimeo_id).toBe(454539776);
    expect(waist?.title).toBe("Sideways Sweater Waist Shaping");
    expect(waist?.vimeo_id).toBe(373265681);

    expect(resolveSidewaysLearningVideo(5003)?.id).toBe("1239125400");
    expect(resolveSidewaysLearningVideo(1012)?.id).toBe("454539776");
    expect(resolveSidewaysLearningVideo(960)?.id).toBe("373265681");
  });

  it("does not substitute another video when a content id is missing", () => {
    const withoutVNeck = catalog.filter(
      (row) => String(row.content_id) !== String(SIDEWAYS_V_NECK_SHAPING_VIDEO_CONTENT_ID),
    );
    expect(sidewaysPulloverVNeckShapingParagraph("v", withoutVNeck)).toBe("");
    expect(sidewaysPulloverVNeckShapingParagraph("v", withoutVNeck)).not.toContain("454539776");
    expect(sidewaysPulloverVNeckShapingParagraph("v", withoutVNeck)).not.toContain("373265681");

    const withoutOptional = catalog.filter(
      (row) =>
        String(row.content_id) !== "1012" && String(row.content_id) !== "960",
    );
    expect(sidewaysOptionalShapingParagraphs(withoutOptional)).toEqual([]);
  });

  it("shows video 5003 only beside the V-neck pullover shaping", () => {
    const pullover = renderSidewaysCardiganBodyDisplayHtml(instructions("pullover"), 5, "misses", "v");
    const cardigan = renderSidewaysCardiganBodyDisplayHtml(instructions("cardigan"), 5, "misses", "v");
    const roundNeck = renderSidewaysCardiganBodyDisplayHtml(
      instructions("pullover"),
      5,
      "misses",
      "round",
    );
    const firstV = sectionHtml(pullover, "sg-body-first-v-neck");
    const secondV = sectionHtml(pullover, "sg-body-second-v-neck");
    const optional = sectionHtml(pullover, "sg-body-optional-techniques");

    expect(firstV).toContain('data-content-id="5003"');
    expect(firstV).toContain('data-vimeo-id="1239125400"');
    expect(firstV).toContain('data-sideways-v-neck-shaping-video');
    expect(firstV).toContain("Watch: Shaping a Sideways V-Neck");
    expect(firstV).toContain("sideways V-neck shaping used in these instructions");
    expect(firstV).toContain('class="kbm-kin-catalog-video pattern-help-link__button"');
    expect(firstV.match(/data-content-id="5003"/g)).toHaveLength(1);
    expect(secondV).toContain('data-content-id="5003"');
    expect(secondV).toContain('data-vimeo-id="1239125400"');
    expect(secondV.match(/data-content-id="5003"/g)).toHaveLength(1);
    expect(pullover.match(/data-content-id="5003"/g)).toHaveLength(2);

    expect(optional).not.toContain("5003");
    expect(cardigan).not.toContain("5003");
    expect(cardigan).not.toContain("data-sideways-v-neck-shaping-video");
    expect(roundNeck).not.toContain("5003");
    expect(isSidewaysVNeckline("crew")).toBe(false);
    expect(isSidewaysVNeckline("")).toBe(true);
  });

  it("shows optional bust-dart and waist videos for both sideways styles", () => {
    for (const style of ["pullover", "cardigan"] as const) {
      const html = renderSidewaysCardiganBodyDisplayHtml(instructions(style));
      const optional = sectionHtml(html, "sg-body-optional-techniques");
      expect(optional).toContain('data-content-id="1012"');
      expect(optional).toContain('data-vimeo-id="454539776"');
      expect(optional).toContain("Watch: Sideways Bust Darts");
      expect(optional).toContain('data-content-id="960"');
      expect(optional).toContain('data-vimeo-id="373265681"');
      expect(optional).toContain("Watch: Sideways Sweater Waist Shaping");
      expect(optional).toContain("Optional technique: Sideways bust darts.");
      expect(optional).toContain("Optional technique: Sideways waist shaping.");
      expect(optional).toContain("shaping you can choose to add");
      expect(optional).toContain("The pattern instructions do not include this shaping.");
      expect(optional).not.toMatch(/Work the (bust dart|waist)/i);
      expect(html.indexOf("sg-body-optional-techniques")).toBeLessThan(
        html.indexOf("sg-body-cast-on"),
      );
    }
  });

  it("leaves the written V-neck directions and charts unchanged", () => {
    const pullover = instructions("pullover");
    const rows = buildSidewaysPulloverBodyDisplayRows(pullover, 5, "misses", "v");
    const firstV = rows.find(
      (row) => row.kind === "block" && row.bodyShapingChartId === "sideways-pullover-first-v-neck",
    );
    expect(firstV?.kind).toBe("block");
    if (firstV?.kind !== "block") return;
    expect(firstV.trustedParagraphs?.[1]).toBe(
      `Begin with all ${pullover.calc.garmentLengthStitches} stitches in work.`,
    );
    expect(firstV.bodyShapingChartRows?.map((row) => row.rc)).toEqual(
      pullover.firstV.actionRowCounters,
    );
    expect(firstV.rc).toBeTruthy();

    const cardigan = instructions("cardigan");
    const cardiganRows = buildSidewaysCardiganBodyDisplayRows(cardigan);
    const cardiganFirstV = cardiganRows.find(
      (row) => row.kind === "block" && row.bodyShapingChartId === "sideways-cardigan-first-v-neck",
    );
    expect(cardiganFirstV?.kind).toBe("block");
    if (cardiganFirstV?.kind !== "block") return;
    expect(cardiganFirstV.trustedParagraphs?.join("\n")).not.toContain("5003");
    expect(cardiganFirstV.bodyShapingChartRows?.map((row) => row.rc)).toEqual(
      cardigan.firstV.actionRowCounters,
    );
  });
});
