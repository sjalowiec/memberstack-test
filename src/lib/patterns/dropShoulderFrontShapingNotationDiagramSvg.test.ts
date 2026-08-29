import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { generateDropShoulderPattern } from "./dropShoulderPatternOutput";
import { generateSleevelessBackPattern } from "./sleevelessPatternOutput";
import { tryBuildLiveDropShoulderFrontStsRowsDiagramSvg } from "./dropShoulderFrontPatternDiagramSvg";
import { tryBuildLiveDropShoulderFrontNotationSvg } from "./dropShoulderFrontShapingNotationDiagramSvg";
import { tryBuildLiveSleevelessFrontRoundNotationSvg } from "./sleevelessFrontRoundShapingNotationDiagramSvg";
import { tryBuildLiveSleevelessFrontVNeckNotationSvg } from "./sleevelessFrontVNeckShapingNotationDiagramSvg";
import { buildDropShoulderFrontJapaneseNotationReplacements } from "./dropShoulderBodyJapaneseNotation";
import { kids10YrRelaxedArmhole36Pattern } from "./dropShoulderDiagramReviewFixtures";

function withStyle(
  base: Record<string, unknown>,
  styleOverrides: Record<string, unknown>,
  extraFit?: Record<string, number>,
): Record<string, unknown> {
  const style = (base.style ?? {}) as Record<string, unknown>;
  const fit = (base.fit ?? {}) as Record<string, unknown>;
  const measurements = (fit.selectedMeasurements ?? {}) as Record<string, number>;
  return {
    ...base,
    style: { ...style, ...styleOverrides },
    fit: extraFit
      ? {
          ...fit,
          selectedMeasurements: { ...measurements, ...extraFit },
        }
      : fit,
  };
}

function pathD(svg: string, className: string): string {
  const re = new RegExp(`class="${className}"[^>]*\\sd="([^"]+)"`);
  return re.exec(svg)?.[1] ?? "";
}

const BASE = kids10YrRelaxedArmhole36Pattern();

const COMBOS: Array<{
  name: string;
  garment: "pullover" | "cardigan";
  neckline: "round" | "v";
  bodyShape: "straight" | "aline" | "shaped";
  pattern: Record<string, unknown>;
}> = [
  {
    name: "Pullover Round straight",
    garment: "pullover",
    neckline: "round",
    bodyShape: "straight",
    pattern: BASE,
  },
  {
    name: "Pullover V-neck straight",
    garment: "pullover",
    neckline: "v",
    bodyShape: "straight",
    pattern: withStyle(BASE, { neckline: "v-neck" }),
  },
  {
    name: "Cardigan Round straight",
    garment: "cardigan",
    neckline: "round",
    bodyShape: "straight",
    pattern: withStyle(BASE, { frontStyle: "open", garmentStyle: "cardigan" }),
  },
  {
    name: "Cardigan V-neck straight",
    garment: "cardigan",
    neckline: "v",
    bodyShape: "straight",
    pattern: withStyle(BASE, {
      neckline: "v-neck",
      frontStyle: "open",
      garmentStyle: "cardigan",
    }),
  },
  {
    name: "Pullover Round A-line",
    garment: "pullover",
    neckline: "round",
    bodyShape: "aline",
    pattern: withStyle(BASE, { bodyShape: "aline" }, { finished_hip: 32, finished_bust_chest: 28 }),
  },
  {
    name: "Pullover V-neck A-line",
    garment: "pullover",
    neckline: "v",
    bodyShape: "aline",
    pattern: withStyle(
      BASE,
      { neckline: "v-neck", bodyShape: "aline" },
      { finished_hip: 32, finished_bust_chest: 28 },
    ),
  },
  {
    name: "Cardigan Round A-line",
    garment: "cardigan",
    neckline: "round",
    bodyShape: "aline",
    pattern: withStyle(
      BASE,
      { frontStyle: "open", garmentStyle: "cardigan", bodyShape: "aline" },
      { finished_hip: 32, finished_bust_chest: 28 },
    ),
  },
  {
    name: "Cardigan V-neck A-line",
    garment: "cardigan",
    neckline: "v",
    bodyShape: "aline",
    pattern: withStyle(
      BASE,
      { neckline: "v-neck", frontStyle: "open", garmentStyle: "cardigan", bodyShape: "aline" },
      { finished_hip: 32, finished_bust_chest: 28 },
    ),
  },
  {
    name: "Pullover Round shaped",
    garment: "pullover",
    neckline: "round",
    bodyShape: "shaped",
    pattern: withStyle(BASE, { bodyShape: "shaped" }, { finished_hip: 24 }),
  },
  {
    name: "Pullover V-neck shaped",
    garment: "pullover",
    neckline: "v",
    bodyShape: "shaped",
    pattern: withStyle(BASE, { neckline: "v-neck", bodyShape: "shaped" }, { finished_hip: 24 }),
  },
  {
    name: "Cardigan Round shaped",
    garment: "cardigan",
    neckline: "round",
    bodyShape: "shaped",
    pattern: withStyle(
      BASE,
      { frontStyle: "open", garmentStyle: "cardigan", bodyShape: "shaped" },
      { finished_hip: 24 },
    ),
  },
  {
    name: "Cardigan V-neck shaped",
    garment: "cardigan",
    neckline: "v",
    bodyShape: "shaped",
    pattern: withStyle(
      BASE,
      { neckline: "v-neck", frontStyle: "open", garmentStyle: "cardigan", bodyShape: "shaped" },
      { finished_hip: 24 },
    ),
  },
];

