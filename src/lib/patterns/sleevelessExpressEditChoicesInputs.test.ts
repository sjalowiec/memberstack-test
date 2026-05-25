/**
 * Change Pattern Choices — express gauge/needle fields must be editable when reopening a saved project.
 * DOM wiring is in sleeveless-express-page.ts; these tests lock the session rules that unlock step 5.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { stubLocalStorage } from "./test/stubLocalStorage";
import {
  isExpressGaugeStepEditable,
  restoreSleevelessExpressBuilderFromPattern,
} from "./restoreSleevelessExpressBuilderFromPattern";
import { applyExpressGaugeNeedleEdits } from "./syncExpressWizardToPatternStorage";
import { loadExpressPersisted } from "./sleevelessExpressResume";
import {
  getCurrentPattern,
  getPatternData,
  saveCurrentPattern,
  type SleevelessPatternRecord,
} from "./patternStorage";

function minimalPattern(): SleevelessPatternRecord {
  return {
    id: "p1",
    patternType: "sleeveless",
    status: "draft",
    version: 1,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    style: { recipientCategory: "misses", patternMode: "express" },
    fit: { selectedSize: "M" },
    yarnGauge: { gaugeStitchRaw: "20", gaugeRowRaw: "26" },
    measurements: {},
    machine: { availableNeedles: "180" },
    calculations: {},
    instructions: {},
  };
}

describe("Change Pattern Choices input editability (session)", () => {
  beforeEach(() => {
    stubLocalStorage();
  });

  it("saved project → Change Pattern Choices → gauge step is reachable", () => {
    restoreSleevelessExpressBuilderFromPattern(minimalPattern(), {}, { editChoicesReopen: true });
    const persisted = loadExpressPersisted();
    expect(isExpressGaugeStepEditable(persisted, persisted?.values ?? {})).toBe(true);
    expect(persisted?.openStep).toBe(5);
  });

  it("incomplete resume without editChoices keeps gauge locked", () => {
    const values = { who: "women" };
    expect(isExpressGaugeStepEditable(null, values)).toBe(false);
  });

  it("simulated gauge/needle edit after editChoices updates canonical (7→6 spi, 200→180 needles)", () => {
    saveCurrentPattern({
      ...minimalPattern(),
      yarnGauge: {
        stitchGauge: "7",
        rowGauge: "8",
        gaugeStitchRaw: "28",
        gaugeRowRaw: "32",
        gaugeRawUnit: "in",
      },
      machine: { availableNeedles: "200" },
      style: {
        recipientCategory: "misses",
        bodyShape: "straight",
        frontStyle: "closed",
        garmentStyle: "pullover",
        neckline: "round",
        patternMode: "express",
      },
    });

    restoreSleevelessExpressBuilderFromPattern(getCurrentPattern(), getPatternData(), {
      editChoicesReopen: true,
    });

    const wizardValues = {
      who: "women",
      selectedSize: "M",
      front: "closed",
      neckline: "round",
      fit: "standard",
      style: "straight-pullover",
    };

    applyExpressGaugeNeedleEdits(wizardValues, {
      gaugeStitchRaw: "24",
      gaugeRowRaw: "32",
      availableNeedles: "180",
    });

    expect(String(getCurrentPattern().yarnGauge.stitchGauge)).toBe("6");
    expect(String((getPatternData().yarnGaugeMachine as Record<string, unknown>).availableNeedles)).toBe(
      "180",
    );
    const builder = loadExpressPersisted();
    expect(builder?.gaugeStitchRaw).toBe("24");
    expect(builder?.availableNeedles).toBe("180");
    expect(builder?.editChoicesReopen).toBe(true);
  });

  it("editChoices snapshot includes needle count for express page hydrate", () => {
    restoreSleevelessExpressBuilderFromPattern(minimalPattern(), {}, { editChoicesReopen: true });
    const persisted = loadExpressPersisted();
    expect(persisted?.availableNeedles).toBe("180");
    expect(persisted?.gaugeStitchRaw).toBe("20");
  });
});
