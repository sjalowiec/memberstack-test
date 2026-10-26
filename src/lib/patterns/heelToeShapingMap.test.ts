import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { createSockSizingAdapter } from "./christmasStocking/sockSizing";
import { calculateChristmasStockingPattern } from "./christmasStocking/christmasStockingMath";
import {
  buildChristmasStockingInstructions,
  renderChristmasStockingInstructionsHtml,
} from "./christmasStocking/christmasStockingInstructions";
import {
  buildHeelToeShapingMap,
  describeHeelToeDepthAlignment,
  HEEL_TOE_SHAPING_MAP_TITLE,
  renderHeelToeShapingMapSvg,
  replayShortRowActions,
} from "./heelToeShapingMap";
import { buildBasicSockInstructions } from "./sock/sockInstructionBuild";
import {
  renderBasicSockInstructionsHtml,
} from "./sock/sockInstructionRender";
import type { SockInstructionDocument, SockInstructionSection } from "./sock/sockInstructionModel";
import {
  calculateBasicSockPattern,
  type BasicSockCalc,
  type BasicSockCalcInput,
} from "./sock/sockMath";
import { buildSockPatternDiagramSvg } from "./sock/sockPatternDiagramSvg";
import { STOP_ROW_COUNTER_TEXT } from "./rowCounterReset";

const typical: BasicSockCalcInput = {
  footCircumferenceInches: 8.5,
  footLengthInches: 9,
  legCircumferenceInches: 8.5,
  legLengthInches: 4.5,
  stitchGaugeDisplay: 28,
  rowGaugeDisplay: 40,
  displayUnit: "inches",
  constructionDirection: "cuff-to-toe",
};

function mustCalc(input: BasicSockCalcInput = typical): BasicSockCalc {
  const result = calculateBasicSockPattern(input);
  if (!result.ok) throw new Error(result.errors.join(" "));
  return result.calc;
}

function sectionHtml(html: string, id: string): string {
  const start = html.indexOf(`data-section-id="${id}"`);
  const next = html.indexOf('data-section-id="', start + 1);
  return html.slice(start, next === -1 ? undefined : next);
}

function gridLineCount(svg: string): number {
  const groups = [...svg.matchAll(/<g class="shaping-map-grid-(?:minor|major)"[^>]*>([\s\S]*?)<\/g>/g)];
  return groups.reduce((sum, group) => sum + [...group[1]!.matchAll(/<line\b/g)].length, 0);
}

function actionText(svg: string, action: "hold" | "return"): string[] {
  return [
    ...svg.matchAll(
      new RegExp(`data-shaping-action="${action}"[^>]*>([^<]+)<`, "g"),
    ),
  ].map((match) => match[1]!);
}

function passSides(svg: string): string[] {
  return [...svg.matchAll(/data-pass="(\d+)" data-side="(left|right)"/g)]
    .map((match) => `${match[1]}:${match[2]}`);
}

