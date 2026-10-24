import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { calculateChristmasStockingPattern } from "../christmasStocking/christmasStockingMath";
import {
  calculateBasicSockPattern,
  type BasicSockCalc,
  type BasicSockCalcInput,
} from "../sock/sockMath";
import {
  buildStitchPlannerModel,
  stitchPlannerSectionGridLines,
  type StitchPlannerMeta,
  type StitchPlannerSection,
} from "./stitchPlannerModel";
import { buildStitchPlannerPrintHtml } from "./stitchPlannerPrint";
import { tileStitchPlanner, type StitchPlannerTile } from "./stitchPlannerTiles";

function sockCalc(overrides: Partial<BasicSockCalcInput> = {}): BasicSockCalc {
  const result = calculateBasicSockPattern({
    footCircumferenceInches: 8.5,
    footLengthInches: 9.5,
    legCircumferenceInches: 8.5,
    legLengthInches: 6,
    stitchGaugeDisplay: 28,
    rowGaugeDisplay: 40,
    displayUnit: "inches",
    constructionDirection: "cuff-to-toe",
    ...overrides,
  });
  if (!result.ok) throw new Error(result.errors.join(" "));
  return result.calc;
}

function meta(overrides: Partial<StitchPlannerMeta> = {}): StitchPlannerMeta {
  return {
    family: "socks",
    patternName: "Basic Socks",
    projectName: "",
    sizeLabel: "Woman Medium",
    constructionLabel: "Cuff to Toe",
    gaugeLabel: "28 sts / 40 rows over 4 inches",
    displayUnit: "inches",
    sock: 1,
    ...overrides,
  };
}

function section(model: ReturnType<typeof buildStitchPlannerModel>, id: StitchPlannerSection["id"]) {
  const found = model.sections.find((item) => item.id === id);
  if (!found) throw new Error(`missing ${id}`);
  return found;
}

function knitOrderCounts(part: StitchPlannerSection): number[] {
  const counts = part.stitchesTopToBottom.slice();
  return part.knitDirection === "up" ? counts.reverse() : counts;
}

