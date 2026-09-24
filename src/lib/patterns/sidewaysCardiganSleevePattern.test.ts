import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildDropShoulderSleeveShapingChartRows,
  dropShoulderSleeveShapingRcSequence,
  formatDropShoulderSleeveWorkingNotation,
} from "./dropShoulderSleeveShapingChart";
import {
  formatDropShoulderSleeveShapingNotation,
  formatDropShoulderSleeveShapingWrittenLines,
} from "./dropShoulderSleeveShaping";
import { sleeveEvenShapingSchedule, sleeveShapingPerSide } from "./evenShapingSchedule";
import { scaleDropShoulderCuffCircumferenceInches } from "./dropShoulderSleeveMeasurementOverrides";
import { evenPositiveBodyStitches } from "./sleevelessBodyStitchMath";
import { formatBindOffNotation, formatCastOnNotation } from "./sleevelessBackJapaneseNotation";
import { calculateSidewaysCardiganBody } from "./sidewaysCardiganBodyCalc";
import { renderSidewaysCardiganBodyDisplayHtml } from "./sidewaysCardiganPatternOutput";
import { buildSidewaysCardiganBodyInstructions } from "./sidewaysCardiganBodyInstructions";
import { buildSidewaysCardiganPatternDiagramModel, buildSidewaysCardiganPatternDiagramSvg } from "./sidewaysCardiganPatternDiagramSvg";
import {
  buildSidewaysCardiganPatternDiagramTabsShellHtml,
  buildSidewaysCardiganSleeveDiagramTabsShellHtml,
} from "./sidewaysCardiganPatternDiagramTabs";
import {
  buildSidewaysCardiganSleeveShapingNotationSvg,
  buildSidewaysCardiganSleeveStitchesRowsSvg,
} from "./sidewaysCardiganSleeveDiagramSvg";
import {
  buildSidewaysCardiganSleeveInstructions,
  renderSidewaysCardiganSleeveSequenceHtml,
  type SidewaysCardiganSleeveCalcInput,
} from "./sidewaysCardiganSleeveInstructions";
import { defaultSidewaysCardiganStyleMeasurements } from "./sidewaysCardiganStyleMeasurements";
import type { SidewaysCardiganWomenChartRow } from "./sidewaysCardiganSizeCharts";
import { SIDEWAYS_CARDIGAN_SLEEVE_LENGTH_CHOICES } from "./sidewaysCardiganConstructionIdentity";
import {
  formatInchesWithUnit,
  formatRowsCount,
  formatStitchesCount,
} from "./sidewaysCardiganDisplayFormat";

const SAMPLE: SidewaysCardiganSleeveCalcInput = {
  direction: "cuff-up",
  finishedUpperArmInches: 14,
  finishedWristInches: 7,
  sleeveLengthInches: 17,
  stitchesPerInch: 5,
  rowsPerInch: 7,
  cuffDepthInches: 2,
  armholeDepthInches: 7,
};

const size8: SidewaysCardiganWomenChartRow = {
  size: 8,
  bust_or_chest: 42,
  garment_back_length: 25,
  neck_opening: 7.5,
  front_neck_depth: 5,
  upper_arm: 12.5,
  wrist: 6.5,
  sleeve_length: 17,
  chartAudience: "misses",
};

function sleeveOf(input: SidewaysCardiganSleeveCalcInput = SAMPLE) {
  const result = buildSidewaysCardiganSleeveInstructions(input);
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error(result.error.message);
  return result.instructions;
}

function diagrams(input: SidewaysCardiganSleeveCalcInput = SAMPLE) {
  const instructions = sleeveOf(input);
  const args = {
    calc: instructions.calc,
    stitchesPerInch: input.stitchesPerInch,
    rowsPerInch: input.rowsPerInch,
  };
  const sts = buildSidewaysCardiganSleeveStitchesRowsSvg(args);
  const notation = buildSidewaysCardiganSleeveShapingNotationSvg(args);
  expect(sts).toBeTruthy();
  expect(notation).toBeTruthy();
  return { instructions, sts: sts!, notation: notation! };
}

