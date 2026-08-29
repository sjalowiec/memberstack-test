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
  DROP_SHOULDER_EDIT_BODY_MEASUREMENT_TARGET_IDS,
  DROP_SHOULDER_EDIT_SLEEVE_MEASUREMENT_TARGET_IDS,
  buildDropShoulderEditMeasurementDiagramModel,
  buildDropShoulderEditMeasurementDiagramSvg,
  buildDropShoulderEditSleeveFrameFromMeasurements,
  dropShoulderEditBodyWidthXAt,
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
import { dropShoulderSleeveBodyPath } from "./dropShoulderSleeveDiagramSvgShared";

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
const measurementsCss = readFileSync(
  resolve("src/styles/sleeveless-custom-build-measurements.css"),
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
    piece?: "body" | "sleeve";
  } = {},
): string {
  const { neckline, garment, unit, piece, ...meas } = overrides;
  return buildDropShoulderEditMeasurementDiagramSvg(
    {
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
    },
    piece,
  );
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

function bodyOutlineD(svg: string): string {
  return /data-role="body-outline"[^>]*\sd="([^"]+)"/.exec(svg)?.[1] ?? "";
}

function sleeveOutlineD(svg: string): string {
  return /data-role="sleeve-outline"[^>]*\sd="([^"]+)"/.exec(svg)?.[1] ?? "";
}

function sleeveBandFraction(frame: { top: number; bottom: number; cuffJoinY: number }): number {
  return Math.abs(frame.bottom - frame.cuffJoinY) / Math.max(1, frame.bottom - frame.top);
}

