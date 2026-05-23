import { describe, expect, it } from "vitest";
import {
  EXPRESS_DEFAULT_AVAILABLE_NEEDLES,
  isValidExpressAvailableNeedles,
  resolveExpressAvailableNeedles,
  resolveExpressAvailableNeedlesForResume,
} from "./sleevelessExpressAvailableNeedles";

describe("resolveExpressAvailableNeedles", () => {
  it("defaults to 150 when there is no prior value or input", () => {
    expect(resolveExpressAvailableNeedles(undefined)).toBe(EXPRESS_DEFAULT_AVAILABLE_NEEDLES);
    expect(resolveExpressAvailableNeedles({})).toBe(EXPRESS_DEFAULT_AVAILABLE_NEEDLES);
    expect(resolveExpressAvailableNeedles(undefined, "  ")).toBe(EXPRESS_DEFAULT_AVAILABLE_NEEDLES);
  });

  it("prefers live input over stored yarnGaugeMachine", () => {
    expect(resolveExpressAvailableNeedles({ availableNeedles: 200 }, "272")).toBe("272");
    expect(resolveExpressAvailableNeedles({ availableNeedles: "200" }, "110")).toBe("110");
  });

  it("preserves prior yarnGaugeMachine when input is empty", () => {
    expect(resolveExpressAvailableNeedles({ availableNeedles: 200 })).toBe("200");
    expect(resolveExpressAvailableNeedles({ availableNeedles: "110" })).toBe("110");
  });
});

describe("isValidExpressAvailableNeedles", () => {
  it("accepts positive integers and rejects empty or non-positive values", () => {
    expect(isValidExpressAvailableNeedles("150")).toBe(true);
    expect(isValidExpressAvailableNeedles(" 272 ")).toBe(true);
    expect(isValidExpressAvailableNeedles("")).toBe(false);
    expect(isValidExpressAvailableNeedles("0")).toBe(false);
    expect(isValidExpressAvailableNeedles("-1")).toBe(false);
    expect(isValidExpressAvailableNeedles("abc")).toBe(false);
  });
});

describe("resolveExpressAvailableNeedlesForResume", () => {
  it("prefers Express session snapshot over pattern storage", () => {
    expect(
      resolveExpressAvailableNeedlesForResume("150", { availableNeedles: 200 }),
    ).toBe("150");
  });

  it("falls back to yarnGaugeMachine then default", () => {
    expect(resolveExpressAvailableNeedlesForResume(undefined, { availableNeedles: 272 })).toBe(
      "272",
    );
    expect(resolveExpressAvailableNeedlesForResume("", {})).toBe(EXPRESS_DEFAULT_AVAILABLE_NEEDLES);
  });
});
