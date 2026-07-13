import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { generateDropShoulderPattern } from "./dropShoulderPatternOutput";
import { computeDefaultMeasurementsFromChartRow } from "./sleevelessExpressSizeChartClient";
import { cardiganFrontInitialNeckBindOffStitches } from "./roundNeckNotation";
import { formatBindOffNotation } from "./sleevelessBackJapaneseNotation";
import {
  buildDropShoulderBackJapaneseNotationReplacements,
  buildDropShoulderFrontJapaneseNotationReplacements,
  isDropShoulderBodyJapaneseNotationSupported,
} from "./dropShoulderBodyJapaneseNotation";
import {
  DROP_SHOULDER_BODY_BACK_NOTATION_SRC,
  DROP_SHOULDER_BODY_BACK_STS_ROWS_SRC,
  DROP_SHOULDER_BODY_CARDIGAN_NOTATION_SRC,
  DROP_SHOULDER_BODY_CARDIGAN_STS_ROWS_SRC,
  DROP_SHOULDER_BODY_FRONT_NOTATION_SRC,
  DROP_SHOULDER_BODY_FRONT_STS_ROWS_SRC,
  buildDropShoulderBodyDiagramReplacements,
  withDropShoulderShoulderMeasurementReplacements,
  resolveDropShoulderShoulderStitchesForDiagram,
  resolveDropShoulderBackDiagramSrc,
  resolveDropShoulderBackDiagramSvg,
  resolveDropShoulderFrontDiagramSrc,
} from "./dropShoulderBodyNotationSvg";
import {
  applyJapaneseNotationSvgReplacements,
  assertJapaneseNotationSvgFullyReplaced,
  listJapaneseNotationPlaceholdersInSvg,
} from "./sleevelessJapaneseNotationSvg";
import { applyGarmentDiagramSvgReplacements } from "./sleevelessGarmentDiagramSvg";
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

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Visible text from the first `<text>` inside an SVG group with `id`. */
function textInSvgGroup(svgText: string, groupId: string): string | undefined {
  const groupRe = new RegExp(
    `id="${escapeRegExp(groupId)}"[\\s\\S]*?(?=id="|<\\/svg>)`,
    "i",
  );
  const groupMatch = svgText.match(groupRe);
  if (!groupMatch) return undefined;
  const textMatch = groupMatch[0].match(/<text[^>]*>([\s\S]*?)<\/text>/i);
  if (!textMatch) return undefined;
  return textMatch[1]!
    .replace(/<tspan[^>]*>/gi, "")
    .replace(/<\/tspan>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function textAtTransform(svgText: string, transform: string): string | undefined {
  const re = new RegExp(
    `<text transform="${escapeRegExp(transform)}"[^>]*>([\\s\\S]*?)<\\/text>`,
    "i",
  );
  const match = svgText.match(re);
  if (!match) return undefined;
  return match[1]!
    .replace(/<tspan[^>]*>/gi, "")
    .replace(/<\/tspan>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .trim();
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

const DROP_SHOULDER_BODY_JP_NOTATION_SHARED_TOKENS = [
  "jp-caston",
  "jp-neckline-bo",
  "jp-neckline-shaping",
  "rc-caston",
  "rc-hem",
  "rc-armhole-bo",
  "rc-neckline-start",
] as const;

const DROP_SHOULDER_BODY_BACK_NOTATION_TOKENS = [
  ...DROP_SHOULDER_BODY_JP_NOTATION_SHARED_TOKENS,
  "jp-body-shaping",
] as const;

const DROP_SHOULDER_BODY_FRONT_NOTATION_TOKENS = [
  ...DROP_SHOULDER_BODY_JP_NOTATION_SHARED_TOKENS,
  "jp-body-rows",
  "jp-armhole-bo",
  "jp-armhole-shaping",
  "rc_reset",
] as const;

/** Cardigan front JP omits armhole and neckline placeholders (half-panel schematic). */
const DROP_SHOULDER_BODY_CARDIGAN_NOTATION_TOKENS = [
  "jp-caston",
  "jp-body-rows",
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

const DROP_SHOULDER_CARDIGAN_PATTERN = {
  ...DROP_SHOULDER_PATTERN,
  style: {
    ...DROP_SHOULDER_PATTERN.style,
    frontStyle: "open",
    garmentStyle: "cardigan",
  },
};

const DROP_SHOULDER_ALINE_CARDIGAN_V = {
  ...DROP_SHOULDER_CARDIGAN_PATTERN,
  style: {
    ...DROP_SHOULDER_CARDIGAN_PATTERN.style,
    neckline: "v-neck",
    bodyShape: "aline",
  },
  fit: {
    ...DROP_SHOULDER_CARDIGAN_PATTERN.fit,
    selectedMeasurements: {
      ...DROP_SHOULDER_CARDIGAN_PATTERN.fit.selectedMeasurements,
      finished_hip: 44,
    },
  },
};

describe("dropShoulderBodyNotationSvg", () => {
  it("defines canonical drop-shoulder body diagram asset paths", () => {
    expect(DROP_SHOULDER_BODY_BACK_STS_ROWS_SRC).toBe(
      "/images/patterns/drop-shoulder/drop-body-back.svg",
    );
    expect(DROP_SHOULDER_BODY_FRONT_STS_ROWS_SRC).toBe(
      "/images/patterns/drop-shoulder/drop-body-front.svg",
    );
    expect(DROP_SHOULDER_BODY_CARDIGAN_STS_ROWS_SRC).toBe(
      "/images/patterns/drop-shoulder/body/drop_body_cardigan.svg",
    );
    expect(DROP_SHOULDER_BODY_BACK_NOTATION_SRC).toBe(
      "/images/patterns/drop-shoulder/jp-drop-body-back.svg",
    );
    expect(DROP_SHOULDER_BODY_FRONT_NOTATION_SRC).toBe(
      "/images/patterns/drop-shoulder/jp-drop-body-front.svg",
    );
    expect(DROP_SHOULDER_BODY_CARDIGAN_NOTATION_SRC).toBe(
      "/images/patterns/drop-shoulder/japanese/jp-drop-body-cardigan.svg",
    );

    expect(DROP_SHOULDER_BODY_BACK_NOTATION_SRC).not.toContain("sleeveless");
    expect(DROP_SHOULDER_BODY_FRONT_NOTATION_SRC).not.toContain("sleeveless");
    expect(DROP_SHOULDER_BODY_CARDIGAN_NOTATION_SRC).not.toContain("sleeveless");

    expect(SLEEVELESS_BACK_JP_NOTATION_DIAGRAM_SRC).not.toBe(DROP_SHOULDER_BODY_BACK_NOTATION_SRC);
    expect(SLEEVELESS_FRONT_JP_NOTATION_DIAGRAM_SRC).not.toBe(DROP_SHOULDER_BODY_FRONT_NOTATION_SRC);
  });

  it("resolves pullover, cardigan, and back diagram SVGs from pattern style", () => {
    expect(resolveDropShoulderBackDiagramSrc("sts-rows")).toBe(DROP_SHOULDER_BODY_BACK_STS_ROWS_SRC);
    expect(resolveDropShoulderBackDiagramSrc("shaping-notation")).toBe(
      DROP_SHOULDER_BODY_BACK_NOTATION_SRC,
    );

    expect(resolveDropShoulderFrontDiagramSrc("sts-rows", DROP_SHOULDER_PATTERN)).toBe(
      DROP_SHOULDER_BODY_FRONT_STS_ROWS_SRC,
    );
    expect(resolveDropShoulderFrontDiagramSrc("shaping-notation", DROP_SHOULDER_PATTERN)).toBe(
      DROP_SHOULDER_BODY_FRONT_NOTATION_SRC,
    );

    expect(resolveDropShoulderFrontDiagramSrc("sts-rows", DROP_SHOULDER_CARDIGAN_PATTERN)).toBe(
      DROP_SHOULDER_BODY_CARDIGAN_STS_ROWS_SRC,
    );
    expect(
      resolveDropShoulderFrontDiagramSrc("shaping-notation", DROP_SHOULDER_CARDIGAN_PATTERN),
    ).toBe(DROP_SHOULDER_BODY_CARDIGAN_NOTATION_SRC);
  });

  it("resolves A-line back shaping notation and sts-rows without fallback", () => {
    const notation = resolveDropShoulderBackDiagramSvg(
      "shaping-notation",
      DROP_SHOULDER_ALINE_CARDIGAN_V,
    );
    expect(notation.exactMatch).toBe(true);
    expect(notation.src).toBe("/images/patterns/drop-shoulder/diagram-jp-back-aline.svg");
    expect(notation.fallback).toBeUndefined();

    const stsRows = resolveDropShoulderBackDiagramSvg("sts-rows", DROP_SHOULDER_ALINE_CARDIGAN_V);
    expect(stsRows.exactMatch).toBe(true);
    expect(stsRows.src).toBe("/images/patterns/drop-shoulder/drop-body-back-aline.svg");
    expect(stsRows.fallback).toBeUndefined();
  });

  it("lists expected notation tokens in each drop-shoulder body notation SVG", () => {
    const backSvg = readFileSync(
      resolve(process.cwd(), "public" + DROP_SHOULDER_BODY_BACK_NOTATION_SRC),
      "utf8",
    );
    const pulloverFrontSvg = readFileSync(
      resolve(process.cwd(), "public" + DROP_SHOULDER_BODY_FRONT_NOTATION_SRC),
      "utf8",
    );
    const cardiganFrontSvg = readFileSync(
      resolve(process.cwd(), "public" + DROP_SHOULDER_BODY_CARDIGAN_NOTATION_SRC),
      "utf8",
    );
    const backTokens = listJapaneseNotationPlaceholdersInSvg(backSvg);
    const pulloverFrontTokens = listJapaneseNotationPlaceholdersInSvg(pulloverFrontSvg);
    const cardiganFrontTokens = listJapaneseNotationPlaceholdersInSvg(cardiganFrontSvg);

    for (const token of DROP_SHOULDER_BODY_BACK_NOTATION_TOKENS) {
      expect(backTokens, `back SVG missing ${token}`).toContain(token);
    }
    for (const token of DROP_SHOULDER_BODY_FRONT_NOTATION_TOKENS) {
      expect(pulloverFrontTokens, `pullover front SVG missing ${token}`).toContain(token);
    }
    for (const token of DROP_SHOULDER_BODY_CARDIGAN_NOTATION_TOKENS) {
      expect(cardiganFrontTokens, `cardigan front SVG missing ${token}`).toContain(token);
    }
  });

  it("processed drop-shoulder body notation SVG markup is structurally parseable", () => {
    const pulloverResult = generateDropShoulderPattern(DROP_SHOULDER_PATTERN);
    const cardiganResult = generateDropShoulderPattern(DROP_SHOULDER_CARDIGAN_PATTERN);
    for (const [rel, buildRepl] of [
      [
        DROP_SHOULDER_BODY_BACK_NOTATION_SRC,
        () => buildDropShoulderBackJapaneseNotationReplacements(pulloverResult, DROP_SHOULDER_PATTERN),
      ],
      [
        DROP_SHOULDER_BODY_FRONT_NOTATION_SRC,
        () =>
          buildDropShoulderFrontJapaneseNotationReplacements(pulloverResult, DROP_SHOULDER_PATTERN),
      ],
      [
        DROP_SHOULDER_BODY_CARDIGAN_NOTATION_SRC,
        () =>
          buildDropShoulderFrontJapaneseNotationReplacements(
            cardiganResult,
            DROP_SHOULDER_CARDIGAN_PATTERN,
          ),
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
  it("always uses documented shallow-round JP on back (hold center + Xs-2r-Nx edge holds)", () => {
    const result = generateDropShoulderPattern(DROP_SHOULDER_PATTERN);
    expect(result.debug.backNeckRoundNecklineStrategy).toBe("shallow-round");
    const repl = buildDropShoulderBackJapaneseNotationReplacements(result, DROP_SHOULDER_PATTERN);
    expect(repl["jp-neckline-bo"]).toBe("hold18");
    expect(repl["jp-neckline-shaping"]).toBe("3s-2r-1x\n2s-2r-3x");
    expect(repl["jp-neckline-shaping"]).not.toMatch(/3s-2r-2x|1s-1r/);
  });

  it("back written instructions use needle-range shallow hold shaping with validation counts", () => {
    const result = generateDropShoulderPattern(DROP_SHOULDER_PATTERN);
    const backText = result.displayRows
      .filter((row): row is Extract<(typeof result.displayRows)[number], { kind: "block" }> => row.kind === "block")
      .flatMap((row) => [...(row.trustedParagraphs ?? []), ...(row.paragraphs ?? [])])
      .join("\n");
    expect(backText).toMatch(/RIGHT SIDE/i);
    expect(backText).toMatch(/class="needle-range"/);
    expect(backText).toMatch(/Put needles .*L50 through R9.*into hold \(59 stitches total\)/);
    expect(backText).toMatch(/Work needles .*R10 through R50.*\(41 stitches total\)/);
    expect(backText).toMatch(/Put 3 needles into hold every other row 1 time/i);
    expect(backText).toMatch(/Put 2 needles into hold every other row 3 times/i);
    expect(backText).toMatch(/<em>\(RC: \d+(?:, \d+)*\)<\/em>/);
    expect(backText).toMatch(/Scrap off or bind off the remaining shoulder stitches/i);
    expect(backText).toMatch(/The first shoulder is complete/i);
    expect(backText).toMatch(/The second shoulder is complete/i);
    expect(backText).toMatch(/Break yarn and move the carriage to the opposite side/i);
    expect(backText).toMatch(/Leave center neckline needles .*L9 through R9.*in hold \(18 stitches total\)/);
    expect(backText).toMatch(/Return needles .*L50 through L10.*\(41 stitches total\)/);
    expect(backText).toMatch(/Work needles .*L50 through L10/);
    expect(backText).not.toMatch(/Work needles .*L50 through L10.*\(41 stitches total\)/);
    expect(backText).not.toMatch(/BACK NECKLINE CLEANUP/i);
    expect(backText).not.toMatch(/Scrap off or bind off all remaining held neckline stitches/i);
    expect(backText).not.toMatch(/Place the center \d+ stitches in hold/i);
    expect(backText).not.toMatch(/Place the opposite shoulder stitches in hold/i);
    expect(backText).not.toMatch(/Continue to RC:/i);
    expect(backText).not.toMatch(/bind off 32 stitches for each shoulder/i);
    expect(backText).not.toMatch(/bind off all \d+ stitches across the top/i);
  });

  it("shows final shoulder stitch count only on shoulder completion blocks in BACK NECKLINE & SHOULDERS", () => {
    const result = generateDropShoulderPattern(DROP_SHOULDER_PATTERN);
    const shoulderSts = result.debug.shoulderStitches!;
    expect(shoulderSts).toBeGreaterThan(0);

    let inSection = false;
    const backNeckBlocks: Array<{ stitchCount?: number; text: string }> = [];
    for (const row of result.displayRows) {
      if (row.kind === "section" && row.title === "BACK NECKLINE & SHOULDERS") {
        inSection = true;
        continue;
      }
      if (inSection && row.kind === "section") break;
      if (!inSection || row.kind !== "block") continue;
      const text = [...(row.trustedParagraphs ?? []), ...(row.paragraphs ?? [])].join("\n");
      backNeckBlocks.push({ stitchCount: row.stitchCount, text });
    }

    expect(backNeckBlocks.length).toBeGreaterThan(0);

    const completionBlocks = backNeckBlocks.filter((b) =>
      /The (first|second) shoulder is complete/i.test(b.text),
    );
    expect(completionBlocks).toHaveLength(2);
    for (const block of completionBlocks) {
      expect(block.stitchCount).toBe(shoulderSts);
    }

    const nonCompletionBlocks = backNeckBlocks.filter(
      (b) => !/The (first|second) shoulder is complete/i.test(b.text),
    );
    expect(nonCompletionBlocks.length).toBeGreaterThan(0);
    for (const block of nonCompletionBlocks) {
      expect(block.stitchCount).toBeUndefined();
    }
  });

  it("fills drop-shoulder back notation with center hold and neckline shaping", () => {
    const result = generateDropShoulderPattern(DROP_SHOULDER_PATTERN);
    expect(isDropShoulderBodyJapaneseNotationSupported(result)).toBe(true);

    const repl = buildDropShoulderBackJapaneseNotationReplacements(result, DROP_SHOULDER_PATTERN);
    const fullNeck = result.debug.necklineStitches ?? 0;
    expect(repl["jp-caston"]).toMatch(/^co\d+/);
    expect(repl["jp-body-rows"]).toMatch(/\d+r/);
    expect(repl["jp-armhole-bo"]).toBe("");
    expect(repl["jp-armhole-shaping"]).toBe("");
    expect(repl["jp-shoulder-shaping"]).toBe("");
    expect(repl["jp-neckline-bo"]).toMatch(/^hold\d+/);
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
    const neckCallout = textAtTransform(out, "translate(121.06 30.44)");
    expect(neckCallout).toMatch(/3s-2r|2s-2r|1s-2r/);
    expect(textAtTransform(out, "translate(193.02 223.22)") ?? "").not.toMatch(/3s-2r|2s-2r|1s-2r/);
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
    expect(repl["jp-neckline-bo"]).toMatch(/^hold\d+/);
  });

  it("fills drop-shoulder front round-neck notation from debug (deep front uses bind-off center)", () => {
    const result = generateDropShoulderPattern(DROP_SHOULDER_PATTERN);
    const repl = buildDropShoulderFrontJapaneseNotationReplacements(result, DROP_SHOULDER_PATTERN);
    expect(repl["jp-caston"]).toMatch(/^co\d+/);
    expect(repl["jp-armhole-bo"]).toBe("");
    expect(repl["jp-shoulder-shaping"]).toBe("");
    expect(repl["jp-neckline-bo"]).toMatch(/^bo\d+/);
    expect(repl["jp-neckline-shaping"].length).toBeGreaterThan(0);
    expect(repl["rc-neckline-start"]).toMatch(/^rc\d+/);
  });

  it("cardigan front jp-neckline-bo matches written CF bind-off (not legacy n/3 shortcut)", () => {
    const result = generateDropShoulderPattern(DROP_SHOULDER_CARDIGAN_PATTERN);
    const repl = buildDropShoulderFrontJapaneseNotationReplacements(
      result,
      DROP_SHOULDER_CARDIGAN_PATTERN,
    );
    const fullNeck = result.debug.necklineStitches ?? 0;
    const cfBindOff = cardiganFrontInitialNeckBindOffStitches(
      fullNeck,
      result.debug.frontNeckDepthRows,
    );
    expect(repl["jp-neckline-bo"]).toBe(formatBindOffNotation(cfBindOff));
    expect(repl["jp-neckline-shaping"].length).toBeGreaterThan(0);
    expect(repl["jp-neckline-shaping"]).not.toMatch(/^1s-2r-\d+x$/);

    const frontText = (result.frontDisplayRows ?? [])
      .filter((row): row is Extract<(typeof result.frontDisplayRows)[number], { kind: "block" }> => row.kind === "block")
      .flatMap((row) => [...(row.trustedParagraphs ?? []), ...(row.paragraphs ?? [])])
      .join("\n");
    expect(frontText).toMatch(new RegExp(`bind off ${cfBindOff} stitches`, "i"));
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

    const neckCallout = textAtTransform(out, "translate(84.71 31.37)");
    expect(neckCallout).toMatch(/1s-2r/);
    expect(textAtTransform(out, "translate(187.79 124.72)") ?? "").not.toMatch(/1s-2r|3s-2r/);
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
    const result = generateDropShoulderPattern(DROP_SHOULDER_PATTERN);
    for (const [rel, measurementPiece, buildRepl] of [
      [
        DROP_SHOULDER_BODY_BACK_NOTATION_SRC,
        "back",
        () => buildDropShoulderBackJapaneseNotationReplacements(result, DROP_SHOULDER_PATTERN),
      ],
      [
        DROP_SHOULDER_BODY_FRONT_NOTATION_SRC,
        "front",
        () => buildDropShoulderFrontJapaneseNotationReplacements(result, DROP_SHOULDER_PATTERN),
      ],
    ] as const) {
      const svgPath = resolve(process.cwd(), "public" + rel);
      const svgText = readFileSync(svgPath, "utf8");
      const tokens = listJapaneseNotationPlaceholdersInSvg(svgText);
      if (tokens.length === 0) continue;

      const repl = withDropShoulderShoulderMeasurementReplacements(
        buildRepl(),
        result,
        "in",
        { patternData: DROP_SHOULDER_PATTERN, measurementPiece },
      );

      expect(() => assertJapaneseNotationSvgFullyReplaced(svgText, repl)).not.toThrow();
      const out = applyJapaneseNotationSvgReplacements(svgText, repl);
      expect(listJapaneseNotationPlaceholdersInSvg(out)).toEqual([]);
      expect(out).not.toContain("{{shoulder-stitches}}");
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

    expect(textInSvgGroup(out, "CROSS_SHOULDER_STS")).toBe("74sts");
    expect(textInSvgGroup(out, "NECK_WIDTH_STS-2")).toBe("24sts");
    expect(textInSvgGroup(out, "CROSS_SHOULDER_STS")).not.toBe(textInSvgGroup(out, "NECK_WIDTH_STS-2"));
    expect(out).not.toContain("{{shoulder-stitches}}");
    expect(out).not.toContain("{{cross-shoulder-width}}");
    expect(out).not.toContain("{{cross-shoulder}}");
  });

  it("A-line back diagram uses bust width at cross-shoulder and hip cast-on at hem", () => {
    const alinePattern = {
      ...DROP_SHOULDER_PATTERN,
      style: {
        ...DROP_SHOULDER_PATTERN.style,
        bodyShape: "aline",
      },
      fit: {
        ...DROP_SHOULDER_PATTERN.fit,
        selectedMeasurements: {
          ...DROP_SHOULDER_PATTERN.fit.selectedMeasurements,
          finished_hip: 44,
        },
      },
    };
    const result = generateDropShoulderPattern(alinePattern);
    expect(result.debug.hemCastOnStitches).toBeGreaterThan(result.debug.bustBodyStitches!);

    const repl = buildDropShoulderBodyDiagramReplacements(result, "in", {
      patternData: alinePattern,
      measurementPiece: "back",
    });
    expect(repl["cross-shoulder-width"]).toBe(String(result.debug.bustBodyStitches));
    expect(repl.HIP_STS).toBe(String(result.debug.hemCastOnStitches));
    expect(Number(repl["cross-shoulder-width"])).toBeLessThan(Number(repl.HIP_STS));
    expect(repl["cross-shoulder"]).toBe(repl.SHOULDER_WIDTH);

    const markerRc = result.debug.rowsFromCastOnToArmholeStart!;
    const neckStartRc = result.debug.backNecklineStartRC!;
    const straightAboveMarker = neckStartRc - markerRc;
    expect(straightAboveMarker).toBeGreaterThan(0);
    expect(straightAboveMarker).toBeLessThan(result.debug.armholeRows!);
    expect(repl.ARMHOLE_ROWS).toBe(String(straightAboveMarker));
    expect(repl.NECK_DEPTH_ROWS).toBe(String(result.debug.backNeckDepthRows));
    expect(Number(repl.ARMHOLE_ROWS) + Number(repl.NECK_DEPTH_ROWS)).toBe(result.debug.armholeRows);
  });

  it("replaces shoulder-stitches in diagram-jp-back-aline shaping notation", () => {
    const alinePattern = {
      ...DROP_SHOULDER_PATTERN,
      style: {
        construction: "drop-shoulder",
        frontStyle: "closed",
        garmentStyle: "pullover",
        neckline: "round",
        bodyShape: "aline",
      },
      fit: {
        ...DROP_SHOULDER_PATTERN.fit,
        selectedMeasurements: {
          ...DROP_SHOULDER_PATTERN.fit.selectedMeasurements,
          finished_hip: 44,
        },
      },
    };
    const result = generateDropShoulderPattern(alinePattern);
    const repl = withDropShoulderShoulderMeasurementReplacements(
      buildDropShoulderBackJapaneseNotationReplacements(result, alinePattern),
      result,
      "in",
      { patternData: alinePattern, measurementPiece: "back" },
    );

    const rel = "/images/patterns/drop-shoulder/diagram-jp-back-aline.svg";
    const svgText = readFileSync(resolve(process.cwd(), "public" + rel), "utf8");
    expect(svgText).toContain("{{shoulder-stitches}}");
    expect(svgText).toContain("{{jp-body-shaping}}");
    expect(repl["shoulder-stitches"]).toBe(String(result.debug.shoulderStitches));
    expect(repl["jp-body-shaping"]).toMatch(/1s-\d+r-\d+x/);
    expect(repl["jp-body-shaping"]).not.toMatch(/^\+/m);

    const out = applyJapaneseNotationSvgReplacements(svgText, repl);
    expect(textInSvgGroup(out, "NECK_WIDTH_STS")).toBe(`${repl["shoulder-stitches"]}sts`);
    expect(out).not.toContain("{{shoulder-stitches}}");
  });

  it("replaces jp-body-shaping with + increase notation on diagram-jp-back-shaped.svg", () => {
    const shapedPattern = {
      ...DROP_SHOULDER_PATTERN,
      style: {
        construction: "drop-shoulder",
        frontStyle: "closed",
        garmentStyle: "pullover",
        neckline: "round",
        bodyShape: "shaped",
      },
      fit: {
        ...DROP_SHOULDER_PATTERN.fit,
        selectedMeasurements: {
          ...DROP_SHOULDER_PATTERN.fit.selectedMeasurements,
          finished_hip: 36,
        },
      },
    };
    const result = generateDropShoulderPattern(shapedPattern);
    const repl = withDropShoulderShoulderMeasurementReplacements(
      buildDropShoulderBackJapaneseNotationReplacements(result, shapedPattern),
      result,
      "in",
      { patternData: shapedPattern, measurementPiece: "back" },
    );

    const rel = "/images/patterns/drop-shoulder/diagram-jp-back-shaped.svg";
    const svgText = readFileSync(resolve(process.cwd(), "public" + rel), "utf8");
    expect(svgText).toContain("{{jp-body-shaping}}");
    expect(repl["jp-body-shaping"]).toMatch(/^\+1s-\d+r-\d+x/);
    expect(repl["jp-body-shaping"].split("\n").every((line) => line.startsWith("+"))).toBe(true);

    const out = applyJapaneseNotationSvgReplacements(svgText, repl);
    expect(out).not.toContain("{{jp-body-shaping}}");
    for (const line of repl["jp-body-shaping"].split("\n").filter(Boolean)) {
      expect(out).toContain(line);
    }
  });

  it("replaces shoulder-stitches in diagram-jp-front-v-aline shaping notation", () => {
    const alineVPattern = {
      ...DROP_SHOULDER_PATTERN,
      style: {
        construction: "drop-shoulder",
        frontStyle: "closed",
        garmentStyle: "pullover",
        neckline: "v-neck",
        bodyShape: "aline",
      },
      fit: {
        ...DROP_SHOULDER_PATTERN.fit,
        selectedMeasurements: {
          ...DROP_SHOULDER_PATTERN.fit.selectedMeasurements,
          finished_hip: 44,
        },
      },
    };
    const result = generateDropShoulderPattern(alineVPattern);
    const repl = withDropShoulderShoulderMeasurementReplacements(
      buildDropShoulderFrontJapaneseNotationReplacements(result, alineVPattern),
      result,
      "in",
      { patternData: alineVPattern, measurementPiece: "front" },
    );

    const rel = "/images/patterns/drop-shoulder/diagram-jp-front-v-aline.svg";
    const svgText = readFileSync(resolve(process.cwd(), "public" + rel), "utf8");
    expect(svgText).toContain("{{shoulder-stitches}}");
    expect(repl["shoulder-stitches"]).toBe(String(result.debug.shoulderStitches));

    const out = applyJapaneseNotationSvgReplacements(svgText, repl);
    expect(out).toMatch(
      new RegExp(
        `translate\\(160\\.84 53\\.43\\)"[^>]*>[\\s\\S]*?>\\s*${repl["shoulder-stitches"]}sts\\s*<`,
      ),
    );
    expect(out).not.toContain("{{shoulder-stitches}}");
    expect(() => assertJapaneseNotationSvgFullyReplaced(svgText, repl)).not.toThrow();
  });

  it("replaces HIP_STS cast-on at the front hem on drop-body-front.svg", () => {
    const result = generateDropShoulderPattern(DROP_SHOULDER_PATTERN);
    expect(result.debug.hemCastOnStitches).toBe(result.debug.backStitches);

    const frontRepl = buildDropShoulderBodyDiagramReplacements(result, "in", {
      patternData: DROP_SHOULDER_PATTERN,
      measurementPiece: "front",
    });
    expect(frontRepl.HIP_STS).toBe(String(result.debug.hemCastOnStitches));
    expect(frontRepl.HIP_INCHES).toBeTruthy();

    const svgText = readFileSync(
      resolve(process.cwd(), "public" + DROP_SHOULDER_BODY_FRONT_STS_ROWS_SRC),
      "utf8",
    );
    expect(svgText).toContain("{{HIP_STS}}");
    expect(svgText).toContain("{{HIP_INCHES}}");
    expect(svgText).not.toContain("{{BUST_STS}}");

    const out = applyGarmentDiagramSvgReplacements(svgText, frontRepl);
    expect(out).toMatch(/id="HIP_MEASUREMENT"[\s\S]*?>\s*100sts\s*</);
    expect(out).toMatch(/id="HIP_MEASUREMENT"[\s\S]*?>\s*\(20 in\)\s*</);
    expect(out).not.toContain("{{HIP_STS}}");
    expect(out).not.toContain("{{HIP_INCHES}}");
  });

  it("replaces shoulder-stitches in sts-rows and notation drop-shoulder body SVGs", () => {
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
      expect(textInSvgGroup(out, "NECK_WIDTH_STS-2")).toBe(`${repl["shoulder-stitches"]}sts`);
      expect(out).not.toContain("{{shoulder-stitches}}");
    }

    for (const [rel, measurementPiece] of [
      [DROP_SHOULDER_BODY_BACK_NOTATION_SRC, "back"],
      [DROP_SHOULDER_BODY_FRONT_NOTATION_SRC, "front"],
    ] as const) {
      const svgText = readFileSync(resolve(process.cwd(), "public" + rel), "utf8");
      expect(svgText).toContain("{{shoulder-stitches}}");
      const repl = withDropShoulderShoulderMeasurementReplacements(
        measurementPiece === "back"
          ? buildDropShoulderBackJapaneseNotationReplacements(result, DROP_SHOULDER_PATTERN)
          : buildDropShoulderFrontJapaneseNotationReplacements(result, DROP_SHOULDER_PATTERN),
        result,
        "in",
        { patternData: DROP_SHOULDER_PATTERN, measurementPiece },
      );
      const out = applyJapaneseNotationSvgReplacements(svgText, repl);
      expect(out).not.toContain("{{shoulder-stitches}}");
      expect(out).toContain(`${repl["shoulder-stitches"]}sts`);
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

  it("cardigan front schematic uses half-panel cross-shoulder width, not full back width", () => {
    const KIDS_2YR_CHART_ROW = {
      size: "2 yr",
      bust_or_chest: 21,
      waist: 21,
      hip: "",
      garment_back_length: 18,
      armhole_depth: 4.25,
      shoulder_width: 9.25,
      neck_opening: 4,
      front_neck_depth: 2,
      back_neck_depth: 1,
      upper_arm: 6,
      wrist: 4.5,
      sleeve_length: 8.5,
    };
    const cardiganPattern = {
      fit: {
        sizingChart: "kids",
        selectedSize: "2 yr",
        easeChoice: "standard",
        selectedMeasurements: computeDefaultMeasurementsFromChartRow(
          KIDS_2YR_CHART_ROW,
          "standard",
          { bodyShape: "straight" },
        ),
      },
      style: {
        construction: "drop-shoulder",
        constructionAuthored: "drop-shoulder",
        recipientCategory: "kids",
        neckline: "round",
        bodyShape: "straight",
        frontStyle: "open",
        garmentStyle: "cardigan",
      },
      yarnGaugeMachine: {
        gaugeStitchesPerInch: 7,
        gaugeRowsPerInch: 11,
        availableNeedles: 200,
      },
    };

    const result = generateDropShoulderPattern(cardiganPattern);
    expect(result.debug.backStitches).toBe(84);
    expect(result.debug.isCardigan).toBe(true);

    const backRepl = buildDropShoulderBodyDiagramReplacements(result, "in", {
      patternData: cardiganPattern,
      measurementPiece: "back",
    });
    const frontRepl = buildDropShoulderBodyDiagramReplacements(result, "in", {
      patternData: cardiganPattern,
      measurementPiece: "front",
      cardiganHalfSide: "left",
    });

    // Full back width on back schematic; single front panel on cardigan front schematic.
    expect(backRepl["cross-shoulder-width"]).toBe("84");
    expect(backRepl["cross-shoulder"]).toBe("12");
    expect(frontRepl["cross-shoulder-width"]).toBe("42");
    expect(frontRepl["cross-shoulder"]).toBe("6");
    expect(frontRepl.BUST_STS).toBe("42");
    expect(frontRepl.HIP_STS).toBe("42");

    const svgPath = resolve(process.cwd(), "public" + DROP_SHOULDER_BODY_CARDIGAN_STS_ROWS_SRC);
    const svgText = readFileSync(svgPath, "utf8");
    const out = inlineSvgReplacements(svgText, frontRepl);
    expect(textInSvgGroup(out, "CROSS_SHOULDER_STS")).toBe("42sts");
    expect(textInSvgGroup(out, "HIP_MEASUREMENT")).toBe("42sts");
    expect(textInSvgGroup(out, "CROSS_SHOULDER_UNIT")).toBe("(6 in)");
    expect(textInSvgGroup(out, "CROSS_SHOULDER_STS")).not.toBe("84sts");
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
