import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { PATTERN_SUMMARY_MEASUREMENT_TARGETS } from "./patternSummaryMeasurementOverlay";
import {
  measurementsImplySleevelessAlineBody,
  measurementsImplySleevelessShapedBody,
} from "./sleevelessAlineShaping";
import {
  SLEEVELESS_EDIT_MEASUREMENT_TARGET_IDS,
  buildSleevelessEditMeasurementDiagramModel,
  buildSleevelessEditMeasurementDiagramSvg,
  resolveSleevelessEditMeasurementBodyShapeKind,
  resolveSleevelessEditMeasurementIsVNeck,
} from "./sleevelessEditMeasurementDiagramSvg";
import { isSleevelessVNeckChoice } from "./sleevelessFrontDiagramSrc";
import {
  sleevelessFrontBodySidePoints,
  sleevelessFrontGarmentFmtNum,
  sleevelessFrontPulloverRoundNecklineCurveD,
  sleevelessFrontPulloverVNecklinePoints,
} from "./sleevelessFrontGarmentGeometry";

const measurementsPageSrc = readFileSync(
  resolve("src/scripts/sleeveless-custom-build-measurements-page.ts"),
  "utf8",
);
const overlaySrc = readFileSync(
  resolve("src/lib/patterns/patternSummaryMeasurementOverlay.ts"),
  "utf8",
);
const rendererSrc = readFileSync(
  resolve("src/lib/patterns/sleevelessEditMeasurementDiagramSvg.ts"),
  "utf8",
);

const BASE = {
  garmentLengthInches: 22,
  armholeDepthInches: 8,
  neckOpeningInches: 7,
  neckDepthInches: 3.25,
  shoulderWidthInches: 4.5,
  hemDepthInches: 2,
};

function svgFor(args: {
  bust: number;
  hip: number;
  neckline?: string;
  patternData?: unknown;
}): string {
  return buildSleevelessEditMeasurementDiagramSvg({
    measurements: {
      ...BASE,
      bustInches: args.bust,
      hipInches: args.hip,
    },
    patternData: args.patternData ?? { style: { neckline: args.neckline ?? "round" } },
    liveNeckline: args.neckline,
  });
}

function modelFor(args: { bust: number; hip: number; neckline?: string }) {
  return buildSleevelessEditMeasurementDiagramModel({
    measurements: {
      ...BASE,
      bustInches: args.bust,
      hipInches: args.hip,
    },
    patternData: { style: { neckline: args.neckline ?? "round" } },
    liveNeckline: args.neckline,
  });
}

describe("Sleeveless edit measurement diagram — classification sources of truth", () => {
  it("selects Round vs V with isSleevelessVNeckChoice", () => {
    expect(resolveSleevelessEditMeasurementIsVNeck({ style: { neckline: "round" } })).toBe(false);
    expect(resolveSleevelessEditMeasurementIsVNeck({ style: { neckline: "v-neck" } })).toBe(true);
    expect(resolveSleevelessEditMeasurementIsVNeck({ style: { neckline: "round" } }, "v-neck")).toBe(
      true,
    );
    expect(resolveSleevelessEditMeasurementIsVNeck({ style: { neckline: "v-neck" } }, "round")).toBe(
      false,
    );
    expect(isSleevelessVNeckChoice({ style: { neckline: "v-neck" } })).toBe(true);
    expect(rendererSrc).toContain("isSleevelessVNeckChoice");
  });

  it("selects Straight / A-line / shaped with existing measurement thresholds", () => {
    expect(measurementsImplySleevelessAlineBody(38, 44)).toBe(true);
    expect(measurementsImplySleevelessShapedBody(44, 38)).toBe(true);
    expect(resolveSleevelessEditMeasurementBodyShapeKind(40, 40)).toBe("straight");
    expect(resolveSleevelessEditMeasurementBodyShapeKind(38, 44)).toBe("aline");
    expect(resolveSleevelessEditMeasurementBodyShapeKind(44, 38)).toBe("shaped");
    expect(rendererSrc).toContain("deriveSleevelessEditWorkspaceBodyShape");
    expect(rendererSrc).toContain("resolveEffectiveSleevelessBodyShapeKind");
  });

  it("lets the live neckline radio override saved pattern data without a regenerate", () => {
    const savedV = { style: { neckline: "v-neck" } };
    expect(resolveSleevelessEditMeasurementIsVNeck(savedV, "round")).toBe(false);
    expect(modelFor({ bust: 40, hip: 40, neckline: "round" }).isVNeck).toBe(false);
    expect(modelFor({ bust: 40, hip: 40, neckline: "v-neck" }).isVNeck).toBe(true);
  });
});

