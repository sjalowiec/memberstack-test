import { describe, expect, it, vi } from "vitest";
import { getPatternData, savePatternData } from "./patternStorage";
import { calculateSidewaysCardiganBody } from "./sidewaysCardiganBodyCalc";
import { buildSidewaysCardiganBodyInstructions } from "./sidewaysCardiganBodyInstructions";
import {
  readSidewaysBandGauge,
  renderSidewaysCardiganBandSectionHtml,
  renderSidewaysFinishingSectionHtml,
  sidewaysCardiganBandNumbers,
  sidewaysCardiganFrontNeckOpeningInches,
  sidewaysFoldedHemCastOnSentence,
  sidewaysFoldedHemTurningNeedle,
} from "./sidewaysCardiganFinishing";
import {
  buildSidewaysCardiganBodyDisplayRows,
  renderSidewaysCardiganBodyDisplayHtml,
} from "./sidewaysCardiganPatternOutput";
import { renderSleevelessPrintPieceHtml } from "./sleevelessPatternPrintRender";
import { evenPositiveBodyStitches } from "./sleevelessBodyStitchMath";
import { inchesToRows } from "./sleevelessRowAccounting";

const INPUT = {
  garmentLengthInches: 22,
  vNeckDepthInches: 8,
  finishedBustCircumferenceInches: 40,
  finishedUpperArmInches: 14,
  neckOpeningWidthInches: 7,
  backNeckDepthInches: 1,
  stitchesPerInch: 5,
  rowsPerInch: 7,
};

function cardigan() {
  const calc = calculateSidewaysCardiganBody(INPUT);
  expect(calc.ok).toBe(true);
  if (!calc.ok) throw new Error(calc.error.message);
  const body = buildSidewaysCardiganBodyInstructions(INPUT, "cardigan");
  expect(body.ok).toBe(true);
  if (!body.ok) throw new Error(body.error.message);
  return { calc: calc.calc, instructions: body.instructions };
}

