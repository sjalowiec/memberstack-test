import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import toolsData from "../../../../data/tools.json";
import { distributeTotalAcrossRows } from "../distributeTotalAcrossRows";
import { formatShapingSegment } from "../shapingNotationCompress";
import {
  buildSlopeShapingPresentation,
  calculateSlopeShaping,
  compressSlopeSequence,
  slopeJapaneseNotationLines,
  slopeRowByRowActions,
  slopeSummaryInstruction,
} from "./slopeShaping";

describe("calculateSlopeShaping", () => {
  it("produces 3, 3, 2, 2 for 10 stitches over 8 rows", () => {
    const result = calculateSlopeShaping(10, 8);
    expect(result).toEqual({
      ok: true,
      stitches: 10,
      rows: 8,
      rowInterval: 2,
      shapingActions: 4,
      sequence: [3, 3, 2, 2],
      steps: [
        { stitches: 3, times: 2 },
        { stitches: 2, times: 2 },
      ],
    });
  });

  it("uses ceil(rows / 2) shaping opportunities for odd row counts", () => {
    const result = calculateSlopeShaping(10, 7);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.shapingActions).toBe(4);
    expect(result.sequence).toHaveLength(4);
    expect(result.sequence).toEqual(distributeTotalAcrossRows(10, 4));
  });

  it("places larger amounts first", () => {
    const result = calculateSlopeShaping(11, 8);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.sequence).toEqual([3, 3, 3, 2]);
    expect(result.sequence[0]!).toBeGreaterThanOrEqual(result.sequence[result.sequence.length - 1]!);
  });

  it("preserves every stitch", () => {
    for (const [stitches, rows] of [
      [10, 8],
      [11, 7],
      [25, 10],
      [3, 1],
      [100, 13],
    ] as const) {
      const result = calculateSlopeShaping(stitches, rows);
      expect(result.ok).toBe(true);
      if (!result.ok) continue;
      expect(result.sequence.reduce((sum, n) => sum + n, 0)).toBe(stitches);
    }
  });

  it("handles evenly divisible shaping", () => {
    const result = calculateSlopeShaping(12, 8);
    expect(result).toMatchObject({
      ok: true,
      shapingActions: 4,
      sequence: [3, 3, 3, 3],
      steps: [{ stitches: 3, times: 4 }],
    });
  });

  it("rejects invalid, zero, negative, decimal, and non-finite inputs", () => {
    const invalidPairs: [number, number][] = [
      [0, 8],
      [10, 0],
      [-1, 8],
      [10, -2],
      [10.5, 8],
      [10, 8.2],
      [NaN, 8],
      [10, NaN],
      [Infinity, 8],
      [10, Infinity],
    ];
    for (const [stitches, rows] of invalidPairs) {
      expect(calculateSlopeShaping(stitches, rows)).toEqual({
        ok: false,
        reason: "invalid",
      });
    }
  });

  it("returns not-slope when stitches are not greater than rows", () => {
    expect(calculateSlopeShaping(8, 8)).toEqual({ ok: false, reason: "not-slope" });
    expect(calculateSlopeShaping(6, 10)).toEqual({ ok: false, reason: "not-slope" });
    expect(calculateSlopeShaping(1, 1)).toEqual({ ok: false, reason: "not-slope" });
  });

  it("compressed instructions match the full sequence", () => {
    const result = calculateSlopeShaping(14, 9);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.steps).toEqual(compressSlopeSequence(result.sequence));
    const expanded: number[] = [];
    for (const step of result.steps) {
      for (let i = 0; i < step.times; i++) expanded.push(step.stitches);
    }
    expect(expanded).toEqual(result.sequence.filter((n) => n > 0));
  });

  it("preserves every-other-row shaping behavior", () => {
    const result = calculateSlopeShaping(50, 10);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.rowInterval).toBe(2);
    expect(result.shapingActions).toBe(5);
    const actions = slopeRowByRowActions(result.sequence, result.rowInterval);
    expect(actions.map((a) => a.rc)).toEqual([0, 2, 4, 6, 8]);
  });
});

