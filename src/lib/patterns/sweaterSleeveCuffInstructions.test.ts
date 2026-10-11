import { describe, expect, it } from "vitest";
import { CUFF_UP_SLEEVE_BODY_ROW_COUNTER_RESET } from "./legoBlocks/cuffUpSleeveRowCounter";
import {
  buildDropShoulderSleeveDisplayRows,
  generateDropShoulderPattern,
} from "./dropShoulderPatternOutput";
import {
  buildDropShoulderSleeveShapingChartRows,
  dropShoulderSleeveShapingRcSequence,
} from "./dropShoulderSleeveShapingChart";
import { withSetInSleeveConstructionAuthored } from "./setInSleeveConstructionIdentity";
import { renderPatternDisplayRowsHtml } from "./sleevelessPatternDisplayHtml";
import { generateSleevelessBackPattern, formatRcColon } from "./sleevelessPatternOutput";
import { renderSleevelessPrintPieceHtml } from "./sleevelessPatternPrintRender";
import { computeDefaultMeasurementsFromChartRow } from "./sleevelessExpressSizeChartClient";
import type { ChartRow } from "./sleevelessExpressSizeChartTypes";
import {
  SIDEWAYS_CUFF_UP_BIND_OFF_LINE,
  SIDEWAYS_SLEEVE_HAND_SEW_LINE,
  SIDEWAYS_TOP_DOWN_CHART_FINISH,
} from "./sidewaysCardiganSleeveCuffCopy";
import {
  buildSidewaysCardiganSleeveDisplayRows,
  buildSidewaysCardiganSleeveInstructions,
  renderSidewaysCardiganSleeveSequenceHtml,
} from "./sidewaysCardiganSleeveInstructions";
import type { SidewaysCardiganSleeveCalcInput } from "./sidewaysCardiganSleeveCalc";
import { generateSetInSleevePattern } from "./setInSleevePatternOutput";
import {
  buildSetInCuffUpSleevePresentation,
  setInSleeveInstructionSection,
} from "./setInSleeve/setInSleeveInstructions";
import { calculateSetInSleeveSweater } from "./setInSleeve/setInSleeveSweaterMath";
import type { SleevelessPatternDisplayRow } from "./sleevelessPatternOutput";

const MISSES: ChartRow = {
  bust_or_chest: 36,
  hip: 38,
  garment_back_length: 23,
  armhole_depth: 8,
  shoulder_width: 14,
  neck_opening: 7,
  front_neck_depth: 4.5,
  back_neck_depth: 1,
  upper_arm: 12,
  wrist: 6,
  sleeve_length: 17,
};

const MEN: ChartRow = {
  bust_or_chest: 48,
  hip: 52.5,
  garment_back_length: 29,
  armhole_depth: 12,
  shoulder_width: 21,
  neck_opening: 8.25,
  front_neck_depth: 5.75,
  back_neck_depth: 1.5,
  upper_arm: 20,
  wrist: 8,
  sleeve_length: 19.75,
};

const PLUS: ChartRow = {
  bust_or_chest: 63,
  hip: 65,
  garment_back_length: 28,
  armhole_depth: 12,
  shoulder_width: 19,
  neck_opening: 8.5,
  front_neck_depth: 7,
  back_neck_depth: 1,
  upper_arm: 19,
  wrist: 8.5,
  sleeve_length: 17,
};