describe("heel and toe share one short-row map", () => {
  it("verifies heel and toe actions match before drawing one map", () => {
    const calc = mustCalc();
    const doc = buildBasicSockInstructions(calc, 1);
    const built = buildHeelToeShapingMap(doc);
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    expect(built.map.title).toBe(HEEL_TOE_SHAPING_MAP_TITLE);
    expect(built.map.workingStitches).toBe(calc.heel.workingStitches);
    expect(built.map.remainingStitches).toBe(calc.heel.remainingStitches);
    expect(calc.toe.workingStitches).toBe(calc.heel.workingStitches);
    expect(calc.toe.remainingStitches).toBe(calc.heel.remainingStitches);
    expect(calc.toe.shortRowInSteps).toBe(calc.heel.shortRowInSteps);
    expect(calc.toe.shortRowOutSteps).toBe(calc.heel.shortRowOutSteps);
    expect(built.map.passes.filter((pass) => pass.action === "hold")).toHaveLength(calc.heel.shortRowInSteps);
    expect(built.map.passes.filter((pass) => pass.action === "return")).toHaveLength(calc.heel.shortRowOutSteps);
    expect(built.map.passes).toHaveLength(calc.heel.shortRowKnittingRows);
  });

  it("does not draw a map when heel and toe actions differ", () => {
    const doc = buildBasicSockInstructions(mustCalc(), 1);
    const toe = doc.sections.find((section) => section.id === "toe");
    expect(toe).toBeTruthy();
    const changed: SockInstructionDocument = {
      ...doc,
      sections: doc.sections.map((section) =>
        section.id === "toe"
          ? {
              ...section,
              steps: section.steps.map((step) =>
                step.type === "short-row-in" ? { ...step, remainingStitches: step.remainingStitches + 2 } : step,
              ),
            }
          : section,
      ),
    };
    expect(toe).not.toBeNull();
    const built = buildHeelToeShapingMap(changed);
    expect(built.ok).toBe(false);
    expect(renderBasicSockInstructionsHtml(changed)).not.toContain("data-heel-toe-shaping-map");
  });

  it("replays carriage-side holds and opposite-carriage returns for the written 13-stitch heel", () => {
    const passes = replayShortRowActions({
      inRows: 8,
      outRows: 8,
      workingStitches: 13,
      remainingStitches: 5,
      endWorkingStitches: 13,
      carriageStartSide: "right",
    });
    expect(typeof passes).not.toBe("string");
    if (typeof passes === "string") return;
    expect(passes.map((pass) => pass.side[0]).join("")).toBe("rlrlrlrl" + "lrlrlrlr");
    expect(passes.map((pass) => pass.action).join(",")).toBe(
      [...Array(8).fill("hold"), ...Array(8).fill("return")].join(","),
    );
    expect(passes[7]).toMatchObject({ inWorkStitches: 5, inWorkLeft: 4, inWorkRight: 9 });
    expect(passes[15]).toMatchObject({ inWorkStitches: 13, inWorkLeft: 0, inWorkRight: 13 });
    expect(passes.filter((pass) => pass.action === "hold" && pass.side === "left")).toHaveLength(4);
    expect(passes.filter((pass) => pass.action === "hold" && pass.side === "right")).toHaveLength(4);
  });
});

