/**
 * Regression — Edit Pattern SAVE path in centimeters (not just helper-level conversion).
 *
 * Reproduces the reported live bug: entering cm values in Edit Pattern and saving stored a
 * quarter-inch-SNAPPED canonical value, so reopening showed a shrunk cm number:
 *   Neck Opening 16 cm  -> reopened 15.9 cm  (== 6.25 in, snapped)
 *   Armhole Depth 10 cm -> reopened 10.2 cm  (== 4 in, snapped)
 *   Bust Circumference 44 cm -> reopened 43.8 cm (== 17.25 in, snapped)
 *
 * These tests drive the ACTUAL editor save preparation: the diagram-input flush the drawer runs on
 * Save (`flushCustomBuildMeasurementOverridesToCanonical`) followed by the API payload builder
 * (`buildSavePayloadFromWorkingDraft`) — the object the workspace sends to persist the project.
 * They assert the canonical inches are the true physical width (never quarter-snapped) and that a
 * reopen re-displays the exact cm the user typed. Inch entries must keep quarter-inch behavior.
 */
import { beforeEach, describe, expect, it } from "vitest";
import {
  buildSavePayloadFromWorkingDraft,
} from "./customPatternProjectClient";
import {
  flushCustomBuildMeasurementOverridesToCanonical,
} from "./sleevelessCustomMeasurementStorage";
import { formatMeasurementDisplayFromInches } from "./patternMeasurementDisplayUnit";
import {
  saveCurrentPattern,
  savePatternData,
} from "./patternStorage";
import { stubLocalStorage } from "./test/stubLocalStorage";

const IN_TO_CM = 2.54;

/** Diagram-input flush root (no jsdom), mirroring `[data-cb-measure-input]` fields with NO unit chip
 *  so the flush must resolve the unit from the saved pattern (the Edit workspace fallback). */
function measureFlushRoot(values: Record<string, string>): ParentNode {
  const inputs = new Map(
    Object.entries(values).map(([key, value]) => [
      key,
      { value, trim: () => value.trim() } as HTMLInputElement,
    ]),
  );
  const root = {
    querySelector(sel: string) {
      if (sel === "[data-cb-measure-root]") return root;
      const match = /data-cb-measure-input="([^"]+)"/.exec(sel);
      return match ? (inputs.get(match[1]) ?? null) : null;
    },
    querySelectorAll: () => [],
  };
  return root as unknown as ParentNode;
}

/** Seed a saved custom-build working draft with a persisted build unit (`gaugeRawUnit`). */
function seedSavedProject(unit: "in" | "cm", family: "sleeveless" | "drop-shoulder"): void {
  const gauge = { gaugeStitchRaw: "20", gaugeRowRaw: "26", gaugeRawUnit: unit };
  const style = {
    patternMode: "custom-build",
    recipientCategory: "misses",
    constructionFamily: family === "drop-shoulder" ? "drop-shoulder" : undefined,
    bodyShape: "straight",
    garmentStyle: "pullover",
    neckline: "round",
  };
  const fit = {
    selectedSize: "M",
    sizingChart: "misses",
    selectedMeasurements: { finished_bust_chest: 40, neck_width: 6, armhole_depth: 8 },
    cbMeasurementOverrides: { chestBust: "40", armholeDepth: "8", finishedNeckOpeningWidth: "6", hemDepth: "2" },
  };
  saveCurrentPattern({ style, fit, yarnGauge: gauge, yarnGaugeMachine: { ...gauge, availableNeedles: "200" } } as never);
  savePatternData("style", style);
  savePatternData("fit", fit);
  savePatternData("yarnGauge", gauge);
  savePatternData("yarnGaugeMachine", { ...gauge, availableNeedles: "200" });
}

function payloadOverride(
  payload: ReturnType<typeof buildSavePayloadFromWorkingDraft>,
  key: string,
): number {
  const fit = payload.pattern.fit as Record<string, unknown>;
  const cb = (fit.cbMeasurementOverrides ?? {}) as Record<string, string>;
  return Number(cb[key]);
}

describe.each(["sleeveless", "drop-shoulder"] as const)(
  "Edit Pattern cm save path — %s",
  (family) => {
    beforeEach(() => {
      stubLocalStorage();
      localStorage.clear();
    });

    it("saves cm neck/armhole/bust as true physical inches (no quarter-inch snap) and reopens unchanged", () => {
      seedSavedProject("cm", family);

      // Save: flush the diagram inputs the way the drawer does. No DOM unit chip is present, so the
      // save unit is resolved from the saved pattern (cm) — the previously missed Edit Pattern path.
      const root = measureFlushRoot({
        finishedNeckOpeningWidth: "16",
        armholeDepth: "10",
        chestBust: "44",
      });
      flushCustomBuildMeasurementOverridesToCanonical({ root });

      const payload = buildSavePayloadFromWorkingDraft("Edit cm test", {
        skipFlushMeasurementOverrides: true,
      });

      const neck = payloadOverride(payload, "finishedNeckOpeningWidth");
      const armhole = payloadOverride(payload, "armholeDepth");
      const bust = payloadOverride(payload, "chestBust");

      // Canonical inches are the real physical width — NOT 6.25 / 4 / 17.25.
      expect(neck).toBeCloseTo(16 / IN_TO_CM, 3);
      expect(armhole).toBeCloseTo(10 / IN_TO_CM, 3);
      expect(bust).toBeCloseTo(44 / IN_TO_CM, 3);
      expect(neck).not.toBe(6.25);
      expect(armhole).not.toBe(4);
      expect(bust).not.toBe(17.25);

      // Reopen: each field re-displays exactly the cm the user typed (15.9/10.2/43.8 was the bug).
      expect(formatMeasurementDisplayFromInches(neck, "cm")).toBe("16");
      expect(formatMeasurementDisplayFromInches(armhole, "cm")).toBe("10");
      expect(formatMeasurementDisplayFromInches(bust, "cm")).toBe("44");
    });

    it("explicit unit from the drawer save also preserves physical width", () => {
      seedSavedProject("cm", family);
      const root = measureFlushRoot({ finishedNeckOpeningWidth: "16" });
      // The drawer now passes its active unit explicitly on Save.
      flushCustomBuildMeasurementOverridesToCanonical({ root, displayUnit: "cm" });
      const payload = buildSavePayloadFromWorkingDraft("Edit cm test", {
        skipFlushMeasurementOverrides: true,
      });
      expect(payloadOverride(payload, "finishedNeckOpeningWidth")).toBeCloseTo(16 / IN_TO_CM, 3);
    });

    it("inch entries keep quarter-inch behavior on the same save path", () => {
      seedSavedProject("in", family);
      const root = measureFlushRoot({
        finishedNeckOpeningWidth: "6.3",
        armholeDepth: "8.1",
        chestBust: "44",
      });
      flushCustomBuildMeasurementOverridesToCanonical({ root });
      const payload = buildSavePayloadFromWorkingDraft("Edit in test", {
        skipFlushMeasurementOverrides: true,
      });
      // Inch inputs use the quarter-inch grid (unchanged): 6.3 -> 6.25, 8.1 -> 8, 44 -> 44.
      expect(payloadOverride(payload, "finishedNeckOpeningWidth")).toBe(6.25);
      expect(payloadOverride(payload, "armholeDepth")).toBe(8);
      expect(payloadOverride(payload, "chestBust")).toBe(44);
    });
  },
);
