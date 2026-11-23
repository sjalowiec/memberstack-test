import { describe, expect, it } from "vitest";
import { generateDropShoulderPattern } from "./dropShoulderPatternOutput";
import {
  neckbandNeedleLimitWarning,
  positiveWholeNeedleCount,
} from "./legoBlocks/neckbandPickup";
import { withSetInSleeveConstructionAuthored } from "./setInSleeveConstructionIdentity";
import {
  calculateSetInSleeveSweater,
  type SetInSleeveSweaterSuccess,
} from "./setInSleeve/setInSleeveSweaterMath";
import {
  generateSetInSleeveInstructions,
  setInSleeveInstructionSection,
} from "./setInSleeve/setInSleeveInstructions";
import { generateSetInSleevePattern } from "./setInSleevePatternOutput";
import { computeDefaultMeasurementsFromChartRow } from "./sleevelessExpressSizeChartClient";
import type { ChartRow } from "./sleevelessExpressSizeChartTypes";
import { sleevelessFinishingFromPattern } from "./sleevelessPatternFinishing";
import {
  buildSleevelessFinishingPrintListHtml,
  buildSleevelessFinishingStepsHtml,
} from "./sleevelessPatternFinishingHtml";
import { generateSleevelessBackPattern } from "./sleevelessPatternOutput";

const finishingDeps = {
  escapeHtml: (s: string) => s,
  glossaryTooltip: (_id: number, term: string) => term,
  neckFinishingVideoKey: "onePieceBand",
  neckFinishingButtonLabel: "One-piece neckband",
  neckFinishingLeadHtml: "",
};

