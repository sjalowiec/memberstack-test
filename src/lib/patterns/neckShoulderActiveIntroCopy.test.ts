import { describe, expect, it } from "vitest";
import {
  activeShoulderCenterDivideIntroApplies,
  activeShoulderIntroPlainParagraphs,
  activeShoulderIntroUsesVNeckDivideCopy,
  formatActiveShoulderCenterNecklinePlainSentence,
  formatActiveShoulderVNeckCenterPlainSentence,
  BIND_OFF_GLOSSARY_ID,
  SCRAP_OFF_GLOSSARY_ID,
} from "./neckShoulderActiveIntroCopy";
import {
  NECKLINE_SHAPING_HELP_VIDEO_KEY,
  armholeLocalRcActiveShoulderChecklistStart,
  renderActiveShoulderChartIntroHtml,
  renderNeckShoulderChartIntroBlockHtml,
  renderNeckShoulderShapingChartTableOnlyHtml,
} from "./neckShoulderShapingChartHtml";
import {
  centerBindOffStitchesFromNeckShoulderChart,
  generateSleevelessBackPattern,
  LIFELINE_GLOSSARY_ID,
} from "./sleevelessPatternOutput";

function baseRoundNeckMeasurements() {
  return {
    finished_bust_chest: 40,
    back_neck_to_hem: 22,
    armhole_depth: 8,
    neck_opening: 3,
    shoulder_width: 4.25,
    front_neck_depth: 3,
    back_neck_depth: 1,
  };
}

function roundNeckPattern(overrides: Record<string, unknown> = {}) {
  return generateSleevelessBackPattern({
    fit: {
      sizingChart: "misses",
      selectedMeasurements: baseRoundNeckMeasurements(),
    },
    style: { recipientCategory: "misses", neckline: "round" },
    yarnGaugeMachine: {
      gaugeStitchesPerInch: 5,
      gaugeRowsPerInch: 7,
      availableNeedles: 200,
    },
    ...overrides,
  });
}

function cardiganRoundFrontPattern() {
  return roundNeckPattern({
    style: { recipientCategory: "misses", neckline: "round", frontStyle: "open" },
  });
}

