import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  DROP_SHOULDER_SUMMARY_MEASUREMENT_TARGETS,
  EDIT_WORKSPACE_TWO_COLUMN_MIN_PX,
} from "./patternSummaryMeasurementOverlay";
import {
  measurementsImplySleevelessAlineBody,
  measurementsImplySleevelessShapedBody,
} from "./sleevelessAlineShaping";
import {
  DROP_SHOULDER_EDIT_MEASUREMENT_TARGET_IDS,
  DROP_SHOULDER_EDIT_SLEEVE_HANG_DEG,
  buildDropShoulderEditMeasurementDiagramModel,
  buildDropShoulderEditMeasurementDiagramSvg,
  dropShoulderEditBodyWidthXAt,
  dropShoulderEditSleeveRotateDeg,
  dropShoulderEditSleeveWorldPoint,
} from "./dropShoulderEditMeasurementDiagramSvg";
import {
  bodyWidthXAt,
  buildDropShoulderMeasurementBodyFrame,
  dropShoulderFrontBodyPath,
  dropShoulderFrontPulloverRoundBodyPath,
  dropShoulderPulloverVBodyPath,
  endCap,
  fmtNum,
} from "./dropShoulderPatternDiagramSvgShared";
import {
  buildDropShoulderMeasurementSleeveFrame,
  dropShoulderSleeveBodyPath,
} from "./dropShoulderSleeveDiagramSvgShared";

const measurementsPageSrc = readFileSync(
  resolve("src/scripts/sleeveless-custom-build-measurements-page.ts"),
  "utf8",
);
const rendererSrc = readFileSync(
  resolve("src/lib/patterns/dropShoulderEditMeasurementDiagramSvg.ts"),
  "utf8",
);
const sleevelessRendererSrc = readFileSync(
  resolve("src/lib/patterns/sleevelessEditMeasurementDiagramSvg.ts"),
  "utf8",
);
const workspaceCss = readFileSync(
  resolve("src/styles/patterns/pattern-summary-edit-workspace.css"),
  "utf8",
);
const dropShoulderPatternPage = readFileSync(
  resolve("src/pages/patterns/drop-shoulder/pattern/index.astro"),
  "utf8",
);
const sleevelessPatternPage = readFileSync(
  resolve("src/pages/patterns/sleeveless/pattern/index.astro"),
  "utf8",
);
const summarySvg = readFileSync(
  resolve("public/images/patterns/drop-shoulder/drop_shoulder_summary.svg"),
  "utf8",
);

const BASE = {
  bustInches: 40,
  hipInches: 40,
  garmentLengthInches: 24,
  armholeDepthInches: 8,
  neckOpeningInches: 7,
  neckDepthInches: 3.25,
  hemDepthInches: 2,
  upperArmInches: 14,
  cuffCircumferenceInches: 8,
  sleeveLengthInches: 18,
  cuffDepthInches: 2,
};

function svgFor(
  overrides: Partial<typeof BASE> & {
    neckline?: string;
    garment?: string;
    unit?: "in" | "cm";
  } = {},
): string {
  const { neckline, garment, unit, ...meas } = overrides;
  return buildDropShoulderEditMeasurementDiagramSvg({
    measurements: { ...BASE, ...meas },
    patternData: {
      style: {
        neckline: neckline ?? "round",
        garmentStyle: garment ?? "pullover",
        construction: "drop-shoulder",
      },
    },
    liveNeckline: neckline,
    liveGarmentStyle: garment,
    displayUnit: unit,
  });
}

function modelFor(
  overrides: Partial<typeof BASE> & { neckline?: string; garment?: string; unit?: "in" | "cm" } = {},
) {
  const { neckline, garment, unit, ...meas } = overrides;
  return buildDropShoulderEditMeasurementDiagramModel({
    measurements: { ...BASE, ...meas },
    patternData: {
      style: {
        neckline: neckline ?? "round",
        garmentStyle: garment ?? "pullover",
        construction: "drop-shoulder",
      },
    },
    liveNeckline: neckline,
    liveGarmentStyle: garment,
    displayUnit: unit,
  });
}

function svgRootCount(svg: string): number {
  return (svg.match(/<svg\b/g) ?? []).length;
}

function sleeveGroups(svg: string): string[] {
  return svg.match(/<g data-role="sleeve"[^>]*>/g) ?? [];
}

function sleeveOutlinePaths(svg: string): string[] {
  const re = /data-role="sleeve-outline"[^>]*\sd="([^"]+)"/g;
  const out: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = re.exec(svg))) out.push(match[1] ?? "");
  return out;
}