describe("Drop Shoulder edit measurement diagram — Body tab SVG", () => {
  it("renders one body-only SVG with no attached sleeves", () => {
    const svg = svgFor();
    expect(svgRootCount(svg)).toBe(1);
    expect(svg).toContain('data-drop-shoulder-edit-diagram="true"');
    expect(svg).toContain('data-drop-shoulder-edit-piece="body"');
    expect(svg).not.toContain('data-integrated-garment="true"');
    expect(svg).not.toContain('data-sleeve-count="2"');
    expect(svg).not.toContain('data-role="sleeve"');
    expect(svg).not.toContain('data-role="sleeve-outline"');
    expect(svg).not.toContain('data-sleeve-side="left"');
    expect(svg).not.toContain('data-sleeve-side="right"');
    expect(summarySvg).toContain('id="body"');
    expect(summarySvg).toContain('id="sleeve"');
    expect(rendererSrc).not.toContain("drop_shoulder_summary.svg");
    expect(rendererSrc).not.toContain("DROP_SHOULDER_EDIT_SLEEVE_HANG");
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

  it("includes body overlay targets only", () => {
    const svg = svgFor({ piece: "body" });
    for (const id of DROP_SHOULDER_EDIT_BODY_MEASUREMENT_TARGET_IDS) {
      expect(svg).toContain(`id="${id}"`);
    }
    for (const id of DROP_SHOULDER_EDIT_SLEEVE_MEASUREMENT_TARGET_IDS) {
      expect(svg).not.toContain(`id="${id}"`);
    }
  });
});

describe("Drop Shoulder edit measurement diagram — Sleeve tab SVG", () => {
  it("renders one standalone sleeve SVG using existing trapezoid geometry", () => {
    const svg = svgFor({ piece: "sleeve" });
    const frame = buildDropShoulderEditSleeveFrameFromMeasurements(BASE);
    expect(svgRootCount(svg)).toBe(1);
    expect(svg).toContain('data-drop-shoulder-edit-piece="sleeve"');
    expect(svg).toContain('data-sleeve-cap="false"');
    expect(svg).not.toContain('data-drop-shoulder-edit-piece="body"');
    expect(svg).not.toContain('data-role="body-outline"');
    expect(svg).not.toContain('data-integrated-garment="true"');
    expect(svg).not.toContain('data-sleeve-side="left"');
    expect(svg).not.toContain('data-sleeve-side="right"');
    expect(sleeveOutlineD(svg)).toBe(dropShoulderSleeveBodyPath(frame));
    expect(sleeveOutlineD(svg)).not.toMatch(/[QCCq]/);
    expect(rendererSrc).toContain("buildDropShoulderSleeveFrame");
    expect(rendererSrc).toContain("dropShoulderSleeveBodyPath");
  });

  it("includes sleeve overlay targets only", () => {
    const svg = svgFor({ piece: "sleeve" });
    for (const id of DROP_SHOULDER_EDIT_SLEEVE_MEASUREMENT_TARGET_IDS) {
      expect(svg).toContain(`id="${id}"`);
    }
    for (const id of DROP_SHOULDER_EDIT_BODY_MEASUREMENT_TARGET_IDS) {
      expect(svg).not.toContain(`id="${id}"`);
    }
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
    expect(roundSvg).not.toContain('data-role="sleeve-outline"');
    expect(round.frame.left).toBeLessThan(round.frame.midX);
    expect(round.frame.right).toBeGreaterThan(round.frame.midX);
  });
});

describe("Drop Shoulder edit measurement diagram — live measurements", () => {
  it("upper-arm measurement affects standalone sleeve top width", () => {
    const slim = buildDropShoulderEditSleeveFrameFromMeasurements({
      ...BASE,
      upperArmInches: 10,
      cuffCircumferenceInches: 16,
    });
    const wide = buildDropShoulderEditSleeveFrameFromMeasurements({
      ...BASE,
      upperArmInches: 16,
      cuffCircumferenceInches: 16,
    });
    expect(wide.upperRight - wide.upperLeft).toBeGreaterThan(slim.upperRight - slim.upperLeft);
    expect(svgFor({ piece: "sleeve", upperArmInches: 18 })).toContain('data-role="dim-upper-arm"');
    expect(bodyOutlineD(svgFor({ piece: "body", upperArmInches: 12 }))).toBe(
      bodyOutlineD(svgFor({ piece: "body", upperArmInches: 18 })),
    );
  });

  it("cuff measurement affects standalone sleeve bottom width", () => {
    const slim = buildDropShoulderEditSleeveFrameFromMeasurements({
      ...BASE,
      cuffCircumferenceInches: 6,
    });
    const wide = buildDropShoulderEditSleeveFrameFromMeasurements({
      ...BASE,
      cuffCircumferenceInches: 12,
    });
    expect(wide.wristRight - wide.wristLeft).toBeGreaterThan(slim.wristRight - slim.wristLeft);
  });

  it("sleeve length changes the cuff-to-body band ratio in the standalone sleeve", () => {
    const short = buildDropShoulderEditSleeveFrameFromMeasurements({
      ...BASE,
      sleeveLengthInches: 12,
    });
    const long = buildDropShoulderEditSleeveFrameFromMeasurements({
      ...BASE,
      sleeveLengthInches: 22,
    });
    expect(sleeveBandFraction(long)).toBeLessThan(sleeveBandFraction(short));
  });

  it("cuff depth affects the cuff band", () => {
    const shallow = buildDropShoulderEditSleeveFrameFromMeasurements({
      ...BASE,
      cuffDepthInches: 1,
    });
    const deep = buildDropShoulderEditSleeveFrameFromMeasurements({ ...BASE, cuffDepthInches: 3 });
    expect(sleeveBandFraction(deep)).toBeGreaterThan(sleeveBandFraction(shallow));
    expect(svgFor({ piece: "sleeve" })).toContain("data-sleeve-cuff-join");
  });

  it("body measurements affect body geometry and leave the sleeve outline unchanged", () => {
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
    expect(sleeveOutlineD(svgFor({ piece: "sleeve", bustInches: 36 }))).toBe(
      sleeveOutlineD(svgFor({ piece: "sleeve", bustInches: 48 })),
    );
  });

  it("keeps dimension lines but does not draw SVG numeric or unit values under overlay chips", () => {
    for (const piece of ["body", "sleeve"] as const) {
      const inches = svgFor({ unit: "in", piece });
      const cm = svgFor({ unit: "cm", piece });
      expect(inches).toContain('data-display-unit="in"');
      expect(cm).toContain('data-display-unit="cm"');
      expect(inches).not.toMatch(/<text\b/);
      expect(cm).not.toMatch(/<text\b/);
      expect(inches).not.toMatch(/\d+(\.\d+)? in/);
      expect(cm).not.toMatch(/\d+(\.\d+)? cm/);
    }
    const body = svgFor({ piece: "body" });
    for (const role of [
      "dim-neck-opening",
      "dim-neck-depth",
      "dim-armhole-depth",
      "dim-bust",
      "dim-garment-length",
      "dim-hip",
      "dim-hem-depth",
    ]) {
      expect(body).toContain(`data-role="${role}"`);
    }
    const sleeve = svgFor({ piece: "sleeve" });
    for (const role of ["dim-upper-arm", "dim-sleeve-length", "dim-cuff-circ", "dim-cuff-depth"]) {
      expect(sleeve).toContain(`data-role="${role}"`);
    }
    expect(measurementsPageSrc).toContain('label: "Neck opening"');
    expect(measurementsPageSrc).toContain('label: "Upper arm circ"');
    expect(measurementsPageSrc).toContain('label: "Sleeve length"');
  });

  it("unit switching still stamps display-unit on the SVG without baking values into the art", () => {
    for (const piece of ["body", "sleeve"] as const) {
      const inches = svgFor({ unit: "in", piece });
      const cm = svgFor({ unit: "cm", piece });
      expect(inches).toContain('data-display-unit="in"');
      expect(cm).toContain('data-display-unit="cm"');
      expect(inches).not.toContain(" cm</text>");
      expect(cm).not.toContain(" in</text>");
    }
  });

  it("uses Drop Shoulder end-cap dimension lines and existing overlay targets", () => {
    const body = svgFor({ piece: "body" });
    const sleeve = svgFor({ piece: "sleeve" });
    expect(rendererSrc).toContain("endCap(");
    expect(body).toContain('data-end-cap="true"');
    expect(endCap(10, 20, true)).toContain("<rect");
    expect(body).toContain(`id="${DROP_SHOULDER_SUMMARY_MEASUREMENT_TARGETS.bust}"`);
    expect(sleeve).toContain(`id="${DROP_SHOULDER_SUMMARY_MEASUREMENT_TARGETS.upperArm}"`);
    expect(sleeve).toContain(`id="${DROP_SHOULDER_SUMMARY_MEASUREMENT_TARGETS.cuffDepth}"`);
    expect(body).toContain('width="100%"');
    expect(sleeve).toContain('height="auto"');
    expect(body).toContain('preserveAspectRatio="xMidYMid meet"');
    expect(body).toMatch(/viewBox="0 0 /);
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
    expect(workspaceCss).not.toContain("ds-edit-preview-tabs");
  });

  it("responsive layout stacks below the shared 1100px container query", () => {
    expect(workspaceCss).toContain("@container sl-edit-workspace (max-width: 1099.98px)");
    expect(workspaceCss).toMatch(/\.sl-edit-workspace__layout \{[\s\S]*flex-direction: column/);
  });

  it("scopes Body/Sleeve preview tabs to Drop Shoulder measurement CSS", () => {
    expect(measurementsCss).toContain(".ds-edit-preview-tabs");
    expect(measurementsCss).toContain('[data-express-construction="drop-shoulder"]');
  });

  it("Sleeveless edit-page regression remains unchanged", () => {
    expect(sleevelessRendererSrc).toContain("data-sleeveless-edit-diagram");
    expect(sleevelessRendererSrc).not.toContain("data-drop-shoulder-edit-diagram");
    expect(sleevelessRendererSrc).not.toContain("dropShoulderSleeveBodyPath");
    expect(sleevelessPatternPage).toContain("PatternSummaryEditWorkspace");
    expect(measurementsPageSrc).toContain("buildSleevelessEditMeasurementDiagramSvg");
    expect(measurementsPageSrc).toContain("buildDropShoulderEditMeasurementDiagramSvg");
    expect(measurementsPageSrc).toContain("adoptDropShoulderGeneratedMeasurementArt");
    expect(measurementsPageSrc).toMatch(/sleevelessMeasurementArtRefreshImpl\?\.\(\);\s*$/m);
  });
});

describe("Drop Shoulder edit measurement diagram — helpers reused", () => {
  it("reuses measurement body frame and standalone sleeve trapezoid", () => {
    const frame = buildDropShoulderMeasurementBodyFrame(BASE);
    expect(frame.left).toBeLessThan(frame.right);
    expect(frame.top).toBeLessThan(frame.armholeMarkerY);
    const sleeve = buildDropShoulderEditSleeveFrameFromMeasurements(BASE);
    expect(dropShoulderSleeveBodyPath(sleeve)).not.toMatch(/[QC]/);
    expect(rendererSrc).toContain("buildDropShoulderMeasurementBodyFrame");
    expect(rendererSrc).toContain("buildDropShoulderSleeveFrame");
    expect(rendererSrc).toContain("dropShoulderFrontBodyPath");
    expect(rendererSrc).not.toContain("buildDropShoulderMeasurementSleeveFrame");
  });
});
