import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { generateDropShoulderPattern } from "./dropShoulderPatternOutput";
import { generateSleevelessBackPattern } from "./sleevelessPatternOutput";
import { tryBuildLiveDropShoulderBackStsRowsDiagramSvg } from "./dropShoulderBackPatternDiagramSvg";
import { tryBuildLiveDropShoulderFrontStsRowsDiagramSvg } from "./dropShoulderFrontPatternDiagramSvg";
import { tryBuildLiveDropShoulderBackNotationSvg } from "./dropShoulderBackShapingNotationDiagramSvg";
import { tryBuildLiveDropShoulderFrontNotationSvg } from "./dropShoulderFrontShapingNotationDiagramSvg";
import { tryBuildLiveSleevelessBackNotationSvg } from "./sleevelessBackShapingNotationDiagramSvg";
import { buildDropShoulderBackJapaneseNotationReplacements } from "./dropShoulderBodyJapaneseNotation";
import { kids10YrRelaxedArmhole36Pattern } from "./dropShoulderDiagramReviewFixtures";
import { normalizeRoundNecklineDepthRows } from "./legoBlocks/roundNeckline";
import { buildDropShoulderBackStitchesRowsModel } from "./dropShoulderPatternDiagramModel";
import { formatRcNotation, formatRcResetNotation } from "./sleevelessBackJapaneseNotation";
import {
  buildFullWidthFrame,
  dropShoulderPulloverRoundBodyPath,
  fmtNum,
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

function withStyle(
  base: typeof WOMEN_STRAIGHT,
  styleOverrides: Record<string, unknown>,
  extraFit?: Record<string, number>,
): typeof WOMEN_STRAIGHT {
  return {
    ...base,
    style: { ...base.style, ...styleOverrides },
    fit: extraFit
      ? {
          ...base.fit,
          selectedMeasurements: {
            ...base.fit.selectedMeasurements,
            ...extraFit,
          },
        }
      : base.fit,
  };
}

function pathD(svg: string, className: string): string {
  const re = new RegExp(`class="${className}"[^>]*\\sd="([^"]+)"`);
  return re.exec(svg)?.[1] ?? "";
}

function svgAttr(svg: string, name: string): string {
  return new RegExp(`${name}="([^"]*)"`).exec(svg)?.[1] ?? "";
}

function textYs(svg: string, role: string): number[] {
  const re = new RegExp(`data-role="${role}"[^>]*\\sy="([^"]+)"`, "g");
  const ys: number[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(svg))) {
    ys.push(Number(m[1]));
  }
  return ys;
}

function duplicateXmlAttributes(svg: string): string[] {
  const dups: string[] = [];
  const tagRe = /<([A-Za-z][\w:-]*)([^>]*?)\/?>/g;
  let match: RegExpExecArray | null;
  while ((match = tagRe.exec(svg))) {
    const tag = match[1]!;
    const attrChunk = match[2] ?? "";
    const names = [...attrChunk.matchAll(/([:\w-]+)\s*=/g)].map((m) => m[1]!);
    const seen = new Set<string>();
    for (const name of names) {
      if (seen.has(name)) dups.push(`${tag}.${name}`);
      seen.add(name);
    }
  }
  return dups;
}

