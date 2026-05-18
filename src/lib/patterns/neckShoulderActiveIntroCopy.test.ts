import { describe, expect, it } from "vitest";
import {
  activeShoulderCenterDivideIntroApplies,
  activeShoulderIntroPlainParagraphs,
  activeShoulderIntroUsesVNeckDivideCopy,
  formatActiveShoulderCenterNecklinePlainSentence,
  formatActiveShoulderVNeckCenterPlainSentence,
  SCRAP_OFF_GLOSSARY_ID,
} from "./neckShoulderActiveIntroCopy";
import {
  NECKLINE_SHAPING_HELP_VIDEO_KEY,
  renderActiveShoulderChartIntroHtml,
  renderNeckShoulderChartIntroBlockHtml,
} from "./neckShoulderShapingChartHtml";
import { centerBindOffStitchesFromNeckShoulderChart, generateSleevelessBackPattern } from "./sleevelessPatternOutput";

function vNeckPattern() {
  return generateSleevelessBackPattern({
    fit: {
      sizingChart: "misses",
      selectedMeasurements: {
        finished_bust_chest: 40,
        back_neck_to_hem: 22,
        armhole_depth: 8,
        neck_opening: 3,
        shoulder_width: 4.25,
        front_neck_depth: 3,
        back_neck_depth: 1,
      },
    },
    style: { recipientCategory: "misses", neckline: "v-neck" },
    yarnGaugeMachine: {
      gaugeStitchesPerInch: 5,
      gaugeRowsPerInch: 7,
      availableNeedles: 200,
    },
  });
}

describe("neckShoulderActiveIntroCopy", () => {
  it("uses scrap-off divide wording with stitch count for round neck", () => {
    expect(
      formatActiveShoulderCenterNecklinePlainSentence({
        localStartRcLabel: "RC:117",
        centerBindOffStitches: 14,
      }),
    ).toBe(
      "When Armhole RC reaches 117, scrap off the center 14 neckline stitches to divide the neckline.",
    );
  });

  it("uses V-neck divide-at-center wording without bind-off", () => {
    expect(
      formatActiveShoulderVNeckCenterPlainSentence({ localStartRcLabel: "RC:117" }),
    ).toBe(
      "When Armhole RC reaches 117, divide the piece at the center. Shape each side independently with decreases along the neck edge per the chart — there is no center bind-off.",
    );
  });

  it("omits round-neck center divide when center bind-off is zero and chart is not V-neck front", () => {
    expect(activeShoulderCenterDivideIntroApplies(0)).toBe(false);
    expect(activeShoulderIntroPlainParagraphs({ centerBindOffStitches: 0 })).toEqual([
      "Follow the chart row by row for the active shoulder, then repeat for the second shoulder, reversing the edge landmarks.",
    ]);
  });

  it("includes V-neck divide paragraphs for sleeveless full-width front chart", () => {
    const r = vNeckPattern();
    expect(activeShoulderIntroUsesVNeckDivideCopy(r.frontNeckShoulderShapingChart)).toBe(true);
    expect(activeShoulderCenterDivideIntroApplies(0, r.frontNeckShoulderShapingChart)).toBe(true);
    const paras = activeShoulderIntroPlainParagraphs({
      localStartRcLabel: "RC:050",
      centerBindOffStitches: 0,
      chart: r.frontNeckShoulderShapingChart,
    });
    expect(paras[0]).toMatch(/divide the piece at the center/i);
    expect(paras[0]).toMatch(/decreases along the neck edge/i);
    expect(paras[0]).not.toMatch(/bind off|scrap off/i);
    expect(paras[1]).toMatch(/work one shoulder at a time/i);
  });
});

