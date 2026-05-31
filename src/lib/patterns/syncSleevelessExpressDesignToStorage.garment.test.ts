import { beforeEach, describe, expect, it, vi } from "vitest";
import { syncSleevelessDesignBasicsToPatternStorage } from "./syncSleevelessExpressDesignToStorage";
import {
  getCurrentPattern,
  getPatternData,
  PATTERN_BUILDER_DATA_KEY,
  PATTERN_STORAGE_KEY,
} from "./patternStorage";

describe("syncSleevelessDesignBasicsToPatternStorage garment writes", () => {
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
    localStorage.setItem(
      PATTERN_STORAGE_KEY,
      JSON.stringify({
        style: { garmentStyle: "cardigan", frontStyle: "open", patternMode: "custom-build" },
        fit: {},
      }),
    );
    localStorage.setItem(
      PATTERN_BUILDER_DATA_KEY,
      JSON.stringify({
        style: { garmentStyle: "cardigan", frontStyle: "open" },
        fit: {},
      }),
    );
  });

  it("does not default pullover when only patternMode and bodyShape are passed", () => {
    syncSleevelessDesignBasicsToPatternStorage({
      who: "women",
      fit: "standard",
      patternMode: "custom-build",
      bodyShape: "straight",
    });

    expect(getCurrentPattern().style?.garmentStyle).toBe("cardigan");
    expect(getCurrentPattern().style?.frontStyle).toBe("open");
    expect(getPatternData().style?.garmentStyle).toBe("cardigan");
  });
});