const BACK_COMBOS: Array<{
  name: string;
  bodyShape: "straight" | "aline" | "shaped";
  pattern: typeof WOMEN_STRAIGHT;
}> = [
  { name: "Pullover Round straight", bodyShape: "straight", pattern: WOMEN_STRAIGHT },
  {
    name: "Pullover V-neck straight",
    bodyShape: "straight",
    pattern: withStyle(WOMEN_STRAIGHT, { neckline: "v-neck" }),
  },
  {
    name: "Cardigan Round straight",
    bodyShape: "straight",
    pattern: withStyle(WOMEN_STRAIGHT, { frontStyle: "open", garmentStyle: "cardigan" }),
  },
  {
    name: "Cardigan V-neck straight",
    bodyShape: "straight",
    pattern: withStyle(WOMEN_STRAIGHT, {
      neckline: "v-neck",
      frontStyle: "open",
      garmentStyle: "cardigan",
    }),
  },
  {
    name: "Pullover Round A-line",
    bodyShape: "aline",
    pattern: withStyle(WOMEN_STRAIGHT, { bodyShape: "aline" }, { finished_hip: 44 }),
  },
  {
    name: "Pullover V-neck A-line",
    bodyShape: "aline",
    pattern: withStyle(
      WOMEN_STRAIGHT,
      { neckline: "v-neck", bodyShape: "aline" },
      { finished_hip: 44 },
    ),
  },
  {
    name: "Cardigan Round A-line",
    bodyShape: "aline",
    pattern: withStyle(
      WOMEN_STRAIGHT,
      { frontStyle: "open", garmentStyle: "cardigan", bodyShape: "aline" },
      { finished_hip: 44 },
    ),
  },
  {
    name: "Cardigan V-neck A-line",
    bodyShape: "aline",
    pattern: withStyle(
      WOMEN_STRAIGHT,
      { neckline: "v-neck", frontStyle: "open", garmentStyle: "cardigan", bodyShape: "aline" },
      { finished_hip: 44 },
    ),
  },
  {
    name: "Pullover Round shaped",
    bodyShape: "shaped",
    pattern: withStyle(WOMEN_STRAIGHT, { bodyShape: "shaped" }, { finished_hip: 36 }),
  },
  {
    name: "Pullover V-neck shaped",
    bodyShape: "shaped",
    pattern: withStyle(
      WOMEN_STRAIGHT,
      { neckline: "v-neck", bodyShape: "shaped" },
      { finished_hip: 36 },
    ),
  },
  {
    name: "Cardigan Round shaped",
    bodyShape: "shaped",
    pattern: withStyle(
      WOMEN_STRAIGHT,
      { frontStyle: "open", garmentStyle: "cardigan", bodyShape: "shaped" },
      { finished_hip: 36 },
    ),
  },
  {
    name: "Cardigan V-neck shaped",
    bodyShape: "shaped",
    pattern: withStyle(
      WOMEN_STRAIGHT,
      { neckline: "v-neck", frontStyle: "open", garmentStyle: "cardigan", bodyShape: "shaped" },
      { finished_hip: 36 },
    ),
  },
];