function attr(svg: string, name: string): string {
  const match = svg.match(new RegExp(`${name}="([^"]*)"`));
  return match?.[1] ?? "";
}

function texts(svg: string, role: string): string[] {
  return [...svg.matchAll(/<text\b([^>]*)>([\s\S]*?)<\/text>/g)]
    .filter((match) => new RegExp(`data-role="${role}"`).test(match[1] ?? ""))
    .map((match) => (match[2] ?? "").replace(/<[^>]+>/g, ""));
}

function workingNotationTexts(svg: string): string[] {
  return [...svg.matchAll(/<text\b([^>]*)>([\s\S]*?)<\/text>/g)]
    .filter((match) => /data-role="(?:row-span|sleeve-shaping)"/.test(match[1] ?? ""))
    .map((match) => ({
      order: Number(/data-knit-order="(\d+)"/.exec(match[1] ?? "")?.[1] ?? 0),
      text: (match[2] ?? "").replace(/<[^>]+>/g, ""),
    }))
    .sort((a, b) => a.order - b.order)
    .map((item) => item.text);
}

function fontSizes(svg: string): number[] {
  return [...svg.matchAll(/font-size="(\d+(?:\.\d+)?)"/g)].map((match) => Number(match[1]));
}

describe("sideways sleeve instructions, diagrams, and measurements agree", () => {
  const cuff = diagrams({ ...SAMPLE, direction: "cuff-up" });
  const down = diagrams({ ...SAMPLE, direction: "top-down" });

  it("keeps upper arm, cuff, length, stitches, and rows identical across both directions", () => {
    expect(cuff.instructions.calc.finished).toEqual(down.instructions.calc.finished);
    expect(cuff.instructions.calc.topSts).toBe(down.instructions.calc.topSts);
    expect(cuff.instructions.calc.wristSts).toBe(down.instructions.calc.wristSts);
    expect(cuff.instructions.calc.sleeveTotalRows).toBe(down.instructions.calc.sleeveTotalRows);
    expect(cuff.instructions.calc.sleeveBodyRows).toBe(down.instructions.calc.sleeveBodyRows);
    for (const view of [cuff, down]) {
      const { calc } = view.instructions;
      const html = renderSidewaysCardiganSleeveSequenceHtml(view.instructions);
      expect(html).not.toContain("sideways-sleeve-measurements");
      expect(html).toContain("Make 2 sleeves");
      expect(html).toContain(`${calc.wristSts} sts`);
      expect(html).toContain(`${calc.topSts} sts`);
      expect(attr(view.sts, "data-top-stitches")).toBe(String(calc.topSts));
      expect(attr(view.sts, "data-wrist-stitches")).toBe(String(calc.wristSts));
      expect(attr(view.sts, "data-sleeve-total-rows")).toBe(String(calc.sleeveTotalRows));
      expect(attr(view.sts, "data-upper-arm-inches")).toBe(String(calc.finished.upperArmInches));
      expect(attr(view.sts, "data-wrist-inches")).toBe(String(calc.finished.wristInches));
      expect(attr(view.sts, "data-sleeve-length-inches")).toBe(String(calc.finished.sleeveLengthInches));
      expect(attr(view.notation, "data-shaping-notation")).toBe(attr(view.sts, "data-shaping-notation"));
      expect(view.sts).toContain(formatInchesWithUnit(calc.finished.upperArmInches));
      expect(view.sts).toContain(formatInchesWithUnit(calc.finished.wristInches));
      expect(view.sts).toContain(formatInchesWithUnit(calc.finished.sleeveLengthInches));
      expect(view.sts).toContain(formatStitchesCount(calc.topSts));
      expect(view.sts).toContain(formatStitchesCount(calc.wristSts));
      expect(view.sts).toContain(formatRowsCount(calc.sleeveTotalRows));
      expect(view.sts).toContain(formatRowsCount(calc.cuffRows));
      expect(view.sts).not.toContain("Upper arm");
      expect(view.sts).not.toContain("Wrist/Cuff");
      expect(view.sts).not.toContain("Sleeve length");
      expect(view.sts).not.toContain("Cuff length");
      expect(view.sts).not.toContain("<title>");
    }
  });

  it("starts cuff-up at the cuff with increases and ends at the upper arm", () => {
    const { calc } = cuff.instructions;
    const html = renderSidewaysCardiganSleeveSequenceHtml(cuff.instructions);
    const notation = formatDropShoulderSleeveShapingNotation(calc.shapingPlan.steps);
    const written = formatDropShoulderSleeveShapingWrittenLines(
      "increase",
      calc.shapingPlan.steps,
    )[0]!;
    expect(cuff.instructions.steps[0]?.id).toBe("cast-on-wrist");
    expect(cuff.instructions.steps.at(-1)?.id).toBe("bind-off-upper-arm");
    expect(html).toContain(`Cast on ${calc.wristSts} stitches for the sleeve cuff.`);
    expect(html).toContain(written.replace(/\.$/, ""));
    expect(html).toContain("upper-arm/top edge");
    expect(attr(cuff.sts, "data-sleeve-direction")).toBe("cuff-up");
    expect(attr(cuff.sts, "data-cast-on-edge")).toBe("wrist");
    expect(attr(cuff.sts, "data-bind-off-edge")).toBe("upper-arm");
    expect(attr(cuff.sts, "data-cast-on-stitches")).toBe(String(calc.wristSts));
    expect(attr(cuff.sts, "data-bind-off-stitches")).toBe(String(calc.topSts));
    expect(attr(cuff.sts, "data-shaping-direction")).toBe("increase");
    expect(Number(attr(cuff.sts, "data-wrist-y"))).toBeGreaterThan(Number(attr(cuff.sts, "data-upper-arm-y")));
    expect(Number(attr(cuff.sts, "data-cast-on-y"))).toBeGreaterThan(Number(attr(cuff.sts, "data-bind-off-y")));
    expect(texts(cuff.sts, "cast-on")).toEqual([]);
    expect(texts(cuff.sts, "bind-off")).toEqual([]);
    expect(texts(cuff.sts, "sleeve-shaping-verb")).toEqual([]);
    expect(texts(cuff.sts, "sleeve-piece-label")).toEqual([]);
    expect(cuff.sts).not.toContain("Bind off");
    expect(cuff.sts).not.toContain("Cast on");
    expect(cuff.sts).toContain('data-knit-direction="up"');
    expect(cuff.sts).not.toContain("Increase both edges");
    expect(texts(cuff.notation, "cast-on")).toEqual([`${formatCastOnNotation(calc.wristSts)} sts`]);
    expect(texts(cuff.notation, "bind-off")).toEqual([formatBindOffNotation(calc.topSts)]);
    expect(workingNotationTexts(cuff.notation).join(" ")).toContain(notation);
    expect(workingNotationTexts(cuff.notation).join(" ")).toBe(attr(cuff.notation, "data-shaping-notation"));
    expect(cuff.notation).toContain('data-both-edges="true"');
    expect(texts(cuff.notation, "sleeve-shaping")).toHaveLength(1);
    expect(cuff.notation).not.toContain('data-knit-direction=');
    expect(cuff.notation).not.toContain('data-role="sleeve-direction"');
    expect(cuff.sts).toContain('data-knit-direction="up"');
    expect(cuff.notation).not.toContain("Increase both edges");
    expect(texts(cuff.sts, "sleeve-direction")).toEqual(["Cuff Up"]);
  });

  it("starts top-down at the upper arm with decreases and ends at the cuff", () => {
    const { calc } = down.instructions;
    const html = renderSidewaysCardiganSleeveSequenceHtml(down.instructions);
    const notation = formatDropShoulderSleeveShapingNotation(calc.shapingPlan.steps);
    expect(down.instructions.steps[0]?.id).toBe("cast-on-upper-arm");
    expect(down.instructions.steps.at(-1)?.id).toBe("bind-off-wrist");
    expect(html).toContain(`Cast on or pick up ${calc.topSts} stitches.`);
    expect(html).toContain("Decrease 1 stitch at each side");
    expect(html).not.toContain("Increase 1 stitch at each side");
    const chartInput = {
      topSts: calc.topSts,
      wristSts: calc.wristSts,
      cuffRows: calc.cuffRows,
      sleeveBodyRows: calc.sleeveBodyRows,
      sleeveTotalRows: calc.sleeveTotalRows,
      direction: "top-down" as const,
    };
    const topRcs = dropShoulderSleeveShapingRcSequence(chartInput);
    const cuffRcs = dropShoulderSleeveShapingRcSequence({ ...chartInput, direction: "cuff-up" });
    const fabricEnd = calc.cuffRows + calc.sleeveBodyRows;
    expect(topRcs).toEqual([...cuffRcs].map((rc) => fabricEnd - rc).sort((a, b) => a - b));
    expect(attr(down.notation, "data-shaping-notation")).toBe(
      formatDropShoulderSleeveWorkingNotation(chartInput, { includeRowSpans: true }),
    );
    expect(html).toContain(`(RC: ${topRcs.join(", ")})`);
    expect(html).toContain(`Knit ${topRcs[0]} rows even.`);
    expect(html).toContain("cuff/wrist edge");
    expect(attr(down.sts, "data-sleeve-direction")).toBe("top-down");
    expect(attr(down.sts, "data-cast-on-edge")).toBe("upper-arm");
    expect(attr(down.sts, "data-bind-off-edge")).toBe("wrist");
    expect(attr(down.sts, "data-cast-on-stitches")).toBe(String(calc.topSts));
    expect(attr(down.sts, "data-bind-off-stitches")).toBe(String(calc.wristSts));
    expect(attr(down.sts, "data-shaping-direction")).toBe("decrease");
    expect(attr(down.sts, "data-sleeve-frame")).toBe("top-down");
    expect(Number(attr(down.sts, "data-wrist-y"))).toBeLessThan(Number(attr(down.sts, "data-upper-arm-y")));
    expect(Number(attr(down.sts, "data-cast-on-y"))).toBeGreaterThan(Number(attr(down.sts, "data-bind-off-y")));
    expect(down.sts).not.toContain(cuff.sts.match(/<path[^>]*d="([^"]+)"/)?.[1] ?? "missing-cuff-path");
    expect(texts(down.notation, "cast-on")).toEqual([`${formatCastOnNotation(calc.topSts)} sts`]);
    expect(texts(down.notation, "bind-off")).toEqual([formatBindOffNotation(calc.wristSts)]);
    expect(workingNotationTexts(down.notation).join(" ")).toContain(notation);
    expect(workingNotationTexts(down.notation).join(" ")).toBe(attr(down.notation, "data-shaping-notation"));
    expect(down.notation).toContain('data-both-edges="true"');
    expect(texts(down.notation, "sleeve-shaping")).toHaveLength(1);
    expect(down.notation).not.toContain('data-knit-direction=');
    expect(down.notation).not.toContain('data-role="sleeve-direction"');
    expect(down.sts).toContain('data-knit-direction="up"');
    expect(attr(down.notation, "data-sleeve-frame")).toBe("top-down");
    expect(down.notation).not.toContain("Decrease both edges");
    expect(attr(down.sts, "data-shaping-notation")).toContain(notation);
    expect(attr(down.sts, "data-shaping-rows")).toBe(attr(down.notation, "data-shaping-rows"));
    expect(down.sts).toContain('data-knit-direction="up"');
    expect(texts(down.sts, "sleeve-direction")).toEqual(["Top Down"]);
    expect(texts(down.sts, "sleeve-travel")).toEqual([]);
    expect(down.sts).not.toContain("Bind off");
    expect(down.sts).not.toContain("Cast on");
  });

  it("makes both-edge shaping reach the opposite stitch count", () => {
    for (const view of [cuff, down]) {
      const { calc } = view.instructions;
      const perSide = sleeveShapingPerSide(calc.topSts, calc.wristSts);
      expect(perSide * 2).toBe(calc.topSts - calc.wristSts);
      expect(calc.shapingPerSide).toBe(perSide);
      const schedule = sleeveEvenShapingSchedule(calc.topSts, calc.wristSts, calc.sleeveBodyRows);
      expect(calc.shapingPlan.schedule).toEqual(schedule);
      const chart = buildDropShoulderSleeveShapingChartRows({
        topSts: calc.topSts,
        wristSts: calc.wristSts,
        cuffRows: calc.cuffRows,
        sleeveBodyRows: calc.sleeveBodyRows,
        sleeveTotalRows: calc.sleeveTotalRows,
        direction: calc.direction,
      });
      const shaping = chart.filter((row) => /Increase|Decrease/.test(row.action));
      expect(shaping).toHaveLength(schedule.count);
      const end = calc.direction === "top-down" ? calc.wristSts : calc.topSts;
      const start = calc.direction === "top-down" ? calc.topSts : calc.wristSts;
      expect(shaping[0]?.stitchesRemaining).toBe(calc.direction === "top-down" ? start - 2 : start + 2);
      expect(shaping.at(-1)?.stitchesRemaining).toBe(end);
      expect(attr(view.sts, "data-shaping-rows").split(",").filter(Boolean)).toHaveLength(schedule.count);
      expect(view.instructions.calc.sleeveTotalRows).toBe(calc.cuffRows + calc.sleeveBodyRows);
    }
  });

  it("uses the established opening measurement and row count for each sleeve length", () => {
    const styled = SIDEWAYS_CARDIGAN_SLEEVE_LENGTH_CHOICES.map((choice) => {
      const measurements = defaultSidewaysCardiganStyleMeasurements({
        row: size8,
        chartAudience: "misses",
        fitPreference: "standard",
        sleeveLengthChoice: choice,
      });
      return { choice, measurements };
    });
    const byChoice = Object.fromEntries(styled.map((row) => [row.choice, row.measurements]));
    expect(Number(byChoice.short?.wrist)).toBeGreaterThan(Number(byChoice.elbow?.wrist));
    expect(Number(byChoice.elbow?.wrist)).toBeGreaterThan(Number(byChoice["three-quarter"]?.wrist));
    expect(Number(byChoice["three-quarter"]?.wrist)).toBeGreaterThan(Number(byChoice.long?.wrist));
    expect(Number(byChoice.short?.sleeveLength)).toBeLessThan(Number(byChoice.elbow?.sleeveLength));
    expect(Number(byChoice.elbow?.sleeveLength)).toBeLessThan(Number(byChoice["three-quarter"]?.sleeveLength));
    expect(Number(byChoice["three-quarter"]?.sleeveLength)).toBeLessThan(Number(byChoice.long?.sleeveLength));

    const longUpper = Number(byChoice.long?.finishedUpperArm);
    const longWrist = Number(byChoice.long?.wrist);
    let previousRows = 0;
    for (const choice of ["short", "elbow", "three-quarter", "long"] as const) {
      const measurements = byChoice[choice]!;
      const upper = Number(measurements.finishedUpperArm);
      const wrist = Number(measurements.wrist);
      const length = Number(measurements.sleeveLength);
      expect(wrist).toBe(
        scaleDropShoulderCuffCircumferenceInches(longUpper, longWrist, choice),
      );
      const body = calculateSidewaysCardiganBody({
        garmentLengthInches: 22,
        vNeckDepthInches: 8,
        finishedBustCircumferenceInches: 40,
        finishedUpperArmInches: upper,
        neckOpeningWidthInches: 7,
        stitchesPerInch: 5,
        rowsPerInch: 7,
      });
      expect(body.ok).toBe(true);
      if (!body.ok) throw new Error(body.error.message);
      const instructions = sleeveOf({
        direction: "cuff-up",
        finishedUpperArmInches: upper,
        finishedWristInches: wrist,
        sleeveLengthInches: length,
        stitchesPerInch: 5,
        rowsPerInch: 7,
        cuffDepthInches: 2,
        armholeDepthInches: body.calc.armholeDepthInches,
      });
      expect(instructions.calc.finished.wristInches).toBe(wrist);
      expect(instructions.calc.finished.sleeveLengthInches).toBe(length);
      expect(instructions.calc.topSts).toBe(evenPositiveBodyStitches(upper * 5));
      expect(instructions.calc.wristSts).toBe(evenPositiveBodyStitches(wrist * 5));
      expect(instructions.calc.sleeveTotalRows).toBe(
        Math.max(instructions.calc.cuffRows + 2, Math.round(length * 7)),
      );
      expect(instructions.calc.sleeveTotalRows).toBeGreaterThan(previousRows);
      previousRows = instructions.calc.sleeveTotalRows;
      const html = renderSidewaysCardiganSleeveSequenceHtml(instructions);
      expect(html).not.toContain(`${length} in`);
      expect(html).toContain(`${instructions.calc.wristSts} sts`);
      if (choice === "short") {
        expect(instructions.calc.wristSts).toBe(instructions.calc.topSts);
        expect(html).not.toContain("Increase 1 stitch at each side");
      }
    }
  });
});