describe("Heel & Toe Shaping Map presentation", () => {
  it("draws one column per working stitch and one row per carriage pass", () => {
    const doc = buildBasicSockInstructions(mustCalc(), 1);
    const built = buildHeelToeShapingMap(doc);
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    const svg = renderHeelToeShapingMapSvg(built.map);
    expect(svg).toContain('class="shaping-map__svg shaping-map__svg--heel-toe"');
    expect(svg).toContain('class="shaping-map-grid-minor"');
    expect(svg).toContain('class="shaping-map-grid-major"');
    expect(svg).toContain('class="shaping-map-path"');
    expect(svg).toContain('class="shaping-map-fabric"');
    expect(Number(svg.match(/data-grid-columns="(\d+)"/)?.[1])).toBe(built.map.workingStitches);
    expect(Number(svg.match(/data-grid-rows="(\d+)"/)?.[1])).toBe(built.map.passes.length);
    expect(gridLineCount(svg)).toBe(built.map.workingStitches + 1 + built.map.passes.length + 1);
    expect(actionText(svg, "hold").every((label) => label === "-1")).toBe(true);
    expect(actionText(svg, "return").every((label) => label === "+1")).toBe(true);
    expect(actionText(svg, "hold")).toHaveLength(built.map.passes.filter((pass) => pass.action === "hold").length);
    expect(svg).toContain(`${built.map.workingStitches} working stitches`);
    expect(svg).toContain(`${built.map.remainingStitches} center stitches remain`);
    expect(svg).toContain("Carriage right");
    expect(svg).toContain("Knitting order");
    expect(svg).not.toContain("RC");
    expect(svg).not.toContain(STOP_ROW_COUNTER_TEXT);
    const numbered = [...svg.matchAll(/class="shaping-map-row-number"[^>]*>(\d+)</g)].map((match) => Number(match[1]));
    expect(numbered[0]).toBe(2);
    expect(numbered[numbered.length - 1]).toBe(built.map.passes.length);
    expect(passSides(svg)[0]).toBe("1:right");
    const rightLabels = [...svg.matchAll(/data-side="right"[^>]* x="([\d.]+)"/g)].map((match) => Number(match[1]));
    const rowNumberX = Number(svg.match(/class="shaping-map-row-number" data-pass="2" x="([\d.]+)"/)?.[1]);
    expect(Math.max(...rightLabels) + 20).toBeLessThan(rowNumberX);
  });

  it("keeps Knitting order when pass numbers are not the row counter after each pattern reset", () => {
    const cuff = mustCalc();
    const toeUp = mustCalc({ ...typical, constructionDirection: "toe-up" });
    const cuffDoc = buildBasicSockInstructions(cuff, 1);
    const toeUpDoc = buildBasicSockInstructions(toeUp, 1);
    const built = buildHeelToeShapingMap(cuffDoc);
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    const passes = built.map.passes.map((pass) => pass.pass);
    const cuffHeel = cuffDoc.sections.find((section) => section.id === "heel") as SockInstructionSection;
    const cuffToe = cuffDoc.sections.find((section) => section.id === "toe") as SockInstructionSection;
    const toeUpToe = toeUpDoc.sections.find((section) => section.id === "toe") as SockInstructionSection;
    const toeUpHeel = toeUpDoc.sections.find((section) => section.id === "heel") as SockInstructionSection;

    expect(cuffHeel.steps.find((step) => step.type === "stop-rc")).toEqual({ type: "stop-rc" });
    expect(cuffHeel.steps.some((step) => step.type === "reset-rc")).toBe(false);
    expect(cuffToe.steps[0]).toEqual({ type: "stop-rc", garmentRc: cuff.straightFootRows });
    expect(cuff.straightFootRows).not.toBe(passes[passes.length - 1]);

    const toeUpToeSteps = toeUpToe.steps.map((step) => step.type);
    const resetAt = toeUpToeSteps.indexOf("reset-rc");
    expect(toeUpToeSteps[resetAt + 1]).toBe("short-row-in");
    expect(toeUpToe.rc).toEqual({ resetAtStart: true, startRc: 0, endRc: passes.length });
    expect(toeUpHeel.steps[0]).toEqual({ type: "stop-rc", garmentRc: toeUp.straightFootRows });
    expect(toeUp.straightFootRows).not.toBe(0);
    expect(toeUp.straightFootRows).not.toBe(passes[passes.length - 1]);

    const stocking = calculateChristmasStockingPattern({
      direction: "cuff-down",
      legLengthInches: 8,
      footCircumferenceInches: 8,
      footLengthInches: 10,
      stitchGaugeDisplay: 28,
      rowGaugeDisplay: 40,
      displayUnit: "inches",
    });
    expect(stocking.ok).toBe(true);
    if (!stocking.ok) return;
    const stockingDoc = buildChristmasStockingInstructions(stocking.calc);
    const stockingBuilt = buildHeelToeShapingMap(stockingDoc);
    expect(stockingBuilt.ok).toBe(true);
    if (!stockingBuilt.ok) return;
    const stockingHeel = stockingDoc.sections.find((section) => section.id === "heel") as SockInstructionSection;
    expect(stockingHeel.steps.find((step) => step.type === "stop-rc")).toEqual({
      type: "stop-rc",
      garmentRc: stocking.calc.legRows,
    });
    expect(stocking.calc.legRows).toBeGreaterThan(0);
    expect(stocking.calc.legRows).not.toBe(stockingBuilt.map.passes.length);
    expect(stockingBuilt.map.passes[0]?.pass).toBe(1);

    const svg = renderHeelToeShapingMapSvg(built.map);
    expect(svg).toContain("Knitting order");
    expect(svg).not.toContain("Row Counter");
  });

  it("mirrors the starting carriage side for sock 2 and keeps construction on the map", () => {
    const cuff = mustCalc();
    const toeUp = mustCalc({ ...typical, constructionDirection: "toe-up" });
    const sock1 = buildBasicSockInstructions(cuff, 1);
    const sock2 = buildBasicSockInstructions(cuff, 2);
    const toeUpSock = buildBasicSockInstructions(toeUp, 1);
    const right = buildHeelToeShapingMap(sock1);
    const left = buildHeelToeShapingMap(sock2);
    const toe = buildHeelToeShapingMap(toeUpSock);
    expect(right.ok && left.ok && toe.ok).toBe(true);
    if (!right.ok || !left.ok || !toe.ok) return;
    expect(left.map.carriageStartSide).toBe("left");
    expect(left.map.passes.map((pass) => pass.side)).toEqual(
      right.map.passes.map((pass) => (pass.side === "right" ? "left" : "right")),
    );
    expect(toe.map.passes).toEqual(right.map.passes);
    expect(toe.map.constructionDirection).toBe("toe-up");

    const cuffHtml = renderBasicSockInstructionsHtml(sock1);
    const toeHtml = renderBasicSockInstructionsHtml(toeUpSock);
    const mirrored = renderBasicSockInstructionsHtml(sock2);
    expect(cuffHtml.match(/data-heel-toe-shaping-map /g)).toHaveLength(1);
    expect(cuffHtml).toContain("Heel &amp; Toe Shaping Map");
    expect(sectionHtml(cuffHtml, "heel")).toContain("data-heel-toe-shaping-map");
    expect(sectionHtml(cuffHtml, "toe")).not.toContain("data-heel-toe-shaping-map");
    expect(sectionHtml(toeHtml, "toe")).toContain("data-heel-toe-shaping-map");
    expect(sectionHtml(toeHtml, "heel")).not.toContain("data-heel-toe-shaping-map");
    expect(mirrored).toContain('data-carriage-start="left"');
    expect(mirrored).toContain("Carriage left");
    expect(cuffHtml).toContain(STOP_ROW_COUNTER_TEXT);
    expect(cuffHtml).toContain("RESTART ROW COUNTER AT 000");
    expect(cuffHtml).toContain("RC: 000");
  });
});

