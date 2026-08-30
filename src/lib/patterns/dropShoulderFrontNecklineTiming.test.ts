import { describe, expect, it } from "vitest";
import { evenShapingGarmentRowNumbers, evenShapingSchedule } from "./evenShapingSchedule";
import { neckDecreaseStitchesPerSideFromOpening } from "./legoBlocks/vNeckline";
import {
  generateDropShoulderPattern,
  dropShoulderFrontNecklineStartRc,
} from "./dropShoulderPatternOutput";
import { generateSleevelessBackPattern } from "./sleevelessPatternOutput";
import { buildDropShoulderFrontStitchesRowsModel } from "./dropShoulderPatternDiagramModel";
import { tryBuildLiveDropShoulderFrontStsRowsDiagramSvg } from "./dropShoulderFrontPatternDiagramSvg";
import { tryBuildLiveDropShoulderFrontNotationSvg } from "./dropShoulderFrontShapingNotationDiagramSvg";
import { tryBuildLiveDropShoulderBackStsRowsDiagramSvg } from "./dropShoulderBackPatternDiagramSvg";
import { kids10YrRelaxedArmhole36Pattern } from "./dropShoulderDiagramReviewFixtures";
import type { SleevelessPatternDisplayRow } from "./sleevelessPatternOutput";

/** 6 rpi, 24″ length, 13.4″ upper arm → 40-row / 6.7″ armhole. */
function timingPattern(
  frontNeckDepth: number,
  extras: {
    neckline?: string;
    frontStyle?: string;
    garmentStyle?: string;
  } = {},
): Record<string, unknown> {
  return {
    fit: {
      sizingChart: "women",
      selectedMeasurements: {
        finished_bust_chest: 40,
        back_neck_to_hem: 24,
        upper_arm: 13.4,
        wrist: 8,
        sleeve_length: 12,
        shoulder_width: 16,
        neck_opening: 7,
        back_neck_depth: 1,
        front_neck_depth: frontNeckDepth,
      },
    },
    yarnGaugeMachine: {
      gaugeStitchesPerInch: 5,
      gaugeRowsPerInch: 6,
      availableNeedles: 200,
    },
    style: {
      construction: "drop-shoulder",
      frontStyle: extras.frontStyle ?? "closed",
      garmentStyle: extras.garmentStyle ?? "pullover",
      neckline: extras.neckline ?? "round",
    },
  };
}

function womensSize1PulloverRound(): Record<string, unknown> {
  return {
    fit: {
      sizingChart: "women",
      selectedSize: "1",
      easeChoice: "standard",
      selectedMeasurements: {
        finished_bust_chest: 35.5,
        back_neck_to_hem: 21,
        upper_arm: 9.75,
        wrist: 5.25,
        sleeve_length: 16.25,
        shoulder_width: 12,
        neck_opening: 6,
        back_neck_depth: 1,
        front_neck_depth: 4,
      },
    },
    yarnGaugeMachine: {
      gaugeStitchesPerInch: 5,
      gaugeRowsPerInch: 6,
      availableNeedles: 200,
    },
    style: {
      construction: "drop-shoulder",
      frontStyle: "closed",
      neckline: "round",
    },
  };
}

function svgAttr(svg: string, name: string): string {
  return new RegExp(`${name}="([^"]*)"`).exec(svg)?.[1] ?? "";
}

function pathD(svg: string, className: string): string {
  const re = new RegExp(`class="${className}"[^>]*\\sd="([^"]+)"`);
  return re.exec(svg)?.[1] ?? "";
}

function frontHasAboveArmholeSection(rows: SleevelessPatternDisplayRow[]): boolean {
  return rows.some((row) => row.kind === "section" && row.title === "ABOVE ARMHOLE MARKERS");
}

function frontMarkerText(rows: SleevelessPatternDisplayRow[]): string {
  return rows
    .filter(
      (row): row is Extract<SleevelessPatternDisplayRow, { kind: "block" }> => row.kind === "block",
    )
    .flatMap((row) => [...(row.paragraphs ?? []), ...(row.trustedParagraphs ?? [])])
    .filter((line) => /Place a marker/i.test(line))
    .join("\n");
}

function vNeckDecreaseLocals(
  result: ReturnType<typeof generateDropShoulderPattern>,
): number[] {
  const start = result.debug.frontNecklineStartRC ?? 0;
  return (result.frontNeckShoulderTimeline ?? [])
    .filter((row) =>
      row.events.some((event) => event.kind === "decrease" && event.edge === "inner"),
    )
    .map((row) => row.row - start);
}