function bodyOutlineD(svg: string): string {
  return /data-role="body-outline"[^>]*\sd="([^"]+)"/.exec(svg)?.[1] ?? "";
}

describe("Drop Shoulder edit measurement diagram — one integrated SVG", () => {
  it("renders ONE SVG, not separate body/sleeve SVGs", () => {
    const svg = svgFor();
    expect(svgRootCount(svg)).toBe(1);
    expect(svg).toContain('data-drop-shoulder-edit-diagram="true"');
    expect(svg).toContain('data-integrated-garment="true"');
    expect(svg).toContain('data-sleeve-count="2"');
    expect(summarySvg).toContain('id="body"');
    expect(summarySvg).toContain('id="sleeve"');
    expect(rendererSrc).not.toContain("drop_shoulder_summary.svg");
  });

  it("includes both sleeves in the same SVG, attached at the armhole opening", () => {
    const model = modelFor();
    const svg = svgFor();
    const groups = sleeveGroups(svg);
    expect(groups).toHaveLength(2);
    expect(svg).toContain('data-sleeve-side="left"');
    expect(svg).toContain('data-sleeve-side="right"');
    expect(model.leftSleeve.origin.x).toBe(model.frame.left);
    expect(model.rightSleeve.origin.x).toBe(model.frame.right);
    expect(model.leftSleeve.origin.y).toBeGreaterThanOrEqual(model.frame.top);
    expect(model.leftSleeve.origin.y).toBeLessThanOrEqual(model.frame.armholeMarkerY);
    expect(model.rightSleeve.origin.y).toBeGreaterThanOrEqual(model.frame.top);
    expect(model.rightSleeve.origin.y).toBeLessThanOrEqual(model.frame.armholeMarkerY);
    expect(svg).toContain(`translate(${fmtNum(model.rightSleeve.origin.x)} ${fmtNum(model.rightSleeve.origin.y)})`);
    expect(svg).toContain(`translate(${fmtNum(model.leftSleeve.origin.x)} ${fmtNum(model.leftSleeve.origin.y)})`);
    expect(svg).toContain('data-role="armhole-opening" data-side="left"');
    expect(svg).toContain('data-role="armhole-opening" data-side="right"');
  });

  it("does not draw a sleeve cap", () => {
    const svg = svgFor();
    for (const d of sleeveOutlinePaths(svg)) {
      expect(d).not.toMatch(/[QCCq]/);
      expect(d).toMatch(/^M /);
    }
    expect(svg).toContain('data-sleeve-cap="false"');
    expect(rendererSrc).toContain("dropShoulderSleeveBodyPath");
    expect(rendererSrc).not.toContain("sleeve cap");
  });

  it("does not draw a shaped armhole; body stays vertical above the marker", () => {
    const model = modelFor();
    const svg = svgFor();
    expect(svg).toContain('data-shaped-armhole="false"');
    expect(svg).toContain('data-armhole-style="drop-shoulder"');
    expect(rendererSrc).not.toContain("sleevelessFrontArmhole");
    const above = dropShoulderEditBodyWidthXAt(model.frame, model.frame.top + 2);
    expect(above.left).toBe(model.frame.left);
    expect(above.right).toBe(model.frame.right);
    const atMarker = dropShoulderEditBodyWidthXAt(model.frame, model.frame.armholeMarkerY);
    expect(atMarker.left).toBe(model.frame.left);
    expect(atMarker.right).toBe(model.frame.right);
    const d = bodyOutlineD(svg);
    expect(d).toContain(`L ${fmtNum(model.frame.left)} ${fmtNum(model.frame.armholeMarkerY)}`);
    expect(d).toContain(`L ${fmtNum(model.frame.left)} ${fmtNum(model.frame.top)}`);
    expect(d).toContain(`L ${fmtNum(model.frame.right)} ${fmtNum(model.frame.top)}`);
    expect(d).toContain(`L ${fmtNum(model.frame.right)} ${fmtNum(model.frame.armholeMarkerY)}`);
  });
});

