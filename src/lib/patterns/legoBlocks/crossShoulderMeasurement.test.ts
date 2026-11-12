import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import plusSizes from "../../../../public/data/sizing_sweaters_plus.json";
import { generateDropShoulderPattern } from "../dropShoulderPatternOutput";
import {
  tryBuildLiveDropShoulderBackStsRowsDiagramSvg,
} from "../dropShoulderBackPatternDiagramSvg";
import {
  tryBuildLiveDropShoulderFrontStsRowsDiagramSvg,
} from "../dropShoulderFrontPatternDiagramSvg";
import { tryBuildLiveDropShoulderSleeveStsRowsDiagramSvg } from "../dropShoulderSleevePatternDiagramSvg";
import { formatPatternDiagramMeasurement } from "../patternStitchesRowsDiagramLabel";
import { computeDefaultMeasurementsFromChartRow } from "../sleevelessExpressSizeChartClient";
import type { ChartRow } from "../sleevelessExpressSizeChartTypes";
import { generateSleevelessBackPattern } from "../sleevelessPatternOutput";
import { tryBuildLiveSleevelessBackNotationSvg } from "../sleevelessBackShapingNotationDiagramSvg";
import { tryBuildLiveSleevelessBackStsRowsDiagramSvg } from "../sleevelessBackStsRowsDiagramSvg";
import { tryBuildLiveSleevelessFrontStsRowsDiagramSvg } from "../sleevelessFrontStsRowsDiagramSvg";
import { withSetInSleeveConstructionAuthored } from "../setInSleeveConstructionIdentity";
import { generateSetInSleevePattern } from "../setInSleevePatternOutput";
import { tryBuildSetInSleeveStitchesRowsSvg } from "../setInSleeve/setInSleeveDiagram";
import {
  formatKnittedShoulderMeasurement,
  placeCrossShoulderAboveNeck,
  placeSplitShoulderLabels,
  shoulderSpanCaption,
  sweaterCrossShoulderSpans,
} from "./crossShoulderMeasurement";

const MISSES_4: ChartRow = {
  bust_or_chest: 35,
  waist: 26,
  hip: 37,
  garment_back_length: 23,
  armhole_depth: 7.5,
  shoulder_width: 13,
  neck_opening: 7,
  front_neck_depth: 5,
  back_neck_depth: 1,
  upper_arm: 10.5,
  wrist: 5.5,
  sleeve_length: 16.75,
};

const WOMENS_6X = (plusSizes as ChartRow[]).find((row) => String(row.size).toLowerCase() === "6x");

type DrawnLabel = {
  measure: string;
  x: number;
  y: number;
  size: number;
  lines: number;
  text: string;
  middle: boolean;
};

function drawnLabels(svg: string): DrawnLabel[] {
  const found: DrawnLabel[] = [];
  for (const match of svg.matchAll(/<text\b([^>]*)>([\s\S]*?)<\/text>/g)) {
    const attrs = match[1] ?? "";
    const measure = /data-measure="([^"]+)"/.exec(attrs)?.[1];
    if (!measure) continue;
    const x = Number(/(?:^|\s)x="([^"]+)"/.exec(attrs)?.[1]);
    const y = Number(/(?:^|\s)y="([^"]+)"/.exec(attrs)?.[1]);
    const size = Number(/font-size="([^"]+)"/.exec(attrs)?.[1] ?? "16");
    const text = (match[2] ?? "").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
    const lines = Math.max(1, (match[2] ?? "").match(/<tspan\b/g)?.length ?? 1);
    const middle = /dominant-baseline="middle"/.test(attrs);
    found.push({ measure, x, y, size, lines, text, middle });
  }
  return found;
}

function labelBox(label: DrawnLabel) {
  const width = Math.max(label.size, label.text.length * label.size * 0.54);
  const height = label.size + (label.lines - 1) * (label.size + 2);
  const top = label.middle ? label.y - height / 2 : label.y - label.size * 0.8;
  return {
    left: label.x - width / 2,
    right: label.x + width / 2,
    top,
    bottom: top + height,
  };
}

function boxesOverlap(
  a: ReturnType<typeof labelBox>,
  b: ReturnType<typeof labelBox>,
  gap = 3,
): boolean {
  return a.left < b.right + gap && b.left < a.right + gap && a.top < b.bottom + gap && b.top < a.bottom + gap;
}

