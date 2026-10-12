import { describe, expect, it } from "vitest";
import {
  armholeBindOffDecreaseFromEachSide,
  buildBackJapaneseNotationReplacements,
  formatBindOffNotation,
} from "../sleevelessBackJapaneseNotation";
import { buildSleevelessBackStsRowsDiagramModel } from "../sleevelessBackStsRowsDiagramModel";
import { tryBuildLiveSleevelessBackNotationSvg } from "../sleevelessBackShapingNotationDiagramSvg";
import { tryBuildLiveSleevelessFrontStsRowsDiagramSvg } from "../sleevelessFrontStsRowsDiagramSvg";
import type { ChartRow } from "../sleevelessExpressSizeChartTypes";
import { computeDefaultMeasurementsFromChartRow } from "../sleevelessExpressSizeChartClient";
import { generateSetInSleevePattern } from "../setInSleevePatternOutput";
import { withSetInSleeveConstructionAuthored } from "../setInSleeveConstructionIdentity";
import { formatPatternDiagramMeasurement } from "../patternStitchesRowsDiagramLabel";
import { formatRcColon } from "../sleevelessPatternOutput";
import { DROP_SHOULDER_USER_EDITED_SLEEVE_FIELDS_KEY } from "../dropShoulderUserEditedSleeveFields";
import {
  buildSetInSleeveDiagramModel,
  tryBuildSetInSleeveShapingNotationSvg,
  tryBuildSetInSleeveStitchesRowsSvg,
} from "./setInSleeveDiagram";

const MISSES_7: ChartRow = {
  bust_or_chest: 40,
  waist: 32,
  hip: 42,
  garment_back_length: 24.5,
  armhole_depth: 7.75,
  shoulder_width: 13.75,
  neck_opening: 7.5,
  front_neck_depth: 5,
  back_neck_depth: 1,
  upper_arm: 12,
  wrist: 6,
  sleeve_length: 17,
};

