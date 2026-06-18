import { describe, expect, it } from "vitest";
import { PLACE_MARKER_GLOSSARY_ID } from "../glossary/glossaryTooltipPrint";
import { generateDropShoulderPattern } from "./dropShoulderPatternOutput";
import type { SleevelessPatternDisplayRow } from "./sleevelessPatternOutput";

const DROP_SHOULDER_PATTERN = {
  fit: {
    sizingChart: "women",
    selectedMeasurements: {
      finished_bust_chest: 40,
      back_neck_to_hem: 24,
      upper_arm: 16,
      wrist: 8,
      sleeve_length: 12,
      shoulder_width: 16,
      neck_opening: 7,
      back_neck_depth: 1,
      front_neck_depth: 4,
    },
  },
  yarnGaugeMachine: {
    gaugeStitchesPerInch: 5,
    gaugeRowsPerInch: 7,
    availableNeedles: 200,
  },
  style: {
    construction: "drop-shoulder",
    frontStyle: "closed",
    neckline: "round",
  },
};

function markerPlacementBlocks(rows: SleevelessPatternDisplayRow[]) {
  return rows.filter(
    (row): row is Extract<SleevelessPatternDisplayRow, { kind: "block" }> =>
      row.kind === "block" &&
      (row.paragraphs?.some((p) => /^Place a marker/i.test(p)) ||
        row.trustedParagraphs?.some((p) => /Place a marker/i.test(p))),
  );
}

describe("generateDropShoulderPattern marker placement glossary links", () => {
  it("links Place a marker inline in every marker-placement instruction (no duplicate helper line)", () => {
    const result = generateDropShoulderPattern(DROP_SHOULDER_PATTERN);
    const blocks = markerPlacementBlocks([
      ...result.displayRows,
      ...result.frontDisplayRows,
    ]);

    expect(blocks.length).toBe(2);
    for (const block of blocks) {
      expect(block.paragraphs?.[0]).toMatch(/^Place a marker at each end/i);
      const trusted = block.trustedParagraphs ?? [];
      expect(trusted.length).toBe(block.paragraphs?.length);
      expect(trusted[0]).toContain("glossary-tooltip-placeholder");
      expect(trusted[0]).toContain(`data-glossary-id="${PLACE_MARKER_GLOSSARY_ID}"`);
      expect(trusted[0]).toContain('data-term="Place a marker"');
      expect(trusted[0]).toContain("at each end of this row");
      expect(trusted.some((p) => p.includes("pattern-instruction-glossary-helper"))).toBe(false);
      expect(trusted.filter((p) => p.includes("Place a marker")).length).toBe(1);
    }
  });

  it("links cardigan half-front side-edge marker placement inline", () => {
    const cardiganPattern = {
      ...DROP_SHOULDER_PATTERN,
      style: { ...DROP_SHOULDER_PATTERN.style, frontStyle: "open" },
    };
    const result = generateDropShoulderPattern(cardiganPattern);
    const blocks = markerPlacementBlocks([
      ...result.displayRows,
      ...result.frontDisplayRows,
    ]);

    expect(blocks.length).toBe(2);
    const frontBlock = blocks.find((b) =>
      b.paragraphs?.[0]?.includes("side edge"),
    );
    expect(frontBlock).toBeDefined();
    expect(frontBlock!.paragraphs?.[0]).toBe(
      "Place a marker at the side edge to mark the base of the armhole.",
    );
    const trustedLine = frontBlock!.trustedParagraphs?.[0] ?? "";
    expect(trustedLine).toContain(`data-glossary-id="${PLACE_MARKER_GLOSSARY_ID}"`);
    expect(trustedLine).toContain("side edge");
    expect(frontBlock!.trustedParagraphs?.length).toBe(frontBlock!.paragraphs?.length);
  });
});
