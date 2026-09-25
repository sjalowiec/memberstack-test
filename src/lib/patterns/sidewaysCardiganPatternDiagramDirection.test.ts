import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  DS_FONT,
  DS_FS_MEASURE,
  DS_FS_TITLE,
  DS_FW_TITLE,
  DS_VB_W,
} from "./dropShoulderPatternDiagramSvgShared";
import { DS_FS_NOTATION, DS_NOTATION_GAP } from "./dropShoulderShapingNotationDiagramShared";
import { SLEEVELESS_DIAGRAM_INLINE_CLASS } from "./sleevelessDiagramModal";
import {
  formatPatternDiagramCountLabel,
  formatPatternDiagramMeasurement,
} from "./patternStitchesRowsDiagramLabel";
import {
  formatBindOffNotation,
  formatCastOnNotation,
  formatHoldNotation,
} from "./sleevelessBackJapaneseNotation";
import { calculateSidewaysCardiganBody } from "./sidewaysCardiganBodyCalc";
import type { SidewaysCardiganBodyCalcInput } from "./sidewaysCardiganBodyCalc";
import {
  buildSidewaysCardiganBodyInstructions,
  type SidewaysCardiganBodyInstructions,
} from "./sidewaysCardiganBodyInstructions";
import {
  buildSidewaysCardiganPatternDiagramFrame,
  buildSidewaysCardiganPatternDiagramModel,
  buildSidewaysCardiganPatternDiagramSvg,
  sidewaysDiagramEdgeStitchCount,
  sidewaysKnitVisualY,
  sidewaysPatternDiagramCanvas,
  sidewaysPatternDiagramTypography,
  type SidewaysCardiganPatternDiagramModel,
} from "./sidewaysCardiganPatternDiagramSvg";
import {
  buildSidewaysCardiganShapingNotationDiagramSvg,
  sidewaysCardiganVNeckNotationLines,
  sidewaysNotationLinePitch,
} from "./sidewaysCardiganShapingNotationDiagramSvg";
import { calculateSidewaysCardiganSleeve } from "./sidewaysCardiganSleeveCalc";
import { buildSidewaysCardiganPatternDiagramTabsShellHtml } from "./sidewaysCardiganPatternDiagramTabs";

const srcRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");

const SAMPLE: SidewaysCardiganBodyCalcInput = {
  garmentLengthInches: 22,
  vNeckDepthInches: 8,
  finishedBustCircumferenceInches: 40,
  finishedUpperArmInches: 14,
  neckOpeningWidthInches: 7,
  backNeckDepthInches: 1,
  stitchesPerInch: 5,
  rowsPerInch: 7,
};

type DiagramText = {
  role: string;
  text: string;
  x: number;
  y: number;
  size: number;
  order: number;
  side: string;
  step: string;
  edge: string;
  family: string;
  weight: string;
};

function attr(source: string, name: string): string {
  return new RegExp(`(?:^|\\s)${name}="([^"]*)"`).exec(source)?.[1] ?? "";
}

function diagramTexts(svg: string): DiagramText[] {
  return [...svg.matchAll(/<text\b([^>]*)>([\s\S]*?)<\/text>/g)].map((match) => {
    const attrs = match[1] ?? "";
    const text = (match[2] ?? "").replace(/<[^>]+>/g, "");
    return {
      role: attr(attrs, "data-role"),
      text,
      x: Number(attr(attrs, "x")),
      y: Number(attr(attrs, "y")),
      size: Number(attr(attrs, "font-size")),
      order: Number(attr(attrs, "data-stack-order") || "0"),
      side: attr(attrs, "data-side"),
      step: attr(attrs, "data-opening-step"),
      edge: attr(attrs, "data-edge") || attr(attrs, "data-knit-edge"),
      family: attr(attrs, "font-family"),
      weight: attr(attrs, "font-weight"),
    };
  });
}