describe("tryBuildLiveDropShoulderFrontNotationSvg", () => {
  it.each(COMBOS)(
    "$name uses Drop Shoulder Front geometry and actual notation data",
    ({ garment, neckline, bodyShape, pattern }) => {
      const result = generateDropShoulderPattern(pattern);
      const live = tryBuildLiveDropShoulderFrontNotationSvg(result, pattern);
      const sts = tryBuildLiveDropShoulderFrontStsRowsDiagramSvg(result, pattern, "in");
      const repl = buildDropShoulderFrontJapaneseNotationReplacements(result, pattern);

      expect(live).toBeTruthy();
      expect(sts).toBeTruthy();
      expect(live).toContain('data-ds-front-generated-notation="true"');
      expect(live).toContain('data-ds-front-diagram="shaping-notation"');
      expect(live).toContain(`data-garment="${garment}"`);
      expect(live).toContain(`data-neckline="${neckline}"`);
      expect(live).toContain(`data-body-shape="${bodyShape}"`);
      expect(live).toContain('width="100%"');
      expect(live).toContain('height="auto"');
      expect(live).toContain('preserveAspectRatio="xMidYMid meet"');
      expect(pathD(live ?? "", "ds-front-diagram__body")).toBe(
        pathD(sts ?? "", "ds-front-diagram__body"),
      );

      expect(live).toContain(`data-front-neck-depth-rows="${result.debug.frontNeckDepthRows}"`);
      expect(live).toContain(`data-neck-bo="${repl["jp-neckline-bo"]}"`);
      expect(live).toContain('data-neck-notation-placement="inside-opening"');
      expect(live).toContain(`data-neck-shaping="${repl["jp-neckline-shaping"]}"`);
      expect(live).toContain(repl["jp-caston"]);
      expect(repl["jp-armhole-bo"]).toBe("");
      expect(repl["jp-shoulder-shaping"]).toBe("");
      expect(live).toContain('data-armhole-bo=""');
      expect(live).toContain('data-shoulder-shaping=""');
      expect(live).not.toContain('data-role="armhole-bo"');
      expect(live).not.toContain('data-role="shoulder-shaping"');
      expect(live).not.toContain("data-ds-front-sts-rows-generated");
      expect(live).not.toMatch(/\bNaN\b/);

      if (garment === "cardigan") {
        expect(live).toContain(">LEFT FRONT<");
        expect(live).toContain(">CF<");
        expect(live).toContain('data-center-front="true"');
        expect(live).toContain('data-neck-anchor="cf"');
      } else {
        expect(live).toContain(">FRONT<");
        expect(live).not.toContain("LEFT FRONT");
        expect(live).toContain('data-center-front="false"');
      }

      if (neckline === "v") {
        expect(repl["jp-neckline-bo"]).toBe("");
        expect(repl["jp-neckline-shaping"].length).toBeGreaterThan(0);
        expect(live).toContain('data-role="neck-shaping"');
        expect(live).not.toContain('data-role="neck-bo"');
      } else {
        expect(repl["jp-neckline-bo"].length).toBeGreaterThan(0);
        expect(live).toContain('data-role="neck-bo"');
        expect(live).toContain(repl["jp-neckline-bo"]);
      }
    },
  );

  it("keeps post-reset front neck RC at rc000", () => {
    const result = generateDropShoulderPattern(BASE);
    const live = tryBuildLiveDropShoulderFrontNotationSvg(result, BASE) ?? "";
    expect(live).toContain('data-reset="true"');
    expect(live).toContain('data-rc-neck-start="rc000"');
    expect(live).toContain('data-rc-reset="↺"');
    expect(live).not.toContain(
      `data-rc-neck-start="rc${String(result.debug.frontNecklineStartRC).padStart(3, "0")}"`,
    );
  });

  it("returns null for incomplete data and does not steal Sleeveless front notation", () => {
    expect(
      tryBuildLiveDropShoulderFrontNotationSvg({ debug: {} as never, isDropShoulder: true }, BASE),
    ).toBeNull();
    const sleeveless = generateSleevelessBackPattern(BASE);
    expect(tryBuildLiveDropShoulderFrontNotationSvg(sleeveless, BASE)).toBeNull();
    expect(
      tryBuildLiveSleevelessFrontRoundNotationSvg(sleeveless, BASE) ||
        tryBuildLiveSleevelessFrontVNeckNotationSvg(sleeveless, BASE),
    ).toBeTruthy();
  });
});

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

