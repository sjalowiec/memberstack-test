import { describe, expect, it, vi } from "vitest";
import { swatchCountFromPerInchForDisplay } from "./gaugeDisplayFormat";
import { getPatternData, savePatternData } from "./patternStorage";
import { calculateSidewaysCardiganBody } from "./sidewaysCardiganBodyCalc";
import { buildSidewaysCardiganBodyInstructions } from "./sidewaysCardiganBodyInstructions";
import {
  readSidewaysBandGauge,
  sidewaysBandGaugeFromSwatchInputs,
  renderSidewaysCardiganBandSectionHtml,
  renderSidewaysFinishingSectionHtml,
  nearestOddPositiveStitches,
  sidewaysCardiganBandMarkers,
  sidewaysCardiganBandNumbers,
  sidewaysCardiganFrontNeckOpeningInches,
  sidewaysFoldedHemCastOnSentence,
  sidewaysFoldedHemTurningNeedle,
  resolveSidewaysCardiganFoldVideo,
  SIDEWAYS_CARDIGAN_FOLD_VIDEO_CONTENT_ID,
} from "./sidewaysCardiganFinishing";
import videosPublic from "../../data/videos-public.json";
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
    expect(sweater.castOnStitches).toBe(nearestOddPositiveStitches(4 * 5));
    expect(nearestOddPositiveStitches(28)).toBe(29);
    expect(sweater.rows).toBe(inchesToRows(opening.totalInches, 7));
    const markers = sidewaysCardiganBandMarkers(opening, 7);
    expect(markers.map((marker) => marker.inches)).toEqual([
      opening.frontEdgeInches,
      opening.frontEdgeInches + opening.vSlopeInches,
      opening.totalInches - opening.frontEdgeInches - opening.vSlopeInches,
      opening.totalInches - opening.frontEdgeInches,
    ]);
    expect(markers.map((marker) => marker.rows)).toEqual(
      markers.map((marker) => inchesToRows(marker.inches, 7)),
    );
    expect(sweater.stitchGaugeSource).toBe("sweater");
    const html = renderSidewaysCardiganBandSectionHtml({
      calc: view.calc,
      stitchesPerInch: 5,
      rowsPerInch: 7,
    });
    expect(html).toContain(`Cast on ${sweater.castOnStitches} stitches`);
    expect(html).toContain(`sideways-band-counts__action">Cast on ${sweater.castOnStitches} stitches`);
    expect(html).toContain(`sideways-band-counts__action">Knit approximately ${sweater.rows} rows`);
    expect(html).toContain(
      "The following instructions use your sweater gauge (5 stitches and 7 rows per inch).",
    );
    expect(html).toContain("Cast on the stated stitches and begin knitting the strip.");
    expect(html).toContain(
      "As you knit, place markers at the stated cumulative rows. Label each one: first V-neck start, first shoulder seam, second shoulder seam, and second V-neck start.",
    );
    expect(html).toContain(
      "After reaching the approximate total row count, knit a few extra rows and scrap off the live stitches.",
    );
    expect(html).toContain(
      "Pin the band around the opening, align the four markers, adjust the fit, remove excess rows, finish the end, and sew the band in place.",
    );
    expect(html).toContain("update automatically as you enter your gauge");
    expect(html).not.toContain("Recalculate");
    expect(html.indexOf("Cast on the stated stitches")).toBeLessThan(
      html.indexOf("place markers at the stated cumulative rows"),
    );
    expect(html.indexOf("place markers at the stated cumulative rows")).toBeLessThan(
      html.indexOf("scrap off the live stitches"),
    );
    expect(html.indexOf("scrap off the live stitches")).toBeLessThan(
      html.indexOf("sew the band in place"),
    );
    const labels = ["first V-neck start", "first shoulder seam", "second shoulder seam", "second V-neck start"];
    markers.forEach((marker, index) => {
      expect(html).toContain(`${labels[index]}: approximately row ${marker.rows}`);
    });
    expect(markers[0]!.rows).toBeLessThan(markers[1]!.rows);
    expect(markers[1]!.rows).toBeLessThan(markers[2]!.rows);
    expect(markers[2]!.rows).toBeLessThan(markers[3]!.rows);
    expect(markers[3]!.rows).toBeLessThan(sweater.rows);
    expect(html).toContain(
      "Optional fold line: Before casting on, leave the center needle out of work. Keep it out of work throughout the strip.",
    );
    expect(html.indexOf("Optional fold line:")).toBeLessThan(html.indexOf("Cast on"));
    expect(html.indexOf("data-sideways-band-fold-video")).toBeLessThan(html.indexOf("<details"));
    const foldVideo = resolveSidewaysCardiganFoldVideo();
    const catalogRow = (videosPublic as Array<{ content_id?: number; title?: string; vimeo_id?: number; access_level?: string }>).find(
      (row) => row.content_id === SIDEWAYS_CARDIGAN_FOLD_VIDEO_CONTENT_ID,
    );
    expect(catalogRow?.title).toBe("Crisp, Decorative Fold");
    expect(catalogRow?.access_level).toBe("member");
    expect(foldVideo?.id).toBe(String(catalogRow?.vimeo_id));
    expect(html).toContain(`data-content-id="${SIDEWAYS_CARDIGAN_FOLD_VIDEO_CONTENT_ID}"`);
    expect(html).toContain(`data-vimeo-id="${foldVideo?.id}"`);
    expect(html).toContain("Watch: Crisp, decorative fold");
    expect(html).toContain('class="kbm-kin-catalog-video pattern-help-link__button"');
    expect(html).toContain('data-video-autoplay="false"');
    expect(html).not.toContain("about 2 inches from either edge");
    expect(html).not.toMatch(/leave needle \d+/);
    expect(html).toContain("sweater gauge");
    expect(html).toContain("Do not hang or pick up");
    expect(html).toContain("<summary>Use a different gauge for the band</summary>");
    expect(nearestOddPositiveStitches(4 * 7)).toBe(29);
    expect(html).not.toContain("Using a different gauge for your band?");
    expect(html).not.toMatch(/<details[^>]*\sopen/);
    expect(html.match(/FRONT AND NECK BAND/g)).toHaveLength(1);
  });

  it("recalculates from a distinct band gauge", () => {
    const band = sidewaysCardiganBandNumbers({
      openingInches: opening.totalInches,
      sweaterStitchesPerInch: 5,
      sweaterRowsPerInch: 7,
      bandGauge: { stitchesPerInch: 4, rowsPerInch: 6 },
    });
    expect(band.castOnStitches).toBe(nearestOddPositiveStitches(4 * 4));
    expect(band.rows).toBe(inchesToRows(opening.totalInches, 6));
    expect(band.rows).not.toBe(inchesToRows(opening.totalInches, 7));
    const markers = sidewaysCardiganBandMarkers(opening, 6);
    expect(markers.map((marker) => marker.rows)).toEqual(
      markers.map((marker) => inchesToRows(marker.inches, 6)),
    );
    expect(markers.map((marker) => marker.rows)).not.toEqual(
      sidewaysCardiganBandMarkers(opening, 7).map((marker) => marker.rows),
    );
    const html = renderSidewaysCardiganBandSectionHtml({
      calc: view.calc,
      stitchesPerInch: 5,
      rowsPerInch: 7,
      bandGauge: { stitchesPerInch: 4, rowsPerInch: 6 },
    });
    expect(html).toContain(`Cast on ${band.castOnStitches} stitches`);
    expect(html).toContain(`Knit approximately ${band.rows} rows`);
    const labels = ["first V-neck start", "first shoulder seam", "second shoulder seam", "second V-neck start"];
    markers.forEach((marker, index) => {
      expect(html).toContain(`${labels[index]}: approximately row ${marker.rows}`);
    });
    expect(markers[3]!.rows).toBeLessThan(band.rows);
    expect(html).toContain(
      "The following instructions use your band gauge (16 stitches and 24 rows per 4 inches).",
    );
    expect(html).toContain("Band stitches per 4 inches");
    expect(html).toContain("Band rows per 4 inches");
    expect(html).toContain(`value="16"`);
    expect(html).toContain(`value="24"`);
    expect(html).not.toContain("use your sweater gauge");
    expect(sidewaysBandGaugeFromSwatchInputs("16", "24", "in")).toEqual({
      stitchesPerInch: 4,
      rowsPerInch: 6,
    });
    expect(sidewaysBandGaugeFromSwatchInputs("24", "16", "in")).toEqual({
      stitchesPerInch: 6,
      rowsPerInch: 4,
    });
    expect(sidewaysBandGaugeFromSwatchInputs("16", "", "in")).toEqual({ stitchesPerInch: 4 });
    expect(sidewaysBandGaugeFromSwatchInputs("", "24", "in")).toEqual({ rowsPerInch: 6 });
    const stitchesOnly = renderSidewaysCardiganBandSectionHtml({
      calc: view.calc,
      stitchesPerInch: 5,
      rowsPerInch: 7,
      bandGauge: sidewaysBandGaugeFromSwatchInputs("16", "", "in"),
    });
    expect(stitchesOnly).toContain(`value="16"`);
    expect(stitchesOnly).not.toContain(`value="24"`);
    expect(stitchesOnly).toContain("band gauge (16 stitches per 4 inches)");
    expect(stitchesOnly).toContain("sweater gauge (7 rows per inch)");
    const rowsOnly = renderSidewaysCardiganBandSectionHtml({
      calc: view.calc,
      stitchesPerInch: 5,
      rowsPerInch: 7,
      bandGauge: sidewaysBandGaugeFromSwatchInputs("", "24", "in"),
    });
    expect(rowsOnly).toContain(`value="24"`);
    expect(rowsOnly).not.toContain(`value="16"`);
    expect(rowsOnly).toContain("band gauge (24 rows per 4 inches)");
    expect(rowsOnly).toContain("sweater gauge (5 stitches per inch)");
    const cm = renderSidewaysCardiganBandSectionHtml({
      calc: view.calc,
      stitchesPerInch: 5,
      rowsPerInch: 7,
      displayUnit: "cm",
    });
    expect(cm).toContain(`Knit approximately ${inchesToRows(opening.totalInches, 7)} rows`);
    expect(cm).toContain("use your sweater gauge (5 stitches and 7 rows per inch)");
    const cmBand = renderSidewaysCardiganBandSectionHtml({
      calc: view.calc,
      stitchesPerInch: 5,
      rowsPerInch: 7,
      bandGauge: { stitchesPerInch: 4, rowsPerInch: 6 },
      displayUnit: "cm",
    });
    const cmGauge = sidewaysBandGaugeFromSwatchInputs("16", "24", "cm");
    expect(cmGauge.stitchesPerInch).toBeCloseTo((16 / 10) * 2.54);
    expect(cmGauge.rowsPerInch).toBeCloseTo((24 / 10) * 2.54);
    expect(cmGauge.stitchesPerInch).not.toBeCloseTo(cmGauge.rowsPerInch!);
    expect(cmBand).toContain("Band stitches per 10 cm");
    expect(cmBand).toContain("Band rows per 10 cm");
    expect(cmBand).toContain(`value="${swatchCountFromPerInchForDisplay(4, "cm")}"`);
    expect(cmBand).toContain(`value="${swatchCountFromPerInchForDisplay(6, "cm")}"`);
    expect(cmBand).toContain(
      `band gauge (${swatchCountFromPerInchForDisplay(4, "cm")} stitches and ${swatchCountFromPerInchForDisplay(6, "cm")} rows per 10 cm)`,
    );
    expect(cmBand).not.toContain("per 4 inches");
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
    expect(finishing).not.toContain("Watch: Crisp, decorative fold");
    expect(finishing).toContain("If you left needle");
    const cardiganFinishing = renderSidewaysFinishingSectionHtml({
      garmentStyle: "cardigan",
      turningNeedle: 6,
    });
    expect(cardiganFinishing).toContain("Join the shoulder seams.");
    expect(cardiganFinishing).toContain("front and neck band");
    expect(cardiganFinishing).toContain("Watch: Crisp, decorative fold");
    expect(cardiganFinishing).toContain(`data-content-id="${SIDEWAYS_CARDIGAN_FOLD_VIDEO_CONTENT_ID}"`);
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
    expect(html).toContain(
      `The following instructions use your band gauge (${swatchCountFromPerInchForDisplay(4.5, "in")} stitches and ${swatchCountFromPerInchForDisplay(8, "in")} rows per 4 inches).`,
    );
    expect(html).toContain(`value="${swatchCountFromPerInchForDisplay(4.5, "in")}"`);
    expect(html).toContain(`value="${swatchCountFromPerInchForDisplay(8, "in")}"`);
    vi.unstubAllGlobals();
  });
});
