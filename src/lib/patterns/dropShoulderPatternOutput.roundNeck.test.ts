import { describe, expect, it } from "vitest";
import { generateDropShoulderPattern } from "./dropShoulderPatternOutput";
import { buildDropShoulderBodyDiagramReplacements } from "./dropShoulderBodyNotationSvg";
import { buildDropShoulderSleeveDiagramReplacements } from "./sleevelessGarmentDiagramReplacements";
import { computeDefaultMeasurementsFromChartRow } from "./sleevelessExpressSizeChartClient";
import type { ChartRow } from "./sleevelessExpressSizeChartTypes";
import type { SleevelessPatternDisplayRow } from "./sleevelessPatternOutput";
import { renderSleevelessPrintPieceHtml } from "./sleevelessPatternPrintRender";

/** Kids chart size 2 yr — matches `public/data/sizing_sweaters_kids.json`. */
const KIDS_2YR_CHART_ROW: ChartRow = {
  size: "2 yr",
  bust_or_chest: 21,
  waist: 21,
  hip: "",
  garment_back_length: 18,
  armhole_depth: 4.25,
  shoulder_width: 9.25,
  neck_opening: 4,
  front_neck_depth: 2,
  back_neck_depth: 1,
  upper_arm: 6,
  wrist: 4.5,
  sleeve_length: 8.5,
};

function kids2YrCardiganRoundPattern(): Record<string, unknown> {
  return {
    fit: {
      sizingChart: "kids",
      selectedSize: "2 yr",
      easeChoice: "standard",
      selectedMeasurements: computeDefaultMeasurementsFromChartRow(
        KIDS_2YR_CHART_ROW,
        "standard",
        { bodyShape: "straight" },
      ),
    },
    style: {
      construction: "drop-shoulder",
      constructionAuthored: "drop-shoulder",
      recipientCategory: "kids",
      neckline: "round",
      bodyShape: "straight",
      frontStyle: "open",
      garmentStyle: "cardigan",
    },
    yarnGaugeMachine: {
      gaugeStitchesPerInch: 7,
      gaugeRowsPerInch: 11,
      availableNeedles: 200,
    },
  };
}

