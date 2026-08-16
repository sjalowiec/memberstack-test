import { describe, expect, it } from "vitest";
import {
  formatCenterStitchesLabel,
  SHAPING_MAP_ANNOTATION_FONT_PX,
  SHAPING_MAP_KNIT_ROW_HEIGHT_RATIO,
  SHAPING_MAP_SYMMETRICAL_NECK_LABEL_ABOVE_LINE_PX,
} from "../patterns/shapingMapSvg";
import {
  buildRoundNecklineGetStartedHtml,
  buildRoundNecklineGetStartedSteps,
  formatRoundNecklineGetStartedStep,
  buildRoundNecklineSkillBuilderDiagramHtml,
  buildRoundNecklineSkillBuilderDiagramSvg,
  buildRoundNecklineSkillBuilderLeftChecklistRows,
  buildRoundNecklineSkillBuilderRightChecklistRows,
  buildRoundNecklineSkillBuilderShapingMapData,
  buildRoundNecklineSkillBuilderShoulderDiagramSvg,
  buildRoundNecklineSkillBuilderShoulderMapData,
  buildRoundNecklineSkillBuilderShoulderWorkHtml,
} from "./roundNecklineSkillBuilderDiagram";
import {
  calculateRoundNecklineSkillBuilder,
  formatSkillBuilderRcLabel,
  SHAPING_ROW_COUNTER_START,
} from "./roundNecklineSkillBuilders";

const GAUGE = { stitchesPerFourInches: 16, rowsPerFourInches: 24 };

const CASES = [
  ["round-neckline-basics", "shallow-back"],
  ["round-neckline-basics", "deep-front"],
  ["round-necklines-shaped-shoulders", "shallow-back"],
  ["round-necklines-shaped-shoulders", "deep-front"],
] as const;

function parseRowNumbers(svg: string): number[] {
  return [...svg.matchAll(/class="shaping-map-row-number"[^>]*>(\d+)</g)].map((m) => Number(m[1]));
}