describe("stitch planner geometry", () => {
  it("grids the sock leg, ankle, and straight foot from the calculated counts", () => {
    const calc = sockCalc();
    const model = buildStitchPlannerModel(calc, meta());
    const foot = section(model, "foot");
    const ankle = section(model, "ankle");
    const leg = section(model, "leg");
    const heel = section(model, "heel");
    const toe = section(model, "toe");

    expect(model.sections.map((item) => item.id)).toEqual(["toe", "foot", "heel", "ankle", "leg"]);
    expect(foot.rows).toBe(calc.straightFootRows);
    expect(foot.columns).toBe(calc.totalSockStitches);
    expect(foot.stitchesTopToBottom.every((count) => count === calc.totalSockStitches)).toBe(true);
    expect(ankle.rows).toBe(calc.ankleStraightRows);
    expect(ankle.columns).toBe(calc.ankleStitches);
    expect(leg.rows).toBe(calc.legShapingRowsAvailable);
    expect(ankle.rows + leg.rows).toBe(calc.legRows);
    expect(model.addedRows).toBe(0);
    expect(heel.rows).toBe(0);
    expect(toe.rows).toBe(0);
    expect(heel.kind).toBe("plain");
    expect(toe.kind).toBe("plain");
  });

  it("sizes every cell from the pattern gauge", () => {
    const calc = sockCalc();
    const model = buildStitchPlannerModel(calc, meta());
    const foot = section(model, "foot");
    expect(model.cellWidthIn).toBeCloseTo(1 / calc.stGaugePerInch, 8);
    expect(model.cellHeightIn).toBeCloseTo(1 / calc.rowGaugePerInch, 8);
    expect(foot.widthIn).toBeCloseTo(calc.totalSockStitches / calc.stGaugePerInch, 6);
    expect(foot.heightIn).toBeCloseTo(calc.straightFootRows / calc.rowGaugePerInch, 6);
    expect(section(model, "heel").heightIn).toBeCloseTo(calc.heelDepthInches, 8);
    expect(section(model, "toe").heightIn).toBeCloseTo(calc.toeDepthInches, 8);
    expect(section(model, "leg").heightIn).toBeCloseTo(
      calc.legShapingRowsAvailable / calc.rowGaugePerInch,
      6,
    );
  });

  it("keeps a centimeter swatch at the same physical cell size as its inch equivalent", () => {
    const inches = sockCalc();
    const cmGauge = (perFourInches: number) => perFourInches * (10 / (4 * 2.54));
    const cm = sockCalc({
      stitchGaugeDisplay: cmGauge(28),
      rowGaugeDisplay: cmGauge(40),
      displayUnit: "cm",
    });
    const inchModel = buildStitchPlannerModel(inches, meta());
    const cmModel = buildStitchPlannerModel(
      cm,
      meta({ displayUnit: "cm", gaugeLabel: "22 sts / 32 rows over 10 cm" }),
    );
    expect(cm.stGaugePerInch).toBeCloseTo(inches.stGaugePerInch, 6);
    expect(cmModel.cellWidthIn).toBeCloseTo(inchModel.cellWidthIn, 6);
    expect(cmModel.cellHeightIn).toBeCloseTo(inchModel.cellHeightIn, 6);
    expect(cmModel.cellWidthIn).toBeCloseTo(10 / cmGauge(28) / 2.54, 6);
  });

  it("follows the leg schedule stitch counts without a second shaping formula", () => {
    const calc = sockCalc({
      legCircumferenceInches: 11,
      legLengthInches: 7,
      footLengthInches: 10,
    });
    expect(calc.legShapingNeeded).toBe(true);
    for (const direction of ["cuff-to-toe", "toe-up"] as const) {
      const shaped = direction === "cuff-to-toe" ? calc : sockCalc({
        legCircumferenceInches: 11,
        legLengthInches: 7,
        footLengthInches: 10,
        constructionDirection: "toe-up",
      });
      const model = buildStitchPlannerModel(
        shaped,
        meta({
          constructionLabel: direction === "cuff-to-toe" ? "Cuff to Toe" : "Toe Up",
        }),
      );
      const leg = section(model, "leg");
      const knit = knitOrderCounts(leg);
      const schedule = shaped.legShapingSchedule.knitOrder;
      expect(knit).toHaveLength(shaped.legShapingRowsAvailable);
      let expected = schedule.startStitches;
      schedule.events.forEach((event) => {
        expect(event.rowNumber).toBeGreaterThan(0);
      });
      const after = new Map(schedule.events.map((event) => [event.rowNumber, event.stitchesAfter]));
      knit.forEach((count, index) => {
        const changed = after.get(index + 1);
        if (changed != null) expected = changed;
        expect(count).toBe(expected);
      });
      expect(knit[knit.length - 1]).toBe(schedule.targetStitches);
    }
  });

  it("numbers cuff-down rows upward from the cuff and restarts the foot", () => {
    const calc = sockCalc();
    const model = buildStitchPlannerModel(calc, meta());
    const leg = section(model, "leg");
    const ankle = section(model, "ankle");
    const foot = section(model, "foot");
    expect(leg.knitDirection).toBe("up");
    expect(leg.rcTopToBottom[leg.rcTopToBottom.length - 1]).toBe(1);
    expect(leg.rcTopToBottom[0]).toBe(calc.legShapingRowsAvailable);
    expect(ankle.rcOriginEdge).toBeNull();
    expect(ankle.rcTopToBottom[ankle.rcTopToBottom.length - 1]).toBe(calc.legShapingRowsAvailable + 1);
    expect(ankle.rcTopToBottom[0]).toBe(calc.legRows);
    expect(foot.rcTopToBottom[foot.rcTopToBottom.length - 1]).toBe(1);
    expect(foot.rcTopToBottom[0]).toBe(calc.straightFootRows);
    expect(section(model, "toe").yIn).toBeLessThan(foot.yIn);
    expect(foot.yIn).toBeLessThan(section(model, "heel").yIn);
    expect(section(model, "heel").yIn).toBeLessThan(ankle.yIn);
    expect(ankle.yIn).toBeLessThan(leg.yIn);
  });

  it("numbers toe-up rows from the toe and from each reset", () => {
    const calc = sockCalc({ constructionDirection: "toe-up" });
    const model = buildStitchPlannerModel(calc, meta({ constructionLabel: "Toe Up" }));
    const foot = section(model, "foot");
    const ankle = section(model, "ankle");
    const leg = section(model, "leg");
    expect(foot.rcTopToBottom[0]).toBe(1);
    expect(foot.rcTopToBottom[foot.rcTopToBottom.length - 1]).toBe(calc.straightFootRows);
    expect(ankle.rcTopToBottom[0]).toBe(1);
    expect(ankle.rcTopToBottom[ankle.rcTopToBottom.length - 1]).toBe(calc.ankleStraightRows);
    expect(leg.rcTopToBottom[0]).toBe(1);
    expect(leg.rcTopToBottom[leg.rcTopToBottom.length - 1]).toBe(calc.legShapingRowsAvailable);
    expect(foot.knitDirection).toBe("down");
  });

  it("puts the sole on the working half and mirrors sock 2", () => {
    const calc = sockCalc();
    const sock1 = buildStitchPlannerModel(calc, meta({ sock: 1 }));
    const sock2 = buildStitchPlannerModel(calc, meta({ sock: 2 }));
    const foot1 = section(sock1, "foot");
    expect(sock1.soleOnRight).toBe(true);
    expect(sock1.divider).not.toBeNull();
    expect(sock1.divider!.xIn - foot1.xIn).toBeCloseTo(calc.heel.heldStitches * sock1.cellWidthIn, 6);
    expect(sock2.soleOnRight).toBe(false);
    const foot2 = section(sock2, "foot");
    expect(sock2.divider!.xIn - foot2.xIn).toBeCloseTo(
      calc.heel.workingStitches * sock2.cellWidthIn,
      6,
    );
  });

  it("draws one stocking leg and does not add the sock ankle again", () => {
    for (const direction of ["cuff-down", "toe-up"] as const) {
      const result = calculateChristmasStockingPattern({
        direction,
        legLengthInches: 12,
        footCircumferenceInches: 8,
        footLengthInches: 9,
        stitchGaugeDisplay: 28,
        rowGaugeDisplay: 40,
        displayUnit: "inches",
      });
      if (!result.ok) throw new Error(result.errors.join(" "));
      const model = buildStitchPlannerModel(result.calc, meta({
        family: "christmas-stocking",
        patternName: "Christmas Stocking",
        constructionLabel: direction === "cuff-down" ? "Cuff down" : "Toe up",
        sock: 2,
      }));
      expect(model.sections.map((item) => item.id)).toEqual(["toe", "foot", "heel", "leg"]);
      expect(model.meta.sock).toBe(1);
      expect(model.soleOnRight).toBe(true);
      const leg = section(model, "leg");
      expect(leg.rows).toBe(result.calc.legRows);
      expect(leg.columns).toBe(result.calc.legStitches);
      expect(leg.stitchesTopToBottom.every((count) => count === result.calc.legStitches)).toBe(true);
      expect(result.calc.ankleStraightRows).toBeGreaterThan(0);
      expect(leg.rows).toBe(result.calc.legRows);
      expect(section(model, "foot").rows).toBe(result.calc.straightFootRows);
    }
  });

  it("gives a straight grid one line per stitch and row at the gauge spacing", () => {
    const calc = sockCalc();
    const model = buildStitchPlannerModel(calc, meta());
    const foot = section(model, "foot");
    const lines = stitchPlannerSectionGridLines(foot, model.cellWidthIn, model.cellHeightIn);
    const unique = (values: number[]) => {
      const sorted = [...values].sort((a, b) => a - b);
      return sorted.filter((value, index) => index === 0 || value - sorted[index - 1]! > 1e-6);
    };
    const xs = unique(lines.filter((line) => line.y1 !== line.y2).map((line) => line.x1));
    const ys = unique(lines.filter((line) => line.x1 !== line.x2).map((line) => line.y1));
    expect(xs).toHaveLength(foot.columns + 1);
    expect(ys).toHaveLength(foot.rows + 1);
    for (let index = 1; index < xs.length; index += 1) {
      expect(xs[index]! - xs[index - 1]!).toBeCloseTo(model.cellWidthIn, 5);
    }
    for (let index = 1; index < ys.length; index += 1) {
      expect(ys[index]! - ys[index - 1]!).toBeCloseTo(model.cellHeightIn, 5);
    }
    expect(stitchPlannerSectionGridLines(section(model, "heel"), model.cellWidthIn, model.cellHeightIn)).toEqual([]);
    expect(lines.some((line) => line.weight === "fifth")).toBe(true);
    expect(lines.some((line) => line.weight === "fine")).toBe(true);
    expect(lines.some((line) => line.weight === "outline")).toBe(true);
  });
});

