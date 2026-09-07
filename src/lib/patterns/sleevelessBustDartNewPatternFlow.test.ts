import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  CUSTOM_BUILD_STYLE_STORAGE_KEYS,
  syncCustomBuildToPatternStorage,
} from "./syncCustomBuildToPatternStorage";
import {
  getCurrentPattern,
  getPatternData,
  saveCurrentPattern,
  savePatternData,
  SLEEVELESS_EXPRESS_BUILDER_STORAGE_KEY,
} from "./patternStorage";
import { generateSleevelessBackPattern } from "./sleevelessPatternOutput";
import { BUST_DART_STYLE_KEY } from "./legoBlocks/bustDart";
import {
  isPatternEligibleForBustDartAction,
  writeBustDartConfigToWorkingDraft,
} from "./bustDartPatternCustomization";
import { renderBustDartCustomizationScreenHtml } from "./bustDartFrontSlotHtml";
import type { SleevelessPatternDisplayRow } from "./sleevelessPatternOutput";

const ENABLED_DART = {
  enabled: true,
  cupSize: "C",
  dartWidthInches: 3.25,
  dartDepthInches: 1,
} as const;

function womenFit(overrides: Record<string, unknown> = {}) {
  return {
    sizingChart: "misses",
    selectedMeasurements: {
      finished_bust_chest: 40,
      back_neck_to_hem: 22,
      armhole_depth: 8,
      neck_opening: 6,
      shoulder_width: 12,
      front_neck_depth: 3,
      back_neck_depth: 1,
      ...overrides,
    },
  };
}

function gauge() {
  return { gaugeStitchesPerInch: 5, gaugeRowsPerInch: 7, availableNeedles: 200 };
}

function womenPattern(style: Record<string, unknown> = {}, fitOverrides: Record<string, unknown> = {}) {
  return {
    fit: womenFit(fitOverrides),
    style: {
      recipientCategory: "misses",
      neckline: "round",
      frontStyle: "closed",
      garmentStyle: "pullover",
      ...style,
    },
    yarnGaugeMachine: gauge(),
  };
}

function slotOf(rows: readonly SleevelessPatternDisplayRow[]) {
  return rows.find((row) => row.kind === "bustDartCustomization");
}

describe("sleeveless new-pattern bust dart choice", () => {
  it("new women’s Round Neck Pullover offers Add Bust Dart and generates an enabled dart", () => {
    const off = generateSleevelessBackPattern(womenPattern());
    const offSlot = slotOf(off.frontDisplayRows);
    expect(offSlot?.kind).toBe("bustDartCustomization");
    if (offSlot?.kind !== "bustDartCustomization") return;
    expect(offSlot.active).toBe(false);
    const offHtml = renderBustDartCustomizationScreenHtml(offSlot);
    expect(offHtml).toMatch(/Add Bust Dart/);
    expect(offHtml).not.toMatch(/data-tip-id=/);

    const on = generateSleevelessBackPattern(
      womenPattern({ [BUST_DART_STYLE_KEY]: ENABLED_DART }),
    );
    const onSlot = slotOf(on.frontDisplayRows);
    expect(onSlot?.kind).toBe("bustDartCustomization");
    if (onSlot?.kind !== "bustDartCustomization") return;
    expect(onSlot.active).toBe(true);
    expect(onSlot.instructionParagraphs.join("\n")).toMatch(/Stop the row counter at RC/i);
    expect(onSlot.cupSize).toBe("C");
  });

  it("new women’s V-neck Pullover offers Add Bust Dart and generates an enabled dart", () => {
    const off = generateSleevelessBackPattern(womenPattern({ neckline: "v-neck" }));
    const offSlot = slotOf(off.frontDisplayRows);
    expect(offSlot?.kind).toBe("bustDartCustomization");
    if (offSlot?.kind !== "bustDartCustomization") return;
    expect(offSlot.active).toBe(false);
    expect(renderBustDartCustomizationScreenHtml(offSlot)).toMatch(/Add Bust Dart/);

    const on = generateSleevelessBackPattern(
      womenPattern({ neckline: "v-neck", [BUST_DART_STYLE_KEY]: ENABLED_DART }),
    );
    const onSlot = slotOf(on.frontDisplayRows);
    expect(onSlot?.kind).toBe("bustDartCustomization");
    if (onSlot?.kind !== "bustDartCustomization") return;
    expect(onSlot.active).toBe(true);
    expect(onSlot.instructionParagraphs.join("\n")).toMatch(/Stop the row counter at RC/i);
  });

  it("eligible V-neck Cardigan preserves and generates the dart", () => {
    const on = generateSleevelessBackPattern(
      womenPattern({
        neckline: "v-neck",
        garmentStyle: "cardigan",
        frontStyle: "open",
        [BUST_DART_STYLE_KEY]: ENABLED_DART,
      }),
    );
    const slot = slotOf(on.frontDisplayRows);
    expect(slot?.kind).toBe("bustDartCustomization");
    if (slot?.kind !== "bustDartCustomization") return;
    expect(slot.active).toBe(true);
    expect(slot.instructionParagraphs.join("\n")).toMatch(/Stop the row counter at RC/i);
    expect(slot.instructionParagraphs.join("\n")).toMatch(/side \(armhole\) edge/i);
  });

  it("deep V-neck (before-armhole) still offers the dart choice and keeps an enabled dart", () => {
    const fit = { front_neck_depth: 11, armhole_depth: 9, back_neck_to_hem: 28 };
    const off = generateSleevelessBackPattern(womenPattern({ neckline: "v-neck" }, fit));
    expect(off.debug.frontVNeckShapingTimingCase).toBe("before-armhole");
    expect(slotOf(off.frontDisplayRows)?.kind).toBe("bustDartCustomization");

    const on = generateSleevelessBackPattern(
      womenPattern({ neckline: "v-neck", [BUST_DART_STYLE_KEY]: ENABLED_DART }, fit),
    );
    const slot = slotOf(on.frontDisplayRows);
    expect(slot?.kind).toBe("bustDartCustomization");
    if (slot?.kind !== "bustDartCustomization") return;
    expect(slot.active).toBe(true);
    expect(slot.instructionParagraphs.length).toBeGreaterThan(0);
  });

  it("Make a Copy of a dart-enabled pattern still generates the dart", () => {
    const original = womenPattern({ [BUST_DART_STYLE_KEY]: ENABLED_DART });
    const copied = structuredClone(original);
    expect((copied.style as Record<string, unknown>)[BUST_DART_STYLE_KEY]).toEqual(ENABLED_DART);
    const gen = generateSleevelessBackPattern(copied);
    const slot = slotOf(gen.frontDisplayRows);
    expect(slot?.kind === "bustDartCustomization" && slot.active).toBe(true);
  });

  it("ineligible audiences do not receive the option", () => {
    for (const audience of ["men", "kids", "baby"] as const) {
      const r = generateSleevelessBackPattern({
        fit: { sizingChart: audience, selectedMeasurements: womenFit().selectedMeasurements },
        style: {
          recipientCategory: audience,
          neckline: "round",
          [BUST_DART_STYLE_KEY]: ENABLED_DART,
        },
        yarnGaugeMachine: gauge(),
      });
      expect(slotOf(r.frontDisplayRows)).toBeUndefined();
      expect(isPatternEligibleForBustDartAction(r as unknown as Record<string, unknown>)).toBe(
        false,
      );
    }
  });

  it("stale leftover men’s sizingChart does not hide darts when the design is women’s", () => {
    const pattern = {
      fit: { sizingChart: "men", selectedMeasurements: womenFit().selectedMeasurements },
      style: {
        recipientCategory: "misses",
        neckline: "round",
        [BUST_DART_STYLE_KEY]: ENABLED_DART,
      },
      yarnGaugeMachine: gauge(),
    };
    expect(isPatternEligibleForBustDartAction(pattern)).toBe(true);
    const gen = generateSleevelessBackPattern(pattern);
    const slot = slotOf(gen.frontDisplayRows);
    expect(slot?.kind === "bustDartCustomization" && slot.active).toBe(true);
  });
});

