import { describe, expect, it, beforeEach, vi } from "vitest";
import {
  computeCustomBuildBodyFinishedFromChartRow,
  persistCustomBuildBodyFinishedMeasurements,
  readCustomBuildBodyFinishedMeasurements,
  reconcileStraightTorsoChartMeasurements,
  reconcileStraightTorsoOverridesAfterChartSync,
  reconcileStraightTorsoOverridesPreservingUserHip,
  seedCustomBuildBodyFinishedFromChartRow,
} from "./sleevelessCustomBuildBodyMeasurements";
import { getCurrentPattern, PATTERN_STORAGE_KEY } from "./patternStorage";
import type { ChartRow } from "./sleevelessExpressSizeChartTypes";

const sampleRow: ChartRow = {
  size: 4,
  bust_or_chest: 36,
  waist: 28,
  hip: 38,
};

describe("reconcileStraightTorsoChartMeasurements", () => {
  it("sets finished hip to bust for straight chart sync", () => {
    const m = reconcileStraightTorsoChartMeasurements({
      finished_bust_chest: 37,
      finished_hip: 43,
      finished_waist: 35,
    });
    expect(m.finished_hip).toBe(37);
  });
});

describe("reconcileStraightTorsoOverridesAfterChartSync", () => {
  it("clears stale hip override well above chart bust when bust override is absent", () => {
    const next = reconcileStraightTorsoOverridesAfterChartSync(37, { hip: "43" });
    expect(next.hip).toBe("37");
    expect(next.chestBust).toBe("37");
  });

  it("keeps edited chest and hip when both exceed chart bust", () => {
    const next = reconcileStraightTorsoOverridesAfterChartSync(33.5, {
      chestBust: "40",
      hip: "40",
    });
    expect(next.chestBust).toBe("40");
    expect(next.hip).toBe("40");
  });

  it("keeps hip slightly above bust within straight tolerance", () => {
    const next = reconcileStraightTorsoOverridesAfterChartSync(37, { hip: "37.2" });
    expect(next.hip).toBe("37.2");
  });
});

describe("reconcileStraightTorsoOverridesPreservingUserHip", () => {
  it("keeps stored hip 43 when strict reconcile would reset to bust 40", () => {
    const next = reconcileStraightTorsoOverridesPreservingUserHip(40, {
      chestBust: "40",
      hip: "43",
    });
    expect(next.hip).toBe("43");
  });
});

describe("computeCustomBuildBodyFinishedFromChartRow", () => {
  it("derives body from chart and applies standard ease to finished bust", () => {
    const m = computeCustomBuildBodyFinishedFromChartRow(sampleRow, "standard");
    expect(m.bodyBustOrChest).toBe(36);
    expect(m.bodyWaist).toBe(28);
    expect(m.bodyHip).toBe(38);
    expect(m.finishedBustOrChest).toBe(39);
    expect(m.finishedWaist).toBe(39);
    expect(m.finishedHip).toBe(39);
  });

  it("uses bust for body hip when chart hip is missing", () => {
    const row: ChartRow = { bust_or_chest: 34, waist: 26 };
    const m = computeCustomBuildBodyFinishedFromChartRow(row, "close");
    expect(m.bodyHip).toBe(34);
    expect(m.finishedBustOrChest).toBe(35);
  });

  it("uses chart hip + ease for finished hip when body shape is A-line", () => {
    const m = computeCustomBuildBodyFinishedFromChartRow(sampleRow, "standard", {
      bodyShape: "aline",
    });
    expect(m.finishedBustOrChest).toBe(39);
    expect(m.finishedHip).toBe(41);
  });
});

describe("custom build measurements persistence", () => {
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

  it("stores finished overrides in measurements without changing fit.selectedMeasurements", () => {
    store[PATTERN_STORAGE_KEY] = JSON.stringify({
      id: "test-id",
      patternType: "sleeveless",
      status: "draft",
      version: 1,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      style: {},
      fit: {
        selectedMeasurements: { finished_bust_chest: 40, finished_waist: 38 },
      },
      yarnGauge: {},
      measurements: {},
      machine: {},
      calculations: {},
      instructions: {},
    });

    seedCustomBuildBodyFinishedFromChartRow(sampleRow, "standard", { preserveFinished: false });
    const afterSeed = getCurrentPattern();
    expect(afterSeed.fit.selectedMeasurements).toEqual({
      finished_bust_chest: 40,
      finished_waist: 38,
    });
    expect(readCustomBuildBodyFinishedMeasurements(afterSeed).finishedBustOrChest).toBe(39);

    persistCustomBuildBodyFinishedMeasurements(
      { finishedBustOrChest: 41, finishedWaist: 41, finishedHip: 41 },
      { preserveFinished: false, refreshBody: false },
    );
    const afterEdit = getCurrentPattern();
    expect(afterEdit.fit.selectedMeasurements).toEqual({
      finished_bust_chest: 40,
      finished_waist: 38,
    });
    expect(readCustomBuildBodyFinishedMeasurements(afterEdit)).toMatchObject({
      finishedBustOrChest: 41,
      finishedWaist: 41,
      finishedHip: 41,
    });
  });

  it("preserveFinished keeps user-edited finished values on re-seed", () => {
    store[PATTERN_STORAGE_KEY] = JSON.stringify({
      id: "test-id-2",
      patternType: "sleeveless",
      status: "draft",
      version: 1,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      style: {},
      fit: {},
      yarnGauge: {},
      measurements: { finishedBustOrChest: 42 },
      machine: {},
      calculations: {},
      instructions: {},
    });

    seedCustomBuildBodyFinishedFromChartRow(sampleRow, "standard", { preserveFinished: true });
    expect(readCustomBuildBodyFinishedMeasurements().finishedBustOrChest).toBe(42);
    expect(readCustomBuildBodyFinishedMeasurements().bodyBustOrChest).toBe(36);
  });
});
