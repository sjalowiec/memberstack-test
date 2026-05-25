import { describe, expect, it } from "vitest";
import { buildPatternHelpCardInnerHtml } from "./patternHelpCard";
import {
  armholeAlternateTechniquesHelpCardInnerHtml,
  carriagePositionHelpCardHtml,
  generateSleevelessBackPattern,
  MOCK_RIB_HEM_GLOSSARY_ID,
  necklineShoulderOrientationHelpCardInnerHtml,
  ribbedHemTipDisplayRow,
} from "./sleevelessPatternOutput";

describe("patternHelpCard", () => {
  it("builds collapsed details with chevron, icon, and title", () => {
    const html = buildPatternHelpCardInnerHtml({
      title: "Hem Treatment",
      bodyHtml: "<p>Body</p>",
    });
    expect(html).toContain('class="pattern-help-card__details"');
    expect(html).not.toContain(" open>");
    expect(html).toContain('class="pattern-help-card__chevron"');
    expect(html).toContain("fa-chevron-right");
    expect(html).toContain("fa-book-open");
    expect(html).toContain("Hem Treatment");
    expect(html).toContain("<p>Body</p>");
  });

  it("supports defaultOpen and no icon", () => {
    const html = buildPatternHelpCardInnerHtml({
      title: "Open card",
      bodyHtml: "<p>x</p>",
      icon: false,
      defaultOpen: true,
    });
    expect(html).toContain('class="pattern-help-card__details" open>');
    expect(html).not.toContain("fa-book-open");
  });
});

describe("sleeveless shaping Help Cards (Pass 3)", () => {
  it("neckline orientation and carriage position use Help Card without header icon", () => {
    expect(necklineShoulderOrientationHelpCardInnerHtml()).toContain("pattern-help-card__details");
    expect(necklineShoulderOrientationHelpCardInnerHtml()).toContain(
      "Understanding Left, Right & Diagram Orientation",
    );
    expect(necklineShoulderOrientationHelpCardInnerHtml()).not.toContain("fa-book-open");
    expect(carriagePositionHelpCardHtml()).toContain("pattern-help-card__details");
    expect(carriagePositionHelpCardHtml()).toContain('data-tip-id="sleeveless-carriage-position"');
    expect(carriagePositionHelpCardHtml()).toContain("no-print");
  });

  it("neckline summary blocks use orientation Help Card", () => {
    const result = generateSleevelessBackPattern({
      fit: {
        sizingChart: "misses",
        selectedMeasurements: {
          finished_bust_chest: 40,
          back_neck_to_hem: 22,
          armhole_depth: 8,
          neck_opening: 3,
          shoulder_width: 4.25,
          front_neck_depth: 3,
          back_neck_depth: 1,
        },
      },
      style: { recipientCategory: "misses", neckline: "round" },
      yarnGaugeMachine: { gaugeStitchesPerInch: 5, gaugeRowsPerInch: 7, availableNeedles: 200 },
    });
    const orientationRow = result.displayRows.find(
      (r) => r.kind === "block" && r.tipId === "sleeveless-neckline-orientation",
    );
    expect(orientationRow?.tipPresentation).toBe("help-card");
    expect(orientationRow?.tipHtml).toContain("pattern-help-card__details");
  });
});

describe("armholeAlternateTechniquesHelpCardInnerHtml", () => {
  it("uses Help Card without header icon", () => {
    const html = armholeAlternateTechniquesHelpCardInnerHtml();
    expect(html).toContain("pattern-help-card__details");
    expect(html).toContain("Armhole shaping options");
    expect(html).not.toContain("fa-book-open");
    expect(html).toContain("Bind Off Trick");
  });
});

describe("ribbedHemTipDisplayRow", () => {
  it("uses Help Card presentation with glossary placeholders and no header icon", () => {
    for (const piece of ["front", "back"] as const) {
      const row = ribbedHemTipDisplayRow(piece);
      expect(row.tipPresentation).toBe("help-card");
      expect(row.tipHtml).toContain("pattern-help-card__details");
      expect(row.tipHtml).toContain("pattern-help-card__chevron");
      expect(row.tipHtml).toContain("Hem Treatment");
      expect(row.tipHtml).not.toContain("fa-book-open");
      expect(row.tipHtml).toContain(`data-glossary-id="${MOCK_RIB_HEM_GLOSSARY_ID}"`);
      expect(row.tipId).toBe(`sleeveless-ribbed-hem-${piece}`);
    }
  });

  it("generated pattern includes hem help card on back and front", () => {
    const result = generateSleevelessBackPattern({
      fit: { selectedMeasurements: baseMeasurements() },
      style: { neckline: "round", frontStyle: "closed" },
      yarnGaugeMachine: { gaugeStitchesPerInch: 5, gaugeRowsPerInch: 7, availableNeedles: 200 },
    });
    const frontHem = result.frontDisplayRows.find(
      (r) => r.kind === "block" && r.tipId === "sleeveless-ribbed-hem-front",
    );
    const backHem = result.displayRows.find(
      (r) => r.kind === "block" && r.tipId === "sleeveless-ribbed-hem-back",
    );
    expect(frontHem?.tipPresentation).toBe("help-card");
    expect(backHem?.tipPresentation).toBe("help-card");
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
