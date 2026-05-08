import { describe, expect, it } from "vitest";
import { calculateRoundFrontNeckline } from "./legoBlocks/roundFrontNeckline";
import { initialCenterNeckStitches } from "./legoBlocks/roundNeckline";
import {
  parseShapingDecrease,
  renderShoulderShapingSvg,
} from "./shoulderShapingSvg";
import {
  renderNeckShoulderShapingChartTableOnlyHtml,
  renderNeckShoulderShapingDiagramOnlyHtml,
  renderNeckShoulderShapingPrintInstructionTableHtml,
} from "./neckShoulderShapingChartHtml";
import type { SleevelessPatternDisplayRow } from "./sleevelessPatternOutput";
import {
  buildSleevelessBackDisplayRows,
  buildSleevelessFrontDisplayRows,
  demoSleevelessBackPattern,
  formatCenterNecklineBindOffAroundZeroPhrase,
  formatCenterNecklineBindOffPreambleExecution,
  formatPlainKnitInPatternSpan,
  formatRcColon,
  formatShoulderBindoffRemainingInstruction,
  formatShouldersRemainingAfterCenterBindOffPhrase,
  generateSleevelessBackPattern,
} from "./sleevelessPatternOutput";

function collectBlockInstructionText(rows: readonly SleevelessPatternDisplayRow[]): string[] {
  const out: string[] = [];
  for (const r of rows) {
    if (r.kind !== "block") continue;
    if (r.rc) out.push(r.rc);
    for (const p of r.paragraphs) out.push(p);
    if (r.tipHtml) out.push(r.tipHtml.replace(/<[^>]+>/g, " "));
    if (r.collapsibleTipHtml) out.push(r.collapsibleTipHtml.replace(/<[^>]+>/g, " "));
  }
  return out;
}

