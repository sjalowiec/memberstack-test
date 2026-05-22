import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  formatBindOffNotation,
  formatCastOnNotation,
  formatRcNotation,
  garmentRcAtArmholeStart,
} from "./sleevelessBackJapaneseNotation";
import {
  JP_FRONT_NOTATION_SVG_TOKEN_KEYS,
  SLEEVELESS_CARDIGAN_ROUND_FRONT_DIAGRAM_SRC,
  SLEEVELESS_CARDIGAN_ROUND_FRONT_JP_NOTATION_DIAGRAM_SRC,
  SLEEVELESS_CARDIGAN_V_FRONT_DIAGRAM_SRC,
  SLEEVELESS_CARDIGAN_V_FRONT_JP_NOTATION_DIAGRAM_SRC,
  SLEEVELESS_FRONT_DIAGRAM_STS_ROWS_SRC,
  SLEEVELESS_FRONT_JP_NOTATION_DIAGRAM_SRC,
  SLEEVELESS_PULLOVER_V_FRONT_JP_NOTATION_DIAGRAM_SRC,
  buildFrontJapaneseNotationReplacements,
  isFrontJapaneseNotationSupported,
  resolveSleevelessFrontDiagramSrc,
} from "./sleevelessFrontJapaneseNotation";
import { resolveSleevelessFrontDiagram } from "./sleevelessFrontDiagramSrc";
import {
  collectInnerNeckDecreasePointsFromTimeline,
  neckEdgeNotationLinesFromNeckShoulderChart,
  renderNotationOverlayDiagram,
} from "./notationOverlaySvg";
import {
  shoulderShapingNotationLinesFromTimeline,
  totalStitchesFromShapingNotationLines,
} from "./shoulderShapingNotation";
import { compressStitchDecreasePointsToNotationLines } from "./shapingNotationCompress";

function joinTimelineInnerNeckNotation(result: ReturnType<typeof demoSleevelessBackPattern>): string {
  const timeline = result.frontNeckShoulderTimeline ?? [];
  const lines = compressStitchDecreasePointsToNotationLines(
    collectInnerNeckDecreasePointsFromTimeline(timeline, "right"),
  );
  return lines.filter((line) => line.length > 0).join("\n");
}
import {
  SAMPLE_JP_BACK_NOTATION_REPLACEMENTS,
  applyJapaneseNotationSvgReplacements,
  assertJapaneseNotationSvgFullyReplaced,
  findUnreplacedJapaneseNotationPlaceholders,
  listJapaneseNotationPlaceholdersInSvg,
} from "./sleevelessJapaneseNotationSvg";
import { demoSleevelessBackPattern, generateSleevelessBackPattern } from "./sleevelessPatternOutput";

const JP_FRONT_SVG = readFileSync(
  resolve(process.cwd(), "public/images/patterns/sleeveless/diagrams/diagram-jp-front-round.svg"),
  "utf8",
);

const JP_FRONT_V_SVG = readFileSync(
  resolve(process.cwd(), "public/images/patterns/sleeveless/diagrams/diagram-jp-front-v.svg"),
  "utf8",
);

const JP_CARDIGAN_ROUND_SVG = readFileSync(
  resolve(process.cwd(), "public/images/patterns/sleeveless/diagrams/diagram-jp-cardigan-round.svg"),
  "utf8",
);

const JP_CARDIGAN_V_SVG = readFileSync(
  resolve(process.cwd(), "public/images/patterns/sleeveless/diagrams/diagram-jp-cardigan-v.svg"),
  "utf8",
);