describe("sideways sleeve diagram tabs stay readable", () => {
  const view = diagrams();
  const shell = buildSidewaysCardiganSleeveDiagramTabsShellHtml();
  const page = readFileSync(resolve("src/pages/patterns/sideways-cardigan/pattern/index.astro"), "utf8");

  it("renders both tabs with enlarge, keyboard, and print chrome", () => {
    expect(shell).toContain("Stitches &amp; Rows");
    expect(shell).toContain("Shaping Notation");
    expect(shell).toContain('role="tablist"');
    expect(shell).toContain('role="tab"');
    expect(shell).toContain('aria-selected="true"');
    expect(shell).toContain('aria-selected="false"');
    expect(shell).toContain("data-sleeveless-diagram-enlarge");
    expect(shell.split("data-sideways-diagram-print").length - 1).toBe(2);
    const shapingStart = shell.indexOf('data-sideways-sleeve-diagram-panel="shaping-notation"');
    const stsStart = shell.indexOf('data-sideways-sleeve-diagram-panel="sts-rows"');
    expect(shell.slice(shapingStart)).toContain("Print shaping notation diagram");
    expect(shell.slice(stsStart, shapingStart)).toContain("Print stitches and rows diagram");
    expect(shell).toContain("Enlarge diagram");
    expect(shell).toContain("sideways-pattern-diagram-print-heading");
    expect(shell).toContain("data-sideways-sleeve-diagram-sts-rows-host");
    expect(shell).toContain("data-sideways-sleeve-diagram-shaping-host");
    expect(shell).toContain('data-sideways-sleeve-diagram-tab="sts-rows"');
    expect(shell).toContain('data-sideways-sleeve-diagram-tab="shaping-notation"');
    expect(view.sts).toContain('data-sideways-sleeve-diagram="sts-rows"');
    expect(view.notation).toContain('data-sideways-sleeve-diagram="shaping-notation"');
    expect(view.sts).toContain('width="100%"');
    expect(view.sts).toContain('height="auto"');
    expect(view.notation).toContain('role="img"');
    expect(page).toContain("sideways-pattern-diagram-print-heading");
    expect(page).toContain("display: block !important");
    expect(page).toContain("data-sideways-sleeve-sequence");
    expect(shell).not.toContain("data-sideways-diagram-tab=");
    expect(shell).not.toContain("data-sideways-diagram-panel=");
    expect(shell).toContain('id="sideways-sleeve-diagram-tab-shaping-notation"');
    expect(shell).toContain('id="sideways-sleeve-diagram-panel-shaping-notation"');
    expect(shell).toContain('aria-controls="sideways-sleeve-diagram-panel-shaping-notation"');
    const bodyShell = buildSidewaysCardiganPatternDiagramTabsShellHtml();
    expect(bodyShell).toContain('id="sideways-diagram-panel-shaping-notation"');
    expect(bodyShell).not.toContain("sideways-sleeve-diagram-panel");
    expect(shell).not.toContain('id="sideways-diagram-panel-shaping-notation"');
    expect(page).toContain("data-sideways-body-layout");
    expect(page).not.toContain('id="pattern-content"\n              class="pattern-layout');
    expect(page).toContain("sleeveless-pattern-reading-layout sideways-pattern-reading-layout");
    const script = readFileSync(resolve("src/scripts/sideways-cardigan-pattern-page.ts"), "utf8");
    expect(script).toContain("initSidewaysCardiganSleeveDiagramTabs");
    expect(script).toContain("buildSidewaysCardiganSleeveShapingNotationSvg");
    expect(script).toContain("data-sideways-sleeve-diagram-shaping-host");
    const sleeveHtml = renderSidewaysCardiganSleeveSequenceHtml(view.instructions);
    expect(sleeveHtml).toContain("data-sideways-sleeve-layout");
    expect(sleeveHtml).toContain("sleeveless-pattern-reading-layout");
    expect(sleeveHtml).toContain("pattern-layout__sidebar");
  });

  it("keeps diagram text at the shared readable size in the normal view", () => {
    for (const svg of [view.sts, view.notation]) {
      const sizes = fontSizes(svg);
      expect(sizes.length).toBeGreaterThan(0);
      expect(Math.min(...sizes)).toBeGreaterThanOrEqual(12);
      expect(svg).not.toMatch(/\bNaN\b/);
      if (svg === view.sts) {
        expect(texts(svg, "sleeve-direction").join("")).toContain("Cuff Up");
        expect(svg).toContain('data-knit-direction="up"');
      } else {
        expect(texts(svg, "sleeve-direction")).toEqual([]);
        expect(svg).not.toContain('data-knit-direction=');
        expect(svg).not.toContain(">Cuff Up<");
        expect(svg).not.toContain(">Top Down<");
      }
      if (svg === view.notation) {
        expect(texts(svg, "cast-on").join("")).not.toBe("");
        expect(texts(svg, "bind-off").join("")).not.toBe("");
      } else {
        expect(texts(svg, "cast-on")).toEqual([]);
        expect(texts(svg, "bind-off")).toEqual([]);
      }
    }
  });
});