describe("tryBuildLiveDropShoulderBackNotationSvg", () => {
  it.each(BACK_COMBOS)(
    "$name generates Back Shaping Notation on Drop Shoulder Back geometry",
    ({ bodyShape, pattern }) => {
      const result = generateDropShoulderPattern(pattern);
      const live = tryBuildLiveDropShoulderBackNotationSvg(result, pattern);
      const sts = tryBuildLiveDropShoulderBackStsRowsDiagramSvg(result, pattern, "in");
      expect(live, `missing notation for ${bodyShape}`).toBeTruthy();
      expect(sts).toBeTruthy();
      expect(live).toContain('data-ds-back-generated-notation="true"');
      expect(live).toContain('data-ds-back-diagram="shaping-notation"');
      expect(live).toContain('data-supported="true"');
      expect(live).toContain(`data-body-shape="${bodyShape}"`);
      expect(live).toContain('width="100%"');
      expect(live).toContain('height="auto"');
      expect(live).toContain('preserveAspectRatio="xMidYMid meet"');
      expect(live).toContain('data-armhole-marker="true"');
      expect(live).toContain('data-armhole-marker-tick="left"');
      expect(live).toContain('data-armhole-marker-tick="right"');
      expect(live).toContain(">BACK<");
      expect(live).not.toContain('data-role="body-rows"');
      expect(live).not.toMatch(/\bNaN\b/);
      expect(pathD(live ?? "", "ds-back-diagram__body")).toBe(
        pathD(sts ?? "", "ds-back-diagram__body"),
      );
    },
  );

  it("uses the same Back body silhouette as generated Stitches & Rows", () => {
    const result = generateDropShoulderPattern(WOMEN_STRAIGHT);
    const sts = tryBuildLiveDropShoulderBackStsRowsDiagramSvg(result, WOMEN_STRAIGHT, "in");
    const notation = tryBuildLiveDropShoulderBackNotationSvg(result, WOMEN_STRAIGHT);
    expect(sts).toBeTruthy();
    expect(notation).toBeTruthy();
    expect(pathD(notation ?? "", "ds-back-diagram__body")).toBe(
      pathD(sts ?? "", "ds-back-diagram__body"),
    );
    expect(notation).not.toContain("data-ds-back-sts-rows-generated");
  });

  it("keeps vertical sides above the armhole marker", () => {
    const result = generateDropShoulderPattern(WOMEN_STRAIGHT);
    const model = buildDropShoulderBackStitchesRowsModel(result, "in")!;
    const frame = buildFullWidthFrame(model);
    const live = tryBuildLiveDropShoulderBackNotationSvg(result, WOMEN_STRAIGHT) ?? "";
    const expected = dropShoulderPulloverRoundBodyPath(frame);
    expect(pathD(live, "ds-back-diagram__body")).toBe(expected);
    expect(expected).toContain(`L ${fmtNum(frame.left)} ${fmtNum(frame.armholeMarkerY)}`);
    expect(expected).toContain(`L ${fmtNum(frame.left)} ${fmtNum(frame.top)}`);
    expect(expected).toContain(`L ${fmtNum(frame.right)} ${fmtNum(frame.top)}`);
    expect(expected).toContain(`L ${fmtNum(frame.right)} ${fmtNum(frame.armholeMarkerY)}`);
  });

  it("shows pre-reset garment RC, then ↺ rc000, and omits the Nr body-row label", () => {
    const result = generateDropShoulderPattern(WOMEN_STRAIGHT);
    const live = tryBuildLiveDropShoulderBackNotationSvg(result, WOMEN_STRAIGHT) ?? "";
    const expectedRows = normalizeRoundNecklineDepthRows(
      Math.round(1 * result.debug.rowsPerInch),
    );
    const garmentRc = formatRcNotation(result.debug.backNecklineStartRC);
    const reset = formatRcResetNotation(0);
    expect(result.debug.backNeckDepthRows).toBe(expectedRows);
    expect(live).toContain(`data-neck-depth-rows="${result.debug.backNeckDepthRows}"`);
    expect(live).toContain('data-reset="true"');
    expect(live).toContain(`data-rc-neck-start="${garmentRc}"`);
    expect(live).toContain(`data-rc-reset="${reset}"`);
    expect(live).toContain('data-role="rc-reset"');
    expect(live).toContain('data-role="neck-start-rc"');
    expect(live).toContain('data-role="armhole-marker-rc"');
    expect(live).toContain(reset);
    expect(live).not.toContain('data-role="body-rows"');
    const armholeRc = formatRcNotation(
      result.debug.armholeStartRow ?? result.debug.rowsFromCastOnToArmholeStart ?? 0,
    );
    expect(live).toContain(`data-rc-armhole-marker="${armholeRc}"`);
    expect(live).not.toContain('data-rc-neck-start="rc000"');
    const resetY = textYs(live, "rc-reset")[0];
    const neckStartY = textYs(live, "neck-start-rc")[0];
    expect(resetY).toBeDefined();
    expect(neckStartY).toBeDefined();
    expect(resetY!).toBeLessThan(neckStartY!);
  });

  it("caps Men's 5X back neck at 1 inch / 6 rows at 6 rpi", () => {
    const pattern = {
      fit: {
        sizingChart: "men",
        selectedSize: "5X",
        selectedMeasurements: {
          finished_bust_chest: 50,
          back_neck_to_hem: 29,
          armhole_depth: 12.5,
          neck_opening: 8.5,
          shoulder_width: 22,
          front_neck_depth: 6,
          back_neck_depth: 1.75,
          upper_arm: 22,
          wrist: 8.25,
          sleeve_length: 20,
        },
      },
      style: {
        construction: "drop-shoulder",
        constructionAuthored: "drop-shoulder",
        garmentStyle: "pullover",
        neckline: "round",
        frontStyle: "closed",
        recipientCategory: "men",
      },
      yarnGaugeMachine: {
        gaugeStitchesPerInch: 4,
        gaugeRowsPerInch: 6,
        availableNeedles: 200,
      },
    };
    const result = generateDropShoulderPattern(pattern);
    expect(result.debug.backNeckDepthRows).toBe(6);
    const live = tryBuildLiveDropShoulderBackNotationSvg(result, pattern) ?? "";
    expect(live).toContain('data-neck-depth-rows="6"');
    expect(live).not.toContain('data-neck-depth-rows="12"');
  });

  it("does not invent armhole bind-off or shoulder shaping", () => {
    const result = generateDropShoulderPattern(WOMEN_STRAIGHT);
    const repl = buildDropShoulderBackJapaneseNotationReplacements(result, WOMEN_STRAIGHT);
    expect(repl["jp-armhole-bo"]).toBe("");
    expect(repl["jp-armhole-shaping"]).toBe("");
    expect(repl["jp-shoulder-shaping"]).toBe("");
    const live = tryBuildLiveDropShoulderBackNotationSvg(result, WOMEN_STRAIGHT) ?? "";
    expect(live).toContain('data-armhole-bo=""');
    expect(live).toContain('data-armhole-shaping=""');
    expect(live).toContain('data-shoulder-shaping=""');
    expect(live).not.toContain('data-role="armhole-bo"');
    expect(live).not.toContain('data-role="armhole-shaping"');
    expect(live).not.toContain('data-role="shoulder-shaping"');
    expect(live).toContain('data-role="cast-on"');
    expect(live).toContain('data-role="neck-bo"');
    expect(live).toContain('data-role="neck-shaping"');
    expect(live).toContain(repl["jp-caston"]);
    expect(live).toContain(repl["jp-neckline-bo"]);
  });

  it("places A-line body shaping from existing notation data", () => {
    const pattern = {
      ...kids10YrRelaxedArmhole36Pattern(),
      style: {
        ...(kids10YrRelaxedArmhole36Pattern().style as Record<string, unknown>),
        bodyShape: "aline",
      },
      fit: {
        ...(kids10YrRelaxedArmhole36Pattern().fit as Record<string, unknown>),
        selectedMeasurements: {
          ...((kids10YrRelaxedArmhole36Pattern().fit as { selectedMeasurements?: Record<string, number> })
            .selectedMeasurements ?? {}),
          finished_hip: 32,
          finished_bust_chest: 28,
        },
      },
    };
    const result = generateDropShoulderPattern(pattern);
    const repl = buildDropShoulderBackJapaneseNotationReplacements(result, pattern);
    const live = tryBuildLiveDropShoulderBackNotationSvg(result, pattern) ?? "";
    expect(live).toContain('data-body-shape="aline"');
    if (repl["jp-body-shaping"]) {
      expect(live).toContain('data-role="body-shaping"');
      expect(live).toContain(repl["jp-body-shaping"].split("\n")[0]!);
    }
  });

  it("returns null when the Stitches & Rows model is missing so Illustrator can fall back", () => {
    expect(
      tryBuildLiveDropShoulderBackNotationSvg({ debug: {} as never, isDropShoulder: true }, WOMEN_STRAIGHT),
    ).toBeNull();
    const sleeveless = generateSleevelessBackPattern(WOMEN_STRAIGHT);
    expect(tryBuildLiveDropShoulderBackNotationSvg(sleeveless, WOMEN_STRAIGHT)).toBeNull();
    expect(tryBuildLiveSleevelessBackNotationSvg(sleeveless, WOMEN_STRAIGHT)).toBeTruthy();
  });
});

