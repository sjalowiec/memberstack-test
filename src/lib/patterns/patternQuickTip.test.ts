import { describe, expect, it } from "vitest";
import { buildPatternQuickTipInnerHtml } from "./patternQuickTip";
import {
  castOnMethodQuickTipInnerHtml,
  generateSleevelessBackPattern,
  lifelineBeforeNeckShoulderQuickTipInnerHtml,
  pieceMarkersSeamingTipDisplayRow,
} from "./sleevelessPatternOutput";
import { renderSleevelessPrintPieceHtml } from "./sleevelessPatternPrintRender";

describe("patternQuickTip", () => {
  it("builds details markup with left chevron and light bulb", () => {
    const html = buildPatternQuickTipInnerHtml({
      summaryLabel: "Test tip",
      bodyHtml: "<p>Body</p>",
    });
    expect(html).toContain('class="pattern-quick-tip__details"');
    expect(html).toContain('class="pattern-quick-tip__chevron"');
    expect(html).toContain("fa-chevron-right");
    expect(html).toContain("fa-lightbulb");
    expect(html).toContain("Test tip");
    expect(html).toContain("<p>Body</p>");
  });
});

describe("sleeveless quick tips", () => {
  it("cast-on and lifeline use Quick Tip inner markup", () => {
    expect(castOnMethodQuickTipInnerHtml()).toContain("pattern-quick-tip__details");
    expect(lifelineBeforeNeckShoulderQuickTipInnerHtml()).toContain("pattern-quick-tip__details");
    expect(lifelineBeforeNeckShoulderQuickTipInnerHtml()).toContain("Lifeline before neckline shaping");
  });
});

describe("pieceMarkersSeamingTipDisplayRow", () => {
  it("uses Quick Tip on back and front with distinct tip ids", () => {
    for (const piece of ["front", "back"] as const) {
      const row = pieceMarkersSeamingTipDisplayRow(piece);
      expect(row.tipPresentation).toBe("quick-tip");
      expect(row.tipHtml).toContain("pattern-quick-tip__details");
      expect(row.tipHtml).toContain("pattern-quick-tip__chevron");
      expect(row.tipId).toBe(`sleeveless-piece-markers-${piece}`);
    }
  });

  it("generated pattern includes quick tip on back and front piece rows", () => {
    const result = generateSleevelessBackPattern({
      fit: { selectedMeasurements: baseMeasurements() },
      style: { neckline: "round", frontStyle: "closed" },
      yarnGaugeMachine: { gaugeStitchesPerInch: 5, gaugeRowsPerInch: 7, availableNeedles: 200 },
    });
    const frontMarker = result.frontDisplayRows.find(
      (r) => r.kind === "block" && r.tipId === "sleeveless-piece-markers-front",
    );
    const backMarker = result.displayRows.find(
      (r) => r.kind === "block" && r.tipId === "sleeveless-piece-markers-back",
    );
    expect(frontMarker?.tipPresentation).toBe("quick-tip");
    expect(backMarker?.tipPresentation).toBe("quick-tip");
  });

  it("places marker quick tip at top of back and front and includes it in print", () => {
    const result = generateSleevelessBackPattern({
      fit: { selectedMeasurements: baseMeasurements() },
      style: { neckline: "round", frontStyle: "closed" },
      yarnGaugeMachine: { gaugeStitchesPerInch: 5, gaugeRowsPerInch: 7, availableNeedles: 200 },
    });

    const backPieceIdx = result.displayRows.findIndex((r) => r.kind === "piece" && r.title === "BACK");
    const frontPieceIdx = result.frontDisplayRows.findIndex(
      (r) => r.kind === "piece" && (r.title === "FRONT" || r.title === "LEFT FRONT"),
    );
    expect(backPieceIdx).toBeGreaterThanOrEqual(0);
    expect(frontPieceIdx).toBeGreaterThanOrEqual(0);

    expect(result.displayRows[backPieceIdx + 1]).toMatchObject({
      kind: "block",
      tipId: "sleeveless-piece-markers-back",
      tipPresentation: "quick-tip",
      tipHtmlIsFull: true,
    });
    expect(result.frontDisplayRows[frontPieceIdx + 1]).toMatchObject({
      kind: "block",
      tipId: "sleeveless-piece-markers-front",
      tipPresentation: "quick-tip",
      tipHtmlIsFull: true,
    });

    const backPrint = renderSleevelessPrintPieceHtml(result.displayRows, "");
    const frontPrint = renderSleevelessPrintPieceHtml(result.frontDisplayRows, "");
    for (const html of [backPrint, frontPrint]) {
      expect(html).toContain('data-tip-id="sleeveless-piece-markers-');
      expect(html).toContain("pattern-quick-tip__details");
      expect(html).toContain("Add markers for easier seaming");
      expect(html).toContain("pattern-quick-tip__label");
    }
    expect(backPrint).toContain('data-tip-id="sleeveless-piece-markers-back"');
    expect(frontPrint).toContain('data-tip-id="sleeveless-piece-markers-front"');
  });
});

function baseMeasurements() {
  return {
    finished_bust_chest: 40,
    back_neck_to_hem: 22,
    armhole_depth: 8,
    neck_opening: 3,
    shoulder_width: 4.25,
    front_neck_depth: 3,
    back_neck_depth: 1,
  };
}
