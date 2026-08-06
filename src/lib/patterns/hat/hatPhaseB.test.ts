import { describe, it, expect } from "vitest";
import {
  buildHatBuilderMissingDraftHref,
  buildHatPatternGeneratedHref,
  HAT_BUILDER_HREF,
  HAT_PATTERN_HREF,
  HAT_PATTERN_WORKSPACE_GENERATED_HREF,
} from "./hatNavigation";
import {
  createEmptyHatDraft,
  ensureHatDraftMigrated,
  LEGACY_HAT_PATTERN_INPUTS_STORAGE_KEY,
  LEGACY_HAT_SIZE_STORAGE_KEY,
  clearHatDraft,
  writeHatDraftAndLegacyMirrors,
} from "./hatDraft";
import {
  calculateHatPatternFromDraft,
  isHatDraftReadyForPattern,
} from "./hatPatternFromDraft";
import { buildPatternReviewLegacyRedirect } from "../patternReviewLegacyRedirect";

function memoryStorage(initial: Record<string, string> = {}) {
  const map = new Map<string, string>(Object.entries(initial));
  return {
    getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
    setItem: (k: string, v: string) => {
      map.set(k, v);
    },
    removeItem: (k: string) => {
      map.delete(k);
    },
  };
}

describe("hatNavigation", () => {
  it("builder handoff uses generated=1 like sweater workspaces", () => {
    expect(HAT_PATTERN_WORKSPACE_GENERATED_HREF).toContain("/patterns/hat/pattern/");
    expect(HAT_PATTERN_WORKSPACE_GENERATED_HREF).toContain("generated=1");
  });

  it("buildHatPatternGeneratedHref can open edit drawer", () => {
    expect(buildHatPatternGeneratedHref(true)).toContain("edit=1");
    expect(buildHatPatternGeneratedHref(false)).not.toContain("edit=1");
  });

  it("missing draft returns to builder with explanation query", () => {
    expect(buildHatBuilderMissingDraftHref()).toBe(
      `${HAT_BUILDER_HREF}?draft=missing`,
    );
  });

  it("legacy review redirects to pattern workspace with generated=1", () => {
    const href = buildPatternReviewLegacyRedirect(
      "https://example.com/patterns/hat/review?foo=1",
      HAT_PATTERN_HREF,
    );
    expect(href).toContain("/patterns/hat/pattern/");
    expect(href).toContain("generated=1");
    expect(href).toContain("foo=1");
  });
});

describe("isHatDraftReadyForPattern", () => {
  it("rejects incomplete drafts", () => {
    expect(isHatDraftReadyForPattern(null)).toBe(false);
    expect(isHatDraftReadyForPattern(createEmptyHatDraft())).toBe(false);
  });

  it("accepts a complete adult-woman draft", () => {
    const draft = createEmptyHatDraft({
      sizeSel: "adult_woman",
      fit: "relaxed",
      brimType: "single",
      brimLength: "2",
      crownShaping: "gathered",
      gaugeSlots: {
        inches: { stitch: "5", row: "7" },
        cm: { stitch: "", row: "" },
      },
    });
    expect(isHatDraftReadyForPattern(draft)).toBe(true);
  });

  it("requires custom circumference and length when selected", () => {
    const draft = createEmptyHatDraft({
      sizeSel: "custom",
      customCircumference: "",
      fit: "custom",
      customHatLength: "",
      brimType: "folded",
      brimLength: "2",
      crownShaping: "spiral",
      gaugeSlots: {
        inches: { stitch: "5", row: "7" },
        cm: { stitch: "", row: "" },
      },
    });
    expect(isHatDraftReadyForPattern(draft)).toBe(false);
    draft.customCircumference = "20";
    draft.customHatLength = "9";
    expect(isHatDraftReadyForPattern(draft)).toBe(true);
  });
});

describe("calculateHatPatternFromDraft", () => {
  const sizingRows = [
    {
      size: "adult_woman",
      circumference: 22.5,
      hatLength: 11,
      suggestedCrownDepth: 2,
      finishedSizeInches: 20.5,
    },
  ];

  it("preserves Phase A golden cast-on for gathered/single", () => {
    const draft = createEmptyHatDraft({
      sizeSel: "adult_woman",
      fit: "watchcap",
      brimType: "single",
      brimLength: "2",
      crownShaping: "gathered",
      gaugeSlots: {
        inches: { stitch: "5", row: "7" },
        cm: { stitch: "", row: "" },
      },
    });
    const calc = calculateHatPatternFromDraft(draft, sizingRows);
    expect(calc?.castOnSts).toBe(26);
    expect(calc?.bodyRows).toBe(16);
    expect(calc?.brimRows).toBe(4);
  });
});

describe("hat draft clear + legacy mirrors", () => {
  it("writeHatDraftAndLegacyMirrors keeps fragmented keys in sync", () => {
    const storage = memoryStorage();
    const draft = createEmptyHatDraft({
      sizeSel: "adult_woman",
      fit: "relaxed",
      brimType: "single",
      brimLength: "2",
      crownShaping: "spiral",
      gaugeSlots: {
        inches: { stitch: "5", row: "7" },
        cm: { stitch: "", row: "" },
      },
    });
    writeHatDraftAndLegacyMirrors(draft, storage);
    expect(storage.getItem(LEGACY_HAT_SIZE_STORAGE_KEY)).toContain("adult_woman");
    expect(storage.getItem(LEGACY_HAT_PATTERN_INPUTS_STORAGE_KEY)).toContain("relaxed");
    clearHatDraft(storage);
    expect(ensureHatDraftMigrated(storage)).toBeNull();
  });
});