function expectHalfArrowOnly(svg: string) {
  const full = svg.match(/<text\b[^>]*data-measure="cross-shoulder"[^>]*>[\s\S]*?<\/text>/)?.[0] ?? "";
  expect(full).toContain("Full cross shoulder");
  expect(full).not.toContain("<line");
  expect(full).not.toContain("<polygon");
  const half = svg.match(/<g data-role="width-measurement" data-measure="half-piece">[\s\S]*?<\/g>/)?.[0] ?? "";
  expect(half).toContain("<line ");
  expect(half).toContain("<polygon ");
  expect(half).toContain("Half piece");
  const lineY = Number(/<line\b[^>]*\by1="([^"]+)"/.exec(half)?.[1]);
  const textY = Number(/<text\b[^>]*\by="([^"]+)"/.exec(half)?.[1]);
  expect(textY).toBeLessThan(lineY);
  expect(lineY - textY).toBeLessThanOrEqual(12);
}

function expectLabelsClear(svg: string, measures: string[]) {
  const labels = drawnLabels(svg).filter((label) => measures.includes(label.measure));
  for (let i = 0; i < labels.length; i += 1) {
    for (let j = i + 1; j < labels.length; j += 1) {
      const a = labels[i]!;
      const b = labels[j]!;
      expect(
        boxesOverlap(labelBox(a), labelBox(b)),
        `${a.measure} "${a.text}" @ ${a.y} overlaps ${b.measure} "${b.text}" @ ${b.y}`,
      ).toBe(false);
    }
  }
}

function setInPattern(row: ChartRow, fit: string, stitchesPerInch: number, availableNeedles: number) {
  const measurements = computeDefaultMeasurementsFromChartRow(row, fit, { bodyShape: "straight" });
  return {
    fit: {
      sizingChart: fit === "relaxed" && row === WOMENS_6X ? "plus" : "misses",
      easeChoice: fit,
      selectedMeasurements: measurements,
    },
    style: withSetInSleeveConstructionAuthored(
      {
        recipientCategory: "misses",
        garmentStyle: "pullover",
        neckline: "round",
        bodyShape: "straight",
      },
      "long",
    ),
    yarnGaugeMachine: {
      gaugeStitchesPerInch: stitchesPerInch,
      gaugeRowsPerInch: 7,
      availableNeedles,
    },
  };
}

describe("cross shoulder measurement", () => {
  it("uses the rounded stitch count divided by gauge", () => {
    const spans = sweaterCrossShoulderSpans({
      stitchesPerInch: 5,
      spansBothShoulders: true,
      fullShoulderStitches: 66,
    });
    expect(spans.crossShoulder).toEqual({ name: "Cross shoulder", stitches: 66, inches: 13.2 });
    expect(shoulderSpanCaption(spans.crossShoulder!, "in")).toBe("Cross shoulder 13.2 in");
    expect(shoulderSpanCaption(spans.crossShoulder!, "cm")).toBe("Cross shoulder 33.5 cm");
    expect(formatKnittedShoulderMeasurement(13.2, "in")).not.toBe(
      formatPatternDiagramMeasurement(13, "in"),
    );
  });

  it("keeps a split half separate from the full cross shoulder and skips pieces without that span", () => {
    const split = sweaterCrossShoulderSpans({
      stitchesPerInch: 7,
      spansBothShoulders: false,
      splitHalf: true,
      fullShoulderStitches: 134,
      halfPieceStitches: 68,
    });
    expect(split.crossShoulder?.name).toBe("Full cross shoulder");
    expect(shoulderSpanCaption(split.crossShoulder!, "in")).toBe("Full cross shoulder 19.1 in");
    expect(split.crossShoulder?.inches).toBeCloseTo(134 / 7, 5);
    expect(split.halfPiece?.inches).toBeCloseTo(68 / 7, 5);
    expect(split.halfPiece?.name).toBe("Half piece");
    expect(
      sweaterCrossShoulderSpans({ stitchesPerInch: 5, spansBothShoulders: false, fullShoulderStitches: 80 }),
    ).toEqual({ crossShoulder: null, halfPiece: null });
    expect(placeCrossShoulderAboveNeck({ neckLabelY: 50, neckArrowY: 70, shoulderLabelY: 120 }).captionY).toBeLessThan(
      50,
    );
    const splitPlace = placeSplitShoulderLabels({ neckLabelY: 50, neckArrowY: 80, shoulderLabelY: 130 });
    expect(splitPlace.captionY).toBeLessThan(splitPlace.halfCaptionY);
    expect(splitPlace.halfCaptionY).toBeLessThan(splitPlace.halfLineY);
    expect(splitPlace.halfLineY - splitPlace.halfCaptionY).toBeLessThanOrEqual(12);
  });
});

