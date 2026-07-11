import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildDropShoulderReviewDisplayIdentity,
  buildDropShoulderReviewMergedInches,
  clearDropShoulderReviewDiagramDirty,
  commitDropShoulderReviewDiagramHydration,
  DROP_SHOULDER_REVIEW_DIAGRAM_DIRTY_KEY,
  DROP_SHOULDER_REVIEW_DISPLAY_IDENTITY_KEY,
  DROP_SHOULDER_REVIEW_STALE_EVENT,
  forceRefreshDropShoulderSummaryMeasurements,
  forceRefreshDropShoulderSummaryMeasurementsForQuickEditSizing,
  isDropShoulderReviewDiagramStale,
  markDropShoulderReviewDiagramDirty,
  markDropShoulderReviewDiagramDirtyIfDisplayIdentityChanged,
  normalizeDropShoulderReviewDisplayIdentity,
  readDropShoulderReviewDiagramDirty,
  readDropShoulderReviewDisplayIdentity,
  resolveDropShoulderSummarySizingFromPattern,
} from "./dropShoulderReviewDiagramRefresh";
import { writeOverrideSeedSizingIdentity } from "./customBuildMeasurementOverrideReconcile";
import { diagramOverrideDefaultsFromChartRow } from "./customBuildMeasurementOverrideReconcile";
import { markDropShoulderSleeveFieldUserEdited } from "./dropShoulderUserEditedSleeveFields";
import { PATTERN_STORAGE_KEY, SLEEVELESS_EXPRESS_BUILDER_STORAGE_KEY } from "./patternStorage";
import type { ChartRow } from "./sleevelessExpressSizeChartTypes";

