import { describe, expect, it } from "vitest";
import {
  generateDropShoulderPattern,
  dropShoulderFrontNecklineStartRc,
} from "./dropShoulderPatternOutput";
import { tryBuildLiveDropShoulderFrontNotationSvg } from "./dropShoulderFrontShapingNotationDiagramSvg";
import { formatRcNotation } from "./sleevelessBackJapaneseNotation";
import { dropShoulderFrontNeckShapingChartInputsReady } from "./dropShoulderFrontNeckShapingChart";
import { generateSleevelessBackPattern } from "./sleevelessPatternOutput";
import { RESET_ROW_COUNTER_TEXT, formatRowCounterResetGarmentRcLabel } from "./rowCounterReset";
import { renderSleevelessPrintPieceHtml } from "./sleevelessPatternPrintRender";
import type { SleevelessPatternDisplayRow } from "./sleevelessPatternOutput";
import { formatRcColon } from "./sleevelessPatternOutput";
import { computeDefaultMeasurementsFromChartRow } from "./sleevelessExpressSizeChartClient";
import type { ChartRow } from "./sleevelessExpressSizeChartTypes";

const DROP_SHOULDER_PULLOVER = {
  fit: {
    sizingChart: "women",
    selectedMeasurements: {
      finished_bust_chest: 40,
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
  },
};

const KIDS_2YR_CARDIGAN: ChartRow = {
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

function dropShoulderCardiganPattern(): Record<string, unknown> {
  return {
    fit: {
      sizingChart: "kids",
      selectedSize: "2 yr",
      easeChoice: "standard",
      selectedMeasurements: computeDefaultMeasurementsFromChartRow(KIDS_2YR_CARDIGAN, "standard", {
        bodyShape: "straight",
      }),
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

function sleevelessPulloverPattern(): Record<string, unknown> {
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
    style: { recipientCategory: "misses", neckline: "round" },
    yarnGaugeMachine: {
      gaugeStitchesPerInch: 5,
      gaugeRowsPerInch: 7,
      availableNeedles: 200,
    },
  };
}

function indexOfSection(rows: readonly SleevelessPatternDisplayRow[], title: string): number {
  return rows.findIndex((row) => row.kind === "section" && row.title === title);
}

function indexOfNecklineReset(rows: readonly SleevelessPatternDisplayRow[]): number {
  return rows.findIndex(
    (row) => row.kind === "block" && row.rowCounterReset === true,
  );
}

function blockText(row: Extract<SleevelessPatternDisplayRow, { kind: "block" }>): string {
  return [...(row.trustedParagraphs ?? []), ...(row.paragraphs ?? [])].join(" ");
}

function firstNecklineInstructionIndex(rows: readonly SleevelessPatternDisplayRow[]): number {
  const necklineSectionIdx = rows.findIndex(
    (row) => row.kind === "section" && /NECKLINE\s*&\s*SHOULDERS/i.test(String(row.title ?? "")),
  );
  if (necklineSectionIdx < 0) return -1;

  const necklineInstructionRe =
    /begin.*neckline shaping|divide for the v-neck|bind off the center \d+|place the center \d+|shape the neck|bind off \d+ stitches at the center-front/i;

  for (let i = necklineSectionIdx + 1; i < rows.length; i++) {
    const row = rows[i]!;
    if (row.kind === "section" || row.kind === "piece") break;
    if (row.kind === "block" && row.rowCounterReset !== true) {
      const text = blockText(row);
      if (necklineInstructionRe.test(text)) {
        return i;
      }
    }
  }
  return -1;
}

function necklineResetCount(rows: readonly SleevelessPatternDisplayRow[]): number {
  return rows.filter((row) => row.kind === "block" && row.rowCounterReset === true).length;
}

function frontBlockParagraphs(rows: SleevelessPatternDisplayRow[]): string[] {
  return rows
    .filter(
      (row): row is Extract<SleevelessPatternDisplayRow, { kind: "block" }> => row.kind === "block",
    )
    .flatMap((row) => [...(row.trustedParagraphs ?? []), ...(row.paragraphs ?? [])]);
}

function necklineSectionBlocks(rows: readonly SleevelessPatternDisplayRow[]): Extract<
  SleevelessPatternDisplayRow,
  { kind: "block" }
>[] {
  const sectionIdx = rows.findIndex(
    (row) => row.kind === "section" && /NECKLINE\s*&\s*SHOULDERS/i.test(String(row.title ?? "")),
  );
  if (sectionIdx < 0) return [];
  const blocks: Extract<SleevelessPatternDisplayRow, { kind: "block" }>[] = [];
  for (let i = sectionIdx + 1; i < rows.length; i++) {
    const row = rows[i]!;
    if (row.kind === "section" || row.kind === "piece") break;
    if (row.kind === "block") blocks.push(row);
  }
  return blocks;
}

function firstNecklineInstructionBlock(
  rows: readonly SleevelessPatternDisplayRow[],
): Extract<SleevelessPatternDisplayRow, { kind: "block" }> | undefined {
  const idx = firstNecklineInstructionIndex(rows);
  if (idx < 0) return undefined;
  const row = rows[idx];
  return row?.kind === "block" ? row : undefined;
}

function allDropShoulderWrittenText(
  result: ReturnType<typeof generateDropShoulderPattern>,
): string {
  const rowSets = [result.displayRows, result.frontDisplayRows ?? [], result.sleeveDisplayRows ?? []];
  return rowSets
    .flatMap((rows) =>
      rows
        .filter(
          (row): row is Extract<SleevelessPatternDisplayRow, { kind: "block" }> => row.kind === "block",
        )
        .flatMap((row) => [...(row.trustedParagraphs ?? []), ...(row.paragraphs ?? [])]),
    )
    .join("\n");
}

describe("drop-shoulder neckline row counter reset", () => {
  it("places reset before neckline shaping on pullover back", () => {
    const result = generateDropShoulderPattern(DROP_SHOULDER_PULLOVER);
    const rows = result.displayRows;

    expect(necklineResetCount(rows)).toBe(1);
    const resetIdx = indexOfNecklineReset(rows);
    const necklineSectionIdx = indexOfSection(rows, "BACK NECKLINE & SHOULDERS");
    const firstNeckIdx = firstNecklineInstructionIndex(rows);
    const firstNeckBlock = firstNecklineInstructionBlock(rows);

    expect(resetIdx).toBeGreaterThanOrEqual(0);
    expect(necklineSectionIdx).toBeGreaterThan(resetIdx);
    expect(firstNeckIdx).toBeGreaterThan(resetIdx);
    expect(firstNeckBlock?.rc).toBe("RC: 000");
    expect(rows[resetIdx]?.kind).toBe("block");
    if (rows[resetIdx]?.kind !== "block") throw new Error("expected reset block");
    expect(rows[resetIdx].rowCounterResetGarmentRc).toBeDefined();
    expect(rows[resetIdx].paragraphs).toEqual([]);
  });

  it("places reset before neckline shaping on pullover front", () => {
    const result = generateDropShoulderPattern(DROP_SHOULDER_PULLOVER);
    const rows = result.frontDisplayRows ?? [];

    expect(necklineResetCount(rows)).toBe(1);
    const resetIdx = indexOfNecklineReset(rows);
    const necklineSectionIdx = indexOfSection(rows, "FRONT NECKLINE & SHOULDERS");
    const chartMountIdx = rows.findIndex((row) => row.kind === "neckShoulderChartTableMount");
    const firstNeckIdx = firstNecklineInstructionIndex(rows);
    const firstNeckBlock = firstNecklineInstructionBlock(rows);

    expect(resetIdx).toBeGreaterThanOrEqual(0);
    expect(necklineSectionIdx).toBeGreaterThan(resetIdx);
    expect(firstNeckIdx).toBeGreaterThan(resetIdx);
    expect(firstNeckBlock?.rc).toBe("RC: 000");
    if (chartMountIdx >= 0) expect(chartMountIdx).toBeGreaterThan(resetIdx);
  });

  it("places reset on cardigan front when neckline chart inputs restart at RC 000", () => {
    const result = generateDropShoulderPattern(dropShoulderCardiganPattern());
    expect(result.frontNeckShoulderChartUsesLiveRows).toBe(true);
    expect(
      dropShoulderFrontNeckShapingChartInputsReady({
        neckSts: result.debug.necklineStitches ?? 0,
        shoulderStsEach: result.debug.shoulderStitches ?? 0,
        frontNeckDepthRows: result.debug.frontNeckDepthRows ?? 0,
        totalRows: result.debug.totalCalculatedRows ?? 0,
        bustBodySts: result.debug.bustBodyStitches ?? 0,
      }),
    ).toBe(true);

    const rows = result.frontDisplayRows ?? [];
    expect(necklineResetCount(rows)).toBe(1);
    expect(indexOfNecklineReset(rows)).toBeLessThan(indexOfSection(rows, "FRONT NECKLINE & SHOULDERS"));
    expect(firstNecklineInstructionBlock(rows)?.rc).toBe("RC: 000");
  });

  it("omits reset on cardigan front when neckline chart would not build (no RC 000 chart/map)", () => {
    const result = generateDropShoulderPattern({
      ...dropShoulderCardiganPattern(),
      fit: {
        sizingChart: "kids",
        selectedMeasurements: {
          finished_bust_chest: 21,
          back_neck_to_hem: 18,
          upper_arm: 6,
          wrist: 4.5,
          sleeve_length: 8.5,
          shoulder_width: 0,
          neck_opening: 0,
          back_neck_depth: 1,
          front_neck_depth: 2,
        },
      },
    });

    expect(result.frontNeckShoulderChartUsesLiveRows).toBe(false);
    expect(necklineResetCount(result.frontDisplayRows ?? [])).toBe(0);
  });

  it("does not add neckline reset to unrelated drop-shoulder sections", () => {
    const result = generateDropShoulderPattern(DROP_SHOULDER_PULLOVER);
    const sleeveResets = necklineResetCount(result.sleeveDisplayRows ?? []);
    expect(sleeveResets).toBe(0);

    const bodySectionEnd = indexOfSection(result.displayRows, "ABOVE ARMHOLE MARKERS");
    const resetIdx = indexOfNecklineReset(result.displayRows);
    expect(bodySectionEnd).toBeGreaterThanOrEqual(0);
    expect(resetIdx).toBeGreaterThan(bodySectionEnd);
  });

  it("does not carry body garment RC labels into neckline sections after reset", () => {
    const result = generateDropShoulderPattern(DROP_SHOULDER_PULLOVER);
    const armholeRc = formatRcColon(result.debug.armholeStartRow ?? 0);
    const neckGarmentStart = formatRcColon(result.debug.frontNecklineStartRC ?? 0);

    for (const rows of [result.displayRows, result.frontDisplayRows ?? []]) {
      const sectionBlocks = necklineSectionBlocks(rows);
      expect(sectionBlocks.length).toBeGreaterThan(0);
      for (const block of sectionBlocks) {
        if (block.rowCounterReset) continue;
        expect(block.rc).not.toBe(armholeRc);
        expect(block.rc).not.toBe(neckGarmentStart);
      }
      const necklineText = sectionBlocks
        .filter((block) => !block.rowCounterReset)
        .flatMap((block) => [...(block.trustedParagraphs ?? []), ...(block.paragraphs ?? [])])
        .join("\n");
      expect(necklineText).not.toMatch(
        new RegExp(`knit even to ${neckGarmentStart.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "i"),
      );
    }
  });

  it("uses local neckline RC finish rows aligned with chart depth (pullover front)", () => {
    const result = generateDropShoulderPattern(DROP_SHOULDER_PULLOVER);
    const localNeckRows =
      (result.debug.totalCalculatedRows ?? 0) - (result.debug.frontNecklineStartRC ?? 0);
    const text = frontBlockParagraphs(result.frontDisplayRows).join("\n");
    expect(text).toContain(`knit even to RC: ${String(localNeckRows).padStart(3, "0")}`);
    expect(result.frontNeckShoulderChartUsesLiveRows).toBe(true);
    expect(result.frontNeckShoulderShapingChart.rows.length).toBeGreaterThan(0);
  });

  it("does not alter sleeveless pattern output", () => {
    const before = generateSleevelessBackPattern(sleevelessPulloverPattern());
    const backResets = necklineResetCount(before.displayRows);
    const frontResets = necklineResetCount(before.frontDisplayRows ?? []);

    expect(backResets).toBe(1);
    expect(frontResets).toBe(1);

    const backNeckSection = before.displayRows.findIndex(
      (row) => row.kind === "section" && /neck/i.test(String(row.title ?? "")),
    );
    const backResetIdx = indexOfNecklineReset(before.displayRows);
    expect(backResetIdx).toBeLessThan(backNeckSection);
  });

  it("keeps the reset on its own block, not inside neckline shaping instructions", () => {
    const result = generateDropShoulderPattern(DROP_SHOULDER_PULLOVER);
    for (const rows of [result.displayRows, result.frontDisplayRows ?? []]) {
      const resetIdx = indexOfNecklineReset(rows);
      const row = rows[resetIdx];
      expect(row?.kind).toBe("block");
      if (row?.kind !== "block") throw new Error("expected reset block");
      expect(row.rowCounterReset).toBe(true);
      expect(blockText(row).trim()).toBe("");
      const next = rows[resetIdx + 1];
      expect(next?.kind).toBe("section");
      expect(String((next as { title?: string }).title ?? "")).toMatch(/NECKLINE\s*&\s*SHOULDERS/i);
    }
  });

  it("never uses Counter reads RC parentheticals in written drop-shoulder output", () => {
    for (const patternData of [DROP_SHOULDER_PULLOVER, dropShoulderCardiganPattern()]) {
      const result = generateDropShoulderPattern(patternData);
      expect(allDropShoulderWrittenText(result)).not.toMatch(/Counter reads RC:/i);

      const printHtml = [
        renderSleevelessPrintPieceHtml(result.displayRows, ""),
        renderSleevelessPrintPieceHtml(result.frontDisplayRows ?? [], ""),
        renderSleevelessPrintPieceHtml(result.sleeveDisplayRows ?? [], ""),
      ].join("\n");
      expect(printHtml).not.toMatch(/Counter reads RC:/i);
    }
  });

  it("drops the counter-read parenthetical from the instruction before reset", () => {
    const result = generateDropShoulderPattern(DROP_SHOULDER_PULLOVER);
    const resetIdx = indexOfNecklineReset(result.displayRows);
    const prev = result.displayRows[resetIdx - 1];
    expect(prev?.kind).toBe("block");
    if (prev?.kind !== "block") throw new Error("expected block before reset");
    const text = blockText(prev);
    expect(text).not.toMatch(/Counter reads RC:/i);
    expect(text).toMatch(/Knit \d+ rows even\.$/);
  });

  it("renders the shared reset wording before neckline instructions in print HTML", () => {
    const result = generateDropShoulderPattern(DROP_SHOULDER_PULLOVER);
    const backResetBlock = result.displayRows[indexOfNecklineReset(result.displayRows)];
    const frontResetBlock = (result.frontDisplayRows ?? [])[
      indexOfNecklineReset(result.frontDisplayRows ?? [])
    ];
    const backHtml = renderSleevelessPrintPieceHtml(result.displayRows, "");
    const frontHtml = renderSleevelessPrintPieceHtml(result.frontDisplayRows ?? [], "");

    expect(backHtml).toContain("row-counter-reset");
    expect(backHtml).toContain(RESET_ROW_COUNTER_TEXT);
    expect(backHtml).toContain("row-counter-reset__garment-rc");
    if (backResetBlock?.kind === "block") {
      expect(backHtml).toContain(
        formatRowCounterResetGarmentRcLabel(backResetBlock.rowCounterResetGarmentRc ?? 0),
      );
    }
    const backResetIdx = backHtml.indexOf(RESET_ROW_COUNTER_TEXT);
    const backNeckIdx = backHtml.search(/begin back neckline shaping/i);
    expect(backResetIdx).toBeGreaterThanOrEqual(0);
    expect(backNeckIdx).toBeGreaterThan(backResetIdx);

    expect(frontHtml).toContain("row-counter-reset");
    expect(frontHtml).toContain(RESET_ROW_COUNTER_TEXT);
    expect(frontHtml).toContain("row-counter-reset__garment-rc");
    if (frontResetBlock?.kind === "block") {
      expect(frontHtml).toContain(
        formatRowCounterResetGarmentRcLabel(frontResetBlock.rowCounterResetGarmentRc ?? 0),
      );
    }
    const frontResetIdx = frontHtml.indexOf(RESET_ROW_COUNTER_TEXT);
    const frontNeckIdx = frontHtml.search(
      /bind off the center \d+|place the center \d+|divide for the v-neck|shape the neck/i,
    );
    expect(frontResetIdx).toBeGreaterThanOrEqual(0);
    expect(frontNeckIdx).toBeGreaterThan(frontResetIdx);
  });
});

function writtenTimingPattern(
  frontNeckDepth: number,
  extras: { neckline?: string; frontStyle?: string; garmentStyle?: string } = {},
): Record<string, unknown> {
  return {
    fit: {
      sizingChart: "women",
      selectedMeasurements: {
        finished_bust_chest: 40,
        back_neck_to_hem: 24,
        upper_arm: 13.4,
        wrist: 8,
        sleeve_length: 12,
        shoulder_width: 16,
        neck_opening: 7,
        back_neck_depth: 1,
        front_neck_depth: frontNeckDepth,
      },
    },
    yarnGaugeMachine: {
      gaugeStitchesPerInch: 5,
      gaugeRowsPerInch: 6,
      availableNeedles: 200,
    },
    style: {
      construction: "drop-shoulder",
      frontStyle: extras.frontStyle ?? "closed",
      garmentStyle: extras.garmentStyle ?? "pullover",
      neckline: extras.neckline ?? "round",
    },
  };
}

function firstRcAfterFrontNecklineSection(
  rows: readonly SleevelessPatternDisplayRow[],
): string | undefined {
  const sectionIdx = indexOfSection(rows, "FRONT NECKLINE & SHOULDERS");
  if (sectionIdx < 0) return undefined;
  for (let i = sectionIdx + 1; i < rows.length; i++) {
    const row = rows[i]!;
    if (row.kind === "section" || row.kind === "piece") break;
    if (row.kind === "block" && row.rowCounterReset !== true && row.rc) {
      return row.rc;
    }
  }
  return undefined;
}

function frontMarkerBlock(
  rows: readonly SleevelessPatternDisplayRow[],
): Extract<SleevelessPatternDisplayRow, { kind: "block" }> | undefined {
  return rows.find(
    (row): row is Extract<SleevelessPatternDisplayRow, { kind: "block" }> =>
      row.kind === "block" && /Place a marker/i.test(blockText(row)),
  );
}

describe("Drop Shoulder Front written RC when neckline begins before the armhole marker", () => {
  const COMBOS: Array<{
    name: string;
    extras: { neckline?: string; frontStyle?: string; garmentStyle?: string };
  }> = [
    { name: "Pullover Round", extras: {} },
    { name: "Pullover V-neck", extras: { neckline: "v-neck" } },
    { name: "Cardigan Round", extras: { frontStyle: "open", garmentStyle: "cardigan" } },
    {
      name: "Cardigan V-neck",
      extras: { neckline: "v-neck", frontStyle: "open", garmentStyle: "cardigan" },
    },
  ];

  it.each(COMBOS)(
    "$name: no neckline reset to RC 000; marker later on continuous garment RC",
    ({ extras }) => {
      const pattern = writtenTimingPattern(12, extras);
      const result = generateDropShoulderPattern(pattern);
      const rows = result.frontDisplayRows ?? [];
      const start = result.debug.frontNecklineStartRC!;
      const marker = result.debug.armholeStartRow!;
      const total = result.debug.totalCalculatedRows!;

      expect(start).toBe(dropShoulderFrontNecklineStartRc(total, result.debug.frontNeckDepthRows!));
      expect(start).toBe(72);
      expect(start).toBeLessThan(marker);
      expect(result.debug.frontNeckDepthRows).toBe(72);

      expect(necklineResetCount(rows)).toBe(0);
      expect(indexOfNecklineReset(rows)).toBe(-1);
      expect(firstRcAfterFrontNecklineSection(rows)).toBe(formatRcColon(start));
      expect(firstRcAfterFrontNecklineSection(rows)).not.toBe("RC: 000");

      const markerBlock = frontMarkerBlock(rows);
      expect(markerBlock?.rc).toBe(formatRcColon(marker));
      expect(marker).toBeGreaterThan(start);

      const printHtml = renderSleevelessPrintPieceHtml(rows, "");
      expect(printHtml).not.toContain(RESET_ROW_COUNTER_TEXT);

      const live = tryBuildLiveDropShoulderFrontNotationSvg(result, pattern) ?? "";
      expect(live).toContain('data-reset="false"');
      expect(live).toContain(`data-rc-neck-start="${formatRcNotation(start)}"`);
      expect(live).toContain(`data-rc-armhole-marker="${formatRcNotation(marker)}"`);
      expect(live).not.toContain('data-rc-neck-start="rc000"');
    },
  );

  it("retains reset / local RC when the Front neckline starts at the armhole marker", () => {
    const pattern = writtenTimingPattern(6.7);
    const result = generateDropShoulderPattern(pattern);
    const rows = result.frontDisplayRows ?? [];
    expect(result.debug.frontNecklineStartRC).toBe(result.debug.armholeStartRow);
    expect(necklineResetCount(rows)).toBe(1);
    expect(firstRcAfterFrontNecklineSection(rows)).toBe("RC: 000");
    expect(frontMarkerBlock(rows)?.rc).toBe(formatRcColon(result.debug.armholeStartRow!));
    const live = tryBuildLiveDropShoulderFrontNotationSvg(result, pattern) ?? "";
    expect(live).toContain('data-reset="true"');
    expect(live).toContain('data-rc-neck-start="rc000"');
  });

  it("retains reset / local RC when the Front neckline starts after the armhole marker", () => {
    const pattern = writtenTimingPattern(3);
    const result = generateDropShoulderPattern(pattern);
    const rows = result.frontDisplayRows ?? [];
    expect(result.debug.frontNecklineStartRC).toBeGreaterThan(result.debug.armholeStartRow!);
    expect(necklineResetCount(rows)).toBe(1);
    expect(firstRcAfterFrontNecklineSection(rows)).toBe("RC: 000");
    expect(frontMarkerBlock(rows)?.rc).toBe(formatRcColon(result.debug.armholeStartRow!));
    const live = tryBuildLiveDropShoulderFrontNotationSvg(result, pattern) ?? "";
    expect(live).toContain('data-reset="true"');
    expect(live).toContain('data-rc-neck-start="rc000"');
  });

  it("does not change Back reset or Sleeveless Front reset", () => {
    const deep = generateDropShoulderPattern(writtenTimingPattern(12));
    expect(necklineResetCount(deep.displayRows)).toBe(1);
    expect(firstNecklineInstructionBlock(deep.displayRows)?.rc).toBe("RC: 000");
    expect(deep.debug.backNecklineStartRC).toBeGreaterThanOrEqual(deep.debug.armholeStartRow!);

    const sleeveless = generateSleevelessBackPattern(sleevelessPulloverPattern());
    expect(necklineResetCount(sleeveless.displayRows)).toBe(1);
    expect(necklineResetCount(sleeveless.frontDisplayRows ?? [])).toBe(1);
  });
});
