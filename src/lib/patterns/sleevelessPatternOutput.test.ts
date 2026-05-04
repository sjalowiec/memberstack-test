import { describe, expect, it } from "vitest";
import { generateSleevelessBackPattern } from "./sleevelessPatternOutput";

describe("sleevelessPatternOutput RC progression", () => {
  it("armhole starts at hemRows + bodyRows (no transition offset)", () => {
    const patternData: Record<string, unknown> = {
      fit: {
        sizingChart: "misses",
        selectedMeasurements: {
          finished_bust_chest: 40,
          back_neck_to_hem: 22,
          armhole_depth: 8,
          neck_opening: 6,
          shoulder_width: 4.25,
          back_neck_depth: 1,
        },
      },
      style: { recipientCategory: "misses" },
      yarnGaugeMachine: {
        gaugeStitchesPerInch: 5,
        gaugeRowsPerInch: 7,
        availableNeedles: 200,
      },
    };
    const result = generateSleevelessBackPattern(patternData);
    const rows = result.displayRows.filter((r) => r.kind === "block") as Array<
      Extract<(typeof result.displayRows)[number], { kind: "block" }>
    >;

    const hemRows = result.debug.hemRows;
    const bodyRows = result.debug.bodyRows;
    const expectedArmhole = hemRows + bodyRows;

    const firstArmhole = rows.find(
      (b) => b.rc && b.paragraphs.some((p) => p.includes("Begin armhole shaping"))
    );
    expect(firstArmhole?.rc).toBe(`RC:${String(expectedArmhole).padStart(3, "0")}`);

    const neckSectionIdx = result.displayRows.findIndex(
      (r) => r.kind === "section" && r.title === "BACK NECKLINE & SHOULDERS",
    );
    expect(neckSectionIdx).toBeGreaterThanOrEqual(0);
    const neckBlock = result.displayRows[neckSectionIdx + 1];
    expect(neckBlock?.kind).toBe("block");
    if (neckBlock?.kind === "block") {
      const joined = neckBlock.paragraphs.join("\n");
      expect(joined).toMatch(/^Bind off center \d+ stitches?\./m);
      expect(joined).toContain("left and");
      expect(joined).toContain("right shoulder stitches");
      expect(joined).toContain("Follow the chart and diagram below");
    }
  });
});