describe("Sleeveless edit measurement diagram — silhouette variants", () => {
  it("Round + Straight uses the approved Round scoop and untapered sides", () => {
    const model = modelFor({ bust: 40, hip: 40, neckline: "round" });
    expect(model.isVNeck).toBe(false);
    expect(model.bodyShapeKind).toBe("straight");
    expect(model.tapered).toBe(false);
    const svg = svgFor({ bust: 40, hip: 40, neckline: "round" });
    expect(svg).toContain('data-sleeveless-edit-neckline="round"');
    expect(svg).toContain('data-sleeveless-edit-body-shape="straight"');
    expect(svg).toContain(sleevelessFrontPulloverRoundNecklineCurveD(model.frame));
    const left = sleevelessFrontBodySidePoints(model.frame, "left", false);
    expect(left).toHaveLength(2);
    expect(left[0]?.x).toBe(left[1]?.x);
  });

  it("V + Straight uses the approved V polyline and untapered sides", () => {
    const model = modelFor({ bust: 40, hip: 40, neckline: "v-neck" });
    expect(model.isVNeck).toBe(true);
    expect(model.bodyShapeKind).toBe("straight");
    const svg = svgFor({ bust: 40, hip: 40, neckline: "v-neck" });
    expect(svg).toContain('data-sleeveless-edit-neckline="v-neck"');
    const vPoints = sleevelessFrontPulloverVNecklinePoints(model.frame);
    expect(vPoints).toHaveLength(3);
    expect(vPoints[1]?.x).toBe(model.frame.cx);
    expect(svg).toContain(
      `L ${sleevelessFrontGarmentFmtNum(vPoints[1]!.x)} ${sleevelessFrontGarmentFmtNum(vPoints[1]!.y)}`,
    );
  });

  it("Round + wider hip / A-line tapers hem wider than bust", () => {
    const model = modelFor({ bust: 38, hip: 44, neckline: "round" });
    expect(model.bodyShapeKind).toBe("aline");
    expect(model.tapered).toBe(true);
    expect(model.frame.hemWidth).toBeGreaterThan(model.frame.bodyWidth);
    const svg = svgFor({ bust: 38, hip: 44, neckline: "round" });
    expect(svg).toContain('data-sleeveless-edit-body-shape="aline"');
    expect(svg).toContain('data-sleeveless-edit-neckline="round"');
  });

  it("V + wider hip / A-line keeps V and A-line together", () => {
    const model = modelFor({ bust: 38, hip: 44, neckline: "v-neck" });
    expect(model.isVNeck).toBe(true);
    expect(model.bodyShapeKind).toBe("aline");
    expect(model.frame.hemWidth).toBeGreaterThan(model.frame.bodyWidth);
    const svg = svgFor({ bust: 38, hip: 44, neckline: "v-neck" });
    expect(svg).toContain('data-sleeveless-edit-neckline="v-neck"');
    expect(svg).toContain('data-sleeveless-edit-body-shape="aline"');
  });

  it("narrower hip / shaped tapers hem narrower than bust", () => {
    const model = modelFor({ bust: 44, hip: 38, neckline: "round" });
    expect(model.bodyShapeKind).toBe("shaped");
    expect(model.tapered).toBe(true);
    expect(model.frame.hemWidth).toBeLessThan(model.frame.bodyWidth);
    const svg = svgFor({ bust: 44, hip: 38, neckline: "round" });
    expect(svg).toContain('data-sleeveless-edit-body-shape="shaped"');
  });
});

describe("Sleeveless edit measurement diagram — overlay anchors", () => {
  it("emits every existing measurement target id", () => {
    const svg = svgFor({ bust: 40, hip: 40, neckline: "round" });
    for (const id of SLEEVELESS_EDIT_MEASUREMENT_TARGET_IDS) {
      expect(svg).toContain(`id="${id}"`);
    }
    expect(svg).toContain(`id="${PATTERN_SUMMARY_MEASUREMENT_TARGETS.neckOpening}"`);
    expect(svg).toContain(`id="${PATTERN_SUMMARY_MEASUREMENT_TARGETS.neckDepth}"`);
    expect(svg).toContain(`id="${PATTERN_SUMMARY_MEASUREMENT_TARGETS.bust}"`);
    expect(svg).toContain(`id="${PATTERN_SUMMARY_MEASUREMENT_TARGETS.hip}"`);
    expect(svg).toContain(`id="${PATTERN_SUMMARY_MEASUREMENT_TARGETS.chest}"`);
    expect(svg).toContain(`id="${PATTERN_SUMMARY_MEASUREMENT_TARGETS.armholeDepth}"`);
    expect(svg).toContain(`id="${PATTERN_SUMMARY_MEASUREMENT_TARGETS.hem}"`);
    expect(svg).toContain(`id="${PATTERN_SUMMARY_MEASUREMENT_TARGETS.garmentLength}"`);
    expect(svg).toContain('id="target_garmemt_length"');
  });

  it("keeps the existing overlay binder contract", () => {
    expect(overlaySrc).toContain("bindPatternSummaryOverlayPositioning");
    expect(overlaySrc).toContain("target_neck_opening");
    expect(overlaySrc).toContain("target_bust");
    expect(measurementsPageSrc).toContain("bindPatternSummaryOverlayPositioning");
    expect(measurementsPageSrc).toContain("buildSleevelessEditMeasurementDiagramSvg");
    expect(measurementsPageSrc).toContain("collectOverlayAnchors");
    expect(measurementsPageSrc).toContain("refreshSleevelessEditMeasurementArtLayer");
    expect(rendererSrc).not.toContain("data-measurement-target");
  });

  it("does not generate Drop Shoulder artwork from this renderer", () => {
    expect(rendererSrc).not.toContain("drop_shoulder_summary");
    expect(measurementsPageSrc).toMatch(
      /if \(!isDropShoulderConstruction\(\) && merged\)/,
    );
    expect(measurementsPageSrc).toContain("resolveMeasurementBlueprintSvgUrl");
  });
});