const MISSES: ChartRow = {
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

function gauge(availableNeedles: number) {
  return {
    gaugeStitchesPerInch: 5,
    gaugeRowsPerInch: 7,
    availableNeedles,
  };
}

function sleevelessPattern(availableNeedles: number) {
  return {
    fit: {
      selectedMeasurements: {
        finished_bust_chest: 40,
        back_neck_to_hem: 22,
        armhole_depth: 8,
        neck_opening: 6,
        shoulder_width: 4.25,
        front_neck_depth: 3,
        back_neck_depth: 1,
      },
    },
    style: { neckline: "round", frontStyle: "closed" },
    yarnGaugeMachine: gauge(availableNeedles),
  };
}

function dropShoulderPattern(availableNeedles: number) {
  return {
    fit: {
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
    style: {
      construction: "drop-shoulder",
      constructionAuthored: "drop-shoulder",
      frontStyle: "closed",
      neckline: "round",
    },
    yarnGaugeMachine: gauge(availableNeedles),
  };
}

function setInPattern(availableNeedles: number) {
  return {
    fit: {
      sizingChart: "misses",
      easeChoice: "standard",
      selectedMeasurements: computeDefaultMeasurementsFromChartRow(MISSES, "standard", {
        bodyShape: "straight",
      }),
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
    yarnGaugeMachine: gauge(availableNeedles),
  };
}

function renderedFinishing(
  pattern: Record<string, unknown>,
  generate: (patternData: Record<string, unknown>) => {
    debug: Parameters<typeof sleevelessFinishingFromPattern>[1];
  },
) {
  const finishing = sleevelessFinishingFromPattern(pattern, generate(pattern).debug);
  const pickup = finishing.neckbandPickup;
  if (!pickup) throw new Error("expected a calculated neckband");
  const view = {
    isCardigan: finishing.isCardigan,
    isDropShoulder: finishing.isDropShoulder,
    isSetInSleeve: finishing.isSetInSleeve,
    neckbandPickup: pickup,
    deps: finishingDeps,
  };
  return {
    pickup,
    html: buildSleevelessFinishingStepsHtml(view),
    print: buildSleevelessFinishingPrintListHtml(view),
  };
}

function sweater(availableNeedles: number): SetInSleeveSweaterSuccess {
  const result = calculateSetInSleeveSweater({
    chartAudience: "misses",
    chartRow: MISSES,
    stitchesPerInch: 5,
    rowsPerInch: 7,
    availableNeedles,
  });
  expect(result.ok, result.ok ? "" : result.message).toBe(true);
  if (!result.ok) throw new Error(result.message);
  return result;
}

describe("neckband needle-limit warning", () => {
  it("warns only when the calculated neckband exceeds the machine", () => {
    expect(positiveWholeNeedleCount("80")).toBe(80);
    expect(positiveWholeNeedleCount(80.5)).toBeNull();
    expect(neckbandNeedleLimitWarning(80, 81)).toBeNull();
    expect(neckbandNeedleLimitWarning(80, 80)).toBeNull();
    expect(neckbandNeedleLimitWarning(80, 79)).toBe(
      "The neckband needs 80 needles and the machine has 79.",
    );
    expect(neckbandNeedleLimitWarning(80, null)).toBeNull();
  });

  it("shows the warning on screen and in print for Sleeveless, Drop Shoulder, and Set-In Sleeve", () => {
    const builders = [
      { name: "sleeveless", pattern: sleevelessPattern, generate: generateSleevelessBackPattern },
      { name: "drop-shoulder", pattern: dropShoulderPattern, generate: generateDropShoulderPattern },
      { name: "set-in-sleeve", pattern: setInPattern, generate: generateSetInSleevePattern },
    ] as const;

    for (const builder of builders) {
      const probe = renderedFinishing(builder.pattern(400), builder.generate);
      const need = probe.pickup.pickupStitches;
      expect(need, builder.name).toBeGreaterThan(1);

      const below = renderedFinishing(builder.pattern(need + 1), builder.generate);
      const exact = renderedFinishing(builder.pattern(need), builder.generate);
      const above = renderedFinishing(builder.pattern(need - 1), builder.generate);
      const message = `The neckband needs ${need} needles and the machine has ${need - 1}.`;

      expect(below.pickup.needleLimitWarning, builder.name).toBeUndefined();
      expect(exact.pickup.needleLimitWarning, builder.name).toBeUndefined();
      expect(above.pickup.needleLimitWarning, builder.name).toBe(message);
      expect(below.pickup.pickupStitches, builder.name).toBe(need);
      expect(exact.pickup.pickupStitches, builder.name).toBe(need);
      expect(above.pickup.pickupStitches, builder.name).toBe(need);
      expect(above.pickup.primaryText, builder.name).toBe(below.pickup.primaryText);
      expect(above.pickup.estimateNoteText, builder.name).toBe(below.pickup.estimateNoteText);

      expect(below.html, builder.name).not.toContain("sg-pattern-soft-warning");
      expect(exact.html, builder.name).not.toContain("sg-pattern-soft-warning");
      expect(above.html, builder.name).toContain(
        `<p class="sg-pattern-soft-warning" role="status">${message}</p>`,
      );
      expect(above.html.match(/sg-pattern-soft-warning/g), builder.name).toHaveLength(1);
      expect(above.html.split(message).length - 1, builder.name).toBe(1);
      expect(above.html, builder.name).toContain(above.pickup.primaryText);

      expect(below.print, builder.name).not.toContain("print-warnings");
      expect(exact.print, builder.name).not.toContain("print-warnings");
      expect(above.print, builder.name).toContain(
        `<p class="print-warnings" role="status">${message}</p>`,
      );
      expect(above.print.match(/print-warnings/g), builder.name).toHaveLength(1);
      expect(above.print.split(message).length - 1, builder.name).toBe(1);
      expect(above.print, builder.name).toContain(above.pickup.primaryText);
      expect(above.print, builder.name).toContain("Work trim or neckband, finish as desired");
    }
  });

  it("reads the Set-In Sleeve needle count from the merged machine field", () => {
    const probe = renderedFinishing(setInPattern(400), generateSetInSleevePattern);
    const need = probe.pickup.pickupStitches;
    const { availableNeedles: _omit, ...gaugeOnly } = gauge(400);
    const pattern = {
      ...setInPattern(400),
      yarnGaugeMachine: gaugeOnly,
      machine: { availableNeedles: String(need - 1) },
    };
    const above = renderedFinishing(pattern, generateSetInSleevePattern);
    expect(above.pickup.pickupStitches).toBe(need);
    expect(above.pickup.primaryText).toBe(probe.pickup.primaryText);
    expect(above.html).toContain(
      `The neckband needs ${need} needles and the machine has ${need - 1}.`,
    );
    expect(above.print).toContain("print-warnings");
  });

  it("adds the same sentence to the Set-In Sleeve written instructions without changing the neckline", () => {
    const probe = sweater(400);
    const doc = generateSetInSleeveInstructions(probe);
    const pickupLine = setInSleeveInstructionSection(doc, "finishing")
      .split("\n")
      .find((line) => line.startsWith("Pick up approximately "));
    expect(pickupLine).toBeTruthy();
    const need = Number(pickupLine?.match(/\d+/)?.[0]);
    expect(need).toBeGreaterThan(1);

    const below = sweater(need + 1);
    const exact = sweater(need);
    const above = sweater(need - 1);
    const message = `The neckband needs ${need} needles and the machine has ${need - 1}.`;

    expect(below.body.neckline.openingStitches).toBe(probe.body.neckline.openingStitches);
    expect(exact.body.stitchesAtUnderarm).toBe(probe.body.stitchesAtUnderarm);
    expect(above.body.neckline.front.centerBindOff).toBe(probe.body.neckline.front.centerBindOff);
    expect(above.sleeve.upperArmStitches).toBe(probe.sleeve.upperArmStitches);

    const finishing = (value: SetInSleeveSweaterSuccess) =>
      setInSleeveInstructionSection(generateSetInSleeveInstructions(value), "finishing");
    const belowText = finishing(below);
    const exactText = finishing(exact);
    const aboveText = finishing(above);

    expect(belowText).toContain(pickupLine!);
    expect(exactText).toContain(pickupLine!);
    expect(aboveText).toContain(pickupLine!);
    expect(belowText).not.toContain("The neckband needs");
    expect(exactText).not.toContain("The neckband needs");
    expect(aboveText.split(message).length - 1).toBe(1);
    expect(aboveText.indexOf(message)).toBeGreaterThan(aboveText.indexOf(pickupLine!));
  });
});