const MEN_4X: ChartRow = {
  bust_or_chest: 48,
  waist: 46,
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

function pattern(options: {
  audience: string;
  row: ChartRow;
  stitchesPerInch: number;
  rowsPerInch: number;
  sleeveLength?: string;
}): Record<string, unknown> {
  const measurements = computeDefaultMeasurementsFromChartRow(options.row, "standard", {
    bodyShape: "straight",
  });
  return {
    fit: {
      sizingChart: options.audience,
      easeChoice: "standard",
      selectedMeasurements: measurements,
    },
    style: withSetInSleeveConstructionAuthored(
      {
        recipientCategory: options.audience,
        garmentStyle: "pullover",
        neckline: "round",
        bodyShape: "straight",
      },
      options.sleeveLength ?? "long",
    ),
    yarnGaugeMachine: {
      gaugeStitchesPerInch: options.stitchesPerInch,
      gaugeRowsPerInch: options.rowsPerInch,
      availableNeedles: 250,
    },
  };
}

const cases = [
  { name: "misses size 7 at 5 sts and 7 rows", audience: "misses", row: MISSES_7, stitchesPerInch: 5, rowsPerInch: 7 },
  { name: "men's 4X at 6 sts and 8 rows", audience: "men", row: MEN_4X, stitchesPerInch: 6, rowsPerInch: 8 },
] as const;

describe("set-in sleeve diagrams use calculated shaping", () => {
  it.each(cases)("$name shows the set-in armhole and sleeve cap", (sample) => {
    const result = generateSetInSleevePattern(
      pattern({
        audience: sample.audience,
        row: sample.row,
        stitchesPerInch: sample.stitchesPerInch,
        rowsPerInch: sample.rowsPerInch,
      }),
    );
    const plan = result.setInArmholePlan;
    const cap = result.sleeveCap;
    expect(plan).toBeTruthy();
    expect(cap).toBeTruthy();
    expect(result.sleevePiece).toBeTruthy();
    if (!plan || !cap || !result.sleevePiece) return;

    const backModel = buildSleevelessBackStsRowsDiagramModel(result, result.debug ? pattern({
      audience: sample.audience,
      row: sample.row,
      stitchesPerInch: sample.stitchesPerInch,
      rowsPerInch: sample.rowsPerInch,
    }) : {});
    expect(backModel).toBeTruthy();
    expect(backModel?.armhole.bindOffStsEachSide).toBe(plan.matchedBindOffStitchesEachSide);
    expect(backModel?.armhole.decreaseStsEachSide).toBe(plan.decreaseStitchesEachSide);
    const sleevelessSplit = armholeBindOffDecreaseFromEachSide(plan.shapingStitchesEachSide);
    if (sleevelessSplit.bindOffSts !== plan.initialBindOffStitchesEachSide) {
      expect(backModel?.armhole.bindOffStsEachSide).not.toBe(sleevelessSplit.bindOffSts);
    }
    const bindOffEvents = backModel?.armhole.events.filter(
      (event) => event.kind === "bindOff" && event.side === "right",
    );
    expect(bindOffEvents?.map((event) => event.amount)).toEqual([
      plan.initialBindOffStitchesEachSide,
      ...plan.stairStepBindOffsEachSide,
    ]);

    const patternData = pattern({
      audience: sample.audience,
      row: sample.row,
      stitchesPerInch: sample.stitchesPerInch,
      rowsPerInch: sample.rowsPerInch,
    });
    const notation = buildBackJapaneseNotationReplacements(result, patternData);
    const notationText = `${notation["jp-armhole-bo"]}\n${notation["jp-armhole-shaping"]}`;
    expect(notation["jp-armhole-bo"]).toBe(formatBindOffNotation(plan.initialBindOffStitchesEachSide));
    for (const stair of plan.stairStepBindOffsEachSide) {
      expect(notationText).toContain(formatBindOffNotation(stair));
    }
    expect(notationText).toContain(`1s-2r-${plan.decreaseStitchesEachSide}x`);
    if (plan.straightRows > 0) expect(notationText).toContain(`${plan.straightRows}r`);

    const backNotationSvg = tryBuildLiveSleevelessBackNotationSvg(result, patternData);
    expect(backNotationSvg).toContain(formatBindOffNotation(plan.initialBindOffStitchesEachSide));
    const frontSvg = tryBuildLiveSleevelessFrontStsRowsDiagramSvg(result, patternData, "in");
    expect(frontSvg).toContain('data-supported="true"');
    expect(frontSvg).toContain(`data-bind-off-sts="${plan.matchedBindOffStitchesEachSide}"`);

    const sleeveModel = buildSetInSleeveDiagramModel({
      sleevePiece: result.sleevePiece,
      sleeveCap: cap,
      unit: "in",
      ...result.sleeveFinishedInches,
    });
    expect(sleeveModel?.wristStitches).toBe(result.sleevePiece.wristSts);
    expect(sleeveModel?.upperArmStitches).toBe(cap.sleeve.upperArmStitches);
    expect(sleeveModel?.topStitches).toBe(cap.totals.finalStitches);
    expect(sleeveModel?.capRows).toBe(cap.totals.capRows);
    expect(sleeveModel?.capNotationLines[0]).toBe(
      formatBindOffNotation(cap.sleeve.initialBindOffStitchesEachSide),
    );
    for (const stair of cap.sleeve.stairStepBindOffsEachSide) {
      expect(sleeveModel?.capNotationLines).toContain(formatBindOffNotation(stair));
    }
    expect(sleeveModel?.capNotationLines.join(" ")).toContain(
      formatBindOffNotation(cap.totals.finalStitches),
    );
    expect(sleeveModel?.capMarks[0]?.stitches).toBe(cap.sleeve.upperArmStitches);
    expect(sleeveModel?.capMarks[sleeveModel.capMarks.length - 1]?.stitches).toBe(
      cap.totals.finalStitches,
    );

    const diagramInput = {
      sleevePiece: result.sleevePiece,
      sleeveCap: cap,
      unit: "in" as const,
      ...result.sleeveFinishedInches,
    };
    const stsRows = tryBuildSetInSleeveStitchesRowsSvg(diagramInput);
    const shaping = tryBuildSetInSleeveShapingNotationSvg(diagramInput);
    expect(stsRows).toContain(`${result.sleevePiece.wristSts} sts`);
    expect(stsRows).toContain(`${cap.sleeve.upperArmStitches} sts`);
    expect(stsRows).toContain(`${cap.totals.finalStitches} sts`);
    expect(stsRows).toContain(formatRcColon(result.sleevePiece.sleeveBodyRows));
    const stsText = diagramTexts(stsRows ?? "").map((node) => node.text).join(" ");
    expect(stsText).not.toMatch(/1s-\d+r-\d+x/);
    expect(stsText).not.toMatch(/bo\d/);
    expect(shaping).toContain(formatBindOffNotation(cap.sleeve.initialBindOffStitchesEachSide));
    for (const zone of [cap.workingCap.zones.lower, cap.workingCap.zones.middle, cap.workingCap.zones.upper]) {
      for (const step of zone.steps) {
        expect(shaping).toContain(`${step.stitchesEachSide}s-${step.everyRows}r-${step.times}x`);
      }
    }
  });
});

type DiagramText = {
  role: string;
  text: string;
  x: number;
  y: number;
  anchor: string;
  order: number | null;
  side: string;
  kind: string;
  rowCounter: number | null;
};

function expectUniqueAttributes(svg: string) {
  const tags = svg.match(/<[^>]+>/g) ?? [];
  for (const tag of tags) {
    const names = [...tag.matchAll(/\s([A-Za-z_:][\w:.-]*)=/g)].map((match) => match[1]!);
    expect(names.filter((name, index) => names.indexOf(name) !== index)).toEqual([]);
  }
}

function diagramAttr(svg: string, name: string): string {
  return svg.match(new RegExp(`${name}="([^"]*)"`))?.[1] ?? "";
}

function diagramTexts(svg: string): DiagramText[] {
  const out: DiagramText[] = [];
  for (const match of svg.matchAll(/<text\b([^>]*)>([\s\S]*?)<\/text>/g)) {
    const open = match[1] ?? "";
    const read = (name: string) => open.match(new RegExp(`${name}="([^"]*)"`))?.[1] ?? "";
    const moved = open.match(/translate\(([-\d.]+) ([-\d.]+)\)/);
    const order = read("data-knit-order");
    const rowCounter = read("data-row-counter");
    out.push({
      role: read("data-role"),
      text: (match[2] ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(),
      x: moved ? Number(moved[1]) : Number(read("x")),
      y: moved ? Number(moved[2]) : Number(read("y")),
      anchor: read("text-anchor") || "start",
      order: order ? Number(order) : null,
      side: read("data-side"),
      kind: read("data-kind"),
      rowCounter: rowCounter ? Number(rowCounter) : null,
    });
  }
  return out;
}

function diagramInputFor(result: ReturnType<typeof generateSetInSleevePattern>, unit: "in" | "cm" = "in") {
  return {
    sleevePiece: result.sleevePiece,
    sleeveCap: result.sleeveCap,
    unit,
    ...result.sleeveFinishedInches,
  };
}

function customSleevePattern(): Record<string, unknown> {
  const measurements = computeDefaultMeasurementsFromChartRow(MISSES_7, "standard", {
    bodyShape: "straight",
  });
  return {
    fit: {
      sizingChart: "misses",
      easeChoice: "standard",
      selectedMeasurements: measurements,
      cbMeasurementOverrides: { upperArm: "16", wrist: "8", sleeveLength: "12" },
      [DROP_SHOULDER_USER_EDITED_SLEEVE_FIELDS_KEY]: {
        upperArm: true,
        sleeveLength: true,
        cuffCircumference: true,
      },
    },
    style: withSetInSleeveConstructionAuthored(
      {
        recipientCategory: "misses",
        garmentStyle: "pullover",
        neckline: "round",
        bodyShape: "straight",
      },
      "long",
    ),
    yarnGaugeMachine: {
      gaugeStitchesPerInch: 5,
      gaugeRowsPerInch: 7,
      availableNeedles: 250,
    },
  };
}

describe("set-in sleeve diagram presentation", () => {
  it("draws Stitches & Rows with Drop Shoulder dimension lines, cuff at the bottom, and cap at the top", () => {
    const result = generateSetInSleevePattern(
      pattern({ audience: "misses", row: MISSES_7, stitchesPerInch: 5, rowsPerInch: 7 }),
    );
    const sts = tryBuildSetInSleeveStitchesRowsSvg(diagramInputFor(result))!;
    const shaping = tryBuildSetInSleeveShapingNotationSvg(diagramInputFor(result))!;
    const finished = result.sleeveFinishedInches!;
    const cap = result.sleeveCap!;

    expect(Number(diagramAttr(sts, "data-wrist-y"))).toBeGreaterThan(Number(diagramAttr(sts, "data-cap-start-y")));
    expect(Number(diagramAttr(sts, "data-cap-start-y"))).toBeGreaterThan(Number(diagramAttr(sts, "data-cap-top-y")));
    expect(sts.match(/data-role="sleeve-outline" d="([^"]+)"/)?.[1]).toBe(
      shaping.match(/data-role="sleeve-outline" d="([^"]+)"/)?.[1],
    );
    for (const role of ["wrist-width", "upper-arm-width", "cap-top-width", "cuff-depth", "sleeve-body-length", "cap-height"]) {
      expect(sts).toContain(`data-${role}="true"`);
    }
    expect(sts).toContain('fill="#52682d"');
    for (const inches of [
      finished.wristInches,
      cap.sleeve.finishedUpperArmInches,
      cap.totals.finalWidthInches,
      finished.cuffDepthInches,
      finished.sleeveLengthInches! - finished.cuffDepthInches!,
      cap.totals.capHeightInches,
    ]) {
      expect(sts).toContain(formatPatternDiagramMeasurement(inches, "in"));
    }
    expect(sts).toContain('width="100%"');
    expect(sts).toContain('preserveAspectRatio="xMidYMid meet"');
    expect(sts).not.toMatch(/\bNaN\b/);
    expectUniqueAttributes(sts);
    expectUniqueAttributes(shaping);
  });

  it("draws the calculated cap steps instead of a straight trapezoid", () => {
    const result = generateSetInSleevePattern(
      pattern({ audience: "misses", row: MISSES_7, stitchesPerInch: 5, rowsPerInch: 7 }),
    );
    const model = buildSetInSleeveDiagramModel(diagramInputFor(result))!;
    const cap = result.sleeveCap!;
    const underarm = cap.phases[0]!;
    expect(underarm.kind).toBe("underarm-bind-off");
    expect(model.capMarks[0]).toEqual({ rowsFromCapStart: 0, stitches: cap.sleeve.upperArmStitches });
    expect(model.capMarks[1]).toEqual({
      rowsFromCapStart: 0,
      stitches: underarm.kind === "underarm-bind-off" ? underarm.stitchesAfter : 0,
    });
    expect(model.capMarks[model.capMarks.length - 1]).toEqual({
      rowsFromCapStart: cap.totals.capRows,
      stitches: cap.totals.finalStitches,
    });
    const sts = tryBuildSetInSleeveStitchesRowsSvg(diagramInputFor(result))!;
    const path = sts.match(/data-role="sleeve-outline" d="([^"]+)"/)?.[1] ?? "";
    const points = [...path.matchAll(/[ML] ([-\d.]+) ([-\d.]+)/g)].map((match) => ({
      x: Number(match[1]),
      y: Number(match[2]),
    }));
    const capStartY = Number(diagramAttr(sts, "data-cap-start-y"));
    const atUnderarm = points.filter((point) => Math.abs(point.y - capStartY) < 0.05 && point.x > 215);
    expect(new Set(atUnderarm.map((point) => point.x)).size).toBeGreaterThan(1);
    expect(diagramTexts(sts).some((node) => /^(?:bo\d+|1s-)/.test(node.text))).toBe(false);
  });

  it("places Japanese notation from the underarm bind-off upward to the final bind-off", () => {
    const result = generateSetInSleevePattern(
      pattern({ audience: "misses", row: MISSES_7, stitchesPerInch: 5, rowsPerInch: 7 }),
    );
    const shaping = tryBuildSetInSleeveShapingNotationSvg(diagramInputFor(result))!;
    const cap = result.sleeveCap!;
    const piece = result.sleevePiece!;
    const nodes = diagramTexts(shaping);
    const capNodes = nodes.filter((node) => node.order !== null && node.kind);
    const byOrder = new Map<number, DiagramText[]>();
    for (const node of capNodes) {
      const group = byOrder.get(node.order!) ?? [];
      group.push(node);
      byOrder.set(node.order!, group);
    }
    const orders = [...byOrder.keys()].sort((a, b) => a - b);
    expect(byOrder.get(orders[0]!)!.every((node) => node.kind === "underarm-bind-off")).toBe(true);
    expect(byOrder.get(orders[0]!)!.map((node) => node.text)).toContain(
      formatBindOffNotation(cap.sleeve.initialBindOffStitchesEachSide),
    );
    expect(byOrder.get(orders[orders.length - 1]!)![0]?.kind).toBe("top-bind-off");
    expect(byOrder.get(orders[orders.length - 1]!)![0]?.text).toBe(
      formatBindOffNotation(cap.totals.finalStitches),
    );

    let previousY = Number.POSITIVE_INFINITY;
    for (const order of orders) {
      const group = byOrder.get(order)!;
      const y = group[0]!.y;
      expect(Math.max(...group.map((node) => node.y)) - Math.min(...group.map((node) => node.y))).toBeLessThan(0.05);
      expect(previousY).toBeGreaterThan(y);
      previousY = y;
    }
    for (const side of ["left", "right"]) {
      const column = capNodes.filter((node) => node.side === side).sort((a, b) => b.y - a.y);
      for (let i = 1; i < column.length; i++) {
        const below = column[i - 1]!;
        const above = column[i]!;
        if (below.y - above.y < 20) expect(Math.abs(below.x - above.x)).toBeGreaterThan(12);
      }
    }

    const left = capNodes.find((node) => node.kind === "underarm-bind-off" && node.side === "left")!;
    const right = capNodes.find((node) => node.kind === "underarm-bind-off" && node.side === "right")!;
    expect(left.text).toBe(right.text);
    expect(left.x).toBeLessThan(right.x);
    expect(left.y).toBeCloseTo(right.y, 1);

    const castOn = nodes.find((node) => node.role === "cast-on")!;
    const cuff = nodes.find((node) => node.role === "cuff")!;
    const finalBindOff = nodes.find((node) => node.role === "cap-bind-off")!;
    expect(castOn.y).toBeGreaterThan(cuff.y);
    expect(cuff.y).toBeGreaterThan(left.y);
    expect(finalBindOff.y).toBeLessThan(Number(diagramAttr(shaping, "data-cap-top-y")));

    const counters = nodes
      .filter((node) => node.role === "rc-landmark" && node.rowCounter !== null && node.rowCounter > 0)
      .sort((a, b) => a.rowCounter! - b.rowCounter!);
    expect(counters.map((node) => node.rowCounter)).toContain(piece.sleeveBodyRows);
    expect(counters.map((node) => node.rowCounter)).toContain(piece.sleeveBodyRows + cap.totals.capRows);
    for (let i = 1; i < counters.length; i++) {
      expect(counters[i]!.y).toBeLessThan(counters[i - 1]!.y);
    }
    expect(shaping).toContain(formatRcColon(piece.sleeveBodyRows));
    expect(shaping).toContain(formatRcColon(piece.sleeveBodyRows + cap.totals.capRows));
    expect(shaping).not.toMatch(/\bNaN\b/);
  });

  it("uses centimeters when that display unit is selected", () => {
    const result = generateSetInSleevePattern(
      pattern({ audience: "misses", row: MISSES_7, stitchesPerInch: 5, rowsPerInch: 7 }),
    );
    const cm = tryBuildSetInSleeveStitchesRowsSvg(diagramInputFor(result, "cm"))!;
    const inches = tryBuildSetInSleeveStitchesRowsSvg(diagramInputFor(result, "in"))!;
    expect(cm).toContain('data-display-unit="cm"');
    expect(cm).toContain(formatPatternDiagramMeasurement(result.sleeveFinishedInches?.wristInches, "cm"));
    expect(cm).not.toContain(formatPatternDiagramMeasurement(result.sleeveFinishedInches?.wristInches, "in"));
    expect(inches).toContain(formatPatternDiagramMeasurement(result.sleeveFinishedInches?.wristInches, "in"));
  });

  it("follows a customized upper arm, cuff, and sleeve length without changing the written sleeve", () => {
    const data = customSleevePattern();
    const before = JSON.stringify(data);
    const result = generateSetInSleevePattern(data);
    expect(JSON.stringify(data)).toBe(before);
    const piece = result.sleevePiece!;
    const cap = result.sleeveCap!;
    const finished = result.sleeveFinishedInches!;
    expect(finished.wristInches).toBe(8);
    expect(finished.sleeveLengthInches).toBe(12);
    expect(cap.sleeve.finishedUpperArmInches).toBe(16);
    const written = result.sleeveDisplayRows
      .map((row) => {
        const rc = "rc" in row ? row.rc : undefined;
        const paragraphs = "paragraphs" in row ? (row.paragraphs ?? []) : [];
        return [rc, ...paragraphs].filter((part) => part && part.length > 0).join(" ");
      })
      .join("\n");
    expect(written).toContain(`${formatRcColon(piece.sleeveBodyRows)} Begin the sleeve cap.`);
    expect(written).toContain(
      `${formatRcColon(piece.sleeveBodyRows + cap.totals.capRows)} Bind off the remaining ${cap.totals.finalStitches}`,
    );

    const sts = tryBuildSetInSleeveStitchesRowsSvg(diagramInputFor(result))!;
    const shaping = tryBuildSetInSleeveShapingNotationSvg(diagramInputFor(result))!;
    expect(sts).toContain(`${piece.wristSts} sts`);
    expect(sts).toContain(`${cap.sleeve.upperArmStitches} sts`);
    expect(sts).toContain(formatPatternDiagramMeasurement(8, "in"));
    expect(sts).toContain(formatPatternDiagramMeasurement(16, "in"));
    expect(sts).toContain(formatPatternDiagramMeasurement(12 - finished.cuffDepthInches!, "in"));
    expect(shaping).toContain(formatRcColon(piece.sleeveBodyRows));
    expect(diagramTexts(shaping).find((node) => node.kind === "underarm-bind-off")?.text).toBe(
      formatBindOffNotation(cap.sleeve.initialBindOffStitchesEachSide),
    );
    expect(diagramTexts(shaping).find((node) => node.kind === "top-bind-off")?.y).toBeLessThan(
      diagramTexts(shaping).find((node) => node.kind === "underarm-bind-off")!.y,
    );
    expectProportionalSleeve(sts, result);
    expect(diagramAttr(sts, "data-sleeve-outline") || sts).toContain("sleeve-outline");
    expect(sts.match(/data-role="sleeve-outline" d="([^"]+)"/)?.[1]).toBe(
      shaping.match(/data-role="sleeve-outline" d="([^"]+)"/)?.[1],
    );
  });

  it("draws a 17 inch sleeve body about 3.4 times a 5 inch cap, and keeps short sleeves in proportion", () => {
    const longBody = generateSetInSleevePattern({
      ...pattern({ audience: "misses", row: MISSES_7, stitchesPerInch: 5, rowsPerInch: 7 }),
      fit: {
        sizingChart: "misses",
        easeChoice: "standard",
        selectedMeasurements: computeDefaultMeasurementsFromChartRow(MISSES_7, "standard", {
          bodyShape: "straight",
        }),
        cbMeasurementOverrides: { sleeveLength: "19" },
        [DROP_SHOULDER_USER_EDITED_SLEEVE_FIELDS_KEY]: { sleeveLength: true },
      },
    });
    const bodyIn = longBody.sleeveFinishedInches!.sleeveLengthInches! - longBody.sleeveFinishedInches!.cuffDepthInches!;
    const capIn = longBody.sleeveCap!.totals.capHeightInches;
    expect(bodyIn).toBeCloseTo(17, 5);
    const sts = tryBuildSetInSleeveStitchesRowsSvg(diagramInputFor(longBody))!;
    const sections = sleeveSections(sts);
    expect(sections.body / sections.cap).toBeCloseTo(bodyIn / capIn, 2);
    expect(sections.body / sections.cap).toBeCloseTo((17 / 5) * (5 / capIn), 2);
    expect(17 / 5).toBeCloseTo(3.4, 5);

    const samples = [
      pattern({ audience: "misses", row: MISSES_7, stitchesPerInch: 5, rowsPerInch: 7, sleeveLength: "long" }),
      pattern({ audience: "misses", row: MISSES_7, stitchesPerInch: 5, rowsPerInch: 7, sleeveLength: "short" }),
      pattern({ audience: "misses", row: MISSES_7, stitchesPerInch: 4, rowsPerInch: 6, sleeveLength: "long" }),
      pattern({ audience: "men", row: MEN_4X, stitchesPerInch: 6, rowsPerInch: 8, sleeveLength: "short" }),
      customSleevePattern(),
    ];
    for (const data of samples) {
      const result = generateSetInSleevePattern(data);
      const diagram = tryBuildSetInSleeveStitchesRowsSvg(diagramInputFor(result))!;
      const shaping = tryBuildSetInSleeveShapingNotationSvg(diagramInputFor(result))!;
      expectProportionalSleeve(diagram, result);
      expect(diagram.match(/data-role="sleeve-outline" d="([^"]+)"/)?.[1]).toBe(
        shaping.match(/data-role="sleeve-outline" d="([^"]+)"/)?.[1],
      );
    }
  });
});