function parseStepLabels(svg: string): string[] {
  return [...svg.matchAll(/class="shaping-map-step-label[^"]*"[^>]*>([^<]*)</g)].map((m) => m[1]!);
}

function parseGridLines(
  svg: string,
): { x1: number; y1: number; x2: number; y2: number }[] {
  const groups = [...svg.matchAll(/<g class="shaping-map-grid-(?:minor|major)">([\s\S]*?)<\/g>/g)];
  const lines: { x1: number; y1: number; x2: number; y2: number }[] = [];
  for (const group of groups) {
    for (const m of group[1]!.matchAll(
      /<line x1="([\d.]+)" y1="([\d.]+)" x2="([\d.]+)" y2="([\d.]+)"/g,
    )) {
      lines.push({
        x1: Number(m[1]),
        y1: Number(m[2]),
        x2: Number(m[3]),
        y2: Number(m[4]),
      });
    }
  }
  return lines;
}

describe("round neckline Skill Builder shaping charts at 16 sts / 24 rows per 4 inches", () => {
  it("starts the straight back chart at RC 000 with generated neck-edge steps", () => {
    const sample = calculateRoundNecklineSkillBuilder(GAUGE, "round-neckline-basics", "shallow-back")!;
    const data = buildRoundNecklineSkillBuilderShapingMapData(sample);
    expect(sample.rowsBeforeNeckline).toBe(12);
    expect(sample.centerBindOffStitches).toBe(6);
    expect(sample.neckEdgeBindOffs).toEqual([2]);
    expect(sample.neckEdgeDecreaseCount).toBe(2);
    expect(sample.finalShoulderStitches).toBe(9);
    expect(sample.neckDepthRows).toBe(6);
    expect(data.rowMin).toBe(0);
    expect(data.rowMax).toBe(6);
    expect(data.centerStitches).toBe(6);
    expect(data.layout).toBe("symmetrical");
    expect(data.paths.map((path) => path.id)).toEqual([
      "shoulder",
      "neck",
      "shoulder-right",
      "neck-right",
    ]);
    expect(data.paths.find((path) => path.id === "shoulder-right")?.startX).toBe(sample.castOnStitches);

    const neck = data.paths.find((path) => path.id === "neck");
    const labeled = (neck?.steps ?? []).filter((step) => step.stitches > 0);
    expect(labeled.map((step) => step.label)).toEqual(["-1", "-1", "-2"]);
    expect(labeled.at(-1)?.rows).toBe(0);
    const firstNeckBo = sample.firstShoulderRows.find((row) => row.edge === "neck");
    expect(firstNeckBo?.row).toBe(0);
    expect(firstNeckBo?.action).toMatch(/Bind off 2/);
    expect(sample.firstShoulderRows.some((row) => row.row === 0 && row.edge === "neck")).toBe(true);

    const svg = buildRoundNecklineSkillBuilderDiagramSvg(sample);
    expect(svg).toContain('class="shaping-map__svg shaping-map__svg--practice"');
    expect(svg).toMatch(
      /class="shaping-map-row-number" x="[\d.]+" y="[\d.]+" font-size="13" font-weight="400"/,
    );
    const rowYs = [...svg.matchAll(/class="shaping-map-row-number" x="[\d.]+" y="([\d.]+)"[^>]*>(\d+)</g)].map(
      (m) => ({ y: Number(m[1]), row: Number(m[2]) }),
    );
    const yAt = (row: number) => rowYs.find((n) => n.row === row)?.y;
    expect(yAt(0)).toBeDefined();
    expect(yAt(2)).toBeDefined();
    expect(yAt(4)).toBeDefined();
    expect(yAt(6)).toBeDefined();
    expect(rowYs.map((n) => n.row).sort((a, b) => a - b)).toEqual([0, 2, 4, 6]);
    const minus2 = [...svg.matchAll(/<text class="shaping-map-step-label[^"]*" x="([\d.]+)" y="([\d.]+)"[^>]*>-2<\/text>/g)];
    const minus1 = [...svg.matchAll(/<text class="shaping-map-step-label[^"]*" x="([\d.]+)" y="([\d.]+)"[^>]*>-1<\/text>/g)];
    expect(minus1).toHaveLength(2);
    expect(minus2).toHaveLength(1);
    const topMinus1 = { x: Number(minus1[0]![1]), y: Number(minus1[0]![2]) };
    const midMinus1 = { x: Number(minus1[1]![1]), y: Number(minus1[1]![2]) };
    const bottomMinus2 = { x: Number(minus2[0]![1]), y: Number(minus2[0]![2]) };
    expect(topMinus1.y).toBeCloseTo(yAt(4)! - SHAPING_MAP_SYMMETRICAL_NECK_LABEL_ABOVE_LINE_PX, 5);
    expect(midMinus1.y).toBeCloseTo(yAt(2)! - SHAPING_MAP_SYMMETRICAL_NECK_LABEL_ABOVE_LINE_PX, 5);
    expect(bottomMinus2.y).toBeCloseTo(yAt(0)! - SHAPING_MAP_SYMMETRICAL_NECK_LABEL_ABOVE_LINE_PX, 5);
    expect(bottomMinus2.y).toBeLessThan(yAt(0)!);
    expect(midMinus1.y - topMinus1.y).toBeCloseTo(yAt(2)! - yAt(4)!, 5);
    expect(bottomMinus2.y - midMinus1.y).toBeCloseTo(yAt(0)! - yAt(2)!, 5);
    expect(topMinus1.x).toBeLessThan(midMinus1.x);
    expect(midMinus1.x).toBeLessThan(bottomMinus2.x);
    expect(midMinus1.x - topMinus1.x).toBeCloseTo(14, 5);
    expect(bottomMinus2.x - midMinus1.x).toBeCloseTo(28, 5);
    const xs = new Set([topMinus1.x, midMinus1.x, bottomMinus2.x]);
    expect(xs.size).toBe(3);

    const shoulder = data.paths.find((path) => path.id === "shoulder");
    expect(shoulder?.steps.filter((step) => step.stitches > 0).map((step) => step.label)).toEqual([
      "9 sts",
    ]);
  });

  it("draws a visible grid row through RC 006, not only a top-boundary label", () => {
    const sample = calculateRoundNecklineSkillBuilder(GAUGE, "round-neckline-basics", "shallow-back")!;
    const svg = buildRoundNecklineSkillBuilderDiagramSvg(sample);
    const rowCell = 14 * SHAPING_MAP_KNIT_ROW_HEIGHT_RATIO;
    const rowYs = [...svg.matchAll(/class="shaping-map-row-number" x="[\d.]+" y="([\d.]+)"[^>]*>(\d+)</g)].map(
      (m) => ({ y: Number(m[1]), row: Number(m[2]) }),
    );
    const yAt = (row: number) => rowYs.find((n) => n.row === row)?.y;
    expect(rowYs.map((n) => n.row).sort((a, b) => a - b)).toEqual([0, 2, 4, 6]);
    expect(yAt(6)).toBeDefined();
    expect(yAt(0)).toBeDefined();
    expect(yAt(0)! - yAt(6)!).toBeCloseTo(6 * rowCell, 5);

    const lines = parseGridLines(svg);
    const horizontals = lines.filter((line) => line.y1 === line.y2 && line.x1 !== line.x2);
    const verticals = lines.filter((line) => line.x1 === line.x2 && line.y1 !== line.y2);
    const horizontalYs = [...new Set(horizontals.map((line) => line.y1))].sort((a, b) => a - b);
    const gridTop = Math.min(...horizontalYs);
    const gridBottom = Math.max(...horizontalYs);

    expect(horizontalYs.some((y) => Math.abs(y - yAt(6)!) < 0.05)).toBe(true);
    expect(horizontalYs.some((y) => Math.abs(y - yAt(0)!) < 0.05)).toBe(true);
    expect(gridTop).toBeLessThan(yAt(6)!);
    expect(yAt(6)! - gridTop).toBeCloseTo(2 * rowCell, 5);
    expect(gridBottom).toBeCloseTo(yAt(0)!, 5);

    expect(verticals.length).toBeGreaterThan(0);
    for (const line of verticals) {
      expect(Math.min(line.y1, line.y2)).toBeCloseTo(gridTop, 5);
      expect(Math.max(line.y1, line.y2)).toBeCloseTo(gridBottom, 5);
    }

    const shapingDim = svg.match(
      /class="shaping-map-dimension shaping-map-dimension--shaping">\s*<line x1="[\d.]+" y1="([\d.]+)" x2="[\d.]+" y2="([\d.]+)"/,
    );
    expect(shapingDim).toBeTruthy();
    expect(Number(shapingDim![1])).toBeCloseTo(yAt(6)!, 5);
    expect(Number(shapingDim![2])).toBeCloseTo(yAt(0)!, 5);
    expect(svg).toContain(">6 R<");
  });

  it("renders all four exercises to scale from the generated worksheet", () => {
    for (const [builderId, exerciseId] of CASES) {
      const sample = calculateRoundNecklineSkillBuilder(GAUGE, builderId, exerciseId)!;
      const data = buildRoundNecklineSkillBuilderShapingMapData(sample);
      const svg = buildRoundNecklineSkillBuilderDiagramSvg(sample);
      const startRow = 0;
      const endRow = startRow + sample.neckDepthRows;

      expect(sample.rowsBeforeNeckline).toBe(12);
      expect(data.rowMin).toBe(0);
      expect(data.rowMax).toBe(endRow);
      expect(data.rowMax - data.rowMin).toBe(sample.neckDepthRows);
      expect(data.centerStitches).toBe(sample.centerBindOffStitches);
      expect(data.layout).toBe("symmetrical");
      expect(data.paths.some((path) => path.id === "shoulder-right")).toBe(true);
      expect(data.paths.some((path) => path.id === "neck-right")).toBe(true);
      expect(data.paths.find((path) => path.id === "shoulder-right")?.startX).toBe(
        sample.castOnStitches,
      );

      const rows = parseRowNumbers(svg);
      expect(rows).toContain(0);
      expect(rows).toContain(sample.neckDepthRows);
      expect(svg).toContain('class="shaping-map__svg shaping-map__svg--practice"');
      expect(svg).toContain(">000<");
      expect(svg).toContain(`>${String(sample.neckDepthRows).padStart(3, "0")}<`);
      expect(Math.min(...rows)).toBe(0);
      expect(Math.max(...rows)).toBe(sample.neckDepthRows);
      expect(data.rowMin).not.toBe(sample.rowsBeforeNeckline);
      const rowYs = [...svg.matchAll(/class="shaping-map-row-number" x="[\d.]+" y="([\d.]+)"[^>]*>(\d+)</g)].map(
        (m) => ({ y: Number(m[1]), row: Number(m[2]) }),
      );
      const rc0 = rowYs.find((n) => n.row === 0);
      const rc2 = rowYs.find((n) => n.row === 2);
      const rcFinal = rowYs.find((n) => n.row === sample.neckDepthRows);
      expect(rc0).toBeDefined();
      expect(rc2).toBeDefined();
      expect(rcFinal).toBeDefined();
      expect(Math.abs(rc0!.y - rc2!.y)).toBeCloseTo(14 * SHAPING_MAP_KNIT_ROW_HEIGHT_RATIO * 2, 5);
      expect(Math.abs(rc0!.y - rcFinal!.y)).toBeCloseTo(
        sample.neckDepthRows * 14 * SHAPING_MAP_KNIT_ROW_HEIGHT_RATIO,
        5,
      );
      const gridTopY = Math.min(
        ...parseGridLines(svg)
          .filter((line) => line.y1 === line.y2)
          .map((line) => line.y1),
      );
      expect(gridTopY).toBeLessThan(rcFinal!.y);
      expect(rcFinal!.y - gridTopY).toBeCloseTo(14 * SHAPING_MAP_KNIT_ROW_HEIGHT_RATIO * 2, 5);
      expect(svg).not.toContain(`>${formatCenterStitchesLabel(sample.centerBindOffStitches)}<`);
      expect(svg).toContain(`>Cast on ${sample.castOnStitches} sts<`);
      expect(svg).toContain(`>${sample.rowsBeforeNeckline} R<`);
      expect(svg).toContain(`>${sample.neckDepthRows} R<`);
      expect(svg).toContain(">RC000<");
      expect(svg).toContain(`>RC${sample.rowsBeforeNeckline}<`);
      expect(svg).toContain("shaping-map-rc-reset-dash");
      expect(svg).not.toContain("shaping-map-rc-reset-icon");
      expect(svg).not.toContain("Reset RC to 000");
      expect(svg).not.toContain("Knit ");
      expect(svg).toContain(`>-${sample.centerBindOffStitches} center sts<`);
      expect(svg).toContain(`>${sample.firstShoulderSectionStitches} sts<`);
      expect(
        [...svg.matchAll(new RegExp(`>${sample.firstShoulderSectionStitches} sts<`, "g"))],
      ).toHaveLength(2);
      expect(svg).not.toContain(">2-2-1<");
      expect(svg).not.toContain(">1-2-2<");
      expect(svg).not.toContain(">3-2-3<");
      expect(svg).not.toContain("shaping-map-annotation--notation");
      expect(svg).not.toContain(">BO ");
      expect(svg).not.toContain(">Dec ");
      expect(svg).not.toContain("rc12");
      expect(svg).not.toContain("cast on {}");
      expect(svg).not.toContain("{ } rows");
      expect(svg).not.toMatch(/fill="#(?:c00|f00|e11|dc2626)/i);
      expect(svg).not.toContain(">Neck Edge<");
      expect(svg).not.toContain(">Outside Edge<");

      const html = buildRoundNecklineSkillBuilderDiagramHtml(sample);
      expect(html).toContain(svg);
      expect(html).not.toContain("shaping-map__key");
      expect(html).not.toContain("BO = bind off");
      expect(html).not.toContain("Dec = decrease");
      expect(html).not.toContain("Center: bind off");
      expect(html).not.toContain("mirror-image orientation");

      const labels = parseStepLabels(svg);
      for (const amount of sample.neckEdgeBindOffs) {
        expect(labels.filter((label) => label === `-${amount}`).length).toBeGreaterThanOrEqual(1);
      }
      if (sample.neckEdgeDecreaseCount > 0) {
        expect(labels.filter((label) => label === "-1").length).toBeGreaterThanOrEqual(1);
      }
      expect(labels.some((label) => label.startsWith("BO "))).toBe(false);
      expect(labels.some((label) => label.startsWith("Dec "))).toBe(false);
      const minus2 = [...svg.matchAll(/<text class="shaping-map-step-label[^"]*" x="([\d.]+)" y="([\d.]+)"[^>]*>-2<\/text>/g)];
      const minus1 = [...svg.matchAll(/<text class="shaping-map-step-label[^"]*" x="([\d.]+)" y="([\d.]+)"[^>]*>-1<\/text>/g)];
      if (minus2.length > 0 && minus1.length > 0) {
        expect(minus2[0]![2]).not.toBe(minus1[0]![2]);
        expect(minus2[0]![1]).not.toBe(minus1[0]![1]);
        expect(Number(minus1[0]![1])).toBeLessThan(Number(minus2[0]![1]));
      }
      if (minus1.length > 1) {
        expect(minus1[0]![1]).not.toBe(minus1[1]![1]);
        expect(Number(minus1[0]![1])).toBeLessThan(Number(minus1[1]![1]));
        expect(minus1[0]![2]).not.toBe(minus1[1]![2]);
        expect(Number(minus1[0]![2])).toBeLessThan(Number(minus1[1]![2]));
      }
      expect(svg).toMatch(/class="shaping-map-step-label"[^>]*text-anchor="start"[^>]*>-2</);
      const sectionLabels = [
        ...svg.matchAll(
          /<text class="shaping-map-annotation" x="([\d.]+)" y="([\d.]+)"[^>]*>(\d+) sts<\/text>/g,
        ),
      ];
      expect(sectionLabels).toHaveLength(2);
      const leftSectionX = Math.min(Number(sectionLabels[0]![1]), Number(sectionLabels[1]![1]));
      const rightSectionX = Math.max(Number(sectionLabels[0]![1]), Number(sectionLabels[1]![1]));
      const centerAnn = svg.match(
        /<text class="shaping-map-annotation" x="([\d.]+)" y="([\d.]+)"[^>]*>-[\d]+ center sts<\/text>/,
      );
      expect(centerAnn).toBeTruthy();
      const centerX = Number(centerAnn![1]);
      expect(leftSectionX).toBeLessThan(centerX);
      expect(rightSectionX).toBeGreaterThan(centerX);
      expect(sectionLabels[0]![2]).toBe(sectionLabels[1]![2]);
      expect(Number(centerAnn![2])).toBeGreaterThan(Number(sectionLabels[0]![2]));
      if (minus2.length > 0) {
        const minus2X = Number(minus2[0]![1]);
        const minus2Y = Number(minus2[0]![2]);
        expect(minus2X).toBeGreaterThan(leftSectionX);
        expect(minus2X).toBeLessThan(centerX);
        expect(centerX - minus2X).toBeLessThan(minus2X - leftSectionX);
        expect(minus2Y).toBeLessThan(Number(centerAnn![2]));
        expect(minus2Y).toBeLessThan(rc0!.y);
        expect(rc0!.y - minus2Y).toBeCloseTo(SHAPING_MAP_SYMMETRICAL_NECK_LABEL_ABOVE_LINE_PX, 5);
        expect(Number(centerAnn![2]) - minus2Y).toBeGreaterThan(14);
      }
      const practice = svg.match(
        /class="shaping-map-practice"[^>]*y="([\d.]+)"[^>]*height="([\d.]+)"/,
      );
      const practiceDim = svg.match(
        /class="shaping-map-dimension shaping-map-dimension--practice">\s*<line x1="[\d.]+" y1="([\d.]+)" x2="[\d.]+" y2="([\d.]+)"/,
      );
      const shapingDim = svg.match(
        /class="shaping-map-dimension shaping-map-dimension--shaping">\s*<line x1="[\d.]+" y1="([\d.]+)" x2="[\d.]+" y2="([\d.]+)"/,
      );
      expect(practice).toBeTruthy();
      expect(practiceDim).toBeTruthy();
      expect(shapingDim).toBeTruthy();
      expect(Number(practiceDim![1])).toBeCloseTo(Number(practice![1]), 5);
      expect(Number(practiceDim![2])).toBeCloseTo(Number(practice![1]) + Number(practice![2]), 5);
      expect(Number(shapingDim![2])).toBeCloseTo(Number(practice![1]), 5);
      expect(Number(practice![1]) - Number(shapingDim![1])).toBeCloseTo(
        sample.neckDepthRows * 14 * SHAPING_MAP_KNIT_ROW_HEIGHT_RATIO,
        5,
      );
      const dash = svg.match(
        /class="shaping-map-rc-reset-dash" x1="([\d.]+)" y1="([\d.]+)" x2="([\d.]+)" y2="([\d.]+)"/,
      );
      expect(dash).toBeTruthy();
      expect(Number(dash![2])).toBe(Number(dash![4]));
      expect(Number(dash![3]) - Number(dash![1])).toBeGreaterThan(8);
      expect(Number(dash![3]) - Number(dash![1])).toBeLessThan(28);
      const rc000 = [...svg.matchAll(/class="shaping-map-rc-reset-label"[^>]*y="([\d.]+)"[^>]*>RC000</g)][0];
      const rcLower = [...svg.matchAll(new RegExp(`class="shaping-map-rc-reset-label"[^>]*y="([\\d.]+)"[^>]*>RC${sample.rowsBeforeNeckline}<`, "g"))][0];
      expect(rc000).toBeDefined();
      expect(rcLower).toBeDefined();
      expect(Number(rc000![1])).toBeLessThan(Number(rcLower![1]));
      const rightNeckLabels = (data.paths.find((path) => path.id === "neck-right")?.steps ?? [])
        .filter((step) => step.stitches > 0)
        .map((step) => step.label);
      expect(rightNeckLabels.every((label) => !label)).toBe(true);

      const viewBox = svg.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/);
      expect(viewBox).toBeTruthy();
      const svgWidth = Number(viewBox![1]);
      const svgHeight = Number(viewBox![2]);
      const labelPositions = [
        ...svg.matchAll(
        /<text class="shaping-map-(?:step-label[^"]*|row-number|center-label|annotation[^"]*|dimension-label|rc-reset-label)" x="([\d.]+)" y="([\d.]+)"[^>]*>([^<]*)<\/text>/g,
        ),
      ];
      expect(labelPositions.length).toBeGreaterThan(0);
      for (const match of labelPositions) {
        const x = Number(match[1]);
        const y = Number(match[2]);
        expect(x).toBeGreaterThanOrEqual(0);
        expect(x).toBeLessThanOrEqual(svgWidth);
        expect(y).toBeGreaterThanOrEqual(0);
        expect(y).toBeLessThanOrEqual(svgHeight);
      }

      if (builderId === "round-neckline-basics") {
        expect(labels.filter((label) => label === `${sample.finalShoulderStitches} sts`)).toHaveLength(
          1,
        );
        expect(labels.some((label) => label.includes("outside"))).toBe(false);
        expect(
          data.paths.find((path) => path.id === "shoulder")?.steps.filter((step) => step.stitches > 0),
        ).toHaveLength(1);
        expect(
          data.paths
            .find((path) => path.id === "shoulder-right")
            ?.steps.filter((step) => step.stitches > 0),
        ).toHaveLength(1);
        expect(
          (data.paths.find((path) => path.id === "shoulder-right")?.steps ?? []).every(
            (step) => !step.label,
          ),
        ).toBe(true);
      } else {
        for (const amount of sample.outsideShoulderBindOffs) {
          expect(labels.filter((label) => label === `BO ${amount}`)).toHaveLength(0);
        }
        const rightShoulderLabels = (data.paths.find((path) => path.id === "shoulder-right")?.steps ?? [])
          .filter((step) => step.stitches > 0)
          .map((step) => step.label);
        expect(rightShoulderLabels.every((label) => !label)).toBe(true);
        expect(svg).not.toContain("shaping-map-annotation--notation");
        const shoulder = data.paths.find((path) => path.id === "shoulder");
        const neck = data.paths.find((path) => path.id === "neck");
        expect(shoulder?.startRow).toBe(0);
        expect(neck?.startRow).toBe(endRow);
        expect(shoulder?.steps.some((step) => step.stitches > 0)).toBe(true);
        expect(neck?.steps.some((step) => step.stitches > 0)).toBe(true);
        expect(data.paths.find((path) => path.id === "shoulder-right")?.edge).toBe("right");
      }
    }
  });

  it("labels the shaping chart from RC 000, not the lower even-section row count", () => {
    const sample = calculateRoundNecklineSkillBuilder(
      { stitchesPerFourInches: 28, rowsPerFourInches: 40 },
      "round-necklines-shaped-shoulders",
      "deep-front",
    )!;
    const data = buildRoundNecklineSkillBuilderShapingMapData(sample);
    const svg = buildRoundNecklineSkillBuilderDiagramSvg(sample);
    expect(sample.rowsBeforeNeckline).toBeGreaterThan(0);
    expect(data.rowMin).toBe(0);
    expect(data.rowMin).not.toBe(sample.rowsBeforeNeckline);
    expect(parseRowNumbers(svg)).toContain(0);
    expect(svg).toContain(">000<");
    expect(data.rowMax).toBe(sample.neckDepthRows);
    expect(parseRowNumbers(svg)).toContain(sample.neckDepthRows);
    expect(svg).toContain(`>${String(sample.neckDepthRows).padStart(3, "0")}<`);
    expect(svg).toContain(`>Cast on ${sample.castOnStitches} sts<`);
    expect(svg).toContain(`>${sample.rowsBeforeNeckline} R<`);
    expect(svg).toContain(`>${sample.neckDepthRows} R<`);
    expect(svg).toContain(">RC000<");
    expect(svg).toContain(`>RC${sample.rowsBeforeNeckline}<`);
    expect(svg).toContain("shaping-map-rc-reset-dash");
    expect(svg).not.toContain("shaping-map-rc-reset-icon");
    expect(svg).not.toContain("Reset RC to 000");
    expect(svg).toContain(`>-${sample.centerBindOffStitches} center sts<`);
    expect(svg).toContain(`>${sample.firstShoulderSectionStitches} sts<`);
    expect(svg).not.toContain(">2-2-1<");
    expect(svg).not.toContain(">3-2-3<");
    expect(svg).not.toContain(">BO ");
    expect(svg).not.toContain(">Dec ");
    expect(svg).not.toContain(`>${sample.rowsBeforeNeckline}<`);
    expect(svg).not.toContain(`>${formatCenterStitchesLabel(sample.centerBindOffStitches)}<`);
    expect(buildRoundNecklineSkillBuilderDiagramHtml(sample)).not.toContain("shaping-map__key");
    expect(buildRoundNecklineSkillBuilderDiagramHtml(sample)).not.toContain("BO = bind off");
    expect(buildRoundNecklineSkillBuilderDiagramHtml(sample)).not.toContain("Center: bind off");
  });

  it("uses one shared annotation class for instructional stitch-count labels", () => {
    const gauges = [GAUGE, { stitchesPerFourInches: 28, rowsPerFourInches: 40 }] as const;
    for (const [builderId, exerciseId] of CASES) {
      for (const gauge of gauges) {
        const sample = calculateRoundNecklineSkillBuilder(gauge, builderId, exerciseId)!;
        const svg = buildRoundNecklineSkillBuilderDiagramSvg(sample);
        const annotations = [
          ...svg.matchAll(/<text class="shaping-map-annotation"[^>]*>([^<]*)<\/text>/g),
        ].map((m) => m[1]);
        expect(annotations).toEqual([
          `${sample.firstShoulderSectionStitches} sts`,
          `${sample.firstShoulderSectionStitches} sts`,
          `Cast on ${sample.castOnStitches} sts`,
          `-${sample.centerBindOffStitches} center sts`,
        ]);
        expect(svg).not.toMatch(/class="shaping-map-annotation"[^>]*font-size=/);
        expect(SHAPING_MAP_ANNOTATION_FONT_PX).toBe(18);

        const viewBox = svg.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/);
        expect(viewBox).toBeTruthy();
        const svgHeight = Number(viewBox![2]);
        const practice = svg.match(
          /class="shaping-map-practice"[^>]*y="([\d.]+)"[^>]*height="([\d.]+)"/,
        );
        expect(practice).toBeTruthy();
        const gridBottom = Number(practice![1]);
        const practiceBottom = gridBottom + Number(practice![2]);
        const sectionLabels = [
          ...svg.matchAll(
            /<text class="shaping-map-annotation" x="([\d.]+)" y="([\d.]+)"[^>]*>(\d+) sts<\/text>/g,
          ),
        ];
        const centerAnn = svg.match(
          /<text class="shaping-map-annotation" x="([\d.]+)" y="([\d.]+)"[^>]*>-[\d]+ center sts<\/text>/,
        );
        const castOn = svg.match(
          /<text class="shaping-map-annotation" x="([\d.]+)" y="([\d.]+)"[^>]*>Cast on [\d]+ sts<\/text>/,
        );
        expect(sectionLabels).toHaveLength(2);
        expect(centerAnn).toBeTruthy();
        expect(castOn).toBeTruthy();
        const shoulderY = Number(sectionLabels[0]![2]);
        const centerY = Number(centerAnn![2]);
        const castOnY = Number(castOn![2]);
        expect(shoulderY - gridBottom).toBeCloseTo(SHAPING_MAP_ANNOTATION_FONT_PX, 1);
        expect(centerY - shoulderY).toBeCloseTo(SHAPING_MAP_ANNOTATION_FONT_PX, 1);
        expect(castOnY - practiceBottom).toBeCloseTo(SHAPING_MAP_ANNOTATION_FONT_PX, 1);
        expect(castOnY).toBeLessThanOrEqual(svgHeight);
        expect(centerY).toBeLessThan(practiceBottom);
      }
    }
  });
});

function edgeLabelX(svg: string, label: "Outside Edge" | "Neck Edge"): number {
  const match = svg.match(
    new RegExp(`<text class="shaping-map-edge-label" x="([\\d.]+)"[^>]*>${label}</text>`),
  );
  expect(match).toBeTruthy();
  return Number(match![1]);
}

describe("round neckline Skill Builder working charts and checklists", () => {
  it("builds numbered Get Started steps from calculated practice values", () => {
    for (const [builderId, exerciseId] of CASES) {
      for (const gauge of [GAUGE, { stitchesPerFourInches: 28, rowsPerFourInches: 40 }]) {
        const sample = calculateRoundNecklineSkillBuilder(gauge, builderId, exerciseId)!;
        const steps = buildRoundNecklineGetStartedSteps(sample);
        const text = steps.map(formatRoundNecklineGetStartedStep).join(" ");
        const html = buildRoundNecklineGetStartedHtml(sample);
        const shapingStart = formatSkillBuilderRcLabel(SHAPING_ROW_COUNTER_START);
        expect(steps).toHaveLength(6);
        expect(steps[0]?.emphasis).toBe(`Cast on ${sample.castOnStitches} stitches.`);
        expect(steps[1]?.emphasis).toBe(
          `Knit ${sample.rowsBeforeNeckline} rows even. Reset row counter to 000.`,
        );
        expect(steps[2]?.rc).toBe(SHAPING_ROW_COUNTER_START);
        expect(steps[2]?.emphasis).toBe(
          `break the yarn and scrap off the ${sample.firstShoulderSectionStitches} right-shoulder stitches.`,
        );
        expect(steps[3]?.rc).toBe(SHAPING_ROW_COUNTER_START);
        expect(steps[3]?.emphasis).toBe(
          `bind off ${sample.centerBindOffStitches} center stitches.`,
        );
        expect(steps[5]?.emphasis).toBe("reset the row counter to 000");
        expect(text).toContain(`Cast on ${sample.castOnStitches} stitches.`);
        expect(text).toContain(`Knit ${sample.rowsBeforeNeckline} rows even. Reset row counter to 000.`);
        expect(text).toContain(`${shapingStart} At the shaping row,`);
        expect(text).toContain(`${shapingStart} Join yarn at the center neck edge`);
        expect(text).toContain(`${sample.firstShoulderSectionStitches} right-shoulder stitches`);
        expect(text).toContain(`bind off ${sample.centerBindOffStitches} center stitches`);
        expect(text).toContain("reset the row counter to 000");
        expect(text).toContain("shape the right shoulder as a mirror image");
        expect(text).not.toMatch(/Follow the chart to cast on/);
        expect(text).not.toMatch(/Common Mistakes|Pause and Check|Worksheet Summary/i);
        expect(html).toContain("<li>");
        expect(html).toContain(`<strong>${shapingStart}</strong>`);
        expect(html).toContain("<strong>reset the row counter to 000</strong>");
        expect(html.match(/<li>/g)?.length).toBe(6);
        expect(html.match(new RegExp(`<strong>${shapingStart}</strong>`, "g"))?.length).toBe(2);
        if (sample.shoulderStyle === "shaped") {
          expect(text).toMatch(/neck-edge and outside-shoulder shaping during the same rows/);
          expect(text).toMatch(/working both edges during the same rows/);
        } else {
          expect(text).not.toMatch(/outside-shoulder shaping/);
          expect(text).toMatch(/using the row-by-row instructions below/);
        }
      }
    }
  });

  it("uses the 32-stitch / 12-row sample Get Started wording with RC:000 at the shaping start", () => {
    const sample = calculateRoundNecklineSkillBuilder(GAUGE, "round-neckline-basics", "shallow-back")!;
    expect(sample.castOnStitches).toBe(32);
    expect(sample.rowsBeforeNeckline).toBe(12);
    expect(sample.firstShoulderSectionStitches).toBe(13);
    expect(sample.centerBindOffStitches).toBe(6);
    const steps = buildRoundNecklineGetStartedSteps(sample).map(formatRoundNecklineGetStartedStep);
    expect(steps[1]).toBe("Knit 12 rows even. Reset row counter to 000.");
    expect(steps[2]).toBe(
      "RC:000 At the shaping row, break the yarn and scrap off the 13 right-shoulder stitches.",
    );
    expect(steps[3]).toBe(
      "RC:000 Join yarn at the center neck edge and bind off 6 center stitches.",
    );
    expect(steps[5]).toContain("reset the row counter to 000");
    expect(steps[5]).toContain("shape the right shoulder as a mirror image");
  });

  it("builds a reversed right-shoulder checklist with separate progress ids", () => {
    for (const [builderId, exerciseId] of CASES) {
      for (const gauge of [GAUGE, { stitchesPerFourInches: 28, rowsPerFourInches: 40 }]) {
        const sample = calculateRoundNecklineSkillBuilder(gauge, builderId, exerciseId)!;
        const left = buildRoundNecklineSkillBuilderLeftChecklistRows(sample);
        const right = buildRoundNecklineSkillBuilderRightChecklistRows(sample);
        const lastShaping = sample.firstShoulderRows.at(-1);
        expect(lastShaping?.row).toBe(sample.neckDepthRows - 1);
        expect(left.length).toBe(sample.firstShoulderRows.length + 1);
        expect(left[0]?.rc).toBe(0);
        expect(left[0]?.carriagePosition).toBe("Right");
        expect(right[0]?.rc).toBe(0);
        expect(right[0]?.carriagePosition).toBe("Left");
        expect(left.at(-1)).toMatchObject({
          rc: sample.neckDepthRows,
          carriagePosition: "Right",
          action: "Knit even",
          edge: "Shoulder",
          stitchesRemaining: lastShaping?.stitchesAfter,
        });
        expect(right.at(-1)).toMatchObject({
          rc: sample.neckDepthRows,
          carriagePosition: "Left",
          action: "Knit even",
          edge: "Shoulder",
          stitchesRemaining: lastShaping?.stitchesAfter,
        });
        expect(left.slice(0, -1).map((row) => row.rc)).toEqual(
          sample.firstShoulderRows.map((row) => row.row),
        );
        expect(left.map((row) => row.rc)).toEqual(right.map((row) => row.rc));
        expect(left.map((row) => row.action)).toEqual(right.map((row) => row.action));
        expect(left.map((row) => row.edge)).toEqual(right.map((row) => row.edge));
        expect(left.every((row, i) => row.carriagePosition !== right[i]?.carriagePosition)).toBe(
          true,
        );

        const leftWork = buildRoundNecklineSkillBuilderShoulderWorkHtml(sample, "left");
        const rightWork = buildRoundNecklineSkillBuilderShoulderWorkHtml(sample, "right");
        expect(leftWork.checklistHtml).toContain(`data-chart-id="sb-${builderId}-${exerciseId}-left"`);
        expect(rightWork.checklistHtml).toContain(
          `data-chart-id="sb-${builderId}-${exerciseId}-right"`,
        );
        expect(leftWork.checklistHtml).toContain("Show Completed Rows");
        expect(leftWork.checklistHtml).toContain("Reset Checklist");
        expect(leftWork.checklistHtml).toContain(">Done<");
        expect(leftWork.checklistHtml).toContain("RC");
        expect(leftWork.checklistHtml).toContain(">Action<");
        expect(leftWork.checklistHtml).toContain(">Edge<");
        expect(leftWork.checklistHtml).toContain("Sts Remaining");
        expect(leftWork.checklistHtml).toMatch(
          /ns-shaping-chart__row-counter-number">000<\/span> <span class="ns-shaping-chart__row-counter-side">\(Right\)/,
        );
        expect(rightWork.checklistHtml).toMatch(
          /ns-shaping-chart__row-counter-number">000<\/span> <span class="ns-shaping-chart__row-counter-side">\(Left\)/,
        );
        const completion = String(sample.neckDepthRows).padStart(3, "0");
        expect(leftWork.checklistHtml).toMatch(
          new RegExp(
            `ns-shaping-chart__row-counter-number">${completion}<\\/span> <span class="ns-shaping-chart__row-counter-side">\\(Right\\)`,
          ),
        );
        expect(rightWork.checklistHtml).toMatch(
          new RegExp(
            `ns-shaping-chart__row-counter-number">${completion}<\\/span> <span class="ns-shaping-chart__row-counter-side">\\(Left\\)`,
          ),
        );
        expect(leftWork.checklistHtml).toContain("Knit even");
        expect(rightWork.checklistHtml).toContain("Knit even");

        const shapingRows = sample.firstShoulderRows.filter((row) => row.edge !== "even");
        expect(shapingRows.length).toBeGreaterThan(0);
        for (const row of shapingRows) {
          const label = formatSkillBuilderRcLabel(row.row);
          const leftMatch = left.find((item) => item.rc === row.row);
          const rightMatch = right.find((item) => item.rc === row.row);
          expect(leftMatch?.action.startsWith(`${label} `)).toBe(true);
          expect(rightMatch?.action).toBe(leftMatch?.action);
          expect(leftWork.checklistHtml).toContain(label);
          expect(rightWork.checklistHtml).toContain(label);
        }
        expect(left.filter((row) => row.action === "Knit even").length).toBeGreaterThan(0);
        expect(left.some((row) => row.action.startsWith("RC:") && row.action.includes("Knit even"))).toBe(
          false,
        );
      }
    }
  });

  it("ends the 16/24 shallow-back left checklist with RC 006 knit even at 9 stitches", () => {
    const sample = calculateRoundNecklineSkillBuilder(
      GAUGE,
      "round-neckline-basics",
      "shallow-back",
    )!;
    expect(sample.neckDepthRows).toBe(6);
    expect(sample.finalShoulderStitches).toBe(9);
    const left = buildRoundNecklineSkillBuilderLeftChecklistRows(sample);
    expect(left.at(-1)).toEqual({
      rc: 6,
      carriagePosition: "Right",
      action: "Knit even",
      edge: "Shoulder",
      stitchesRemaining: 9,
    });
  });

  it("shows neck and outside-edge actions in the shaped-shoulder checklists", () => {
    for (const exerciseId of ["shallow-back", "deep-front"] as const) {
      const sample = calculateRoundNecklineSkillBuilder(
        GAUGE,
        "round-necklines-shaped-shoulders",
        exerciseId,
      )!;
      const left = buildRoundNecklineSkillBuilderLeftChecklistRows(sample);
      expect(left.some((row) => row.edge === "Neck" && /Bind off|Decrease/.test(row.action))).toBe(
        true,
      );
      expect(left.some((row) => row.edge === "Shoulder" && /Bind off/.test(row.action))).toBe(true);
      for (const row of sample.firstShoulderRows.filter((item) => item.edge !== "even")) {
        const match = left.find((item) => item.rc === row.row);
        expect(match?.action.startsWith(`${formatSkillBuilderRcLabel(row.row)} `)).toBe(true);
      }
      const neckRows = new Set(left.filter((row) => row.edge === "Neck").map((row) => row.rc));
      const bindOffShoulderRows = left
        .filter((row) => row.edge === "Shoulder" && /Bind off/.test(row.action))
        .map((row) => row.rc);
      expect(bindOffShoulderRows.every((rc) => rc <= sample.neckDepthRows - 1)).toBe(true);
      expect(left.at(-1)).toMatchObject({
        rc: sample.neckDepthRows,
        action: "Knit even",
        edge: "Shoulder",
      });
      expect(neckRows.size).toBeGreaterThan(0);
      expect(bindOffShoulderRows.length).toBeGreaterThan(0);
    }
  });

  it("orients the working charts as single shoulders, not the full practice piece", () => {
    for (const [builderId, exerciseId] of CASES) {
      const sample = calculateRoundNecklineSkillBuilder(GAUGE, builderId, exerciseId)!;
      const overview = buildRoundNecklineSkillBuilderDiagramSvg(sample);
      const data = buildRoundNecklineSkillBuilderShoulderMapData(sample);
      const leftSvg = buildRoundNecklineSkillBuilderShoulderDiagramSvg(sample, "left");
      const rightSvg = buildRoundNecklineSkillBuilderShoulderDiagramSvg(sample, "right");

      expect(data.layout).toBe("single-edge");
      expect(data.rowMax).toBe(sample.neckDepthRows);
      const workingRows = parseRowNumbers(leftSvg);
      expect(workingRows).toContain(0);
      expect(workingRows).toContain(sample.neckDepthRows);
      expect(leftSvg).toContain(">000<");
      expect(leftSvg).toContain(`>${String(sample.neckDepthRows).padStart(3, "0")}<`);
      expect(rightSvg).toContain(">000<");
      expect(rightSvg).toContain(`>${String(sample.neckDepthRows).padStart(3, "0")}<`);
      expect(Math.max(...workingRows)).toBe(sample.neckDepthRows);
      expect(data.paths.some((path) => path.id === "shoulder-right")).toBe(false);
      expect(overview).toContain("shaping-map-practice");
      expect(overview).toContain('class="shaping-map__svg shaping-map__svg--practice"');
      expect(overview).toContain(`>Cast on ${sample.castOnStitches} sts<`);
      expect(leftSvg).not.toContain("shaping-map-practice");
      expect(rightSvg).not.toContain("shaping-map-practice");
      expect(leftSvg).not.toContain("shaping-map__svg--practice");
      expect(rightSvg).not.toContain("shaping-map__svg--practice");
      expect(leftSvg).not.toContain('font-size="13" font-weight="400"');
      expect(rightSvg).not.toContain('font-size="13" font-weight="400"');
      expect(leftSvg).not.toContain(">Cast on ");
      expect(rightSvg).not.toContain(">Cast on ");
      expect(leftSvg).not.toContain(`>${formatCenterStitchesLabel(sample.centerBindOffStitches)}<`);
      expect(rightSvg).not.toContain(`>${formatCenterStitchesLabel(sample.centerBindOffStitches)}<`);
      expect(leftSvg).toContain(">Outside Edge<");
      expect(leftSvg).toContain(">Neck Edge<");
      expect(rightSvg).toContain(">Outside Edge<");
      expect(rightSvg).toContain(">Neck Edge<");
      expect(leftSvg).not.toBe(rightSvg);

      const leftNeckX = edgeLabelX(leftSvg, "Neck Edge");
      const leftOutsideX = edgeLabelX(leftSvg, "Outside Edge");
      const rightNeckX = edgeLabelX(rightSvg, "Neck Edge");
      const rightOutsideX = edgeLabelX(rightSvg, "Outside Edge");
      expect(leftNeckX).toBeGreaterThan(leftOutsideX);
      expect(rightNeckX).toBeLessThan(rightOutsideX);
    }
  });

  it("keeps the working chart and checklist in sync after a gauge change", () => {
    const coarse = calculateRoundNecklineSkillBuilder(
      GAUGE,
      "round-necklines-shaped-shoulders",
      "deep-front",
    )!;
    const fine = calculateRoundNecklineSkillBuilder(
      { stitchesPerFourInches: 28, rowsPerFourInches: 40 },
      "round-necklines-shaped-shoulders",
      "deep-front",
    )!;
    expect(fine.castOnStitches).not.toBe(coarse.castOnStitches);
    expect(buildRoundNecklineGetStartedHtml(fine)).not.toBe(
      buildRoundNecklineGetStartedHtml(coarse),
    );

    const coarseLeft = buildRoundNecklineSkillBuilderLeftChecklistRows(coarse);
    const fineLeft = buildRoundNecklineSkillBuilderLeftChecklistRows(fine);
    expect(fineLeft.map((row) => row.stitchesRemaining)).not.toEqual(
      coarseLeft.map((row) => row.stitchesRemaining),
    );
    expect(buildRoundNecklineSkillBuilderShoulderWorkHtml(fine, "left").checklistHtml).toContain(
      String(fineLeft[0]!.stitchesRemaining),
    );
    expect(buildRoundNecklineSkillBuilderDiagramSvg(fine)).not.toBe(
      buildRoundNecklineSkillBuilderDiagramSvg(coarse),
    );
    expect(buildRoundNecklineSkillBuilderDiagramSvg(fine)).toContain(
      `>-${fine.neckEdgeBindOffs[0]}<`,
    );
  });
});