function intersection(a: StitchPlannerTile, b: StitchPlannerTile): { width: number; height: number } {
  const width = Math.min(a.xIn + a.viewWidthIn, b.xIn + b.viewWidthIn) - Math.max(a.xIn, b.xIn);
  const height = Math.min(a.yIn + a.viewHeightIn, b.yIn + b.viewHeightIn) - Math.max(a.yIn, b.yIn);
  return { width: Math.max(0, width), height: Math.max(0, height) };
}

describe("stitch planner tiling", () => {
  it("covers a large planner without gaps and overlaps only the shared edge", () => {
    const calc = sockCalc({
      footCircumferenceInches: 12,
      footLengthInches: 14,
      legCircumferenceInches: 12,
      legLengthInches: 16,
      stitchGaugeDisplay: 32,
      rowGaugeDisplay: 44,
    });
    const model = buildStitchPlannerModel(calc, meta({ sizeLabel: "Man Large" }));
    const { tiles } = tileStitchPlanner({
      drawingWidthIn: model.drawingWidthIn,
      drawingHeightIn: model.drawingHeightIn,
      cellWidthIn: model.cellWidthIn,
      cellHeightIn: model.cellHeightIn,
    });
    expect(tiles.length).toBeGreaterThan(1);
    expect(tiles[0]!.xIn).toBe(0);
    expect(tiles[0]!.yIn).toBe(0);
    const lastCol = tiles.filter((tile) => tile.row === 0).at(-1)!;
    const lastRow = tiles.filter((tile) => tile.col === 0).at(-1)!;
    expect(lastCol.xIn + lastCol.viewWidthIn).toBeGreaterThanOrEqual(model.drawingWidthIn - 1e-6);
    expect(lastRow.yIn + lastRow.viewHeightIn).toBeGreaterThanOrEqual(model.drawingHeightIn - 1e-6);

    const foot = section(model, "foot");
    for (let column = 0; column <= foot.columns; column += 1) {
      const x = foot.xIn + column * model.cellWidthIn;
      expect(tiles.some((tile) => x >= tile.xIn - 1e-6 && x <= tile.xIn + tile.viewWidthIn + 1e-6)).toBe(true);
    }
    for (let row = 0; row <= foot.rows; row += 1) {
      const y = foot.yIn + row * model.cellHeightIn;
      expect(tiles.some((tile) => y >= tile.yIn - 1e-6 && y <= tile.yIn + tile.viewHeightIn + 1e-6)).toBe(true);
    }

    for (const tile of tiles) {
      const right = tiles.find((other) => other.row === tile.row && other.col === tile.col + 1);
      if (right) {
        const overlap = intersection(tile, right);
        expect(overlap.width).toBeCloseTo(tile.overlapXIn, 5);
        expect(overlap.width).toBeGreaterThanOrEqual(0.45 - 1e-6);
        expect(right.xIn).toBeCloseTo(tile.xIn + tile.viewWidthIn - tile.overlapXIn, 5);
      }
      const below = tiles.find((other) => other.col === tile.col && other.row === tile.row + 1);
      if (below) {
        const overlap = intersection(tile, below);
        expect(overlap.height).toBeCloseTo(tile.overlapYIn, 5);
        expect(overlap.height).toBeGreaterThanOrEqual(0.45 - 1e-6);
        expect(below.yIn).toBeCloseTo(tile.yIn + tile.viewHeightIn - tile.overlapYIn, 5);
      }
      const skipped = tiles.find((other) => other.row === tile.row && other.col === tile.col + 2);
      if (skipped) expect(intersection(tile, skipped).width).toBe(0);
    }
  });

  it("keeps a small sock on one sheet at full scale", () => {
    const calc = sockCalc({
      footCircumferenceInches: 4,
      footLengthInches: 5,
      legCircumferenceInches: 4,
      legLengthInches: 1.5,
      stitchGaugeDisplay: 16,
      rowGaugeDisplay: 20,
    });
    const model = buildStitchPlannerModel(calc, meta({ sizeLabel: "Baby" }));
    const { box, tiles } = tileStitchPlanner({
      drawingWidthIn: model.drawingWidthIn,
      drawingHeightIn: model.drawingHeightIn,
      cellWidthIn: model.cellWidthIn,
      cellHeightIn: model.cellHeightIn,
    });
    expect(tiles).toHaveLength(1);
    expect(tiles[0]!.viewWidthIn).toBeCloseTo(model.drawingWidthIn, 6);
    expect(tiles[0]!.viewHeightIn).toBeCloseTo(model.drawingHeightIn, 6);
    expect(tiles[0]!.viewWidthIn).toBeLessThan(box.contentWidthIn);
    expect(model.cellWidthIn).toBeCloseTo(4 / 16, 8);
  });
});