/** Women's chart size 1 — matches `public/data/sizing_sweaters_misses.json`. */
const WOMENS_SIZE_1_CHART_ROW: ChartRow = {
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

function frontBlockParagraphs(rows: SleevelessPatternDisplayRow[]): string[] {
  return rows
    .filter(
      (row): row is Extract<SleevelessPatternDisplayRow, { kind: "block" }> => row.kind === "block",
    )
    .flatMap((row) => [...(row.trustedParagraphs ?? []), ...(row.paragraphs ?? [])]);
}

function sleeveInstructionText(rows: SleevelessPatternDisplayRow[]): string {
  return rows
    .filter((row) => row.kind === "block" || row.kind === "section")
    .flatMap((row) => {
      if (row.kind === "section") return [row.title ?? ""];
      return [...(row.paragraphs ?? []), ...(row.trustedParagraphs ?? [])];
    })
    .join("\n");
}

describe("generateDropShoulderPattern round-neck front instructions", () => {
  it("Women's size 1 · 16/24 · pullover round: clarifies hold, one shoulder at a time, and even rows before bind-off", () => {
    const patternData = {
      fit: {
        sizingChart: "misses",
        selectedSize: 1,
        easeChoice: "standard",
        selectedMeasurements: computeDefaultMeasurementsFromChartRow(
          WOMENS_SIZE_1_CHART_ROW,
          "standard",
          { bodyShape: "straight" },
        ),
      },
      style: {
        construction: "drop-shoulder",
        constructionAuthored: "drop-shoulder",
        recipientCategory: "misses",
        neckline: "round",
        bodyShape: "straight",
        frontStyle: "closed",
      },
      yarnGaugeMachine: {
        gaugeStitchesPerInch: 4,
        gaugeRowsPerInch: 6,
        availableNeedles: 200,
      },
    };

    const result = generateDropShoulderPattern(patternData);
    const text = frontBlockParagraphs(result.frontDisplayRows).join("\n");

    expect(result.debug.frontNecklineStartRC).toBe(102);
    expect(result.debug.totalCalculatedRows).toBe(126);
    expect(result.debug.finalRC).toBe(126);
    expect(result.debug.shoulderStitches).toBe(23);

    expect(text).toMatch(/bind off the center/i);
    expect(text).toMatch(/Place the opposite shoulder stitches on hold/i);
    expect(text).toMatch(/Work one shoulder at a time/i);
    expect(text).toMatch(
      /When neckline shaping is complete and 23 stitches remain on the working shoulder, knit even to RC: 126 \(no further neck-edge decreases\)/,
    );
    expect(text).toMatch(/Bind off the 23 shoulder stitches\./);
    expect(text).toMatch(/Return the held shoulder stitches to the needles/i);
    expect(text).toMatch(/repeat the neckline shaping for the second shoulder, matching the first side/i);
    expect(text).not.toMatch(/shoulder shaping/i);

    expect(text).not.toMatch(/stitches remain on the side, knit even/i);
    expect(text).not.toMatch(/Work the second side to match, reversing the neck-edge shaping/i);

    const printHtml = renderSleevelessPrintPieceHtml(result.frontDisplayRows, "", "front");
    expect(printHtml).toMatch(/Place the opposite shoulder stitches on hold/i);
    expect(printHtml).toMatch(
      /When neckline shaping is complete and 23 stitches remain on the working shoulder, knit even to RC: 126 \(no further neck-edge decreases\)/,
    );
    expect(printHtml).toMatch(/Bind off the 23 shoulder stitches\./);
  });

  it("Kids 2 yr · 28/44 · cardigan round: written neckline math and half-panel front schematic", () => {
    const patternData = kids2YrCardiganRoundPattern();
    const result = generateDropShoulderPattern(patternData);
    const text = frontBlockParagraphs(result.frontDisplayRows).join("\n");

    expect(result.debug.backStitches).toBe(84);
    expect(result.debug.frontNecklineStartRC).toBe(176);
    expect(result.debug.finalRC).toBe(198);
    expect(result.debug.shoulderStitches).toBe(28);

    expect(text).toMatch(/Cast on 42 stitches for the left front/i);
    expect(text).toMatch(/Bind off 4 stitches at the center-front \(neck\) edge\./);
    expect(text).toMatch(/bind off 3, then 2 stitches on alternate \(neck-edge\) rows\./);
    expect(text).toMatch(/Decrease 1 stitch at the neck edge every other row 5 times/i);
    expect(text).toMatch(/When 28 stitches remain, knit even to RC: 198/);

    const backRepl = buildDropShoulderBodyDiagramReplacements(result, "in", {
      patternData,
      measurementPiece: "back",
    });
    const frontRepl = buildDropShoulderBodyDiagramReplacements(result, "in", {
      patternData,
      measurementPiece: "front",
      cardiganHalfSide: "left",
    });

    expect(backRepl["cross-shoulder-width"]).toBe("84");
    expect(frontRepl["cross-shoulder-width"]).toBe("42");
    expect(frontRepl["cross-shoulder"]).toBe("6");
    expect(frontRepl.BUST_STS).toBe("42");

    const sleeveText = sleeveInstructionText(result.sleeveDisplayRows);
    expect(result.debug.dropShoulderSleeveTotalRows).toBe(94);
    expect(result.debug.dropShoulderSleeveCuffRows).toBe(22);
    expect(result.debug.dropShoulderSleeveBodyRows).toBe(72);
    expect(sleeveText).toMatch(/Increase 1 stitch at each side every 14 rows 5 times\./);
    expect(sleeveText).toMatch(
      /After the final increase, knit 2 rows even in pattern, then bind off at RC: 094\./,
    );

    const sleeveRepl = buildDropShoulderSleeveDiagramReplacements(result, "in", "cuff-up");
    expect(sleeveRepl.SLEEVE_LENGTH_ROWS).toBe("72");
    expect(sleeveRepl.CUFF_ROWS).toBe("22");
    expect(sleeveRepl.ARM_LENGTH_ROWS).toBe("94");
    expect(Number(sleeveRepl.SLEEVE_LENGTH_ROWS) + Number(sleeveRepl.CUFF_ROWS)).toBe(94);
    expect(sleeveRepl.SIDE_LENGTH).toBe("6.5");
    expect(sleeveRepl.ARM_LENGTH).toBe("8.5");
  });
});