function sleeveSections(svg: string) {
  const wristY = Number(diagramAttr(svg, "data-wrist-y"));
  const cuffJoinY = Number(diagramAttr(svg, "data-cuff-join-y"));
  const capStartY = Number(diagramAttr(svg, "data-cap-start-y"));
  const capTopY = Number(diagramAttr(svg, "data-cap-top-y"));
  return {
    cuff: wristY - cuffJoinY,
    body: cuffJoinY - capStartY,
    cap: capStartY - capTopY,
  };
}

function groupWidth(svg: string, attr: string): number {
  const group = svg.match(new RegExp(`data-${attr}="true">([\\s\\S]*?)</g>`));
  const lines = [...(group?.[1] ?? "").matchAll(/<line\b[^>]*\bx1="([^"]+)"[^>]*\bx2="([^"]+)"/g)];
  const widths = lines.map((line) => Math.abs(Number(line[2]) - Number(line[1])));
  return Math.max(0, ...widths);
}

function expectProportionalSleeve(svg: string, result: ReturnType<typeof generateSetInSleevePattern>) {
  const finished = result.sleeveFinishedInches!;
  const cap = result.sleeveCap!;
  const cuffIn = finished.cuffDepthInches!;
  const bodyIn = finished.sleeveLengthInches! - cuffIn;
  const capIn = cap.totals.capHeightInches;
  const sections = sleeveSections(svg);
  const pxPerInch = sections.body / bodyIn;
  expect(sections.cuff / cuffIn).toBeCloseTo(pxPerInch, 1);
  expect(sections.cap / capIn).toBeCloseTo(pxPerInch, 1);
  expect(sections.cuff + sections.body).toBeCloseTo((cuffIn + bodyIn) * pxPerInch, 1);
  const upperW = groupWidth(svg, "upper-arm-width");
  const wristW = groupWidth(svg, "wrist-width");
  const topW = groupWidth(svg, "cap-top-width");
  expect(upperW / cap.sleeve.finishedUpperArmInches).toBeCloseTo(pxPerInch, 1);
  expect(wristW / finished.wristInches!).toBeCloseTo(pxPerInch, 1);
  expect(topW / cap.totals.finalWidthInches).toBeCloseTo(pxPerInch, 1);
  const capStartY = Number(diagramAttr(svg, "data-cap-start-y"));
  const path = svg.match(/data-role="sleeve-outline" d="([^"]+)"/)?.[1] ?? "";
  const points = [...path.matchAll(/[ML] ([-\d.]+) ([-\d.]+)/g)].map((match) => ({
    x: Number(match[1]),
    y: Number(match[2]),
  }));
  const capRight = points.filter((point) => point.x > 220 && point.y <= capStartY + 0.2);
  expect(new Set(capRight.map((point) => point.x.toFixed(1))).size).toBeGreaterThan(2);
}
