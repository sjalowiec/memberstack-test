import { describe, expect, it } from "vitest";
import {
  dropShoulderAllowanceGroupForChartAudience,
  normalizeDropShoulderAllowanceFit,
  resolveDropShoulderFinishedUpperArmInches,
  resolveDropShoulderUpperArmAllowanceInches,
} from "./dropShoulderUpperArmAllowance";

const allowance = (chartAudience: string, fit: string, bodyUpperArmIn?: number) =>
  resolveDropShoulderUpperArmAllowanceInches({ chartAudience, fit, bodyUpperArmIn });

const near = (a: number | undefined, b: number) => {
  expect(a).toBeDefined();
  expect(Math.abs((a as number) - b)).toBeLessThan(1e-9);
};

describe("dropShoulderAllowanceGroupForChartAudience", () => {
  it("maps the five repo sizing groups", () => {
    expect(dropShoulderAllowanceGroupForChartAudience("baby")).toBe("baby");
    expect(dropShoulderAllowanceGroupForChartAudience("kids")).toBe("kids");
    expect(dropShoulderAllowanceGroupForChartAudience("misses")).toBe("woman");
    expect(dropShoulderAllowanceGroupForChartAudience("plus")).toBe("woman");
    expect(dropShoulderAllowanceGroupForChartAudience("men")).toBe("man");
  });

  it("returns undefined for unknown audiences (caller falls back to body value)", () => {
    expect(dropShoulderAllowanceGroupForChartAudience("")).toBeUndefined();
    expect(dropShoulderAllowanceGroupForChartAudience("mystery")).toBeUndefined();
    expect(dropShoulderAllowanceGroupForChartAudience(undefined)).toBeUndefined();
  });
});

describe("normalizeDropShoulderAllowanceFit", () => {
  it("maps persisted `relaxed` (and `oversized`) to oversized", () => {
    expect(normalizeDropShoulderAllowanceFit("relaxed")).toBe("oversized");
    expect(normalizeDropShoulderAllowanceFit("oversized")).toBe("oversized");
    expect(normalizeDropShoulderAllowanceFit("close")).toBe("close");
    expect(normalizeDropShoulderAllowanceFit("standard")).toBe("standard");
    expect(normalizeDropShoulderAllowanceFit("bogus")).toBe("standard");
  });
});

describe("Baby allowance", () => {
  it("returns exact anchor values", () => {
    near(allowance("baby", "close", 5.7), 1.4);
    near(allowance("baby", "standard", 5.7), 1.6);
    near(allowance("baby", "oversized", 5.7), 2.2);
    near(allowance("baby", "close", 6.1), 1.8);
    near(allowance("baby", "standard", 6.1), 2.4);
    near(allowance("baby", "oversized", 6.1), 3.3);
    near(allowance("baby", "close", 6.7), 1.8);
    near(allowance("baby", "standard", 6.7), 3.2);
    near(allowance("baby", "oversized", 6.7), 4.0);
  });

  it("interpolates linearly between anchors", () => {
    // Midpoint of 5.7?6.1: close 1.4?1.8, standard 1.6?2.4, oversized 2.2?3.3.
    near(allowance("baby", "close", 5.9), 1.6);
    near(allowance("baby", "standard", 5.9), 2.0);
    near(allowance("baby", "oversized", 5.9), 2.75);
  });

  it("clamps below the first anchor and above the last", () => {
    near(allowance("baby", "standard", 4.0), 1.6); // below 5.7 ? first anchor
    near(allowance("baby", "oversized", 4.0), 2.2);
    near(allowance("baby", "standard", 9.0), 3.2); // above 6.7 ? last anchor
    near(allowance("baby", "oversized", 9.0), 4.0);
  });
});

