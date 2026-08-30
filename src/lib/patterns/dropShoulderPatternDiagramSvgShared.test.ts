import { describe, expect, it } from "vitest";
import { generateDropShoulderPattern } from "./dropShoulderPatternOutput";
import { generateSleevelessBackPattern } from "./sleevelessPatternOutput";
import { kids10YrRelaxedArmhole36Pattern } from "./dropShoulderDiagramReviewFixtures";
import {
  buildDropShoulderBackStitchesRowsModel,
  buildDropShoulderFrontStitchesRowsModel,
} from "./dropShoulderPatternDiagramModel";
import { tryBuildLiveDropShoulderBackStsRowsDiagramSvg } from "./dropShoulderBackPatternDiagramSvg";
import { tryBuildLiveDropShoulderFrontStsRowsDiagramSvg } from "./dropShoulderFrontPatternDiagramSvg";
import { tryBuildLiveDropShoulderFrontNotationSvg } from "./dropShoulderFrontShapingNotationDiagramSvg";
import {
  buildDropShoulderFrontFullWidthFrame,
  buildFullWidthFrame,
  dropShoulderFrontPulloverRoundBodyPath,
  dropShoulderPulloverRoundBodyPath,
  endCap,
  type DropShoulderDiagramSectionCounts,
} from "./dropShoulderPatternDiagramSvgShared";

const WOMEN_STRAIGHT = {
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

function counts(overrides: Partial<DropShoulderDiagramSectionCounts>): DropShoulderDiagramSectionCounts {
  return {
    hemRows: 14,
    bodyRowsToArmhole: 80,
    armholeRows: 40,
    necklineRowsInsideArmhole: 8,
    hemStitches: 100,
    bodyWidthStitches: 100,
    crossShoulderStitches: 100,
    necklineStitches: 36,
    ...overrides,
  };
}

function linePoints(d: string): Array<{ x: number; y: number }> {
  const pts: Array<{ x: number; y: number }> = [];
  const re = /[ML]\s*([-\d.]+)\s+([-\d.]+)/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(d))) {
    pts.push({ x: Number(match[1]), y: Number(match[2]) });
  }
  return pts;
}

function pathD(svg: string, className: string): string {
  const re = new RegExp(`class="${className}"[^>]*\\sd="([^"]+)"`);
  return re.exec(svg)?.[1] ?? "";
}

function markerGroup(svg: string): string {
  const re = /<g class="ds-diagram__armhole-marker"[^>]*>[\s\S]*?<\/g>/;
  return re.exec(svg)?.[0] ?? "";
}

function dimGroup(svg: string, className: string): string {
  const re = new RegExp(`<g class="${className}"[\\s\\S]*?</g>`);
  return re.exec(svg)?.[0] ?? "";
}

function assertVerticalArmholeBand(d: string, frame: ReturnType<typeof buildFullWidthFrame>) {
  const pts = linePoints(d);
  expect(pts.length).toBeGreaterThanOrEqual(3);
  const hem = pts[0]!;
  const atMarker = pts[1]!;
  const atShoulder = pts[2]!;
  expect(hem.x).toBeCloseTo(frame.hemLeft, 2);
  expect(hem.y).toBeCloseTo(frame.bottom, 2);
  expect(atMarker.x).toBeCloseTo(frame.left, 2);
  expect(atMarker.y).toBeCloseTo(frame.armholeMarkerY, 2);
  expect(atShoulder.x).toBeCloseTo(frame.left, 2);
  expect(atShoulder.y).toBeCloseTo(frame.top, 2);
  expect(atMarker.x).toBeCloseTo(atShoulder.x, 2);
}

describe("Drop Shoulder generated body silhouette", () => {
  it("straight: side is vertical from hem through marker to shoulder", () => {
    const frame = buildFullWidthFrame(counts({ hemStitches: 100, bodyWidthStitches: 100 }));
    expect(frame.hemLeft).toBeCloseTo(frame.left, 5);
    assertVerticalArmholeBand(dropShoulderPulloverRoundBodyPath(frame), frame);
  });

  it("A-line: tapers below the marker only; marker x equals shoulder x", () => {
    const frame = buildFullWidthFrame(counts({ hemStitches: 130, bodyWidthStitches: 100 }));
    expect(frame.hemLeft).toBeLessThan(frame.left);
    const d = dropShoulderPulloverRoundBodyPath(frame);
    const pts = linePoints(d);
    expect(pts[0]!.x).toBeLessThan(pts[1]!.x);
    expect(pts[1]!.x).toBeCloseTo(pts[2]!.x, 5);
    expect(pts[1]!.y).toBeCloseTo(frame.armholeMarkerY, 2);
    expect(pts[2]!.y).toBeCloseTo(frame.top, 2);
  });

  it("shaped: widens below the marker only; marker x equals shoulder x", () => {
    const frame = buildFullWidthFrame(counts({ hemStitches: 80, bodyWidthStitches: 100 }));
    expect(frame.hemLeft).toBeGreaterThan(frame.left);
    const pts = linePoints(dropShoulderPulloverRoundBodyPath(frame));
    expect(pts[0]!.x).toBeGreaterThan(pts[1]!.x);
    expect(pts[1]!.x).toBeCloseTo(pts[2]!.x, 5);
    expect(pts[1]!.y).toBeCloseTo(frame.armholeMarkerY, 2);
  });

  it("does not use a narrower cross-shoulder / after-armhole width above the marker", () => {
    const frame = buildFullWidthFrame(
      counts({ bodyWidthStitches: 100, crossShoulderStitches: 70, hemStitches: 100 }),
    );
    expect(frame.left).toBeCloseTo(
      buildFullWidthFrame(counts({ bodyWidthStitches: 100, crossShoulderStitches: 100 })).left,
      5,
    );
    const pts = linePoints(dropShoulderPulloverRoundBodyPath(frame));
    expect(pts[1]!.x).toBeCloseTo(pts[2]!.x, 5);
  });
});