describe("isFrontJapaneseNotationSupported", () => {
  it("is true for pullover round neck with live front chart", () => {
    const result = demoSleevelessBackPattern();
    expect(isFrontJapaneseNotationSupported({}, result)).toBe(true);
    expect(result.frontNeckShoulderChartUsesLiveRows).toBe(true);
  });

  it("is true for round cardigan with live front chart", () => {
    const cardigan = generateSleevelessBackPattern({
      fit: {
        sizingChart: "misses",
        selectedMeasurements: {
          finished_bust_chest: 40,
          back_neck_to_hem: 22,
          armhole_depth: 8,
          neck_opening: 3,
          shoulder_width: 4.25,
        },
      },
      style: { garmentStyle: "cardigan", frontStyle: "open", recipientCategory: "misses" },
      yarnGaugeMachine: { gaugeStitchesPerInch: 5, gaugeRowsPerInch: 7, availableNeedles: 200 },
    });
    expect(cardigan.frontNeckShoulderChartUsesLiveRows).toBe(true);
    expect(isFrontJapaneseNotationSupported({ style: { garmentStyle: "cardigan" } }, cardigan)).toBe(
      true,
    );
  });

  it("is true for pullover V-neck with live front chart", () => {
    const vNeck = generateSleevelessBackPattern({
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
      style: { neckline: "v-neck", recipientCategory: "misses" },
      yarnGaugeMachine: { gaugeStitchesPerInch: 5, gaugeRowsPerInch: 7, availableNeedles: 200 },
    });
    expect(vNeck.frontNeckShoulderChartUsesLiveRows).toBe(true);
    expect(vNeck.frontNeckShoulderShapingChart.sleevelessFullWidthVNeckFront).toBe(true);
    expect(isFrontJapaneseNotationSupported({ style: { neckline: "v-neck" } }, vNeck)).toBe(true);
  });
});

describe("round pullover front diagram routing", () => {
  it("uses diagram-front-round.svg for sts-rows and diagram-jp-front-round.svg for notation", () => {
    const pattern = { style: { garmentStyle: "pullover", neckline: "round" } };
    const r = resolveSleevelessFrontDiagram(pattern, { devForceCardiganHalfLeft: false });
    expect(r.diagramType).toBe("pulloverFullFrontRound");
    expect(r.src).toBe(SLEEVELESS_FRONT_DIAGRAM_STS_ROWS_SRC);
    expect(SLEEVELESS_FRONT_DIAGRAM_STS_ROWS_SRC).toBe(
      "/images/patterns/sleeveless/diagrams/diagram-front-round.svg",
    );
    expect(SLEEVELESS_FRONT_JP_NOTATION_DIAGRAM_SRC).toBe(
      "/images/patterns/sleeveless/diagrams/diagram-jp-front-round.svg",
    );
    expect(resolveSleevelessFrontDiagramSrc("sts-rows", pattern)).toBe(SLEEVELESS_FRONT_DIAGRAM_STS_ROWS_SRC);
    expect(resolveSleevelessFrontDiagramSrc("shaping-notation", pattern)).toBe(
      SLEEVELESS_FRONT_JP_NOTATION_DIAGRAM_SRC,
    );
  });
});

describe("round cardigan front diagram routing", () => {
  it("uses diagram-cardigan-round.svg for sts-rows and diagram-jp-cardigan-round.svg for notation", () => {
    const pattern = { style: { garmentStyle: "cardigan", neckline: "round", frontStyle: "open" } };
    const r = resolveSleevelessFrontDiagram(pattern, { devForceCardiganHalfLeft: false });
    expect(r.diagramType).toBe("cardiganFullFrontRound");
    expect(r.src).toBe(SLEEVELESS_CARDIGAN_ROUND_FRONT_DIAGRAM_SRC);
    expect(resolveSleevelessFrontDiagramSrc("sts-rows", pattern)).toBe(
      SLEEVELESS_CARDIGAN_ROUND_FRONT_DIAGRAM_SRC,
    );
    expect(resolveSleevelessFrontDiagramSrc("shaping-notation", pattern)).toBe(
      SLEEVELESS_CARDIGAN_ROUND_FRONT_JP_NOTATION_DIAGRAM_SRC,
    );
  });
});

describe("v-neck cardigan front diagram routing", () => {
  it("uses diagram-cardigan-v.svg for sts-rows and diagram-jp-cardigan-v.svg for notation", () => {
    const pattern = { style: { garmentStyle: "cardigan", neckline: "v-neck" } };
    const r = resolveSleevelessFrontDiagram(pattern, { devForceCardiganHalfLeft: false });
    expect(r.diagramType).toBe("cardiganFullFrontV");
    expect(r.src).toBe(SLEEVELESS_CARDIGAN_V_FRONT_DIAGRAM_SRC);
    expect(resolveSleevelessFrontDiagramSrc("sts-rows", pattern)).toBe(SLEEVELESS_CARDIGAN_V_FRONT_DIAGRAM_SRC);
    expect(resolveSleevelessFrontDiagramSrc("shaping-notation", pattern)).toBe(
      SLEEVELESS_CARDIGAN_V_FRONT_JP_NOTATION_DIAGRAM_SRC,
    );
  });
});

