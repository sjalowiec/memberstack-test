import { readFileSync } from "node:fs";
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
  it("offers straight and short-row shoulders on the drop-shoulder builder", () => {
    const builder = readFileSync("src/pages/patterns/drop-shoulder/builder.astro", "utf8");
    const page = readFileSync("src/scripts/drop-shoulder-builder-page.ts", "utf8");
    expect(builder).toContain("Straight shoulders");
    expect(builder).toContain("Short-row shoulders");
    expect(builder).toContain('data-value="straight"');
    expect(builder).toContain('data-value="short-row"');
    expect(page).toContain('shoulderShaping');
    expect(page).toContain("readStoredShoulderShaping");
  });

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
    expect(result.debug.backStitches).toBe(122);
    expect(result.debug.centerNeckBindOffStitches).toBe(20);
    expect(result.debug.shoulderStitches).toBe(40);
    expect(back).toContain("Divide the neckline. Work one shoulder at a time.");
    expect(back).toContain("Bind off center neckline needles");
    expect(back).toContain("(20 stitches total)");
    expect(back).toContain("(51 stitches total)");
    expect(back).toContain("The center neckline stitches are already bound off.");
    expect(back).not.toContain("center neckline stitches left in hold");
    expect(back).not.toMatch(/reverse shaping/i);
    expect(back).not.toMatch(/same sequence/i);
    expect(back).not.toContain("there is no shoulder shaping");

    const right = back.indexOf("RIGHT SIDE");
    const left = back.indexOf("LEFT SIDE");
    const firstDone = back.indexOf("The first shoulder is complete.");
    const secondDone = back.indexOf("The second shoulder is complete.");
    expect(right).toBeGreaterThanOrEqual(0);
    expect(left).toBeGreaterThan(firstDone);
    expect(secondDone).toBeGreaterThan(left);
    expect(back.indexOf("Bind off center neckline needles")).toBeLessThan(back.indexOf("RC: 001"));
    expect(back.indexOf("The carriage is COR, at the shoulder edge.")).toBeGreaterThan(right);
    expect(back.indexOf("The carriage is COL, at the shoulder edge.")).toBeGreaterThan(left);
    expect(back.indexOf("No working needles remain. Do not knit.")).toBeGreaterThan(right);
    expect(back.lastIndexOf("No working needles remain. Do not knit.")).toBeGreaterThan(left);
    expect(back).toContain("Return the 40 held shoulder stitches to working position.");
    expect(back).toContain("Knit each wrap together with its stitch");
    expect(back).toContain("This bind-off does not add a knitted row.");
    expect(back.indexOf("Return the 40 held shoulder stitches")).toBeLessThan(firstDone);
    expect(back.lastIndexOf("Return the 40 held shoulder stitches")).toBeLessThan(secondDone);
    expect(back).toContain("11 stitches were removed for the neckline. 40 stitches were held for the shoulder slope");
    expect(back.match(/The row counter shows RC: 001/g)?.length).toBe(2);
    expect(back.match(/rc-heading:RC: 011/g)?.length).toBe(2);
    expect(back).not.toMatch(/rc-heading:RC: 012/);

    const printed = renderSleevelessPrintPieceHtml(result.displayRows, "", "back").replace(/\u00a0/g, " ");
    expect(printed.indexOf("Bind off center neckline needles")).toBeLessThan(
      printed.indexOf("The first shoulder is complete."),
    );
    expect(printed.indexOf("The first shoulder is complete.")).toBeLessThan(
      printed.indexOf("The second shoulder is complete."),
    );
    expect(printed).toContain("Automatic Wrap");
    expect(printed).toContain("The carriage is COL, at the shoulder edge.");

    const { backShapingMapData } = buildDropShoulderMountShapingMapData(result, pattern);
    expect(backShapingMapData).not.toBeNull();
    expect(backShapingMapData!.centerLabel).toBe("Bind off 20 center stitches");
    const shoulder = backShapingMapData!.paths.find((path) => path.id === "shoulder");
    const neck = backShapingMapData!.paths.find((path) => path.id === "neck");
    expect(shoulder?.startRow).toBe(1);
    expect(shoulder?.steps[0]?.label).toBe("hold 6");
    expect(shoulder?.steps.some((step) => step.label === "hold 1")).toBe(true);
    expect(neck?.steps.length).toBeGreaterThan(0);
    const neckRemoved = (neck?.steps ?? []).reduce((sum, step) => sum + step.stitches, 0);
    const shoulderHeld = (shoulder?.steps ?? [])
      .filter((step) => step.label?.startsWith("hold "))
      .reduce((sum, step) => sum + step.stitches, 0);
    expect(neckRemoved).toBe(11);
    expect(shoulderHeld).toBe(40);
  });
});