describe("shared instructions for socks and Christmas stockings", () => {
  it("places the same map component in both pattern pages' styles and stocking instructions", () => {
    const socksPage = readFileSync(resolve("src/pages/patterns/socks/pattern.astro"), "utf8");
    const stockingPage = readFileSync(resolve("src/pages/patterns/christmas-stocking/pattern.astro"), "utf8");
    expect(socksPage).toContain("shaping-map.css");
    expect(stockingPage).toContain("shaping-map.css");

    const calc = mustCalc();
    const stocking = calculateChristmasStockingPattern({
      direction: "cuff-down",
      legLengthInches: 12,
      footCircumferenceInches: 14,
      footLengthInches: 9,
      stitchGaugeDisplay: 28,
      rowGaugeDisplay: 44,
      displayUnit: "inches",
    });
    expect(stocking.ok).toBe(true);
    if (!stocking.ok) return;
    const html = renderChristmasStockingInstructionsHtml(stocking.calc);
    const doc = buildChristmasStockingInstructions(stocking.calc);
    expect(html.match(/data-heel-toe-shaping-map /g)).toHaveLength(1);
    expect(html).toContain("Heel &amp; Toe Shaping Map");
    expect(sectionHtml(html, "heel")).toContain("shaping-map__svg--heel-toe");
    expect(buildHeelToeShapingMap(doc).ok).toBe(true);
    const diagram = buildSockPatternDiagramSvg(calc);
    expect(diagram).toContain('data-sock-label="measureHeel"');
    expect(diagram).not.toContain(`${calc.heel.shortRowKnittingRows} rows`);
  });
});

