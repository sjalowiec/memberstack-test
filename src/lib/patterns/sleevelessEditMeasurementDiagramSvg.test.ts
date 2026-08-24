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
  resolveSleevelessEditMeasurementIsCardigan,
  resolveSleevelessEditMeasurementIsVNeck,
  sleevelessEditCardiganCenterFrontLine,
} from "./sleevelessEditMeasurementDiagramSvg";
import { isSleevelessVNeckChoice } from "./sleevelessFrontDiagramSrc";
import {
  sleevelessFrontArmholePoints,
  sleevelessFrontArmholeSilhouetteCommands,
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
const geometrySrc = readFileSync(
  resolve("src/lib/patterns/sleevelessFrontGarmentGeometry.ts"),
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
  garment?: string;
  patternData?: unknown;
}): string {
  return buildSleevelessEditMeasurementDiagramSvg({
    measurements: {
      ...BASE,
      bustInches: args.bust,
      hipInches: args.hip,
    },
    patternData:
      args.patternData ?? {
        style: { neckline: args.neckline ?? "round", garmentStyle: args.garment ?? "pullover" },
      },
    liveNeckline: args.neckline,
    liveGarmentStyle: args.garment,
  });
}

function modelFor(args: { bust: number; hip: number; neckline?: string; garment?: string }) {
  return buildSleevelessEditMeasurementDiagramModel({
    measurements: {
      ...BASE,
      bustInches: args.bust,
      hipInches: args.hip,
    },
    patternData: {
      style: { neckline: args.neckline ?? "round", garmentStyle: args.garment ?? "pullover" },
    },
    liveNeckline: args.neckline,
    liveGarmentStyle: args.garment,
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

  it("selects Pullover vs Cardigan with resolveSleevelessGarmentKind", () => {
    expect(resolveSleevelessEditMeasurementIsCardigan({ style: { garmentStyle: "pullover" } })).toBe(
      false,
    );
    expect(resolveSleevelessEditMeasurementIsCardigan({ style: { garmentStyle: "cardigan" } })).toBe(
      true,
    );
    expect(
      resolveSleevelessEditMeasurementIsCardigan({ style: { garmentStyle: "pullover" } }, "cardigan"),
    ).toBe(true);
    expect(
      resolveSleevelessEditMeasurementIsCardigan({ style: { garmentStyle: "cardigan" } }, "pullover"),
    ).toBe(false);
    expect(rendererSrc).toContain("resolveSleevelessGarmentKind");
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

describe("Sleeveless edit measurement diagram — Pullover vs Cardigan", () => {
  it("Pullover + Round has no center-front opening line", () => {
    const svg = svgFor({ bust: 40, hip: 40, neckline: "round", garment: "pullover" });
    expect(svg).toContain('data-sleeveless-edit-garment="pullover"');
    expect(svg).not.toContain('data-role="center-front-opening"');
  });

  it("Pullover + V has no center-front opening line", () => {
    const svg = svgFor({ bust: 40, hip: 40, neckline: "v-neck", garment: "pullover" });
    expect(svg).toContain('data-sleeveless-edit-neckline="v-neck"');
    expect(svg).toContain('data-sleeveless-edit-garment="pullover"');
    expect(svg).not.toContain('data-role="center-front-opening"');
  });

  it("Cardigan + Round has a center-front opening line from neckline center to hem", () => {
    const model = modelFor({ bust: 40, hip: 40, neckline: "round", garment: "cardigan" });
    const svg = svgFor({ bust: 40, hip: 40, neckline: "round", garment: "cardigan" });
    const line = sleevelessEditCardiganCenterFrontLine(model.frame);
    const f = sleevelessFrontGarmentFmtNum;
    expect(model.isCardigan).toBe(true);
    expect(svg).toContain('data-sleeveless-edit-garment="cardigan"');
    expect(svg).toContain('data-role="center-front-opening"');
    expect(line.x1).toBe(model.frame.cx);
    expect(line.x2).toBe(model.frame.cx);
    expect(line.y1).toBe(model.frame.neckStartY);
    expect(line.y2).toBe(model.frame.bottomY);
    expect(svg).toContain(
      `x1="${f(line.x1)}" y1="${f(line.y1)}" x2="${f(line.x2)}" y2="${f(line.y2)}"`,
    );
  });

  it("Cardigan + V has a center-front opening line from the V point to hem", () => {
    const model = modelFor({ bust: 40, hip: 40, neckline: "v-neck", garment: "cardigan" });
    const svg = svgFor({ bust: 40, hip: 40, neckline: "v-neck", garment: "cardigan" });
    const vPoints = sleevelessFrontPulloverVNecklinePoints(model.frame);
    const line = sleevelessEditCardiganCenterFrontLine(model.frame);
    expect(model.isVNeck).toBe(true);
    expect(model.isCardigan).toBe(true);
    expect(line.x1).toBe(vPoints[1]?.x);
    expect(line.y1).toBe(vPoints[1]?.y);
    expect(line.y2).toBe(model.frame.bottomY);
    expect(svg).toContain('data-role="center-front-opening"');
    expect(svg).toContain('data-sleeveless-edit-neckline="v-neck"');
  });

  it("Cardigan keeps every existing target_* anchor", () => {
    const pullover = svgFor({ bust: 40, hip: 40, neckline: "round", garment: "pullover" });
    const cardigan = svgFor({ bust: 40, hip: 40, neckline: "round", garment: "cardigan" });
    for (const id of SLEEVELESS_EDIT_MEASUREMENT_TARGET_IDS) {
      expect(pullover).toContain(`id="${id}"`);
      expect(cardigan).toContain(`id="${id}"`);
    }
  });

  it("Cardigan still uses the same full-front body for Straight / A-line / shaped", () => {
    const aline = modelFor({ bust: 38, hip: 44, neckline: "v-neck", garment: "cardigan" });
    const shaped = modelFor({ bust: 44, hip: 38, neckline: "round", garment: "cardigan" });
    expect(aline.bodyShapeKind).toBe("aline");
    expect(aline.isCardigan).toBe(true);
    expect(aline.frame.hemWidth).toBeGreaterThan(aline.frame.bodyWidth);
    expect(shaped.bodyShapeKind).toBe("shaped");
    expect(shaped.isCardigan).toBe(true);
    expect(svgFor({ bust: 38, hip: 44, neckline: "v-neck", garment: "cardigan" })).toContain(
      'data-role="center-front-opening"',
    );
    expect(svgFor({ bust: 44, hip: 38, neckline: "round", garment: "cardigan" })).toContain(
      'data-role="center-front-opening"',
    );
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
    expect(measurementsPageSrc).toContain("replaceSleevelessMeasurementArtOnly");
    expect(measurementsPageSrc).toContain("diagramOverlayPositionCleanup.retarget");
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

describe("Sleeveless edit measurement diagram — armhole silhouette", () => {
  it("reuses the shared Front armhole helper instead of a local shaping formula", () => {
    expect(geometrySrc).toContain("export function sleevelessFrontArmholePoints");
    expect(geometrySrc).toContain("export function sleevelessFrontArmholeSilhouetteCommands");
    expect(rendererSrc).toContain("sleevelessFrontArmholeSilhouetteCommands");
    expect(
      readFileSync(resolve("src/lib/patterns/sleevelessFrontStsRowsDiagramSvg.ts"), "utf8"),
    ).toContain("sleevelessFrontArmholePoints");
    expect(rendererSrc).not.toMatch(
      /L \$\{f\(frame\.afterLeft\)\} \$\{f\(frame\.lastArmholeY\)\}/,
    );
    expect(geometrySrc).not.toMatch(
      /lastArmholeY = armholeStartY - allocated\.armholeH \* 0\.55/,
    );
  });

  it("keeps the horizontal bind-off, then inward shaping, mirrored left and right", () => {
    const model = modelFor({ bust: 40, hip: 40, neckline: "round" });
    const { frame } = model;
    const left = sleevelessFrontArmholePoints(frame, "left");
    const right = sleevelessFrontArmholePoints(frame, "right");
    expect(left).toHaveLength(4);
    expect(right).toHaveLength(4);

    expect(left[0]?.y).toBe(left[1]?.y);
    expect(left[0]?.y).toBe(frame.armholeStartY);
    expect(left[1]?.x).toBeGreaterThan(left[0]!.x);

    expect(left[2]?.x).toBe(frame.afterLeft);
    expect(left[2]?.x).toBeGreaterThan(left[1]!.x);
    expect(left[2]?.y).toBeLessThan(left[1]!.y);
    expect(left[3]?.x).toBe(left[2]?.x);
    expect(left[3]?.y).toBe(frame.shoulderY);

    const inwardDy = left[1]!.y - left[2]!.y;
    const verticalDy = left[2]!.y - left[3]!.y;
    expect(inwardDy).toBeGreaterThan(verticalDy);
    expect(frame.lastArmholeY).toBe(frame.shoulderY);

    expect(right[0]!.x - frame.cx).toBeCloseTo(frame.cx - left[0]!.x);
    expect(right[1]!.x - frame.cx).toBeCloseTo(frame.cx - left[1]!.x);
    expect(right[2]!.x - frame.cx).toBeCloseTo(frame.cx - left[2]!.x);
    expect(right[3]!.x - frame.cx).toBeCloseTo(frame.cx - left[3]!.x);
    expect(right[0]?.y).toBe(left[0]?.y);
    expect(right[1]?.y).toBe(left[1]?.y);
    expect(right[2]?.y).toBe(left[2]?.y);
    expect(right[3]?.y).toBe(left[3]?.y);

    const svg = svgFor({ bust: 40, hip: 40, neckline: "round" });
    for (const command of sleevelessFrontArmholeSilhouetteCommands(frame, "left")) {
      expect(svg).toContain(command);
    }
    for (const command of sleevelessFrontArmholeSilhouetteCommands(frame, "right")) {
      expect(svg).toContain(command);
    }
  });

  it("keeps target_armhole_depth and the armhole-depth guide", () => {
    const svg = svgFor({ bust: 40, hip: 40, neckline: "round" });
    expect(svg).toContain(`id="${PATTERN_SUMMARY_MEASUREMENT_TARGETS.armholeDepth}"`);
    expect(svg).toContain('id="target_armhole_depth"');
    expect(svg).toContain('data-role="line-armhole"');
    const model = modelFor({ bust: 40, hip: 40, neckline: "round" });
    const f = sleevelessFrontGarmentFmtNum;
    const guideY1 = f(model.frame.shoulderTopY);
    const guideY2 = f(model.frame.armholeStartY);
    expect(svg).toContain(`data-role="line-armhole"`);
    expect(svg).toMatch(
      new RegExp(
        `data-role="line-armhole"[^>]*y1="${guideY1}"[^>]*y2="${guideY2}"`,
      ),
    );
  });

  it("does not change Round/V, Pullover/Cardigan, or body-shape variants", () => {
    expect(svgFor({ bust: 40, hip: 40, neckline: "round", garment: "pullover" })).toContain(
      'data-sleeveless-edit-neckline="round"',
    );
    expect(svgFor({ bust: 40, hip: 40, neckline: "v-neck", garment: "pullover" })).toContain(
      'data-sleeveless-edit-neckline="v-neck"',
    );
    expect(svgFor({ bust: 40, hip: 40, neckline: "round", garment: "cardigan" })).toContain(
      'data-sleeveless-edit-garment="cardigan"',
    );
    expect(svgFor({ bust: 40, hip: 40, neckline: "v-neck", garment: "cardigan" })).toContain(
      'data-role="center-front-opening"',
    );
    expect(svgFor({ bust: 40, hip: 40, neckline: "round" })).toContain(
      'data-sleeveless-edit-body-shape="straight"',
    );
    expect(svgFor({ bust: 38, hip: 44, neckline: "round" })).toContain(
      'data-sleeveless-edit-body-shape="aline"',
    );
    expect(svgFor({ bust: 44, hip: 38, neckline: "round" })).toContain(
      'data-sleeveless-edit-body-shape="shaped"',
    );
    for (const id of SLEEVELESS_EDIT_MEASUREMENT_TARGET_IDS) {
      expect(svgFor({ bust: 40, hip: 40, neckline: "v-neck", garment: "cardigan" })).toContain(
        `id="${id}"`,
      );
    }
  });
});
