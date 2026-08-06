import { describe, expect, it } from "vitest";
import {
  calculateNeckbandPickup,
  formatNeckbandPickupInstruction,
  neckbandPickupInstructionFromDebug,
  necklineEdgeRowsAroundOpening,
  NECKBAND_ROUND_PICKUP_ESTIMATE_NOTE,
  pickupStitchesFromRowEdge,
} from "./neckbandPickup";
import { generateDropShoulderPattern } from "../dropShoulderPatternOutput";
import { generateSleevelessBackPattern } from "../sleevelessPatternOutput";
import { sleevelessFinishingFromPattern } from "../sleevelessPatternFinishing";
import {
  buildSleevelessFinishingPrintListHtml,
  buildSleevelessFinishingStepsHtml,
} from "../sleevelessPatternFinishingHtml";

function sleevelessBaseMeasurements() {
  return {
    finished_bust_chest: 40,
    back_neck_to_hem: 22,
    armhole_depth: 8,
    neck_opening: 6,
    shoulder_width: 4.25,
    front_neck_depth: 3,
    back_neck_depth: 1,
  };
}

function dropShoulderBaseMeasurements() {
  return {
    finished_bust_chest: 40,
    back_neck_to_hem: 24,
    upper_arm: 16,
    wrist: 8,
    sleeve_length: 12,
    shoulder_width: 16,
    neck_opening: 7,
    back_neck_depth: 1,
    front_neck_depth: 4,
  };
}

function gauge(spi = 5, rpi = 7) {
  return {
    gaugeStitchesPerInch: spi,
    gaugeRowsPerInch: rpi,
    availableNeedles: 200,
  };
}

function sleevelessPattern(neckline: "round" | "v-neck", yarnGauge = gauge()) {
  return {
    fit: { selectedMeasurements: sleevelessBaseMeasurements() },
    style: { neckline, frontStyle: "closed" },
    yarnGaugeMachine: yarnGauge,
  };
}

function dropShoulderPattern(neckline: "round" | "v-neck" | "v", yarnGauge = gauge()) {
  return {
    fit: { selectedMeasurements: dropShoulderBaseMeasurements() },
    style: {
      construction: "drop-shoulder",
      constructionAuthored: "drop-shoulder",
      frontStyle: "closed",
      neckline,
    },
    yarnGaugeMachine: yarnGauge,
  };
}

const finishingDeps = {
  escapeHtml: (s: string) => s,
  glossaryTooltip: (_id: number, term: string) => term,
  neckFinishingVideoKey: "onePieceBand",
  neckFinishingButtonLabel: "One-piece neckband",
  neckFinishingLeadHtml: "",
};

