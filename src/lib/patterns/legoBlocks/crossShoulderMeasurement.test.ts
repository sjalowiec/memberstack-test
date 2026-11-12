import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { generateDropShoulderPattern } from "../dropShoulderPatternOutput";
import {
  tryBuildLiveDropShoulderBackStsRowsDiagramSvg,
} from "../dropShoulderBackPatternDiagramSvg";
import {
  tryBuildLiveDropShoulderFrontStsRowsDiagramSvg,
} from "../dropShoulderFrontPatternDiagramSvg";
import { tryBuildLiveDropShoulderSleeveStsRowsDiagramSvg } from "../dropShoulderSleevePatternDiagramSvg";
import { formatPatternDiagramMeasurement } from "../patternStitchesRowsDiagramLabel";
import { generateSleevelessBackPattern } from "../sleevelessPatternOutput";
import { tryBuildLiveSleevelessBackStsRowsDiagramSvg } from "../sleevelessBackStsRowsDiagramSvg";
import { tryBuildLiveSleevelessFrontStsRowsDiagramSvg } from "../sleevelessFrontStsRowsDiagramSvg";
import {
  formatKnittedShoulderMeasurement,
  placeCrossShoulderAboveNeck,
  placeSplitShoulderLabels,
  shoulderSpanCaption,
  sweaterCrossShoulderSpans,
} from "./crossShoulderMeasurement";

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
      "src/lib/patterns/hat/hatPatternDiagramSvg.ts",
      "src/lib/patterns/sock/sockPatternDiagramSvg.ts",
    ]) {
      expect(readFileSync(file, "utf8")).not.toContain("Cross shoulder");
    }
  });
});