vi.mock("./sleevelessExpressSizeChartClient", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./sleevelessExpressSizeChartClient")>();
  const rows: Record<string, ChartRow> = {
    "1": {
      size: 1,
      bust_or_chest: 32,
      upper_arm: 9.75,
      wrist: 5.5,
      sleeve_length: 16,
      garment_back_length: 22,
      neck_opening: 6.5,
      front_neck_depth: 4,
    },
    "8": {
      size: 8,
      bust_or_chest: 42,
      upper_arm: 12.5,
      wrist: 6.25,
      sleeve_length: 17,
      garment_back_length: 25,
      neck_opening: 7.5,
      front_neck_depth: 5,
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
  upper_arm: 9.75,
  wrist: 5.5,
  sleeve_length: 16,
  garment_back_length: 22,
  neck_opening: 6.5,
  front_neck_depth: 4,
};

const size8Row: ChartRow = {
  size: 8,
  bust_or_chest: 42,
  upper_arm: 12.5,
  wrist: 6.25,
  sleeve_length: 17,
  garment_back_length: 25,
  neck_opening: 7.5,
  front_neck_depth: 5,
};

describe("dropShoulderReviewDiagramRefresh", () => {
  const store: Record<string, string> = {};
  let staleEventCount = 0;

  beforeEach(() => {
    for (const k of Object.keys(store)) delete store[k];
    staleEventCount = 0;
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => store[key] ?? null,
      setItem: (key: string, value: string) => {
        store[key] = value;
      },
      removeItem: (key: string) => {
        delete store[key];
      },
    });
    if (typeof document !== "undefined") {
      document.addEventListener(DROP_SHOULDER_REVIEW_STALE_EVENT, () => {
        staleEventCount += 1;
      });
    }
  });

  it("does not mark dirty when review has never hydrated (no stored identity)", () => {
    markDropShoulderReviewDiagramDirtyIfDisplayIdentityChanged(
      buildDropShoulderReviewDisplayIdentity("misses", "8", "standard"),
    );
    expect(readDropShoulderReviewDiagramDirty()).toBe(false);
    expect(staleEventCount).toBe(0);
  });

  it("marks dirty when display identity changes during size selection", () => {
    commitDropShoulderReviewDiagramHydration(
      buildDropShoulderReviewDisplayIdentity("misses", "1", "standard"),
    );
    expect(readDropShoulderReviewDiagramDirty()).toBe(false);

    markDropShoulderReviewDiagramDirtyIfDisplayIdentityChanged(
      buildDropShoulderReviewDisplayIdentity("misses", "8", "standard"),
    );
    expect(readDropShoulderReviewDiagramDirty()).toBe(true);
    expect(staleEventCount).toBe(0);
  });

  it("does not mark dirty again when display identity is unchanged", () => {
    commitDropShoulderReviewDiagramHydration(
      buildDropShoulderReviewDisplayIdentity("misses", "8", "standard"),
    );
    markDropShoulderReviewDiagramDirtyIfDisplayIdentityChanged(
      buildDropShoulderReviewDisplayIdentity("misses", "8", "standard"),
    );
    expect(readDropShoulderReviewDiagramDirty()).toBe(false);
  });

  it("isDropShoulderReviewDiagramStale is false before first review hydration", () => {
    const size8Identity = buildDropShoulderReviewDisplayIdentity("misses", "8", "standard");
    expect(isDropShoulderReviewDiagramStale(size8Identity)).toBe(false);
  });

  it("isDropShoulderReviewDiagramStale is true for dirty flag or identity drift", () => {
    const size8Identity = buildDropShoulderReviewDisplayIdentity("misses", "8", "standard");
    expect(isDropShoulderReviewDiagramStale(size8Identity)).toBe(false);

    commitDropShoulderReviewDiagramHydration(
      buildDropShoulderReviewDisplayIdentity("misses", "1", "standard"),
    );
    expect(isDropShoulderReviewDiagramStale(size8Identity)).toBe(true);

    markDropShoulderReviewDiagramDirty();
    expect(isDropShoulderReviewDiagramStale(size8Identity)).toBe(true);
    expect(staleEventCount).toBe(0);
  });

  it("markDropShoulderReviewDiagramDirty is idempotent and only notifies when asked", () => {
    markDropShoulderReviewDiagramDirty();
    markDropShoulderReviewDiagramDirty();
    expect(readDropShoulderReviewDiagramDirty()).toBe(true);
    expect(staleEventCount).toBe(0);

    markDropShoulderReviewDiagramDirty({ notify: true });
    expect(staleEventCount).toBe(0);
  });

  it("commitDropShoulderReviewDiagramHydration clears dirty and writes display identity + override seed", () => {
    markDropShoulderReviewDiagramDirty();
    const identity = buildDropShoulderReviewDisplayIdentity("misses", "8", "standard");
    commitDropShoulderReviewDiagramHydration(identity);

    expect(readDropShoulderReviewDiagramDirty()).toBe(false);
    expect(readDropShoulderReviewDisplayIdentity()).toEqual(identity);
    const blob = JSON.parse(store[SLEEVELESS_EXPRESS_BUILDER_STORAGE_KEY] ?? "{}") as Record<
      string,
      unknown
    >;
    expect(blob.cbMeasurementOverridesSizingIdentity).toEqual({
      chartAudience: "misses",
      selectedSize: "8",
    });
  });

  it("normalizes fit labels before compare", () => {
    const a = buildDropShoulderReviewDisplayIdentity("misses", "8", "Standard");
    const b = buildDropShoulderReviewDisplayIdentity("misses", "8", "standard");
    expect(normalizeDropShoulderReviewDisplayIdentity(a)).toEqual(
      normalizeDropShoulderReviewDisplayIdentity(b),
    );
    commitDropShoulderReviewDiagramHydration(a);
    expect(isDropShoulderReviewDiagramStale(b)).toBe(false);
  });

  it("buildDropShoulderReviewMergedInches refreshes chart-seeded values after Size 1 → Size 8", () => {
    writeOverrideSeedSizingIdentity({ chartAudience: "misses", selectedSize: "1" });
    const size1Defaults = diagramOverrideDefaultsFromChartRow(size1Row, "standard", "misses", {
      dropShoulder: true,
    });
    store[SLEEVELESS_EXPRESS_BUILDER_STORAGE_KEY] = JSON.stringify({
      cbMeasurementOverridesSizingIdentity: { chartAudience: "misses", selectedSize: "1" },
      cbMeasurementOverrides: size1Defaults,
    });

    const merged = buildDropShoulderReviewMergedInches({
      row: size8Row,
      selectedSize: "8",
      fitPreference: "standard",
      audience: "misses",
    });

    const size8Defaults = diagramOverrideDefaultsFromChartRow(size8Row, "standard", "misses", {
      dropShoulder: true,
    });
    expect(merged.upperArm).toBe(size8Defaults.upperArm);
    expect(merged.sleeveLength).toBe(size8Defaults.sleeveLength);
    expect(merged.wrist).toBe(size8Defaults.wrist);
    expect(merged.chestBust).toBe(size8Defaults.chestBust);
  });

  it("preserves deliberate user-edited upper arm when size changes", () => {
    writeOverrideSeedSizingIdentity({ chartAudience: "misses", selectedSize: "1" });
    store[SLEEVELESS_EXPRESS_BUILDER_STORAGE_KEY] = JSON.stringify({
      cbMeasurementOverridesSizingIdentity: { chartAudience: "misses", selectedSize: "1" },
      cbMeasurementOverrides: {
        ...diagramOverrideDefaultsFromChartRow(size1Row, "standard", "misses", {
          dropShoulder: true,
        }),
        upperArm: "13",
      },
    });
    markDropShoulderSleeveFieldUserEdited("upperArm");

    const merged = buildDropShoulderReviewMergedInches({
      row: size8Row,
      selectedSize: "8",
      fitPreference: "standard",
      audience: "misses",
    });

    expect(merged.upperArm).toBe("13");
    expect(merged.sleeveLength).toBe("17");
  });

  it("clearDropShoulderReviewDiagramDirty removes dirty key without touching display identity", () => {
    const identity = buildDropShoulderReviewDisplayIdentity("misses", "1", "standard");
    store[SLEEVELESS_EXPRESS_BUILDER_STORAGE_KEY] = JSON.stringify({
      [DROP_SHOULDER_REVIEW_DIAGRAM_DIRTY_KEY]: true,
      [DROP_SHOULDER_REVIEW_DISPLAY_IDENTITY_KEY]: identity,
    });
    clearDropShoulderReviewDiagramDirty();
    const blob = JSON.parse(store[SLEEVELESS_EXPRESS_BUILDER_STORAGE_KEY] ?? "{}") as Record<
      string,
      unknown
    >;
    expect(blob[DROP_SHOULDER_REVIEW_DIAGRAM_DIRTY_KEY]).toBeUndefined();
    expect(blob[DROP_SHOULDER_REVIEW_DISPLAY_IDENTITY_KEY]).toEqual(identity);
  });

  it("repeated dirty checks after commit do not re-mark dirty (no recursion driver)", () => {
    commitDropShoulderReviewDiagramHydration(
      buildDropShoulderReviewDisplayIdentity("misses", "8", "standard"),
    );
    for (let i = 0; i < 5; i += 1) {
      markDropShoulderReviewDiagramDirtyIfDisplayIdentityChanged(
        buildDropShoulderReviewDisplayIdentity("misses", "8", "standard"),
      );
    }
    expect(readDropShoulderReviewDiagramDirty()).toBe(false);
    expect(staleEventCount).toBe(0);
  });
});