describe("neckbandPickup LEGO — pure math", () => {
  it("rounds row-edge pickup with Math.round (nearest whole stitch)", () => {
    // 10 rows * 5/7 ≈ 7.142 → 7
    expect(pickupStitchesFromRowEdge(10, 5, 7)).toBe(7);
    // 11 rows * 5/7 ≈ 7.857 → 8
    expect(pickupStitchesFromRowEdge(11, 5, 7)).toBe(8);
    // Exact half: 7 rows * 5/7 = 5 exactly
    expect(pickupStitchesFromRowEdge(7, 5, 7)).toBe(5);
    // 1 row * 5/7 ≈ 0.714 → 1
    expect(pickupStitchesFromRowEdge(1, 5, 7)).toBe(1);
  });

  it("counts neckline edge rows as 2 × (front + back) depth", () => {
    expect(necklineEdgeRowsAroundOpening(21, 7)).toBe(56);
    expect(necklineEdgeRowsAroundOpening(0, 8)).toBe(16);
  });

  it("V-neck: X stitches over Y rows; no center contribution", () => {
    const result = calculateNeckbandPickup({
      neckline: "v-neck",
      frontNeckDepthRows: 21,
      backNeckDepthRows: 7,
      stitchesPerUnit: 5,
      rowsPerUnit: 7,
      frontCenterNeckStitches: 99,
      backCenterNeckStitches: 88,
    });
    expect(result.kind).toBe("v-neck");
    if (result.kind !== "v-neck") return;
    expect(result.necklineEdgeRows).toBe(56);
    expect(result.pickupStitches).toBe(pickupStitchesFromRowEdge(56, 5, 7));
    expect(result.sections.centerNeckStitches).toBe(0);
    const instruction = formatNeckbandPickupInstruction(result);
    expect(instruction.primaryText).toBe(
      `Pick up ${result.pickupStitches} stitches evenly over 56 rows around the neckline.`,
    );
    expect(instruction.estimateNoteText).toBeUndefined();
    expect(instruction.primaryText).toMatch(/over \d+ rows/);
    expect(instruction.primaryText).not.toMatch(/approximately/);
  });

  it("round: total includes center stitches + converted curved row edges", () => {
    const result = calculateNeckbandPickup({
      neckline: "round",
      frontCenterNeckStitches: 10,
      backCenterNeckStitches: 14,
      frontNeckDepthRows: 21,
      backNeckDepthRows: 7,
      stitchesPerUnit: 5,
      rowsPerUnit: 7,
    });
    expect(result.kind).toBe("round");
    if (result.kind !== "round") return;
    const edge = pickupStitchesFromRowEdge(56, 5, 7);
    expect(result.sections.centerNeckStitches).toBe(24);
    expect(result.sections.curvedEdgePickupStitches).toBe(edge);
    expect(result.pickupStitches).toBe(24 + edge);
    const instruction = formatNeckbandPickupInstruction(result);
    expect(instruction.primaryText).toBe(
      `Pick up approximately ${result.pickupStitches} stitches evenly around the neckline.`,
    );
    expect(instruction.estimateNoteText).toBe(NECKBAND_ROUND_PICKUP_ESTIMATE_NOTE);
    expect(instruction.primaryText).not.toMatch(/center|curved|front|back/i);
    expect(instruction.primaryText).not.toMatch(/over \d+ rows/);
  });

  it("inch and centimeter equivalent gauges yield the same pickup counts", () => {
    // 5 sts/in & 7 rows/in ≡ 5/2.54 sts/cm & 7/2.54 rows/cm — same ratio.
    const perInch = calculateNeckbandPickup({
      neckline: "round",
      frontCenterNeckStitches: 12,
      backCenterNeckStitches: 15,
      frontNeckDepthRows: 20,
      backNeckDepthRows: 8,
      stitchesPerUnit: 5,
      rowsPerUnit: 7,
    });
    const perCm = calculateNeckbandPickup({
      neckline: "round",
      frontCenterNeckStitches: 12,
      backCenterNeckStitches: 15,
      frontNeckDepthRows: 20,
      backNeckDepthRows: 8,
      stitchesPerUnit: 5 / 2.54,
      rowsPerUnit: 7 / 2.54,
    });
    expect(perCm.pickupStitches).toBe(perInch.pickupStitches);
    expect(perCm.sections.curvedEdgePickupStitches).toBe(
      perInch.sections.curvedEdgePickupStitches,
    );
  });
});

describe("neckbandPickup — Sleeveless integration", () => {
  it("Sleeveless V-neck pickup uses X-over-Y format from debug geometry", () => {
    const pattern = sleevelessPattern("v-neck");
    const generated = generateSleevelessBackPattern(pattern);
    const finishing = sleevelessFinishingFromPattern(pattern, generated.debug);
    expect(finishing.neckbandPickup).not.toBeNull();
    expect(finishing.neckbandPickup!.kind).toBe("v-neck");
    expect(finishing.neckbandPickup!.primaryText).toMatch(
      /^Pick up \d+ stitches evenly over \d+ rows around the neckline\.$/,
    );
    expect(finishing.neckbandPickup!.estimateNoteText).toBeUndefined();
    expect(generated.debug.frontCenterNeckBindOffStitches).toBeUndefined();

    const y = 2 * (generated.debug.frontNeckDepthRows + generated.debug.backNeckDepthRows);
    const x = pickupStitchesFromRowEdge(
      y,
      generated.debug.stitchesPerInch,
      generated.debug.rowsPerInch,
    );
    expect(finishing.neckbandPickup!.pickupStitches).toBe(x);
    expect(finishing.neckbandPickup!.necklineEdgeRows).toBe(y);

    const html = buildSleevelessFinishingStepsHtml({
      isCardigan: false,
      neckbandPickup: finishing.neckbandPickup,
      deps: finishingDeps,
    });
    expect(html).toContain(finishing.neckbandPickup!.primaryText);
    expect(html).not.toContain(NECKBAND_ROUND_PICKUP_ESTIMATE_NOTE);

    const print = buildSleevelessFinishingPrintListHtml({
      isCardigan: false,
      neckbandPickup: finishing.neckbandPickup,
    });
    expect(print).toContain(finishing.neckbandPickup!.primaryText);
  });

  it("Sleeveless round-neck pickup is approximate total with estimate note", () => {
    const pattern = sleevelessPattern("round");
    const generated = generateSleevelessBackPattern(pattern);
    expect(generated.debug.frontCenterNeckBindOffStitches).toBeGreaterThan(0);
    expect(generated.debug.centerNeckBindOffStitches).toBeGreaterThan(0);

    const finishing = sleevelessFinishingFromPattern(pattern, generated.debug);
    expect(finishing.neckbandPickup!.kind).toBe("round");
    expect(finishing.neckbandPickup!.primaryText).toMatch(
      /^Pick up approximately \d+ stitches evenly around the neckline\.$/,
    );
    expect(finishing.neckbandPickup!.estimateNoteText).toBe(NECKBAND_ROUND_PICKUP_ESTIMATE_NOTE);
    expect(finishing.neckbandPickup!.primaryText).not.toMatch(/over \d+ rows/);

    const edgeRows = 2 * (generated.debug.frontNeckDepthRows + generated.debug.backNeckDepthRows);
    const edgeSts = pickupStitchesFromRowEdge(
      edgeRows,
      generated.debug.stitchesPerInch,
      generated.debug.rowsPerInch,
    );
    const center =
      (generated.debug.frontCenterNeckBindOffStitches ?? 0) +
      (generated.debug.centerNeckBindOffStitches ?? 0);
    expect(finishing.neckbandPickup!.pickupStitches).toBe(center + edgeSts);

    const html = buildSleevelessFinishingStepsHtml({
      isCardigan: false,
      neckbandPickup: finishing.neckbandPickup,
      deps: finishingDeps,
    });
    expect(html).toContain(finishing.neckbandPickup!.primaryText);
    expect(html).toContain(NECKBAND_ROUND_PICKUP_ESTIMATE_NOTE);
    expect(html).not.toMatch(/centerNeck|curvedEdge|frontCenter/i);

    const print = buildSleevelessFinishingPrintListHtml({
      isCardigan: false,
      neckbandPickup: finishing.neckbandPickup,
    });
    expect(print).toContain(finishing.neckbandPickup!.primaryText);
    expect(print).toContain(NECKBAND_ROUND_PICKUP_ESTIMATE_NOTE);
  });
});

