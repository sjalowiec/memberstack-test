import { describe, expect, it } from "vitest";
import { generateDropShoulderPattern } from "./dropShoulderPatternOutput";
import {
  neckbandNeedleLimitWarning,
  positiveWholeNeedleCount,
} from "./legoBlocks/neckbandPickup";
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
    neckbandPickup: pickup,
    deps: finishingDeps,
  };
  return {
    pickup,
    html: buildSleevelessFinishingStepsHtml(view),
    print: buildSleevelessFinishingPrintListHtml(view),
  };
}

describe("neckband needle-limit warning", () => {
  it("warns only when the calculated neckband exceeds the machine", () => {
    expect(positiveWholeNeedleCount("80")).toBe(80);
    expect(positiveWholeNeedleCount(80.5)).toBeNull();
    expect(neckbandNeedleLimitWarning(80, 81)).toBeNull();
    expect(neckbandNeedleLimitWarning(80, 80)).toBeNull();
    expect(neckbandNeedleLimitWarning(80, 79)).toBe(
      "Your neckband needs approximately 80 stitches, but your machine has 79 needles. Before you start knitting, adjust the neckline depth and check the updated count, or plan to knit the neckband in two pieces.",
    );
    expect(neckbandNeedleLimitWarning(80, null)).toBeNull();
  });

  it("shows the warning on screen and in print for Sleeveless and Drop Shoulder", () => {
    const builders = [
      { name: "sleeveless", pattern: sleevelessPattern, generate: generateSleevelessBackPattern },
      { name: "drop-shoulder", pattern: dropShoulderPattern, generate: generateDropShoulderPattern },
    ] as const;

    for (const builder of builders) {
      const probe = renderedFinishing(builder.pattern(400), builder.generate);
      const need = probe.pickup.pickupStitches;
      expect(need, builder.name).toBeGreaterThan(1);

      const below = renderedFinishing(builder.pattern(need + 1), builder.generate);
      const exact = renderedFinishing(builder.pattern(need), builder.generate);
      const above = renderedFinishing(builder.pattern(need - 1), builder.generate);
      const message = `Your neckband needs approximately ${need} stitches, but your machine has ${need - 1} needles. Before you start knitting, adjust the neckline depth and check the updated count, or plan to knit the neckband in two pieces.`;

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

  it("reads a merged machine needle count when the gauge entry has none", () => {
    const probe = renderedFinishing(sleevelessPattern(400), generateSleevelessBackPattern);
    const need = probe.pickup.pickupStitches;
    const { availableNeedles: _omit, ...gaugeOnly } = gauge(400);
    const pattern = {
      ...sleevelessPattern(400),
      yarnGaugeMachine: gaugeOnly,
      machine: { availableNeedles: String(need - 1) },
    };
    const above = renderedFinishing(pattern, generateSleevelessBackPattern);
    expect(above.pickup.pickupStitches).toBe(need);
    expect(above.pickup.primaryText).toBe(probe.pickup.primaryText);
    expect(above.html).toContain(
      `Your neckband needs approximately ${need} stitches, but your machine has ${need - 1} needles. Before you start knitting, adjust the neckline depth and check the updated count, or plan to knit the neckband in two pieces.`,
    );
    expect(above.print).toContain("print-warnings");
    expect(above.html.match(/sg-pattern-soft-warning/g)).toHaveLength(1);
  });
});
