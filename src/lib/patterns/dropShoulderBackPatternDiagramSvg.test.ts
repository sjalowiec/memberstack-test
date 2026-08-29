import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildDropShoulderBackStitchesRowsSvg,
  tryBuildLiveDropShoulderBackStsRowsDiagramSvg,
} from "./dropShoulderBackPatternDiagramSvg";
import {
  kids10YrRelaxedArmhole36Pattern,
  kids10YrRelaxedDropShoulderPattern,
} from "./dropShoulderDiagramReviewFixtures";
import { generateDropShoulderPattern } from "./dropShoulderPatternOutput";
import { buildDropShoulderBackStitchesRowsModel } from "./dropShoulderPatternDiagramModel";
import { lengthFromRowsForDiagram } from "./sleevelessRowAccounting";

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

describe("buildDropShoulderBackStitchesRowsModel", () => {
  it("copies stitch and row counts from the pattern result (no new math)", () => {
    const result = generateDropShoulderPattern(WOMEN_STRAIGHT);
    const model = buildDropShoulderBackStitchesRowsModel(result, "in");
    expect(model).not.toBeNull();
    expect(model!.hemStitches).toBe(
      Math.round(result.debug.hemCastOnStitches || result.debug.backStitches),
    );
    expect(model!.bodyWidthStitches).toBe(Math.round(result.debug.backStitches));
    expect(model!.necklineStitches).toBe(Math.round(result.debug.necklineStitches ?? 0));
    expect(model!.shoulderStitchesEach).toBe(Math.round(result.debug.shoulderStitches ?? 0));
    expect(model!.hemRows).toBe(Math.round(result.debug.hemRows));
    expect(model!.bodyRowsToArmhole).toBe(Math.round(result.debug.bodyRows));
    expect(model!.armholeRows).toBe(Math.round(result.debug.armholeRows));
    expect(model!.backNeckDepthRows).toBe(Math.round(result.debug.backNeckDepthRows));
  });

  it("keeps post-reset neckline rows inside the armhole span", () => {
    const result = generateDropShoulderPattern(WOMEN_STRAIGHT);
    const model = buildDropShoulderBackStitchesRowsModel(result, "in")!;
    expect(model.necklineRowsInsideArmhole + model.armholeEvenRows).toBe(model.armholeRows);
    expect(model.necklineRowsInsideArmhole).toBe(model.backNeckDepthRows);
    expect(model.necklineRowsInsideArmhole).toBeLessThan(model.armholeRows);
  });
});

