import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildSleevelessCustomBuildValidationInput } from "./sleevelessCustomBuildValidationInput";
import {
  saveCurrentPattern,
  SLEEVELESS_EXPRESS_BUILDER_STORAGE_KEY,
} from "./patternStorage";
import { validateSleevelessPatternInputs } from "./sleevelessPatternValidation";
import { splitPatternValidationMessages } from "./sleevelessPatternValidationUi";
import { stubLocalStorage } from "./test/stubLocalStorage";

const DEEP_V_OVERRIDES = {
  audience: "misses",
  armholeDepth: 7.25,
  neckDepth: 10,
  finishedLength: 23.5,
  hemDepth: 2,
  shoulderWidth: 13.25,
  finishedNeckOpeningWidth: 8,
  chestBust: 41.5,
};

describe("buildSleevelessCustomBuildValidationInput neckline", () => {
  beforeEach(() => {
    stubLocalStorage();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("reads stored v-neck so 7.25\" armhole / 10\" neck is accepted", () => {
    saveCurrentPattern({
      style: { neckline: "v-neck", recipientCategory: "misses" },
    });
    const input = buildSleevelessCustomBuildValidationInput(DEEP_V_OVERRIDES);
    expect(input.neckline).toBe("v-neck");
    const { errors } = splitPatternValidationMessages(validateSleevelessPatternInputs(input));
    expect(errors.map((e) => e.id)).not.toContain("neck-depth-exceeds-armhole-depth");
    expect(errors).toEqual([]);
  });

  it("reads stored v the same way as v-neck", () => {
    saveCurrentPattern({
      style: { neckline: "v", recipientCategory: "misses" },
    });
    const input = buildSleevelessCustomBuildValidationInput(DEEP_V_OVERRIDES);
    expect(input.neckline).toBe("v");
    expect(validateSleevelessPatternInputs(input).map((m) => m.id)).not.toContain(
      "neck-depth-exceeds-armhole-depth",
    );
  });

  it("still flags the same measurements for round neck", () => {
    saveCurrentPattern({
      style: { neckline: "round", recipientCategory: "misses" },
    });
    const input = buildSleevelessCustomBuildValidationInput(DEEP_V_OVERRIDES);
    expect(input.neckline).toBe("round");
    expect(validateSleevelessPatternInputs(input).map((m) => m.id)).toContain(
      "neck-depth-exceeds-armhole-depth",
    );
  });

  it("lets a live v-neck override win over a stored round neck", () => {
    saveCurrentPattern({
      style: { neckline: "round", recipientCategory: "misses" },
    });
    const input = buildSleevelessCustomBuildValidationInput({
      ...DEEP_V_OVERRIDES,
      neckline: "v-neck",
    });
    expect(input.neckline).toBe("v-neck");
    expect(validateSleevelessPatternInputs(input).map((m) => m.id)).not.toContain(
      "neck-depth-exceeds-armhole-depth",
    );
  });

  it("reads wizard v-neck when the pattern record has no neckline yet", () => {
    localStorage.setItem(
      SLEEVELESS_EXPRESS_BUILDER_STORAGE_KEY,
      JSON.stringify({ values: { neckline: "v-neck" } }),
    );
    const input = buildSleevelessCustomBuildValidationInput(DEEP_V_OVERRIDES);
    expect(input.neckline).toBe("v-neck");
    expect(validateSleevelessPatternInputs(input).map((m) => m.id)).not.toContain(
      "neck-depth-exceeds-armhole-depth",
    );
  });
});
