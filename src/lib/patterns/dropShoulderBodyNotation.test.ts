import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { generateDropShoulderPattern } from "./dropShoulderPatternOutput";
import {
  buildDropShoulderBackJapaneseNotationReplacements,
  buildDropShoulderFrontJapaneseNotationReplacements,
  isDropShoulderBodyJapaneseNotationSupported,
} from "./dropShoulderBodyJapaneseNotation";
import {
  DROP_SHOULDER_BODY_BACK_NOTATION_SRC,
  DROP_SHOULDER_BODY_BACK_STS_ROWS_SRC,
  DROP_SHOULDER_BODY_FRONT_NOTATION_SRC,
  DROP_SHOULDER_BODY_FRONT_STS_ROWS_SRC,
  buildDropShoulderBodyDiagramReplacements,
  resolveDropShoulderShoulderStitchesForDiagram,
  resolveDropShoulderBackDiagramSrc,
  resolveDropShoulderFrontDiagramSrc,
} from "./dropShoulderBodyNotationSvg";
import {
  applyJapaneseNotationSvgReplacements,
  assertJapaneseNotationSvgFullyReplaced,
  listJapaneseNotationPlaceholdersInSvg,
} from "./sleevelessJapaneseNotationSvg";
import { SLEEVELESS_BACK_JP_NOTATION_DIAGRAM_SRC } from "./sleevelessBackDiagramSrc";
import { SLEEVELESS_FRONT_JP_NOTATION_DIAGRAM_SRC } from "./sleevelessFrontJapaneseNotation";

function inlineSvgReplacements(
  svgText: string,
  replacements: Record<string, string>,
): string {
  let out = svgText.replace(/^\uFEFF/, "").replace(/^<\?xml[\s\S]*?\?>\s*/, "");
  for (const [k, v] of Object.entries(replacements)) {
    const safeKey = String(k).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`\\{\\{\\s*${safeKey}\\s*\\}\\}`, "g");
    out = out.replace(re, v == null ? "" : String(v));
  }
  return out;
}

/** Net open `<g>` depth after a full scan — must be 0 for well-formed SVG group nesting. */
function countSvgGroupTagDepth(svgText: string): number {
  let depth = 0;
  const re = /<\/?g[\s>]/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(svgText)) !== null) {
    if (match[0].startsWith("</")) depth -= 1;
    else depth += 1;
  }
  return depth;
}

/** Structural checks mirrored from browser `DOMParser` rejection in notation diagram hydration. */
function assertParseableSvgMarkup(svgText: string): void {
  expect(countSvgGroupTagDepth(svgText)).toBe(0);
  const normalized = svgText.replace(/^\uFEFF/, "").replace(/^<\?xml[\s\S]*?\?>\s*/, "");
  expect(normalized.trimStart().startsWith("<svg")).toBe(true);
  const openText = (normalized.match(/<text\b/gi) || []).length;
  const closeText = (normalized.match(/<\/text>/gi) || []).length;
  expect(openText).toBe(closeText);
}

const DROP_SHOULDER_BODY_BACK_NOTATION_TOKENS = [
  "jp-caston",
  "jp-body-rows",
  "jp-neckline-bo",
  "jp-neckline-shaping",
  "jp-armhole-bo",
  "rc-caston",
  "rc-hem",
  "rc-armhole-bo",
  "rc-neckline-start",
  "rc_reset",
] as const;

const DROP_SHOULDER_BODY_FRONT_NOTATION_TOKENS = [
  ...DROP_SHOULDER_BODY_BACK_NOTATION_TOKENS,
  "jp-armhole-shaping",
] as const;