describe("Drop Shoulder generated markers and dimension caps", () => {
  it("uses side-edge ticks, not a full-width dashed dimension line or arrow polygons", () => {
    const result = generateDropShoulderPattern(WOMEN_STRAIGHT);
    const svg = tryBuildLiveDropShoulderBackStsRowsDiagramSvg(result, WOMEN_STRAIGHT, "in")!;
    const markers = markerGroup(svg);
    expect(markers).toContain("data-armhole-marker-tick");
    expect(markers).not.toContain("stroke-dasharray");
    expect(markers).not.toContain("polygon");
    expect(svg).not.toMatch(/data-armhole-marker[\s\S]{0,400}stroke-dasharray="5 4"/);
  });

  it("keeps endCap rects on measurement groups and does not add arrowHead polygons there", () => {
    const result = generateDropShoulderPattern(WOMEN_STRAIGHT);
    const svg = tryBuildLiveDropShoulderBackStsRowsDiagramSvg(result, WOMEN_STRAIGHT, "in")!;
    const sample = endCap(10, 20, true);
    expect(sample).toContain("<rect");
    expect(sample).not.toContain("polygon");
    for (const cls of [
      "ds-diagram__armhole-depth",
      "ds-diagram__body-length",
      "ds-diagram__body-width",
    ]) {
      const group = dimGroup(svg, cls);
      expect(group.length).toBeGreaterThan(0);
      expect(group).toContain("<rect");
      expect(group).not.toContain("polygon");
    }
  });
});

describe("Drop Shoulder generated diagrams share the corrected path", () => {
  it("Back Stitches & Rows, Front Stitches & Rows, and Front Shaping Notation use the vertical armhole band", () => {
    const pattern = kids10YrRelaxedArmhole36Pattern();
    const result = generateDropShoulderPattern(pattern);
    const backModel = buildDropShoulderBackStitchesRowsModel(result, "in")!;
    const frontModel = buildDropShoulderFrontStitchesRowsModel(result, pattern, "in")!;
    const backFrame = buildFullWidthFrame(backModel);
    const frontFrame = buildDropShoulderFrontFullWidthFrame(frontModel);
    const backExpected = dropShoulderPulloverRoundBodyPath(backFrame);
    const frontExpected = dropShoulderFrontPulloverRoundBodyPath(frontFrame);

    const back = tryBuildLiveDropShoulderBackStsRowsDiagramSvg(result, pattern, "in")!;
    const front = tryBuildLiveDropShoulderFrontStsRowsDiagramSvg(result, pattern, "in")!;
    const frontNotation = tryBuildLiveDropShoulderFrontNotationSvg(result, pattern)!;
    expect(pathD(back, "ds-back-diagram__body")).toBe(backExpected);
    expect(pathD(front, "ds-front-diagram__body")).toBe(frontExpected);
    expect(pathD(frontNotation, "ds-front-diagram__body")).toBe(frontExpected);
    assertVerticalArmholeBand(backExpected, backFrame);
    assertVerticalArmholeBand(frontExpected, frontFrame);
    expect(frontFrame.left).toBeCloseTo(backFrame.left, 5);
    expect(frontFrame.armholeMarkerY).toBeCloseTo(backFrame.armholeMarkerY, 5);
  });

  it("does not change Front deep-neck timing, Back neck cap, sleeves, or Sleeveless", () => {
    const deep = generateDropShoulderPattern({
      ...WOMEN_STRAIGHT,
      fit: {
        ...WOMEN_STRAIGHT.fit,
        selectedMeasurements: {
          ...WOMEN_STRAIGHT.fit.selectedMeasurements,
          front_neck_depth: 12,
        },
      },
      yarnGaugeMachine: {
        ...WOMEN_STRAIGHT.yarnGaugeMachine,
        gaugeRowsPerInch: 6,
      },
    });
    expect(deep.debug.frontNecklineStartRC).toBeLessThan(deep.debug.armholeStartRow!);
    expect(deep.debug.backNecklineStartRC).toBeGreaterThanOrEqual(deep.debug.armholeStartRow!);
    expect(deep.sleeveDisplayRows.length).toBeGreaterThan(0);

    const kids = kids10YrRelaxedArmhole36Pattern();
    const sleeveless = generateSleevelessBackPattern({
      ...kids,
      style: { ...(kids.style as Record<string, unknown>), construction: "sleeveless" },
    });
    expect(sleeveless.frontDisplayRows.length).toBeGreaterThan(0);
  });
});