describe("sweater Stitches & Rows cross shoulder", () => {
  it("labels a regular Misses Set-In Sleeve from the generated shoulder stitches", () => {
    const pattern = setInPattern(MISSES_4, "standard", 5, 200);
    const result = generateSetInSleevePattern(pattern);
    expect(result.centerSeams?.applied).not.toBe(true);
    const back = tryBuildLiveSleevelessBackStsRowsDiagramSvg(result, pattern, "in");
    const front = tryBuildLiveSleevelessFrontStsRowsDiagramSvg(result, pattern, "in");
    expect(back).toBeTruthy();
    expect(front).toBeTruthy();
    const stitches = result.debug.stitchesAfterArmhole ?? 0;
    const caption = `Cross shoulder ${formatKnittedShoulderMeasurement(stitches / result.debug.stitchesPerInch, "in")}`;
    expect(back).toContain(caption);
    expect(front).toContain(caption);
    expect(back).toContain('data-span="full"');
    expect(caption).not.toBe(`Cross shoulder ${formatPatternDiagramMeasurement(13, "in")}`);
    expect(back).toContain(`${result.debug.shoulderStitches} sts`);
    expect(front).toContain(`${result.debug.shoulderStitches} sts`);
    expectLabelsClear(back!, ["cross-shoulder", "neck", "shoulder"]);
    expectLabelsClear(front!, ["cross-shoulder", "neck", "shoulder"]);
    expect(tryBuildLiveSleevelessBackNotationSvg(result, pattern)).not.toContain("Cross shoulder");
    const sleeve = tryBuildSetInSleeveStitchesRowsSvg({
      sleevePiece: result.sleevePiece,
      sleeveCap: result.sleeveCap,
      unit: "in",
      ...result.sleeveFinishedInches,
    });
    expect(sleeve).toBeTruthy();
    expect(sleeve).not.toContain("Cross shoulder");
    const centimeters = tryBuildLiveSleevelessBackStsRowsDiagramSvg(result, pattern, "cm");
    expect(centimeters).toContain(
      `Cross shoulder ${formatKnittedShoulderMeasurement(stitches / result.debug.stitchesPerInch, "cm")}`,
    );
  });

  it("distinguishes the largest Women's relaxed split back from the half on the needles", () => {
    expect(WOMENS_6X).toBeTruthy();
    const saved = setInPattern(WOMENS_6X!, "relaxed", 7, 200);
    saved.fit.sizingChart = "plus";
    const plain = generateSetInSleevePattern(saved);
    expect(plain.needleCapacity?.fitsAsWritten).toBe(false);
    const seamed = generateSetInSleevePattern({
      ...saved,
      style: { ...(saved.style as object), centerSeams: true },
    });
    expect(seamed.centerSeams?.applied).toBe(true);
    expect(seamed.centerSeams?.splitBack).toBe(true);
    const fullStitches = plain.debug.stitchesAfterArmhole ?? 0;
    const left = seamed.centerSeamPieces!.leftBack;
    const right = seamed.centerSeamPieces!.rightBack;
    const leftHalf = left.debug.cardiganHalfLeftStitchesAfterArmhole ?? 0;
    const rightHalf = right.debug.cardiganHalfLeftStitchesAfterArmhole ?? 0;
    expect(leftHalf + rightHalf - 2).toBe(fullStitches);
    const svg = tryBuildLiveSleevelessFrontStsRowsDiagramSvg(left, seamed.centerSeamPieces!.backPatternData, "in", {
      pieceLabel: "LEFT BACK",
      centerEdge: "right",
    });
    expect(svg).toBeTruthy();
    const fullCaption = `Full cross shoulder ${formatKnittedShoulderMeasurement(fullStitches / left.debug.stitchesPerInch, "in")}`;
    const halfCaption = `Half piece ${formatKnittedShoulderMeasurement(leftHalf / left.debug.stitchesPerInch, "in")}`;
    expect(svg).toContain(fullCaption);
    expect(svg).toContain(halfCaption);
    expect(svg).not.toContain(">Cross shoulder ");
    expectHalfArrowOnly(svg!);
    expect(fullCaption).not.toBe(halfCaption);
    expect(svg).not.toContain(`Full cross shoulder ${formatPatternDiagramMeasurement(Number(WOMENS_6X!.shoulder_width), "in")}`);
    expect(svg).toContain("LEFT BACK");
    expectLabelsClear(svg!, ["cross-shoulder", "half-piece", "neck", "shoulder"]);
    const rightSvg = tryBuildLiveSleevelessFrontStsRowsDiagramSvg(
      right,
      seamed.centerSeamPieces!.backPatternData,
      "in",
      { pieceLabel: "RIGHT BACK", centerEdge: "left" },
    );
    expect(rightSvg).toContain(fullCaption);
    expect(rightSvg).toContain(
      `Half piece ${formatKnittedShoulderMeasurement(rightHalf / right.debug.stitchesPerInch, "in")}`,
    );
    expect(rightSvg).not.toContain(">Cross shoulder ");
    expectHalfArrowOnly(rightSvg!);
  });

  it("uses the same label on the other sweater bodies that span both shoulders", () => {
    const sleeveless = {
      fit: {
        sizingChart: "misses",
        selectedMeasurements: {
          finished_bust_chest: 40,
          back_neck_to_hem: 22,
          armhole_depth: 8,
          neck_opening: 6,
          shoulder_width: 12,
          front_neck_depth: 3,
          back_neck_depth: 1,
        },
      },
      style: { garmentStyle: "pullover", neckline: "round", frontStyle: "closed", recipientCategory: "misses" },
      yarnGaugeMachine: { gaugeStitchesPerInch: 5, gaugeRowsPerInch: 7, availableNeedles: 200 },
    };
    const sleevelessResult = generateSleevelessBackPattern(sleeveless);
    const sleevelessSvg = tryBuildLiveSleevelessBackStsRowsDiagramSvg(sleevelessResult, sleeveless, "in");
    const sleevelessStitches = sleevelessResult.debug.stitchesAfterArmhole ?? 0;
    expect(sleevelessSvg).toContain(
      `Cross shoulder ${formatKnittedShoulderMeasurement(sleevelessStitches / 5, "in")}`,
    );
    expectLabelsClear(sleevelessSvg!, ["cross-shoulder", "neck", "shoulder"]);

    const cardigan = {
      ...sleeveless,
      style: { ...sleeveless.style, garmentStyle: "cardigan", frontStyle: "open" },
    };
    const cardiganResult = generateSleevelessBackPattern(cardigan);
    const cardiganBack = tryBuildLiveSleevelessBackStsRowsDiagramSvg(cardiganResult, cardigan, "in");
    const cardiganFront = tryBuildLiveSleevelessFrontStsRowsDiagramSvg(cardiganResult, cardigan, "in");
    expect(cardiganBack).toContain("Cross shoulder");
    expect(cardiganFront).toBeTruthy();
    expect(cardiganFront).not.toContain("Cross shoulder");
    expect(cardiganFront).not.toContain("Half piece");

    const dropShoulder = {
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
      yarnGaugeMachine: { gaugeStitchesPerInch: 5, gaugeRowsPerInch: 7, availableNeedles: 200 },
      style: { construction: "drop-shoulder", frontStyle: "closed", neckline: "round" },
    };
    const dropResult = generateDropShoulderPattern(dropShoulder);
    const dropBack = tryBuildLiveDropShoulderBackStsRowsDiagramSvg(dropResult, dropShoulder, "in");
    const dropFront = tryBuildLiveDropShoulderFrontStsRowsDiagramSvg(dropResult, dropShoulder, "in");
    const dropStitches = dropResult.debug.stitchesAfterArmhole ?? dropResult.debug.backStitches ?? 0;
    const dropCaption = `Cross shoulder ${formatKnittedShoulderMeasurement(dropStitches / dropResult.debug.stitchesPerInch, "in")}`;
    expect(dropBack).toContain(dropCaption);
    expect(dropFront).toContain(dropCaption);
    expect(dropCaption).not.toContain(formatPatternDiagramMeasurement(16, "in"));
    expect(dropBack).toContain(`${dropResult.debug.shoulderStitches} sts`);
    expectLabelsClear(dropBack!, ["cross-shoulder", "neck", "shoulder"]);
    expectLabelsClear(dropFront!, ["cross-shoulder", "neck", "shoulder"]);
    const dropSleeve = tryBuildLiveDropShoulderSleeveStsRowsDiagramSvg(dropResult, "cuff-up", "in");
    expect(dropSleeve).not.toContain("Cross shoulder");

    const dropCardigan = {
      ...dropShoulder,
      style: { ...dropShoulder.style, garmentStyle: "cardigan", frontStyle: "open" },
    };
    const dropCardiganResult = generateDropShoulderPattern(dropCardigan);
    const dropCardiganFront = tryBuildLiveDropShoulderFrontStsRowsDiagramSvg(
      dropCardiganResult,
      dropCardigan,
      "in",
    );
    expect(dropCardiganFront).toBeTruthy();
    expect(dropCardiganFront).not.toContain("Cross shoulder");

    for (const file of [
      "src/lib/patterns/sidewaysCardiganPatternDiagramSvg.ts",
      "src/lib/patterns/setInSleeve/setInSleeveDiagram.ts",
      "src/lib/patterns/hat/hatPatternDiagramSvg.ts",
      "src/lib/patterns/sock/sockPatternDiagramSvg.ts",
    ]) {
      expect(readFileSync(file, "utf8")).not.toContain("Cross shoulder");
    }
  });
});