describe("Kids allowance", () => {
  it("returns exact anchor values", () => {
    near(allowance("kids", "close", 6.9), 1.8);
    near(allowance("kids", "standard", 6.9), 3.3);
    near(allowance("kids", "oversized", 6.9), 4.3);
    near(allowance("kids", "close", 8.3), 3.2);
    near(allowance("kids", "standard", 8.3), 4.5);
    near(allowance("kids", "oversized", 8.3), 6.3);
    near(allowance("kids", "close", 10.0), 3.9);
    near(allowance("kids", "standard", 10.0), 5.5);
    near(allowance("kids", "oversized", 10.0), 7.9);
  });

  it("interpolates linearly between anchors", () => {
    // Midpoint of 6.9?8.3 (arm 7.6): close 1.8?3.2, standard 3.3?4.5, oversized 4.3?6.3.
    near(allowance("kids", "close", 7.6), 2.5);
    near(allowance("kids", "standard", 7.6), 3.9);
    near(allowance("kids", "oversized", 7.6), 5.3);
  });

  it("clamps below the first anchor and above the last", () => {
    near(allowance("kids", "close", 6.0), 1.8); // below 6.9 ? first anchor
    near(allowance("kids", "oversized", 6.0), 4.3);
    near(allowance("kids", "close", 12.0), 3.9); // above 10.0 ? last anchor
    near(allowance("kids", "oversized", 12.0), 7.9);
  });
});

describe("Adult woman allowance (Misses + Plus)", () => {
  it("uses fixed values regardless of body upper arm", () => {
    for (const arm of [10, 12.2, 15.6, 19]) {
      near(allowance("misses", "close", arm), 7.1);
      near(allowance("misses", "standard", arm), 8.7);
      near(allowance("misses", "oversized", arm), 10.2);
    }
  });

  it("Plus uses the same values as Misses", () => {
    for (const fit of ["close", "standard", "oversized", "relaxed"]) {
      expect(allowance("plus", fit, 14)).toBe(allowance("misses", fit, 14));
    }
  });
});

describe("Adult man allowance (Men)", () => {
  it("uses fixed values regardless of body upper arm", () => {
    for (const arm of [12.2, 15.2, 19.1]) {
      near(allowance("men", "close", arm), 3.9);
      near(allowance("men", "standard", arm), 5.5);
      near(allowance("men", "oversized", arm), 7.1);
    }
  });

  it("internal `relaxed` fit maps to the Oversized allowance", () => {
    expect(allowance("men", "relaxed", 15)).toBe(allowance("men", "oversized", 15));
    near(allowance("men", "relaxed", 15), 7.1);
  });
});

describe("resolveDropShoulderFinishedUpperArmInches", () => {
  it("adds the allowance to the body upper arm and rounds to the nearest ¼?", () => {
    // Man, body 13: close 13+3.9=16.9?16.75(=67.6/4?68/4=17.0), standard 18.5, oversized 20.0.
    expect(
      resolveDropShoulderFinishedUpperArmInches({ chartAudience: "men", fit: "standard", bodyUpperArmIn: 13 }),
    ).toBe(18.5);
    // Woman, body 12: close 12+7.1=19.1?19.0.
    expect(
      resolveDropShoulderFinishedUpperArmInches({ chartAudience: "misses", fit: "close", bodyUpperArmIn: 12 }),
    ).toBe(19.0);
    // Woman, body 12: standard 12+8.7=20.7?20.75.
    expect(
      resolveDropShoulderFinishedUpperArmInches({ chartAudience: "misses", fit: "standard", bodyUpperArmIn: 12 }),
    ).toBe(20.75);
  });

  it("returns undefined for unknown group or invalid body value (caller keeps body value)", () => {
    expect(
      resolveDropShoulderFinishedUpperArmInches({ chartAudience: "mystery", fit: "standard", bodyUpperArmIn: 12 }),
    ).toBeUndefined();
    expect(
      resolveDropShoulderFinishedUpperArmInches({ chartAudience: "men", fit: "standard", bodyUpperArmIn: 0 }),
    ).toBeUndefined();
    expect(
      resolveDropShoulderFinishedUpperArmInches({ chartAudience: "men", fit: "standard", bodyUpperArmIn: undefined }),
    ).toBeUndefined();
  });
});
