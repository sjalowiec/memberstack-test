import { beforeEach, describe, expect, it } from "vitest";
import { stubLocalStorage } from "./test/stubLocalStorage";
import { buildSavePayloadFromWorkingDraft } from "./customPatternProjectClient";
import {
  markDropShoulderSleeveFieldUserEdited,
  readDropShoulderUserEditedSleeveFields,
} from "./dropShoulderUserEditedSleeveFields";
import { resolveDropShoulderSleeveOverrideStrings } from "./dropShoulderSleeveMeasurementOverrides";
import { restoreSleevelessExpressBuilderFromPattern } from "./restoreSleevelessExpressBuilderFromPattern";
import { loadMeasurementOverrides, persistMeasurementOverrides } from "./sleevelessCustomMeasurementStorage";
import {
  PATTERN_STORAGE_KEY,
  type SleevelessPatternRecord,
} from "./patternStorage";
import type { ChartRow } from "./sleevelessExpressSizeChartTypes";

/** Misses size 7 ù body upper_arm 12 (finished standard = 12 + 8.7 = 20.75). */
const MISSES_7: ChartRow = {
  size: 7,
  bust_or_chest: 40,
  upper_arm: 12,
  wrist: 6,
  sleeve_length: 17,
};

function dropShoulderPattern(
  overrides: Partial<SleevelessPatternRecord> = {},
): SleevelessPatternRecord {
  return {
    id: "draft-ds-1",
    patternType: "sleeveless",
    status: "draft",
    version: 1,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    patternProject: { title: "DS Vest", notes: "", titleCustomized: true },
    style: {
      recipientCategory: "misses",
      bodyShape: "straight",
      frontStyle: "closed",
      garmentStyle: "pullover",
      neckline: "round",
      patternMode: "express",
      construction: "drop-shoulder",
      constructionAuthored: "drop-shoulder",
    },
    fit: {
      sizingChart: "misses",
      selectedSize: "7",
      easeChoice: "close",
      fitChoice: "close",
    },
    yarnGauge: { gaugeStitchRaw: "20", gaugeRowRaw: "28", gaugeRawUnit: "in" },
    measurements: {},
    machine: { availableNeedles: "200" },
    calculations: {},
    instructions: {},
    ...overrides,
  };
}

function writeCanonical(pattern: SleevelessPatternRecord): void {
  localStorage.setItem(PATTERN_STORAGE_KEY, JSON.stringify(pattern));
}

function fitOf(pattern: SleevelessPatternRecord): Record<string, unknown> {
  return (pattern.fit ?? {}) as Record<string, unknown>;
}