describe("Back Shaping Notation neck placement and RC (Back rules only)", () => {
  it("is well-formed XML with unique attributes on RC labels", () => {
    const result = generateDropShoulderPattern(WOMEN_STRAIGHT);
    const live = tryBuildLiveDropShoulderBackNotationSvg(result, WOMEN_STRAIGHT) ?? "";
    expect(live).toContain("<svg");
    expect(live).not.toMatch(/\bNaN\b/);
    expect(duplicateXmlAttributes(live)).toEqual([]);
    expect(live).not.toMatch(/\bdata-rc="[^"]*"\s+data-rc="/);
    expect(live).toContain('data-role="rc-reset"');
    expect(live).toContain('data-role="neck-start-rc"');
    expect(live).not.toMatch(/data-role="rc-reset"[^>]*data-rc="[^"]*"[^>]*data-rc="/);
    expect(live).not.toMatch(/data-role="neck-start-rc"[^>]*data-rc="[^"]*"[^>]*data-rc="/);
  });

  it("places neckline shaping at the Back neckline, not mid-body", () => {
    const result = generateDropShoulderPattern(WOMEN_STRAIGHT);
    const live = tryBuildLiveDropShoulderBackNotationSvg(result, WOMEN_STRAIGHT) ?? "";
    const deepest = Number(svgAttr(live, "data-neck-notation-deepest-y"));
    const armholeY = Number(svgAttr(live, "data-armhole-marker-y"));
    const neckBottomY = Number(svgAttr(live, "data-neck-bottom-y"));
    expect(svgAttr(live, "data-neck-notation-placement")).toBe("inside-opening");
    expect(svgAttr(live, "data-neck-anchor")).toBe("center");
    expect(live).toMatch(/data-role="neck-shaping"[^>]*text-anchor="middle"/);
    expect(deepest).toBeGreaterThan(0);
    expect(neckBottomY).toBeLessThan(armholeY);
    const ys = [...textYs(live, "neck-shaping"), ...textYs(live, "neck-bo")];
    expect(ys.length).toBeGreaterThan(0);
    for (const y of ys) {
      expect(y).toBeGreaterThan(20);
      expect(y).toBeLessThan(armholeY);
      expect(y).toBeLessThanOrEqual(deepest + 1);
    }
    expect(live).toContain(
      buildDropShoulderBackJapaneseNotationReplacements(result, WOMEN_STRAIGHT)[
        "jp-neckline-shaping"
      ].split("\n")[0]!,
    );
  });

  it("keeps Back reset / local RC:000 even when Front would use continuous garment RC", () => {
    const pattern = withStyle(WOMEN_STRAIGHT, {}, { front_neck_depth: 12 });
    const result = generateDropShoulderPattern({
      ...pattern,
      yarnGaugeMachine: {
        ...pattern.yarnGaugeMachine,
        gaugeRowsPerInch: 6,
      },
    });
    expect(result.debug.frontNecklineStartRC).toBeLessThan(result.debug.armholeStartRow!);
    expect(result.debug.backNecklineStartRC).toBeGreaterThanOrEqual(result.debug.armholeStartRow!);
    const live =
      tryBuildLiveDropShoulderBackNotationSvg(result, {
        ...pattern,
        yarnGaugeMachine: { ...pattern.yarnGaugeMachine, gaugeRowsPerInch: 6 },
      }) ?? "";
    expect(live).toContain('data-reset="true"');
    expect(live).toContain(`data-rc-neck-start="${formatRcNotation(result.debug.backNecklineStartRC)}"`);
    expect(live).toContain(`data-rc-reset="${formatRcResetNotation(0)}"`);
    expect(live).not.toContain('data-rc-neck-start="rc000"');
    expect(live).not.toContain('data-neck-begins-before-armhole');
    expect(live).not.toContain('data-neck-rc-continuous');
    expect(live).not.toContain('data-role="body-rows"');
  });
});