describe("dropShoulderFrontNecklineStartRc", () => {
  it("is totalRows minus Front neck rows and is never clamped to a marker", () => {
    expect(dropShoulderFrontNecklineStartRc(144, 24)).toBe(120);
    expect(dropShoulderFrontNecklineStartRc(144, 40)).toBe(104);
    expect(dropShoulderFrontNecklineStartRc(144, 72)).toBe(72);
    expect(dropShoulderFrontNecklineStartRc(144, 200)).toBe(0);
  });
});

describe("Drop Shoulder Front neckline timing vs armhole marker", () => {
  it("pullover round: neck after, at, and before the marker", () => {
    const after = generateDropShoulderPattern(timingPattern(3));
    const at = generateDropShoulderPattern(timingPattern(6.7));
    const before = generateDropShoulderPattern(timingPattern(12));

    expect(after.debug.armholeRows).toBe(40);
    expect(after.debug.totalCalculatedRows).toBe(144);
    expect(after.debug.armholeStartRow).toBe(104);

    expect(after.debug.frontNecklineStartRC).toBeGreaterThan(after.debug.armholeStartRow!);
    expect(after.debug.frontNecklineStartRC).toBe(
      dropShoulderFrontNecklineStartRc(144, after.debug.frontNeckDepthRows!),
    );
    expect(frontHasAboveArmholeSection(after.frontDisplayRows)).toBe(true);

    expect(at.debug.frontNeckDepthRows).toBe(at.debug.armholeRows);
    expect(at.debug.frontNecklineStartRC).toBe(at.debug.armholeStartRow);
    expect(frontHasAboveArmholeSection(at.frontDisplayRows)).toBe(true);

    expect(before.debug.frontNeckDepthRows).toBe(72);
    expect(before.debug.frontNecklineStartRC).toBe(72);
    expect(before.debug.frontNecklineStartRC).toBeLessThan(before.debug.armholeStartRow!);
    expect(frontHasAboveArmholeSection(before.frontDisplayRows)).toBe(false);
    expect(frontMarkerText(before.frontDisplayRows)).toMatch(/Place a marker at each end/);
  });

  it("12 in Front neck is knitted (not replaced by armhole depth)", () => {
    const result = generateDropShoulderPattern(timingPattern(12));
    expect(result.debug.frontNeckDepth).toBe(12);
    expect(result.debug.frontNeckDepthRows).toBe(72);
    expect(result.debug.armholeRows).toBe(40);
    expect(result.debug.frontNecklineStartRC).toBe(72);
    expect(result.debug.armholeStartRow).toBe(104);
    expect(result.debug.backNecklineStartRC).toBeGreaterThanOrEqual(result.debug.armholeStartRow!);
  });

  it("pullover V-neck: same three timings; decreases finish by the shoulder", () => {
    for (const depth of [3, 6.7, 12]) {
      const result = generateDropShoulderPattern(timingPattern(depth, { neckline: "v" }));
      const start = result.debug.frontNecklineStartRC!;
      const marker = result.debug.armholeStartRow!;
      const neckRows = result.debug.frontNeckDepthRows!;
      const expectedStart = dropShoulderFrontNecklineStartRc(
        result.debug.totalCalculatedRows!,
        neckRows,
      );
      expect(start).toBe(expectedStart);
      if (depth === 3) expect(start).toBeGreaterThan(marker);
      if (depth === 6.7) expect(start).toBe(marker);
      if (depth === 12) expect(start).toBeLessThan(marker);

      const locals = vNeckDecreaseLocals(result);
      expect(locals.length).toBeGreaterThan(0);
      expect(Math.max(...locals)).toBeLessThanOrEqual(neckRows);
      const bindOffRows = (result.frontNeckShoulderTimeline ?? []).filter((row) =>
        row.events.some((event) => event.kind === "bindOff"),
      );
      expect(bindOffRows.length).toBeGreaterThan(0);
      expect(bindOffRows.every((row) => row.row === result.debug.totalCalculatedRows)).toBe(true);
      expect(bindOffRows.every((row) => row.row <= result.debug.totalCalculatedRows!)).toBe(true);
      if (depth === 3) {
        expect(neckRows).toBe(18);
        expect(locals).toContain(18);
        expect(Math.max(...locals)).toBe(18);
        expect(bindOffRows).toHaveLength(1);
        expect(bindOffRows[0]!.row).toBe(result.debug.totalCalculatedRows);
        expect(bindOffRows[0]!.events.some((event) => event.kind === "decrease")).toBe(true);
      }

      const perSide = neckDecreaseStitchesPerSideFromOpening(result.debug.necklineStitches!);
      const sched = evenShapingSchedule(perSide, neckRows);
      const scheduled = evenShapingGarmentRowNumbers(0, sched).filter((n) => n <= neckRows);
      expect(locals).toEqual(scheduled);
    }
  });

  it("cardigan round and V-neck: a deep neck may begin before the marker", () => {
    const cardigan = { frontStyle: "open", garmentStyle: "cardigan" };
    const round = generateDropShoulderPattern(timingPattern(12, cardigan));
    const vneck = generateDropShoulderPattern(timingPattern(12, { ...cardigan, neckline: "v" }));

    expect(round.debug.frontNecklineStartRC).toBe(72);
    expect(round.debug.frontNecklineStartRC).toBeLessThan(round.debug.armholeStartRow!);
    expect(frontHasAboveArmholeSection(round.frontDisplayRows)).toBe(false);
    expect(frontMarkerText(round.frontDisplayRows)).toMatch(/Place a marker at the side edge/);

    expect(vneck.debug.frontNecklineStartRC).toBe(72);
    const locals = vNeckDecreaseLocals(vneck);
    expect(Math.max(...locals)).toBeLessThanOrEqual(vneck.debug.frontNeckDepthRows!);
    const bindOffRows = (vneck.frontNeckShoulderTimeline ?? []).filter((row) =>
      row.events.some((event) => event.kind === "bindOff"),
    );
    expect(bindOffRows.every((row) => row.row === vneck.debug.totalCalculatedRows)).toBe(true);
  });

  it("Front diagrams use actual neck rows and may cross below the armhole marker", () => {
    const pattern = timingPattern(12);
    const result = generateDropShoulderPattern(pattern);
    const model = buildDropShoulderFrontStitchesRowsModel(result, pattern, "in")!;
    expect(model.frontNeckDepthRows).toBe(72);
    expect(model.necklineRowsInsideArmhole).toBe(72);
    expect(model.armholeEvenRows).toBe(0);
    expect(model.necklineDepthLabel).toContain("72 rows");
    expect(model.necklineDepthLabel).toContain("12 in");
    expect(model.armholeDepthLabel).toContain("40 rows");

    const sts = tryBuildLiveDropShoulderFrontStsRowsDiagramSvg(result, pattern, "in")!;
    const notation = tryBuildLiveDropShoulderFrontNotationSvg(result, pattern)!;
    expect(sts).toContain('data-neck-begins-before-armhole="true"');
    expect(notation).toContain('data-neck-begins-before-armhole="true"');
    expect(Number(svgAttr(sts, "data-neck-bottom-y"))).toBeGreaterThan(
      Number(svgAttr(sts, "data-armhole-marker-y")),
    );
    expect(svgAttr(sts, "data-armhole-marker-y")).toBe(svgAttr(notation, "data-armhole-marker-y"));
    expect(pathD(sts, "ds-front-diagram__body")).toBe(pathD(notation, "ds-front-diagram__body"));
    expect(pathD(sts, "ds-front-diagram__body").length).toBeGreaterThan(0);
  });

  it("does not change Back neck math, sleeves, or shallow Front timing", () => {
    const deep = generateDropShoulderPattern(timingPattern(12));
    expect(deep.debug.backNeckDepthRows).toBeLessThanOrEqual(deep.debug.armholeRows!);
    expect(deep.debug.backNecklineStartRC).toBeGreaterThanOrEqual(deep.debug.armholeStartRow!);
    expect(deep.sleeveDisplayRows.length).toBeGreaterThan(0);
    const backSvg = tryBuildLiveDropShoulderBackStsRowsDiagramSvg(deep);
    expect(backSvg).toBeTruthy();
    expect(backSvg).not.toContain('data-neck-begins-before-armhole="true"');

    const shallow = generateDropShoulderPattern(womensSize1PulloverRound());
    expect(shallow.debug.frontNecklineStartRC).toBeGreaterThan(shallow.debug.armholeStartRow!);

    const kids = kids10YrRelaxedArmhole36Pattern();
    const kidsDs = generateDropShoulderPattern(kids);
    expect(kidsDs.debug.frontNecklineStartRC).toBeGreaterThan(kidsDs.debug.armholeStartRow!);
    const kidsSl = generateSleevelessBackPattern({
      ...kids,
      style: { ...(kids.style as Record<string, unknown>), construction: "sleeveless" },
    });
    expect(kidsSl.debug.frontNecklineStartRC).toBeGreaterThan(0);
    expect(kidsSl.frontDisplayRows.length).toBeGreaterThan(0);
  });
});