describe("slope presentation — uniform distribution", () => {
  it("builds row-by-row actions, summary, and a single Japanese-notation group", () => {
    const result = calculateSlopeShaping(50, 10);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.sequence).toEqual([10, 10, 10, 10, 10]);
    expect(result.steps).toEqual([{ stitches: 10, times: 5 }]);

    const presentation = buildSlopeShapingPresentation(result);

    expect(presentation.rowByRow).toEqual([
      { rc: 0, stitches: 10 },
      { rc: 2, stitches: 10 },
      { rc: 4, stitches: 10 },
      { rc: 6, stitches: 10 },
      { rc: 8, stitches: 10 },
    ]);

    expect(presentation.summary).toBe(
      "Beginning at RC 0, bind off or hold 10 stitches at the shaping edge every other row, 5 times.",
    );

    expect(presentation.japaneseNotationLines).toEqual(["10s-2r-5x"]);
    expect(presentation.japaneseNotationLines).toEqual(
      slopeJapaneseNotationLines(result.steps, result.rowInterval),
    );
    expect(presentation.japaneseNotationLines[0]).toBe(
      formatShapingSegment(10, 2, 5),
    );
  });
});

describe("slope presentation — varied distribution", () => {
  it("keeps per-RC amounts, groups consecutive identical actions, and yields multiple JP groups", () => {
    const result = calculateSlopeShaping(10, 8);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.sequence).toEqual([3, 3, 2, 2]);
    expect(result.steps).toEqual([
      { stitches: 3, times: 2 },
      { stitches: 2, times: 2 },
    ]);

    const presentation = buildSlopeShapingPresentation(result);

    expect(presentation.rowByRow).toEqual([
      { rc: 0, stitches: 3 },
      { rc: 2, stitches: 3 },
      { rc: 4, stitches: 2 },
      { rc: 6, stitches: 2 },
    ]);

    expect(presentation.japaneseNotationLines).toEqual(["3s-2r-2x", "2s-2r-2x"]);
    expect(presentation.japaneseNotationLines).toEqual([
      formatShapingSegment(3, 2, 2),
      formatShapingSegment(2, 2, 2),
    ]);

    expect(presentation.summary).toBe(
      "Beginning at RC 0, bind off or hold 3 stitches at the shaping edge every other row, 2 times; then bind off or hold 2 stitches at the shaping edge every other row, 2 times.",
    );

    expect(slopeSummaryInstruction(result.steps)).toBe(presentation.summary);
  });
});

describe("slope presentation agreement", () => {
  it("derives SVG notation, summary, and row-by-row directions from the same shaping result", () => {
    for (const [stitches, rows] of [
      [50, 10],
      [10, 8],
      [12, 8],
      [11, 8],
      [25, 10],
    ] as const) {
      const result = calculateSlopeShaping(stitches, rows);
      expect(result.ok).toBe(true);
      if (!result.ok) continue;

      const presentation = buildSlopeShapingPresentation(result);

      // Row-by-row expands the same sequence
      expect(presentation.rowByRow.map((a) => a.stitches)).toEqual(result.sequence);
      expect(presentation.rowByRow.map((a) => a.rc)).toEqual(
        result.sequence.map((_, i) => i * result.rowInterval),
      );

      // Notation matches compressed steps via shared formatter
      expect(presentation.japaneseNotationLines).toEqual(
        result.steps.map((step) =>
          formatShapingSegment(step.stitches, result.rowInterval, step.times),
        ),
      );

      // Expanding notation groups recovers the sequence
      const expandedFromNotation: number[] = [];
      for (const step of result.steps) {
        for (let i = 0; i < step.times; i++) expandedFromNotation.push(step.stitches);
      }
      expect(expandedFromNotation).toEqual(result.sequence);

      // Summary reflects every step group
      for (const step of result.steps) {
        expect(presentation.summary).toContain(
          `bind off or hold ${step.stitches === 1 ? "1 stitch" : `${step.stitches} stitches`}`,
        );
        expect(presentation.summary).toContain(
          step.times === 1 ? "1 time" : `${step.times} times`,
        );
      }
    }
  });
});

