import { describe, expect, it } from "vitest";
import { dropShoulderSleeveShapingRcSequence } from "../dropShoulderSleeveShapingChart";
import { formatParentheticalShapingRowNumbers } from "../evenShapingSchedule";
import { renderPatternDisplayRowsHtml } from "../sleevelessPatternDisplayHtml";
import { formatRcColon } from "../sleevelessPatternOutput";
import { renderSleevelessPrintPieceHtml } from "../sleevelessPatternPrintRender";
import type { ChartRow } from "../sleevelessExpressSizeChartTypes";
import {
  buildSetInCuffUpSleevePresentation,
  generateSetInSleeveInstructions,
  setInSleeveInstructionSection,
  setInSleeveInstructionsPlainText,
} from "./setInSleeveInstructions";
import type { SetInSleeveCapSuccess } from "./sleeveCapMath";
import { calculateSetInSleeveSweater, type SetInSleeveSweaterSuccess } from "./setInSleeveSweaterMath";

const MISSES_1: ChartRow = {
  bust_or_chest: 31.5,
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

const MEN_4X: ChartRow = {
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

const PLUS_6X: ChartRow = {
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

function pattern(
  audience: string,
  row: ChartRow,
  stitchesPerInch: number,
  rowsPerInch: number,
  bodyShape: "straight" | "aline" = "straight",
): SetInSleeveSweaterSuccess {
  const result = calculateSetInSleeveSweater({
    chartAudience: audience,
    chartRow: row,
    stitchesPerInch,
    rowsPerInch,
    availableNeedles: 400,
    bodyShape,
  });
  expect(result.ok, result.ok ? "" : result.message).toBe(true);
  if (!result.ok) throw new Error(result.message);
  return result;
}

function blockLines(sectionText: string, heading: string): string[] {
  const start = sectionText.indexOf(heading);
  expect(start).toBeGreaterThanOrEqual(0);
  const rest = sectionText.slice(start + heading.length).replace(/^\n/, "");
  const next = rest.search(/\n[A-Z][A-Z ]+\n/);
  const body = next === -1 ? rest : rest.slice(0, next);
  return body.split("\n").filter((line) => line.trim().length > 0);
}

function sumHoldGroups(side: { holdGroups: number[] }): number {
  return side.holdGroups.reduce((sum, count) => sum + count, 0);
}

function remainCounts(text: string): number[] {
  return [...text.matchAll(/(-?\d+) stitches remain/g)].map((match) => Number(match[1]));
}

function stitchWord(n: number): string {
  return n === 1 ? "stitch" : "stitches";
}

/** Rebuild the cap checklist from the calculation, without using the instruction builder. */
function expectedSleeveCapChart(cap: SetInSleeveCapSuccess, startRc: number) {
  const rows: { rc: number; action: string; edge: string; stitchesRemaining: number }[] = [];
  let rc = startRc;
  let stitches = cap.sleeve.upperArmStitches;
  const bindOff = (amount: number, side: "One side" | "Other side") => {
    stitches -= amount;
    rows.push({
      rc,
      action: `Bind off ${amount} ${stitchWord(amount)}`,
      edge: side,
      stitchesRemaining: stitches,
    });
    rc += 1;
  };
  for (const amount of [
    cap.sleeve.initialBindOffStitchesEachSide,
    ...cap.sleeve.stairStepBindOffsEachSide,
  ]) {
    bindOff(amount, "One side");
    bindOff(amount, "Other side");
  }
  for (const zone of [
    cap.workingCap.zones.lower,
    cap.workingCap.zones.middle,
    cap.workingCap.zones.upper,
  ]) {
    for (const step of zone.steps) {
      for (let index = 0; index < step.times; index += 1) {
        stitches -= step.stitchesEachSide * 2;
        rows.push({
          rc: rc + index * step.everyRows,
          action: `Decrease ${step.stitchesEachSide} ${stitchWord(step.stitchesEachSide)} at each end`,
          edge: "Each end",
          stitchesRemaining: stitches,
        });
      }
      rc += step.times * step.everyRows;
    }
  }
  for (const step of cap.upperSlope.steps) {
    bindOff(step.stitchesEachSide, "One side");
    bindOff(step.stitchesEachSide, "Other side");
  }
  rc += cap.upperSlope.plainRows;
  const stitchesBeforeFinal = stitches;
  rows.push({
    rc,
    action: `Bind off the remaining ${cap.totals.finalStitches} ${stitchWord(cap.totals.finalStitches)}`,
    edge: "All stitches",
    stitchesRemaining: 0,
  });
  return { rows, finalRc: rc, stitchesBeforeFinal };
}

function parseCapChartLines(lines: string[]) {
  return lines.map((line) => {
    const match =
      /^RC: (\d+) (.+)\. (One side|Other side|Each end|All stitches)\. (\d+) stitch(?:es)?\.$/.exec(line);
    expect(match, line).not.toBeNull();
    return {
      rc: Number(match?.[1]),
      action: match?.[2] ?? "",
      edge: match?.[3] ?? "",
      stitchesRemaining: Number(match?.[4]),
    };
  });
}

describe("set-in sleeve written instructions", () => {
  const alternate = pattern("misses", MISSES_1, 7, 10);
  const standard = pattern("men", MEN_4X, 4, 6);
  const alternateDoc = generateSetInSleeveInstructions(alternate);
  const standardDoc = generateSetInSleeveInstructions(standard);

  it("writes every pattern section", () => {
    expect(alternateDoc.sections.map((section) => section.id)).toEqual([
      "overview",
      "back",
      "front",
      "sleeves",
      "finishing",
    ]);
    const text = setInSleeveInstructionsPlainText(alternateDoc);
    expect(text).toContain("Pattern overview and measurements");
    expect(text).toContain("Back");
    expect(text).toContain("Front");
    expect(text).toContain("Sleeves");
    expect(text).toContain("Finishing");
    expect(text).toContain("Join one shoulder using your preferred method: linker, crochet slip stitch, or the machine bind-off method.");
    expect(text).toContain("Set the sleeves into the armholes.");
    expect(text).toContain("Cardigan fronts are not written");
    expect(text).toContain("V-necklines are not written");
  });

  it("uses the same armhole instructions on the front and the back", () => {
    for (const doc of [alternateDoc, standardDoc]) {
      const back = blockLines(setInSleeveInstructionSection(doc, "back"), "ARMHOLE");
      const front = blockLines(setInSleeveInstructionSection(doc, "front"), "ARMHOLE");
      expect(front).toEqual(back);
    }
  });

  it("writes the alternate Misses 1 armhole and matching sleeve cap", () => {
    expect(alternateDoc.checks.ok, alternateDoc.checks.errors.join(" ")).toBe(true);
    const back = setInSleeveInstructionSection(alternateDoc, "back");
    const sleeves = setInSleeveInstructionSection(alternateDoc, "sleeves");
    expect(back).toContain("Cast on 122 stitches for the back.");
    expect(back).toContain("RC: 000 Bind off 6 stitches at the beginning of each of the next 2 rows.");
    expect(back).toContain("RC: 002 Bind off 2 stitches at the beginning of each of the next 6 rows.");
    expect(back).toContain("Decrease 1 stitch at each armhole edge on RC: 008, RC: 010, RC: 012, RC: 014, RC: 016, RC: 018, RC: 020.");
    expect(back).toContain("Knit these rows even: RC: 009, RC: 011, RC: 013, RC: 015, RC: 017, RC: 019, RC: 021.");
    expect(back).toContain("finishes the armhole at RC: 070.");
    expect(back).toContain("Work the First Shoulder and the neck edge first.");
    expect(back).toContain("Second Shoulder");
    expect(back).not.toMatch(/right shoulder|left shoulder/i);
    expect(back).toContain("Do not shape both shoulders on one carriage pass.");
    expect(back).not.toContain("AT THE SAME TIME");
    expect(back).toContain("Place the center 20 stitches in hold.");
    expect(back).toContain("32 stitches total");
    expect(back).not.toContain("31 stitches");
    expect(back).toContain("Carriage at the neck edge. Put 3 stitches in hold at the neck edge.");
    expect(back).toContain("Knit across. Bind off 5 stitches at the shoulder edge.");
    expect(alternate.body.neckline.back.centerBindOff).toBe(20);
    expect(sumHoldGroups(alternate.body.neckline.back.left)).toBe(11);
    expect(sumHoldGroups(alternate.body.neckline.back.right)).toBe(11);
    expect(alternate.body.neckline.shoulderBindOff.leftChunks.reduce((a, b) => a + b, 0)).toBe(21);
    expect(alternate.body.neckline.shoulderBindOff.rightChunks.reduce((a, b) => a + b, 0)).toBe(21);
    expect(alternate.body.neckline.openingStitches).toBe(42);
    expect(alternate.body.stitchesAtShoulder).toBe(84);
    const front = setInSleeveInstructionSection(alternateDoc, "front");
    expect(front).toContain("Bind off the center 14 stitches");
    expect(front).toContain("Work each side separately.");
    expect(front).toContain("7 stitches on L needles and 7 on R needles");
    expect(front).toContain("35 stitches on each side");
    expect(front).not.toContain("AT THE SAME TIME");
    expect(front).toContain("Bind off 5 stitches at the shoulder edge.");
    expect(front).toContain("First Shoulder");
    expect(front).not.toMatch(/right shoulder|left shoulder/i);
    expect(sleeves).toContain("CUFF");
    expect(sleeves).toContain("SLEEVE BODY");
    expect(sleeves).toContain("SLEEVE SHAPING CHART");
    expect(sleeves).toContain("SLEEVE CAP");
    expect(sleeves).toContain("Cast on");
    expect(sleeves).toContain("Reset row counter to RC 000.");
    expect(sleeves).not.toContain("before knitting that row");
    expect(sleeves).not.toContain("top-down");
    const taperRcs = dropShoulderSleeveShapingRcSequence({
      topSts: alternate.sleeve.upperArmStitches,
      wristSts: alternate.sleeve.wristStitches,
      cuffRows: alternate.sleeve.cuffRows,
      sleeveBodyRows: alternate.sleeve.rowsCuffToUpperArm,
      sleeveTotalRows: alternate.sleeve.rowsToUpperArm,
      direction: "cuff-up",
    });
    expect(sleeves).toContain(formatParentheticalShapingRowNumbers(taperRcs).replace(/<[^>]+>/g, ""));
    expect(sleeves).toMatch(/Increase 1 stitch at each side every \d+ rows \d+ times\./);
    expect(sleeves).toContain(`Both sides. ${alternate.sleeve.upperArmStitches} stitches.`);
    expect(sleeves).toContain("82 stitches remain.");
    expect(sleeves).toContain(
      `${formatRcColon(alternate.sleeve.rowsCuffToUpperArm)} Bind off 6 stitches at the beginning of each of the next 2 rows.`,
    );
    expect(sleeves).toContain("Bind off 2 stitches at the beginning of each of the next 6 rows.");
    expect(sleeves).toContain("Lower cap:");
    expect(sleeves).toContain("Middle cap:");
    expect(sleeves).toContain("Upper cap:");
    expect(sleeves).toContain("Upper slope.");
    expect(sleeves).toContain("Bind off the remaining 18 stitches.");
    expect(remainCounts(sleeves).every((count) => Number.isInteger(count) && count >= 0)).toBe(true);
  });

  it("writes the standard Men's 4X armhole without stair steps", () => {
    expect(standardDoc.checks.ok, standardDoc.checks.errors.join(" ")).toBe(true);
    expect(standard.body.armhole.method).toBe("standard");
    const back = setInSleeveInstructionSection(standardDoc, "back");
    const sleeves = setInSleeveInstructionSection(standardDoc, "sleeves");
    expect(back).toContain("RC: 000 Bind off 5 stitches at the beginning of each of the next 2 rows.");
    expect(back).not.toContain("Bind off 2 stitches at the beginning");
    expect(back).toContain("Decrease 1 stitch at each armhole edge on RC: 002, RC: 004, RC: 006, RC: 008.");
    expect(sleeves).toContain(
      `${formatRcColon(standard.sleeve.rowsCuffToUpperArm)} Bind off 5 stitches at the beginning of each of the next 2 rows.`,
    );
    expect(sleeves).toContain("Bind off the remaining 22 stitches.");
    expect(sleeves).toContain("88 stitches remain.");
  });

  it("keeps adult and plus sizes consistent across gauges", () => {
    const cases = [
      ["misses", MISSES_1, 7, 10],
      ["misses", MISSES_1, 5, 7],
      ["plus", PLUS_6X, 5, 7],
      ["plus", PLUS_6X, 7, 10],
      ["men", MEN_4X, 4, 6],
      ["men", MEN_4X, 6, 8],
    ] as const;
    for (const [audience, row, spi, rpi] of cases) {
      const sweater = pattern(audience, row, spi, rpi);
      const doc = generateSetInSleeveInstructions(sweater);
      expect(doc.checks.ok, `${audience} ${spi}/${rpi}: ${doc.checks.errors.join(" ")}`).toBe(true);
      const back = blockLines(setInSleeveInstructionSection(doc, "back"), "ARMHOLE");
      const front = blockLines(setInSleeveInstructionSection(doc, "front"), "ARMHOLE");
      expect(front).toEqual(back);
      const sleeves = setInSleeveInstructionSection(doc, "sleeves");
      expect(sleeves).toContain(
        `Bind off the remaining ${sweater.sleeveCap.totals.finalStitches} stitches.`,
      );
      expect(sleeves).toContain(`${sweater.sleeve.upperArmStitches} stitches remain.`);
      const firstBodyBindOff = back.find((line) => line.includes("at the beginning of"));
      const firstSleeveBindOff = sleeves
        .split("\n")
        .find((line) => line.includes("Begin the sleeve cap") === false && line.includes("at the beginning of"));
      expect(firstBodyBindOff).toContain(`Bind off ${sweater.body.armhole.bindOffStitchesEachSide} stitches`);
      expect(firstSleeveBindOff).toContain(
        `Bind off ${sweater.sleeveCap.sleeve.initialBindOffStitchesEachSide} stitches`,
      );
      expect(remainCounts(`${back.join("\n")}\n${sleeves}`).every((count) => count >= 0)).toBe(true);
      expect(setInSleeveInstructionsPlainText(doc)).not.toContain("NaN");
      expect(setInSleeveInstructionsPlainText(doc)).not.toContain("AT THE SAME TIME");
      const backNeck = sweater.body.neckline.back;
      expect(backNeck.centerBindOff + sumHoldGroups(backNeck.left) + sumHoldGroups(backNeck.right)).toBe(
        sweater.body.neckline.openingStitches,
      );
      if (sweater.body.neckline.openingStitches % 4 === 2) {
        expect(backNeck.centerBindOff % 2).toBe(0);
        expect(sumHoldGroups(backNeck.left)).toBe(sumHoldGroups(backNeck.right));
      }
      const shoulder = sweater.body.neckline.shoulderBindOff;
      const leftShoulder = shoulder.leftChunks.reduce((a, b) => a + b, 0);
      const rightShoulder = shoulder.rightChunks.reduce((a, b) => a + b, 0);
      const shoulderBand = sweater.body.stitchesAtShoulder - sweater.body.neckline.openingStitches;
      expect(leftShoulder + rightShoulder).toBe(shoulderBand);
      if (shoulderBand % 2 === 0) expect(leftShoulder).toBe(rightShoulder);
    }
  });

  it("keeps sleeve-cap wording, checklist, stitch counts, and the final counter together", () => {
    const cases = [
      ["misses", MISSES_1, 7, 10],
      ["misses", MISSES_1, 5, 7],
      ["plus", PLUS_6X, 5, 7],
      ["plus", PLUS_6X, 7, 10],
      ["men", MEN_4X, 4, 6],
      ["men", MEN_4X, 6, 8],
    ] as const;
    const schedules = new Set<string>();
    for (const [audience, row, spi, rpi] of cases) {
      const sweater = pattern(audience, row, spi, rpi);
      const label = `${audience} ${spi}/${rpi}`;
      const doc = generateSetInSleeveInstructions(sweater);
      const sleeves = setInSleeveInstructionSection(doc, "sleeves");
      const capText = blockLines(sleeves, "SLEEVE CAP").join("\n");
      const chartLines = blockLines(sleeves, "SLEEVE CAP SHAPING CHART");
      const expected = expectedSleeveCapChart(sweater.sleeveCap, sweater.sleeve.rowsCuffToUpperArm);
      const parsed = parseCapChartLines(chartLines);
      expect(parsed, label).toEqual(expected.rows);
      expect(expected.finalRc, label).toBe(
        sweater.sleeve.rowsCuffToUpperArm + sweater.sleeveCap.totals.capRows,
      );
      expect(expected.stitchesBeforeFinal, label).toBe(sweater.sleeveCap.totals.finalStitches);
      expect(parsed[parsed.length - 1]?.rc, label).toBe(expected.finalRc);
      expect(parsed.filter((chartRow) => chartRow.rc === expected.finalRc)).toHaveLength(1);
      expect(capText, label).not.toContain("Knit these rows even");
      expect(capText, label).not.toContain("before knitting that row");

      const writtenDecreaseRcs = [
        ...capText.matchAll(
          /(?:Lower|Middle|Upper) cap: Decrease (\d+) stitch(?:es)? at each end (?:every row|every (\d+) rows), (\d+) time(?:s)?\. \(RC: ([0-9, ]+)\)/g,
        ),
      ];
      const writtenActions = writtenDecreaseRcs.flatMap((match) => {
        const everyRows = match[2] ? Number(match[2]) : 1;
        const times = Number(match[3]);
        const readings = match[4]!.split(",").map((part) => Number(part.trim()));
        expect(readings, label).toHaveLength(times);
        for (let index = 1; index < readings.length; index += 1) {
          expect(readings[index]! - readings[index - 1]!, label).toBe(everyRows);
        }
        return readings;
      });
      expect(
        parsed.filter((chartRow) => chartRow.action.startsWith("Decrease")).map((chartRow) => chartRow.rc),
        label,
      ).toEqual(writtenActions);
      schedules.add(
        sweater.sleeveCap.workingCap.zones.middle.steps.map((step) => `${step.everyRows}x${step.times}`).join("+"),
      );

      const presentation = buildSetInCuffUpSleevePresentation({
        wristStitches: sweater.sleeve.wristStitches,
        upperArmStitches: sweater.sleeve.upperArmStitches,
        cuffRows: sweater.sleeve.cuffRows,
        cuffInches: sweater.sleeve.cuffInches,
        rowsCuffToUpperArm: sweater.sleeve.rowsCuffToUpperArm,
        cap: sweater.sleeveCap,
      });
      const chartBlock = presentation.displayRows.find(
        (displayRow) =>
          displayRow.kind === "block" && displayRow.sleeveShapingChartId === "set-in-sleeve-cap-shaping-chart",
      );
      expect(chartBlock && chartBlock.kind === "block" ? chartBlock.sleeveShapingChartRows : [], label).toEqual(
        expected.rows,
      );
      const html = renderPatternDisplayRowsHtml(presentation.displayRows, { pieceSectionId: "sleeve" });
      const printHtml = renderSleevelessPrintPieceHtml(presentation.displayRows, "", "sleeve");
      expect(html, label).toContain('data-chart-id="set-in-sleeve-cap-shaping-chart-sleeve"');
      expect(html, label).toContain('data-chart-id="drop-shoulder-sleeve-shaping-chart-sleeve"');
      expect(html, label).toContain("data-chart-progress-show-completed");
      expect(html, label).toContain("Reset Checklist");
      expect(printHtml, label).toContain('type="checkbox"');
      expect(printHtml, label).toContain('data-chart-id="set-in-sleeve-cap-shaping-chart-sleeve"');
    }
    expect(schedules.size).toBeGreaterThan(1);
  });

  it("writes A-line body shaping on the calculated rows without adding rows", () => {
    const sweater = pattern("misses", MISSES_1, 7, 10, "aline");
    const doc = generateSetInSleeveInstructions(sweater);
    expect(doc.checks.ok, doc.checks.errors.join(" ")).toBe(true);
    const back = setInSleeveInstructionSection(doc, "back");
    const armholeRc = sweater.body.hemRows + sweater.body.rowsToArmhole;
    expect(back).toContain(`when the counter reads ${formatRcColon(sweater.body.bodyBlock.shapingRowNumbers[0]!)}`);
    expect(back).toContain(`Knit in pattern to ${formatRcColon(armholeRc)}.`);
    expect(back).toContain(`${sweater.body.stitchesAtUnderarm} stitches remain.`);
  });
});