function vNeckPattern() {
  return generateSleevelessBackPattern({
    fit: {
      sizingChart: "misses",
      selectedMeasurements: baseRoundNeckMeasurements(),
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
  it("uses divide wording with stitch count for round neck", () => {
    expect(
      formatActiveShoulderCenterNecklinePlainSentence({
        localStartRcLabel: "RC:117",
        centerBindOffStitches: 14,
      }),
    ).toBe(
      "When Armhole RC reaches 117, divide the neckline by removing the center 14 neckline stitches from work. Scrap off, bind off, or place these stitches on hold according to your preferred method.",
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
      "Follow the checklist row by row for the first shoulder. Then return the held stitches to the machine and work the second shoulder, reversing the neckline and shoulder shaping so that neckline shaping remains on the neck edge and shoulder shaping remains on the shoulder edge.",
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
    const introIdx = html.indexOf("Back neck (three stages):");
    expect(helpIdx).toBeGreaterThanOrEqual(0);
    expect(introIdx).toBeGreaterThan(helpIdx);
    expect(html).toContain(`data-sleeveless-help-video="${NECKLINE_SHAPING_HELP_VIDEO_KEY}"`);
    expect(html).toContain("process of dividing and shaping a neckline");
    expect(html).toMatch(/place the center \d+ neckline stitches in hold/i);
    expect(html).toContain("Stage 3");
  });
});

describe("renderActiveShoulderChartIntroHtml", () => {
  const baseOpts = {
    wrapperClass: "pattern-shaping-intro",
    layout: "compact" as const,
  };

  it("links Scrap off and bind off to glossary ids for divided round necklines", () => {
    const html = renderActiveShoulderChartIntroHtml({
      ...baseOpts,
      localStartRcLabel: "RC:050",
      centerBindOffStitches: 10,
    });
    expect(html).toContain(`data-glossary-id="${SCRAP_OFF_GLOSSARY_ID}"`);
    expect(html).toContain(`data-glossary-id="${BIND_OFF_GLOSSARY_ID}"`);
    expect(html).toContain("glossary-tooltip-placeholder");
    expect(html).toContain(
      "divide the neckline by removing the center 10 neckline stitches from work.",
    );
    expect(html).toContain("Scrap off</span>, <span");
    expect(html).toContain(">bind off</span>, or place these stitches on hold according to your preferred method");
    expect(html).not.toMatch(/bind off the center/i);
    expect(html).toContain("Divide:");
    expect(html).toContain("work one shoulder at a time");
  });

  it("renders Before Shaping / Divide the Neckline workflow steps online for round-neck divide", () => {
    const html = renderActiveShoulderChartIntroHtml({
      ...baseOpts,
      localStartRcLabel: "RC:050",
      centerBindOffStitches: 10,
      includeWorkflowSteps: true,
    });
    expect(html).toContain("Before Shaping");
    // "Optional: Add a lifeline before dividing the neckline." with a glossary popup on "lifeline".
    expect(html).toContain(`data-glossary-id="${LIFELINE_GLOSSARY_ID}"`);
    expect(html).toContain("Optional: Add a <span");
    expect(html).toContain(">lifeline</span> before dividing the neckline.");
    // Lifeline comes first, then the "Knit until Armhole RC reaches {divideRc}." milestone.
    const lifelineIdx = html.indexOf("before dividing the neckline.");
    const knitUntilIdx = html.indexOf("Knit until Armhole RC reaches 050.");
    expect(lifelineIdx).toBeGreaterThanOrEqual(0);
    expect(knitUntilIdx).toBeGreaterThan(lifelineIdx);
    expect(html).toContain("Divide the Neckline");
    expect(html).toContain(
      "Place the remaining stitches on hold, or transfer them to scrap yarn if preferred.",
    );
    expect(html).toContain("Work one shoulder at a time.");
    // Preserves the calculated, glossary-linked center divide line (no calc change), now anchored "At RC".
    expect(html).toContain(
      "At RC 050, divide the neckline by removing the center 10 neckline stitches from work.",
    );
    expect(html).toContain("Scrap off</span>, <span");
    expect(html).toContain(">bind off</span>, or place these stitches on hold according to your preferred method");
    // The Divide the Neckline section no longer uses the "When Armhole RC reaches" milestone wording.
    expect(html).not.toMatch(/When Armhole RC reaches/i);
    // Workflow layout replaces the compact paragraph labels online.
    expect(html).not.toContain("Center Neckline:");
    expect(html).not.toContain("Divide:</strong>");
    // Jargon removed from the second-shoulder sentence.
    expect(html).not.toMatch(/reversing the edge landmarks/i);
    expect(html).toContain("work the second shoulder");
    expect(html).toContain(
      "<strong>reversing the neckline and shoulder shaping</strong>",
    );
  });

  it("renders the same workflow steps online for the V-neck front chart", () => {
    const r = vNeckPattern();
    const front = r.frontNeckShoulderShapingChart;
    expect(activeShoulderIntroUsesVNeckDivideCopy(front)).toBe(true);
    const html = renderActiveShoulderChartIntroHtml({
      ...baseOpts,
      localStartRcLabel: "RC:100",
      centerBindOffStitches: centerBindOffStitchesFromNeckShoulderChart(front),
      chart: front,
      includeWorkflowSteps: true,
    });
    expect(html).toContain("Before Shaping");
    // "Optional: Add a lifeline before dividing the neckline." with a glossary popup on "lifeline".
    expect(html).toContain(`data-glossary-id="${LIFELINE_GLOSSARY_ID}"`);
    expect(html).toContain("Optional: Add a <span");
    expect(html).toContain(">lifeline</span> before dividing the neckline.");
    // Lifeline first, then the "Knit until Armhole RC reaches {divideRc}." milestone.
    const lifelineIdx = html.indexOf("before dividing the neckline.");
    const knitUntilIdx = html.indexOf("Knit until Armhole RC reaches 100.");
    expect(lifelineIdx).toBeGreaterThanOrEqual(0);
    expect(knitUntilIdx).toBeGreaterThan(lifelineIdx);
    expect(html).toContain("Divide the Neckline");
    expect(html).toContain(
      "Place the remaining stitches on hold, or transfer them to scrap yarn if preferred.",
    );
    expect(html).toContain("Work one shoulder at a time.");
    // V-neck keeps its own divide-at-center wording (no round-neck scrap-off / bind-off), now anchored "At RC".
    expect(html).toMatch(/At RC 100, divide the piece at the center/i);
    expect(html).not.toMatch(/scrap off the center/i);
    expect(html).not.toMatch(/When Armhole RC reaches/i);
    expect(html).not.toContain("Center Neckline:");
    expect(html).not.toContain("Divide:</strong>");
    expect(html).toContain("work the second shoulder");
    expect(html).toContain(
      "<strong>reversing the neckline and shoulder shaping</strong>",
    );
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
    expect(html).toContain("Follow the checklist row by row");
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

describe("cardigan front neckline / shoulder chart copy", () => {
  const baseOpts = {
    wrapperClass: "pattern-shaping-intro",
    layout: "compact" as const,
  };

  it("uses cardigan front wording in intro and completion (not pullover divide language)", () => {
    const r = cardiganRoundFrontPattern();
    const chart = r.frontNeckShoulderShapingChart;
    const localStart = "RC:050";
    const center = centerBindOffStitchesFromNeckShoulderChart(chart);

    const introHtml = renderActiveShoulderChartIntroHtml({
      ...baseOpts,
      localStartRcLabel: localStart,
      centerBindOffStitches: center,
      chart,
    });
    const combined = `${introHtml}${renderNeckShoulderShapingChartTableOnlyHtml(chart, "test-cardigan-front", introHtml, {
      activeSideOnly: true,
      activeSideRcStart: armholeLocalRcActiveShoulderChecklistStart(chart, r.firstArmholeGarmentRc),
    })}`;

    expect(combined).toMatch(/center-front edge/i);
    expect(combined).toMatch(/opposite front/i);
    expect(combined).not.toMatch(/center neckline/i);
    expect(combined).not.toMatch(/divide the neckline/i);
    expect(combined).not.toMatch(/opposite shoulder/i);
    expect(combined).not.toMatch(/second side/i);
    expect(combined).not.toMatch(/second shoulder/i);
    expect(combined).not.toContain("Divide:");
    expect(combined).not.toContain("Center Neckline:");
  });

  it("keeps pullover front divide and second-side wording", () => {
    const r = roundNeckPattern();
    const chart = r.frontNeckShoulderShapingChart;
    const center = centerBindOffStitchesFromNeckShoulderChart(chart);

    const introHtml = renderActiveShoulderChartIntroHtml({
      ...baseOpts,
      localStartRcLabel: "RC:050",
      centerBindOffStitches: center,
      chart,
    });
    const combined = `${introHtml}${renderNeckShoulderShapingChartTableOnlyHtml(chart, "test-pullover-front", introHtml, {
      activeSideOnly: true,
      activeSideRcStart: armholeLocalRcActiveShoulderChecklistStart(chart, r.firstArmholeGarmentRc),
    })}`;

    expect(combined).toMatch(/divide the neckline/i);
    expect(combined).toMatch(/work one shoulder at a time/i);
    expect(combined).toMatch(/second shoulder/i);
    expect(combined).toContain("Center Neckline:");
    expect(combined).toContain("Divide:");
  });

  it("cardigan front plain paragraphs omit pullover divide phrases", () => {
    const r = cardiganRoundFrontPattern();
    const paras = activeShoulderIntroPlainParagraphs({
      localStartRcLabel: "RC:050",
      centerBindOffStitches: centerBindOffStitchesFromNeckShoulderChart(r.frontNeckShoulderShapingChart),
      chart: r.frontNeckShoulderShapingChart,
    });
    const text = paras.join(" ");
    expect(text).toMatch(/center-front edge/i);
    expect(text).toMatch(/following the chart below/i);
    expect(text).not.toMatch(/center neckline|divide the neckline|opposite shoulder|second side/i);
  });
});