describe("every size gets one map from its written short-row actions", () => {
  const stockingChart = createSockSizingAdapter(
    JSON.parse(readFileSync(resolve("public/data/sizing_xmas_stockings.json"), "utf8")),
  );
  const sockChart = JSON.parse(readFileSync(resolve("public/data/sizing_socks.json"), "utf8")) as Array<{
    size: string;
    foot_length: number;
    foot_circumference: number;
    cuff_length: number;
  }>;
  const gauges = [
    { stitchGaugeDisplay: 16, rowGaugeDisplay: 24 },
    { stitchGaugeDisplay: 28, rowGaugeDisplay: 44 },
  ];

  function mapCount(html: string): number {
    return html.split("data-heel-toe-shaping-map ").length - 1;
  }

  it("keeps the published Mini foot length", () => {
    expect(stockingChart.measurements.find((row) => row.size === "mini")).toMatchObject({
      legLengthInches: 4,
      footCircumferenceInches: 6,
      footLengthInches: 4,
    });
  });

  it("draws Mini, Small, and Extra Large stockings in both directions", () => {
    for (const size of ["mini", "sm", "xl"]) {
      const row = stockingChart.measurements.find((entry) => entry.size === size);
      expect(row, size).toBeTruthy();
      if (!row) continue;
      for (const direction of ["cuff-down", "toe-up"] as const) {
        for (const gauge of gauges) {
          const result = calculateChristmasStockingPattern({
            direction,
            legLengthInches: row.legLengthInches,
            footCircumferenceInches: row.footCircumferenceInches,
            footLengthInches: row.footLengthInches,
            ...gauge,
            displayUnit: "inches",
          });
          const label = `${size} ${direction} ${gauge.stitchGaugeDisplay}x${gauge.rowGaugeDisplay}`;
          expect(result.ok, label).toBe(true);
          if (!result.ok) continue;
          const doc = buildChristmasStockingInstructions(result.calc);
          const html = renderChristmasStockingInstructionsHtml(result.calc);
          const built = buildHeelToeShapingMap(doc);
          expect(built.ok, label).toBe(true);
          if (!built.ok) continue;
          const firstId = direction === "cuff-down" ? "heel" : "toe";
          const section = doc.sections.find((entry) => entry.id === firstId) as SockInstructionSection;
          const inn = section.steps.find((step) => step.type === "short-row-in");
          const out = section.steps.find((step) => step.type === "short-row-out");
          expect(inn?.type, label).toBe("short-row-in");
          expect(out?.type, label).toBe("short-row-out");
          if (!inn || inn.type !== "short-row-in" || !out || out.type !== "short-row-out") continue;
          expect(built.map.passes.filter((pass) => pass.action === "hold"), label).toHaveLength(inn.rows);
          expect(built.map.passes.filter((pass) => pass.action === "return"), label).toHaveLength(out.rows);
          expect(built.map.workingStitches, label).toBe(inn.startWorkingStitches);
          expect(built.map.remainingStitches, label).toBe(inn.remainingStitches);
          expect(mapCount(html), label).toBe(1);
          expect(sectionHtml(html, firstId), label).toContain("data-heel-toe-shaping-map");
          expect(sectionHtml(html, firstId === "heel" ? "toe" : "heel"), label).not.toContain(
            "data-heel-toe-shaping-map",
          );
          const svg = renderHeelToeShapingMapSvg(built.map);
          expect(svg, label).toContain(`data-grid-columns="${built.map.workingStitches}"`);
          expect(svg, label).toContain(`data-grid-rows="${built.map.passes.length}"`);
          expect(svg, label).toContain(`width="${svg.match(/viewBox="0 0 ([\d.]+)/)?.[1]}"`);
        }
      }
    }
  });

  it("draws both socks, including the mirrored second sock, for the smallest and largest chart sizes", () => {
    for (const size of ["baby", "man_lg"]) {
      const row = sockChart.find((entry) => entry.size === size);
      expect(row, size).toBeTruthy();
      if (!row) continue;
      for (const direction of ["cuff-to-toe", "toe-up"] as const) {
        const result = calculateBasicSockPattern({
          constructionDirection: direction,
          footLengthInches: row.foot_length,
          footCircumferenceInches: row.foot_circumference,
          legCircumferenceInches: row.foot_circumference,
          legLengthInches: row.cuff_length,
          stitchGaugeDisplay: 28,
          rowGaugeDisplay: 40,
          displayUnit: "inches",
        });
        expect(result.ok, `${size} ${direction}`).toBe(true);
        if (!result.ok) continue;
        const sock1 = buildBasicSockInstructions(result.calc, 1);
        const sock2 = buildBasicSockInstructions(result.calc, 2);
        const right = buildHeelToeShapingMap(sock1);
        const left = buildHeelToeShapingMap(sock2);
        expect(right.ok && left.ok, `${size} ${direction}`).toBe(true);
        if (!right.ok || !left.ok) continue;
        expect(left.map.carriageStartSide).toBe("left");
        expect(left.map.passes.map((pass) => pass.side)).toEqual(
          right.map.passes.map((pass) => (pass.side === "right" ? "left" : "right")),
        );
        const firstId = direction === "cuff-to-toe" ? "heel" : "toe";
        for (const doc of [sock1, sock2]) {
          const html = renderBasicSockInstructionsHtml(doc);
          expect(mapCount(html), `${size} ${direction} sock ${doc.sock}`).toBe(1);
          expect(sectionHtml(html, firstId)).toContain("data-heel-toe-shaping-map");
          expect(sectionHtml(html, firstId === "heel" ? "toe" : "heel")).not.toContain(
            "data-heel-toe-shaping-map",
          );
        }
      }
    }
  });
});

