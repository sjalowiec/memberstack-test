import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  diagramOverrideDefaultsFromChartRow,
  writeOverrideSeedSizingIdentity,
} from "./customBuildMeasurementOverrideReconcile";
import { SLEEVELESS_EXPRESS_BUILDER_STORAGE_KEY } from "./patternStorage";
import type { ChartRow } from "./sleevelessExpressSizeChartTypes";
import {
  applySleevelessEditSizeChangeChipValues,
  buildSleevelessEditSizeChangeMergedInches,
  SLEEVELESS_EDIT_SIZE_DEPENDENT_CHIP_KEYS,
  sleevelessEditMeasurementInputFromMerged,
} from "./sleevelessEditSizeChangeMeasurements";
import {
  buildSleevelessEditMeasurementDiagramSvg,
  resolveSleevelessEditMeasurementBodyShapeKind,
} from "./sleevelessEditMeasurementDiagramSvg";

vi.mock("./sleevelessExpressSizeChartClient", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./sleevelessExpressSizeChartClient")>();
  const rows: Record<string, ChartRow> = {
    "1": {
      size: 1,
      bust_or_chest: 32,
      hip: 32,
      upper_arm: 9.75,
      wrist: 5.5,
      sleeve_length: 16,
      garment_back_length: 22,
      neck_opening: 6.5,
      front_neck_depth: 4,
      armhole_depth: 7,
      shoulder_width: 4,
    },
    "8": {
      size: 8,
      bust_or_chest: 42,
      hip: 50,
      upper_arm: 12.5,
      wrist: 6.25,
      sleeve_length: 17,
      garment_back_length: 25,
      neck_opening: 7.5,
      front_neck_depth: 5,
      armhole_depth: 9,
      shoulder_width: 5,
    },
  };
  return {
    ...actual,
    findExpressChartRow: (_audience: string, sizeStr: string) => rows[sizeStr] ?? null,
  };
});

const size1Row: ChartRow = {
  size: 1,
  bust_or_chest: 32,
  hip: 32,
  garment_back_length: 22,
  neck_opening: 6.5,
  front_neck_depth: 4,
  armhole_depth: 7,
  shoulder_width: 4,
};

const size8Row: ChartRow = {
  size: 8,
  bust_or_chest: 42,
  hip: 50,
  garment_back_length: 25,
  neck_opening: 7.5,
  front_neck_depth: 5,
  armhole_depth: 9,
  shoulder_width: 5,
};

const store: Record<string, string> = {};