function textXs(svg: string, role: string): number[] {
  const re = new RegExp(`data-role="${role}"[^>]*\\sx="([^"]+)"`, "g");
  const xs: number[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(svg))) {
    xs.push(Number(m[1]));
  }
  return xs;
}

function notationTimingPattern(
  frontNeckDepth: number,
  extras: { neckline?: string; frontStyle?: string; garmentStyle?: string } = {},
): Record<string, unknown> {
  return {
    fit: {
      sizingChart: "women",
      selectedMeasurements: {
        finished_bust_chest: 40,
        back_neck_to_hem: 24,
        upper_arm: 13.4,
        wrist: 8,
        sleeve_length: 12,
        shoulder_width: 16,
        neck_opening: 7,
        back_neck_depth: 1,
        front_neck_depth: frontNeckDepth,
      },
    },
    yarnGaugeMachine: {
      gaugeStitchesPerInch: 5,
      gaugeRowsPerInch: 6,
      availableNeedles: 200,
    },
    style: {
      construction: "drop-shoulder",
      frontStyle: extras.frontStyle ?? "closed",
      garmentStyle: extras.garmentStyle ?? "pullover",
      neckline: extras.neckline ?? "round",
    },
  };
}

describe("Front Shaping Notation neck placement and RC timing", () => {
  it("places neckline shaping on the neck opening, not mid-body", () => {
    const pattern = notationTimingPattern(12);
    const result = generateDropShoulderPattern(pattern);
    const live = tryBuildLiveDropShoulderFrontNotationSvg(result, pattern) ?? "";
    const deepest = Number(svgAttr(live, "data-neck-notation-deepest-y"));
    const topish = Number(svgAttr(live, "data-armhole-marker-y"));
    expect(svgAttr(live, "data-neck-notation-placement")).toBe("inside-opening");
    const ys = [...textYs(live, "neck-shaping"), ...textYs(live, "neck-bo")];
    expect(ys.length).toBeGreaterThan(0);
    for (const y of ys) {
      expect(y).toBeGreaterThan(40);
      expect(y).toBeLessThanOrEqual(deepest + 1);
      expect(y).toBeLessThan(topish + (Number(svgAttr(live, "data-neck-bottom-y")) - topish) * 0.95);
    }
    const xs = [...textXs(live, "neck-shaping"), ...textXs(live, "neck-bo")];
    const labelX = Number(svgAttr(live, "data-neck-notation-x"));
    expect(xs.every((x) => Math.abs(x - labelX) < 1)).toBe(true);
    expect(live).toContain(buildDropShoulderFrontJapaneseNotationReplacements(result, pattern)["jp-neckline-shaping"].split("\n")[0]!);
  });

  it("keeps post-reset front neck RC at rc000 when the neckline starts after the armhole marker", () => {
    const result = generateDropShoulderPattern(BASE);
    expect(result.debug.frontNecklineStartRC).toBeGreaterThan(result.debug.armholeStartRow!);
    const live = tryBuildLiveDropShoulderFrontNotationSvg(result, BASE) ?? "";
    expect(live).toContain('data-reset="true"');
    expect(live).toContain('data-rc-neck-start="rc000"');
    expect(live).toContain('data-rc-reset="↺"');
    expect(live).toContain('data-neck-rc-continuous="false"');
  });

  it("uses continuous garment RC with no neckline reset when the neckline begins before the armhole", () => {
    const combos = [
      notationTimingPattern(12),
      notationTimingPattern(12, { neckline: "v-neck" }),
      notationTimingPattern(12, { frontStyle: "open", garmentStyle: "cardigan" }),
      notationTimingPattern(12, { neckline: "v-neck", frontStyle: "open", garmentStyle: "cardigan" }),
    ];
    for (const pattern of combos) {
      const result = generateDropShoulderPattern(pattern);
      expect(result.debug.frontNecklineStartRC).toBeLessThan(result.debug.armholeStartRow!);
      const live = tryBuildLiveDropShoulderFrontNotationSvg(result, pattern) ?? "";
      const garmentRc = `rc${String(result.debug.frontNecklineStartRC).padStart(3, "0")}`;
      const markerRc = `rc${String(result.debug.armholeStartRow).padStart(3, "0")}`;
      expect(live).toContain('data-reset="false"');
      expect(live).toContain(`data-rc-neck-start="${garmentRc}"`);
      expect(live).not.toContain('data-rc-neck-start="rc000"');
      expect(live).toContain('data-rc-reset=""');
      expect(live).not.toContain('data-role="rc-reset"');
      expect(live).toContain(`data-rc-armhole-marker="${markerRc}"`);
      expect(live).toContain('data-neck-rc-continuous="true"');
      expect(live).toContain('data-neck-notation-placement="inside-opening"');
    }
  });

  it("retains reset / local RC when the neckline starts at the armhole marker", () => {
    const pattern = notationTimingPattern(6.7);
    const result = generateDropShoulderPattern(pattern);
    expect(result.debug.frontNecklineStartRC).toBe(result.debug.armholeStartRow);
    const live = tryBuildLiveDropShoulderFrontNotationSvg(result, pattern) ?? "";
    expect(live).toContain('data-reset="true"');
    expect(live).toContain('data-rc-neck-start="rc000"');
    expect(live).toContain('data-rc-reset="↺"');
  });
});

