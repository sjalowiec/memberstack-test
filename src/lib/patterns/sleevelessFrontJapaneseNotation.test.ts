import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  formatBindOffNotation,
  formatCastOnNotation,
  formatRcNotation,
  garmentRcAtArmholeStart,
  buildBackJapaneseNotationReplacements,
} from "./sleevelessBackJapaneseNotation";
import {
  JP_FRONT_NOTATION_SVG_TOKEN_KEYS,
  SLEEVELESS_CARDIGAN_ROUND_ALINE_FRONT_JP_NOTATION_DIAGRAM_SRC,
  SLEEVELESS_CARDIGAN_ROUND_FRONT_DIAGRAM_SRC,
  SLEEVELESS_CARDIGAN_ROUND_FRONT_JP_NOTATION_DIAGRAM_SRC,
  SLEEVELESS_CARDIGAN_V_ALINE_FRONT_JP_NOTATION_DIAGRAM_SRC,
  SLEEVELESS_CARDIGAN_V_FRONT_DIAGRAM_SRC,
  SLEEVELESS_CARDIGAN_V_FRONT_JP_NOTATION_DIAGRAM_SRC,
  SLEEVELESS_FRONT_DIAGRAM_STS_ROWS_SRC,
  SLEEVELESS_FRONT_JP_NOTATION_DIAGRAM_SRC,
  SLEEVELESS_PULLOVER_ROUND_ALINE_FRONT_JP_NOTATION_DIAGRAM_SRC,
  SLEEVELESS_PULLOVER_V_FRONT_JP_NOTATION_DIAGRAM_SRC,
  SLEEVELESS_PULLOVER_V_ALINE_FRONT_JP_NOTATION_DIAGRAM_SRC,
  buildFrontJapaneseNotationReplacements,
  isFrontJapaneseNotationSupported,
  resolveSleevelessFrontDiagramSrc,
} from "./sleevelessFrontJapaneseNotation";
import {
  resolveSleevelessFrontDiagram,
  SLEEVELESS_CARDIGAN_ROUND_ALINE_FRONT_DIAGRAM_SRC,
  SLEEVELESS_CARDIGAN_V_ALINE_FRONT_DIAGRAM_SRC,
  SLEEVELESS_PULLOVER_ROUND_ALINE_FRONT_DIAGRAM_SRC,
} from "./sleevelessFrontDiagramSrc";
import {
  collectInnerNeckDecreasePointsFromTimeline,
  neckEdgeNotationLinesFromNeckShoulderChart,
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
import {
  cardiganFrontInitialNeckBindOffStitches,
  roundNeckOneSideNeckEdgeNotationLines,
} from "./roundNeckNotation";
import { buildSleevelessGarmentDiagramReplacements } from "./sleevelessGarmentDiagramReplacements";
import { pulloverRoundFrontNeckEdgeNotationLines } from "./sleevelessFrontJapaneseNotation";
import { SLEEVELESS_QA_SCENARIOS } from "./testScenarios/sleevelessPatternQaMatrix";
import {
  demoSleevelessBackPattern,
  generateSleevelessBackPattern,
  initialNeckBindOffFromNeckShoulderChart,
} from "./sleevelessPatternOutput";
import { neckEdgeNotationLinesFromNeckShoulderChart } from "./notationOverlaySvg";

const JP_FRONT_SVG = readFileSync(
  resolve(process.cwd(), "public/images/patterns/sleeveless/diagrams/diagram-jp-front-round.svg"),
  "utf8",
);

const JP_FRONT_V_SVG = readFileSync(
  resolve(process.cwd(), "public/images/patterns/sleeveless/diagrams/diagram-jp-front-v.svg"),
  "utf8",
);

const JP_FRONT_ALINE_SVG = readFileSync(
  resolve(
    process.cwd(),
    "public/images/patterns/sleeveless/diagrams/diagram-jp-front-round-aline.svg",
  ),
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

function symmetricalCardiganPattern(neckline: string): Record<string, unknown> {
  return {
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
    style: { garmentStyle: "cardigan", neckline, frontStyle: "open", recipientCategory: "misses" },
    yarnGaugeMachine: { gaugeStitchesPerInch: 5, gaugeRowsPerInch: 7, availableNeedles: 200 },
  };
}

function symmetricalPulloverPattern(neckline: string): Record<string, unknown> {
  const cardigan = symmetricalCardiganPattern(neckline);
  const styleIn =
    cardigan.style && typeof cardigan.style === "object" && !Array.isArray(cardigan.style)
      ? ({ ...(cardigan.style as Record<string, unknown>) } as Record<string, unknown>)
      : {};
  return {
    ...cardigan,
    style: { ...styleIn, garmentStyle: "pullover", frontStyle: "closed", neckline },
  };
}

function castOnStitchesFromJpNotation(castOnToken: string): number {
  const m = castOnToken.match(/^co(\d+)$/);
  return Number(m?.[1] ?? NaN);
}

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

const alineFit = {
  fit: { selectedMeasurements: { finished_bust_chest: 38, finished_hip: 44 } },
  style: { bodyShape: "aline" },
};

describe("A-line front diagram routing (all necklines and cardigan)", () => {
  it("round pullover uses round-aline SVGs in both modes", () => {
    const pattern = {
      ...alineFit,
      style: { garmentStyle: "pullover", neckline: "round", bodyShape: "aline" },
    };
    expect(resolveSleevelessFrontDiagramSrc("sts-rows", pattern)).toBe(
      SLEEVELESS_PULLOVER_ROUND_ALINE_FRONT_DIAGRAM_SRC,
    );
    expect(resolveSleevelessFrontDiagramSrc("shaping-notation", pattern)).toBe(
      SLEEVELESS_PULLOVER_ROUND_ALINE_FRONT_JP_NOTATION_DIAGRAM_SRC,
    );
  });

  it("round cardigan uses cardigan-round-aline SVGs in both modes", () => {
    const pattern = {
      ...alineFit,
      style: { garmentStyle: "cardigan", neckline: "round", frontStyle: "open", bodyShape: "aline" },
    };
    expect(resolveSleevelessFrontDiagramSrc("sts-rows", pattern)).toBe(
      SLEEVELESS_CARDIGAN_ROUND_ALINE_FRONT_DIAGRAM_SRC,
    );
    expect(resolveSleevelessFrontDiagramSrc("shaping-notation", pattern)).toBe(
      SLEEVELESS_CARDIGAN_ROUND_ALINE_FRONT_JP_NOTATION_DIAGRAM_SRC,
    );
  });

  it("v-neck cardigan uses cardigan-v-aline SVGs in both modes", () => {
    const pattern = {
      ...alineFit,
      style: { garmentStyle: "cardigan", neckline: "v-neck", bodyShape: "aline" },
    };
    expect(resolveSleevelessFrontDiagramSrc("sts-rows", pattern)).toBe(
      SLEEVELESS_CARDIGAN_V_ALINE_FRONT_DIAGRAM_SRC,
    );
    expect(resolveSleevelessFrontDiagramSrc("shaping-notation", pattern)).toBe(
      SLEEVELESS_CARDIGAN_V_ALINE_FRONT_JP_NOTATION_DIAGRAM_SRC,
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

  it("uses A-line SVGs for sts-rows and shaping notation when body shape is A-line", () => {
    const pattern = {
      style: { garmentStyle: "pullover", neckline: "v-neck", bodyShape: "aline" },
      fit: {
        selectedMeasurements: { finished_bust_chest: 38, finished_hip: 44 },
      },
    };
    const r = resolveSleevelessFrontDiagram(pattern, { devForceCardiganHalfLeft: false });
    expect(r.src).toBe("/images/patterns/sleeveless/diagrams/diagram-front-v-aline.svg");
    expect(resolveSleevelessFrontDiagramSrc("sts-rows", pattern)).toBe(
      "/images/patterns/sleeveless/diagrams/diagram-front-v-aline.svg",
    );
    expect(resolveSleevelessFrontDiagramSrc("shaping-notation", pattern)).toBe(
      SLEEVELESS_PULLOVER_V_ALINE_FRONT_JP_NOTATION_DIAGRAM_SRC,
    );
    expect(SLEEVELESS_PULLOVER_V_ALINE_FRONT_JP_NOTATION_DIAGRAM_SRC).toBe(
      "/images/patterns/sleeveless/diagrams/diagram-jp-front-v-aline.svg",
    );
  });
});

describe("buildFrontJapaneseNotationReplacements", () => {
  it("lists every jp/rc token name present in diagram-jp-front-round.svg", () => {
    const svgTokens = listJapaneseNotationPlaceholdersInSvg(JP_FRONT_SVG);
    expect(svgTokens.every((t) => JP_FRONT_NOTATION_SVG_TOKEN_KEYS.includes(t as never))).toBe(true);
  });

  it("replaces all jp/rc placeholders in diagram-jp-front-round.svg for demo pattern", () => {
    const result = demoSleevelessBackPattern();
    const repl = buildFrontJapaneseNotationReplacements(result, {});
    expect(() => assertJapaneseNotationSvgFullyReplaced(JP_FRONT_SVG, repl)).not.toThrow();
    expect(Object.keys(repl).sort()).toEqual([...JP_FRONT_NOTATION_SVG_TOKEN_KEYS].sort());
  });

  it("replaces all jp/rc placeholders in diagram-jp-front-round-aline.svg for demo pattern", () => {
    const result = demoSleevelessBackPattern();
    const repl = buildFrontJapaneseNotationReplacements(result, {});
    expect(() => assertJapaneseNotationSvgFullyReplaced(JP_FRONT_ALINE_SVG, repl)).not.toThrow();
    const svgTokens = listJapaneseNotationPlaceholdersInSvg(JP_FRONT_ALINE_SVG);
    expect(svgTokens.every((t) => JP_FRONT_NOTATION_SVG_TOKEN_KEYS.includes(t as never))).toBe(true);
    expect(svgTokens).toContain("rc-shoulder-start");
    expect(svgTokens).toContain("jp-body-shaping");
    expect(svgTokens).toContain("jp-armhole-shaping");
    expect(repl["jp-body-shaping"]).toBe("");
    expect(repl["jp-armhole-shaping"].length).toBeGreaterThan(0);
    const out = applyJapaneseNotationSvgReplacements(JP_FRONT_ALINE_SVG, repl);
    expect(findUnreplacedJapaneseNotationPlaceholders(out)).toEqual([]);
    expect(out).toContain(repl["jp-caston"]);
    for (const line of repl["jp-neckline-shaping"].split("\n").filter(Boolean)) {
      expect(out).toContain(line);
    }
    expect(out).toContain(repl["rc-shoulder-start"]);
    expect(out).toContain("(neck)");
    expect(out).toContain("(shoulder)");
  });

  it("jp-body-shaping encodes A-line side shaping from hem to armhole", () => {
    const fullPattern = {
      fit: {
        sizingChart: "misses",
        selectedMeasurements: {
          finished_bust_chest: 38,
          finished_hip: 44,
          back_neck_to_hem: 22,
          armhole_depth: 8,
          neck_opening: 3,
          shoulder_width: 4.25,
          front_neck_depth: 3,
          back_neck_depth: 1,
        },
      },
      style: { garmentStyle: "pullover", bodyShape: "aline", recipientCategory: "misses" },
      yarnGaugeMachine: { gaugeStitchesPerInch: 5, gaugeRowsPerInch: 7, availableNeedles: 200 },
    };
    const result = generateSleevelessBackPattern(fullPattern);
    const repl = buildFrontJapaneseNotationReplacements(result, {
      style: { bodyShape: "aline" },
      fit: { selectedMeasurements: { finished_bust_chest: 38, finished_hip: 44 } },
    });
    expect(repl["jp-body-shaping"].length).toBeGreaterThan(0);
    expect(
      repl["jp-body-shaping"]
        .split("\n")
        .every((line) => /^\d+s-\d+r-\d+x$/.test(line)),
    ).toBe(true);
    expect(() => assertJapaneseNotationSvgFullyReplaced(JP_FRONT_ALINE_SVG, repl)).not.toThrow();
  });

  it("jp-body-shaping uses stored cast-on when patternData is style-only (pattern tab path)", () => {
    const fullPattern = {
      fit: {
        sizingChart: "misses",
        selectedMeasurements: {
          finished_bust_chest: 38,
          finished_hip: 44,
          back_neck_to_hem: 22,
          armhole_depth: 8,
          neck_opening: 3,
          shoulder_width: 4.25,
          front_neck_depth: 3,
          back_neck_depth: 1,
        },
      },
      style: { garmentStyle: "pullover", bodyShape: "aline", recipientCategory: "misses" },
      yarnGaugeMachine: { gaugeStitchesPerInch: 5, gaugeRowsPerInch: 7, availableNeedles: 200 },
    };
    const result = generateSleevelessBackPattern(fullPattern);
    const withFullData = buildFrontJapaneseNotationReplacements(result, fullPattern);
    const styleOnly = buildFrontJapaneseNotationReplacements(result, {
      style: { garmentStyle: "pullover", bodyShape: "aline", neckline: "round" },
    });
    expect(withFullData["jp-body-shaping"].length).toBeGreaterThan(0);
    expect(styleOnly["jp-body-shaping"]).toBe(withFullData["jp-body-shaping"]);
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

    const neckBlock = out.match(/translate\(33\.92 90\.69\)[\s\S]*?<\/text>/)?.[0] ?? "";
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

  function tspanTextsFromSvgBlock(svgOut: string, transformSnippet: string): string[] {
    const block = svgOut.match(new RegExp(`${transformSnippet}[\\s\\S]*?<\\/text>`))?.[0] ?? "";
    return [...block.matchAll(/<tspan[^>]*>([^<]*)<\/tspan>/g)].map((m) => m[1]!);
  }

  it("jp-neckline-shaping matches front neck-edge chart summary", () => {
    const result = demoSleevelessBackPattern();
    const chart = result.frontNeckShoulderShapingChart;
    const repl = buildFrontJapaneseNotationReplacements(result, {});

    const fromChart = neckEdgeNotationLinesFromNeckShoulderChart(chart, "right");

    expect(repl["jp-neckline-shaping"]).toBe(fromChart.join("\n"));
    expect(fromChart.length).toBeGreaterThan(1);

    const timelineOnly = joinTimelineInnerNeckNotation(result);
    expect(repl["jp-neckline-shaping"]).not.toBe(timelineOnly);
    expect(repl["jp-neckline-shaping"].split("\n")).toEqual(
      expect.arrayContaining(["1s-2r-2x", "2s-1r-1x"]),
    );
    expect(repl["jp-neckline-shaping"].split("\n").length).toBeGreaterThan(1);

    const out = applyJapaneseNotationSvgReplacements(JP_FRONT_SVG, repl);
    const tspans = tspanTextsFromSvgBlock(out, "translate\\(33\\.92 90\\.69\\)");
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

    expect(repl["jp-shoulder-shaping"]).toBe(fromTimeline.join("\n"));
    expect(repl["jp-shoulder-shaping"]).not.toMatch(/^bo/i);
    expect(repl["jp-shoulder-shaping"].split("\n").length).toBeGreaterThan(1);

    const out = applyJapaneseNotationSvgReplacements(JP_FRONT_SVG, repl);
    const tspans = tspanTextsFromSvgBlock(out, "translate\\(175\\.12 94\\.71\\)");
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
    const patternData = {
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
      style: { garmentStyle: "cardigan", frontStyle: "open", recipientCategory: "misses" },
      yarnGaugeMachine: { gaugeStitchesPerInch: 5, gaugeRowsPerInch: 7, availableNeedles: 200 },
    };
    const result = generateSleevelessBackPattern(patternData);
    const repl = buildFrontJapaneseNotationReplacements(result, patternData);
    expect(result.debug.cardiganHalfLeftCastOnSts).toBeDefined();
    expect(repl["jp-caston"]).toBe(formatCastOnNotation(result.debug.cardiganHalfLeftCastOnSts!));
    expect(repl["jp-caston"]).not.toBe(formatCastOnNotation(result.debug.backStitches ?? 0));
    expect(() => assertJapaneseNotationSvgFullyReplaced(JP_CARDIGAN_ROUND_SVG, repl)).not.toThrow();
    const fullNeck = result.debug.necklineStitches ?? 0;
    const cfInitial = cardiganFrontInitialNeckBindOffStitches(fullNeck);
    expect(cfInitial).toBeGreaterThan(0);
    expect(repl["jp-neckline-bo"]).toBe(formatBindOffNotation(cfInitial));
    expect(repl["jp-neckline-bo"]).not.toBe(
      formatBindOffNotation(result.debug.centerNeckBindOffStitches ?? 0),
    );
    const pulloverShaping = buildFrontJapaneseNotationReplacements(
      generateSleevelessBackPattern(symmetricalPulloverPattern("round")),
      symmetricalPulloverPattern("round"),
    )["jp-neckline-shaping"];
    expect(repl["jp-neckline-shaping"].length).toBeGreaterThan(0);
    expect(repl["jp-neckline-shaping"]).toBe(pulloverShaping);
    expect(repl["jp-neckline-shaping"]).not.toBe(
      neckEdgeNotationLinesFromNeckShoulderChart(result.frontNeckShoulderShapingChart, "right").join(
        "\n",
      ),
    );
    const out = applyJapaneseNotationSvgReplacements(JP_CARDIGAN_ROUND_SVG, repl);
    const firstLine = repl["jp-neckline-shaping"].split("\n").filter(Boolean)[0]!;
    expect(out).toContain(firstLine);
    expect(out).not.toMatch(/\{\{\s*jp-neckline-shaping\s*\}\}/i);
  });

  it("replaces all jp/rc placeholders in diagram-jp-cardigan-v.svg for V-neck cardigan", () => {
    const patternData = symmetricalCardiganPattern("v-neck");
    const result = generateSleevelessBackPattern(patternData);
    const repl = buildFrontJapaneseNotationReplacements(result, {
      style: { garmentStyle: "cardigan", neckline: "v-neck" },
    });
    expect(() => assertJapaneseNotationSvgFullyReplaced(JP_CARDIGAN_V_SVG, repl)).not.toThrow();
    expect(repl["jp-neckline-bo"]).toBe("");
    expect(repl["jp-caston"].length).toBeGreaterThan(0);

    const backCastOn = result.debug.backStitches ?? 0;
    const frontCastOn = castOnStitchesFromJpNotation(repl["jp-caston"]);
    expect(frontCastOn).toBe(Math.ceil(backCastOn / 2));
    expect(repl["jp-caston"]).not.toBe(formatCastOnNotation(backCastOn));
  });

  it("pullover V-neck jp-neckline-shaping uses live front chart (not round-neck shortcut)", () => {
    const patternData = {
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
    };
    const result = generateSleevelessBackPattern(patternData);
    const repl = buildFrontJapaneseNotationReplacements(result, { style: { neckline: "v-neck" } });
    const fromChart = neckEdgeNotationLinesFromNeckShoulderChart(
      result.frontNeckShoulderShapingChart,
      "right",
    );

    expect(repl["jp-neckline-bo"]).toBe("");
    expect(repl["jp-neckline-shaping"].length).toBeGreaterThan(0);
    expect(repl["jp-neckline-shaping"]).toBe(fromChart.join("\n"));
  });

  it("V-neck cardigan front jp-neckline-shaping uses live front chart (not round cardigan shortcut)", () => {
    const patternData = symmetricalCardiganPattern("v-neck");
    const result = generateSleevelessBackPattern(patternData);
    const repl = buildFrontJapaneseNotationReplacements(result, patternData);
    const fromChart = neckEdgeNotationLinesFromNeckShoulderChart(
      result.frontNeckShoulderShapingChart,
      "right",
    );

    expect(repl["jp-neckline-bo"]).toBe("");
    expect(result.frontNeckShoulderShapingChart.sleevelessFullWidthVNeckFront).toBe(true);
    expect(repl["jp-neckline-shaping"].length).toBeGreaterThan(0);
    expect(repl["jp-neckline-shaping"]).toBe(fromChart.join("\n"));
    expect(repl["jp-neckline-shaping"]).not.toEqual("");
    const fullNeck = result.debug.necklineStitches ?? 0;
    expect(repl["jp-neckline-shaping"]).not.toBe(
      roundNeckOneSideNeckEdgeNotationLines(fullNeck, "right").join("\n"),
    );
    const out = applyJapaneseNotationSvgReplacements(JP_CARDIGAN_V_SVG, repl);
    expect(out).toContain(fromChart[0]!);
    expect(out).not.toMatch(/\{\{\s*jp-neckline-shaping\s*\}\}/i);
  });

  it("round cardigan jp-shoulder-shaping matches back and pullover for same inputs", () => {
    const cardiganPattern = symmetricalCardiganPattern("round");
    const pulloverPattern = symmetricalPulloverPattern("round");
    const cardigan = generateSleevelessBackPattern(cardiganPattern);
    const pullover = generateSleevelessBackPattern(pulloverPattern);
    const backRepl = buildBackJapaneseNotationReplacements(cardigan, cardiganPattern);
    const cardiganRepl = buildFrontJapaneseNotationReplacements(cardigan, cardiganPattern);
    const pulloverRepl = buildFrontJapaneseNotationReplacements(pullover, pulloverPattern);

    expect(cardiganRepl["jp-shoulder-shaping"].length).toBeGreaterThan(0);
    expect(cardiganRepl["jp-shoulder-shaping"]).toBe(backRepl["jp-shoulder-shaping"]);
    expect(cardiganRepl["jp-shoulder-shaping"]).toBe(pulloverRepl["jp-shoulder-shaping"]);
  });

  it("round cardigan jp-shoulder-shaping uses back timeline when style-only patternData", () => {
    const patternData = symmetricalCardiganPattern("round");
    const result = generateSleevelessBackPattern(patternData);
    const styleOnly = {
      style: { garmentStyle: "cardigan", neckline: "round", frontStyle: "open" },
    };
    const backRepl = buildBackJapaneseNotationReplacements(result, styleOnly);
    const repl = buildFrontJapaneseNotationReplacements(result, styleOnly);

    expect(repl["jp-shoulder-shaping"]).toBe(backRepl["jp-shoulder-shaping"]);
    expect(repl["jp-shoulder-shaping"].length).toBeGreaterThan(0);
  });

  it("round cardigan jp-neckline-shaping matches pullover round for same inputs", () => {
    const cardiganPattern = symmetricalCardiganPattern("round");
    const pulloverPattern = symmetricalPulloverPattern("round");
    const cardigan = generateSleevelessBackPattern(cardiganPattern);
    const pullover = generateSleevelessBackPattern(pulloverPattern);
    const cardiganRepl = buildFrontJapaneseNotationReplacements(cardigan, cardiganPattern);
    const pulloverRepl = buildFrontJapaneseNotationReplacements(pullover, pulloverPattern);

    expect(cardiganRepl["jp-neckline-shaping"].length).toBeGreaterThan(0);
    expect(cardiganRepl["jp-neckline-shaping"]).toBe(pulloverRepl["jp-neckline-shaping"]);
    expect(cardiganRepl["jp-neckline-bo"].length).toBeGreaterThan(0);
    expect(cardiganRepl["jp-neckline-bo"]).not.toBe(pulloverRepl["jp-neckline-bo"]);
  });

  it("round cardigan jp-neckline-shaping works when patternData is style-only (page path)", () => {
    const patternData = symmetricalCardiganPattern("round");
    const result = generateSleevelessBackPattern(patternData);
    const styleOnly = {
      style: { garmentStyle: "cardigan", neckline: "round", frontStyle: "open" },
    };
    const pulloverShaping = buildFrontJapaneseNotationReplacements(
      generateSleevelessBackPattern(symmetricalPulloverPattern("round")),
      symmetricalPulloverPattern("round"),
    )["jp-neckline-shaping"];
    const repl = buildFrontJapaneseNotationReplacements(result, styleOnly);

    expect(pulloverRoundFrontNeckEdgeNotationLines(styleOnly, "right")).toEqual([]);
    expect(repl["jp-neckline-shaping"].length).toBeGreaterThan(0);
    expect(repl["jp-neckline-shaping"]).toBe(pulloverShaping);
    const out = applyJapaneseNotationSvgReplacements(JP_CARDIGAN_ROUND_SVG, repl);
    expect(out).toContain(repl["jp-neckline-shaping"].split("\n").filter(Boolean)[0]!);
    expect(out).not.toMatch(/\{\{\s*jp-neckline-shaping\s*\}\}/i);
  });

  it("round cardigan jp-neckline-shaping stays on round-neck path (no V-neck labels)", () => {
    const patternData = symmetricalCardiganPattern("round");
    const result = generateSleevelessBackPattern(patternData);
    const repl = buildFrontJapaneseNotationReplacements(result, patternData);
    const pulloverShaping = buildFrontJapaneseNotationReplacements(
      generateSleevelessBackPattern(symmetricalPulloverPattern("round")),
      symmetricalPulloverPattern("round"),
    )["jp-neckline-shaping"];

    expect(result.frontNeckShoulderShapingChart.sleevelessFullWidthVNeckFront).not.toBe(true);
    expect(repl["jp-neckline-shaping"]).toBe(pulloverShaping);
    expect(repl["jp-neckline-bo"].length).toBeGreaterThan(0);
  });

  it("pullover round jp-neckline-shaping renders into diagram-jp-front-round.svg", () => {
    const result = demoSleevelessBackPattern();
    const repl = buildFrontJapaneseNotationReplacements(result, {});
    const lines = repl["jp-neckline-shaping"].split("\n").filter((l) => l.length > 0);
    expect(lines.length).toBeGreaterThan(0);
    const out = applyJapaneseNotationSvgReplacements(JP_FRONT_SVG, repl);
    expect(out).toContain(lines[lines.length - 1]!);
    expect(out).not.toMatch(/\{\{\s*jp-neckline-shaping\s*\}\}/i);
  });
});

/** SVG replacement keys compared across back / pullover front / cardigan front for one pattern profile. */
const JP_CROSS_PIECE_SHAPING_KEYS = [
  "jp-neckline-shaping",
  "jp-shoulder-shaping",
  "jp-neckline-bo",
  "jp-caston",
] as const;

type JpCrossPieceShapingKey = (typeof JP_CROSS_PIECE_SHAPING_KEYS)[number];

function pickJpShapingTokens(repl: Record<string, string>): Record<JpCrossPieceShapingKey, string> {
  return Object.fromEntries(
    JP_CROSS_PIECE_SHAPING_KEYS.map((key) => [key, repl[key] ?? ""]),
  ) as Record<JpCrossPieceShapingKey, string>;
}

describe("Japanese notation SVG tokens across back, pullover front, and cardigan front", () => {
  it("round neck: neckline and shoulder shaping match; bind-off and cast-on stay piece-specific", () => {
    const cardiganPattern = symmetricalCardiganPattern("round");
    const pulloverPattern = symmetricalPulloverPattern("round");
    const cardigan = generateSleevelessBackPattern(cardiganPattern);
    const pullover = generateSleevelessBackPattern(pulloverPattern);

    const backRepl = pickJpShapingTokens(
      buildBackJapaneseNotationReplacements(cardigan, cardiganPattern),
    );
    const pulloverRepl = pickJpShapingTokens(
      buildFrontJapaneseNotationReplacements(pullover, pulloverPattern),
    );
    const cardiganRepl = pickJpShapingTokens(
      buildFrontJapaneseNotationReplacements(cardigan, cardiganPattern),
    );

    expect(cardiganRepl["jp-neckline-shaping"].length).toBeGreaterThan(0);
    expect(cardiganRepl["jp-neckline-shaping"]).toBe(pulloverRepl["jp-neckline-shaping"]);
    expect(cardiganRepl["jp-shoulder-shaping"].length).toBeGreaterThan(0);
    expect(cardiganRepl["jp-shoulder-shaping"]).toBe(pulloverRepl["jp-shoulder-shaping"]);
    expect(cardiganRepl["jp-shoulder-shaping"]).toBe(backRepl["jp-shoulder-shaping"]);
    expect(pulloverRepl["jp-shoulder-shaping"]).toBe(backRepl["jp-shoulder-shaping"]);

    expect(cardiganRepl["jp-neckline-bo"].length).toBeGreaterThan(0);
    expect(pulloverRepl["jp-neckline-bo"].length).toBeGreaterThan(0);
    expect(cardiganRepl["jp-neckline-bo"]).not.toBe(pulloverRepl["jp-neckline-bo"]);

    const backCastOn = cardigan.debug.hemCastOnStitches ?? cardigan.debug.backStitches ?? 0;
    expect(backRepl["jp-caston"]).toBe(formatCastOnNotation(backCastOn));
    expect(pulloverRepl["jp-caston"]).toBe(formatCastOnNotation(backCastOn));
    expect(castOnStitchesFromJpNotation(cardiganRepl["jp-caston"])).toBe(
      Math.ceil(backCastOn / 2),
    );
    expect(cardiganRepl["jp-caston"]).not.toBe(backRepl["jp-caston"]);

    expect(() =>
      assertJapaneseNotationSvgFullyReplaced(JP_CARDIGAN_ROUND_SVG, {
        ...buildFrontJapaneseNotationReplacements(cardigan, cardiganPattern),
      }),
    ).not.toThrow();
    expect(() =>
      assertJapaneseNotationSvgFullyReplaced(JP_FRONT_SVG, {
        ...buildFrontJapaneseNotationReplacements(pullover, pulloverPattern),
      }),
    ).not.toThrow();
  });

  it("round neck (Men's Med QA): cardigan front shoulder uses back timeline, not half-front timeline", () => {
    const qa = SLEEVELESS_QA_SCENARIOS.find((s) => s.id === "cardigan-round")!;
    const pulloverQa = SLEEVELESS_QA_SCENARIOS.find((s) => s.id === "pullover-round")!;
    const cardigan = generateSleevelessBackPattern(qa.patternData);
    const pullover = generateSleevelessBackPattern(pulloverQa.patternData);

    const halfFrontShoulder = shoulderShapingNotationLinesFromTimeline(
      cardigan.frontNeckShoulderTimeline ?? [],
      "right",
    ).join("\n");
    const backShoulder = buildBackJapaneseNotationReplacements(cardigan, qa.patternData)[
      "jp-shoulder-shaping"
    ];
    const cardiganRepl = pickJpShapingTokens(
      buildFrontJapaneseNotationReplacements(cardigan, qa.patternData),
    );
    const pulloverRepl = pickJpShapingTokens(
      buildFrontJapaneseNotationReplacements(pullover, pulloverQa.patternData),
    );

    expect(halfFrontShoulder).toBe("7s-2r-2x\n6s-2r-1x");
    expect(backShoulder).toBe("7s-2r-2x\n4s-2r-1x\n2s-2r-1x");
    expect(halfFrontShoulder).not.toBe(backShoulder);
    expect(cardiganRepl["jp-shoulder-shaping"]).toBe(backShoulder);
    expect(cardiganRepl["jp-shoulder-shaping"]).toBe(pulloverRepl["jp-shoulder-shaping"]);
    expect(cardiganRepl["jp-neckline-shaping"]).toBe(pulloverRepl["jp-neckline-shaping"]);
  });

  it("round neck: style-only patternData (review tab path) keeps cross-piece shoulder and neckline tokens", () => {
    const fullPattern = symmetricalCardiganPattern("round");
    const result = generateSleevelessBackPattern(fullPattern);
    const styleOnly = {
      style: { garmentStyle: "cardigan", neckline: "round", frontStyle: "open" },
    };
    const pulloverPattern = symmetricalPulloverPattern("round");
    const pullover = generateSleevelessBackPattern(pulloverPattern);

    const backRepl = pickJpShapingTokens(buildBackJapaneseNotationReplacements(result, styleOnly));
    const cardiganRepl = pickJpShapingTokens(
      buildFrontJapaneseNotationReplacements(result, styleOnly),
    );
    const pulloverRepl = pickJpShapingTokens(
      buildFrontJapaneseNotationReplacements(pullover, pulloverPattern),
    );

    expect(cardiganRepl["jp-neckline-shaping"]).toBe(pulloverRepl["jp-neckline-shaping"]);
    expect(cardiganRepl["jp-shoulder-shaping"]).toBe(backRepl["jp-shoulder-shaping"]);
    expect(cardiganRepl["jp-shoulder-shaping"]).toBe(pulloverRepl["jp-shoulder-shaping"]);
  });

  it("V-neck: shoulder shaping matches across back, pullover front, and cardigan front; necklines use live front charts", () => {
    const cardiganPattern = symmetricalCardiganPattern("v-neck");
    const pulloverPattern = symmetricalPulloverPattern("v-neck");
    const cardigan = generateSleevelessBackPattern(cardiganPattern);
    const pullover = generateSleevelessBackPattern(pulloverPattern);

    const backRepl = pickJpShapingTokens(
      buildBackJapaneseNotationReplacements(cardigan, cardiganPattern),
    );
    const pulloverRepl = pickJpShapingTokens(
      buildFrontJapaneseNotationReplacements(pullover, pulloverPattern),
    );
    const cardiganRepl = pickJpShapingTokens(
      buildFrontJapaneseNotationReplacements(cardigan, cardiganPattern),
    );

    expect(cardiganRepl["jp-shoulder-shaping"].length).toBeGreaterThan(0);
    expect(cardiganRepl["jp-shoulder-shaping"]).toBe(pulloverRepl["jp-shoulder-shaping"]);
    expect(cardiganRepl["jp-shoulder-shaping"]).toBe(backRepl["jp-shoulder-shaping"]);
    expect(pulloverRepl["jp-shoulder-shaping"]).toBe(backRepl["jp-shoulder-shaping"]);

    expect(cardiganRepl["jp-neckline-bo"]).toBe("");
    expect(pulloverRepl["jp-neckline-bo"]).toBe("");

    const pulloverNeckFromChart = neckEdgeNotationLinesFromNeckShoulderChart(
      pullover.frontNeckShoulderShapingChart,
      "right",
    ).join("\n");
    const cardiganNeckFromChart = neckEdgeNotationLinesFromNeckShoulderChart(
      cardigan.frontNeckShoulderShapingChart,
      "right",
    ).join("\n");
    expect(pulloverRepl["jp-neckline-shaping"]).toBe(pulloverNeckFromChart);
    expect(cardiganRepl["jp-neckline-shaping"]).toBe(cardiganNeckFromChart);
    expect(cardiganRepl["jp-neckline-shaping"].length).toBeGreaterThan(0);

    const backCastOn = cardigan.debug.hemCastOnStitches ?? cardigan.debug.backStitches ?? 0;
    expect(backRepl["jp-caston"]).toBe(formatCastOnNotation(backCastOn));
    expect(pulloverRepl["jp-caston"]).toBe(formatCastOnNotation(backCastOn));
    expect(castOnStitchesFromJpNotation(cardiganRepl["jp-caston"])).toBe(
      Math.ceil(backCastOn / 2),
    );
  });
});

describe("cardigan front Japanese notation cast-on (round vs V-neck)", () => {
  it.each(["round", "v-neck"] as const)(
    "uses half-panel front cast-on for %s cardigan (cardiganFrontCastOn === ceil(backCastOn / 2))",
    (neckline) => {
      const patternData = symmetricalCardiganPattern(neckline);
      const result = generateSleevelessBackPattern(patternData);
      const repl = buildFrontJapaneseNotationReplacements(result, patternData);
      const backCastOn = result.debug.backStitches ?? 0;
      const frontCastOn = castOnStitchesFromJpNotation(repl["jp-caston"]);

      expect(backCastOn).toBeGreaterThan(0);
      expect(frontCastOn).toBe(Math.ceil(backCastOn / 2));
      expect(repl["jp-caston"]).toBe(formatCastOnNotation(frontCastOn));
      expect(repl["jp-caston"]).not.toBe(formatCastOnNotation(backCastOn));
    },
  );

  it("round and V-neck cardigan use the same cast-on source rules", () => {
    const round = generateSleevelessBackPattern(symmetricalCardiganPattern("round"));
    const vNeck = generateSleevelessBackPattern(symmetricalCardiganPattern("v-neck"));
    const roundRepl = buildFrontJapaneseNotationReplacements(round, symmetricalCardiganPattern("round"));
    const vRepl = buildFrontJapaneseNotationReplacements(vNeck, symmetricalCardiganPattern("v-neck"));

    expect(roundRepl["jp-caston"]).toBe(vRepl["jp-caston"]);
    expect(round.debug.cardiganHalfLeftCastOnSts).toBeDefined();
    expect(vNeck.debug.cardiganHalfLeftCastOnSts).toBeDefined();
    expect(roundRepl["jp-caston"]).toBe(
      formatCastOnNotation(round.debug.cardiganHalfLeftCastOnSts!),
    );
    expect(vRepl["jp-caston"]).toBe(formatCastOnNotation(vNeck.debug.cardiganHalfLeftCastOnSts!));
  });

  it("front Japanese notation cast-on matches sts/rows diagram HIP_STS for round and V-neck cardigans", () => {
    for (const neckline of ["round", "v-neck"] as const) {
      const patternData = symmetricalCardiganPattern(neckline);
      const result = generateSleevelessBackPattern(patternData);
      const jpRepl = buildFrontJapaneseNotationReplacements(result, patternData);
      const diagramRepl = buildSleevelessGarmentDiagramReplacements(result, "in", {
        patternData,
        measurementPiece: "front",
      });
      const jpCastOn = castOnStitchesFromJpNotation(jpRepl["jp-caston"]);
      expect(jpCastOn).toBe(Number(diagramRepl.HIP_STS));
      expect(jpCastOn).toBe(Math.ceil((result.debug.backStitches ?? 0) / 2));
    }
  });

  it("back Japanese notation keeps full-width cast-on for cardigans", () => {
    const patternData = symmetricalCardiganPattern("v-neck");
    const result = generateSleevelessBackPattern(patternData);
    const backRepl = buildBackJapaneseNotationReplacements(result, patternData);
    const backCastOn = result.debug.hemCastOnStitches ?? result.debug.backStitches ?? 0;
    expect(backRepl["jp-caston"]).toBe(formatCastOnNotation(backCastOn));
    expect(castOnStitchesFromJpNotation(backRepl["jp-caston"])).toBeGreaterThan(
      castOnStitchesFromJpNotation(
        buildFrontJapaneseNotationReplacements(result, patternData)["jp-caston"],
      ),
    );
  });
});
