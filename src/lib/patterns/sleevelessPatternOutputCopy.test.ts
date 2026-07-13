import { describe, expect, it } from "vitest";
import {
  generateSleevelessBackPattern,
  lifelineBeforeNeckShoulderQuickTipBodyHtml,
  LIFELINE_BEFORE_DIVIDING_NECKLINE_PLAIN,
  LIFELINE_GLOSSARY_ID,
} from "./sleevelessPatternOutput";
import { sleevelessFinishingFromPattern } from "./sleevelessPatternFinishing";
import { buildSleevelessFinishingStepsHtml } from "./sleevelessPatternFinishingHtml";
import { renderSleevelessPrintPieceHtml } from "./sleevelessPatternPrintRender";

function stripHtmlToPlain(html: string): string {
  return String(html)
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

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

function gauge() {
  return {
    gaugeStitchesPerInch: 5,
    gaugeRowsPerInch: 7,
    availableNeedles: 200,
  };
}

function pulloverPattern(): Record<string, unknown> {
  return {
    fit: { selectedMeasurements: baseMeasurements() },
    style: { neckline: "round", frontStyle: "closed" },
    yarnGaugeMachine: gauge(),
  };
}

function cardiganPattern(): Record<string, unknown> {
  return {
    fit: { selectedMeasurements: baseMeasurements() },
    style: { neckline: "round", frontStyle: "open" },
    yarnGaugeMachine: gauge(),
  };
}

function collectSleevelessOutputPlainText(pattern: Record<string, unknown>): string {
  const result = generateSleevelessBackPattern(pattern);
  const finishing = sleevelessFinishingFromPattern(pattern, result.debug);
  const finishingHtml = buildSleevelessFinishingStepsHtml({
    isCardigan: finishing.isCardigan,
    cardiganFrontEdgeFinishingMode: finishing.cardiganFrontEdgeFinishingMode,
    frontEdgePickupSts: finishing.frontEdgePickupSts,
    deps: {
      escapeHtml: (s: string) => s,
      glossaryTooltip: (_id: number, term: string) => term,
      neckFinishingVideoKey: "onePieceBand",
      neckFinishingButtonLabel: "One-piece neckband",
      neckFinishingLeadHtml: "",
    },
  });

  const backPrint = renderSleevelessPrintPieceHtml(result.displayRows ?? [], "");
  const frontPrint = renderSleevelessPrintPieceHtml(result.frontDisplayRows ?? [], "");

  return stripHtmlToPlain(`${backPrint} ${frontPrint} ${finishingHtml}`);
}

describe("sleeveless pattern output copy (print-safe)", () => {
  const patterns = [
    { label: "pullover", pattern: pulloverPattern() },
    { label: "round-neck cardigan", pattern: cardiganPattern() },
  ];

  for (const { label, pattern } of patterns) {
    it(`${label}: no broken hem, lifeline, or finishing fragments`, () => {
      const plain = collectSleevelessOutputPlainText(pattern);
      expect(plain).toContain("Lightly steam your pieces to measurements.");
      expect(plain).not.toMatch(/steam or pieces to measurements/i);
      expect(plain).not.toMatch(/or ,/);
      expect(plain).not.toMatch(/adding a \./);
      expect(plain).not.toMatch(/Knit 1 \./);
      expect(plain).not.toMatch(/on the and stitch/);
    });
  }

  it("includes the lifeline reminder in neckline-section written instructions", () => {
    const plain = collectSleevelessOutputPlainText(pulloverPattern());
    expect(plain).toContain(LIFELINE_BEFORE_DIVIDING_NECKLINE_PLAIN);
    expect(plain).not.toContain(
      "Before starting the neckline and shoulder shaping, consider adding a lifeline or waste yarn row.",
    );
    const result = generateSleevelessBackPattern(pulloverPattern());
    const lifelineRow = [...result.displayRows, ...result.frontDisplayRows].find(
      (r) => r.kind === "block" && r.tipId === "sleeveless-lifeline-neck-shoulder",
    );
    expect(lifelineRow).toBeUndefined();
  });

  it("lifeline glossary placeholder builder still links lifeline only (popup behavior preserved)", () => {
    expect(lifelineBeforeNeckShoulderQuickTipBodyHtml()).toContain(
      `data-glossary-id="${LIFELINE_GLOSSARY_ID}"`,
    );
    expect(lifelineBeforeNeckShoulderQuickTipBodyHtml()).toContain('data-term="lifeline"');
  });

  it("round-neck cardigan includes fold band on turning row instruction", () => {
    const plain = collectSleevelessOutputPlainText(cardiganPattern());
    expect(plain).toContain("Fold the band on the turning row and stitch it down.");
    expect(plain).toContain("Knit 1 turning row.");
  });

  it("shows the HEM heading with no Hem Treatment help card copy", () => {
    const plain = collectSleevelessOutputPlainText(pulloverPattern());
    expect(plain).toContain("HEM");
    expect(plain).not.toContain("RIBBED HEM");
    // The Hem Treatment help card was removed; only the HEM glossary heading remains.
    expect(plain).not.toContain("Hem Treatment");
    expect(plain).not.toContain("Work even in your chosen hem treatment");
    expect(plain).not.toContain("typically require double the hem depth");
  });
});
