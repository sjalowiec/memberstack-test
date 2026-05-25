import { describe, expect, it } from "vitest";
import {
  generateSleevelessBackPattern,
  lifelineBeforeNeckShoulderQuickTipBodyHtml,
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

  it("includes lifeline or waste yarn row guidance", () => {
    const plain = collectSleevelessOutputPlainText(pulloverPattern());
    expect(plain).toContain(
      "Before starting the neckline and shoulder shaping, consider adding a lifeline or waste yarn row. It gives you a safe place to rip back to if you make a mistake during shaping.",
    );
  });

  it("lifeline tip uses glossary placeholder on lifeline only", () => {
    expect(lifelineBeforeNeckShoulderQuickTipBodyHtml()).toContain(
      `data-glossary-id="${LIFELINE_GLOSSARY_ID}"`,
    );
    expect(lifelineBeforeNeckShoulderQuickTipBodyHtml()).toContain('data-term="lifeline"');
    const result = generateSleevelessBackPattern(pulloverPattern());
    const lifelineRow = [...result.displayRows, ...result.frontDisplayRows].find(
      (r) => r.kind === "block" && r.tipId === "sleeveless-lifeline-neck-shoulder",
    );
    expect(lifelineRow?.tipPresentation).toBe("quick-tip");
    expect(lifelineRow?.tipHtml).toContain(`data-glossary-id="${LIFELINE_GLOSSARY_ID}"`);
  });

  it("round-neck cardigan includes fold band on turning row instruction", () => {
    const plain = collectSleevelessOutputPlainText(cardiganPattern());
    expect(plain).toContain("Fold the band on the turning row and stitch it down.");
    expect(plain).toContain("Knit 1 turning row.");
  });

  it("includes readable hem treatment options", () => {
    const plain = collectSleevelessOutputPlainText(pulloverPattern());
    expect(plain).toContain(
      "a rolled stockinette edge, or a fold-up band — for the depth shown.",
    );
  });
});
