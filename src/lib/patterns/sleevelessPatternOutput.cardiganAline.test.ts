import { describe, expect, it } from "vitest";
import { resolveCardiganHalfFrontWidths } from "./cardiganFrontBlock";
import { buildBodyShapeGuideSvgFragment } from "./sleevelessBodyShapeDiagramGuides";
import { resolveSleevelessFrontDiagram } from "./sleevelessFrontDiagramSrc";
import { buildSleevelessGarmentDiagramReplacements } from "./sleevelessGarmentDiagramReplacements";
import { generateSleevelessBackPattern } from "./sleevelessPatternOutput";
import type { SleevelessPatternDisplayRow } from "./sleevelessPatternOutput";

function baseMeasurements() {
  return {
    finished_bust_chest: 40,
    finished_hip: 48,
    back_neck_to_hem: 22,
    armhole_depth: 8,
    neck_opening: 3,
    shoulder_width: 4.25,
    front_neck_depth: 3,
    back_neck_depth: 1,
  };
}

function gauge() {
  return {
    gaugeStitchesPerInch: 7,
    gaugeRowsPerInch: 7,
    availableNeedles: 200,
  };
}

function extractCastOnFromRows(rows: readonly SleevelessPatternDisplayRow[]): number | undefined {
  for (const row of rows) {
    if (row.kind !== "block" || !row.paragraphs) continue;
    for (const p of row.paragraphs) {
      const m = p.match(/Cast on (\d+) stitches/i);
      if (m) return Number(m[1]);
    }
  }
  return undefined;
}

function frontBodyParagraphs(rows: readonly SleevelessPatternDisplayRow[]): string[] {
  let inBody = false;
  const out: string[] = [];
  for (const row of rows) {
    if (row.kind === "section" && row.title === "BODY") inBody = true;
    else if (row.kind === "section") inBody = false;
    else if (inBody && row.kind === "block") {
      out.push(...(row.paragraphs ?? []), ...(row.trustedParagraphs ?? []));
    }
  }
  return out;
}

function backBodyShapingRows(rows: readonly SleevelessPatternDisplayRow[]): string {
  return frontBodyParagraphs(rows)
    .filter((p) => /Work (decreases|increases) on:/i.test(p))
    .join(" ");
}

describe("A-line round cardigan front", () => {
  const patternData = {
    fit: { selectedMeasurements: baseMeasurements() },
    style: { neckline: "round", frontStyle: "open", bodyShape: "aline" },
    yarnGaugeMachine: gauge(),
  } as Record<string, unknown>;

  const result = generateSleevelessBackPattern(patternData);

  it("casts on half of back hem width on the left front", () => {
    const backCastOn = extractCastOnFromRows(result.displayRows);
    const frontCastOn = extractCastOnFromRows(result.frontDisplayRows);
    expect(backCastOn).toBe(result.debug.hemCastOnStitches);
    expect(backCastOn).toBeGreaterThan(result.debug.bustBodyStitches!);
    expect(frontCastOn).toBe(result.debug.cardiganHalfLeftCastOnSts);
    expect(frontCastOn).toBe(Math.ceil((backCastOn ?? 0) / 2));
  });

  it("diagram hem and bust labels use half-panel stitches, not full back", () => {
    const repl = buildSleevelessGarmentDiagramReplacements(result, "in", {
      patternData,
      measurementPiece: "front",
      cardiganHalfSide: "left",
    });
    expect(repl.HIP_STS).toBe(String(result.debug.cardiganHalfLeftCastOnSts));
    expect(repl.BUST_STS).toBe(String(result.debug.cardiganHalfLeftBustBodySts));
    expect(Number(repl.HIP_STS)).toBeLessThan(result.debug.hemCastOnStitches!);
    expect(Number(repl.BUST_STS)).toBeLessThan(result.debug.bustBodyStitches!);
    expect(Number(repl.SHOULDER_STS)).toBe(result.debug.shoulderStitches);
    expect(repl.HIP_INCHES).toBe("12");
  });

  it("never exposes full back hem or bust stitch counts on the left front", () => {
    const fullHem = result.debug.hemCastOnStitches!;
    const fullBust = result.debug.bustBodyStitches!;
    const leftHem = result.debug.cardiganHalfLeftCastOnSts!;
    const leftBust = result.debug.cardiganHalfLeftBustBodySts!;
    const leftShoulder = result.debug.cardiganHalfLeftStitchesAfterArmhole!;

    expect(leftHem).toBeLessThan(fullHem);
    expect(leftBust).toBeLessThan(fullBust);
    expect(leftShoulder).toBeLessThan(result.debug.stitchesAfterArmhole!);
    expect(leftHem + (fullHem - leftHem)).toBe(fullHem);
    expect(leftBust + (fullBust - leftBust)).toBe(fullBust);
  });

  it("matches 140 hem / 112 bust example (70 / 56 per left front)", () => {
    const left = resolveCardiganHalfFrontWidths(
      { hemCastOnSts: 140, bustBodySts: 112, stitchesAfterArmhole: 60 },
      "left",
    );
    expect(left.hemCastOnSts).toBe(70);
    expect(left.bustBodySts).toBe(56);
  });

  it("shapes only at the armhole edge on the front, not each side edge", () => {
    const frontBody = frontBodyParagraphs(result.frontDisplayRows).join(" ");
    expect(frontBody).toMatch(/at the armhole edge/i);
    expect(frontBody).not.toMatch(/at each side edge/i);
  });

  it("aligns front shaping row list with the back", () => {
    const backRows = backBodyShapingRows(result.displayRows);
    const frontRows = backBodyShapingRows(result.frontDisplayRows);
    expect(backRows.length).toBeGreaterThan(0);
    expect(frontRows).toBe(backRows);
  });

  it("uses dedicated cardigan A-line SVG instead of dotted guide overlay", () => {
    expect(result.debug.diagramGuides?.showBodyShapeGuides).toBe(false);
    expect(buildBodyShapeGuideSvgFragment(result.debug.diagramGuides, "cardiganHalfLeft")).toBe("");
    const frontDiagram = resolveSleevelessFrontDiagram(patternData, { devForceCardiganHalfLeft: false });
    expect(frontDiagram.src).toContain("-aline.svg");
  });
});