describe("forceRefreshDropShoulderSummaryMeasurements", () => {
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

  it("reads canonical Size 8 pattern fit and refreshes stale Size 1 express overrides", () => {
    writeOverrideSeedSizingIdentity({ chartAudience: "misses", selectedSize: "1" });
    commitDropShoulderReviewDiagramHydration(
      buildDropShoulderReviewDisplayIdentity("misses", "1", "standard"),
    );
    store[SLEEVELESS_EXPRESS_BUILDER_STORAGE_KEY] = JSON.stringify({
      values: { who: "women", selectedSize: "1", fit: "standard" },
      cbMeasurementOverrides: {
        upperArm: "9.75",
        sleeveLength: "16.25",
        wrist: "5.25",
        chestBust: "35",
      },
    });
    store[PATTERN_STORAGE_KEY] = JSON.stringify({
      fit: {
        sizingChart: "misses",
        selectedSize: "8",
        easeChoice: "standard",
        selectedMeasurements: {
          upper_arm: 12.5,
          sleeve_length: 17,
          wrist: 6.25,
          finished_bust_chest: 45,
        },
        cbMeasurementOverrides: {
          upperArm: "9.75",
          sleeveLength: "16.25",
          wrist: "5.25",
        },
      },
      style: {
        recipientCategory: "misses",
        bodyShape: "straight",
        construction: "drop-shoulder",
      },
    });

    const sizing = resolveDropShoulderSummarySizingFromPattern();
    expect(sizing?.selectedSize).toBe("8");

    markDropShoulderReviewDiagramDirty();
    const refreshed = forceRefreshDropShoulderSummaryMeasurements();
    expect(refreshed).not.toBeNull();
    expect(refreshed!.selectedSize).toBe("8");
    // body 12.5 + Adult woman standard allowance 8.7 → finished 21.25.
    expect(refreshed!.merged.upperArm).toBe("21.25");
    expect(refreshed!.merged.sleeveLength).toBe("17");
    expect(refreshed!.merged.wrist).toBe("6.25");
    expect(refreshed!.resolvedUpperArmIn).toBe(21.25);
    expect(readDropShoulderReviewDiagramDirty()).toBe(false);
    expect(readDropShoulderReviewDisplayIdentity()?.selectedSize).toBe("8");
  });

  it("uses Quick edits Size 8 while canonical pattern fit is still Size 1 (pre-Update Pattern)", () => {
    writeOverrideSeedSizingIdentity({ chartAudience: "misses", selectedSize: "1" });
    store[SLEEVELESS_EXPRESS_BUILDER_STORAGE_KEY] = JSON.stringify({
      values: { who: "women", selectedSize: "1", fit: "standard" },
      cbMeasurementOverrides: {
        upperArm: "9.75",
        sleeveLength: "16.25",
        wrist: "5.25",
        chestBust: "35",
      },
    });
    store[PATTERN_STORAGE_KEY] = JSON.stringify({
      fit: {
        sizingChart: "misses",
        selectedSize: "1",
        easeChoice: "standard",
        cbMeasurementOverrides: {
          upperArm: "9.75",
          sleeveLength: "16.25",
          wrist: "5.25",
          chestBust: "35",
        },
      },
      style: {
        recipientCategory: "misses",
        bodyShape: "straight",
        construction: "drop-shoulder",
      },
    });

    expect(resolveDropShoulderSummarySizingFromPattern()?.selectedSize).toBe("1");

    const refreshed = forceRefreshDropShoulderSummaryMeasurementsForQuickEditSizing({
      audience: "misses",
      selectedSize: "8",
      fitPreference: "standard",
    });
    expect(refreshed).not.toBeNull();
    expect(refreshed!.selectedSize).toBe("8");
    // body 12.5 + Adult woman standard allowance 8.7 → finished 21.25.
    expect(refreshed!.merged.upperArm).toBe("21.25");
    expect(refreshed!.merged.sleeveLength).toBe("17");
    expect(refreshed!.merged.wrist).toBe("6.25");
    expect(refreshed!.resolvedUpperArmIn).toBe(21.25);
  });

  // Regression: editing a saved Drop Shoulder pattern and changing ONLY the fit (same size) must
  // recompute the system-default finished upper arm and repaint the summary SVG immediately, while
  // a manual upper-arm override stays put. Mirrors the edit-drawer fit-change → rehydrate path.
  describe("Drop Shoulder edit — change fit refreshes finished upper arm", () => {
    function seedSavedSize8Pattern(): void {
      writeOverrideSeedSizingIdentity({ chartAudience: "misses", selectedSize: "8" });
      commitDropShoulderReviewDiagramHydration(
        buildDropShoulderReviewDisplayIdentity("misses", "8", "standard"),
      );
      store[SLEEVELESS_EXPRESS_BUILDER_STORAGE_KEY] = JSON.stringify({
        ...(JSON.parse(store[SLEEVELESS_EXPRESS_BUILDER_STORAGE_KEY] ?? "{}") as Record<
          string,
          unknown
        >),
        values: { who: "women", selectedSize: "8", fit: "standard" },
        // Body upper arm 12.5 + Adult woman standard allowance 8.7 = finished 21.25 (as saved).
        cbMeasurementOverrides: { upperArm: "21.25", sleeveLength: "17", wrist: "6.25" },
      });
      store[PATTERN_STORAGE_KEY] = JSON.stringify({
        fit: {
          sizingChart: "misses",
          selectedSize: "8",
          easeChoice: "standard",
          cbMeasurementOverrides: { upperArm: "21.25", sleeveLength: "17", wrist: "6.25" },
        },
        style: { recipientCategory: "misses", bodyShape: "straight", construction: "drop-shoulder" },
      });
    }

    it("Standard → Close recomputes finished upper arm and updates the SVG label value", () => {
      seedSavedSize8Pattern();

      const refreshed = forceRefreshDropShoulderSummaryMeasurementsForQuickEditSizing({
        audience: "misses",
        selectedSize: "8",
        fitPreference: "close",
      });

      expect(refreshed).not.toBeNull();
      // body 12.5 + Adult woman close allowance 7.1 = 19.6 → finished 19.5 (rounded to ¼″).
      expect(refreshed!.merged.upperArm).toBe("19.5");
      expect(refreshed!.resolvedUpperArmIn).toBe(19.5);
      // The persisted (stored) value tracks the recomputed system default, not the old Standard one.
      const persisted = JSON.parse(store[SLEEVELESS_EXPRESS_BUILDER_STORAGE_KEY] ?? "{}") as {
        cbMeasurementOverrides?: Record<string, string>;
      };
      expect(persisted.cbMeasurementOverrides?.upperArm).toBe("19.5");
    });

    it("Standard → Relaxed recomputes the finished upper arm (Oversized allowance)", () => {
      seedSavedSize8Pattern();

      const refreshed = forceRefreshDropShoulderSummaryMeasurementsForQuickEditSizing({
        audience: "misses",
        selectedSize: "8",
        fitPreference: "relaxed",
      });

      expect(refreshed).not.toBeNull();
      // body 12.5 + Adult woman oversized allowance 10.2 → finished 22.75.
      expect(refreshed!.merged.upperArm).toBe("22.75");
      expect(refreshed!.resolvedUpperArmIn).toBe(22.75);
    });

    it("keeps a manually overridden upper arm unchanged when fit changes", () => {
      seedSavedSize8Pattern();
      // User hand-edited the upper arm during the review session, then changes fit afterward. The
      // manual value lives on BOTH the express blob and the canonical pattern fit (the canonical
      // draft wins last in loadMeasurementOverrides), mirroring how a real manual edit persists.
      const manualOverrides = { upperArm: "20", sleeveLength: "17", wrist: "6.25" };
      store[SLEEVELESS_EXPRESS_BUILDER_STORAGE_KEY] = JSON.stringify({
        ...(JSON.parse(store[SLEEVELESS_EXPRESS_BUILDER_STORAGE_KEY] ?? "{}") as Record<
          string,
          unknown
        >),
        cbMeasurementOverrides: manualOverrides,
      });
      store[PATTERN_STORAGE_KEY] = JSON.stringify({
        fit: {
          sizingChart: "misses",
          selectedSize: "8",
          easeChoice: "standard",
          cbMeasurementOverrides: manualOverrides,
        },
        style: { recipientCategory: "misses", bodyShape: "straight", construction: "drop-shoulder" },
      });
      markDropShoulderSleeveFieldUserEdited("upperArm");

      const refreshed = forceRefreshDropShoulderSummaryMeasurementsForQuickEditSizing({
        audience: "misses",
        selectedSize: "8",
        fitPreference: "close",
      });

      expect(refreshed).not.toBeNull();
      // Manual override survives the fit change — neither the SVG value nor the stored value moves.
      expect(refreshed!.merged.upperArm).toBe("20");
      expect(refreshed!.resolvedUpperArmIn).toBe(20);
      const persisted = JSON.parse(store[SLEEVELESS_EXPRESS_BUILDER_STORAGE_KEY] ?? "{}") as {
        cbMeasurementOverrides?: Record<string, string>;
      };
      expect(persisted.cbMeasurementOverrides?.upperArm).toBe("20");
    });
  });
});
