import { describe, expect, it } from "vitest";
import { generateDropShoulderPattern } from "./dropShoulderPatternOutput";
import { buildDropShoulderBackJapaneseNotationReplacements } from "./dropShoulderBodyJapaneseNotation";
import { resolveDropShoulderBackDiagramSvg } from "./dropShoulderBodyNotationSvg";

const DROP_SHOULDER_SHAPED = {
  fit: {
    sizingChart: "women",
    selectedMeasurements: {
      finished_bust_chest: 40,
      finished_hip: 36,
      back_neck_to_hem: 24,
      upper_arm: 16,
      wrist: 8,
      sleeve_length: 12,
      shoulder_width: 16,
      neck_opening: 7,
      back_neck_depth: 1,
      front_neck_depth: 4,
    },
  },
  yarnGaugeMachine: {
    gaugeStitchesPerInch: 5,
    gaugeRowsPerInch: 7,
    availableNeedles: 200,
  },
  style: {
    construction: "drop-shoulder",
    frontStyle: "closed",
    neckline: "round",
    bodyShape: "shaped",
  },
};

const DROP_SHOULDER_STRAIGHT = {
  fit: {
    sizingChart: "women",
    selectedMeasurements: {
      finished_bust_chest: 40,
      finished_hip: 40,
      back_neck_to_hem: 24,
      upper_arm: 16,
      wrist: 8,
      sleeve_length: 12,
      shoulder_width: 16,
      neck_opening: 7,
      back_neck_depth: 1,
      front_neck_depth: 4,
    },
  },
  yarnGaugeMachine: {
    gaugeStitchesPerInch: 5,
    gaugeRowsPerInch: 7,
    availableNeedles: 200,
  },
  style: {
    construction: "drop-shoulder",
    frontStyle: "closed",
    neckline: "round",
    bodyShape: "straight",
  },
};

function bodyParagraphs(result: ReturnType<typeof generateDropShoulderPattern>): string {
  let inBody = false;
  const lines: string[] = [];
  for (const row of result.displayRows) {
    if (row.kind === "section" && row.title === "BODY") {
      inBody = true;
      continue;
    }
    if (row.kind === "section") inBody = false;
    if (!inBody || row.kind !== "block") continue;
    lines.push(...(row.paragraphs ?? []), ...(row.trustedParagraphs ?? []));
  }
  return lines.join("\n");
}

describe("drop-shoulder shaped body shaping", () => {
  it("shaped body with hip narrower than bust uses increase throughout", () => {
    const result = generateDropShoulderPattern(DROP_SHOULDER_SHAPED);
    const bodyText = bodyParagraphs(result);
    const jp = buildDropShoulderBackJapaneseNotationReplacements(result, DROP_SHOULDER_SHAPED);
    const chartRows = result.displayRows.flatMap((r) =>
      r.kind === "block" ? (r.bodyShapingChartRows ?? []) : [],
    );

    expect(result.debug.hemCastOnStitches).toBeLessThan(result.debug.bustBodyStitches!);
    expect(result.debug.alineBodyShapingType).toBe("increase-to-bust");
    expect(bodyText).toMatch(/Increase 1 stitch at each side edge/i);
    expect(bodyText).not.toMatch(/Decrease 1 stitch at each side edge/i);
    expect(chartRows.length).toBeGreaterThan(0);
    expect(chartRows.every((r) => /^Inc 1 stitch at each side edge$/i.test(r.action))).toBe(true);
    expect(jp["jp-body-shaping"]).toMatch(/^\+1s-\d+r-\d+x/);
    expect(jp["jp-body-shaping"].split("\n").every((line) => line.startsWith("+"))).toBe(true);

    const diagram = resolveDropShoulderBackDiagramSvg("shaping-notation", DROP_SHOULDER_SHAPED);
    expect(diagram.exactMatch).toBe(true);
    expect(diagram.src).toBe("/images/patterns/drop-shoulder/diagram-jp-back-shaped.svg");
  });

  it("straight body has no body shaping notation or chart rows", () => {
    const result = generateDropShoulderPattern(DROP_SHOULDER_STRAIGHT);
    const jp = buildDropShoulderBackJapaneseNotationReplacements(result, DROP_SHOULDER_STRAIGHT);
    const bodyText = bodyParagraphs(result);
    const chartRows = result.displayRows.flatMap((r) =>
      r.kind === "block" ? (r.bodyShapingChartRows ?? []) : [],
    );

    expect(result.debug.alineBodyShapingType).toBeUndefined();
    expect(jp["jp-body-shaping"]).toBe("");
    expect(chartRows).toHaveLength(0);
    expect(bodyText).not.toMatch(/Begin A-line shaping/i);
    expect(bodyText).not.toMatch(/Decrease 1 stitch at each side edge/i);
    expect(bodyText).not.toMatch(/Increase 1 stitch at each side edge/i);
  });
});