describe("Drop Shoulder Back Shaping Notation hydration", () => {
  it("mounts generated Shaping Notation in tab 2 before the Illustrator fallback", () => {
    const pageScript = readFileSync(
      resolve("src/scripts/sleevelessPatternPageShared.ts"),
      "utf8",
    );
    const fnStart = pageScript.indexOf("async function inlineDropShoulderBackNotationSvg");
    const fnEnd = pageScript.indexOf("async function inlineDropShoulderFrontNotationSvg");
    const fn = pageScript.slice(fnStart, fnEnd > fnStart ? fnEnd : fnStart + 3500);
    expect(fn).toContain("tryBuildLiveDropShoulderBackNotationSvg");
    expect(fn.indexOf("tryBuildLiveDropShoulderBackNotationSvg")).toBeLessThan(
      fn.indexOf("applyJapaneseNotationSvgReplacements"),
    );
    expect(fn).toContain("DROP_SHOULDER_BACK_DIAGRAM_NOTATION_ALT");
    expect(fn).toContain("resolveDropShoulderBackDiagramSvg(\"shaping-notation\"");
  });

  it("does not change Stitches & Rows hydration, Sleeveless hydration, or sleeve notation", () => {
    const pageScript = readFileSync(
      resolve("src/scripts/sleevelessPatternPageShared.ts"),
      "utf8",
    );
    const backHydrateStart = pageScript.indexOf("async function hydrateDropShoulderBackDiagram");
    const backHydrateEnd = pageScript.indexOf("async function hydrateDropShoulderFrontDiagram");
    const backHydrate = pageScript.slice(
      backHydrateStart,
      backHydrateEnd > backHydrateStart ? backHydrateEnd : backHydrateStart + 2800,
    );
    expect(backHydrate).toContain("tryBuildLiveDropShoulderBackStsRowsDiagramSvg");
    expect(backHydrate.indexOf('mode === "shaping-notation"')).toBeLessThan(
      backHydrate.indexOf("tryBuildLiveDropShoulderBackStsRowsDiagramSvg"),
    );

    const sleevelessStart = pageScript.indexOf("async function inlineBackJapaneseNotationSvg");
    const sleevelessEnd = pageScript.indexOf("function mountFrontStsRowsSvgMarkup");
    const sleeveless = pageScript.slice(
      sleevelessStart,
      sleevelessEnd > sleevelessStart ? sleevelessEnd : sleevelessStart + 2500,
    );
    expect(sleeveless).toContain("tryBuildLiveSleevelessBackNotationSvg");
    expect(sleeveless).not.toContain("tryBuildLiveDropShoulderBackNotationSvg");

    const sleeveStart = pageScript.indexOf("async function inlineDropShoulderSleeveNotationSvg");
    const sleeve = pageScript.slice(sleeveStart, sleeveStart + 2500);
    expect(sleeve).not.toContain("tryBuildLiveDropShoulderBackNotationSvg");
    expect(sleeve).not.toContain("tryBuildLiveDropShoulderFrontNotationSvg");
    expect(sleeve).toContain("buildDropShoulderSleeveJapaneseNotationReplacements");
  });

  it("does not change generated Front Shaping Notation or Front Stitches & Rows", () => {
    const result = generateDropShoulderPattern(WOMEN_STRAIGHT);
    const frontNotation = tryBuildLiveDropShoulderFrontNotationSvg(result, WOMEN_STRAIGHT);
    const frontSts = tryBuildLiveDropShoulderFrontStsRowsDiagramSvg(result, WOMEN_STRAIGHT, "in");
    const backNotation = tryBuildLiveDropShoulderBackNotationSvg(result, WOMEN_STRAIGHT);
    expect(frontNotation).toBeTruthy();
    expect(frontSts).toBeTruthy();
    expect(frontNotation).toContain('data-ds-front-generated-notation="true"');
    expect(frontNotation).toContain('data-neck-notation-placement="inside-opening"');
    expect(pathD(frontNotation ?? "", "ds-front-diagram__body")).toBe(
      pathD(frontSts ?? "", "ds-front-diagram__body"),
    );
    expect(backNotation).not.toContain("data-ds-front-generated-notation");
    expect(frontNotation).not.toContain("data-ds-back-generated-notation");
  });
});
