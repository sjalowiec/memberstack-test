import { describe, expect, it } from "vitest";
import {
  calculateNeckbandPickup,
  formatNeckbandPickupInstruction,
  neckbandPickupInstructionFromDebug,
  necklineEdgeRowsAroundOpening,
  NECKBAND_ROUND_PICKUP_ESTIMATE_NOTE,
  pickupStitchesFromEdgeLength,
  pickupStitchesFromRowEdge,
  roundNeckPieceEdgeLength,
  roundNeckSideEdgeLength,
  vNeckFrontSlopeEdgeLength,
} from "./neckbandPickup";
import {
  calculateBackRoundNecklinePlan,
  calculateRoundNecklinePlan,
} from "./roundNeckline";
import { generateDropShoulderPattern } from "../dropShoulderPatternOutput";
import { generateSleevelessBackPattern } from "../sleevelessPatternOutput";
import { sleevelessFinishingFromPattern } from "../sleevelessPatternFinishing";
import {
  buildSleevelessFinishingPrintListHtml,
  buildSleevelessFinishingStepsHtml,
} from "../sleevelessPatternFinishingHtml";

function sleevelessBaseMeasurements(overrides: Record<string, number> = {}) {
  return {
    finished_bust_chest: 40,
    back_neck_to_hem: 22,
    armhole_depth: 8,
    neck_opening: 6,
    shoulder_width: 4.25,
    front_neck_depth: 3,
    back_neck_depth: 1,
    ...overrides,
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

function sleevelessPattern(
  neckline: "round" | "v-neck",
  yarnGauge = gauge(),
  frontStyle: "closed" | "open" = "closed",
  measurementOverrides: Record<string, number> = {},
) {
  return {
    fit: { selectedMeasurements: sleevelessBaseMeasurements(measurementOverrides) },
    style: { neckline, frontStyle },
    yarnGaugeMachine: yarnGauge,
  };
}

function dropShoulderPattern(
  neckline: "round" | "v-neck" | "v",
  yarnGauge = gauge(),
  frontStyle: "closed" | "open" = "closed",
) {
  return {
    fit: { selectedMeasurements: dropShoulderBaseMeasurements() },
    style: {
      construction: "drop-shoulder",
      constructionAuthored: "drop-shoulder",
      frontStyle,
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

/** Audited round-pullover fixture: our old depth-only total was 60; path-length ≈ 76–77. */
const AUDIT_ROUND_PULLOVER = {
  neck_opening: 4.5,
  front_neck_depth: 3,
  back_neck_depth: 1,
};

describe("neckbandPickup LEGO — path length helpers", () => {
  it("rounds row-edge pickup with Math.round (V-neck / diagnostics)", () => {
    expect(pickupStitchesFromRowEdge(10, 5, 7)).toBe(7);
    expect(pickupStitchesFromRowEdge(11, 5, 7)).toBe(8);
    expect(pickupStitchesFromRowEdge(7, 5, 7)).toBe(5);
  });

  it("diagonal single-decrease segments use both stitch and row gauge", () => {
    const len = roundNeckSideEdgeLength(
      { stairSteps: [], singleDecreaseCount: 1, holdGroups: [] },
      5,
      7,
    );
    expect(len).toBeCloseTo(Math.hypot(1 / 5, 2 / 7), 10);
    expect(pickupStitchesFromEdgeLength(len, 5)).toBe(
      Math.round(Math.hypot(1 / 5, 2 / 7) * 5),
    );
  });

  it("horizontal stair and hold sections are included once", () => {
    const stairOnly = roundNeckSideEdgeLength(
      { stairSteps: [2, 2], singleDecreaseCount: 0, holdGroups: [] },
      5,
      7,
    );
    expect(stairOnly).toBeCloseTo(4 / 5, 10);
    const holdOnly = roundNeckSideEdgeLength(
      { stairSteps: [], singleDecreaseCount: 0, holdGroups: [2, 1, 1, 1] },
      5,
      7,
    );
    // 5 hold stitches horizontal + 3 × 2-row gaps between 4 groups
    expect(holdOnly).toBeCloseTo(5 / 5 + (3 * 2) / 7, 10);
  });
});

describe("neckbandPickup — audited round-pullover regression (4.5in / 3in / 1in)", () => {
  it("matches plan geometry and yields ~76–77 complete (not the old 60)", () => {
    const pattern = sleevelessPattern("round", gauge(), "closed", AUDIT_ROUND_PULLOVER);
    const generated = generateSleevelessBackPattern(pattern);
    const d = generated.debug;

    expect(d.stitchesPerInch).toBe(5);
    expect(d.rowsPerInch).toBe(7);
    expect(d.necklineStitches).toBe(22);
    expect(d.frontCenterNeckBindOffStitches).toBe(6);
    expect(d.centerNeckBindOffStitches).toBe(11);
    expect(d.frontNeckDepthRows).toBe(22);
    expect(d.backNeckDepthRows).toBe(8);

    const frontPlan = calculateRoundNecklinePlan({
      necklineStitches: 22,
      necklineDepthRows: 22,
    });
    const backPlan = calculateBackRoundNecklinePlan({
      necklineStitches: 22,
      necklineDepthRows: 8,
    });
    expect(frontPlan.centerBindOff).toBe(6);
    expect(frontPlan.left.stairSteps).toEqual([2, 2]);
    expect(frontPlan.right.stairSteps).toEqual([2, 2]);
    expect(frontPlan.left.singleDecreaseCount).toBe(4);
    expect(frontPlan.right.singleDecreaseCount).toBe(4);
    expect(backPlan.centerBindOff).toBe(11);
    expect(backPlan.left.holdGroups).toEqual([2, 1, 1, 1]);
    expect(backPlan.right.holdGroups).toEqual([2, 2, 1, 1]);

    const result = calculateNeckbandPickup({
      neckline: "round",
      garment: "pullover",
      necklineStitches: 22,
      frontRoundPlan: frontPlan,
      backRoundPlan: backPlan,
      frontNeckDepthRows: 22,
      backNeckDepthRows: 8,
      stitchesPerUnit: 5,
      rowsPerUnit: 7,
    });

    expect(result.kind).toBe("round");
    expect(result.sections.frontPickupStitches).toBeDefined();
    expect(result.sections.backPickupStitches).toBeDefined();
    const front = result.sections.frontPickupStitches!;
    const back = result.sections.backPickupStitches!;
    const total = result.pickupStitches;

    // Path-length model ≈ DesignaKnit 47+29=76; allow one-stitch rounding band.
    expect(front).toBeGreaterThanOrEqual(45);
    expect(front).toBeLessThanOrEqual(48);
    expect(back).toBeGreaterThanOrEqual(28);
    expect(back).toBeLessThanOrEqual(32);
    expect(total).toBeGreaterThanOrEqual(76);
    expect(total).toBeLessThanOrEqual(77);
    expect(total).not.toBe(60);
    expect(front + back).toBe(total);

    // Shaped edge longer than vertical projection of depth rows alone.
    const verticalProjection = pickupStitchesFromRowEdge(2 * (22 + 8), 5, 7);
    expect(total).toBeGreaterThan(6 + 11 + verticalProjection);

    const instruction = formatNeckbandPickupInstruction(result);
    expect(instruction.primaryText).toBe(
      `Pick up approximately ${total} stitches evenly around the neckline.`,
    );
    expect(instruction.estimateNoteText).toBe(NECKBAND_ROUND_PICKUP_ESTIMATE_NOTE);

    // Remaining even vertical rows are included (front depth 22 > rowsRequired 10).
    expect(frontPlan.rowsRequired).toBe(10);
    const rem = 22 - 10;
    expect(rem).toBeGreaterThan(0);
    const lengthWithRem = roundNeckPieceEdgeLength(frontPlan, 22, 5, 7);
    const lengthNoRem = roundNeckPieceEdgeLength(frontPlan, frontPlan.rowsRequired, 5, 7);
    expect(lengthWithRem).toBeGreaterThan(lengthNoRem);
  });

  it("generator + finishing path matches the same ~76–77 total", () => {
    const pattern = sleevelessPattern("round", gauge(), "closed", AUDIT_ROUND_PULLOVER);
    const generated = generateSleevelessBackPattern(pattern);
    const finishing = sleevelessFinishingFromPattern(pattern, generated.debug);
    expect(finishing.neckbandPickup!.pickupStitches).toBeGreaterThanOrEqual(76);
    expect(finishing.neckbandPickup!.pickupStitches).toBeLessThanOrEqual(77);
    expect(finishing.neckbandPickup!.primaryText).toContain(
      `Pick up approximately ${finishing.neckbandPickup!.pickupStitches} stitches evenly around the neckline.`,
    );
  });
});

describe("neckbandPickup — V-neck pullover path length", () => {
  it("uses approximately wording with estimate note and no over-Y-rows", () => {
    const result = calculateNeckbandPickup({
      neckline: "v-neck",
      garment: "pullover",
      necklineStitches: 30,
      frontNeckDepthRows: 22,
      backNeckDepthRows: 8,
      stitchesPerUnit: 5,
      rowsPerUnit: 7,
      backCenterNeckStitches: 15,
    });
    expect(result.kind).toBe("v-neck");
    expect(result.garment).toBe("pullover");
    // Center-front contribution is zero; sections report back center only.
    expect(result.sections.firstFrontStitches).toBeGreaterThan(0);
    expect(result.sections.secondFrontStitches).toBeGreaterThan(0);
    expect(result.sections.firstFrontStitches).toBe(result.sections.secondFrontStitches);
    expect(result.sections.backPickupStitches).toBeGreaterThan(0);
    expect(result.sections.frontPickupStitches).toBe(
      (result.sections.firstFrontStitches ?? 0) + (result.sections.secondFrontStitches ?? 0),
    );
    expect(result.pickupStitches).toBe(
      (result.sections.frontPickupStitches ?? 0) + (result.sections.backPickupStitches ?? 0),
    );

    // Actual shaped-edge length > pure vertical projection of front depths alone.
    const verticalFrontOnly = pickupStitchesFromRowEdge(2 * 22, 5, 7);
    expect(result.sections.frontPickupStitches!).toBeGreaterThan(verticalFrontOnly);

    const instruction = formatNeckbandPickupInstruction(result);
    expect(instruction.primaryText).toBe(
      `Pick up approximately ${result.pickupStitches} stitches evenly around the neckline.`,
    );
    expect(instruction.primaryText).toMatch(/approximately/);
    expect(instruction.primaryText).not.toMatch(/over \d+ rows/);
    expect(instruction.estimateNoteText).toBe(NECKBAND_ROUND_PICKUP_ESTIMATE_NOTE);
    expect(instruction.necklineEdgeRows).toBeUndefined();
  });

  it("includes both front slopes and complete back; center-front stitches are zero", () => {
    const decreases = 15; // floor(30/2)
    const firstLen = vNeckFrontSlopeEdgeLength(decreases, 22, 5, 7);
    const secondLen = vNeckFrontSlopeEdgeLength(decreases, 22, 5, 7);
    expect(firstLen).toBeCloseTo(secondLen, 10);
    // No center-front length in the slopes.
    const firstPu = pickupStitchesFromEdgeLength(firstLen, 5);
    const secondPu = pickupStitchesFromEdgeLength(secondLen, 5);

    const backPlan = calculateBackRoundNecklinePlan({
      necklineStitches: 30,
      necklineDepthRows: 8,
    });
    const backPu = pickupStitchesFromEdgeLength(
      roundNeckPieceEdgeLength(backPlan, 8, 5, 7),
      5,
    );

    const result = calculateNeckbandPickup({
      neckline: "v-neck",
      necklineStitches: 30,
      frontNeckDepthRows: 22,
      backNeckDepthRows: 8,
      stitchesPerUnit: 5,
      rowsPerUnit: 7,
    });
    expect(result.sections.firstFrontStitches).toBe(firstPu);
    expect(result.sections.secondFrontStitches).toBe(secondPu);
    expect(result.sections.backPickupStitches).toBe(backPu);
    expect(result.pickupStitches).toBe(firstPu + secondPu + backPu);
  });
});

describe("neckbandPickup — inch/cm equivalence", () => {
  it("identical physical geometry yields equivalent round pickup counts", () => {
    const frontPlan = calculateRoundNecklinePlan({
      necklineStitches: 22,
      necklineDepthRows: 22,
    });
    const backPlan = calculateBackRoundNecklinePlan({
      necklineStitches: 22,
      necklineDepthRows: 8,
    });
    const perInch = calculateNeckbandPickup({
      neckline: "round",
      necklineStitches: 22,
      frontRoundPlan: frontPlan,
      backRoundPlan: backPlan,
      frontNeckDepthRows: 22,
      backNeckDepthRows: 8,
      stitchesPerUnit: 5,
      rowsPerUnit: 7,
    });
    // Same physical gauges expressed per cm.
    const perCm = calculateNeckbandPickup({
      neckline: "round",
      necklineStitches: 22,
      frontRoundPlan: frontPlan,
      backRoundPlan: backPlan,
      frontNeckDepthRows: 22,
      backNeckDepthRows: 8,
      stitchesPerUnit: 5 / 2.54,
      rowsPerUnit: 7 / 2.54,
    });
    expect(perCm.pickupStitches).toBe(perInch.pickupStitches);
    expect(perCm.sections.frontPickupStitches).toBe(perInch.sections.frontPickupStitches);
    expect(perCm.sections.backPickupStitches).toBe(perInch.sections.backPickupStitches);
  });
});

describe("neckbandPickup — Sleeveless / Drop Shoulder integration", () => {
  it("Sleeveless V-neck pickup uses approximately wording from path-length total", () => {
    const pattern = sleevelessPattern("v-neck");
    const generated = generateSleevelessBackPattern(pattern);
    const finishing = sleevelessFinishingFromPattern(pattern, generated.debug);
    expect(finishing.neckbandPickup!.kind).toBe("v-neck");
    expect(finishing.neckbandPickup!.garment).toBe("pullover");
    expect(finishing.neckbandPickup!.primaryText).toMatch(
      /^Pick up approximately \d+ stitches evenly around the neckline\.$/,
    );
    expect(finishing.neckbandPickup!.primaryText).not.toMatch(/over \d+ rows/);
    expect(finishing.neckbandPickup!.estimateNoteText).toBe(NECKBAND_ROUND_PICKUP_ESTIMATE_NOTE);
    expect(finishing.neckbandPickup!.frontPickupStitches).toBe(
      (finishing.neckbandPickup!.firstFrontStitches ?? 0) +
        (finishing.neckbandPickup!.secondFrontStitches ?? 0),
    );
    expect(generated.debug.frontCenterNeckBindOffStitches).toBeUndefined();

    const html = buildSleevelessFinishingStepsHtml({
      isCardigan: false,
      neckbandPickup: finishing.neckbandPickup,
      deps: finishingDeps,
    });
    const print = buildSleevelessFinishingPrintListHtml({
      isCardigan: false,
      neckbandPickup: finishing.neckbandPickup,
    });
    expect(html).toContain(finishing.neckbandPickup!.primaryText);
    expect(html).toContain(NECKBAND_ROUND_PICKUP_ESTIMATE_NOTE);
    expect(print).toContain(finishing.neckbandPickup!.primaryText);
    expect(print).toContain(NECKBAND_ROUND_PICKUP_ESTIMATE_NOTE);
  });

  it("Sleeveless round-neck pickup is path-length total with estimate note", () => {
    const pattern = sleevelessPattern("round");
    const generated = generateSleevelessBackPattern(pattern);
    const finishing = sleevelessFinishingFromPattern(pattern, generated.debug);
    expect(finishing.neckbandPickup!.kind).toBe("round");
    expect(finishing.neckbandPickup!.garment).toBe("pullover");
    expect(finishing.neckbandPickup!.primaryText).toMatch(
      /^Pick up approximately \d+ stitches evenly around the neckline\.$/,
    );
    expect(finishing.neckbandPickup!.estimateNoteText).toBe(NECKBAND_ROUND_PICKUP_ESTIMATE_NOTE);
    const verticalOnly =
      (generated.debug.frontCenterNeckBindOffStitches ?? 0) +
      (generated.debug.centerNeckBindOffStitches ?? 0) +
      pickupStitchesFromRowEdge(
        necklineEdgeRowsAroundOpening(
          generated.debug.frontNeckDepthRows,
          generated.debug.backNeckDepthRows,
        ),
        generated.debug.stitchesPerInch,
        generated.debug.rowsPerInch,
      );
    expect(finishing.neckbandPickup!.pickupStitches).toBeGreaterThan(verticalOnly);

    const html = buildSleevelessFinishingStepsHtml({
      isCardigan: false,
      neckbandPickup: finishing.neckbandPickup,
      deps: finishingDeps,
    });
    const print = buildSleevelessFinishingPrintListHtml({
      isCardigan: false,
      neckbandPickup: finishing.neckbandPickup,
    });
    expect(html).toContain(finishing.neckbandPickup!.primaryText);
    expect(print).toContain(finishing.neckbandPickup!.primaryText);
  });

  it("Drop Shoulder V-neck and round use shared finishing instructions", () => {
    const v = dropShoulderPattern("v-neck");
    const vGen = generateDropShoulderPattern(v);
    const vFin = sleevelessFinishingFromPattern(v, vGen.debug);
    expect(vFin.isDropShoulder).toBe(true);
    expect(vFin.neckbandPickup!.kind).toBe("v-neck");
    expect(vFin.neckbandPickup!.primaryText).toMatch(
      /^Pick up approximately \d+ stitches evenly around the neckline\.$/,
    );
    expect(vFin.neckbandPickup!.primaryText).not.toMatch(/over \d+ rows/);
    expect(vFin.neckbandPickup!.estimateNoteText).toBe(NECKBAND_ROUND_PICKUP_ESTIMATE_NOTE);

    const r = dropShoulderPattern("round");
    const rGen = generateDropShoulderPattern(r);
    const rFin = sleevelessFinishingFromPattern(r, rGen.debug);
    expect(rFin.neckbandPickup!.kind).toBe("round");
    expect(rFin.neckbandPickup!.primaryText).toMatch(
      /^Pick up approximately \d+ stitches evenly around the neckline\.$/,
    );
  });
});

describe("neckbandPickup — cardigan sections", () => {
  it("round cardigan uses three-section wording from front/back plans", () => {
    const pattern = sleevelessPattern("round", gauge(), "open");
    const generated = generateSleevelessBackPattern(pattern);
    const finishing = sleevelessFinishingFromPattern(pattern, generated.debug);
    expect(finishing.isCardigan).toBe(true);
    expect(finishing.neckbandPickup!.garment).toBe("cardigan");
    expect(finishing.neckbandPickup!.primaryText).toMatch(
      /^Pick up approximately \d+ stitches along the first front neckline edge, \d+ stitches across the back neckline, and \d+ stitches along the second front neckline edge\.$/,
    );
    expect(finishing.neckbandPickup!.estimateNoteText).toBe(NECKBAND_ROUND_PICKUP_ESTIMATE_NOTE);
    expect(finishing.neckbandPickup!.primaryText).not.toMatch(/evenly around the neckline/);
    // CF band pickup is a different number than neckline-edge sections.
    expect(finishing.frontEdgePickupSts).toBeDefined();
    expect(finishing.neckbandPickup!.firstFrontStitches).not.toBe(finishing.frontEdgePickupSts);
  });

  it("V-neck cardigan keeps three-section wording with path-length sections and estimate note", () => {
    const pattern = sleevelessPattern("v-neck", gauge(), "open");
    const generated = generateSleevelessBackPattern(pattern);
    const finishing = sleevelessFinishingFromPattern(pattern, generated.debug);
    expect(finishing.neckbandPickup!.garment).toBe("cardigan");
    expect(finishing.neckbandPickup!.kind).toBe("v-neck");
    expect(finishing.neckbandPickup!.estimateNoteText).toBe(NECKBAND_ROUND_PICKUP_ESTIMATE_NOTE);
    expect(finishing.neckbandPickup!.primaryText).toContain("first front neckline edge");
    expect(finishing.neckbandPickup!.primaryText).toContain("across the back neckline");
    expect(finishing.neckbandPickup!.primaryText).toContain("second front neckline edge");
    expect(finishing.neckbandPickup!.primaryText).not.toMatch(/over \d+ rows/);
    // No center-front stitches: front sections equal slope pickups only.
    expect(finishing.neckbandPickup!.firstFrontStitches).toBe(
      finishing.neckbandPickup!.secondFrontStitches,
    );
    const verticalOneFront = pickupStitchesFromRowEdge(
      generated.debug.frontNeckDepthRows,
      generated.debug.stitchesPerInch,
      generated.debug.rowsPerInch,
    );
    expect(finishing.neckbandPickup!.firstFrontStitches!).toBeGreaterThan(verticalOneFront);
  });

  it("asymmetric cardigan fronts remain independently calculated", () => {
    const pattern = sleevelessPattern("round", gauge(), "open");
    const generated = generateSleevelessBackPattern(pattern);
    const instruction = neckbandPickupInstructionFromDebug(
      "round",
      {
        ...generated.debug,
        firstFrontHorizontalStitches: 4,
        secondFrontHorizontalStitches: 7,
        firstFrontNeckEdgeRows: 19,
        secondFrontNeckEdgeRows: 23,
      },
      "cardigan",
    );
    expect(instruction).not.toBeNull();
    expect(instruction!.firstFrontStitches).not.toBe(instruction!.secondFrontStitches);
    expect(instruction!.primaryText).toBe(
      `Pick up approximately ${instruction!.firstFrontStitches} stitches along the first front neckline edge, ${instruction!.backStitches} stitches across the back neckline, and ${instruction!.secondFrontStitches} stitches along the second front neckline edge.`,
    );
  });

  it("Drop Shoulder round and V-neck cardigans use three-section wording", () => {
    for (const neckline of ["round", "v-neck"] as const) {
      const pattern = dropShoulderPattern(neckline, gauge(), "open");
      const generated = generateDropShoulderPattern(pattern);
      const finishing = sleevelessFinishingFromPattern(pattern, generated.debug);
      expect(finishing.isCardigan).toBe(true);
      expect(finishing.neckbandPickup!.garment).toBe("cardigan");
      expect(finishing.neckbandPickup!.primaryText).toMatch(
        /^Pick up approximately \d+ stitches along the first front neckline edge, \d+ stitches across the back neckline, and \d+ stitches along the second front neckline edge\.$/,
      );
    }
  });
});

describe("neckbandPickup — saved vs viewed / print parity", () => {
  it("regenerating from the same inputs yields identical pickup instructions", () => {
    for (const neckline of ["round", "v-neck"] as const) {
      for (const kind of ["sleeveless", "drop-shoulder"] as const) {
        for (const frontStyle of ["closed", "open"] as const) {
          const pattern =
            kind === "sleeveless"
              ? sleevelessPattern(neckline, gauge(), frontStyle)
              : dropShoulderPattern(neckline, gauge(), frontStyle);
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
          expect(
            neckbandPickupInstructionFromDebug(
              neckline,
              first.debug,
              frontStyle === "open" ? "cardigan" : "pullover",
            ),
          ).toEqual(a);

          if (a) {
            const viewHtml = buildSleevelessFinishingStepsHtml({
              isCardigan: frontStyle === "open",
              isDropShoulder: kind === "drop-shoulder",
              neckbandPickup: a,
              deps: finishingDeps,
            });
            const printHtml = buildSleevelessFinishingPrintListHtml({
              isCardigan: frontStyle === "open",
              isDropShoulder: kind === "drop-shoulder",
              neckbandPickup: a,
            });
            expect(viewHtml).toContain(a.primaryText);
            expect(printHtml).toContain(a.primaryText);
          }
        }
      }
    }
  });
});