describe("stitch planner print document", () => {
  it("prints the loaded pattern at actual size with the scale check and no extra rows", () => {
    const calc = sockCalc();
    const model = buildStitchPlannerModel(calc, meta({ projectName: "Blue rib socks" }));
    const html = buildStitchPlannerPrintHtml(model);
    expect(html).toContain('data-stitch-planner="true"');
    expect(html).toContain('data-family="socks"');
    expect(html).toContain(`data-foot-columns="${calc.totalSockStitches}"`);
    expect(html).toContain(`data-foot-rows="${calc.straightFootRows}"`);
    expect(html).toContain(`data-counted-leg-rows="${calc.legRows}"`);
    expect(html).toContain('data-added-rows="0"');
    expect(html).toContain("Actual Size / 100%");
    expect(html).toContain('data-scale-check-in="1"');
    expect(html).toContain('width="1in"');
    expect(html).toContain("@page { size: letter;");
    expect(html).not.toContain("transform: scale");
    expect(html).toContain("Basic Socks");
    expect(html).toContain("Woman Medium");
    expect(html).toContain("Cuff to Toe");
    expect(html).toContain("28 sts / 40 rows over 4 inches");
    expect(html).toContain("Project: Blue rib socks");
    expect(html).toContain("Instep");
    expect(html).toContain("Sole");
    expect(html).toContain("Do not add extra rows.");
    expect(html).toContain('data-sole-side="right"');
    const pages = Number(html.match(/data-pages="(\d+)"/)?.[1]);
    expect(html.match(/data-planner-part="foot-grid"/g)).toHaveLength(pages);
    expect(html.match(/class="planner-page"/g)).toHaveLength(pages);
  });

  it("labels a Christmas stocking without an ankle section", () => {
    const result = calculateChristmasStockingPattern({
      direction: "toe-up",
      legLengthInches: 14,
      footCircumferenceInches: 10,
      footLengthInches: 11,
      stitchGaugeDisplay: 22,
      rowGaugeDisplay: 30,
      displayUnit: "cm",
    });
    if (!result.ok) throw new Error(result.errors.join(" "));
    const model = buildStitchPlannerModel(result.calc, meta({
      family: "christmas-stocking",
      patternName: "Christmas Stocking",
      projectName: "Front hall",
      sizeLabel: "Medium",
      constructionLabel: "Toe up",
      gaugeLabel: "22 sts / 30 rows over 10 cm",
      displayUnit: "cm",
    }));
    const html = buildStitchPlannerPrintHtml(model);
    expect(html).toContain('data-family="christmas-stocking"');
    expect(html).toContain('data-ankle-rows="0"');
    expect(html).toContain(`data-leg-rows="${result.calc.legRows}"`);
    expect(html).toContain("Christmas Stocking");
    expect(html).toContain("Toe up");
    expect(html).toContain("22 sts / 30 rows over 10 cm");
    expect(html).toContain("Project: Front hall");
    expect(html).toContain("2.54 cm");
    expect(html).not.toContain(">Ankle<");
  });
});

