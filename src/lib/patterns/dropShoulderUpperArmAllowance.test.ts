import { describe, expect, it } from "vitest";
import {
  dropShoulderAllowanceGroupForChartAudience,
  normalizeDropShoulderAllowanceFit,
  resolveDropShoulderFinishedUpperArmInches,
  resolveDropShoulderUpperArmAllowanceInches,
} from "./dropShoulderUpperArmAllowance";

describe("dropShoulderUpperArmAllowance re-exports", () => {
  it("maps chart audiences to sleeve ease groups", () => {
    expect(dropShoulderAllowanceGroupForChartAudience("baby")).toBe("baby");
    expect(dropShoulderAllowanceGroupForChartAudience("kids")).toBe("child");
    expect(dropShoulderAllowanceGroupForChartAudience("misses")).toBe("adult");
    expect(dropShoulderAllowanceGroupForChartAudience("men")).toBe("adult");
  });

  it("maps persisted relaxed to relaxed ease", () => {
    expect(normalizeDropShoulderAllowanceFit("relaxed")).toBe("relaxed");
    expect(normalizeDropShoulderAllowanceFit("close")).toBe("close");
  });

  it("returns adult standard upper-arm ease of 2.0 inches", () => {
    expect(resolveDropShoulderUpperArmAllowanceInches({ chartAudience: "misses", fit: "standard" })).toBe(
      2,
    );
  });

  it("adds allowance to body upper arm and rounds to the nearest ¼?", () => {
    expect(
      resolveDropShoulderFinishedUpperArmInches({
        chartAudience: "misses",
        fit: "standard",
        bodyUpperArmIn: 12,
      }),
    ).toBe(14);
    expect(
      resolveDropShoulderFinishedUpperArmInches({
        chartAudience: "misses",
        fit: "close",
        bodyUpperArmIn: 12.5,
      }),
    ).toBe(13.5);
  });

  it("returns undefined for unknown group or invalid body value", () => {
    expect(
      resolveDropShoulderFinishedUpperArmInches({
        chartAudience: "mystery",
        fit: "standard",
        bodyUpperArmIn: 12,
      }),
    ).toBeUndefined();
    expect(
      resolveDropShoulderFinishedUpperArmInches({
        chartAudience: "men",
        fit: "standard",
        bodyUpperArmIn: 0,
      }),
    ).toBeUndefined();
  });
});