describe("buildDropShoulderBackStitchesRowsSvg", () => {
  it("Kids 10 relaxed at 21/32 over 4 in: armhole span uses full debug.armholeRows", () => {
    const result = generateDropShoulderPattern(kids10YrRelaxedDropShoulderPattern());
    const model = buildDropShoulderBackStitchesRowsModel(result, "in")!;
    const svg = buildDropShoulderBackStitchesRowsSvg(model);

    expect(model.armholeRows).toBe(result.debug.armholeRows);
    expect(svg).toContain(`data-armhole-rows="${result.debug.armholeRows}"`);
    expect(model.necklineRowsInsideArmhole + model.armholeEvenRows).toBe(model.armholeRows);
    expect(svg).toContain(`data-neckline-rows-inside-armhole="${model.necklineRowsInsideArmhole}"`);
    expect(svg).toContain("Armhole depth");
    expect(svg).toContain(model.armholeDepthLabel);
    expect(svg).toContain(`data-hem-stitches="${result.debug.hemCastOnStitches ?? result.debug.backStitches}"`);
    expect(svg).toContain(`data-neckline-stitches="${Math.round(result.debug.necklineStitches ?? 0)}"`);
    expect(svg).toContain(`data-shoulder-stitches="${Math.round(result.debug.shoulderStitches ?? 0)}"`);
    expect(svg).toContain(`data-hem-rows="${Math.round(result.debug.hemRows)}"`);
    expect(svg).toContain(`data-body-rows="${Math.round(result.debug.bodyRows)}"`);
    expect(svg).toContain(model.hemStitchesLabel);
    expect(svg).toContain(model.shoulderStitchesLabel);
    expect(svg).not.toMatch(/\bNaN\b/);
  });

  it("review example: Armhole depth 36 rows / 4.5 in as one span with neckline inside", () => {
    const result = generateDropShoulderPattern(kids10YrRelaxedArmhole36Pattern());
    expect(result.debug.armholeRows).toBe(36);
    expect(result.debug.rowsPerInch).toBe(8);
    expect(lengthFromRowsForDiagram(36, 8, "in")).toBe(4.5);
    expect(result.debug.backNeckDepthRows).toBe(8);

    const model = buildDropShoulderBackStitchesRowsModel(result, "in")!;
    expect(model.armholeRows).toBe(36);
    expect(model.necklineRowsInsideArmhole).toBe(8);
    expect(model.armholeEvenRows).toBe(28);
    expect(model.armholeDepthLabel).toBe("36 rows / 4.5 in");

    const svg = buildDropShoulderBackStitchesRowsSvg(model);
    expect(svg).toContain("Armhole depth");
    expect(svg).toContain("36 rows / 4.5 in");
    expect(svg).toContain('data-armhole-rows="36"');
    expect(svg).toContain('data-neckline-rows-inside-armhole="8"');
    expect(svg).toContain('data-armhole-even-rows="28"');
    expect(svg).toContain('data-armhole-marker="true"');
    expect(svg).toContain('data-body-width="true"');
    expect(svg).toContain('data-neckline-width-dim="true"');
    expect(svg).toContain('data-neckline-depth-dim="true"');
    expect(svg).toContain(model.bodyWidthLabel);
    expect(svg).toContain(model.necklineWidthLabel);
    expect(svg).toContain(model.necklineDepthLabel);
    expect(svg).toContain('width="100%"');
    expect(svg).toContain('height="auto"');
    expect(svg).toContain('preserveAspectRatio="xMidYMid meet"');
    expect(svg).toContain('viewBox="0 0 430 520"');
    expect(svg).toContain('data-ds-back-sts-rows-generated="true"');
    expect(svg).toContain('data-supported="true"');
    expect(svg).not.toContain("generated preview");
  });

  it("does not change Drop Shoulder calculation output", () => {
    const a = generateDropShoulderPattern(WOMEN_STRAIGHT);
    const b = generateDropShoulderPattern(WOMEN_STRAIGHT);
    expect(a.debug).toEqual(b.debug);
    expect(a.lines).toEqual(b.lines);
    const model = buildDropShoulderBackStitchesRowsModel(a, "in")!;
    buildDropShoulderBackStitchesRowsSvg(model);
    const c = generateDropShoulderPattern(WOMEN_STRAIGHT);
    expect(c.debug).toEqual(a.debug);
    expect(c.lines).toEqual(a.lines);
  });
});