describe("map, written actions, and finished depth", () => {
  function alignmentFor(calc: BasicSockCalc, part: "heel" | "toe") {
    const doc = buildBasicSockInstructions(calc, 1);
    const built = buildHeelToeShapingMap(doc);
    expect(built.ok).toBe(true);
    if (!built.ok) throw new Error("map");
    const section = doc.sections.find((entry) => entry.id === part) as SockInstructionSection;
    const inn = section.steps.find((step) => step.type === "short-row-in");
    const out = section.steps.find((step) => step.type === "short-row-out");
    if (!inn || inn.type !== "short-row-in" || !out || out.type !== "short-row-out") {
      throw new Error("steps");
    }
    return describeHeelToeDepthAlignment({
      mapPasses: built.map.passes.length,
      holdPasses: built.map.passes.filter((pass) => pass.action === "hold").length,
      returnPasses: built.map.passes.filter((pass) => pass.action === "return").length,
      instructionInRows: inn.rows,
      instructionOutRows: out.rows,
      depthRows: calc[part].shortRowDepthRows,
      knittingRows: calc[part].shortRowKnittingRows,
      depthInches: part === "heel" ? calc.heelDepthInches : calc.toeDepthInches,
      rowGaugePerInch: calc.rowGaugePerInch,
    });
  }

  it("matches written actions and keeps finished depth on the one-way row count", () => {
    const calc = mustCalc();
    for (const part of ["heel", "toe"] as const) {
      const alignment = alignmentFor(calc, part);
      expect(alignment.disagreements).toEqual([]);
      expect(alignment.relationship).toContain("one narrowing direction");
      expect(calc[part].shortRowKnittingRows).toBe(calc[part].shortRowDepthRows * 2);
    }
  });

  it("records mini stocking heel and toe depth against the 4 inch foot", () => {
    const gauges = [
      { stitchGaugeDisplay: 16, rowGaugeDisplay: 24 },
      { stitchGaugeDisplay: 28, rowGaugeDisplay: 44 },
    ];
    const rows = gauges.map((gauge) => {
      const result = calculateChristmasStockingPattern({
        direction: "cuff-down",
        legLengthInches: 4,
        footCircumferenceInches: 6,
        footLengthInches: 4,
        ...gauge,
        displayUnit: "inches",
      });
      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error(result.errors.join(" "));
      const calc = result.calc;
      const alignment = alignmentFor(calc, "heel");
      expect(alignment.disagreements).toEqual([]);
      expect(calc.toe.shortRowDepthRows).toBe(calc.heel.shortRowDepthRows);
      expect(calc.toe.shortRowKnittingRows).toBe(calc.heel.shortRowKnittingRows);
      const knittedStraightInches = calc.straightFootRows / calc.rowGaugePerInch;
      return {
        gauge: `${gauge.stitchGaugeDisplay}x${gauge.rowGaugeDisplay}`,
        stitches: calc.totalSockStitches,
        working: calc.heel.workingStitches,
        remaining: calc.heel.remainingStitches,
        depthRows: calc.heel.shortRowDepthRows,
        mapPasses: calc.heel.shortRowKnittingRows,
        depthInches: Number(calc.heelDepthInches.toFixed(4)),
        straightInchesStored: Number(calc.straightFootLengthInches.toFixed(4)),
        straightRows: calc.straightFootRows,
        straightInchesKnitted: Number(knittedStraightInches.toFixed(4)),
        footRequested: 4,
      };
    });
    expect(rows).toEqual([
      {
        gauge: "16x24",
        stitches: 24,
        working: 12,
        remaining: 4,
        depthRows: 8,
        mapPasses: 16,
        depthInches: 1.3333,
        straightInchesStored: 1.3333,
        straightRows: 8,
        straightInchesKnitted: 1.3333,
        footRequested: 4,
      },
      {
        gauge: "28x44",
        stitches: 42,
        working: 21,
        remaining: 7,
        depthRows: 14,
        mapPasses: 28,
        depthInches: 1.2727,
        straightInchesStored: 1.4545,
        straightRows: 16,
        straightInchesKnitted: 1.4545,
        footRequested: 4,
      },
    ]);
  });

  it("knits Mini at 16/24 and 12/16 over 4 inches in both directions", () => {
    const gauges = [
      {
        stitchGaugeDisplay: 16,
        rowGaugeDisplay: 24,
        stitches: 24,
        legRows: 24,
        straightFootRows: 8,
        working: 12,
        remaining: 4,
        depthRows: 8,
      },
      {
        stitchGaugeDisplay: 12,
        rowGaugeDisplay: 16,
        stitches: 18,
        legRows: 16,
        straightFootRows: 4,
        working: 9,
        remaining: 3,
        depthRows: 6,
      },
    ];
    for (const gauge of gauges) {
      const geometries: string[] = [];
      for (const direction of ["cuff-down", "toe-up"] as const) {
        const label = `${gauge.stitchGaugeDisplay}x${gauge.rowGaugeDisplay} ${direction}`;
        const result = calculateChristmasStockingPattern({
          direction,
          legLengthInches: 4,
          footCircumferenceInches: 6,
          footLengthInches: 4,
          stitchGaugeDisplay: gauge.stitchGaugeDisplay,
          rowGaugeDisplay: gauge.rowGaugeDisplay,
          displayUnit: "inches",
        });
        expect(result.ok, label).toBe(true);
        if (!result.ok) continue;
        const calc = result.calc;
        expect(calc.totalSockStitches, label).toBe(gauge.stitches);
        expect(calc.legRows, label).toBe(gauge.legRows);
        expect(calc.legCircumferenceInches, label).toBe(6);
        expect(calc.legLengthInches, label).toBe(4);
        expect(calc.footLengthInches, label).toBe(4);
        expect(calc.straightFootRows, label).toBe(gauge.straightFootRows);
        expect(calc.heel.workingStitches, label).toBe(gauge.working);
        expect(calc.heel.remainingStitches, label).toBe(gauge.remaining);
        expect(calc.heel.shortRowDepthRows, label).toBe(gauge.depthRows);
        expect(calc.toe.shortRowDepthRows, label).toBe(calc.heel.shortRowDepthRows);
        expect(calc.toe.shortRowKnittingRows, label).toBe(calc.heel.shortRowKnittingRows);

        const doc = buildChristmasStockingInstructions(calc);
        const built = buildHeelToeShapingMap(doc);
        expect(built.ok, label).toBe(true);
        if (!built.ok) continue;
        for (const part of ["heel", "toe"] as const) {
          const section = doc.sections.find((entry) => entry.id === part) as SockInstructionSection;
          const inn = section.steps.find((step) => step.type === "short-row-in");
          const out = section.steps.find((step) => step.type === "short-row-out");
          expect(inn?.type, `${label} ${part}`).toBe("short-row-in");
          expect(out?.type, `${label} ${part}`).toBe("short-row-out");
          if (!inn || inn.type !== "short-row-in" || !out || out.type !== "short-row-out") continue;
          expect(built.map.passes.filter((pass) => pass.action === "hold"), `${label} ${part}`).toHaveLength(
            inn.rows,
          );
          expect(built.map.passes.filter((pass) => pass.action === "return"), `${label} ${part}`).toHaveLength(
            out.rows,
          );
          expect(built.map.workingStitches, `${label} ${part}`).toBe(inn.startWorkingStitches);
          expect(built.map.remainingStitches, `${label} ${part}`).toBe(inn.remainingStitches);
          const alignment = describeHeelToeDepthAlignment({
            mapPasses: built.map.passes.length,
            holdPasses: built.map.passes.filter((pass) => pass.action === "hold").length,
            returnPasses: built.map.passes.filter((pass) => pass.action === "return").length,
            instructionInRows: inn.rows,
            instructionOutRows: out.rows,
            depthRows: calc[part].shortRowDepthRows,
            knittingRows: calc[part].shortRowKnittingRows,
            depthInches: part === "heel" ? calc.heelDepthInches : calc.toeDepthInches,
            rowGaugePerInch: calc.rowGaugePerInch,
          });
          expect(alignment.disagreements, `${label} ${part}`).toEqual([]);
        }
        geometries.push(
          [
            calc.totalSockStitches,
            calc.legRows,
            calc.straightFootRows,
            calc.heel.shortRowDepthRows,
            calc.toe.shortRowDepthRows,
          ].join(":"),
        );
      }
      expect(geometries, `${gauge.stitchGaugeDisplay}x${gauge.rowGaugeDisplay}`).toEqual([
        geometries[0],
        geometries[0],
      ]);
    }
  });
});
