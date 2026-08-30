import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { generateDropShoulderPattern } from "./dropShoulderPatternOutput";
import { buildDropShoulderSleeveStitchesRowsModel } from "./dropShoulderSleeveDiagramModel";
import {
  tryBuildLiveDropShoulderSleeveStsRowsDiagramSvg,
} from "./dropShoulderSleevePatternDiagramSvg";
import { tryBuildLiveDropShoulderBackStsRowsDiagramSvg } from "./dropShoulderBackPatternDiagramSvg";
import { tryBuildLiveDropShoulderFrontStsRowsDiagramSvg } from "./dropShoulderFrontPatternDiagramSvg";
import { DS_ARROW } from "./dropShoulderPatternDiagramSvgShared";
import { buildSleevelessPatternDiagramTabsShellHtml } from "./sleevelessPatternDiagramTabs";

const TAPERED = {
  fit: {
    sizingChart: "women",
    selectedMeasurements: {
      finished_bust_chest: 40,
      back_neck_to_hem: 24,
      upper_arm: 16,
      wrist: 8,
      sleeve_length: 12,
      shoulder_width: 16,
      neck_opening_width: 7,
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

const STRAIGHT = {
  ...TAPERED,
  fit: {
    ...TAPERED.fit,
    selectedMeasurements: {
      ...TAPERED.fit.selectedMeasurements,
      wrist: 16,
      upper_arm: 16,
    },
  },
};

function pathD(svg: string, className: string): string {
  const match = svg.match(new RegExp(`<path class="${className}" d="([^"]+)"`));
  return match?.[1] ?? "";
}

function attr(svg: string, name: string): string {
  const match = svg.match(new RegExp(`${name}="([^"]*)"`));
  return match?.[1] ?? "";
}

describe("generated Drop Shoulder sleeve Stitches & Rows", () => {
  it("bottom-up shows wrist at the bottom, upper arm at the top, cuff depth, and total rows", () => {
    const result = generateDropShoulderPattern(TAPERED);
    const model = buildDropShoulderSleeveStitchesRowsModel(result, "cuff-up", "in")!;
    const svg = tryBuildLiveDropShoulderSleeveStsRowsDiagramSvg(result, "cuff-up", "in")!;

    expect(result.isDropShoulder).toBe(true);
    expect(model.wristStitches).toBe(result.debug.dropShoulderSleeveWristStitches);
    expect(model.topStitches).toBe(result.debug.dropShoulderSleeveTopStitches);
    expect(model.wristStitches).toBeLessThan(model.topStitches);
    expect(model.cuffRows).toBe(result.debug.dropShoulderSleeveCuffRows);
    expect(model.sleeveTotalRows).toBe(result.debug.dropShoulderSleeveTotalRows);
    expect(model.sleeveBodyRows).toBe(
      (result.debug.dropShoulderSleeveTotalRows ?? 0) -
        (result.debug.dropShoulderSleeveCuffRows ?? 0),
    );

    expect(svg).toContain('data-ds-sleeve-sts-rows-generated="true"');
    expect(svg).toContain('data-sleeve-direction="cuff-up"');
    expect(svg).toContain(`data-wrist-stitches="${model.wristStitches}"`);
    expect(svg).toContain(`data-top-stitches="${model.topStitches}"`);
    expect(svg).toContain(`data-cuff-rows="${model.cuffRows}"`);
    expect(svg).toContain(`data-sleeve-body-rows="${model.sleeveBodyRows}"`);
    expect(svg).toContain(`data-sleeve-total-rows="${model.sleeveTotalRows}"`);
    expect(svg).toContain(model.wristWidthLabel);
    expect(svg).toContain(model.topWidthLabel);
    expect(svg).toContain(model.cuffDepthLabel);
    expect(svg).toContain(model.sleeveBodyLengthLabel);
    expect(svg).toContain(model.sleeveTotalLengthLabel);
    expect(svg).toContain('data-wrist-width="true"');
    expect(svg).toContain('data-upper-arm-width="true"');
    expect(svg).toContain('data-cuff-depth="true"');
    expect(svg).toContain('width="100%"');
    expect(svg).toContain('height="auto"');
    expect(svg).toContain('preserveAspectRatio="xMidYMid meet"');
    expect(svg).toContain(`fill="${DS_ARROW}"`);

    const wristY = Number(attr(svg, "data-wrist-y"));
    const upperY = Number(attr(svg, "data-upper-arm-y"));
    const cuffJoinY = Number(attr(svg, "data-cuff-join-y"));
    expect(wristY).toBeGreaterThan(upperY);
    expect(cuffJoinY).toBeLessThan(wristY);
    expect(cuffJoinY).toBeGreaterThan(upperY);
    expect(pathD(svg, "ds-sleeve-diagram__body")).toMatch(/^M /);
    expect(svg).not.toMatch(/\bNaN\b/);
  });

  it("top-down flips the silhouette: wrist at the top, upper arm at the bottom", () => {
    const result = generateDropShoulderPattern(TAPERED);
    const svg = tryBuildLiveDropShoulderSleeveStsRowsDiagramSvg(result, "top-down", "in")!;
    const model = buildDropShoulderSleeveStitchesRowsModel(result, "top-down", "in")!;

    expect(svg).toContain('data-sleeve-direction="top-down"');
    expect(svg).toContain(`data-wrist-stitches="${model.wristStitches}"`);
    expect(svg).toContain(`data-top-stitches="${model.topStitches}"`);
    expect(svg).toContain(`data-sleeve-total-rows="${model.sleeveTotalRows}"`);
    expect(svg).toContain(model.wristWidthLabel);
    expect(svg).toContain(model.topWidthLabel);
    expect(svg).toContain(model.cuffDepthLabel);

    const wristY = Number(attr(svg, "data-wrist-y"));
    const upperY = Number(attr(svg, "data-upper-arm-y"));
    const cuffJoinY = Number(attr(svg, "data-cuff-join-y"));
    expect(wristY).toBeLessThan(upperY);
    expect(cuffJoinY).toBeGreaterThan(wristY);
    expect(cuffJoinY).toBeLessThan(upperY);
  });

  it("straight sleeves keep equal wrist and upper-arm widths with no cap", () => {
    const result = generateDropShoulderPattern(STRAIGHT);
    const model = buildDropShoulderSleeveStitchesRowsModel(result, "cuff-up", "in")!;
    const svg = tryBuildLiveDropShoulderSleeveStsRowsDiagramSvg(result, "cuff-up", "in")!;
    expect(model.wristStitches).toBe(model.topStitches);
    expect(svg).toContain(`data-wrist-stitches="${model.wristStitches}"`);
    expect(svg).toContain(`data-top-stitches="${model.topStitches}"`);
    expect(svg).not.toContain("sleeve cap");
    expect(svg).not.toContain("Sleeve cap");
  });

  it("returns null when required sleeve debug is missing so Illustrator can hydrate", () => {
    expect(
      tryBuildLiveDropShoulderSleeveStsRowsDiagramSvg(
        { debug: {} as never, isDropShoulder: true },
        "cuff-up",
      ),
    ).toBeNull();
    expect(
      tryBuildLiveDropShoulderSleeveStsRowsDiagramSvg(
        { debug: {} as never, isDropShoulder: false },
        "cuff-up",
      ),
    ).toBeNull();
  });

  it("does not change Front, Back, or sleeve math", () => {
    const result = generateDropShoulderPattern(TAPERED);
    const back = tryBuildLiveDropShoulderBackStsRowsDiagramSvg(result, TAPERED, "in");
    const front = tryBuildLiveDropShoulderFrontStsRowsDiagramSvg(result, TAPERED, "in");
    expect(back).toContain('data-ds-back-sts-rows-generated="true"');
    expect(front).toContain('data-ds-front-sts-rows-generated="true"');
    expect(result.debug.dropShoulderSleeveWristStitches).toBeGreaterThan(0);
    expect(result.debug.dropShoulderSleeveTopStitches).toBeGreaterThan(0);
    expect(result.debug.dropShoulderSleeveTotalRows).toBe(
      (result.debug.dropShoulderSleeveCuffRows ?? 0) +
        (result.debug.dropShoulderSleeveBodyRows ?? 0),
    );
  });
});

describe("Drop Shoulder sleeve diagram presentation", () => {
  it("mounts sleeve Stitches & Rows and Shaping Notation in the shared Garment Dimensions tabs", () => {
    const pageScript = readFileSync(
      resolve("src/scripts/sleevelessPatternPageShared.ts"),
      "utf8",
    );
    const mountStart = pageScript.indexOf("async function renderDropShoulderMount");
    const mountEnd = pageScript.indexOf("async function renderMount(");
    const mount = pageScript.slice(
      mountStart,
      mountEnd > mountStart ? mountEnd : mountStart + 12000,
    );

    expect(mount).toContain("sleeveWorkspaceOpts");
    expect(mount).toContain("sleeveDiagramModeToggle: true");
    expect(mount).toContain("enableVisualWorkspace: true");
    expect(mount).toContain("resolveDropShoulderSleeveNotationSvgSrc(sleeveDirection)");
    expect(mount).toContain("DROP_SHOULDER_SLEEVE_DIAGRAM_NOTATION_ALT");
    expect(mount).toContain("wrapSleevelessPieceSplit");
    expect(mount).toContain("renderDropShoulderSleeveConstructionToggleHtml(sleeveDirection)");
    const sleeveWrap = mount.slice(mount.lastIndexOf("sg-sleeve"));
    expect(sleeveWrap).toContain("wrapSleevelessPieceSplit");
    expect(sleeveWrap).not.toContain("wrapDropShoulderPieceSplit");
    expect(mount).toContain("initSleevelessPatternDiagramTabs(mount)");

    const html = buildSleevelessPatternDiagramTabsShellHtml({
      piece: "sleeve",
      stsRowsSrc: "/images/patterns/drop-shoulder/drop-body-sleeve.svg",
      stsRowsAlt: "Drop shoulder sleeve schematic",
      shapingSrc: "/images/patterns/drop-shoulder/JP-drop-body-sleeve.svg",
      shapingAlt: "Drop shoulder sleeve shaping notation diagram",
    });
    expect(html).toContain("Stitches &amp; Rows");
    expect(html).toContain("Shaping Notation");
    expect(html).toContain('data-sleeveless-sleeve-diagram-mode="sts-rows"');
    expect(html).toContain('data-sleeveless-sleeve-diagram-mode="shaping-notation"');
    expect(html).toContain("data-sleeveless-diagram-enlarge");
    expect(html).toContain("sleeveless-pattern-diagram-print-heading");
    expect(html).toContain("drop-body-sleeve.svg");
    expect(html).toContain("JP-drop-body-sleeve.svg");
    expect(pageScript).toContain("SLEEVELESS_DIAGRAM_PANEL_TITLE");
  });

  it("hydrates generated sleeve diagrams before Illustrator fallback", () => {
    const pageScript = readFileSync(
      resolve("src/scripts/sleevelessPatternPageShared.ts"),
      "utf8",
    );
    const stsStart = pageScript.indexOf("async function hydrateDropShoulderSleeveDiagram");
    const stsEnd = pageScript.indexOf("function bindDropShoulderSleeveDiagramMode");
    const sts = pageScript.slice(stsStart, stsEnd > stsStart ? stsEnd : stsStart + 2500);
    expect(sts.indexOf("tryBuildLiveDropShoulderSleeveStsRowsDiagramSvg")).toBeLessThan(
      sts.indexOf("inlineSvgWithReplacements"),
    );
    expect(sts).toContain("buildDropShoulderSleeveDiagramReplacements");
    expect(sts).toContain("resolveDropShoulderSleeveMeasurementSvgSrc");

    const jpStart = pageScript.indexOf("async function inlineDropShoulderSleeveNotationSvg");
    const jpEnd = pageScript.indexOf("async function hydrateDropShoulderSleeveDiagram");
    const jp = pageScript.slice(jpStart, jpEnd > jpStart ? jpEnd : jpStart + 2800);
    expect(jp.indexOf("tryBuildLiveDropShoulderSleeveNotationSvg")).toBeLessThan(
      jp.indexOf("applyJapaneseNotationSvgReplacements"),
    );
    expect(jp).toContain("resolveDropShoulderSleeveNotationSvgSrc");
    expect(jp).toContain("buildDropShoulderSleeveJapaneseNotationReplacements");
  });

  it("does not duplicate sleeve Shaping Notation in Visual Guides", () => {
    const pageScript = readFileSync(
      resolve("src/scripts/sleevelessPatternPageShared.ts"),
      "utf8",
    );
    const optsStart = pageScript.indexOf("const dropShoulderVisualGuidesOpts = (piece, extras = {}) => {");
    const optsEnd = pageScript.indexOf("const renderPiece = (rows, pieceId, chartTableMountId, neckChartStartRow, pieceDisplayOpts)");
    const opts = pageScript.slice(
      optsStart,
      optsEnd > optsStart ? optsEnd : optsStart + 1600,
    );
    expect(opts).toMatch(/piece === "sleeve"[\s\S]*return undefined/);
    expect(opts).not.toMatch(/piece === "sleeve"[\s\S]*notationSupported:\s*true/);
    const bodyBranch = opts.slice(opts.indexOf("if (!bodyNotationSupported)"));
    expect(bodyBranch).toContain("notationSupported: false");
    expect(bodyBranch).toContain("shapingMapData:");
  });

  it("keeps enlarge/modal and print wiring on the shared sleeve tab hosts", () => {
    const pageScript = readFileSync(
      resolve("src/scripts/sleevelessPatternPageShared.ts"),
      "utf8",
    );
    const mountStart = pageScript.indexOf("async function renderDropShoulderMount");
    const mountEnd = pageScript.indexOf("async function renderMount(");
    const mount = pageScript.slice(
      mountStart,
      mountEnd > mountStart ? mountEnd : mountStart + 14000,
    );
    expect(mount).toContain("bindSleevelessDiagramZoom(mount)");
    expect(mount).toContain("initSleevelessPatternDiagramTabs(mount)");
    expect(mount).toContain("bindDropShoulderSleeveConstructionToggle(mount)");
  });
});
