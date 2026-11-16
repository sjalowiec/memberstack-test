import { describe, expect, it } from "vitest";
import { generateDropShoulderPattern } from "./dropShoulderPatternOutput";
import { buildDropShoulderMountShapingMapData } from "./dropShoulderMountVisualGuides";
import { renderSleevelessPrintPieceHtml } from "./sleevelessPatternPrintRender";
import { computeDefaultMeasurementsFromChartRow } from "./sleevelessExpressSizeChartClient";
import type { ChartRow } from "./sleevelessExpressSizeChartTypes";
import type { SleevelessPatternDisplayRow } from "./sleevelessPatternOutput";

const WOMENS_SIZE_1: ChartRow = {
  size: 1,
  bust_or_chest: 31.5,
  waist: 22.5,
  hip: 33.5,
  garment_back_length: 21,
  armhole_depth: 7,
  shoulder_width: 12,
  neck_opening: 6,
  front_neck_depth: 4,
  back_neck_depth: 1,
  upper_arm: 9.75,
  wrist: 5.25,
  sleeve_length: 16.25,
};

function size1Pattern(shortRowShoulders: boolean): Record<string, unknown> {
  const measurements = computeDefaultMeasurementsFromChartRow(WOMENS_SIZE_1, "standard", {
    bodyShape: "straight",
  });
  return {
    fit: {
      sizingChart: "misses",
      selectedSize: 1,
      easeChoice: "standard",
      selectedMeasurements: measurements,
    },
    style: {
      construction: "drop-shoulder",
      constructionAuthored: "drop-shoulder",
      recipientCategory: "misses",
      neckline: "round",
      bodyShape: "straight",
      frontStyle: "closed",
      ...(shortRowShoulders ? { shoulderShaping: "short-row" } : {}),
    },
    yarnGaugeMachine: {
      gaugeStitchesPerInch: 7,
      gaugeRowsPerInch: 11,
      availableNeedles: 200,
    },
  };
}

function plain(rows: readonly SleevelessPatternDisplayRow[]): string {
  return rows
    .filter((row): row is Extract<SleevelessPatternDisplayRow, { kind: "block" }> => row.kind === "block")
    .flatMap((row) => [...(row.trustedParagraphs ?? []), ...(row.paragraphs ?? [])])
    .join("\n")
    .replace(/<[^>]+>/g, " ");
}

describe("shallow neckline with short-row shoulders", () => {
  it("keeps the approved straight-shoulder back when short rows are not requested", () => {
    const result = generateDropShoulderPattern(size1Pattern(false));
    const back = plain(result.displayRows);
    expect(back).toContain("Drop-shoulder shoulders are worked straight — there is no shoulder shaping.");
    expect(back).not.toContain("Automatic Wrap");
    expect(back).not.toContain("shoulder slope");
    expect(result.debug.backNeckRoundNecklineStrategy).toBe("shallow-round");
  });

  it("writes both shoulders in carriage order for the size 1 back", () => {
    const pattern = size1Pattern(true);
    const result = generateDropShoulderPattern(pattern);
    const back = plain(result.displayRows);
    expect(result.warnings.join("\n")).not.toMatch(/Short-row shoulders were requested/);
    expect(back).toContain("Divide the neckline. Work one shoulder at a time.");
    expect(back).not.toMatch(/reverse shaping/i);
    expect(back).not.toContain("there is no shoulder shaping");

    const firstBind = back.indexOf("Bind off the");
    const firstDone = back.indexOf("The first shoulder is complete.");
    const secondSide = back.indexOf("LEFT SIDE");
    const secondBind = back.indexOf("Bind off the", firstBind + 1);
    const secondDone = back.indexOf("The second shoulder is complete.");
    expect(firstBind).toBeGreaterThan(back.indexOf("RIGHT SIDE"));
    expect(firstBind).toBeLessThan(firstDone);
    expect(firstDone).toBeLessThan(secondSide);
    expect(secondBind).toBeLessThan(secondDone);
    expect(back.indexOf("removed for the neckline")).toBeLessThan(back.indexOf("held for the shoulder slope"));
    expect(back).toContain("These stitches are held for the shoulder slope. They are not removed.");
    expect(back).toContain("On this same row");
    expect(back).toContain("Before knitting this row, the carriage and the working yarn are at the neck edge.");
    expect(back).toContain("Before knitting this row, the carriage and the working yarn are at the shoulder edge.");
    expect(back).toContain("Work this shoulder on its own. The neck edge is toward the center. The shoulder edge is the outer edge.");

    const printed = renderSleevelessPrintPieceHtml(result.displayRows, "", "back").replace(/\u00a0/g, " ");
    expect(printed.indexOf("Bind off the")).toBeLessThan(printed.indexOf("The first shoulder is complete."));
    expect(printed.indexOf("The first shoulder is complete.")).toBeLessThan(
      printed.indexOf("The second shoulder is complete."),
    );
    expect(printed).toContain("Automatic Wrap");

    const { backShapingMapData } = buildDropShoulderMountShapingMapData(result, pattern);
    expect(backShapingMapData).not.toBeNull();
    const shoulder = backShapingMapData!.paths.find((path) => path.id === "shoulder");
    const neck = backShapingMapData!.paths.find((path) => path.id === "neck");
    expect(shoulder?.steps.some((step) => step.label?.startsWith("hold "))).toBe(true);
    expect(neck?.steps.length).toBeGreaterThan(0);
    const holdRows = (shoulder?.steps ?? [])
      .filter((step) => step.label?.startsWith("hold "))
      .map((step) => step);
    expect(holdRows.length).toBeGreaterThan(0);
    expect(shoulder?.startRow).toBe(1);
    expect(shoulder?.steps[0]?.label).toBe("hold 6");
    expect(back).toContain("Bind off the 40 shoulder stitches.");
    expect(back).toContain("11 stitches were removed for the neckline. 40 stitches were held for the shoulder slope");
    expect(back.match(/rc-heading:RC: 012/g)?.length).toBe(2);
  });
});
