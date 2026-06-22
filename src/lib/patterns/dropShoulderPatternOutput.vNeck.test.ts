import { describe, expect, it } from "vitest";
import { generateDropShoulderPattern } from "./dropShoulderPatternOutput";
import { neckDecreaseStitchesPerSideFromOpening } from "./legoBlocks/vNeckline";
import { evenShapingSchedule } from "./evenShapingSchedule";
import type { SleevelessPatternDisplayRow } from "./sleevelessPatternOutput";
import { renderSleevelessPrintPieceHtml } from "./sleevelessPatternPrintRender";

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
  it("pullover V-neck: clarifies hold, one shoulder at a time, and even rows before bind-off without changing math", () => {
    const pattern = {
      ...DROP_SHOULDER_PATTERN,
      style: { ...DROP_SHOULDER_PATTERN.style, neckline: "v" },
    };
    const result = generateDropShoulderPattern(pattern);
    const text = frontBlockParagraphs(result.frontDisplayRows).join("\n");

    const {
      backStitches,
      necklineStitches,
      shoulderStitches,
      totalCalculatedRows,
      finalRC,
      frontNecklineStartRC,
      frontNeckDepthRows,
    } = result.debug;

    expect(result.isDropShoulder).toBe(true);
    expect(backStitches).toBe(100);
    expect(necklineStitches).toBe(36);
    expect(shoulderStitches).toBe(32);
    expect(totalCalculatedRows).toBe(168);
    expect(finalRC).toBe(168);
    expect(frontNecklineStartRC).toBe(140);
    expect(frontNeckDepthRows).toBe(28);

    const perSide = neckDecreaseStitchesPerSideFromOpening(necklineStitches!);
    expect(perSide).toBe(18);
    const sched = evenShapingSchedule(perSide, frontNeckDepthRows!);

    expect(text).toMatch(/divide for the V-neck at the center\./);
    expect(text).not.toMatch(/divide for the V-neck at the center\. Work each side separately/i);
    expect(text).toMatch(/Place the opposite shoulder stitches on hold/i);
    expect(text).toMatch(/Work one shoulder at a time/i);
    expect(text).toMatch(
      new RegExp(
        `At the neck edge, decrease 1 stitch .+ ${sched.count} time${sched.count === 1 ? "" : "s"} \\(${perSide} stitches removed per side\\)`,
      ),
    );
    expect(text).toMatch(
      /When neckline shaping is complete and 32 stitches remain on the working shoulder, knit even to RC:168 \(no further neck-edge decreases\)/,
    );
    expect(text).toMatch(/Bind off the 32 shoulder stitches\./);
    expect(text).toMatch(/Return the held shoulder stitches to the needles/i);
    expect(text).toMatch(/repeat the V-neck shaping for the second shoulder, mirroring the first side/i);

    expect(text).not.toMatch(/stitches remain on the side, knit even/i);
    expect(text).not.toMatch(/Work the second side to match, reversing the neck-edge shaping/i);

    const printHtml = renderSleevelessPrintPieceHtml(result.frontDisplayRows, "", "front");
    expect(printHtml).toMatch(/Place the opposite shoulder stitches on hold/i);
    expect(printHtml).toMatch(/\(no further neck-edge decreases\)/);
    expect(printHtml).toMatch(/repeat the V-neck shaping for the second shoulder, mirroring the first side/i);
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
