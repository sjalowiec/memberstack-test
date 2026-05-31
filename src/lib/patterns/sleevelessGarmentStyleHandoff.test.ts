import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  persistSleevelessGarmentStyleHandoff,
  resolveSleevelessGarmentStyleForHandoff,
  reviewSummaryIndicatesCardigan,
} from "./sleevelessGarmentStyleHandoff";
import {
  getCurrentPattern,
  getPatternData,
  PATTERN_BUILDER_DATA_KEY,
  PATTERN_STORAGE_KEY,
  SLEEVELESS_EXPRESS_BUILDER_STORAGE_KEY,
} from "./patternStorage";
import { CUSTOM_BUILD_STYLE_STORAGE_KEYS } from "./sleevelessCustomBuildStyleKeys";

describe("sleevelessGarmentStyleHandoff", () => {
  const store: Record<string, string> = {};

  beforeEach(() => {
    for (const k of Object.keys(store)) delete store[k];
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => store[key] ?? null,
      setItem: (key: string, value: string) => {
        store[key] = value;
      },
      removeItem: (key: string) => {
        delete store[k];
      },
    });
  });

  it("prefers canonical cardigan over wizard pullover and stale patternBuilderData", () => {
    expect(
      resolveSleevelessGarmentStyleForHandoff(
        { garmentStyle: "cardigan", frontStyle: "open" },
        { garmentStyle: "pullover", frontStyle: "closed" },
        {},
        "pullover",
      ),
    ).toEqual({ garmentStyle: "cardigan", frontStyle: "open" });
  });

  it("persists cardigan to all stores on final handoff write", () => {
    localStorage.setItem(PATTERN_STORAGE_KEY, JSON.stringify({ style: { bodyShape: "straight" }, fit: {} }));
    localStorage.setItem(
      PATTERN_BUILDER_DATA_KEY,
      JSON.stringify({ style: { garmentStyle: "pullover" }, fit: {} }),
    );
    localStorage.setItem(
      SLEEVELESS_EXPRESS_BUILDER_STORAGE_KEY,
      JSON.stringify({ values: { who: "women", shape: "straight", front: "open", style: "straight-cardigan" } }),
    );
    localStorage.setItem(CUSTOM_BUILD_STYLE_STORAGE_KEYS.garmentType, "pullover");

    const sources = {
      wizardGarmentType: "pullover",
      canonicalStyle: { garmentStyle: "cardigan", frontStyle: "open" },
      patternBuilderStyle: { garmentStyle: "pullover", frontStyle: "closed" },
      expressValues: { front: "open", style: "straight-cardigan" },
    };
    expect(reviewSummaryIndicatesCardigan(sources)).toBe(true);

    const result = persistSleevelessGarmentStyleHandoff(
      { garmentStyle: "cardigan", frontStyle: "open" },
      sources,
      "test",
    );

    expect(result.resolved.garmentStyle).toBe("cardigan");
    expect(getCurrentPattern().style?.garmentStyle).toBe("cardigan");
    expect(getPatternData().style?.garmentStyle).toBe("cardigan");
    expect(localStorage.getItem(CUSTOM_BUILD_STYLE_STORAGE_KEYS.garmentType)).toBe("cardigan");
    const raw = localStorage.getItem(SLEEVELESS_EXPRESS_BUILDER_STORAGE_KEY);
    const parsed = JSON.parse(raw ?? "{}") as { values?: Record<string, string> };
    expect(parsed.values?.front).toBe("open");
    expect(parsed.values?.style).toContain("cardigan");
  });
});