describe("sideways folded hem and cardigan band", () => {
  const view = cardigan();
  const opening = sidewaysCardiganFrontNeckOpeningInches({
    calc: view.calc,
    stitchesPerInch: INPUT.stitchesPerInch,
    rowsPerInch: INPUT.rowsPerInch,
  });

  it("places the body turning needle with even stitch rounding", () => {
    const needle = sidewaysFoldedHemTurningNeedle(INPUT.stitchesPerInch);
    expect(needle).toBe(evenPositiveBodyStitches(INPUT.stitchesPerInch));
    const html = renderSidewaysCardiganBodyDisplayHtml(view.instructions, INPUT.stitchesPerInch);
    const print = renderSleevelessPrintPieceHtml(
      buildSidewaysCardiganBodyDisplayRows(view.instructions, INPUT.stitchesPerInch),
      "",
      "body",
    );
    expect(print).toContain(sidewaysFoldedHemCastOnSentence(needle));
    expect(html).toContain(sidewaysFoldedHemCastOnSentence(needle));
    expect(html).toContain("about 1 inch from the hem edge");
    expect(html).not.toContain("FRONT AND NECK BAND");
  });

  it("uses the knitted front and neck opening, not the bust", () => {
    expect(opening.totalInches).not.toBe(INPUT.finishedBustCircumferenceInches);
    expect(opening.totalInches).not.toBe(INPUT.garmentLengthInches);
    expect(opening.frontEdgeInches).toBeCloseTo(
      (view.calc.garmentLengthStitches - view.calc.vNeckDepthStitches) / INPUT.stitchesPerInch,
    );
    const sweater = sidewaysCardiganBandNumbers({
      openingInches: opening.totalInches,
      sweaterStitchesPerInch: 5,
      sweaterRowsPerInch: 7,
    });
    expect(sweater.castOnStitches).toBe(evenPositiveBodyStitches(4 * 5));
    expect(sweater.rows).toBe(inchesToRows(opening.totalInches, 7));
    expect(sweater.stitchGaugeSource).toBe("sweater");
    const html = renderSidewaysCardiganBandSectionHtml({
      calc: view.calc,
      stitchesPerInch: 5,
      rowsPerInch: 7,
    });
    expect(html).toContain(`Cast on ${sweater.castOnStitches} stitches`);
    expect(html).toContain(`Knit ${sweater.rows} rows`);
    expect(html).toContain("sweater gauge");
    expect(html).toContain("Do not hang or pick up");
    expect(html).toContain("Using a different gauge for your band?");
    expect(html.match(/FRONT AND NECK BAND/g)).toHaveLength(1);
  });

  it("recalculates from a distinct band gauge", () => {
    const band = sidewaysCardiganBandNumbers({
      openingInches: opening.totalInches,
      sweaterStitchesPerInch: 5,
      sweaterRowsPerInch: 7,
      bandGauge: { stitchesPerInch: 4, rowsPerInch: 6 },
    });
    expect(band.castOnStitches).toBe(evenPositiveBodyStitches(4 * 4));
    expect(band.rows).toBe(inchesToRows(opening.totalInches, 6));
    expect(band.rows).not.toBe(inchesToRows(opening.totalInches, 7));
    const html = renderSidewaysCardiganBandSectionHtml({
      calc: view.calc,
      stitchesPerInch: 5,
      rowsPerInch: 7,
      bandGauge: { stitchesPerInch: 4, rowsPerInch: 6 },
    });
    expect(html).toContain("band stitch gauge (4 stitches per inch)");
    expect(html).toContain("band row gauge (6 rows per inch)");
    expect(html).toContain(`value="4"`);
    expect(html).toContain(`value="6"`);
    expect(readSidewaysBandGauge({ sidewaysBandStitchesPerInch: 4, sidewaysBandRowsPerInch: 6 })).toEqual({
      stitchesPerInch: 4,
      rowsPerInch: 6,
    });
    expect(readSidewaysBandGauge({})).toEqual({});
  });

  it("keeps pullover finishing free of the cardigan band", () => {
    const pullover = buildSidewaysCardiganBodyInstructions(INPUT, "pullover");
    expect(pullover.ok).toBe(true);
    if (!pullover.ok) throw new Error(pullover.error.message);
    const finishing = renderSidewaysFinishingSectionHtml({
      garmentStyle: "pullover",
      turningNeedle: sidewaysFoldedHemTurningNeedle(5),
    });
    expect(finishing).toContain("does not need a separate neck band");
    expect(finishing).not.toContain("front and neck band");
    expect(finishing).toContain("If you left needle");
    const cardiganFinishing = renderSidewaysFinishingSectionHtml({
      garmentStyle: "cardigan",
      turningNeedle: 6,
    });
    expect(cardiganFinishing).toContain("Join the shoulder seams.");
    expect(cardiganFinishing).toContain("front and neck band");
    expect(cardiganFinishing).toContain("Join the sleeve seams.");
    expect(cardiganFinishing.indexOf("Block")).toBeLessThan(cardiganFinishing.indexOf("shoulder"));
    expect(cardiganFinishing.indexOf("shoulder")).toBeLessThan(cardiganFinishing.indexOf("turning line"));
    expect(cardiganFinishing.indexOf("front and neck band")).toBeLessThan(
      cardiganFinishing.indexOf("sleeve seams"),
    );
    expect(pullover.instructions.calc.garmentLengthStitches).toBe(view.calc.garmentLengthStitches);
  });

  it("reloads a saved band gauge from the pattern style", () => {
    const store = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value);
      },
      removeItem: (key: string) => {
        store.delete(key);
      },
    });
    savePatternData("style", {
      construction: "sideways-cardigan",
      sidewaysBandStitchesPerInch: 4.5,
      sidewaysBandRowsPerInch: 8,
    });
    const style = (getPatternData().style ?? {}) as Record<string, unknown>;
    expect(readSidewaysBandGauge(style)).toEqual({ stitchesPerInch: 4.5, rowsPerInch: 8 });
    const html = renderSidewaysCardiganBandSectionHtml({
      calc: view.calc,
      stitchesPerInch: 5,
      rowsPerInch: 7,
      bandGauge: readSidewaysBandGauge(style),
    });
    expect(html).toContain("band stitch gauge (4.5 stitches per inch)");
    expect(html).toContain("band row gauge (8 rows per inch)");
    vi.unstubAllGlobals();
  });
});