function visible(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function blockText(rows: readonly SleevelessPatternDisplayRow[]): string {
  return rows
    .filter((row) => row.kind === "block")
    .flatMap((row) =>
      row.kind === "block" ? [...(row.trustedParagraphs ?? []), ...(row.paragraphs ?? [])] : [],
    )
    .join("\n");
}

function cuffSectionText(rows: readonly SleevelessPatternDisplayRow[]): string {
  const start = rows.findIndex((row) => row.kind === "section" && row.title === "CUFF");
  const parts: string[] = [];
  for (let i = start + 1; i < rows.length; i++) {
    const row = rows[i]!;
    if (row.kind === "section") break;
    if (row.kind === "block") parts.push(...(row.trustedParagraphs ?? []), ...(row.paragraphs ?? []));
  }
  return parts.join("\n");
}

function dropShoulderPattern(audience: string, stitchesPerInch: number, rowsPerInch: number) {
  const row = audience === "men" ? MEN : audience === "plus" ? PLUS : MISSES;
  return {
    fit: {
      sizingChart: audience,
      selectedMeasurements: computeDefaultMeasurementsFromChartRow(row, "standard", {
        bodyShape: "straight",
      }),
    },
    yarnGaugeMachine: {
      gaugeStitchesPerInch: stitchesPerInch,
      gaugeRowsPerInch: rowsPerInch,
      availableNeedles: 250,
    },
    style: { construction: "drop-shoulder", frontStyle: "closed", neckline: "round" },
  };
}

describe("shared sweater cuff instructions", () => {
  it("writes cuff-up cast-on choices and doubled folded rows without changing the finished depth", () => {
    const cases = [
      { wristSts: 36, cuffRows: 12 },
      { wristSts: 48, cuffRows: 1 },
      { wristSts: 60, cuffRows: 28 },
    ];
    for (const sample of cases) {
      const rows = buildDropShoulderSleeveDisplayRows({
        topSts: sample.wristSts + 12,
        wristSts: sample.wristSts,
        cuffRows: sample.cuffRows,
        sleeveBodyRows: 80,
        sleeveTotalRows: 80 + sample.cuffRows,
        direction: "cuff-up",
        valid: true,
      });
      const cuff = cuffSectionText(rows).replace(/<[^>]+>/g, "");
      const folded = sample.cuffRows === 1 ? "2 rows" : `${sample.cuffRows * 2} rows`;
      const depth = sample.cuffRows === 1 ? "1 row" : `${sample.cuffRows} rows`;
      expect(cuff).toContain(`The finished cuff is ${sample.wristSts} stitches and ${depth} deep.`);
      expect(cuff).toContain(
        `1. Cast on ${sample.wristSts} stitches in the ribbing needle arrangement of your choice and knit ${depth} of ribbing, then transfer the stitches to the main bed to continue the sleeve.`,
      );
      expect(cuff).toContain(`2. Knit a hung hem for ${folded} so the hem can be folded.`);
      expect(cuff).toContain(`3. Knit mock ribbing for ${folded} so the hem can be folded.`);
      expect(cuff).toContain(
        "4. Hand knit ribbing to the desired finished cuff depth, then hang its stitches on the machine to continue the sleeve.",
      );
      expect(cuff).not.toContain("for the sleeve cuff");
      expect(blockText(rows)).toContain(CUFF_UP_SLEEVE_BODY_ROW_COUNTER_RESET);
      expect(blockText(rows).indexOf("Choose one way to begin")).toBeLessThan(
        blockText(rows).indexOf(CUFF_UP_SLEEVE_BODY_ROW_COUNTER_RESET),
      );
    }
  });

  it("keeps top-down counters and finishes the cuff from the shared choices", () => {
    const rows = buildDropShoulderSleeveDisplayRows({
      topSts: 80,
      wristSts: 40,
      cuffRows: 16,
      sleeveBodyRows: 100,
      sleeveTotalRows: 116,
      direction: "top-down",
      valid: true,
    });
    const text = blockText(rows);
    const cuff = cuffSectionText(rows).replace(/<[^>]+>/g, "");
    expect(text).toContain("Cast on or pick up 80 stitches.");
    expect(text).not.toContain(CUFF_UP_SLEEVE_BODY_ROW_COUNTER_RESET);
    expect(text).not.toContain("Reset row counter to RC: 000.");
    expect(cuff).toContain("The finished cuff is 40 stitches and 16 rows deep.");
    expect(cuff).toContain("knit 16 rows of ribbing in the needle arrangement of your choice, then bind off.");
    expect(cuff).toContain("mock ribbing hem for 32 rows so the hem can be folded.");
    expect(cuff).toContain("reverse hung hem");
    expect(cuff).toContain("for 32 rows so the hem can be folded.");
    expect(cuff).toContain("Bind off and work a crochet edging.");
    expect(cuff).toContain("Scrap off");
    const cuffBlock = rows.find(
      (row, index) =>
        row.kind === "block" &&
        rows.slice(0, index).some((earlier) => earlier.kind === "section" && earlier.title === "CUFF"),
    );
    expect(cuffBlock && cuffBlock.kind === "block" ? cuffBlock.rc : "").toBe("RC: 100");
    const chart = rows.find((row) => row.kind === "block" && row.sleeveShapingChartRows?.length);
    const last = chart && chart.kind === "block" ? chart.sleeveShapingChartRows?.at(-1) : undefined;
    expect(last).toMatchObject({ rc: 116, action: SIDEWAYS_TOP_DOWN_CHART_FINISH, edge: "Cuff edge" });
    expect(dropShoulderSleeveShapingRcSequence({
      topSts: 80,
      wristSts: 40,
      cuffRows: 16,
      sleeveBodyRows: 100,
      sleeveTotalRows: 116,
      direction: "top-down",
    })).toEqual(
      dropShoulderSleeveShapingRcSequence({
        topSts: 80,
        wristSts: 40,
        cuffRows: 40,
        sleeveBodyRows: 100,
        sleeveTotalRows: 140,
        direction: "top-down",
      }),
    );
  });

  it("uses the same cuff rows across gauges and sizes for drop shoulder", () => {
    const cases = [
      ["misses", 5, 7],
      ["misses", 7, 10],
      ["men", 4, 6],
      ["plus", 5, 7],
    ] as const;
    for (const [audience, spi, rpi] of cases) {
      for (const direction of ["cuff-up", "top-down"] as const) {
        const result = generateDropShoulderPattern(dropShoulderPattern(audience, spi, rpi), {
          sleeveDirection: direction,
        });
        const cuffRows = result.debug.dropShoulderSleeveCuffRows ?? 0;
        const wrist = result.debug.dropShoulderSleeveWristStitches ?? 0;
        const text = blockText(result.sleeveDisplayRows);
        expect(cuffRows, `${audience} ${spi}/${rpi} ${direction}`).toBeGreaterThan(0);
        expect(text).toContain(`and ${cuffRows === 1 ? "1 row" : `${cuffRows} rows`} deep`);
        expect(text).toContain(`${cuffRows * 2} rows so the hem can be folded`);
        expect(text).toContain(`${wrist} stitches`);
        if (direction === "cuff-up") {
          expect(text).toContain(CUFF_UP_SLEEVE_BODY_ROW_COUNTER_RESET);
          expect(text).toContain("Cast on");
          expect(text).toContain("upper-arm/top edge");
        } else {
          expect(text).not.toContain(CUFF_UP_SLEEVE_BODY_ROW_COUNTER_RESET);
          expect(text).toContain("Cast on or pick up");
        }
        const screen = visible(renderPatternDisplayRowsHtml(result.sleeveDisplayRows, { pieceSectionId: "sleeve" }));
        const print = visible(renderSleevelessPrintPieceHtml(result.sleeveDisplayRows, "", "sleeve"));
        expect(screen).toContain("Choose one way");
        expect(print).toContain("Choose one way");
        expect(print).toContain(`${cuffRows * 2} rows so the hem can be folded`);
        expect(screen).toContain(`${cuffRows * 2} rows so the hem can be folded`);
      }
    }
  });

  it("keeps set-in cuff-up on RC: 000 and leaves the sleeve cap chart unchanged", () => {
    const cases = [
      ["misses", MISSES, 5, 7],
      ["misses", MISSES, 7, 10],
      ["men", MEN, 4, 6],
      ["plus", PLUS, 5, 7],
    ] as const;
    for (const [audience, row, spi, rpi] of cases) {
      const sweater = calculateSetInSleeveSweater({
        chartAudience: audience,
        chartRow: row,
        stitchesPerInch: spi,
        rowsPerInch: rpi,
        availableNeedles: 400,
        bodyShape: "straight",
      });
      expect(sweater.ok, sweater.ok ? "" : sweater.message).toBe(true);
      if (!sweater.ok) continue;
      const label = `${audience} ${spi}/${rpi}`;
      const presentation = buildSetInCuffUpSleevePresentation({
        wristStitches: sweater.sleeve.wristStitches,
        upperArmStitches: sweater.sleeve.upperArmStitches,
        cuffRows: sweater.sleeve.cuffRows,
        cuffInches: sweater.sleeve.cuffInches,
        rowsCuffToUpperArm: sweater.sleeve.rowsCuffToUpperArm,
        cap: sweater.sleeveCap,
      });
      const sleeves = setInSleeveInstructionSection(
        {
          sections: [{ id: "sleeves", title: "Sleeves", blocks: presentation.blocks }],
        } as never,
        "sleeves",
      );
      const cuffRows = sweater.sleeve.cuffRows;
      expect(sleeves, label).toContain(
        `${formatRcColon(0)} 1. Cast on ${sweater.sleeve.wristStitches} stitches in the ribbing needle arrangement`,
      );
      expect(sleeves, label).toContain(`knit ${cuffRows === 1 ? "1 row" : `${cuffRows} rows`} of ribbing`);
      expect(sleeves, label).toContain(`for ${cuffRows * 2} rows so the hem can be folded`);
      expect(sleeves, label).toContain("Reset row counter to RC: 000.");
      expect(sleeves, label).not.toMatch(/\bRC \d{3}\b/);
      expect(sleeves, label).not.toContain("top-down");

      const taper = presentation.displayRows.find(
        (rowItem) =>
          rowItem.kind === "block" &&
          rowItem.sleeveShapingChartRows?.length &&
          rowItem.sleeveShapingChartId !== "set-in-sleeve-cap-shaping-chart",
      );
      const cap = presentation.displayRows.find(
        (rowItem) => rowItem.kind === "block" && rowItem.sleeveShapingChartId === "set-in-sleeve-cap-shaping-chart",
      );
      expect(taper && taper.kind === "block" ? taper.sleeveShapingChartRows?.map((chartRow) => chartRow.rc) : [], label).toEqual(
        dropShoulderSleeveShapingRcSequence({
          topSts: sweater.sleeve.upperArmStitches,
          wristSts: sweater.sleeve.wristStitches,
          cuffRows,
          sleeveBodyRows: sweater.sleeve.rowsCuffToUpperArm,
          sleeveTotalRows: sweater.sleeve.rowsToUpperArm,
          direction: "cuff-up",
        }),
      );
      const expectedCap = buildDropShoulderSleeveShapingChartRows({
        topSts: sweater.sleeve.upperArmStitches,
        wristSts: sweater.sleeve.wristStitches,
        cuffRows,
        sleeveBodyRows: sweater.sleeve.rowsCuffToUpperArm,
        sleeveTotalRows: sweater.sleeve.rowsToUpperArm,
        direction: "cuff-up",
      }).filter((chartRow) => chartRow.stitchesRemaining > 0);
      expect(taper && taper.kind === "block" ? taper.sleeveShapingChartRows : [], label).toEqual(expectedCap);
      const capRows = cap && cap.kind === "block" ? cap.sleeveShapingChartRows ?? [] : [];
      expect(capRows.at(-1), label).toMatchObject({
        rc: sweater.sleeve.rowsCuffToUpperArm + sweater.sleeveCap.totals.capRows,
        stitchesRemaining: 0,
      });

      const pattern = generateSetInSleevePattern({
        fit: {
          sizingChart: audience,
          easeChoice: "standard",
          selectedMeasurements: computeDefaultMeasurementsFromChartRow(row, "standard", { bodyShape: "straight" }),
        },
        style: withSetInSleeveConstructionAuthored(
          { recipientCategory: audience, garmentStyle: "pullover", neckline: "round", bodyShape: "straight" },
          "long",
        ),
        yarnGaugeMachine: { gaugeStitchesPerInch: spi, gaugeRowsPerInch: rpi, availableNeedles: 400 },
      });
      const screen = visible(renderPatternDisplayRowsHtml(pattern.sleeveDisplayRows, { pieceSectionId: "sleeve" }));
      const print = visible(renderSleevelessPrintPieceHtml(pattern.sleeveDisplayRows, "", "sleeve"));
      for (const html of [screen, print]) {
        expect(html, label).toContain("Choose one way to begin");
        expect(html, label).toContain(
          `for ${(pattern.sleevePiece?.cuffRows ?? 0) * 2} rows so the hem can be folded`,
        );
        expect(html, label).toContain("Reset row counter to RC: 000.");
        expect(html, label).toContain("SLEEVE CAP SHAPING CHART");
      }
    }
  });

  it("preserves sideways hand-sew finishing and does not reset a top-down sleeve", () => {
    const input: SidewaysCardiganSleeveCalcInput = {
      direction: "cuff-up",
      finishedUpperArmInches: 14,
      finishedWristInches: 7,
      sleeveLengthInches: 17,
      stitchesPerInch: 5,
      rowsPerInch: 7,
      cuffDepthInches: 2,
      armholeDepthInches: 7,
    };
    const cuffUp = buildSidewaysCardiganSleeveInstructions(input);
    const topDown = buildSidewaysCardiganSleeveInstructions({ ...input, direction: "top-down" });
    expect(cuffUp.ok && topDown.ok).toBe(true);
    if (!cuffUp.ok || !topDown.ok) return;
    const cuffHtml = renderSidewaysCardiganSleeveSequenceHtml(cuffUp.instructions);
    const topHtml = renderSidewaysCardiganSleeveSequenceHtml(topDown.instructions);
    expect(cuffHtml).toContain(SIDEWAYS_SLEEVE_HAND_SEW_LINE);
    expect(cuffHtml).toContain(SIDEWAYS_CUFF_UP_BIND_OFF_LINE);
    expect(cuffHtml).not.toContain("for the sleeve cuff");
    expect(topHtml).toContain(SIDEWAYS_SLEEVE_HAND_SEW_LINE);
    expect(topHtml).toContain("Bind off and work a crochet edging.");
    expect(topHtml).toContain("reverse hung hem");
    expect(topHtml).not.toContain(CUFF_UP_SLEEVE_BODY_ROW_COUNTER_RESET);
    const topRows = buildSidewaysCardiganSleeveDisplayRows(topDown.instructions.calc);
    const last = topRows
      .flatMap((row) => (row.kind === "block" ? row.sleeveShapingChartRows ?? [] : []))
      .at(-1);
    expect(last?.action).toBe(SIDEWAYS_TOP_DOWN_CHART_FINISH);
  });

  it("leaves sleeveless patterns without sleeve cuff choices", () => {
    const result = generateSleevelessBackPattern({
      fit: {
        sizingChart: "misses",
        selectedMeasurements: computeDefaultMeasurementsFromChartRow(MISSES, "standard", { bodyShape: "straight" }),
      },
      style: { recipientCategory: "misses", neckline: "round", frontStyle: "closed" },
      yarnGaugeMachine: { gaugeStitchesPerInch: 5, gaugeRowsPerInch: 7, availableNeedles: 200 },
    });
    const text = [blockText(result.displayRows), blockText(result.frontDisplayRows ?? [])].join("\n");
    expect(text).not.toContain("Choose one way to begin");
    expect(text).not.toContain("Choose one way to finish");
  });
});
