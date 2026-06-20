import { describe, expect, it } from "vitest";
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

function frontBlockParagraphs(rows: SleevelessPatternDisplayRow[]): string[] {
  return rows
    .filter(
      (row): row is Extract<SleevelessPatternDisplayRow, { kind: "block" }> => row.kind === "block",
    )
    .flatMap((row) => row.paragraphs ?? []);
}

describe("generateDropShoulderPattern V-neck front instructions", () => {
  it("generates pullover V-neck front instructions with neck-edge decreases", () => {
    const pattern = {
      ...DROP_SHOULDER_PATTERN,
      style: { ...DROP_SHOULDER_PATTERN.style, neckline: "v" },
    };
    const result = generateDropShoulderPattern(pattern);

    expect(result.isDropShoulder).toBe(true);
    expect(result.frontDisplayRows.length).toBeGreaterThan(0);
    expect(result.sleeveDisplayRows.length).toBeGreaterThan(0);

    const text = frontBlockParagraphs(result.frontDisplayRows).join("\n");
    expect(text).toMatch(/divide for the V-neck/i);
    expect(text).toMatch(/decrease 1 stitch/i);
    expect(text).toMatch(/stitches removed per side/i);
  });

  it("generates cardigan V-neck front instructions with center-front decreases", () => {
    const pattern = {
      ...DROP_SHOULDER_PATTERN,
      style: { ...DROP_SHOULDER_PATTERN.style, neckline: "v", frontStyle: "open" },
    };
    const result = generateDropShoulderPattern(pattern);

    expect(result.isDropShoulder).toBe(true);
    expect(result.frontDisplayRows.length).toBeGreaterThan(0);

    const text = frontBlockParagraphs(result.frontDisplayRows).join("\n");
    expect(text).toMatch(/V-neck shaping/i);
    expect(text).toMatch(/Decrease 1 stitch at the center-front \(neck\) edge/i);
    expect(text).toMatch(/stitches removed/i);
  });
});