describe("v-neck pullover front diagram routing", () => {
  it("uses diagram-front-v.svg for sts-rows and diagram-jp-front-v.svg for notation", () => {
    const pattern = { style: { garmentStyle: "pullover", neckline: "v-neck" } };
    const r = resolveSleevelessFrontDiagram(pattern, { devForceCardiganHalfLeft: false });
    expect(r.diagramType).toBe("pulloverFullFrontV");
    expect(r.src).toBe("/images/patterns/sleeveless/diagrams/diagram-front-v.svg");
    expect(resolveSleevelessFrontDiagramSrc("sts-rows", pattern)).toBe(
      "/images/patterns/sleeveless/diagrams/diagram-front-v.svg",
    );
    expect(resolveSleevelessFrontDiagramSrc("shaping-notation", pattern)).toBe(
      SLEEVELESS_PULLOVER_V_FRONT_JP_NOTATION_DIAGRAM_SRC,
    );
    expect(SLEEVELESS_PULLOVER_V_FRONT_JP_NOTATION_DIAGRAM_SRC).toBe(
      "/images/patterns/sleeveless/diagrams/diagram-jp-front-v.svg",
    );
  });
});

describe("buildFrontJapaneseNotationReplacements", () => {
  it("lists every jp/rc token name present in diagram-jp-front-round.svg", () => {
    const svgTokens = listJapaneseNotationPlaceholdersInSvg(JP_FRONT_SVG);
    expect(svgTokens).toEqual([...JP_FRONT_NOTATION_SVG_TOKEN_KEYS].sort());
  });

  it("replaces all jp/rc placeholders in diagram-jp-front-round.svg for demo pattern", () => {
    const result = demoSleevelessBackPattern();
    const repl = buildFrontJapaneseNotationReplacements(result, {});
    expect(() => assertJapaneseNotationSvgFullyReplaced(JP_FRONT_SVG, repl)).not.toThrow();
    expect(Object.keys(repl).sort()).toEqual([...JP_FRONT_NOTATION_SVG_TOKEN_KEYS].sort());
  });

  it("replaces all jp/rc placeholders in diagram-jp-front-v.svg for V-neck pullover", () => {
    const result = generateSleevelessBackPattern({
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
      style: { neckline: "v-neck", recipientCategory: "misses" },
      yarnGaugeMachine: { gaugeStitchesPerInch: 5, gaugeRowsPerInch: 7, availableNeedles: 200 },
    });
    const repl = buildFrontJapaneseNotationReplacements(result, { style: { neckline: "v-neck" } });
    expect(() => assertJapaneseNotationSvgFullyReplaced(JP_FRONT_V_SVG, repl)).not.toThrow();
    expect(repl["jp-caston"].length).toBeGreaterThan(0);
    expect(repl["jp-neckline-bo"]).toBe("");
  });

  it("stacks multiline neckline shaping bottom-up (first replacement line lowest)", () => {
    const out = applyJapaneseNotationSvgReplacements(
      JP_FRONT_SVG,
      SAMPLE_JP_BACK_NOTATION_REPLACEMENTS,
    );

    const neckBlock = out.match(/translate\(86\.22 151\.8\)[\s\S]*?<\/text>/)?.[0] ?? "";
    const tspans = [...neckBlock.matchAll(/<tspan[^>]*>([^<]*)<\/tspan>/g)].map((m) => m[1]);
    const lines = SAMPLE_JP_BACK_NOTATION_REPLACEMENTS["jp-neckline-shaping"].split("\n");

    expect(tspans).toEqual([...lines].reverse());
    expect(tspans[tspans.length - 1]).toBe("1s-2r-4x");
    expect(tspans[0]).toBe("3s-2r-2x");
    expect(out).not.toMatch(/1s-2r-4x[\r\n]+2s-1r-1x/);
  });

  it("leaves no raw {{jp- or {{rc- placeholders in output after live replacement", () => {
    const result = demoSleevelessBackPattern();
    const repl = buildFrontJapaneseNotationReplacements(result, {});
    const out = applyJapaneseNotationSvgReplacements(JP_FRONT_SVG, repl);
    expect(findUnreplacedJapaneseNotationPlaceholders(out)).toEqual([]);
    expect(out).not.toMatch(/\{\{\s*jp-/i);
    expect(out).not.toMatch(/\{\{\s*rc[-_]/i);
    expect(out).toContain(repl["jp-caston"]);
    expect(out).toContain(repl["jp-body-rows"]);
    expect(out).toContain(repl["jp-armhole-bo"]);
  });

  function overlayNotationLabels(html: string, stack: "neck" | "shoulder"): string[] {
    const re = new RegExp(`stack--${stack}[^>]*>([\\s\\S]*?)<\\/div>`);
    const m = html.match(re);
    if (!m?.[1]) return [];
    return [...m[1].matchAll(/class="ns-notation-overlay__label">([^<]*)/g)].map((x) => String(x[1]));
  }

  function tspanTextsFromSvgBlock(svgOut: string, transformSnippet: string): string[] {
    const block = svgOut.match(new RegExp(`${transformSnippet}[\\s\\S]*?<\\/text>`))?.[0] ?? "";
    return [...block.matchAll(/<tspan[^>]*>([^<]*)<\/tspan>/g)].map((m) => m[1]!);
  }

  it("jp-neckline-shaping matches front neckline/shoulder diagram neck summary", () => {
    const result = demoSleevelessBackPattern();
    const chart = result.frontNeckShoulderShapingChart;
    const repl = buildFrontJapaneseNotationReplacements(result, {});

    const fromChart = neckEdgeNotationLinesFromNeckShoulderChart(chart, "right");
    const overlayHtml = renderNotationOverlayDiagram(chart, "right", {});
    const overlayNeck = overlayNotationLabels(overlayHtml, "neck");

    expect(repl["jp-neckline-shaping"]).toBe(fromChart.join("\n"));
    expect(repl["jp-neckline-shaping"]).toBe(overlayNeck.join("\n"));
    expect(fromChart.length).toBeGreaterThan(1);

    const timelineOnly = joinTimelineInnerNeckNotation(result);
    expect(repl["jp-neckline-shaping"]).not.toBe(timelineOnly);
    expect(repl["jp-neckline-shaping"].split("\n")).toEqual(
      expect.arrayContaining(["1s-2r-2x", "2s-1r-1x"]),
    );
    expect(repl["jp-neckline-shaping"].split("\n").length).toBeGreaterThan(1);

    const out = applyJapaneseNotationSvgReplacements(JP_FRONT_SVG, repl);
    const tspans = tspanTextsFromSvgBlock(out, "translate\\(86\\.22 151\\.8\\)");
    const lines = repl["jp-neckline-shaping"].split("\n").filter((l) => l.length > 0);
    expect(tspans).toEqual([...lines].reverse());
    expect(tspans[tspans.length - 1]).toBe(lines[0]);
  });

  it("jp-shoulder-shaping matches timeline shoulder summary (no bo prefix)", () => {
    const result = demoSleevelessBackPattern();
    const chart = result.frontNeckShoulderShapingChart;
    const repl = buildFrontJapaneseNotationReplacements(result, {});
    const timeline = result.frontNeckShoulderTimeline ?? [];

    const fromTimeline = shoulderShapingNotationLinesFromTimeline(timeline, "right");
    const overlayHtml = renderNotationOverlayDiagram(chart, "right", {});
    const overlayShoulder = overlayNotationLabels(overlayHtml, "shoulder");

    expect(repl["jp-shoulder-shaping"]).toBe(fromTimeline.join("\n"));
    expect(repl["jp-shoulder-shaping"]).toBe(overlayShoulder.join("\n"));
    expect(repl["jp-shoulder-shaping"]).not.toMatch(/^bo/i);
    expect(repl["jp-shoulder-shaping"].split("\n").length).toBeGreaterThan(1);

    const out = applyJapaneseNotationSvgReplacements(JP_FRONT_SVG, repl);
    const tspans = tspanTextsFromSvgBlock(out, "translate\\(175\\.17 94\\.74\\)");
    const lines = repl["jp-shoulder-shaping"].split("\n").filter((l) => l.length > 0);
    expect(tspans).toEqual([...lines].reverse());
  });

  it("builds live front tokens from demo pullover round neck", () => {
    const result = demoSleevelessBackPattern();
    const repl = buildFrontJapaneseNotationReplacements(result, {});
    const castOn = result.debug.hemCastOnStitches ?? result.debug.backStitches;

    expect(repl["jp-neckline-bo"]).toBe(
      formatBindOffNotation(result.debug.centerNeckBindOffStitches ?? 0),
    );
    expect(repl["jp-neckline-bo"].length).toBeGreaterThan(0);
    expect(repl["jp-caston"]).toBe(formatCastOnNotation(castOn));
    expect(repl["jp-body-rows"]).toBe(`${result.debug.bodyRows}r`);
    expect(repl["rc-hem"]).toBe(formatRcNotation(result.debug.hemRows));
    const armholeStartRc = garmentRcAtArmholeStart(result.debug);
    expect(repl["rc-armhole-bo"]).toBe(formatRcNotation(armholeStartRc!));
    if (result.debug.frontNecklineStartLocalRC !== undefined) {
      expect(repl["rc-neckline-start"]).toBe(
        formatRcNotation(result.debug.frontNecklineStartLocalRC),
      );
    }
  });

  it("returns empty tokens when front chart is not live", () => {
    const svgTokens = listJapaneseNotationPlaceholdersInSvg(JP_FRONT_SVG);
    expect(svgTokens.length).toBeGreaterThan(0);

    const result = demoSleevelessBackPattern();
    const saved = result.frontNeckShoulderChartUsesLiveRows;
    (result as { frontNeckShoulderChartUsesLiveRows: boolean }).frontNeckShoulderChartUsesLiveRows = false;
    const repl = buildFrontJapaneseNotationReplacements(result, {});
    expect(repl["jp-caston"]).toBe("");
    (result as { frontNeckShoulderChartUsesLiveRows: boolean }).frontNeckShoulderChartUsesLiveRows = saved;
  });

  it("uses cardigan half-panel cast-on for round cardigan notation", () => {
    const result = generateSleevelessBackPattern({
      fit: {
        sizingChart: "misses",
        selectedMeasurements: {
          finished_bust_chest: 40,
          back_neck_to_hem: 22,
          armhole_depth: 8,
          neck_opening: 3,
          shoulder_width: 4.25,
        },
      },
      style: { garmentStyle: "cardigan", frontStyle: "open", recipientCategory: "misses" },
      yarnGaugeMachine: { gaugeStitchesPerInch: 5, gaugeRowsPerInch: 7, availableNeedles: 200 },
    });
    const patternData = { style: { garmentStyle: "cardigan", frontStyle: "open" } };
    const repl = buildFrontJapaneseNotationReplacements(result, patternData);
    expect(result.debug.cardiganHalfLeftCastOnSts).toBeDefined();
    expect(repl["jp-caston"]).toBe(formatCastOnNotation(result.debug.cardiganHalfLeftCastOnSts!));
    expect(repl["jp-caston"]).not.toBe(formatCastOnNotation(result.debug.backStitches ?? 0));
    expect(() => assertJapaneseNotationSvgFullyReplaced(JP_CARDIGAN_ROUND_SVG, repl)).not.toThrow();
  });

  it("replaces all jp/rc placeholders in diagram-jp-cardigan-v.svg for V-neck cardigan", () => {
    const result = generateSleevelessBackPattern({
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
      style: { garmentStyle: "cardigan", neckline: "v-neck", recipientCategory: "misses" },
      yarnGaugeMachine: { gaugeStitchesPerInch: 5, gaugeRowsPerInch: 7, availableNeedles: 200 },
    });
    const repl = buildFrontJapaneseNotationReplacements(result, {
      style: { garmentStyle: "cardigan", neckline: "v-neck" },
    });
    expect(() => assertJapaneseNotationSvgFullyReplaced(JP_CARDIGAN_V_SVG, repl)).not.toThrow();
    expect(repl["jp-neckline-bo"]).toBe("");
    expect(repl["jp-caston"].length).toBeGreaterThan(0);
  });
});