function byRole(svg: string, role: string): DiagramText[] {
  return diagramTexts(svg)
    .filter((item) => item.role === role)
    .sort((a, b) => a.order - b.order || b.y - a.y);
}

function viewBoxOf(svg: string): { x: number; y: number; width: number; height: number } {
  const parts = /viewBox="([^"]+)"/.exec(svg)?.[1]?.split(/\s+/).map(Number) ?? [];
  return { x: parts[0] ?? 0, y: parts[1] ?? 0, width: parts[2] ?? 0, height: parts[3] ?? 0 };
}

function instructionsFor(style: "cardigan" | "pullover"): SidewaysCardiganBodyInstructions {
  const result = buildSidewaysCardiganBodyInstructions(SAMPLE, style);
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error(result.error.message);
  return result.instructions;
}

function modelFor(
  style: "cardigan" | "pullover",
  instructions: SidewaysCardiganBodyInstructions,
): SidewaysCardiganPatternDiagramModel {
  const calcResult = calculateSidewaysCardiganBody(SAMPLE);
  expect(calcResult.ok).toBe(true);
  if (!calcResult.ok) throw new Error(calcResult.error.message);
  const sleeve = calculateSidewaysCardiganSleeve({
    direction: "cuff-up",
    finishedUpperArmInches: SAMPLE.finishedUpperArmInches,
    finishedWristInches: 8,
    sleeveLengthInches: 18,
    stitchesPerInch: SAMPLE.stitchesPerInch,
    rowsPerInch: SAMPLE.rowsPerInch,
    cuffDepthInches: 2,
    armholeDepthInches: calcResult.calc.armholeDepthInches,
  });
  return buildSidewaysCardiganPatternDiagramModel({
    garmentStyle: style,
    sleeveDirection: "cuff-up",
    calc: instructions.calc,
    input: SAMPLE,
    sleeveCalc: style === "pullover" && sleeve.ok ? sleeve.calc : null,
    sleeveLengthInches: 18,
    wristInches: 8,
    vNeckIncreaseSequence: instructions.increaseSequence,
    vNeckDecreaseSequence: instructions.decreaseSequence,
  });
}

function labelLineBoxes(svg: string): Array<{ role: string; text: string; left: number; right: number; top: number; bottom: number }> {
  const boxes: Array<{ role: string; text: string; left: number; right: number; top: number; bottom: number }> = [];
  for (const match of svg.matchAll(/<text\b([^>]*)>([\s\S]*?)<\/text>/g)) {
    const attrs = match[1] ?? "";
    const inner = match[2] ?? "";
    const role = attr(attrs, "data-role");
    const anchor = attr(attrs, "text-anchor") || "start";
    const baseSize = Number(attr(attrs, "font-size")) || 16;
    const baseX = Number(attr(attrs, "x"));
    let y = Number(attr(attrs, "y"));
    const tspans = [...inner.matchAll(/<tspan\b([^>]*)>([\s\S]*?)<\/tspan>/g)];
    const lines = tspans.length
      ? tspans.map((span) => {
          const spanAttrs = span[1] ?? "";
          y += Number(attr(spanAttrs, "dy")) || 0;
          return {
            text: (span[2] ?? "").replace(/<[^>]+>/g, "").trim(),
            x: Number(attr(spanAttrs, "x")) || baseX,
            y,
            size: Number(attr(spanAttrs, "font-size")) || baseSize,
          };
        })
      : [{ text: inner.replace(/<[^>]+>/g, "").trim(), x: baseX, y, size: baseSize }];
    for (const line of lines) {
      const width = line.text.length * line.size * 0.55;
      const left = anchor === "end" ? line.x - width : anchor === "middle" ? line.x - width / 2 : line.x;
      boxes.push({
        role,
        text: line.text,
        left,
        right: left + width,
        top: line.y - line.size * 0.85,
        bottom: line.y + line.size * 0.25,
      });
    }
  }
  return boxes;
}