describe("sleevelessPatternOutput RC progression", () => {
  const patternData: Record<string, unknown> = {
    fit: {
      sizingChart: "misses",
      selectedMeasurements: {
        finished_bust_chest: 40,
        back_neck_to_hem: 22,
        armhole_depth: 8,
        neck_opening: 2,
        shoulder_width: 4.25,
        back_neck_depth: 1,
      },
    },
    style: { recipientCategory: "misses" },
    yarnGaugeMachine: {
      gaugeStitchesPerInch: 5,
      gaugeRowsPerInch: 7,
      availableNeedles: 200,
    },
  };

  it("upper back before neckline uses Knit to RC at the first back neckline shaping row", () => {
    const result = generateSleevelessBackPattern(patternData);
    const { debug } = result;
    expect(debug.remainingRowsBeforeNeckline ?? 0).toBeGreaterThanOrEqual(0);

    const neckIdx = result.displayRows.findIndex(
      (r) => r.kind === "section" && r.title === "BACK NECKLINE & SHOULDERS",
    );
    expect(neckIdx).toBeGreaterThan(0);
    const preNeckBlocks = result.displayRows.slice(0, neckIdx).filter(
      (r): r is Extract<(typeof result.displayRows)[number], { kind: "block" }> => r.kind === "block",
    );
    const nextNeckRc = debug.backNecklineStartRC;
    const bridge = preNeckBlocks.filter((b) =>
      b.paragraphs.some((p) => {
        const m = p.trim().match(/^Knit to RC:?(\d+)\.$/i);
        return m && parseInt(m[1], 10) === nextNeckRc;
      }),
    );
    if ((debug.remainingRowsBeforeNeckline ?? 0) === 0) {
      expect(bridge.length).toBe(0);
      return;
    }
    expect(bridge.length).toBe(1);
    const p = bridge[0]!.paragraphs.join(" ");
    const m = p.match(/Knit to RC (\d+)\./i);
    expect(m).toBeTruthy();
    const nextActionRc = parseInt(m![1], 10);
    expect(nextActionRc).toBe(debug.backNecklineStartRC);
    const rcLabel = bridge[0]!.rc?.match(/^RC:(\d+)$/);
    expect(rcLabel).toBeTruthy();
    const startRc = parseInt(rcLabel![1], 10);
    const n = nextActionRc - startRc;
    expect(n).toBe(debug.remainingRowsBeforeNeckline);
    expect(startRc + n).toBe(debug.backNecklineStartRC);
  });

  it("armhole starts with a local RC reset and no garment RC text", () => {
    const result = generateSleevelessBackPattern(patternData);
    const rows = result.displayRows.filter((r) => r.kind === "block") as Array<
      Extract<(typeof result.displayRows)[number], { kind: "block" }>
    >;

    const hemRows = result.debug.hemRows;
    const bodyRows = result.debug.bodyRows;
    const expectedArmhole = hemRows + bodyRows;

    const firstArmhole = rows.find(
      (b) =>
        b.rc &&
        b.paragraphs.some(
          (p) => /\bAt (?:armhole )?RC\b/i.test(p) && /armhole edge/i.test(p) && /bind off/i.test(p),
        ),
    );
    expect(firstArmhole?.rc).toBe("RC:000");
    expect(firstArmhole?.paragraphs.join(" ")).not.toContain("Garment RC");
    expect(firstArmhole?.paragraphs.join(" ")).toContain(
      "Reset row counter to RC:000",
    );

    const neckSectionIdx = result.displayRows.findIndex(
      (r) => r.kind === "section" && r.title === "BACK NECKLINE & SHOULDERS",
    );
    expect(neckSectionIdx).toBeGreaterThanOrEqual(0);
    const neckBlocks = result.displayRows.slice(neckSectionIdx + 1).filter(
      (r): r is Extract<(typeof result.displayRows)[number], { kind: "block" }> => r.kind === "block",
    );
    const summaryBlock = neckBlocks.find((b) =>
      b.paragraphs.some((p) =>
        p.includes("Place one group of shoulder stitches on hold or scrap yarn."),
      ),
    );
    expect(summaryBlock).toBeDefined();
    if (summaryBlock) {
      const joined = summaryBlock.paragraphs.join("\n");
      expect(joined).not.toMatch(/repeat the same shaping for the second shoulder/i);
    }
  });

  it("keeps BACK pre-neckline Knit-to RC targets chronological with neckline start", () => {
    const result = generateSleevelessBackPattern(patternData);
    const neckStart = result.debug.backNecklineStartRC;
    const neckSectionIdx = result.displayRows.findIndex(
      (r) => r.kind === "section" && r.title === "BACK NECKLINE & SHOULDERS",
    );
    expect(neckSectionIdx).toBeGreaterThan(0);
    const preNeckBlocks = result.displayRows.slice(0, neckSectionIdx).filter(
      (r): r is Extract<(typeof result.displayRows)[number], { kind: "block" }> => r.kind === "block",
    );
    for (const block of preNeckBlocks) {
      for (const p of block.paragraphs) {
        const m = p.trim().match(/^Knit to RC:?(\d{1,4})\.\s*$/i);
        if (!m) continue;
        expect(parseInt(m[1], 10)).toBeLessThanOrEqual(neckStart);
      }
    }
  });

  it("renders standalone front intro and duplicate execution sections", () => {
    const data = {
      ...patternData,
      fit: {
        ...(patternData.fit as object),
        selectedMeasurements: {
          ...(patternData.fit as { selectedMeasurements: Record<string, unknown> }).selectedMeasurements,
          front_neck_depth: 3,
        },
      },
    };
    const result = generateSleevelessBackPattern(data);
    const frontBlocks = result.frontDisplayRows.filter((r) => r.kind === "block") as Array<
      Extract<(typeof result.frontDisplayRows)[number], { kind: "block" }>
    >;
    const intro = frontBlocks.find((b) =>
      b.paragraphs.some((p) => p === "Front follows the same sequence as the back until neckline shaping begins.")
    );
    expect(intro).toBeDefined();
    expect(intro?.paragraphs[0]).toBe("Front follows the same sequence as the back until neckline shaping begins.");

    const frontSectionTitles = result.frontDisplayRows
      .filter((r): r is Extract<(typeof result.frontDisplayRows)[number], { kind: "section" }> => r.kind === "section")
      .map((r) => r.title);
    expect(frontSectionTitles).toContain("RIBBED HEM");
    expect(frontSectionTitles).toContain("BODY");
    expect(frontSectionTitles).toContain("ARMHOLE");
    expect(frontSectionTitles).toContain("FRONT NECKLINE & SHOULDERS");
    const holdCount = frontBlocks.flatMap((b) => b.paragraphs).filter((p) =>
      p.includes("Place one group of shoulder stitches on hold or scrap yarn."),
    ).length;
    expect(holdCount).toBeLessThanOrEqual(1);
  });

  it("clamps front shared plain spans so RCs do not run past the front neckline start", () => {
    const frontNecklineStartRC = 221;
    const backRaw = buildSleevelessBackDisplayRows({
      castOnSts: 100,
      hemRows: 10,
      hemRowsValid: true,
      bodyToArmholeRows: 40,
      bodyRowsValid: true,
      armholeMath: {
        bindOffSts: 5,
        decreaseSts: 0,
        decreaseRows: 0,
        evenRows: 0,
      },
      firstArmholeRC: 51,
      stitchesAfterArmhole: 90,
      upperBackRows: 30,
      upperStartRc: 200,
      evenRowPadRows: 20,
      padStartRc: 228,
      neckChartRows: [],
      useNeckChartRows: false,
    });

    const upperBeforeClamp = backRaw.find(
      (r) => r.kind === "block" && r.rc === "RC:149" && r.paragraphs.some((p) => p.includes("Knit to RC")),
    );
    expect(
      upperBeforeClamp?.kind === "block" &&
        upperBeforeClamp.paragraphs.some((p) => p.includes("Knit to RC:")),
    ).toBe(true);

    const padBeforeClamp = backRaw.find(
      (r) => r.kind === "block" && r.rc === "RC:177" && r.paragraphs.some((p) => p.includes("Knit to RC")),
    );
    expect(padBeforeClamp).toBeDefined();

    const frontRows = buildSleevelessFrontDisplayRows({
      frontNecklineStartRC,
      sharedExecutionRows: backRaw,
      useNeckChartRows: false,
      neckChartRows: [],
    });

    const neckIdx = frontRows.findIndex(
      (r) => r.kind === "section" && r.title === "FRONT NECKLINE & SHOULDERS",
    );
    expect(neckIdx).toBeGreaterThan(0);
    const preNeck = frontRows.slice(0, neckIdx);

    const upperAfter = preNeck.find(
      (r): r is Extract<(typeof preNeck)[number], { kind: "block" }> =>
        r.kind === "block" && r.rc === "RC:149",
    );
    expect(upperAfter?.paragraphs.some((p) => /^Knit to RC:\d+\.$/i.test(p.trim()))).toBe(true);
    expect(upperAfter?.paragraphs.some((p) => p.includes("30 rows"))).toBe(false);

    const knitToRe = /^Knit to RC:?(\d{1,4})\.\s*$/i;
    const knitUntilRe = /^Knit in pattern until RC (\d{1,4})\.\s*$/i;
    const knitPlainRe = /^Knit in pattern for (\d+) rows?\.?$/i;
    const rcRe = /^RC:(\d{1,4})$/;
    for (const r of preNeck) {
      if (r.kind !== "block" || !r.rc) continue;
      const rm = r.rc.match(rcRe);
      if (!rm) continue;
      const startRc = parseInt(rm[1], 10);

      for (const p of r.paragraphs) {
        const km = p.trim().match(knitPlainRe);
        if (km) {
          const n = parseInt(km[1], 10);
          expect(startRc + n).toBeLessThanOrEqual(frontNecklineStartRC);
          continue;
        }
        const tm = p.trim().match(knitToRe);
        if (tm) {
          const nextRc = parseInt(tm[1], 10);
          expect(nextRc).toBeLessThanOrEqual(frontNecklineStartRC);
          continue;
        }
        const um = p.trim().match(knitUntilRe);
        if (um) {
          const endRc = parseInt(um[1], 10);
          expect(endRc + 1).toBeLessThanOrEqual(frontNecklineStartRC);
        }
      }
    }
  });

  it("integrated: front display RCs before neckline never exceed front neckline start for plain spans", () => {
    const data = {
      fit: {
        sizingChart: "misses",
        selectedMeasurements: {
          finished_bust_chest: 40,
          back_neck_to_hem: 22,
          armhole_depth: 8,
          neck_opening: 2,
          shoulder_width: 4.25,
          back_neck_depth: 1,
          front_neck_depth: 3,
        },
      },
      style: { recipientCategory: "misses" },
      yarnGaugeMachine: {
        gaugeStitchesPerInch: 5,
        gaugeRowsPerInch: 7,
        availableNeedles: 200,
      },
    };
    const result = generateSleevelessBackPattern(data);
    const frontNeckStart = result.debug.frontNecklineStartRC;
    expect(frontNeckStart).toBeGreaterThan(0);

    const neckIdx = result.frontDisplayRows.findIndex(
      (r) => r.kind === "section" && r.title === "FRONT NECKLINE & SHOULDERS",
    );
    expect(neckIdx).toBeGreaterThan(0);
    const preNeck = result.frontDisplayRows.slice(0, neckIdx);

    const knitToRe = /^Knit to RC:?(\d{1,4})\.\s*$/i;
    const knitUntilRe = /^Knit in pattern until RC (\d{1,4})\.\s*$/i;
    const knitPlainRe = /^Knit in pattern for (\d+) rows?\.?$/i;
    const rcRe = /^RC:(\d{1,4})$/;
    for (const r of preNeck) {
      if (r.kind !== "block" || !r.rc) continue;
      const rm = r.rc.match(rcRe);
      if (!rm) continue;
      const startRc = parseInt(rm[1], 10);

      for (const p of r.paragraphs) {
        const km = p.trim().match(knitPlainRe);
        if (km) {
          const n = parseInt(km[1], 10);
          expect(startRc + n).toBeLessThanOrEqual(frontNeckStart);
          continue;
        }
        const tm = p.trim().match(knitToRe);
        if (tm) {
          const nextRc = parseInt(tm[1], 10);
          expect(nextRc).toBeLessThanOrEqual(frontNeckStart);
          continue;
        }
        const um = p.trim().match(knitUntilRe);
        if (um) {
          const endRc = parseInt(um[1], 10);
          expect(endRc + 1).toBeLessThanOrEqual(frontNeckStart);
        }
      }
    }
  });

  it("shows stitch counts after each row action and carries the same total forward", () => {
    const result = generateSleevelessBackPattern(patternData);
    const blocks = result.displayRows.filter((r) => r.kind === "block") as Array<
      Extract<(typeof result.displayRows)[number], { kind: "block" }>
    >;
    const expectedBackStitches = result.debug.backStitches;

    const castOn = blocks.find((b) => b.paragraphs.some((p) => p.includes("Cast on")));
    expect(castOn?.stitchCount).toBe(expectedBackStitches);

    const firstArmholeRc = result.debug.hemRows + result.debug.bodyRows;
    const body = blocks.find(
      (b) =>
        b.rc === `RC:${String(result.debug.hemRows).padStart(3, "0")}` &&
        b.paragraphs.some((p) => p === `Knit to RC ${firstArmholeRc}.`),
    );
    expect(body?.stitchCount).toBe(expectedBackStitches);

    const armholeStart = blocks.find((b) =>
      b.paragraphs.some((p) => /\bAt (?:armhole )?RC\b/i.test(p) && /armhole edge/i.test(p) && /bind off/i.test(p)),
    );
    expect(armholeStart?.stitchCount).toBeDefined();

    const decreaseSummary = blocks.find((b) =>
      b.paragraphs.some((p) => /decrease 1 stitch .* every other row/i.test(p))
    );
    expect(decreaseSummary?.stitchCount).toBeDefined();
    expect(
      typeof armholeStart?.stitchCount === "number" &&
        typeof decreaseSummary?.stitchCount === "number" &&
        decreaseSummary.stitchCount < armholeStart.stitchCount,
    ).toBe(true);

    const decreaseSummaryIdx = blocks.findIndex((b) =>
      b.paragraphs.some((p) => /decrease 1 stitch .* every other row/i.test(p))
    );
    const evenAfterArmhole =
      decreaseSummaryIdx >= 0
        ? blocks
            .slice(decreaseSummaryIdx + 1)
            .find((b) =>
              b.paragraphs.some(
                (p) =>
                  /^Knit to RC:?\d+\.$/i.test(p.trim()) ||
                  /knit in pattern(?: to RC:\d+)?\./i.test(p.trim())
              )
            )
        : undefined;
    expect(decreaseSummary?.stitchCount).toBe(evenAfterArmhole?.stitchCount);
  });

  it("demo sleeveless sample: BODY uses Knit to RC matching first armhole block rc", () => {
    const result = demoSleevelessBackPattern();
    const { hemRows, bodyRows } = result.debug;
    const firstArmholeRc = hemRows + bodyRows;
    const blocks = result.displayRows.filter((r) => r.kind === "block") as Array<
      Extract<(typeof result.displayRows)[number], { kind: "block" }>
    >;
    const bodyRc = formatRcColon(hemRows);
    const bodyBlock = blocks.find(
      (b) =>
        b.rc === bodyRc && b.paragraphs.some((p) => p.trim() === `Knit to RC ${firstArmholeRc}.`),
    );
    expect(bodyBlock).toBeDefined();
    const armholeBlock = blocks.find(
      (b) =>
        b.rc === "RC:000" &&
        b.paragraphs.some((p) => /\bAt (?:armhole )?RC\b/i.test(p) && /bind off/i.test(p) && /armhole edge/i.test(p)),
    );
    expect(armholeBlock).toBeDefined();
    expect(armholeBlock?.paragraphs.join(" ")).not.toContain("garment RC");
  });

  it("main BACK and FRONT display: no legacy plain-span phrasing in block instructions", () => {
    const data = {
      ...patternData,
      fit: {
        ...(patternData.fit as object),
        selectedMeasurements: {
          ...(patternData.fit as { selectedMeasurements: Record<string, unknown> }).selectedMeasurements,
          front_neck_depth: 3,
        },
      },
    };
    const result = generateSleevelessBackPattern(data);
    const forbiddenFor = /\bKnit in pattern for\b/i;
    const forbiddenUntil = /\bKnit in pattern until RC\b/i;
    for (const rows of [result.displayRows, result.frontDisplayRows]) {
      const blob = collectBlockInstructionText(rows).join("\n");
      expect(blob).not.toMatch(forbiddenFor);
      expect(blob).not.toMatch(forbiddenUntil);
      expect(blob).not.toMatch(/\bKnit in pattern for 0 rows\b/i);
    }
  });

  it("merges adjacent BACK plain-knit spans when the next span starts at the prior Knit-to RC", () => {
    const result = generateSleevelessBackPattern(patternData);
    let sawAdjacentSplit = false;
    for (let i = 0; i < result.displayRows.length - 1; i++) {
      const current = result.displayRows[i];
      const next = result.displayRows[i + 1];
      if (current?.kind !== "block" || next?.kind !== "block") continue;
      if (current.paragraphs.length !== 1 || next.paragraphs.length !== 1) continue;
      const currentStart = current.rc?.match(/^RC:(\d+)$/);
      const nextStart = next.rc?.match(/^RC:(\d+)$/);
      const currentTarget = current.paragraphs[0]?.match(/^Knit to RC:?(\d+)\.$/i);
      const nextTarget = next.paragraphs[0]?.match(/^Knit to RC:?(\d+)\.$/i);
      if (!nextTarget) continue;
      if (!currentStart || !nextStart || !currentTarget) continue;

      const currentTargetRc = parseInt(currentTarget[1], 10);
      const nextStartRc = parseInt(nextStart[1], 10);
      if (currentTargetRc !== nextStartRc) continue;

      // If this ever regresses, we'd render split plain spans like
      // RC:171 Knit to RC 228. followed by RC:228/229 Knit to RC ...
      sawAdjacentSplit = true;
      break;
    }

    expect(sawAdjacentSplit).toBe(false);
  });

  describe("formatPlainKnitInPatternSpan", () => {
    it("returns empty for zero rows (with or without startRc)", () => {
      expect(formatPlainKnitInPatternSpan(0)).toBe("");
      expect(formatPlainKnitInPatternSpan(0, 10)).toBe("");
      expect(formatPlainKnitInPatternSpan(-3, 5)).toBe("");
    });

    it("unknown startRc: positive row counts unchanged", () => {
      expect(formatPlainKnitInPatternSpan(1)).toBe("Knit in pattern for 1 row.");
      expect(formatPlainKnitInPatternSpan(4)).toBe("Knit in pattern for 4 rows.");
    });

    it("known startRc: Knit to RC unchanged for positive N", () => {
      expect(formatPlainKnitInPatternSpan(2, 100)).toBe("Knit to RC 102.");
    });
  });

  it("RIBBED HEM block omits plain paragraph when hem rows is zero (tip only, no 0-row line)", () => {
    const rows = buildSleevelessBackDisplayRows({
      castOnSts: 100,
      hemRows: 0,
      hemRowsValid: true,
      bodyToArmholeRows: 10,
      bodyRowsValid: true,
      armholeMath: null,
      firstArmholeRC: null,
      stitchesAfterArmhole: undefined,
      upperBackRows: 0,
      upperStartRc: 0,
      evenRowPadRows: 0,
      padStartRc: 0,
      neckChartRows: [],
      useNeckChartRows: false,
    });
    const ribIdx = rows.findIndex((r) => r.kind === "section" && r.title === "RIBBED HEM");
    expect(ribIdx).toBeGreaterThanOrEqual(0);
    const ribBlock = rows[ribIdx + 1];
    expect(ribBlock?.kind).toBe("block");
    if (ribBlock?.kind === "block") {
      expect(ribBlock.paragraphs).toEqual([]);
      expect(ribBlock.tipHtml).toBeDefined();
    }
    const blob = collectBlockInstructionText(rows).join("\n");
    expect(blob).not.toMatch(/\bKnit in pattern for 0 rows\b/i);
  });

  it("hem Knit to RC matches first BODY row rc; BODY Knit to RC matches first armhole row rc", () => {
    const result = generateSleevelessBackPattern(patternData);
    const rows = result.displayRows;
    const { hemRows, bodyRows } = result.debug;
    const firstArmholeRc = hemRows + bodyRows;

    const hemPlain = rows.find(
      (r) =>
        r.kind === "block" &&
        r.rc === formatRcColon(0) &&
        r.paragraphs.length === 1 &&
        r.paragraphs[0] === `Knit to RC ${hemRows}.`,
    );
    expect(hemPlain).toBeDefined();

    const afterHemIdx = rows.findIndex((r) => r === hemPlain) + 1;
    const bodyStart = rows
      .slice(afterHemIdx)
      .find((r) => r.kind === "block" && r.rc && r.paragraphs.some((p) => p === `Knit to RC ${firstArmholeRc}.`));
    expect(bodyStart?.rc).toBe(formatRcColon(hemRows));

    const bodyPlain = rows.find(
      (r) =>
        r.kind === "block" &&
        r.rc === formatRcColon(hemRows) &&
        r.paragraphs.length === 1 &&
        r.paragraphs[0] === `Knit to RC ${firstArmholeRc}.`,
    );
    expect(bodyPlain).toBeDefined();
    const afterBodyIdx = rows.findIndex((r) => r === bodyPlain) + 1;
    const armholeBind = rows
      .slice(afterBodyIdx)
      .find(
        (r) =>
          r.kind === "block" &&
          r.rc === "RC:000" &&
          r.paragraphs.some((p) => /RC:000/i.test(p) && /bind off/i.test(p)),
      );
    expect(armholeBind).toBeDefined();
  });

  it("uses post-action stitch counts for RC 143/144 bind-offs and carries to RC 145", () => {
    const rows = buildSleevelessBackDisplayRows({
      castOnSts: 132,
      hemRows: 20,
      hemRowsValid: true,
      bodyToArmholeRows: 123,
      bodyRowsValid: true,
      armholeMath: {
        bindOffSts: 10,
        decreaseSts: 5,
        decreaseRows: 10,
        evenRows: 0,
      },
      firstArmholeRC: 143,
      stitchesAfterArmhole: 112,
      upperBackRows: 0,
      upperStartRc: 0,
      evenRowPadRows: 0,
      padStartRc: 0,
      neckChartRows: [],
      useNeckChartRows: false,
    });
    const blocks = rows.filter((r) => r.kind === "block");

    const rc143 = blocks.find((b) => b.rc === "RC:000" && b.paragraphs.some((p) => /bind off 10 stitches/i.test(p)));
    const rc144 = blocks.find((b) => b.rc === "RC:001" && b.paragraphs.some((p) => /bind off 10 stitches/i.test(p)));
    const rc145 = blocks.find((b) => b.rc === "RC:002" && b.paragraphs.some((p) => /decrease 1 stitch .* every other row/i.test(p)));

    expect(rc143?.paragraphs.join(" ")).toMatch(/\bbind off 10 stitches\b/i);
    expect(rc144?.paragraphs.join(" ")).toMatch(/\bbind off 10 stitches\b/i);
    expect(rc145?.paragraphs.join(" ")).toMatch(/decrease 1 stitch .* every other row/i);

    expect(rc143?.stitchCount).toBe(122);
    expect(rc144?.stitchCount).toBe(112);
    expect(rc145?.stitchCount).toBe(102);
  });

  it("applies paired-edge decreases as 2 stitches per listed row and carries to RC 167", () => {
    const rows = buildSleevelessBackDisplayRows({
      castOnSts: 165,
      hemRows: 30,
      hemRowsValid: true,
      bodyToArmholeRows: 119,
      bodyRowsValid: true,
      armholeMath: {
        bindOffSts: 9,
        decreaseSts: 8,
        decreaseRows: 16,
        evenRows: 6,
      },
      firstArmholeRC: 149,
      // Intentionally different from arithmetic carry-forward; display math must follow listed actions.
      stitchesAfterArmhole: 130,
      upperBackRows: 0,
      upperStartRc: 0,
      evenRowPadRows: 0,
      padStartRc: 0,
      neckChartRows: [],
      useNeckChartRows: false,
    });
    const blocks = rows.filter((r) => r.kind === "block");

    const rc149 = blocks.find((b) => b.rc === "RC:000" && b.paragraphs.some((p) => /bind off 9 stitches/i.test(p)));
    const rc150 = blocks.find((b) => b.rc === "RC:001" && b.paragraphs.some((p) => /bind off 9 stitches/i.test(p)));
    const rc151 = blocks.find((b) => b.rc === "RC:002" && b.paragraphs.some((p) => /decrease 1 stitch .* every other row/i.test(p)));
    const postDecreaseCarry = blocks.find(
      (b) =>
        b.rc !== "RC:000" &&
        b.rc !== "RC:001" &&
        b.rc !== "RC:002" &&
        b.paragraphs.some((p) => /knit in pattern|Knit to RC:/i.test(p))
    );

    expect(rc149?.paragraphs.join(" ")).toMatch(/\bbind off 9 stitches\b/i);
    expect(rc150?.paragraphs.join(" ")).toMatch(/\bbind off 9 stitches\b/i);
    expect(rc151?.paragraphs.join(" ")).toMatch(/decrease 1 stitch .* every other row/i);

    expect(rc149?.stitchCount).toBe(156);
    expect(rc150?.stitchCount).toBe(147);
    expect(rc151?.stitchCount).toBe(131);
    expect(postDecreaseCarry?.stitchCount).toBe(131);
  });

  it("front inherits shoulder stitches; deeper scoop shifts start RC; front neck uses round-front center bind-off + merged chart length", () => {
    /** 7 rows/in → back depth 6/7" → 6 rows; front 3" → 21 rows */
    const patternData: Record<string, unknown> = {
      fit: {
        sizingChart: "misses",
        selectedMeasurements: {
          finished_bust_chest: 40,
          back_neck_to_hem: 22,
          armhole_depth: 8,
          neck_opening: 2,
          shoulder_width: 4.25,
          back_neck_depth: 6 / 7,
          front_neck_depth: 3,
        },
      },
      style: { recipientCategory: "misses" },
      yarnGaugeMachine: {
        gaugeStitchesPerInch: 5,
        gaugeRowsPerInch: 7,
        availableNeedles: 200,
      },
    };

    const result = generateSleevelessBackPattern(patternData);
    expect(result.frontNeckShoulderChartUsesLiveRows).toBe(true);
    expect(result.neckShoulderChartUsesLiveRows).toBe(true);

    expect(result.debug.frontNeckDepthRows).toBe(21);

    const backRows = result.neckShoulderShapingChart.rows;
    const frontRows = result.frontNeckShoulderShapingChart.rows;
    expect(backRows.length).toBeGreaterThan(0);
    expect(frontRows.length).toBeGreaterThan(0);

    const b0 = backRows[0];
    const f0 = frontRows[0];
    expect(f0.leftStitchCount).toBe(b0.leftStitchCount);
    expect(f0.rightStitchCount).toBe(b0.rightStitchCount);
    expect(parseShapingDecrease(b0.centerNeck)).toBe(initialCenterNeckStitches(10));
    const roundFront = calculateRoundFrontNeckline({
      necklineStitches: result.debug.necklineStitches!,
      neckDepthRows: result.debug.frontNeckDepthRows,
      startRC: result.debug.frontNecklineStartRC,
      shoulderStitchesPerSide: result.debug.shoulderStitches!,
    });
    expect(parseShapingDecrease(f0.centerNeck)).toBe(roundFront.centerBindOff);

    const lastBack = backRows[backRows.length - 1];
    const lastFront = frontRows[frontRows.length - 1];
    expect(lastBack.leftStitchCount).toBe(0);
    expect(lastBack.rightStitchCount).toBe(0);
    expect(lastFront.leftStitchCount).toBe(0);
    expect(lastFront.rightStitchCount).toBe(0);

    expect(result.debug.frontNecklineStartRC).toBeLessThan(result.debug.backNecklineStartRC);

    expect(frontRows.length).toBe(result.debug.frontNeckDepthRows);
    expect(backRows.length).toBe(result.debug.backNeckDepthRows);
  });

  it("front scoop inherits base center neck and shoulder stitches — neck_opening_stitches + B=130", () => {
    const wideShoulderPattern: Record<string, unknown> = {
      fit: {
        sizingChart: "misses",
        selectedMeasurements: {
          finished_bust_chest: 54,
          back_neck_to_hem: 22,
          armhole_depth: 8,
          shoulder_width: 26,
          neck_opening_stitches: 53,
          back_neck_depth: 1,
          front_neck_depth: 5,
        },
      },
      style: { recipientCategory: "misses" },
      yarnGaugeMachine: {
        gaugeStitchesPerInch: 5,
        gaugeRowsPerInch: 7,
        availableNeedles: 300,
      },
    };

    const result = generateSleevelessBackPattern(wideShoulderPattern);
    const { debug } = result;

    expect(debug.stitchesAfterArmhole).toBe(130);
    expect(debug.centerNeckBindOffStitches).toBe(initialCenterNeckStitches(53));
    expect(debug.shoulderStitches).toBe(38);
    expect(result.frontNeckShoulderChartUsesLiveRows).toBe(true);

    const backRows = result.neckShoulderShapingChart.rows;
    const frontRows = result.frontNeckShoulderShapingChart.rows;
    expect(parseShapingDecrease(backRows[0]!.centerNeck)).toBe(initialCenterNeckStitches(53));
    const roundFrontWide = calculateRoundFrontNeckline({
      necklineStitches: debug.necklineStitches!,
      neckDepthRows: debug.frontNeckDepthRows,
      startRC: debug.frontNecklineStartRC,
      shoulderStitchesPerSide: debug.shoulderStitches!,
    });
    expect(parseShapingDecrease(frontRows[0]!.centerNeck)).toBe(roundFrontWide.centerBindOff);
    expect(frontRows[0]!.leftStitchCount).toBe(backRows[0]!.leftStitchCount);
    expect(frontRows[0]!.leftStitchCount).toBeGreaterThan(debug.shoulderStitches!);
    expect(frontRows.length).toBe(debug.frontNeckDepthRows);
    expect(backRows.length).toBe(debug.backNeckDepthRows);
    expect(debug.frontNecklineStartRC).toBeLessThan(debug.backNecklineStartRC);
  });

  it("back neckline chart spans exactly back neck depth rows; shoulder bind-offs begin immediately", () => {
    const result = generateSleevelessBackPattern(patternData);
    expect(result.neckShoulderChartUsesLiveRows).toBe(true);

    const chartRows = result.neckShoulderShapingChart.rows;
    expect(chartRows.length).toBe(result.debug.backNeckDepthRows);

    const last = chartRows[chartRows.length - 1]!;
    expect(last.leftStitchCount).toBe(0);
    expect(last.rightStitchCount).toBe(0);

    const workRows = chartRows.length - 1;
    const firstShoulderPostCenterIdx = 0;
    const afterCenter = chartRows.slice(1);
    for (let i = 0; i < firstShoulderPostCenterIdx; i++) {
      expect(parseShapingDecrease(afterCenter[i]!.leftSide)).toBe(0);
      expect(parseShapingDecrease(afterCenter[i]!.rightSide)).toBe(0);
    }
    if (workRows > 0) {
      expect(parseShapingDecrease(afterCenter[0]!.leftSide)).toBeGreaterThan(0);
    }
  });

  it("armhole depth rule: first shoulder shaping row is exactly armhole_depth rows after armhole start", () => {
    const patternDataArmholeDepth: Record<string, unknown> = {
      fit: {
        sizingChart: "misses",
        selectedMeasurements: {
          finished_bust_chest: 54,
          back_neck_to_hem: 34,
          armhole_depth: 7.5,
          neck_opening: 6,
          shoulder_width: 10,
          back_neck_depth: 4,
          front_neck_depth: 6,
        },
      },
      style: { recipientCategory: "misses" },
      yarnGaugeMachine: {
        gaugeStitchesPerInch: 5,
        gaugeRowsPerInch: 11.3333333333, // rounds 7.5" to 85 rows
        availableNeedles: 300,
      },
    };

    const result = generateSleevelessBackPattern(patternDataArmholeDepth);
    const d = result.debug;
    expect(d.armholeRows).toBe(85);
    expect(d.armholeStartRow).toBeDefined();
    expect(d.shoulderStartRow).toBeDefined();
    expect(d.armholeDepthEndRow).toBeDefined();
    expect(d.shoulderStartRow).toBe(d.armholeDepthEndRow);
    expect((d.shoulderStartRow ?? 0) - (d.armholeStartRow ?? 0)).toBe(85);
  });

  it("prints armhole depth checkpoint using local RC only", () => {
    const patternDataArmholeDepth: Record<string, unknown> = {
      fit: {
        sizingChart: "misses",
        selectedMeasurements: {
          finished_bust_chest: 54,
          back_neck_to_hem: 34,
          armhole_depth: 7.5,
          neck_opening: 6,
          shoulder_width: 10,
          back_neck_depth: 4,
          front_neck_depth: 6,
        },
      },
      style: { recipientCategory: "misses" },
      yarnGaugeMachine: {
        gaugeStitchesPerInch: 5,
        gaugeRowsPerInch: 11.3333333333,
        availableNeedles: 300,
      },
    };
    const result = generateSleevelessBackPattern(patternDataArmholeDepth);
    const checkpoint = result.displayRows.find(
      (r) =>
        r.kind === "block" &&
        r.paragraphs.some((p) => p.includes("Armhole depth checkpoint: first shoulder shaping row")),
    );
    expect(checkpoint).toBeDefined();
    expect(checkpoint?.kind === "block" && checkpoint.paragraphs.join(" ")).toContain("RC:084");
    expect(checkpoint?.kind === "block" && checkpoint.paragraphs.join(" ")).not.toContain("garment RC");
  });

  it("armhole depth label stays fixed even when shoulder shaping continues", () => {
    const patternDataArmholeDepth: Record<string, unknown> = {
      fit: {
        sizingChart: "misses",
        selectedMeasurements: {
          finished_bust_chest: 54,
          back_neck_to_hem: 34,
          armhole_depth: 7.5,
          neck_opening: 6,
          shoulder_width: 10,
          back_neck_depth: 4,
          front_neck_depth: 6,
        },
      },
      style: { recipientCategory: "misses" },
      yarnGaugeMachine: {
        gaugeStitchesPerInch: 5,
        gaugeRowsPerInch: 11.3333333333, // rounds 7.5" to 85 rows
        availableNeedles: 300,
      },
    };

    const result = generateSleevelessBackPattern(patternDataArmholeDepth);
    const d = result.debug;
    expect(d.armholeRows).toBe(85);
    expect(d.armholeDepth).toBe(7.5);
    expect((d.backFinalRow ?? 0)).toBeGreaterThan((d.shoulderStartRow ?? 0));
  });

  /**
   * Strict rendered-output regression: every visible RC label across displayRows blocks,
   * chart rows, chart HTML, plain-text lines, and SVG output must stay <= totalGarmentRows.
   * The previous bug rendered the back piece at totalGarmentRows + backNeckDepthRows because
   * the upper-back schedule consumed the whole length budget and stacked the neckline on top.
   */
  describe("Men's 4X, 53\" chest, 29\" back neck to hem, 16 sts / 24 rows over 4\" — both pieces end at RC 174 across every rendered surface", () => {
    function rcsFromBlockRows(rows: readonly SleevelessPatternDisplayRow[]): number[] {
      const out: number[] = [];
      for (const row of rows) {
        if (row.kind !== "block") continue;
        const rc = row.rc;
        if (!rc) continue;
        const m = rc.match(/(\d+)/);
        if (m) out.push(parseInt(m[1], 10));
      }
      return out;
    }

    function rcsFromText(text: string): number[] {
      const out: number[] = [];
      for (const m of text.matchAll(/RC[:\s]*(\d+)/gi)) {
        out.push(parseInt(m[1], 10));
      }
      return out;
    }

    function chartRowNumbers(html: string): number[] {
      const out: number[] = [];
      for (const m of html.matchAll(/ns-shaping-chart__td-num">\s*(\d+)(?:\s*[\u2013-]\s*(\d+))?/g)) {
        out.push(parseInt(m[1], 10));
        if (m[2]) out.push(parseInt(m[2], 10));
      }
      return out;
    }

    /**
     * Run the full assertion suite against a single config so we can repeat it for multiple
     * realistic Men's 4X variants (with / without `back_neck_depth` overrides).
     */
    function assertNoOvershoot(patternData: Record<string, unknown>, expectedTotalRows: number) {
      const result = generateSleevelessBackPattern(patternData);
      const { debug } = result;

      expect(debug.expectedGarmentRows).toBe(expectedTotalRows);

      // Internal anchors must close the loop on totalGarmentRows.
      expect(debug.backNecklineStartRC + debug.backNeckDepthRows - 1).toBe(expectedTotalRows);
      expect(debug.backFinalRow).toBe(expectedTotalRows);
      expect(debug.frontFinalRow).toBe(expectedTotalRows);
      expect(debug.backFinalRow).toBe(debug.frontFinalRow);

      // BACK display rows: every block label is <= totalRows, and at least one labeled block exists.
      const backDisplayRcs = rcsFromBlockRows(result.displayRows);
      expect(backDisplayRcs.length).toBeGreaterThan(0);
      expect(Math.max(...backDisplayRcs)).toBeLessThanOrEqual(expectedTotalRows);

      // FRONT display rows: same constraint.
      const frontDisplayRcs = rcsFromBlockRows(result.frontDisplayRows);
      expect(frontDisplayRcs.length).toBeGreaterThan(0);
      expect(Math.max(...frontDisplayRcs)).toBeLessThanOrEqual(expectedTotalRows);

      // Plain-text lines (BACK).
      const backLineRcs: number[] = [];
      for (const line of result.lines) backLineRcs.push(...rcsFromText(line));
      if (backLineRcs.length > 0) {
        expect(Math.max(...backLineRcs)).toBeLessThanOrEqual(expectedTotalRows);
      }

      // BACK chart rows: max rendered row equals totalGarmentRows exactly (the timeline is
      // anchored backward from totalRows so the last action lands on totalRows).
      const backChartRows = result.neckShoulderShapingChart.rows.map((r) => r.row);
      expect(backChartRows.length).toBeGreaterThan(0);
      expect(Math.max(...backChartRows)).toBe(expectedTotalRows);
      // No chart row may exceed totalGarmentRows; explicitly forbid 175+ for the user's case.
      for (const row of backChartRows) {
        expect(row).toBeLessThanOrEqual(expectedTotalRows);
        expect(row).toBeLessThan(expectedTotalRows + 1);
      }

      // FRONT chart rows: same anchor.
      const frontChartRows = result.frontNeckShoulderShapingChart.rows.map((r) => r.row);
      expect(frontChartRows.length).toBeGreaterThan(0);
      expect(Math.max(...frontChartRows)).toBe(expectedTotalRows);
      for (const row of frontChartRows) {
        expect(row).toBeLessThanOrEqual(expectedTotalRows);
      }

      // Rendered chart HTML (table) — the rendered <td> row labels must not contain >= totalRows + 1.
      const backChartHtml = renderNeckShoulderShapingChartTableOnlyHtml(
        result.neckShoulderShapingChart,
        "ns-shaping-chart-back",
      );
      const frontChartHtml = renderNeckShoulderShapingChartTableOnlyHtml(
        result.frontNeckShoulderShapingChart,
        "ns-shaping-chart-front",
      );
      const backHtmlRcs = chartRowNumbers(backChartHtml);
      const frontHtmlRcs = chartRowNumbers(frontChartHtml);
      expect(backHtmlRcs.length).toBeGreaterThan(0);
      expect(Math.max(...backHtmlRcs)).toBeLessThanOrEqual(expectedTotalRows);
      expect(Math.max(...frontHtmlRcs)).toBeLessThanOrEqual(expectedTotalRows);

      // Print-only instruction table (compact rendering) must also respect the limit.
      const backPrintHtml = renderNeckShoulderShapingPrintInstructionTableHtml(
        result.neckShoulderShapingChart,
        "ns-shaping-chart-print-back",
      );
      const frontPrintHtml = renderNeckShoulderShapingPrintInstructionTableHtml(
        result.frontNeckShoulderShapingChart,
        "ns-shaping-chart-print-front",
      );
      // ns-shaping-mini__rc cells render the row number directly.
      function printRowRcs(html: string): number[] {
        const out: number[] = [];
        for (const m of html.matchAll(/ns-shaping-mini__rc">(\d+)(?:[\u2013-](\d+))?/g)) {
          out.push(parseInt(m[1], 10));
          if (m[2]) out.push(parseInt(m[2], 10));
        }
        return out;
      }
      for (const rc of printRowRcs(backPrintHtml)) {
        expect(rc).toBeLessThanOrEqual(expectedTotalRows);
      }
      for (const rc of printRowRcs(frontPrintHtml)) {
        expect(rc).toBeLessThanOrEqual(expectedTotalRows);
      }

      // SVG diagram (rendered HTML) must also stay within the budget for any embedded row labels.
      const backDiagramHtml = renderNeckShoulderShapingDiagramOnlyHtml(
        result.neckShoulderShapingChart,
        "ns-shaping-chart-back",
        "back",
      );
      const frontDiagramHtml = renderNeckShoulderShapingDiagramOnlyHtml(
        result.frontNeckShoulderShapingChart,
        "ns-shaping-chart-front",
        "front",
      );
      const backShoulderSvg = renderShoulderShapingSvg(result.neckShoulderShapingChart, "right", {
        piece: "back",
      });
      const frontShoulderSvg = renderShoulderShapingSvg(result.frontNeckShoulderShapingChart, "right", {
        piece: "front",
      });
      function svgRowLabels(html: string): number[] {
        const out: number[] = [];
        // Any 3-digit number that could plausibly be an RC label inside the rendered SVG.
        for (const m of html.matchAll(/>(\d{2,4})</g)) out.push(parseInt(m[1], 10));
        return out;
      }
      for (const rc of svgRowLabels(backDiagramHtml).filter((n) => n > 100)) {
        expect(rc).toBeLessThanOrEqual(expectedTotalRows);
      }
      for (const rc of svgRowLabels(frontDiagramHtml).filter((n) => n > 100)) {
        expect(rc).toBeLessThanOrEqual(expectedTotalRows);
      }
      for (const rc of svgRowLabels(backShoulderSvg).filter((n) => n > 100)) {
        expect(rc).toBeLessThanOrEqual(expectedTotalRows);
      }
      for (const rc of svgRowLabels(frontShoulderSvg).filter((n) => n > 100)) {
        expect(rc).toBeLessThanOrEqual(expectedTotalRows);
      }

      // Hard guarantee: nothing visible (display rows / chart rows / chart HTML / print HTML / SVG)
      // contains an RC of `expectedTotalRows + 1` or higher.
      const everySurfaceRcs: number[] = [
        ...backDisplayRcs,
        ...frontDisplayRcs,
        ...backLineRcs,
        ...backChartRows,
        ...frontChartRows,
        ...backHtmlRcs,
        ...frontHtmlRcs,
        ...printRowRcs(backPrintHtml),
        ...printRowRcs(frontPrintHtml),
        ...svgRowLabels(backDiagramHtml).filter((n) => n > 100 && n <= 999),
        ...svgRowLabels(frontDiagramHtml).filter((n) => n > 100 && n <= 999),
        ...svgRowLabels(backShoulderSvg).filter((n) => n > 100 && n <= 999),
        ...svgRowLabels(frontShoulderSvg).filter((n) => n > 100 && n <= 999),
      ];
      const overshoot = everySurfaceRcs.filter((n) => n >= expectedTotalRows + 1);
      expect(overshoot).toEqual([]);
    }

    it("with explicit back_neck_depth = 1\" → back and front chart end at RC 174", () => {
      assertNoOvershoot(
        {
          fit: {
            sizingChart: "men",
            selectedMeasurements: {
              finished_bust_chest: 53,
              back_neck_to_hem: 29,
              armhole_depth: 11,
              neck_opening: 6.5,
              shoulder_width: 16,
              back_neck_depth: 1,
              front_neck_depth: 3.5,
            },
          },
          style: { recipientCategory: "men" },
          yarnGaugeMachine: {
            gaugeStitchesPerInch: 4,
            gaugeRowsPerInch: 6,
            availableNeedles: 200,
          },
        },
        174,
      );
    });

    it("with sizing-chart Men's 4X defaults (back_neck_depth 1.5\") → back and front chart end at RC 174", () => {
      assertNoOvershoot(
        {
          fit: {
            sizingChart: "men",
            selectedMeasurements: {
              finished_bust_chest: 53,
              back_neck_to_hem: 29,
              armhole_depth: 12,
              neck_opening: 8.25,
              shoulder_width: 21,
              back_neck_depth: 1.5,
              front_neck_depth: 5.75,
            },
          },
          style: { recipientCategory: "men" },
          yarnGaugeMachine: {
            gaugeStitchesPerInch: 4,
            gaugeRowsPerInch: 6,
            availableNeedles: 200,
          },
        },
        174,
      );
    });

    it("when only chest / length / gauge are supplied → chart still anchors at RC = totalGarmentRows (no demo leakage)", () => {
      // Without explicit shoulder/neck data the live timeline can't be built — but the chart
      // must still not contain any RC > totalGarmentRows (previously the demo chart leaked
      // rows 300–312 here).
      const result = generateSleevelessBackPattern({
        fit: {
          sizingChart: "men",
          selectedMeasurements: {
            finished_bust_chest: 53,
            back_neck_to_hem: 29,
          },
        },
        style: { recipientCategory: "men" },
        yarnGaugeMachine: {
          gaugeStitchesPerInch: 4,
          gaugeRowsPerInch: 6,
          availableNeedles: 200,
        },
      });
      expect(result.debug.expectedGarmentRows).toBe(174);
      for (const row of result.neckShoulderShapingChart.rows) {
        expect(row.row).toBeLessThanOrEqual(174);
      }
      for (const row of result.frontNeckShoulderShapingChart.rows) {
        expect(row.row).toBeLessThanOrEqual(174);
      }
    });
  });

  describe("final shoulder bind-off instruction wording helper", () => {
    it("pluralizes / formats remaining-stitch wording correctly and skips when zero", () => {
      expect(formatShoulderBindoffRemainingInstruction(0)).toBeNull();
      expect(formatShoulderBindoffRemainingInstruction(-3)).toBeNull();
      expect(formatShoulderBindoffRemainingInstruction(1)).toBe("Bind off remaining 1 stitch.");
      expect(formatShoulderBindoffRemainingInstruction(4)).toBe("Bind off remaining 4 stitches.");
      expect(formatShoulderBindoffRemainingInstruction(12)).toBe("Bind off remaining 12 stitches.");
    });
  });

  describe("BACK / FRONT displayRows wrap the chart mount cleanly (bind-off rendered inside chart HTML)", () => {
    /**
     * The bind-off line and "repeat for second shoulder" note are rendered INSIDE the chart HTML
     * (between the table and the second-shoulder toggle, plus the chart's own active-side note).
     * The displayRows just need to mount the chart and the preview — no bind-off / repeat blocks
     * should sit between the chart-table mount and the chart-preview mount.
     */
    it("BACK: chart preview mount immediately follows chart table mount (no extra blocks between)", () => {
      const rows = buildSleevelessBackDisplayRows({
        castOnSts: 100,
        hemRows: 10,
        hemRowsValid: true,
        bodyToArmholeRows: 40,
        bodyRowsValid: true,
        armholeMath: { bindOffSts: 5, decreaseSts: 0, decreaseRows: 0, evenRows: 0 },
        firstArmholeRC: 51,
        stitchesAfterArmhole: 90,
        upperBackRows: 0,
        upperStartRc: 0,
        evenRowPadRows: 0,
        padStartRc: 0,
        neckChartRows: [
          {
            row: 167,
            action: "Shoulder",
            leftSide: "-",
            leftNeck: "-",
            centerNeck: "-",
            rightNeck: "-",
            rightSide: "-",
            leftStitchCount: 4,
            rightStitchCount: 4,
          },
        ],
        useNeckChartRows: true,
        necklineStitches: 10,
        shoulderStitches: 40,
      });

      const tableIdx = rows.findIndex((r) => r.kind === "neckShoulderChartTableMount");
      const previewIdx = rows.findIndex((r) => r.kind === "neckShoulderChartPreviewMount");
      expect(tableIdx).toBeGreaterThan(0);
      expect(previewIdx).toBe(tableIdx + 1);

      // Belt-and-braces: nothing in displayRows duplicates the bind-off sentence (chart HTML owns it).
      const allParagraphs = rows
        .filter((r): r is Extract<(typeof rows)[number], { kind: "block" }> => r.kind === "block")
        .flatMap((r) => r.paragraphs);
      expect(allParagraphs.some((p) => /Bind off remaining \d+ stitch/i.test(p))).toBe(false);
    });

    it("FRONT: chart preview mount immediately follows chart table mount (no extra blocks between)", () => {
      const rows = buildSleevelessFrontDisplayRows({
        frontNecklineStartRC: 100,
        sharedExecutionRows: [],
        useNeckChartRows: true,
        neckChartRows: [
          {
            row: 174,
            action: "Shoulder",
            leftSide: "-",
            leftNeck: "-",
            centerNeck: "-",
            rightNeck: "-",
            rightSide: "-",
            leftStitchCount: 1,
            rightStitchCount: 1,
          },
        ],
        necklineStitches: 10,
        shoulderStitches: 40,
      });

      const tableIdx = rows.findIndex((r) => r.kind === "neckShoulderChartTableMount");
      const previewIdx = rows.findIndex((r) => r.kind === "neckShoulderChartPreviewMount");
      expect(tableIdx).toBeGreaterThan(0);
      expect(previewIdx).toBe(tableIdx + 1);

      const allParagraphs = rows
        .filter((r): r is Extract<(typeof rows)[number], { kind: "block" }> => r.kind === "block")
        .flatMap((r) => r.paragraphs);
      expect(allParagraphs.some((p) => /Bind off remaining \d+ stitch/i.test(p))).toBe(false);
    });
  });

  describe("center bind-off execution wording helpers", () => {
    it("documents odd N around needle 0 and unequal shoulder remainders explicitly", () => {
      expect(formatCenterNecklineBindOffAroundZeroPhrase(19)).toContain("9 stitches left of 0");
      expect(formatCenterNecklineBindOffAroundZeroPhrase(19)).toContain("10 stitches right of 0");
      expect(formatCenterNecklineBindOffAroundZeroPhrase(18)).toBe("9 stitches on each side of 0");
      expect(formatShouldersRemainingAfterCenterBindOffPhrase(12, 13)).toContain(
        "on the left and 13 stitches on the right"
      );
      const prose = formatCenterNecklineBindOffPreambleExecution({
        totalCenterBindOff: 19,
        stitchesLeftAfter: 12,
        stitchesRightAfter: 13,
      });
      expect(prose).toContain("Knit to center.");
      expect(prose).toContain("Bind off the center 19 stitches");
      expect(prose).toContain("Work each side separately.");
    });
  });
});