describe("renderNeckShoulderChartIntroBlockHtml", () => {
  const baseOpts = {
    wrapperClass: "pattern-shaping-intro",
    layout: "compact" as const,
    localStartRcLabel: "RC:050",
    centerBindOffStitches: 10,
  };

  it("renders compact help before intro with shallowBackNeck video key", () => {
    const r = generateSleevelessBackPattern({
      fit: {
        sizingChart: "misses",
        selectedMeasurements: {
          finished_bust_chest: 40,
          back_neck_to_hem: 22,
          armhole_depth: 8,
          neck_opening: 3,
          shoulder_width: 4.25,
          front_neck_depth: 3,
          back_neck_depth: 1,
        },
      },
      style: { recipientCategory: "misses", neckline: "round" },
      yarnGaugeMachine: {
        gaugeStitchesPerInch: 5,
        gaugeRowsPerInch: 7,
        availableNeedles: 200,
      },
    });
    const html = renderNeckShoulderChartIntroBlockHtml({
      ...baseOpts,
      chart: r.neckShoulderShapingChart,
    });
    const helpIdx = html.indexOf("New to shaping necklines?");
    const introIdx = html.indexOf("Center Neckline:");
    expect(helpIdx).toBeGreaterThanOrEqual(0);
    expect(introIdx).toBeGreaterThan(helpIdx);
    expect(html).toContain(`data-sleeveless-help-video="${NECKLINE_SHAPING_HELP_VIDEO_KEY}"`);
    expect(html).toContain("process of dividing and shaping a neckline");
    expect(html).toContain("glossary-tooltip-placeholder");
    expect(html).toContain("Scrap off</span>");
  });
});

describe("renderActiveShoulderChartIntroHtml", () => {
  const baseOpts = {
    wrapperClass: "pattern-shaping-intro",
    layout: "compact" as const,
  };

  it("links Scrap off to glossary id 311 for divided round necklines", () => {
    const html = renderActiveShoulderChartIntroHtml({
      ...baseOpts,
      localStartRcLabel: "RC:050",
      centerBindOffStitches: 10,
    });
    expect(html).toContain(`data-glossary-id="${SCRAP_OFF_GLOSSARY_ID}"`);
    expect(html).toContain("glossary-tooltip-placeholder");
    expect(html).toContain("Scrap off</span> the center 10 neckline stitches to divide the neckline");
    expect(html).not.toMatch(/bind off the center/i);
    expect(html).toContain("Divide:");
    expect(html).toContain("work one shoulder at a time");
  });

  it("uses V-neck divide copy for front chart (not round-neck center scrap-off)", () => {
    const r = vNeckPattern();
    const frontCenter = centerBindOffStitchesFromNeckShoulderChart(r.frontNeckShoulderShapingChart);
    expect(frontCenter).toBe(0);

    const html = renderNeckShoulderChartIntroBlockHtml({
      ...baseOpts,
      localStartRcLabel: "RC:100",
      centerBindOffStitches: frontCenter,
      chart: r.frontNeckShoulderShapingChart,
    });
    expect(html).toContain("New to shaping necklines?");
    expect(html).toContain("Center Neckline:");
    expect(html).toContain("Divide:");
    expect(html).toMatch(/divide the piece at the center/i);
    expect(html).toMatch(/decreases along the neck edge/i);
    expect(html).not.toMatch(/scrap off the center/i);
    expect(html).not.toMatch(/bind off the center/i);
    expect(html).toContain("Follow the chart row by row");
    expect(html).toContain("work one shoulder at a time");
  });

  it("ignores mistaken round-neck center bind-off count when chart is V-neck front", () => {
    const r = vNeckPattern();
    const html = renderActiveShoulderChartIntroHtml({
      ...baseOpts,
      localStartRcLabel: "RC:100",
      centerBindOffStitches: 14,
      chart: r.frontNeckShoulderShapingChart,
    });
    expect(html).toMatch(/divide the piece at the center/i);
    expect(html).not.toMatch(/scrap off the center/i);
    expect(html).not.toMatch(/bind off the center/i);
  });
});