describe("Drop Shoulder edit measurement diagram — body shapes", () => {
  it("Straight body keeps vertical sides and equal hem/bust width", () => {
    const model = modelFor({ bustInches: 40, hipInches: 40 });
    const svg = svgFor({ bustInches: 40, hipInches: 40 });
    expect(model.bodyShapeKind).toBe("straight");
    expect(model.tapered).toBe(false);
    expect(svg).toContain('data-drop-shoulder-edit-body-shape="straight"');
    expect(model.frame.hemLeft).toBe(model.frame.left);
    expect(model.frame.hemRight).toBe(model.frame.right);
    expect(measurementsImplySleevelessAlineBody(40, 40)).toBe(false);
  });

  it("A-line flares only below the armhole marker", () => {
    const model = modelFor({ bustInches: 38, hipInches: 44 });
    const svg = svgFor({ bustInches: 38, hipInches: 44 });
    expect(measurementsImplySleevelessAlineBody(38, 44)).toBe(true);
    expect(model.bodyShapeKind).toBe("aline");
    expect(svg).toContain('data-drop-shoulder-edit-body-shape="aline"');
    expect(model.frame.hemRight - model.frame.hemLeft).toBeGreaterThan(
      model.frame.right - model.frame.left,
    );
    const above = bodyWidthXAt(model.frame, model.frame.top + 4);
    expect(above.left).toBe(model.frame.left);
    expect(above.right).toBe(model.frame.right);
    const atHem = bodyWidthXAt(model.frame, model.frame.bottom);
    expect(atHem.left).toBe(model.frame.hemLeft);
    expect(atHem.right).toBe(model.frame.hemRight);
  });

  it("Shaped body tapers only below the armhole marker", () => {
    const model = modelFor({ bustInches: 44, hipInches: 38 });
    const svg = svgFor({ bustInches: 44, hipInches: 38 });
    expect(measurementsImplySleevelessShapedBody(44, 38)).toBe(true);
    expect(model.bodyShapeKind).toBe("shaped");
    expect(svg).toContain('data-drop-shoulder-edit-body-shape="shaped"');
    expect(model.frame.hemRight - model.frame.hemLeft).toBeLessThan(
      model.frame.right - model.frame.left,
    );
    const above = bodyWidthXAt(model.frame, model.frame.armholeMarkerY);
    expect(above.left).toBe(model.frame.left);
    expect(above.right).toBe(model.frame.right);
  });
});

describe("Drop Shoulder edit measurement diagram — neckline and cardigan", () => {
  it("Round neckline uses the shared pullover round body path", () => {
    const model = modelFor({ neckline: "round" });
    const svg = svgFor({ neckline: "round" });
    expect(model.isVNeck).toBe(false);
    expect(svg).toContain('data-drop-shoulder-edit-neckline="round"');
    expect(bodyOutlineD(svg)).toBe(dropShoulderFrontPulloverRoundBodyPath(model.frame));
    expect(svg).toContain("Q ");
  });

  it("V-neck uses the shared pullover V body path", () => {
    const model = modelFor({ neckline: "v-neck" });
    const svg = svgFor({ neckline: "v-neck" });
    expect(model.isVNeck).toBe(true);
    expect(svg).toContain('data-drop-shoulder-edit-neckline="v-neck"');
    expect(bodyOutlineD(svg)).toBe(dropShoulderPulloverVBodyPath(model.frame));
    expect(bodyOutlineD(svg)).toContain(`L ${fmtNum(model.frame.midX)} ${fmtNum(model.frame.neckBottomY)}`);
  });

  it("Cardigan keeps full-front Drop Shoulder geometry with a center-front opening", () => {
    const round = modelFor({ garment: "cardigan", neckline: "round" });
    const v = modelFor({ garment: "cardigan", neckline: "v-neck" });
    const roundSvg = svgFor({ garment: "cardigan", neckline: "round" });
    const vSvg = svgFor({ garment: "cardigan", neckline: "v-neck" });
    expect(round.isCardigan).toBe(true);
    expect(v.isCardigan).toBe(true);
    expect(roundSvg).toContain('data-drop-shoulder-edit-garment="cardigan"');
    expect(roundSvg).toContain('data-role="center-front-opening"');
    expect(vSvg).toContain('data-role="center-front-opening"');
    expect((roundSvg.match(/data-role="center-front-opening"/g) ?? []).length).toBe(1);
    expect(bodyOutlineD(roundSvg)).toBe(dropShoulderFrontBodyPath(round.frame, "pullover", "round"));
    expect(bodyOutlineD(vSvg)).toBe(dropShoulderFrontBodyPath(v.frame, "pullover", "v"));
    expect(sleeveGroups(roundSvg)).toHaveLength(2);
    expect(round.frame.left).toBeLessThan(round.frame.midX);
    expect(round.frame.right).toBeGreaterThan(round.frame.midX);
  });
});