describe("Drop Shoulder user-edited sleeve fields ù persistence across save + reopen", () => {
  beforeEach(() => {
    stubLocalStorage();
  });

  it("1. saves the user-edited flag with the project and keeps the manual value in cbMeasurementOverrides", () => {
    writeCanonical(dropShoulderPattern());
    persistMeasurementOverrides({ upperArm: "15", wrist: "6", sleeveLength: "17" });
    markDropShoulderSleeveFieldUserEdited("upperArm");

    const payload = buildSavePayloadFromWorkingDraft("DS Vest", {
      skipFlushMeasurementOverrides: true,
    });

    const fit = fitOf(payload.pattern);
    const flags = fit.dropShoulderUserEditedSleeveFields as Record<string, boolean> | undefined;
    expect(flags?.upperArm).toBe(true);
    // Untouched fields must not be marked as custom (cuffCircumference is the wrist field's flag).
    expect(flags?.cuffCircumference).toBe(false);
    expect(flags?.sleeveLength).toBe(false);

    const cb = fit.cbMeasurementOverrides as Record<string, string> | undefined;
    expect(cb?.upperArm).toBe("15");
  });

  it("2-4. manual value survives reopen (fresh session), is not replaced, and persists across a fit change", () => {
    // --- Edit + Save (session A) ---
    writeCanonical(dropShoulderPattern());
    persistMeasurementOverrides({ upperArm: "15", wrist: "6", sleeveLength: "17" });
    markDropShoulderSleeveFieldUserEdited("upperArm");
    const payload = buildSavePayloadFromWorkingDraft("DS Vest", {
      skipFlushMeasurementOverrides: true,
    });

    // --- Fresh browser session (session B): nothing in localStorage ---
    stubLocalStorage();
    expect(readDropShoulderUserEditedSleeveFields().upperArm).toBe(false); // stale-free

    // --- Reopen: restore from the saved project (source of truth) ---
    writeCanonical(payload.pattern);
    const restored = restoreSleevelessExpressBuilderFromPattern(payload.pattern, {});
    expect(restored).toBe(true);
    expect(readDropShoulderUserEditedSleeveFields().upperArm).toBe(true);

    // 3. Reopening at the saved fit (close) does not replace the manual value.
    const atReopen = resolveDropShoulderSleeveOverrideStrings({
      overrides: loadMeasurementOverrides(),
      chartRow: MISSES_7,
      fitPreference: "close",
      chartAudience: "misses",
    });
    expect(atReopen.upperArm).toBe("15");

    // 4. Changing the fit (close ? standard) keeps the manual value.
    const afterFitChange = resolveDropShoulderSleeveOverrideStrings({
      overrides: loadMeasurementOverrides(),
      chartRow: MISSES_7,
      fitPreference: "standard",
      chartAudience: "misses",
    });
    expect(afterFitChange.upperArm).toBe("15");
  });

  it("5. a system-default upper arm (no flag) still recalculates after reopen when the fit changes", () => {
    // Saved project with NO user-edited metadata (system default upper arm).
    const pattern = dropShoulderPattern();
    writeCanonical(pattern);
    const restored = restoreSleevelessExpressBuilderFromPattern(pattern, {});
    expect(restored).toBe(true);
    expect(readDropShoulderUserEditedSleeveFields().upperArm).toBe(false);

    const close = resolveDropShoulderSleeveOverrideStrings({
      overrides: {},
      chartRow: MISSES_7,
      fitPreference: "close",
      chartAudience: "misses",
    });
    const standard = resolveDropShoulderSleeveOverrideStrings({
      overrides: {},
      chartRow: MISSES_7,
      fitPreference: "standard",
      chartAudience: "misses",
    });
    // body 12 + {7.1 close, 8.7 standard} ? 19.0 / 20.75.
    expect(close.upperArm).toBe("19");
    expect(standard.upperArm).toBe("20.75");
  });

  it("6. wrist manual-edit state also survives reopen", () => {
    writeCanonical(dropShoulderPattern());
    persistMeasurementOverrides({ upperArm: "15", wrist: "7", sleeveLength: "17" });
    markDropShoulderSleeveFieldUserEdited("upperArm");
    markDropShoulderSleeveFieldUserEdited("cuffCircumference"); // wrist's tracked field
    const payload = buildSavePayloadFromWorkingDraft("DS Vest", {
      skipFlushMeasurementOverrides: true,
    });

    const flags = fitOf(payload.pattern).dropShoulderUserEditedSleeveFields as Record<string, boolean>;
    expect(flags.upperArm).toBe(true);
    expect(flags.cuffCircumference).toBe(true);

    // Fresh session + reopen.
    stubLocalStorage();
    writeCanonical(payload.pattern);
    restoreSleevelessExpressBuilderFromPattern(payload.pattern, {});

    const reopenedFlags = readDropShoulderUserEditedSleeveFields();
    expect(reopenedFlags.upperArm).toBe(true);
    expect(reopenedFlags.cuffCircumference).toBe(true);

    // Manual wrist (7) is preserved even though chart wrist is 6.
    const resolved = resolveDropShoulderSleeveOverrideStrings({
      overrides: loadMeasurementOverrides(),
      chartRow: MISSES_7,
      fitPreference: "standard",
      chartAudience: "misses",
    });
    expect(resolved.wrist).toBe("7");
  });

  it("7. older saved projects without the metadata open safely (no crash, all-false flags)", () => {
    const legacy = dropShoulderPattern();
    // Ensure no metadata is present on the legacy fit.
    delete (legacy.fit as Record<string, unknown>).dropShoulderUserEditedSleeveFields;
    writeCanonical(legacy);

    expect(() => restoreSleevelessExpressBuilderFromPattern(legacy, {})).not.toThrow();
    expect(readDropShoulderUserEditedSleeveFields()).toEqual({
      upperArm: false,
      sleeveLength: false,
      cuffCircumference: false,
    });
  });

  it("8. Sleeveless (non-drop-shoulder) patterns never get the user-edited metadata", () => {
    const sleeveless = dropShoulderPattern({
      style: {
        recipientCategory: "misses",
        bodyShape: "straight",
        frontStyle: "closed",
        garmentStyle: "pullover",
        neckline: "round",
        patternMode: "express",
        // no construction / constructionAuthored ? sleeveless
      },
    });
    writeCanonical(sleeveless);
    persistMeasurementOverrides({ chestBust: "40" });
    // Even if a stale flag exists in the builder blob, a sleeveless save must not persist it.
    markDropShoulderSleeveFieldUserEdited("upperArm");

    const payload = buildSavePayloadFromWorkingDraft("Tank", {
      skipFlushMeasurementOverrides: true,
    });
    expect(fitOf(payload.pattern).dropShoulderUserEditedSleeveFields).toBeUndefined();
  });
});