const DROP_SHOULDER_PATTERN = {
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

describe("dropShoulderBodyNotationSvg", () => {
  it("uses the four canonical drop-shoulder body diagram paths only", () => {
    expect(DROP_SHOULDER_BODY_BACK_STS_ROWS_SRC).toBe(
      "/images/patterns/drop-shoulder/drop-body-back.svg",
    );
    expect(DROP_SHOULDER_BODY_FRONT_STS_ROWS_SRC).toBe(
      "/images/patterns/drop-shoulder/drop-body-front.svg",
    );
    expect(DROP_SHOULDER_BODY_BACK_NOTATION_SRC).toBe(
      "/images/patterns/drop-shoulder/jp-drop-body-back.svg",
    );
    expect(DROP_SHOULDER_BODY_FRONT_NOTATION_SRC).toBe(
      "/images/patterns/drop-shoulder/jp-drop-body-front.svg",
    );

    expect(DROP_SHOULDER_BODY_BACK_STS_ROWS_SRC).not.toContain("/body/");
    expect(DROP_SHOULDER_BODY_FRONT_STS_ROWS_SRC).not.toContain("/body/");
    expect(DROP_SHOULDER_BODY_BACK_NOTATION_SRC).not.toContain("sleeveless");
    expect(DROP_SHOULDER_BODY_FRONT_NOTATION_SRC).not.toContain("sleeveless");

    expect(resolveDropShoulderBackDiagramSrc("shaping-notation")).toBe(
      DROP_SHOULDER_BODY_BACK_NOTATION_SRC,
    );
    expect(resolveDropShoulderFrontDiagramSrc("shaping-notation")).toBe(
      DROP_SHOULDER_BODY_FRONT_NOTATION_SRC,
    );
    expect(resolveDropShoulderBackDiagramSrc("sts-rows")).toBe(DROP_SHOULDER_BODY_BACK_STS_ROWS_SRC);
    expect(resolveDropShoulderFrontDiagramSrc("sts-rows")).toBe(
      DROP_SHOULDER_BODY_FRONT_STS_ROWS_SRC,
    );

    expect(SLEEVELESS_BACK_JP_NOTATION_DIAGRAM_SRC).not.toBe(DROP_SHOULDER_BODY_BACK_NOTATION_SRC);
    expect(SLEEVELESS_FRONT_JP_NOTATION_DIAGRAM_SRC).not.toBe(DROP_SHOULDER_BODY_FRONT_NOTATION_SRC);
  });

  it("lists expected notation tokens in each drop-shoulder body notation SVG", () => {
    const backSvg = readFileSync(
      resolve(process.cwd(), "public" + DROP_SHOULDER_BODY_BACK_NOTATION_SRC),
      "utf8",
    );
    const frontSvg = readFileSync(
      resolve(process.cwd(), "public" + DROP_SHOULDER_BODY_FRONT_NOTATION_SRC),
      "utf8",
    );
    const backTokens = listJapaneseNotationPlaceholdersInSvg(backSvg);
    const frontTokens = listJapaneseNotationPlaceholdersInSvg(frontSvg);

    for (const token of DROP_SHOULDER_BODY_BACK_NOTATION_TOKENS) {
      expect(backTokens, `back SVG missing ${token}`).toContain(token);
    }
    for (const token of DROP_SHOULDER_BODY_FRONT_NOTATION_TOKENS) {
      expect(frontTokens, `front SVG missing ${token}`).toContain(token);
    }
  });

  it("processed drop-shoulder body notation SVG markup is structurally parseable", () => {
    const result = generateDropShoulderPattern(DROP_SHOULDER_PATTERN);
    for (const [rel, buildRepl] of [
      [
        DROP_SHOULDER_BODY_BACK_NOTATION_SRC,
        () => buildDropShoulderBackJapaneseNotationReplacements(result, DROP_SHOULDER_PATTERN),
      ],
      [
        DROP_SHOULDER_BODY_FRONT_NOTATION_SRC,
        () => buildDropShoulderFrontJapaneseNotationReplacements(result, DROP_SHOULDER_PATTERN),
      ],
    ] as const) {
      const svgText = readFileSync(resolve(process.cwd(), "public" + rel), "utf8");
      assertParseableSvgMarkup(svgText);
      const out = applyJapaneseNotationSvgReplacements(svgText, buildRepl());
      assertParseableSvgMarkup(out);
      expect(listJapaneseNotationPlaceholdersInSvg(out)).toEqual([]);
    }
  });
});

describe("dropShoulderBodyJapaneseNotation", () => {
  it("fills drop-shoulder back notation with center bind-off and neckline shaping", () => {
    const result = generateDropShoulderPattern(DROP_SHOULDER_PATTERN);
    expect(isDropShoulderBodyJapaneseNotationSupported(result)).toBe(true);

    const repl = buildDropShoulderBackJapaneseNotationReplacements(result, DROP_SHOULDER_PATTERN);
    const fullNeck = result.debug.necklineStitches ?? 0;
    expect(repl["jp-caston"]).toMatch(/^co\d+/);
    expect(repl["jp-body-rows"]).toMatch(/\d+r/);
    expect(repl["jp-armhole-bo"]).toBe("");
    expect(repl["jp-armhole-shaping"]).toBe("");
    expect(repl["jp-shoulder-shaping"]).toBe("");
    expect(repl["jp-neckline-bo"]).toMatch(/^bo\d+/);
    expect(repl["jp-neckline-shaping"].length).toBeGreaterThan(0);
    if (fullNeck > 0) {
      expect(repl["jp-neckline-bo"]).not.toBe(`bo${fullNeck}`);
    }
    expect(repl["rc-caston"]).toBe("rc000");
    expect(repl["rc-hem"]).toMatch(/^rc\d+/);
    expect(repl["rc-neckline-start"]).toMatch(/^rc\d+/);
  });

  it("places back neckline shaping at the neck callout, not the armhole callout", () => {
    const result = generateDropShoulderPattern(DROP_SHOULDER_PATTERN);
    const repl = buildDropShoulderBackJapaneseNotationReplacements(result, DROP_SHOULDER_PATTERN);
    const svgPath = resolve(process.cwd(), "public" + DROP_SHOULDER_BODY_BACK_NOTATION_SRC);
    const svgText = readFileSync(svgPath, "utf8");
    const out = applyJapaneseNotationSvgReplacements(svgText, repl);

    expect(repl["jp-neckline-shaping"].length).toBeGreaterThan(0);
    expect(out).toContain('transform="translate(40.6 28.83)"');
    expect(out).toMatch(/translate\(40\.6 28\.83\)"[^>]*>[\s\S]*?1s-2r|3s-2r/);
    const armholeText = out.match(
      /<text transform="translate\(190\.38 113\.64\)"[^>]*>([\s\S]*?)<\/text>/,
    )?.[1];
    expect(armholeText ?? "").not.toMatch(/1s-2r|3s-2r/);
  });

  it("derives back neckline shaping when debug.necklineStitches is missing but measurements exist", () => {
    const result = generateDropShoulderPattern(DROP_SHOULDER_PATTERN);
    const stripped = {
      ...result,
      debug: { ...result.debug, necklineStitches: undefined },
    };
    const repl = buildDropShoulderBackJapaneseNotationReplacements(
      stripped,
      DROP_SHOULDER_PATTERN,
      DROP_SHOULDER_PATTERN,
    );
    expect(repl["jp-neckline-shaping"].length).toBeGreaterThan(0);
    expect(repl["jp-neckline-bo"]).toMatch(/^bo\d+/);
  });

  it("fills drop-shoulder front round-neck notation from debug", () => {
    const result = generateDropShoulderPattern(DROP_SHOULDER_PATTERN);
    const repl = buildDropShoulderFrontJapaneseNotationReplacements(result, DROP_SHOULDER_PATTERN);
    expect(repl["jp-caston"]).toMatch(/^co\d+/);
    expect(repl["jp-armhole-bo"]).toBe("");
    expect(repl["jp-shoulder-shaping"]).toBe("");
    expect(repl["jp-neckline-bo"]).toMatch(/^bo\d+/);
    expect(repl["jp-neckline-shaping"].length).toBeGreaterThan(0);
    expect(repl["rc-neckline-start"]).toMatch(/^rc\d+/);
  });

  it("derives front neckline shaping when debug.necklineStitches is missing but measurements exist", () => {
    const result = generateDropShoulderPattern(DROP_SHOULDER_PATTERN);
    const stripped = {
      ...result,
      debug: { ...result.debug, necklineStitches: undefined },
    };
    const repl = buildDropShoulderFrontJapaneseNotationReplacements(
      stripped,
      DROP_SHOULDER_PATTERN,
      DROP_SHOULDER_PATTERN,
    );
    expect(repl["jp-neckline-shaping"].length).toBeGreaterThan(0);
    expect(repl["jp-neckline-bo"]).toMatch(/^bo\d+/);
  });

  it("places front neckline shaping at the neck callout, not the armhole callout", () => {
    const result = generateDropShoulderPattern(DROP_SHOULDER_PATTERN);
    const repl = buildDropShoulderFrontJapaneseNotationReplacements(result, DROP_SHOULDER_PATTERN);
    const svgPath = resolve(process.cwd(), "public" + DROP_SHOULDER_BODY_FRONT_NOTATION_SRC);
    const svgText = readFileSync(svgPath, "utf8");
    const out = applyJapaneseNotationSvgReplacements(svgText, repl);

    expect(out).toContain('transform="translate(40.6 28.83)"');
    expect(out).toMatch(/translate\(40\.6 28\.83\)"[^>]*>[\s\S]*?1s-2r/);
    const armholeText = out.match(
      /<text transform="translate\(190\.38 113\.64\)"[^>]*>([\s\S]*?)<\/text>/,
    )?.[1];
    expect(armholeText ?? "").not.toMatch(/1s-2r|3s-2r/);
  });

  it("derives front neckline shaping from neck_opening_width alias", () => {
    const pattern = {
      ...DROP_SHOULDER_PATTERN,
      fit: {
        ...DROP_SHOULDER_PATTERN.fit,
        selectedMeasurements: {
          ...DROP_SHOULDER_PATTERN.fit.selectedMeasurements,
          neck_opening: undefined,
          neck_opening_width: 7,
        },
      },
    };
    const result = generateDropShoulderPattern(pattern);
    const stripped = {
      ...result,
      debug: { ...result.debug, necklineStitches: undefined },
    };
    const repl = buildDropShoulderFrontJapaneseNotationReplacements(stripped, pattern, pattern);
    expect(repl["jp-neckline-shaping"].length).toBeGreaterThan(0);
  });

  it("replaces every jp token in drop-shoulder body notation SVGs when placeholders exist", () => {
    for (const rel of [DROP_SHOULDER_BODY_BACK_NOTATION_SRC, DROP_SHOULDER_BODY_FRONT_NOTATION_SRC]) {
      const svgPath = resolve(process.cwd(), "public" + rel);
      const svgText = readFileSync(svgPath, "utf8");
      expect(svgText).not.toContain("{{shoulder-stitches}}");
      const tokens = listJapaneseNotationPlaceholdersInSvg(svgText);
      if (tokens.length === 0) continue;

      const result = generateDropShoulderPattern(DROP_SHOULDER_PATTERN);
      const repl =
        rel === DROP_SHOULDER_BODY_BACK_NOTATION_SRC
          ? buildDropShoulderBackJapaneseNotationReplacements(result, DROP_SHOULDER_PATTERN)
          : buildDropShoulderFrontJapaneseNotationReplacements(result, DROP_SHOULDER_PATTERN);

      expect(() => assertJapaneseNotationSvgFullyReplaced(svgText, repl)).not.toThrow();
      const out = applyJapaneseNotationSvgReplacements(svgText, repl);
      expect(listJapaneseNotationPlaceholdersInSvg(out)).toEqual([]);
      expect(repl["jp-shoulder-shaping"]).toBe("");
    }
  });
});

describe("dropShoulderBodyDiagramReplacements", () => {
  it("populates renamed shoulder tokens and keeps cross-shoulder values separate", () => {
    const result = generateDropShoulderPattern(DROP_SHOULDER_PATTERN);
    const backRepl = buildDropShoulderBodyDiagramReplacements(result, "in", {
      patternData: DROP_SHOULDER_PATTERN,
      measurementPiece: "back",
    });

    expect(backRepl["shoulder-stitches"]).toBe(String(result.debug.shoulderStitches));
    expect(backRepl["cross-shoulder-width"]).toBe(String(result.debug.backStitches));
    expect(backRepl["cross-shoulder"]).toBe(backRepl.SHOULDER_WIDTH);
    expect(Number(backRepl["cross-shoulder-width"])).not.toBe(Number(backRepl["shoulder-stitches"]));
    expect(backRepl.shoulder_sts).toBeUndefined();
    expect(backRepl.SHOULDER_STS).toBe(String(result.debug.stitchesAfterArmhole));
  });

  it("sts-rows back SVG renders 24 at shoulder-stitches, 74 at cross-shoulder-width", () => {
    const debug = {
      backStitches: 74,
      hemCastOnStitches: 74,
      necklineStitches: 26,
      shoulderStitches: 24,
      stitchesAfterArmhole: 74,
      rowsPerInch: 7,
      stitchesPerInch: 5,
      hemRows: 14,
      bodyRows: 100,
      armholeRows: 56,
      finishedBustChest: 29.6,
    };
    const result = {
      isDropShoulder: true,
      debug,
    } as ReturnType<typeof generateDropShoulderPattern>;

    const repl = buildDropShoulderBodyDiagramReplacements(result, "in", {
      patternData: DROP_SHOULDER_PATTERN,
      measurementPiece: "back",
    });

    expect(repl["cross-shoulder-width"]).toBe("74");
    expect(repl["shoulder-stitches"]).toBe("24");

    const svgPath = resolve(process.cwd(), "public" + DROP_SHOULDER_BODY_BACK_STS_ROWS_SRC);
    const svgText = readFileSync(svgPath, "utf8");
    expect(svgText).toContain("{{shoulder-stitches}}");
    expect(svgText).toContain("{{cross-shoulder-width}}");
    expect(svgText).toContain("{{cross-shoulder}}");
    expect(svgText).not.toContain("{{shoulder_sts}}");
    expect(svgText).not.toContain("{{SHOULDER_STS}}");

    const out = inlineSvgReplacements(svgText, repl);

    expect(out).toMatch(
      /translate\(105\.26 101\.93\)"[^>]*>[\s\S]*?>\s*74sts\s*</,
    );
    expect(out).toMatch(
      /translate\(163\.66 43\.29\)"[^>]*>[\s\S]*?>\s*24sts\s*</,
    );
    expect(out).not.toMatch(
      /translate\(163\.66 43\.29\)"[^>]*>[\s\S]*?>\s*74sts\s*</,
    );
    expect(out).not.toContain("{{shoulder-stitches}}");
    expect(out).not.toContain("{{cross-shoulder-width}}");
    expect(out).not.toContain("{{cross-shoulder}}");
  });

  it("replaces shoulder-stitches in sts-rows drop-shoulder body SVGs only", () => {
    const result = generateDropShoulderPattern(DROP_SHOULDER_PATTERN);
    const backRepl = buildDropShoulderBodyDiagramReplacements(result, "in", {
      patternData: DROP_SHOULDER_PATTERN,
      measurementPiece: "back",
    });
    const frontRepl = buildDropShoulderBodyDiagramReplacements(result, "in", {
      patternData: DROP_SHOULDER_PATTERN,
      measurementPiece: "front",
    });

    for (const [rel, repl] of [
      [DROP_SHOULDER_BODY_BACK_STS_ROWS_SRC, backRepl],
      [DROP_SHOULDER_BODY_FRONT_STS_ROWS_SRC, frontRepl],
    ] as const) {
      const svgPath = resolve(process.cwd(), "public" + rel);
      const svgText = readFileSync(svgPath, "utf8");
      expect(svgText).toContain("{{shoulder-stitches}}");
      expect(svgText).not.toContain("{{shoulder_sts}}");
      const out = inlineSvgReplacements(svgText, repl);
      expect(out).toMatch(/translate\(163\.66 43\.29\)"[^>]*>[\s\S]*?>\s*32sts\s*</);
      expect(out).not.toContain("{{shoulder-stitches}}");
    }

    for (const rel of [DROP_SHOULDER_BODY_BACK_NOTATION_SRC, DROP_SHOULDER_BODY_FRONT_NOTATION_SRC]) {
      const svgText = readFileSync(resolve(process.cwd(), "public" + rel), "utf8");
      expect(svgText).not.toContain("{{shoulder-stitches}}");
    }
  });

  it("uses (body width − neck opening) / 2 for shoulder-stitches", () => {
    const result = generateDropShoulderPattern(DROP_SHOULDER_PATTERN);
    const debug = {
      ...result.debug,
      backStitches: 74,
      hemCastOnStitches: 74,
      necklineStitches: 26,
      shoulderStitches: 24,
      stitchesAfterArmhole: 74,
    };
    const patched = { ...result, debug };

    expect(
      resolveDropShoulderShoulderStitchesForDiagram(patched, {
        measurementPiece: "back",
        patternData: DROP_SHOULDER_PATTERN,
      }),
    ).toBe("24");
    expect(
      resolveDropShoulderShoulderStitchesForDiagram(patched, {
        measurementPiece: "front",
        patternData: DROP_SHOULDER_PATTERN,
        cardiganHalfSide: "left",
      }),
    ).toBe("24");

    const withoutDebugShoulder = {
      ...patched,
      debug: { ...debug, shoulderStitches: undefined },
    };
    expect(
      resolveDropShoulderShoulderStitchesForDiagram(withoutDebugShoulder, {
        measurementPiece: "back",
        patternData: DROP_SHOULDER_PATTERN,
      }),
    ).toBe("24");
  });

  it("derives the same shoulder-stitches on front and back", () => {
    const cardiganPattern = {
      ...DROP_SHOULDER_PATTERN,
      style: { ...DROP_SHOULDER_PATTERN.style, frontStyle: "open" },
    };
    const result = generateDropShoulderPattern(cardiganPattern);
    const backShoulder = resolveDropShoulderShoulderStitchesForDiagram(result, {
      measurementPiece: "back",
      patternData: cardiganPattern,
    });
    const frontShoulder = resolveDropShoulderShoulderStitchesForDiagram(result, {
      measurementPiece: "front",
      patternData: cardiganPattern,
      cardiganHalfSide: "left",
    });

    expect(backShoulder).toBe(String(result.debug.shoulderStitches));
    expect(frontShoulder).toBe(backShoulder);
    expect(frontShoulder).toBe(
      String(Math.round((result.debug.backStitches! - result.debug.necklineStitches!) / 2)),
    );
  });
});

describe("drop-shoulder Japanese notation quick reference preview SVGs", () => {
  const previewPaths = [
    "public/images/patterns/drop-shoulder/jp-drop-body-back-preview.svg",
    "public/images/patterns/drop-shoulder/jp-drop-body-front-preview.svg",
  ] as const;

  for (const rel of previewPaths) {
    it(`${rel} exists, is token-free, and parses as SVG`, () => {
      const abs = resolve(process.cwd(), rel);
      expect(() => readFileSync(abs, "utf8")).not.toThrow();
      const svg = readFileSync(abs, "utf8");
      expect(svg).toMatch(/<svg[\s>]/);
      expect(svg).not.toMatch(/\{\{/);
      expect(assertParseableSvgMarkup(svg)).toBeUndefined();
    });
  }
});