describe("Drop Shoulder edit measurement diagram — sleeve and body measurements", () => {
  it("upper-arm measurement affects sleeve top width", () => {
    const slim = modelFor({ upperArmInches: 12 });
    const wide = modelFor({ upperArmInches: 18 });
    const slimTop = slim.rightSleeve.frame.upperRight - slim.rightSleeve.frame.upperLeft;
    const wideTop = wide.rightSleeve.frame.upperRight - wide.rightSleeve.frame.upperLeft;
    expect(wideTop).toBeGreaterThan(slimTop);
    expect(svgFor({ upperArmInches: 18 })).toContain('data-role="dim-upper-arm"');
  });

  it("cuff measurement affects sleeve bottom width", () => {
    const slim = modelFor({ cuffCircumferenceInches: 6 });
    const wide = modelFor({ cuffCircumferenceInches: 12 });
    const slimCuff = slim.rightSleeve.frame.wristRight - slim.rightSleeve.frame.wristLeft;
    const wideCuff = wide.rightSleeve.frame.wristRight - wide.rightSleeve.frame.wristLeft;
    expect(wideCuff).toBeGreaterThan(slimCuff);
  });

  it("sleeve length affects sleeve length", () => {
    const short = modelFor({ sleeveLengthInches: 12 });
    const long = modelFor({ sleeveLengthInches: 22 });
    expect(long.rightSleeve.frame.bottom - long.rightSleeve.frame.top).toBeGreaterThan(
      short.rightSleeve.frame.bottom - short.rightSleeve.frame.top,
    );
    const shortReach = dropShoulderEditSleeveWorldPoint(
      { x: 0, y: short.rightSleeve.frame.bottom },
      short.rightSleeve.origin,
      short.rightSleeve.rotateDeg,
    );
    const longReach = dropShoulderEditSleeveWorldPoint(
      { x: 0, y: long.rightSleeve.frame.bottom },
      long.rightSleeve.origin,
      long.rightSleeve.rotateDeg,
    );
    expect(Math.abs(longReach.x - long.frame.right)).toBeGreaterThan(
      Math.abs(shortReach.x - short.frame.right),
    );
  });

  it("cuff depth affects the cuff band", () => {
    const shallow = modelFor({ cuffDepthInches: 1 });
    const deep = modelFor({ cuffDepthInches: 3 });
    const shallowBand = shallow.rightSleeve.frame.bottom - shallow.rightSleeve.frame.cuffJoinY;
    const deepBand = deep.rightSleeve.frame.bottom - deep.rightSleeve.frame.cuffJoinY;
    expect(deepBand).toBeGreaterThan(shallowBand);
    expect(svgFor()).toContain("data-sleeve-cuff-join");
  });

  it("body measurements affect body geometry", () => {
    const short = modelFor({ garmentLengthInches: 20, bustInches: 36, hipInches: 36 });
    const tall = modelFor({ garmentLengthInches: 28, bustInches: 48, hipInches: 48 });
    const shortH = short.frame.bottom - short.frame.top;
    const tallH = tall.frame.bottom - tall.frame.top;
    const shortArmFrac = (short.frame.armholeMarkerY - short.frame.top) / shortH;
    const tallArmFrac = (tall.frame.armholeMarkerY - tall.frame.top) / tallH;
    expect(tallArmFrac).toBeLessThan(shortArmFrac);
    expect(tall.frame.right - tall.frame.left).toBeGreaterThan(short.frame.right - short.frame.left);
    const deepArm = modelFor({ armholeDepthInches: 10 });
    const shallowArm = modelFor({ armholeDepthInches: 6 });
    expect(deepArm.frame.armholeMarkerY - deepArm.frame.top).toBeGreaterThan(
      shallowArm.frame.armholeMarkerY - shallowArm.frame.top,
    );
    const deepHem = modelFor({ hemDepthInches: 4 });
    const shallowHem = modelFor({ hemDepthInches: 1 });
    expect(deepHem.frame.bottom - deepHem.frame.hemTopY).toBeGreaterThan(
      shallowHem.frame.bottom - shallowHem.frame.hemTopY,
    );
  });

  it("unit switching updates labels correctly", () => {
    const inches = svgFor({ unit: "in" });
    const cm = svgFor({ unit: "cm" });
    expect(inches).toContain('data-display-unit="in"');
    expect(cm).toContain('data-display-unit="cm"');
    expect(inches).toMatch(/\d+(\.\d+)? in/);
    expect(cm).toMatch(/\d+(\.\d+)? cm/);
    expect(inches).not.toContain(" cm</text>");
    expect(cm).not.toContain(" in</text>");
  });

  it("uses Drop Shoulder end-cap dimension lines and existing overlay targets", () => {
    const svg = svgFor();
    expect(rendererSrc).toContain("endCap(");
    expect(svg).toContain('data-end-cap="true"');
    expect(endCap(10, 20, true)).toContain("<rect");
    for (const id of DROP_SHOULDER_EDIT_MEASUREMENT_TARGET_IDS) {
      expect(svg).toContain(`id="${id}"`);
    }
    expect(svg).toContain(`id="${DROP_SHOULDER_SUMMARY_MEASUREMENT_TARGETS.upperArm}"`);
    expect(svg).toContain(`id="${DROP_SHOULDER_SUMMARY_MEASUREMENT_TARGETS.cuffDepth}"`);
    expect(svg).toContain('width="100%"');
    expect(svg).toContain('height="auto"');
    expect(svg).toContain('preserveAspectRatio="xMidYMid meet"');
    expect(svg).toMatch(/viewBox="0 0 /);
  });
});

describe("Drop Shoulder edit measurement diagram — layout reuse", () => {
  it("desktop edit page uses the shared two-column workspace", () => {
    expect(EDIT_WORKSPACE_TWO_COLUMN_MIN_PX).toBe(1100);
    expect(dropShoulderPatternPage).toContain("PatternSummaryEditWorkspace");
    expect(dropShoulderPatternPage).toContain("data-cb-measure-diagram");
    expect(workspaceCss).toContain("@container sl-edit-workspace (min-width: 1100px)");
    expect(workspaceCss).toContain("flex-direction: row");
    expect(workspaceCss).toContain("flex: 0 0 clamp(320px, 26vw, 380px)");
    expect(workspaceCss).toContain("flex: 1 1 0");
  });

  it("responsive layout stacks below the shared 1100px container query", () => {
    expect(workspaceCss).toContain("@container sl-edit-workspace (max-width: 1099.98px)");
    expect(workspaceCss).toMatch(/\.sl-edit-workspace__layout \{[\s\S]*flex-direction: column/);
  });

  it("Sleeveless edit-page regression remains unchanged", () => {
    expect(sleevelessRendererSrc).toContain("data-sleeveless-edit-diagram");
    expect(sleevelessRendererSrc).not.toContain("data-drop-shoulder-edit-diagram");
    expect(sleevelessRendererSrc).not.toContain("dropShoulderSleeveBodyPath");
    expect(sleevelessPatternPage).toContain("PatternSummaryEditWorkspace");
    expect(measurementsPageSrc).toContain("buildSleevelessEditMeasurementDiagramSvg");
    expect(measurementsPageSrc).toContain("buildDropShoulderEditMeasurementDiagramSvg");
    expect(measurementsPageSrc).toContain("adoptDropShoulderGeneratedMeasurementArt");
    expect(measurementsPageSrc).toMatch(
      /sleevelessMeasurementArtRefreshImpl\?\.\(\);\s*$/m,
    );
  });
});

describe("Drop Shoulder edit measurement diagram — helpers reused", () => {
  it("reuses measurement body frame, sleeve trapezoid, and hang angle", () => {
    const frame = buildDropShoulderMeasurementBodyFrame(BASE);
    expect(frame.left).toBeLessThan(frame.right);
    expect(frame.top).toBeLessThan(frame.armholeMarkerY);
    const sleeve = buildDropShoulderMeasurementSleeveFrame({
      upperArmWidthPx: 40,
      cuffWidthPx: 20,
      sleeveLengthPx: 80,
      cuffDepthPx: 10,
    });
    expect(dropShoulderSleeveBodyPath(sleeve)).not.toMatch(/[QC]/);
    expect(dropShoulderEditSleeveRotateDeg("right")).toBe(-90 + DROP_SHOULDER_EDIT_SLEEVE_HANG_DEG);
    expect(dropShoulderEditSleeveRotateDeg("left")).toBe(90 - DROP_SHOULDER_EDIT_SLEEVE_HANG_DEG);
    expect(rendererSrc).toContain("buildDropShoulderMeasurementBodyFrame");
    expect(rendererSrc).toContain("buildDropShoulderMeasurementSleeveFrame");
    expect(rendererSrc).toContain("dropShoulderFrontBodyPath");
  });
});