describe("neckbandPickup — Drop Shoulder integration", () => {
  it("Drop Shoulder V-neck pickup uses X-over-Y format", () => {
    const pattern = dropShoulderPattern("v-neck");
    const generated = generateDropShoulderPattern(pattern);
    const finishing = sleevelessFinishingFromPattern(pattern, generated.debug);
    expect(finishing.isDropShoulder).toBe(true);
    expect(finishing.neckbandPickup!.kind).toBe("v-neck");
    expect(finishing.neckbandPickup!.primaryText).toMatch(
      /^Pick up \d+ stitches evenly over \d+ rows around the neckline\.$/,
    );
    const y = 2 * (generated.debug.frontNeckDepthRows + generated.debug.backNeckDepthRows);
    expect(finishing.neckbandPickup!.necklineEdgeRows).toBe(y);
  });

  it("Drop Shoulder round-neck pickup includes center + curved edges as one total", () => {
    const pattern = dropShoulderPattern("round");
    const generated = generateDropShoulderPattern(pattern);
    expect(generated.debug.frontCenterNeckBindOffStitches).toBeGreaterThan(0);
    const finishing = sleevelessFinishingFromPattern(pattern, generated.debug);
    expect(finishing.neckbandPickup!.kind).toBe("round");
    const edgeRows = 2 * (generated.debug.frontNeckDepthRows + generated.debug.backNeckDepthRows);
    const expected =
      (generated.debug.frontCenterNeckBindOffStitches ?? 0) +
      (generated.debug.centerNeckBindOffStitches ?? 0) +
      pickupStitchesFromRowEdge(
        edgeRows,
        generated.debug.stitchesPerInch,
        generated.debug.rowsPerInch,
      );
    expect(finishing.neckbandPickup!.pickupStitches).toBe(expected);
    expect(finishing.neckbandPickup!.estimateNoteText).toBe(NECKBAND_ROUND_PICKUP_ESTIMATE_NOTE);
  });
});

describe("neckbandPickup — saved vs viewed parity", () => {
  it("regenerating from the same saved inputs yields identical pickup instructions", () => {
    for (const neckline of ["round", "v-neck"] as const) {
      for (const kind of ["sleeveless", "drop-shoulder"] as const) {
        const pattern =
          kind === "sleeveless" ? sleevelessPattern(neckline) : dropShoulderPattern(neckline);
        const first =
          kind === "sleeveless"
            ? generateSleevelessBackPattern(pattern)
            : generateDropShoulderPattern(pattern);
        const second =
          kind === "sleeveless"
            ? generateSleevelessBackPattern(pattern)
            : generateDropShoulderPattern(pattern);
        const a = sleevelessFinishingFromPattern(pattern, first.debug).neckbandPickup;
        const b = sleevelessFinishingFromPattern(pattern, second.debug).neckbandPickup;
        expect(a).toEqual(b);
        expect(neckbandPickupInstructionFromDebug(neckline, first.debug)).toEqual(a);
      }
    }
  });
});
