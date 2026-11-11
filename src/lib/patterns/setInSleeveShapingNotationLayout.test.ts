import { describe, expect, it } from "vitest";
import { computeDefaultMeasurementsFromChartRow } from "./sleevelessExpressSizeChartClient";
import { tryBuildLiveSleevelessBackNotationSvg } from "./sleevelessBackShapingNotationDiagramSvg";
import { tryBuildLiveSleevelessFrontCardiganRoundNotationSvg } from "./sleevelessFrontCardiganRoundShapingNotationDiagramSvg";
import { tryBuildLiveSleevelessFrontCardiganVNeckNotationSvg } from "./sleevelessFrontCardiganVNeckShapingNotationDiagramSvg";
import { tryBuildLiveSleevelessFrontRoundNotationSvg } from "./sleevelessFrontRoundShapingNotationDiagramSvg";
import { tryBuildLiveSleevelessFrontVNeckNotationSvg } from "./sleevelessFrontVNeckShapingNotationDiagramSvg";
import { generateSetInSleevePattern } from "./setInSleevePatternOutput";
import { withSetInSleeveConstructionAuthored } from "./setInSleeveConstructionIdentity";
import { notationBoxesOverlap, notationLabelBox, type NotationAnchor } from "./shapingNotationCrowdLayout";

const MISSES_7 = {
  bust_or_chest: 40,
  waist: 32,
  hip: 42,
  garment_back_length: 24.5,
  armhole_depth: 7.75,
  shoulder_width: 13.75,
  neck_opening: 7.5,
  front_neck_depth: 5,
  back_neck_depth: 1,
  upper_arm: 12,
  wrist: 6,
  sleeve_length: 17,
};

function pattern(options: {
  bodyShape?: "straight" | "aline";
  neckline?: "round" | "v-neck";
  stitchesPerInch?: number;
  rowsPerInch?: number;
  availableNeedles?: number;
  hip?: string;
  centerSeams?: boolean;
}) {
  const measurements = computeDefaultMeasurementsFromChartRow(MISSES_7, "standard", {
    bodyShape: options.bodyShape ?? "straight",
  });
  const fit: Record<string, unknown> = {
    sizingChart: "misses",
    easeChoice: "standard",
    selectedMeasurements: measurements,
  };
  if (options.hip) fit.cbMeasurementOverrides = { hip: options.hip };
  return {
    fit,
    style: withSetInSleeveConstructionAuthored(
      {
        recipientCategory: "misses",
        garmentStyle: "pullover",
        neckline: options.neckline ?? "round",
        bodyShape: options.bodyShape ?? "straight",
        ...(options.centerSeams ? { centerSeams: true } : {}),
      },
      "long",
    ),
    yarnGaugeMachine: {
      gaugeStitchesPerInch: options.stitchesPerInch ?? 5,
      gaugeRowsPerInch: options.rowsPerInch ?? 7,
      availableNeedles: options.availableNeedles ?? 200,
    },
  };
}

const NOTATION_ROLES = [
  "armhole-bo",
  "armhole-shaping",
  "neck-shaping",
  "neck-bo",
  "shoulder-shaping",
  "body-shaping",
  "rc-caston",
  "rc-hem",
  "armhole-start-rc",
  "rc-reset",
  "neck-start-rc",
  "shoulder-start-rc",
  "cast-on",
];

function labelBoxes(svg: string) {
  const boxes = [];
  const re = /<text\b([^>]*)>([^<]*)<\/text>/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(svg))) {
    const attrs = match[1] ?? "";
    const text = match[2] ?? "";
    const role = attrs.match(/data-role="([^"]+)"/)?.[1] ?? "";
    if (!NOTATION_ROLES.includes(role)) continue;
    const x = Number(attrs.match(/\bx="([^"]+)"/)?.[1] ?? "0");
    const y = Number(attrs.match(/\by="([^"]+)"/)?.[1] ?? "0");
    const anchor = (attrs.match(/text-anchor="([^"]+)"/)?.[1] ?? "start") as NotationAnchor;
    const font = Number(attrs.match(/font-size="([^"]+)"/)?.[1] ?? "17");
    boxes.push({ role, text, box: notationLabelBox(x, y, text, font, anchor) });
  }
  return boxes;
}

function expectReadable(svg: string | null, label: string) {
  expect(svg, label).toBeTruthy();
  const boxes = labelBoxes(svg!);
  expect(boxes.length, label).toBeGreaterThan(0);
  for (let i = 0; i < boxes.length; i += 1) {
    for (let j = i + 1; j < boxes.length; j += 1) {
      const a = boxes[i]!;
      const b = boxes[j]!;
      expect(
        notationBoxesOverlap(a.box, b.box, 2),
        `${label}: ${a.role} "${a.text}" overlaps ${b.role} "${b.text}"`,
      ).toBe(false);
    }
  }
  expect(svg).toContain('data-supported="true"');
}

describe("set-in sleeve shaping notation label clearance", () => {
  it("keeps regular front and back notation readable", () => {
    const data = pattern({});
    const result = generateSetInSleevePattern(data);
    expectReadable(tryBuildLiveSleevelessFrontRoundNotationSvg(result, data), "front");
    expectReadable(tryBuildLiveSleevelessBackNotationSvg(result, data), "back");
    expect(tryBuildLiveSleevelessFrontRoundNotationSvg(result, data)).toContain(
      'data-role="armhole-label-leader"',
    );
  });

  it("keeps a regular V-neck front readable", () => {
    const data = pattern({ neckline: "v-neck" });
    const result = generateSetInSleevePattern(data);
    expectReadable(tryBuildLiveSleevelessFrontVNeckNotationSvg(result, data), "v-front");
    expectReadable(tryBuildLiveSleevelessBackNotationSvg(result, data), "v-back");
  });

  it("keeps the 89-stitch center-seam halves readable", () => {
    const data = pattern({
      bodyShape: "aline",
      neckline: "v-neck",
      stitchesPerInch: 7,
      rowsPerInch: 11,
      availableNeedles: 150,
      hip: "50",
      centerSeams: true,
    });
    const result = generateSetInSleevePattern(data);
    expect(result.centerSeams?.backHem).toBe(89);
    const pieces = result.centerSeamPieces!;
    const back = tryBuildLiveSleevelessFrontCardiganRoundNotationSvg(pieces.leftBack, pieces.backPatternData);
    const front = tryBuildLiveSleevelessFrontCardiganVNeckNotationSvg(
      pieces.rightFront!,
      pieces.frontPatternData,
    );
    expect(back).toContain('data-hem-sts="89"');
    expect(front).toContain('data-hem-sts="89"');
    expectReadable(back, "89 back");
    expectReadable(front, "89 front");
    expect(back).toContain('data-role="armhole-label-leader"');
    expect(front).toContain('data-role="armhole-label-leader"');
    expect(back).toContain('data-shoulder-shaping="');
    expect(front).toContain('data-neck-shaping="');
  });
});