describe("tryBuildLiveDropShoulderBackStsRowsDiagramSvg", () => {
  it("returns live generated SVG for straight body", () => {
    const result = generateDropShoulderPattern(WOMEN_STRAIGHT);
    const live = tryBuildLiveDropShoulderBackStsRowsDiagramSvg(result, WOMEN_STRAIGHT, "in");
    expect(live).toBeTruthy();
    expect(live).toContain('data-ds-back-sts-rows-generated="true"');
    expect(live).toContain('preserveAspectRatio="xMidYMid meet"');
  });

  it("returns live generated SVG for A-line body", () => {
    const pattern = kids10YrRelaxedArmhole36Pattern();
    const aline = {
      ...pattern,
      style: { ...(pattern.style as Record<string, unknown>), bodyShape: "aline" },
      fit: {
        ...(pattern.fit as Record<string, unknown>),
        selectedMeasurements: {
          ...((pattern.fit as { selectedMeasurements?: Record<string, number> }).selectedMeasurements ??
            {}),
          finished_hip: 32,
          finished_bust_chest: 28,
        },
      },
    };
    const result = generateDropShoulderPattern(aline);
    const live = tryBuildLiveDropShoulderBackStsRowsDiagramSvg(result, aline, "in");
    expect(live).toBeTruthy();
    expect(live).toContain('data-supported="true"');
    const hem = Number(/data-hem-stitches="(\d+)"/.exec(live ?? "")?.[1]);
    const body = Number(/data-body-width-stitches="(\d+)"/.exec(live ?? "")?.[1]);
    expect(hem).toBeGreaterThan(body);
  });

  it("returns live generated SVG for shaped body (hem narrower than bust)", () => {
    const shaped = {
      ...WOMEN_STRAIGHT,
      style: { ...WOMEN_STRAIGHT.style, bodyShape: "shaped" },
      fit: {
        ...WOMEN_STRAIGHT.fit,
        selectedMeasurements: {
          ...WOMEN_STRAIGHT.fit.selectedMeasurements,
          finished_hip: 36,
        },
      },
    };
    const result = generateDropShoulderPattern(shaped);
    expect(result.debug.hemCastOnStitches).toBeLessThan(result.debug.bustBodyStitches!);
    const live = tryBuildLiveDropShoulderBackStsRowsDiagramSvg(result, shaped, "in");
    expect(live).toBeTruthy();
    expect(live).toContain('data-ds-back-sts-rows-generated="true"');
    const hem = Number(/data-hem-stitches="(\d+)"/.exec(live ?? "")?.[1]);
    const body = Number(/data-body-width-stitches="(\d+)"/.exec(live ?? "")?.[1]);
    expect(hem).toBeGreaterThan(0);
    expect(body).toBeGreaterThan(0);
    expect(hem).toBeLessThan(body);
  });

  it("returns null when required debug fields are missing", () => {
    expect(
      tryBuildLiveDropShoulderBackStsRowsDiagramSvg({ debug: {} as never }, WOMEN_STRAIGHT),
    ).toBeNull();
  });
});