function sectionMidY(svg: string, side: "first" | "second"): number {
  const match = new RegExp(
    `data-role="dim-front-section"[^>]*data-side="${side}"[\\s\\S]*?<line[^>]*y1="([^"]+)"[^>]*y2="([^"]+)"`,
  ).exec(svg);
  expect(match).not.toBeNull();
  return (Number(match?.[1]) + Number(match?.[2])) / 2;
}

describe.each(["cardigan", "pullover"] as const)("Sideways %s diagram direction and type", (style) => {
  const instructions = instructionsFor(style);
  const model = modelFor(style, instructions);
  const frame = buildSidewaysCardiganPatternDiagramFrame(model);
  const canvas = sidewaysPatternDiagramCanvas(frame);
  const sts = buildSidewaysCardiganPatternDiagramSvg(model);
  const shaping = buildSidewaysCardiganShapingNotationDiagramSvg(model);
  const edge = sidewaysDiagramEdgeStitchCount(model.calc);
  const lines = sidewaysCardiganVNeckNotationLines(model);

  it("uses the shared finished-pattern type scaled to the viewBox, not a second standard", () => {
    const type = sidewaysPatternDiagramTypography(canvas.type.viewBoxWidth);
    expect(type).toEqual(canvas.type);
    expect(type.pieceWeight).toBe(DS_FW_TITLE);
    expect(type.stitch / canvas.type.viewBoxWidth).toBeCloseTo(DS_FS_NOTATION / DS_VB_W, 2);
    expect(type.notation / canvas.type.viewBoxWidth).toBeCloseTo(DS_FS_NOTATION / DS_VB_W, 2);
    expect(type.row / canvas.type.viewBoxWidth).toBeCloseTo(DS_FS_MEASURE / DS_VB_W, 2);
    expect(type.piece / canvas.type.viewBoxWidth).toBeCloseTo(DS_FS_TITLE / DS_VB_W, 2);
    expect(type.notationGap / canvas.type.viewBoxWidth).toBeCloseTo(DS_NOTATION_GAP / DS_VB_W, 2);
    expect(type.stitch).toBeGreaterThan(DS_FS_NOTATION);

    for (const svg of [sts, shaping]) {
      expect(svg).toContain(`font-family="${DS_FONT}"`);
      expect(svg).toContain(`font-size="${type.notation}"`);
      expect(svg).not.toMatch(/font-size="(?:11|12)"/);
      const labels = diagramTexts(svg);
      expect(labels.every((label) => label.family === DS_FONT || label.family === "")).toBe(true);
      expect(labels.every((label) => label.size >= type.piece)).toBe(true);
    }

    const piece = byRole(sts, "front-rows")[0];
    expect(piece?.size).toBe(type.piece);
    expect(piece?.weight).toBe(String(DS_FW_TITLE));
    expect(sts).toContain(`font-size="${type.row}"`);
    expect(sts).toContain(`font-size="${type.piece}"`);
    expect(byRole(sts, "cast-on-sts")[0]?.size).toBe(type.stitch);
    expect(byRole(sts, "bind-off-sts")[0]?.size).toBe(type.stitch);
    expect(byRole(shaping, "jp-caston")[0]?.size).toBe(type.notation);
    expect(byRole(shaping, "jp-final-bo")[0]?.size).toBe(type.notation);
  });

  it("starts with cast-on at the bottom and ends with bind-off at the top", () => {
    const castOn = byRole(sts, "cast-on-sts")[0];
    const bindOff = byRole(sts, "bind-off-sts")[0];
    const notationCastOn = byRole(shaping, "jp-caston")[0];
    const notationBindOff = byRole(shaping, "jp-final-bo")[0];
    const length = formatPatternDiagramMeasurement(model.measurements.finishedLengthInches, model.displayUnit);
    expect(castOn?.text).toBe(`CO ${formatPatternDiagramCountLabel(edge, "sts", length)}`);
    expect(bindOff?.text).toBe(`BO ${formatPatternDiagramCountLabel(edge, "sts", length)}`);
    expect(notationCastOn?.text).toBe(formatCastOnNotation(edge));
    expect(notationBindOff?.text).toBe(formatBindOffNotation(edge));
    expect(castOn!.y).toBeGreaterThan(bindOff!.y);
    expect(notationCastOn!.y).toBeGreaterThan(notationBindOff!.y);
    expect(castOn!.y).toBeGreaterThan(frame.bottomY - 1);
    expect(bindOff!.y).toBeLessThan(frame.topY + 1);

    const castOnStep = instructions.steps.find(
      (step) => step.id === "closed-cast-on-full-width" || step.id === "cast-on-side-seam",
    );
    const bindOffStep = instructions.steps.find(
      (step) => step.id === "bind-off-full-width" || step.id === "bind-off-side-seam",
    );
    expect(castOnStep?.stitchesAfter).toBe(edge);
    expect(bindOffStep?.stitchesBefore).toBe(edge);
    expect(sts).toContain('data-knit-direction="bottom-up"');
    expect(shaping).toContain('data-knit-direction="bottom-up"');
    expect(sts).toContain("scale(1 -1)");
    expect(shaping).toContain('data-knit-flip="vertical"');
  });

  it("shows bind-off before cast-on at each armhole and at the back neck", () => {
    const armhole = model.calc.armholeDepthStitches;
    const backNeck = model.calc.backNeckDepthStitches;
    const slits = byRole(shaping, "jp-armhole-slit");
    const sides = style === "cardigan" ? ["first", "second"] : ["knitted"];
    expect(new Set(slits.map((item) => item.side))).toEqual(new Set(sides));
    for (const side of sides) {
      const bindOff = slits.find((item) => item.side === side && item.step === "bind-off");
      const castOn = slits.find((item) => item.side === side && item.step === "cast-on");
      expect(bindOff?.text).toBe(formatBindOffNotation(armhole));
      expect(castOn?.text).toBe(formatCastOnNotation(armhole));
      expect(bindOff!.y).toBeGreaterThan(castOn!.y);
      expect(bindOff!.y - castOn!.y).toBeCloseTo(sidewaysNotationLinePitch(canvas.type), 1);
    }
    if (style === "cardigan") {
      const first = slits.find((item) => item.side === "first" && item.step === "bind-off");
      const second = slits.find((item) => item.side === "second" && item.step === "bind-off");
      expect(first!.y).toBeGreaterThan(second!.y);
    }

    const neckBindOff = byRole(shaping, "jp-back-neck-bo")[0];
    const neckCastOn = byRole(shaping, "jp-back-neck-co")[0];
    expect(neckBindOff?.text).toBe(formatBindOffNotation(backNeck));
    expect(neckCastOn?.text).toBe(formatCastOnNotation(backNeck));
    expect(neckBindOff!.y).toBeGreaterThan(neckCastOn!.y);

    const armholeStep = instructions.steps.find((step) => step.id.includes("armhole"));
    const neckBindOffStep = instructions.steps.find((step) => step.id === "bind-off-back-neck");
    const neckCastOnStep = instructions.steps.find((step) => step.id === "cast-on-back-neck");
    expect(armholeStep?.summary).toContain(`bind off ${armhole} stitches, cast on ${armhole} stitches`);
    expect(neckBindOffStep?.summary).toContain(`Bind off ${backNeck} stitches`);
    expect(neckCastOnStep?.summary).toContain(`Cast on ${backNeck} stitches`);
    expect(neckBindOffStep && neckCastOnStep && neckBindOffStep.order < neckCastOnStep.order).toBe(true);
  });

  it("keeps increase and decrease on the neck edge in bottom-to-top order", () => {
    const first = byRole(shaping, "jp-vneck-first");
    const second = byRole(shaping, "jp-vneck-second");
    const expectedFirst = style === "pullover" ? lines.decrease : lines.increase;
    const expectedSecond = style === "pullover" ? lines.increase : lines.decrease;
    expect(first.map((item) => item.text)).toEqual(expectedFirst);
    expect(second.map((item) => item.text)).toEqual(expectedSecond);
    expect(first.every((item) => item.x > frame.neckX)).toBe(true);
    expect(second.every((item) => item.x > frame.neckX)).toBe(true);
    expect(first.every((item) => item.edge === "neck")).toBe(true);
    const betweenStacks = Math.min(...first.map((item) => item.y)) - Math.max(...second.map((item) => item.y));
    expect(betweenStacks).toBeGreaterThanOrEqual(sidewaysNotationLinePitch(canvas.type) - 0.05);
    for (const group of [first, second]) {
      for (let i = 1; i < group.length; i += 1) {
        expect(group[i - 1]!.y).toBeGreaterThan(group[i]!.y);
        expect(group[i - 1]!.y - group[i]!.y).toBeCloseTo(sidewaysNotationLinePitch(canvas.type), 1);
      }
    }
    expect(lines.increase.some((line) => line.startsWith("+"))).toBe(true);
    expect(lines.decrease.some((line) => line.startsWith("-"))).toBe(true);
    expect(lines.increase.every((line) => line.startsWith("+") || /^\d+r$/.test(line))).toBe(true);
    expect(lines.decrease.every((line) => line.startsWith("-") || /^\d+r$/.test(line))).toBe(true);
  });

  it("matches body-instruction stitch and row counts", () => {
    const { calc } = model;
    expect(sts).toContain(`${calc.frontRows} rows`);
    expect(sts).toContain(`${calc.backRows} rows`);
    expect(sts).toContain(`${calc.shoulders.firstFrontRows} rows`);
    expect(sts).toContain(`${calc.halfNeckRows} rows`);
    expect(sts).toContain(`${calc.bust.actualTotalBustRows} rows`);
    expect(sts).toContain(`${calc.backNeckOpeningRows} rows`);
    expect(sts).toContain(`${calc.garmentLengthStitches} sts`);
    expect(sts).toContain(`${calc.vNeckDepthStitches} sts`);
    expect(sts).toContain(`${calc.armholeDepthStitches} sts`);
    expect(sts).toContain(`${calc.backNeckDepthStitches} sts`);
    expect(calc.frontRows).toBe(
      instructions.sectionRowCounts.firstVNeck + instructions.sectionRowCounts.firstFrontShoulder,
    );
    expect(calc.backRows).toBe(
      instructions.sectionRowCounts.firstBackShoulder +
        instructions.sectionRowCounts.backNeckOpening +
        instructions.sectionRowCounts.secondBackShoulder,
    );

    const fronts = byRole(sts, "front-rows").sort((a, b) => b.y - a.y);
    const back = byRole(sts, "back-rows")[0];
    expect(fronts).toHaveLength(2);
    expect(fronts[0]!.text).toContain("Front");
    expect(fronts[0]!.text).toContain(`${calc.frontRows} rows`);
    expect(back?.text).toContain(`${calc.backRows} rows`);
    expect(sectionMidY(sts, "first")).toBeGreaterThan(sectionMidY(sts, "second"));
    if (style === "cardigan") {
      expect(fronts[0]!.y).toBeGreaterThan(back!.y);
      expect(back!.y).toBeGreaterThan(fronts[1]!.y);
      const hold = byRole(shaping, "jp-hold")[0];
      const castOn = byRole(shaping, "jp-caston")[0];
      expect(hold?.text).toBe(formatHoldNotation(calc.vNeckDepthStitches));
      expect(castOn!.y).toBeGreaterThan(hold!.y);
      expect(instructions.steps.find((step) => step.id === "hold-neckline")?.summary).toContain(
        `${calc.vNeckDepthStitches} neckline stitches`,
      );
    } else {
      expect(fronts[0]!.y).toBeGreaterThan(fronts[1]!.y);
      expect(fronts[1]!.y).toBeGreaterThan(back!.y);
      expect(shaping).not.toContain('data-role="jp-hold"');
    }
  });

  it("stays usable in the normal tab, the enlarged view, and print", () => {
    const shell = buildSidewaysCardiganPatternDiagramTabsShellHtml();
    const printCss = readFileSync(join(srcRoot, "styles/patterns/sleeveless-pattern-shared.css"), "utf8");
    const page = readFileSync(join(srcRoot, "pages/patterns/sideways-cardigan/pattern/index.astro"), "utf8");
    for (const svg of [sts, shaping]) {
      expect(svg).toContain(`class="express-mbp-art ${SLEEVELESS_DIAGRAM_INLINE_CLASS}"`);
      expect(svg).toContain('width="100%"');
      expect(svg).toContain('preserveAspectRatio="xMidYMid meet"');
      expect(svg).not.toMatch(/<svg\b[^>]*\stransform=/);
      const box = viewBoxOf(svg);
      expect(box.width).toBe(canvas.width);
      expect(box.y).toBeLessThan(0);
      const labels = diagramTexts(svg);
      for (const label of labels) {
        expect(label.y).toBeGreaterThan(box.y);
        expect(label.y).toBeLessThan(box.y + box.height);
      }
      const flipAt = svg.indexOf('data-knit-flip="vertical"');
      const flipEnd = svg.indexOf("</g>", flipAt);
      expect(svg.slice(flipAt, flipEnd)).not.toContain("<text");
    }
    expect(viewBoxOf(sts)).toEqual(viewBoxOf(shaping));
    for (const svg of [sts, shaping]) {
      const box = viewBoxOf(svg);
      const labels = labelLineBoxes(svg);
      for (const label of labels) {
        expect(label.left).toBeGreaterThanOrEqual(box.x - 1);
        expect(label.right).toBeLessThanOrEqual(box.x + box.width + 1);
      }
      for (let i = 0; i < labels.length; i += 1) {
        for (let j = i + 1; j < labels.length; j += 1) {
          const a = labels[i]!;
          const b = labels[j]!;
          const hits =
            a.left < b.right - 2 && a.right > b.left + 2 && a.top < b.bottom - 2 && a.bottom > b.top + 2;
          expect(hits, `${a.role} "${a.text}" overlaps ${b.role} "${b.text}"`).toBe(false);
        }
      }
    }
    expect(shell).toContain("data-sleeveless-diagram-enlarge");
    expect(shell).toContain("sideways-pattern-diagram-print-heading");
    expect(printCss).toContain(`.${SLEEVELESS_DIAGRAM_INLINE_CLASS}`);
    expect(printCss).toContain("max-width: 2.6in");
    expect(printCss).toContain("overflow: visible");
    expect(page).toContain("pattern-diagram-tabs.css");
    expect(page).toContain(".sideways-pattern-diagram-print-heading");
  });
});

describe("Sideways pullover sleeve notation follows the flipped sleeve", () => {
  it("keeps the sleeve shaping sign and parks it on the mirrored sleeve", () => {
    const instructions = instructionsFor("pullover");
    const model = modelFor("pullover", instructions);
    const frame = buildSidewaysCardiganPatternDiagramFrame(model);
    const canvas = sidewaysPatternDiagramCanvas(frame);
    const shaping = buildSidewaysCardiganShapingNotationDiagramSvg(model);
    const sleeve = byRole(shaping, "jp-sleeve")[0];
    expect(model.sleeveCalc).not.toBeNull();
    const sign = model.sleeveCalc!.shapingPlan.shapingDirection === "decrease" ? "-" : "+";
    expect(byRole(shaping, "jp-sleeve").some((item) => item.text.startsWith(sign))).toBe(true);
    expect(sleeve?.text).toMatch(/^\d+r$/);
    expect(sleeve!.x).toBeGreaterThan(frame.neckX);
    expect(sleeve!.y).toBeCloseTo(
      sidewaysKnitVisualY(frame, frame.sleeve.attachY),
      1,
    );
  });
});