describe("sideways sleeve work leaves the body diagram alone", () => {
  it("still builds the body schematic without the sleeve diagram markers", () => {
    const input = {
      garmentLengthInches: 22,
      vNeckDepthInches: 8,
      finishedBustCircumferenceInches: 40,
      finishedUpperArmInches: 14,
      neckOpeningWidthInches: 7,
      backNeckDepthInches: 1,
      stitchesPerInch: 5,
      rowsPerInch: 7,
    };
    const body = calculateSidewaysCardiganBody(input);
    expect(body.ok).toBe(true);
    if (!body.ok) throw new Error(body.error.message);
    const instructions = buildSidewaysCardiganBodyInstructions(input, "cardigan");
    expect(instructions.ok).toBe(true);
    if (!instructions.ok) throw new Error(instructions.error.message);
    const svg = buildSidewaysCardiganPatternDiagramSvg(
      buildSidewaysCardiganPatternDiagramModel({
        garmentStyle: "cardigan",
        calc: body.calc,
        input,
      }),
    );
    expect(svg).toContain("data-sideways-pattern-diagram");
    expect(svg).not.toContain("data-sideways-sleeve-diagram");
    const html = renderSidewaysCardiganBodyDisplayHtml(instructions.instructions);
    expect(html).toContain("BODY");
    expect(html).not.toContain("data-sideways-sleeve-diagram-tabs-mount");
    expect(html).not.toContain("Make 2 sleeves");
  });
});