describe("Drop Shoulder pattern page wiring (presentation)", () => {
  it("hydrates generated Back Stitches & Rows before the Illustrator fallback", () => {
    const pageScript = readFileSync(
      resolve("src/scripts/sleevelessPatternPageShared.ts"),
      "utf8",
    );
    expect(pageScript).toContain("tryBuildLiveDropShoulderBackStsRowsDiagramSvg");
    expect(pageScript).toContain("tryBuildLiveDropShoulderFrontStsRowsDiagramSvg");
    expect(pageScript).not.toContain("appendGeneratedDropShoulderBackStsRowsCompare");
    expect(pageScript).not.toContain("appendGeneratedDropShoulderFrontStsRowsCompare");
    expect(pageScript).not.toContain("data-ds-generated-back-compare");
    expect(pageScript).not.toContain("Generated (preview)");

    const fnStart = pageScript.indexOf("async function hydrateDropShoulderBackDiagram");
    expect(fnStart).toBeGreaterThan(-1);
    const fnEnd = pageScript.indexOf("async function hydrateDropShoulderFrontDiagram");
    const fn = pageScript.slice(fnStart, fnEnd > fnStart ? fnEnd : fnStart + 2800);
    expect(fn.indexOf('mode === "shaping-notation"')).toBeLessThan(
      fn.indexOf("tryBuildLiveDropShoulderBackStsRowsDiagramSvg"),
    );
    expect(fn.indexOf("tryBuildLiveDropShoulderBackStsRowsDiagramSvg")).toBeLessThan(
      fn.indexOf("inlineSvgWithReplacements"),
    );
    expect(fn).toContain("inlineDropShoulderBackNotationSvg");
    expect(fn).not.toContain("tryBuildLiveSleevelessBackStsRowsDiagramSvg");

    const notationStart = pageScript.indexOf("async function inlineDropShoulderBackNotationSvg");
    const notationEnd = pageScript.indexOf("async function inlineDropShoulderFrontNotationSvg");
    const notationFn = pageScript.slice(
      notationStart,
      notationEnd > notationStart ? notationEnd : notationStart + 2500,
    );
    expect(notationFn.indexOf("tryBuildLiveDropShoulderBackNotationSvg")).toBeLessThan(
      notationFn.indexOf("applyJapaneseNotationSvgReplacements"),
    );

    const frontStart = pageScript.indexOf("async function hydrateDropShoulderFrontDiagram");
    const frontEnd = pageScript.indexOf("function bindDropShoulderBodyDiagramMode");
    const frontFn = pageScript.slice(
      frontStart,
      frontEnd > frontStart ? frontEnd : frontStart + 2800,
    );
    expect(frontFn.indexOf("tryBuildLiveDropShoulderFrontStsRowsDiagramSvg")).toBeLessThan(
      frontFn.indexOf("inlineSvgWithReplacements"),
    );
    expect(frontFn).toContain("inlineDropShoulderFrontNotationSvg");
  });

  it("uses the Sleeveless visual workspace and 62/38 reading layout for Back and Front only", () => {
    const pageScript = readFileSync(
      resolve("src/scripts/sleevelessPatternPageShared.ts"),
      "utf8",
    );
    const mountStart = pageScript.indexOf("async function renderDropShoulderMount");
    const mountEnd = pageScript.indexOf("async function renderMount(");
    const mount = pageScript.slice(
      mountStart,
      mountEnd > mountStart ? mountEnd : mountStart + 9000,
    );

    expect(mount).toContain("wrapSleevelessPieceSplit");
    expect(mount).toContain("enableVisualWorkspace: true");
    expect(mount).toMatch(/resolveDropShoulderBackDiagramSrc\(\s*"shaping-notation"/);
    expect(mount).toMatch(/resolveDropShoulderFrontDiagramSrc\(\s*"shaping-notation"/);
    expect(mount).toContain("initSleevelessPatternDiagramTabs(mount)");
    expect(mount).toContain("DROP_SHOULDER_BACK_DIAGRAM_NOTATION_ALT");
    expect(mount).toContain("DROP_SHOULDER_FRONT_DIAGRAM_NOTATION_ALT");

    const sleeveWrap = mount.slice(mount.lastIndexOf("sg-sleeve"));
    expect(sleeveWrap).toContain("wrapDropShoulderPieceSplit");
    expect(sleeveWrap).not.toContain("wrapSleevelessPieceSplit");
    expect(sleeveWrap).not.toContain("enableVisualWorkspace");
  });

  it("keeps Shaping Map in Back/Front Visual Guides and does not duplicate notation there", () => {
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
    expect(opts).toContain('if (piece === "sleeve")');
    expect(opts).toMatch(/piece === "sleeve"[\s\S]*notationSupported:\s*true/);
    const sleeveBranchEnd = opts.indexOf("if (!bodyNotationSupported)");
    const bodyBranch = opts.slice(sleeveBranchEnd);
    expect(bodyBranch).toContain("notationSupported: false");
    expect(bodyBranch).toContain("shapingMapData:");
  });

  it("does not change Sleeveless generated-first hydration", () => {
    const pageScript = readFileSync(
      resolve("src/scripts/sleevelessPatternPageShared.ts"),
      "utf8",
    );
    const fnStart = pageScript.indexOf("async function hydrateSleevelessBackDiagram");
    const fnEnd = pageScript.indexOf("function bindSleevelessBackDiagramMode");
    const fn = pageScript.slice(fnStart, fnEnd > fnStart ? fnEnd : fnStart + 2800);
    expect(fn).toContain("tryBuildLiveSleevelessBackStsRowsDiagramSvg");
    expect(fn).not.toContain("tryBuildLiveDropShoulderBackStsRowsDiagramSvg");

    const sleevelessMountStart = pageScript.indexOf("const backWrapped = wrapSleevelessPieceSplit");
    expect(sleevelessMountStart).toBeGreaterThan(-1);
    const sleevelessHydrate = pageScript.slice(
      pageScript.indexOf("async function hydrateSleevelessBackDiagram"),
      pageScript.indexOf("function bindSleevelessBackDiagramMode"),
    );
    expect(sleevelessHydrate).toContain("tryBuildLiveSleevelessBackStsRowsDiagramSvg");
  });
});
