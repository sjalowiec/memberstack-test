import { describe, expect, it } from "vitest";
import { buildPatternHelpCardInnerHtml } from "./patternHelpCard";
import {
  armholeAlternateTechniquesHelpCardInnerHtml,
  carriagePositionHelpCardHtml,
  generateSleevelessBackPattern,
  necklineShoulderOrientationHelpCardInnerHtml,
} from "./sleevelessPatternOutput";
import { HEM_GLOSSARY_ID } from "./legoBlocks/hem";

describe("patternHelpCard", () => {
  it("builds collapsed details with chevron, icon, and title", () => {
    const html = buildPatternHelpCardInnerHtml({
      title: "Sample Card",
      bodyHtml: "<p>Body</p>",
    });
    expect(html).toContain('class="pattern-help-card__details"');
    expect(html).not.toContain(" open>");
    expect(html).toContain('class="pattern-help-card__chevron"');
    expect(html).toContain("fa-chevron-right");
    expect(html).toContain("fa-book-open");
    expect(html).toContain("Sample Card");
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

describe("HEM section help (glossary tooltip only, no Hem Treatment help card)", () => {
  it("puts the single Hem glossary link on the HEM section heading and renders no hem help card", () => {
    const result = generateSleevelessBackPattern({
      fit: { selectedMeasurements: baseMeasurements() },
      style: { neckline: "round", frontStyle: "closed" },
      yarnGaugeMachine: { gaugeStitchesPerInch: 5, gaugeRowsPerInch: 7, availableNeedles: 200 },
    });
    for (const rows of [result.displayRows, result.frontDisplayRows]) {
      const hemSection = rows.find((r) => r.kind === "section" && r.title === "HEM");
      expect(hemSection).toBeDefined();
      expect(hemSection?.kind === "section" ? hemSection.titleHtml : "").toContain(
        `data-glossary-id="${HEM_GLOSSARY_ID}"`,
      );
      // No hem-treatment help card is emitted anywhere in the pattern.
      const hemTip = rows.find(
        (r) => r.kind === "block" && r.tipId?.startsWith("pattern-hem"),
      );
      expect(hemTip).toBeUndefined();
      expect(rows.some((r) => r.kind === "block" && r.tipHtml?.includes("Hem Treatment"))).toBe(
        false,
      );
    }
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