describe("sleeveless bust dart survives unrelated edits", () => {
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
      clear: () => {
        for (const k of Object.keys(store)) delete store[k];
      },
    });
  });

  it("sync after leftover wizard pullover does not remove a saved dart", () => {
    localStorage.setItem(
      SLEEVELESS_EXPRESS_BUILDER_STORAGE_KEY,
      JSON.stringify({
        values: {
          who: "women",
          selectedSize: "M",
          fit: "standard",
          neckline: "v-neck",
          front: "closed",
          style: "straight-pullover",
        },
      }),
    );
    localStorage.setItem(CUSTOM_BUILD_STYLE_STORAGE_KEYS.bodyShape, "straight");
    localStorage.setItem(CUSTOM_BUILD_STYLE_STORAGE_KEYS.garmentType, "pullover");
    saveCurrentPattern({
      style: {
        patternMode: "custom-build",
        garmentStyle: "cardigan",
        frontStyle: "open",
        neckline: "v",
        recipientCategory: "misses",
        [BUST_DART_STYLE_KEY]: ENABLED_DART,
      },
    });
    savePatternData("style", {
      patternMode: "custom-build",
      garmentStyle: "cardigan",
      frontStyle: "open",
      neckline: "v",
      recipientCategory: "misses",
      [BUST_DART_STYLE_KEY]: ENABLED_DART,
    });

    syncCustomBuildToPatternStorage({ awaitCharts: false });

    expect(getCurrentPattern().style?.bustDart).toEqual(ENABLED_DART);
    expect(getPatternData().style?.bustDart).toEqual(ENABLED_DART);
    expect(getCurrentPattern().style?.garmentStyle).toBe("cardigan");

    const gen = generateSleevelessBackPattern({
      ...getCurrentPattern(),
      yarnGaugeMachine: gauge(),
      fit: {
        ...(getCurrentPattern().fit ?? {}),
        selectedMeasurements: womenFit().selectedMeasurements,
      },
    });
    const slot = slotOf(gen.frontDisplayRows);
    expect(slot?.kind === "bustDartCustomization" && slot.active).toBe(true);
  });

  it("changing neckline on a working draft keeps the saved dart", () => {
    saveCurrentPattern({
      style: {
        recipientCategory: "misses",
        neckline: "round",
        garmentStyle: "pullover",
        frontStyle: "closed",
        [BUST_DART_STYLE_KEY]: ENABLED_DART,
      },
    });
    writeBustDartConfigToWorkingDraft({ ...ENABLED_DART });
    saveCurrentPattern({ style: { neckline: "v" } });
    expect(getCurrentPattern().style?.bustDart).toEqual(ENABLED_DART);
    expect(getCurrentPattern().style?.neckline).toBe("v");
  });
});
