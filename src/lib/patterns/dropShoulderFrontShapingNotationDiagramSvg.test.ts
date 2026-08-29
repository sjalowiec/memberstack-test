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
