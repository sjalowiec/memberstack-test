import { describe, expect, it } from "vitest";
import { generateDropShoulderPattern } from "./dropShoulderPatternOutput";
import { buildDropShoulderBackJapaneseNotationReplacements } from "./dropShoulderBodyJapaneseNotation";
import {
  buildDropShoulderBodyDiagramReplacements,
  resolveDropShoulderBackDiagramSvg,
} from "./dropShoulderBodyNotationSvg";

const DROP_SHOULDER_ALINE = {
  fit: {
    sizingChart: "women",
    selectedMeasurements: {
      finished_bust_chest: 40,
      finished_hip: 44,
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
    bodyShape: "aline",
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

describe("drop-shoulder A-line body shaping", () => {
  it("writes hem→bust decreases and separates diagram hip vs cross-shoulder stitch counts", () => {
    const result = generateDropShoulderPattern(DROP_SHOULDER_ALINE);
    expect(result.debug.hemCastOnStitches).toBeGreaterThan(result.debug.bustBodyStitches!);
    expect(result.debug.alineBodyShapingType).toBe("decrease-to-bust");

    const bodyText = bodyParagraphs(result);
    expect(bodyText).toMatch(/Begin A-line shaping/i);
    expect(bodyText).toMatch(/Decrease 1 stitch at each side edge/i);
    expect(bodyText).not.toMatch(/Increase 1 stitch at each side edge/i);
    expect(bodyText).toMatch(/sts remain after shaping/i);

    const chartRows = result.displayRows.flatMap((r) =>
      r.kind === "block" ? (r.bodyShapingChartRows ?? []) : [],
    );
    expect(chartRows.length).toBeGreaterThan(0);
    expect(chartRows.every((r) => /^Dec 1 stitch at each side edge$/i.test(r.action))).toBe(true);

    const jp = buildDropShoulderBackJapaneseNotationReplacements(result, DROP_SHOULDER_ALINE);
    expect(jp["jp-body-shaping"]).toMatch(/^1s-\d+r-\d+x/);
    expect(jp["jp-body-shaping"]).not.toMatch(/^\+/m);
    expect(jp["jp-body-shaping"]).not.toContain("\n+");

    const repl = buildDropShoulderBodyDiagramReplacements(result, "in", {
      patternData: DROP_SHOULDER_ALINE,
      measurementPiece: "back",
    });
    expect(Number(repl["cross-shoulder-width"])).toBeLessThan(Number(repl.HIP_STS));
  });

  it("fills A-line jp-body-shaping and routes back shaping notation to diagram-jp-back-aline.svg", () => {
    const result = generateDropShoulderPattern(DROP_SHOULDER_ALINE);
    const jp = buildDropShoulderBackJapaneseNotationReplacements(result, DROP_SHOULDER_ALINE);
    expect(jp["jp-body-shaping"]).toMatch(/1s-\d+r-\d+x/);
    expect(jp["jp-caston"]).toMatch(/^co\d+/);

    const diagram = resolveDropShoulderBackDiagramSvg("shaping-notation", DROP_SHOULDER_ALINE);
    expect(diagram.exactMatch).toBe(true);
    expect(diagram.src).toBe("/images/patterns/drop-shoulder/diagram-jp-back-aline.svg");
  });

  it("writes A-line body shaping for drop-shoulder cardigan (not cardigan body-block stub)", () => {
    const cardigan = {
      ...DROP_SHOULDER_ALINE,
      style: {
        ...DROP_SHOULDER_ALINE.style,
        frontStyle: "open",
        garmentStyle: "cardigan",
      },
    };
    const result = generateDropShoulderPattern(cardigan);
    expect(result.debug.alineBodyShapingType).toBe("decrease-to-bust");
    expect(bodyParagraphs(result)).toMatch(/Begin A-line shaping/i);
  });
});