describe("Drop Shoulder Front Shaping Notation hydration", () => {
  it("mounts generated Front Shaping Notation in tab 2 before the Illustrator fallback", () => {
    const pageScript = readFileSync(
      resolve("src/scripts/sleevelessPatternPageShared.ts"),
      "utf8",
    );
    const fnStart = pageScript.indexOf("async function inlineDropShoulderFrontNotationSvg");
    const fnEnd = pageScript.indexOf("function mountDropShoulderStsRowsSvgMarkup");
    const fn = pageScript.slice(fnStart, fnEnd > fnStart ? fnEnd : fnStart + 3500);
    expect(fn).toContain("tryBuildLiveDropShoulderFrontNotationSvg");
    expect(fn.indexOf("tryBuildLiveDropShoulderFrontNotationSvg")).toBeLessThan(
      fn.indexOf("applyJapaneseNotationSvgReplacements"),
    );
    expect(fn).toContain("DROP_SHOULDER_FRONT_DIAGRAM_NOTATION_ALT");
  });

  it("leaves Sleeveless front generated-first order unchanged", () => {
    const pageScript = readFileSync(
      resolve("src/scripts/sleevelessPatternPageShared.ts"),
      "utf8",
    );
    const fnStart = pageScript.indexOf("async function inlineFrontJapaneseNotationSvg");
    const fnEnd = pageScript.indexOf("async function hydrateSleevelessFrontDiagram");
    const fn = pageScript.slice(fnStart, fnEnd > fnStart ? fnEnd : fnStart + 2500);
    expect(fn.indexOf("tryBuildLiveSleevelessFrontVNeckNotationSvg")).toBeLessThan(
      fn.indexOf("tryBuildLiveSleevelessFrontRoundNotationSvg"),
    );
    expect(fn).not.toContain("tryBuildLiveDropShoulderFrontNotationSvg");
  });
});
