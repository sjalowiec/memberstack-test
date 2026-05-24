import { beforeEach, describe, expect, it, vi } from "vitest";
import { stubLocalStorage } from "./test/stubLocalStorage";
import {
  readActiveCustomPatternProjectId,
  writeActiveCustomPatternProjectId,
} from "./customPatternProjectActiveId";
import {
  getCurrentPattern,
  getPatternData,
  SLEEVELESS_EXPRESS_BUILDER_STORAGE_KEY,
  saveCurrentPattern,
} from "./patternStorage";
import {
  applyExpressGaugeNeedleEdits,
  readExpressGaugeInputSnapshot,
  resolveExpressGaugeFieldsForPersist,
  syncExpressWizardToPatternStorage,
} from "./syncExpressWizardToPatternStorage";
import { restoreSleevelessExpressBuilderFromPattern } from "./restoreSleevelessExpressBuilderFromPattern";
import type { SleevelessPatternRecord } from "./patternStorage";

function basePattern(spi = "7", needles = "200"): SleevelessPatternRecord {
  return {
    id: "p1",
    patternType: "sleeveless",
    status: "draft",
    version: 1,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    style: {
      recipientCategory: "misses",
      bodyShape: "straight",
      frontStyle: "closed",
      garmentStyle: "pullover",
      neckline: "round",
      patternMode: "express",
    },
    fit: { selectedSize: "M", easeChoice: "standard", sizingChart: "misses" },
    yarnGauge: { stitchGauge: spi, rowGauge: "8", gaugeStitchRaw: "28", gaugeRowRaw: "32", gaugeRawUnit: "in" },
    measurements: {},
    machine: { availableNeedles: needles },
    calculations: {},
    instructions: {},
    patternProject: { title: "Test", notes: "", titleCustomized: true },
  };
}

describe("syncExpressWizardToPatternStorage", () => {
  const domInputs = new Map<string, { value: string }>();

  beforeEach(() => {
    stubLocalStorage();
    writeActiveCustomPatternProjectId("proj-test");
    domInputs.clear();
    vi.stubGlobal("document", {
      getElementById: (id: string) => domInputs.get(id) ?? null,
      querySelector: () => null,
    });
  });

  it("writes edited gauge and needles from DOM into kbm_current_pattern", () => {
    saveCurrentPattern(basePattern("7", "200"));

    const stitch = { value: "24" };
    const row = { value: "32" };
    const needles = { value: "180" };
    domInputs.set("express-stitch-gauge", stitch);
    domInputs.set("express-row-gauge", row);
    domInputs.set("express-available-needles", needles);

    syncExpressWizardToPatternStorage(
      { who: "women", selectedSize: "M", front: "closed", neckline: "round", fit: "standard", style: "straight-pullover" },
      null,
    );

    const pattern = getCurrentPattern();
    const pb = getPatternData();
    const ygm = pb.yarnGaugeMachine as Record<string, unknown>;

    expect(String(pattern.yarnGauge.stitchGauge)).toBe("6");
    expect(ygm.availableNeedles).toBe("180");
    expect(ygm.gaugeStitchRaw).toBe("24");
  });

  it("uses builder snapshot when DOM is absent (review Build My Pattern path)", () => {
    saveCurrentPattern(basePattern("7", "200"));
    restoreSleevelessExpressBuilderFromPattern(getCurrentPattern(), getPatternData(), {
      editChoicesReopen: true,
    });

    localStorage.setItem(
      SLEEVELESS_EXPRESS_BUILDER_STORAGE_KEY,
      JSON.stringify({
        values: {
          who: "women",
          selectedSize: "M",
          front: "closed",
          neckline: "round",
          fit: "standard",
          style: "straight-pullover",
        },
        gaugeStitchRaw: "24",
        gaugeRowRaw: "32",
        availableNeedles: "180",
        editChoicesReopen: true,
        openStep: 5,
        maxReachable: 5,
        flowSteps: 5,
      }),
    );

    syncExpressWizardToPatternStorage(
      {
        who: "women",
        selectedSize: "M",
        front: "closed",
        neckline: "round",
        fit: "standard",
        style: "straight-pullover",
      },
      null,
      { preferDomGauge: false },
    );

    expect(String(getCurrentPattern().yarnGauge.stitchGauge)).toBe("6");
    expect(String((getPatternData().yarnGaugeMachine as Record<string, unknown>).availableNeedles)).toBe(
      "180",
    );
    expect(readActiveCustomPatternProjectId()).toBe("proj-test");
  });

  it("resolveExpressGaugeFieldsForPersist keeps builder gauge when DOM is empty (editChoices resume)", () => {
    saveCurrentPattern(basePattern("7", "200"));
    restoreSleevelessExpressBuilderFromPattern(getCurrentPattern(), getPatternData(), {
      editChoicesReopen: true,
    });

    localStorage.setItem(
      SLEEVELESS_EXPRESS_BUILDER_STORAGE_KEY,
      JSON.stringify({
        ...(JSON.parse(localStorage.getItem(SLEEVELESS_EXPRESS_BUILDER_STORAGE_KEY) ?? "{}") as object),
        gaugeStitchRaw: "24",
        gaugeRowRaw: "32",
        availableNeedles: "180",
      }),
    );

    const fields = resolveExpressGaugeFieldsForPersist();
    expect(fields.gaugeStitchRaw).toBe("24");
    expect(fields.availableNeedles).toBe("180");
  });

  it("applyExpressGaugeNeedleEdits matches acceptance path (saved 7 spi → edit 6 spi)", () => {
    saveCurrentPattern(basePattern("7", "200"));
    restoreSleevelessExpressBuilderFromPattern(getCurrentPattern(), getPatternData(), {
      editChoicesReopen: true,
    });

    const values = {
      who: "women",
      selectedSize: "M",
      front: "closed",
      neckline: "round",
      fit: "standard",
      style: "straight-pullover",
    };

    applyExpressGaugeNeedleEdits(values, {
      gaugeStitchRaw: "24",
      gaugeRowRaw: "32",
      availableNeedles: "180",
    });

    expect(String(getCurrentPattern().yarnGauge.stitchGauge)).toBe("6");
    expect(String((getPatternData().yarnGaugeMachine as Record<string, unknown>).availableNeedles)).toBe(
      "180",
    );
  });

  it("readExpressGaugeInputSnapshot prefers DOM over stale canonical pattern", () => {
    saveCurrentPattern(basePattern("7", "200"));

    domInputs.set("express-stitch-gauge", { value: "20" });
    domInputs.set("express-row-gauge", { value: "28" });

    const snap = readExpressGaugeInputSnapshot({ preferDom: true });
    expect(snap.gaugeStitchRaw).toBe("20");
    expect(snap.gaugeRowRaw).toBe("28");
  });
});
