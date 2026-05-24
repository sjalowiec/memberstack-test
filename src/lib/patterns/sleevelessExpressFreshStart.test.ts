import { beforeEach, describe, expect, it } from "vitest";
import {
  CUSTOM_PATTERN_ACTIVE_PROJECT_ID_KEY,
  readActiveCustomPatternProjectId,
  writeActiveCustomPatternProjectId,
} from "./customPatternProjectActiveId";
import {
  buildSleevelessExpressNewPatternHref,
  getCurrentPattern,
  getPatternData,
  PATTERN_BUILDER_DATA_KEY,
  PATTERN_STORAGE_KEY,
  SLEEVELESS_EXPRESS_BUILDER_STORAGE_KEY,
  SLEEVELESS_EXPRESS_NEW_SESSION_PARAM,
  SLEEVELESS_EXPRESS_NEW_SESSION_VALUE,
} from "./patternStorage";
import { loadMeasurementOverrides } from "./sleevelessCustomMeasurementStorage";
import { CUSTOM_BUILD_NECKLINE_STYLE_KEY } from "./sleevelessCustomBuildWizardNeckline";
import { CUSTOM_BUILD_STYLE_STORAGE_KEYS } from "./sleevelessCustomBuildStyleKeys";
import { getPatternProjectMeta } from "./sleevelessPatternProjectMeta";
import { startFreshSleevelessExpressPattern } from "./sleevelessExpressFreshStart";
import { syncCustomBuildToPatternStorage } from "./syncCustomBuildToPatternStorage";
import { stubLocalStorage } from "./test/stubLocalStorage";

function seedOldWorkingSession(): void {
  writeActiveCustomPatternProjectId("proj-saved-aubrey");
  localStorage.setItem(
    SLEEVELESS_EXPRESS_BUILDER_STORAGE_KEY,
    JSON.stringify({
      values: { who: "women", selectedSize: "36", style: "shaped-cardigan", front: "open", fit: "close" },
      cbMeasurementOverrides: { chestBust: "50", finishedLength: "24" },
    }),
  );
  localStorage.setItem(CUSTOM_BUILD_STYLE_STORAGE_KEYS.bodyShape, "aline");
  localStorage.setItem(CUSTOM_BUILD_STYLE_STORAGE_KEYS.garmentType, "cardigan");
  localStorage.setItem(CUSTOM_BUILD_NECKLINE_STYLE_KEY, "v-neck");
  localStorage.setItem(
    PATTERN_STORAGE_KEY,
    JSON.stringify({
      id: "old-pattern-id",
      patternType: "sleeveless",
      status: "draft",
      version: 1,
      createdAt: "t",
      updatedAt: "t",
      style: {
        bodyShape: "aline",
        garmentStyle: "cardigan",
        frontStyle: "open",
        neckline: "v",
        patternMode: "express",
        recipientCategory: "misses",
      },
      fit: {
        selectedSize: "36",
        cbMeasurementOverrides: { chestBust: "50" },
      },
      yarnGauge: { stitchGauge: "7", rowGauge: "10" },
      measurements: { chestBust: "50", finishedLength: "24" },
      machine: {},
      calculations: {},
      instructions: {},
      patternProject: { title: "Aubrey's Vest", notes: "Old note", titleCustomized: true },
    }),
  );
  localStorage.setItem(
    PATTERN_BUILDER_DATA_KEY,
    JSON.stringify({
      style: { bodyShape: "aline", garmentStyle: "cardigan" },
      fit: { selectedSize: "36", cbMeasurementOverrides: { chestBust: "50" } },
    }),
  );
}

function seedNewExpressWizardSnapshot(): void {
  localStorage.setItem(
    SLEEVELESS_EXPRESS_BUILDER_STORAGE_KEY,
    JSON.stringify({
      values: {
        who: "men",
        selectedSize: "42",
        style: "straight-pullover",
        front: "closed",
        neckline: "round",
        fit: "standard",
      },
      flowSteps: 5,
      whoSizeCombined: true,
    }),
  );
}

describe("startFreshSleevelessExpressPattern", () => {
  beforeEach(() => {
    stubLocalStorage();
    localStorage.clear();
  });

  it("builds the new-session Express URL", () => {
    expect(buildSleevelessExpressNewPatternHref()).toBe(
      `/patterns/sleeveless-express?${SLEEVELESS_EXPRESS_NEW_SESSION_PARAM}=${SLEEVELESS_EXPRESS_NEW_SESSION_VALUE}`,
    );
  });

  it("clears active project link, express wizard snapshot, customize handoff keys, and project meta", () => {
    seedOldWorkingSession();

    startFreshSleevelessExpressPattern();

    expect(readActiveCustomPatternProjectId()).toBe("");
    expect(localStorage.getItem(CUSTOM_PATTERN_ACTIVE_PROJECT_ID_KEY)).toBeNull();
    expect(localStorage.getItem(SLEEVELESS_EXPRESS_BUILDER_STORAGE_KEY)).toBeNull();
    expect(localStorage.getItem(CUSTOM_BUILD_STYLE_STORAGE_KEYS.bodyShape)).toBeNull();
    expect(localStorage.getItem(CUSTOM_BUILD_STYLE_STORAGE_KEYS.garmentType)).toBeNull();
    expect(localStorage.getItem(CUSTOM_BUILD_NECKLINE_STYLE_KEY)).toBeNull();

    const meta = getPatternProjectMeta();
    expect(meta.title).toBe("");
    expect(meta.notes).toBe("");
    expect(meta.titleCustomized).toBeFalsy();

    const raw = localStorage.getItem(PATTERN_STORAGE_KEY);
    expect(raw).toBeTruthy();
    const parsed = JSON.parse(raw!) as { patternProject?: { title?: string; notes?: string } };
    expect(parsed.patternProject?.title).toBe("");
    expect(parsed.patternProject?.notes).toBe("");
  });

  it("after fresh start and new wizard, Customize/review sync does not resurrect the prior build", () => {
    seedOldWorkingSession();
    startFreshSleevelessExpressPattern();
    seedNewExpressWizardSnapshot();

    syncCustomBuildToPatternStorage({ awaitCharts: false });

    expect(getPatternProjectMeta().title).toBe("");
    expect(getPatternProjectMeta().notes).toBe("");

    const style = getCurrentPattern().style as Record<string, unknown>;
    expect(style.bodyShape).toBe("straight");
    expect(style.garmentStyle).toBe("pullover");
    expect(style.frontStyle).toBe("closed");
    expect(style.neckline).toBe("round");
    expect(style.patternMode).toBe("express");

    const fit = getCurrentPattern().fit as Record<string, unknown>;
    expect(fit.selectedSize).toBe("42");
    expect(fit.sizingChart).toBe("men");

    const overrides = loadMeasurementOverrides();
    expect(overrides.chestBust).toBeUndefined();
    expect(overrides.finishedLength).toBeUndefined();

    const pb = getPatternData();
    const pbFit = pb.fit as Record<string, unknown>;
    expect(pbFit.selectedSize).toBe("42");
    expect(
      (pbFit.cbMeasurementOverrides as Record<string, string> | undefined)?.chestBust,
    ).toBeUndefined();
  });
});