describe("stitch planner pattern-page actions", () => {
  it("keeps the planner off both pattern pages and leaves normal printing in place", () => {
    const socksPage = readFileSync(resolve("src/pages/patterns/socks/pattern.astro"), "utf8");
    const stockingPage = readFileSync(
      resolve("src/pages/patterns/christmas-stocking/pattern.astro"),
      "utf8",
    );
    const socksScript = readFileSync(resolve("src/scripts/socks-pattern-page.ts"), "utf8");
    const stockingScript = readFileSync(
      resolve("src/scripts/christmas-stocking-pattern-page.ts"),
      "utf8",
    );
    const diagram = readFileSync(resolve("src/lib/patterns/sock/sockPatternDiagramSvg.ts"), "utf8");
    for (const source of [socksPage, stockingPage]) {
      expect(source).not.toContain("Print Stitch Planner");
      expect(source).not.toContain("data-stitch-planner-print");
      expect(source).toContain("includePrint");
    }
    expect(socksScript).not.toContain("printStitchPlanner");
    expect(stockingScript).not.toContain("printStitchPlanner");
    expect(socksScript).toContain("triggerPatternPrint");
    expect(stockingScript).toContain("triggerPatternPrint");
    expect(socksScript).toContain('document.querySelector("#print-btn")');
    expect(stockingScript).toContain('document.querySelector("#print-btn")');
    expect(socksScript).not.toContain("calculateBasicSockPattern");
    expect(diagram).not.toContain("stitchPlanner");
    expect(diagram).not.toContain("Print Stitch Planner");
  });
});
