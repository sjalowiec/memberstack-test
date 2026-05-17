import { describe, expect, it, beforeEach, vi } from "vitest";
import { syncSleevelessDesignBasicsToPatternStorage } from "./syncSleevelessExpressDesignToStorage";
import { getCurrentPattern, PATTERN_STORAGE_KEY } from "./patternStorage";
import { readCustomBuildBodyFinishedMeasurements } from "./sleevelessCustomBuildBodyMeasurements";
import type { ChartRow } from "./sleevelessExpressSizeChartTypes";

describe("syncSleevelessDesignBasicsToPatternStorage", () => {
  const store: Record<string, string> = {};

  beforeEach(() => {
    for (const k of Object.keys(store)) delete store[k];
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => store[key] ?? null,
      setItem: (key: string, value: string) => {
        store[key] = value;
      },
      removeItem: (key: string) => {
        delete store[key];
      },
    });
  });

  it("seeds custom build measurements when chartRow and fit are provided", () => {
    const chartRow: ChartRow = {
      size: 6,
      bust_or_chest: 38,
      waist: 30,
      hip: 40,
    };

    syncSleevelessDesignBasicsToPatternStorage({
      who: "women",
      fit: "relaxed",
      selectedSize: "6",
      selectedMeasurements: { finished_bust_chest: 43 },
      chartRow,
    });

    const pattern = getCurrentPattern();
    expect(pattern.fit.selectedMeasurements).toEqual({ finished_bust_chest: 43 });
    expect(readCustomBuildBodyFinishedMeasurements(pattern)).toMatchObject({
      bodyBustOrChest: 38,
      bodyWaist: 30,
      bodyHip: 40,
      finishedBustOrChest: 43,
      finishedWaist: 43,
      finishedHip: 43,
    });
  });
});
