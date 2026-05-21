import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { buildBackJapaneseNotationReplacements } from "./sleevelessBackJapaneseNotation";
import { demoSleevelessBackPattern } from "./sleevelessPatternOutput";
import {
  JP_BACK_NOTATION_SVG_TOKEN_KEYS,
  SAMPLE_JP_BACK_NOTATION_REPLACEMENTS,
  applyJapaneseNotationSvgReplacements,
  assertJapaneseNotationSvgFullyReplaced,
  findUnreplacedJapaneseNotationPlaceholders,
  listJapaneseNotationPlaceholdersInSvg,
} from "./sleevelessJapaneseNotationSvg";

const JP_SVG_PATH = resolve(
  process.cwd(),
  "public/images/patterns/sleeveless/jp-back-notation.svg",
);

describe("jp-back-notation.svg placeholders", () => {
  const rawSvg = readFileSync(JP_SVG_PATH, "utf8");

  it("lists every jp/rc token in the draft layer", () => {
    const tokens = listJapaneseNotationPlaceholdersInSvg(rawSvg);
    expect(tokens).toEqual([...JP_BACK_NOTATION_SVG_TOKEN_KEYS].sort());
  });

  it("does not treat hidden sts-rows measurement tokens as notation placeholders", () => {
    const tokens = listJapaneseNotationPlaceholdersInSvg(rawSvg);
    expect(tokens.some((t) => t.startsWith("BUST"))).toBe(false);
    expect(tokens.some((t) => t.includes("UNIT"))).toBe(false);
  });
});

describe("applyJapaneseNotationSvgReplacements", () => {
  const rawSvg = readFileSync(JP_SVG_PATH, "utf8");

  it("replaces all notation tokens with sample values", () => {
    expect(() =>
      assertJapaneseNotationSvgFullyReplaced(rawSvg, SAMPLE_JP_BACK_NOTATION_REPLACEMENTS),
    ).not.toThrow();
  });

  it("replaces single-line Japanese notation tokens with sample values", () => {
    const out = applyJapaneseNotationSvgReplacements(rawSvg, SAMPLE_JP_BACK_NOTATION_REPLACEMENTS);

    expect(out).toContain("co199");
    expect(out).toContain("146r");
    expect(out).toContain("bo10");
    expect(out).toContain("1s-2r-10x");
    expect(out).toContain("bo14");
    expect(out).toContain("rc000");
    expect(findUnreplacedJapaneseNotationPlaceholders(out)).toEqual([]);
  });

  it("expands multiline tokens into stacked tspans with dy line spacing", () => {
    const out = applyJapaneseNotationSvgReplacements(rawSvg, SAMPLE_JP_BACK_NOTATION_REPLACEMENTS);

    expect(out).toMatch(
      /<text transform="translate\(30\.05 50\.58\)"[^>]*>\s*<tspan x="0" y="0">1s-2r-4x<\/tspan>\s*<tspan x="0" dy="14\.4">2s-1r-1x<\/tspan>\s*<tspan x="0" dy="14\.4">3s-2r-2x<\/tspan>\s*<\/text>/,
    );
    expect(out).toMatch(
      /<text font-family="MyriadPro-Regular[^"]*" font-size="12">\s*<tspan x="149\.81" y="55\.48">bo5s-2r-1x<\/tspan>\s*<tspan x="149\.81" dy="14\.4">bo4s-2r-4x<\/tspan>\s*<\/text>/,
    );
  });

  it("preserves text transforms on multiline elements", () => {
    const out = applyJapaneseNotationSvgReplacements(rawSvg, {
      ...SAMPLE_JP_BACK_NOTATION_REPLACEMENTS,
      "jp-neckline-shaping": "A\nB",
    });

    expect(out).toContain('transform="translate(30.05 50.58)"');
  });

  it("fails when the SVG contains a jp/rc placeholder with no replacement key", () => {
    const tokens = listJapaneseNotationPlaceholdersInSvg(rawSvg);
    expect(tokens.length).toBeGreaterThan(0);
    expect(() => assertJapaneseNotationSvgFullyReplaced(rawSvg, {})).toThrow(
      /missing replacement keys/i,
    );
  });

  it("fails validation when a placeholder has no replacement", () => {
    const incomplete = { ...SAMPLE_JP_BACK_NOTATION_REPLACEMENTS };
    delete incomplete["jp-caston"];
    expect(() => assertJapaneseNotationSvgFullyReplaced(rawSvg, incomplete)).toThrow(
      /missing replacement keys/i,
    );
  });
});

describe("live back Japanese notation SVG", () => {
  const rawSvg = readFileSync(JP_SVG_PATH, "utf8");

  it("replaces every jp/rc token from demo pullover back output", () => {
    const result = demoSleevelessBackPattern();
    const repl = buildBackJapaneseNotationReplacements(result, {});
    expect(() => assertJapaneseNotationSvgFullyReplaced(rawSvg, repl)).not.toThrow();
    const out = applyJapaneseNotationSvgReplacements(rawSvg, repl);
    expect(findUnreplacedJapaneseNotationPlaceholders(out)).toEqual([]);
  });
});