beforeEach(() => {
  for (const key of Object.keys(store)) delete store[key];
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

function sizeDefaults(row: ChartRow, bodyShape?: string): Record<string, string> {
  return diagramOverrideDefaultsFromChartRow(row, "standard", "misses", {
    bodyShape,
    dropShoulder: false,
  });
}

function changeSize(args: {
  to: ChartRow;
  fromSize: string;
  toSize: string;
  overrides: Record<string, string>;
  bodyShape?: string;
}) {
  writeOverrideSeedSizingIdentity({ chartAudience: "misses", selectedSize: args.fromSize });
  return buildSleevelessEditSizeChangeMergedInches({
    row: args.to,
    selectedSize: args.toSize,
    fitPreference: "standard",
    audience: "misses",
    bodyShape: args.bodyShape,
    oldSize: args.fromSize,
    overrides: args.overrides,
    persist: false,
  });
}

describe("Sleeveless Edit Pattern — Size-change measurement values", () => {
  it("opens on Size 1 with chips matching Size 1 chart defaults", () => {
    const defaults = sizeDefaults(size1Row);
    expect(defaults.chestBust).toBe("35");
    expect(defaults.hip).toBe("35");
    expect(defaults.finishedLength).toBe("22");
    expect(defaults.finishedNeckOpeningWidth).toBe("6.5");
    expect(defaults.neckDepth).toBe("4");
    expect(defaults.armholeDepth).toBe("7");
    expect(defaults.shoulderWidth).toBe("4");
    expect(defaults.hemDepth).toBe("2");
  });

  it("Size 1 → Size 8 refreshes chart-seeded overrides to Size 8 defaults", () => {
    const size1 = sizeDefaults(size1Row);
    const size8 = sizeDefaults(size8Row);
    const next = changeSize({
      to: size8Row,
      fromSize: "1",
      toSize: "8",
      overrides: { ...size1 },
    });

    for (const key of SLEEVELESS_EDIT_SIZE_DEPENDENT_CHIP_KEYS) {
      expect(next.merged[key], key).toBe(size8[key]);
    }
    expect(next.merged.chestBust).toBe("45");
    expect(next.merged.finishedLength).toBe("25");
    expect(next.merged.upperArm).toBeUndefined();
  });

  it("Size 8 → Size 1 returns chips to Size 1 defaults", () => {
    const size1 = sizeDefaults(size1Row);
    const size8 = sizeDefaults(size8Row);
    const next = changeSize({
      to: size1Row,
      fromSize: "8",
      toSize: "1",
      overrides: { ...size8 },
    });

    for (const key of SLEEVELESS_EDIT_SIZE_DEPENDENT_CHIP_KEYS) {
      expect(next.merged[key], key).toBe(size1[key]);
    }
    expect(next.merged.chestBust).toBe("35");
    expect(next.merged.finishedLength).toBe("22");
  });

  it("preserves a deliberate user edit and refreshes chart-seeded fields", () => {
    const size1 = sizeDefaults(size1Row);
    const size8 = sizeDefaults(size8Row);
    const next = changeSize({
      to: size8Row,
      fromSize: "1",
      toSize: "8",
      overrides: { ...size1, finishedLength: "28" },
    });

    expect(next.merged.finishedLength).toBe("28");
    expect(next.merged.chestBust).toBe(size8.chestBust);
    expect(next.merged.hip).toBe(size8.hip);
    expect(next.merged.armholeDepth).toBe(size8.armholeDepth);
  });

  it("updates generated SVG art from Size 8 measurements after Size 1 → Size 8", () => {
    const size1 = sizeDefaults(size1Row);
    const next = changeSize({
      to: size8Row,
      fromSize: "1",
      toSize: "8",
      overrides: { ...size1 },
    });
    const measurements = sleevelessEditMeasurementInputFromMerged(next.merged);
    expect(measurements.bustInches).toBe(45);
    expect(measurements.garmentLengthInches).toBe(25);
    expect(measurements.armholeDepthInches).toBe(9);

    const svg = buildSleevelessEditMeasurementDiagramSvg({
      measurements,
      patternData: { style: { neckline: "round", garmentStyle: "pullover" } },
      liveNeckline: "round",
      liveGarmentStyle: "pullover",
    });
    expect(svg).toContain('data-sleeveless-edit-diagram="true"');
    expect(svg).toContain('data-sleeveless-edit-neckline="round"');
    expect(svg).toContain('data-sleeveless-edit-garment="pullover"');
    expect(svg).toContain(`data-sleeveless-edit-body-shape="${resolveSleevelessEditMeasurementBodyShapeKind(45, 45)}"`);
  });

  it("reclassifies silhouette when a preserved hip no longer matches the new bust", () => {
    const size1 = sizeDefaults(size1Row);
    const next = changeSize({
      to: size8Row,
      fromSize: "1",
      toSize: "8",
      overrides: { ...size1, hip: "52" },
    });

    expect(next.merged.chestBust).toBe("45");
    expect(next.merged.hip).toBe("52");
    expect(resolveSleevelessEditMeasurementBodyShapeKind(35, 35)).toBe("straight");
    expect(
      resolveSleevelessEditMeasurementBodyShapeKind(
        Number(next.merged.chestBust),
        Number(next.merged.hip),
      ),
    ).toBe("aline");
  });

  it("uses A-line chart hip when the stored body shape is aline", () => {
    const size1 = sizeDefaults(size1Row, "aline");
    const size8 = sizeDefaults(size8Row, "aline");
    const next = changeSize({
      to: size8Row,
      fromSize: "1",
      toSize: "8",
      overrides: { ...size1 },
      bodyShape: "aline",
    });

    expect(next.merged.chestBust).toBe(size8.chestBust);
    expect(next.merged.hip).toBe(size8.hip);
    expect(Number(next.merged.hip)).toBeGreaterThan(Number(next.merged.chestBust));
    expect(
      resolveSleevelessEditMeasurementBodyShapeKind(
        Number(next.merged.chestBust),
        Number(next.merged.hip),
      ),
    ).toBe("aline");
  });

  it("writes existing chip values in place without replacing chip identity", () => {
    const size1 = sizeDefaults(size1Row);
    const size8 = sizeDefaults(size8Row);
    const chips = SLEEVELESS_EDIT_SIZE_DEPENDENT_CHIP_KEYS.map((key) => ({
      key,
      value: size1[key] ?? "",
    }));
    const sameChips = chips;

    const next = changeSize({
      to: size8Row,
      fromSize: "1",
      toSize: "8",
      overrides: { ...size1 },
    });
    const updated = applySleevelessEditSizeChangeChipValues(chips, next.merged);

    expect(updated).toBe(SLEEVELESS_EDIT_SIZE_DEPENDENT_CHIP_KEYS.length);
    expect(chips).toBe(sameChips);
    expect(chips.map((chip) => chip.value)).toEqual(
      SLEEVELESS_EDIT_SIZE_DEPENDENT_CHIP_KEYS.map((key) => size8[key]),
    );
  });

  it("falls back to oldSize when the override seed is missing", () => {
    store[SLEEVELESS_EXPRESS_BUILDER_STORAGE_KEY] = JSON.stringify({
      values: { who: "women", selectedSize: "8" },
    });
    const size1 = sizeDefaults(size1Row);
    const size8 = sizeDefaults(size8Row);
    const next = buildSleevelessEditSizeChangeMergedInches({
      row: size8Row,
      selectedSize: "8",
      fitPreference: "standard",
      audience: "misses",
      oldSize: "1",
      overrides: { ...size1 },
      persist: false,
    });
    expect(next.merged.chestBust).toBe(size8.chestBust);
    expect(next.merged.finishedLength).toBe(size8.finishedLength);
  });
});