describe("Slope Tool page and registration", () => {
  const tools = toolsData as Array<{
    title?: string;
    href?: string;
    icon?: string;
    description?: string;
    membersonly?: boolean;
    active?: boolean;
    category?: string;
  }>;

  const pagePath = resolve(process.cwd(), "src/pages/tools/slope.astro");
  const pageSource = readFileSync(pagePath, "utf8");

  it("is registered and linked at /tools/slope", () => {
    const tool = tools.find((t) => t.href === "/tools/slope");
    expect(tool).toBeDefined();
    expect(tool?.title).toBe("Slope Tool");
    expect(tool?.active).toBe(true);
    expect(tool?.membersonly).toBe(true);
    expect(tool?.category).toBe("Shaping and Charting");
    expect(tool?.description).toBe(
      "Calculate evenly distributed shaping when there are more stitches than rows, such as shoulder shaping.",
    );
    expect(existsSync(pagePath)).toBe(true);
  });

  it("resolves the icon to /icons/tools/slope.svg", () => {
    const tool = tools.find((t) => t.href === "/tools/slope");
    expect(tool?.icon).toBe("slope.svg");
    const iconPath = resolve(process.cwd(), "public/icons/tools/slope.svg");
    expect(existsSync(iconPath)).toBe(true);
    expect(readFileSync(iconPath, "utf8")).toContain("<svg");
    expect(`/icons/tools/${tool?.icon}`).toBe("/icons/tools/slope.svg");
  });

  it("uses the same member gating as Magic Formula", () => {
    const magic = tools.find((t) => t.href === "/tools/magic-formula");
    const slope = tools.find((t) => t.href === "/tools/slope");
    expect(magic?.membersonly).toBe(true);
    expect(slope?.membersonly).toBe(magic?.membersonly);
  });

  it("preserves Magic Formula guidance and membership gating markup", () => {
    expect(pageSource).toContain('href="/tools/magic-formula"');
    expect(pageSource).toContain("ToolGate");
    expect(pageSource).toContain("ToolPreviewGate");
    expect(pageSource).toContain("<ToolGate tool={tool} />");
  });

  it("uses a dynamic SVG diagram and does not display slope.webp", () => {
    expect(pageSource).toContain('id="slopeDiagramSvg"');
    expect(pageSource).toContain("viewBox=");
    expect(pageSource).not.toContain("slope.webp");
    expect(pageSource).not.toContain("/images/tools/slope.webp");
  });

  it("places a Japanese-notation glossary link directly below the SVG", () => {
    const svgClose = pageSource.indexOf("</svg>");
    const captionIdx = pageSource.indexOf("slope-diagram-caption");
    expect(svgClose).toBeGreaterThan(-1);
    expect(captionIdx).toBeGreaterThan(svgClose);
    expect(pageSource).toContain('href="/glossary/japanese-notation-traditional/"');
    expect(pageSource).toContain('class="glossary-link"');
    expect(pageSource).toContain(">Japanese knitting notation<");
    expect(pageSource).toContain("Learn how to read it.");
    expect(pageSource).not.toMatch(
      /japanese-notation-traditional\/"[^>]*target="_blank"/,
    );
  });

  it("opens Japanese notation via the shared glossary term modal", () => {
    expect(pageSource).toContain("GlossaryTermModal");
    expect(pageSource).toContain('href="/glossary/japanese-notation-traditional/"');
    expect(pageSource).toContain('class="glossary-link"');
    expect(pageSource).not.toContain('href="/glossary/japanese-notation/"');
    expect(pageSource).not.toContain("https://knititnow.com/glossary/");
  });

  it("shows practical instructions instead of internal calculation statistics", () => {
    expect(pageSource).toContain('id="slopeSummaryResult"');
    expect(pageSource).toContain('id="slopeRowDirectionsResult"');
    expect(pageSource).toContain("buildSlopeShapingPresentation");
    expect(pageSource).toContain(">Row by row<");
    expect(pageSource).not.toContain(">Instructions<");
    expect(pageSource).not.toContain("Shaping frequency");
    expect(pageSource).not.toContain("Shaping actions");
    expect(pageSource).not.toContain("Shaping sequence");
    expect(pageSource).not.toContain("slopeStitchesResult");
    expect(pageSource).not.toContain("slopeSequenceResult");
  });

  it("uses the site sans-serif font for all SVG diagram text", () => {
    expect(pageSource).toMatch(
      /\.slope-diagram-label[\s\S]*font-family:\s*var\(--font/,
    );
    expect(pageSource).not.toContain("Georgia");
    expect(pageSource).not.toContain("Times New Roman");
  });

  it("bolds only the RC label in row-by-row directions", () => {
    expect(pageSource).toContain('className = "slope-row-directions__rc"');
    expect(pageSource).toContain("`RC ${action.rc}:`");
    expect(pageSource).toContain("Bind off or hold ${amount} at the shaping edge.");
    expect(pageSource).not.toMatch(
      /li\.textContent\s*=\s*`RC \$\{action\.rc\}:/,
    );
  });

  it("preserves print behavior for diagram and calculated results only", () => {
    expect(pageSource).toContain("PrintButton");
    expect(pageSource).toContain("@media print");
    expect(pageSource).toContain("#slope-results[hidden]");
    expect(pageSource).toContain('data-slope-ready="false"');
    expect(pageSource).toContain('.slope-diagram[data-slope-ready="false"]');
    expect(pageSource).toContain("display: none !important");
  });

  it("keeps only stitches and rows inputs (no gauge)", () => {
    expect(pageSource).toContain('name="slopeStitches"');
    expect(pageSource).toContain('name="slopeRows"');
    expect(pageSource).not.toMatch(/gauge/i);
  });
});
