import { beforeEach, describe, expect, it, vi } from "vitest";
import { chartAudienceToExpressWho } from "./restoreSleevelessExpressBuilderFromPattern";
import {
  isValidExpressSizeForAudience,
  resetExpressSweaterChartsForTests,
  resolveExpressChartFit,
  seedExpressSweaterChartsForTests,
} from "./sleevelessExpressSizeChartClient";
import { expressWhoToChartAudience } from "./syncSleevelessExpressDesignToStorage";
import {
  omitUnsupportedSetInSleeveWho,
  setInSleeveAudiencePrefixLabel,
  setInSleeveWhoIsSupported,
} from "./setInSleeveSizeCharts";
import type { ChartRow } from "./sleevelessExpressSizeChartTypes";

const missesRow: ChartRow = { size: 4, bust_or_chest: 33, waist: 25, hip: 35, upper_arm: 11 };
const plusRow: ChartRow = { size: "1X", bust_or_chest: 45, waist: 38, hip: 48, upper_arm: 15 };
const menRow: ChartRow = { size: "M", bust_or_chest: 40, waist: 34, hip: 40, upper_arm: 13 };
const kidsRow: ChartRow = { size: "4 yr", bust_or_chest: 25, waist: 23, hip: 27, upper_arm: 8 };

function stubSetInBuilderPage(): void {
  vi.stubGlobal("document", {
    querySelector: (selector: string) => {
      if (selector === "[data-express-construction]") {
        return { getAttribute: () => "set-in-sleeve" };
      }
      return null;
    },
  });
}

describe("Set-In Sleeve adult size charts", () => {
  beforeEach(() => {
    resetExpressSweaterChartsForTests();
    vi.unstubAllGlobals();
    seedExpressSweaterChartsForTests("misses", [missesRow]);
    seedExpressSweaterChartsForTests("plus", [plusRow]);
    seedExpressSweaterChartsForTests("men", [menRow]);
    seedExpressSweaterChartsForTests("kids", [kidsRow]);
  });

  it("maps Misses, Women's, and Men's onto the existing chart keys", () => {
    expect(expressWhoToChartAudience("women")).toBe("misses");
    expect(expressWhoToChartAudience("plus")).toBe("plus");
    expect(expressWhoToChartAudience("men")).toBe("men");
    expect(setInSleeveWhoIsSupported("women")).toBe(true);
    expect(setInSleeveWhoIsSupported("plus")).toBe(true);
    expect(setInSleeveWhoIsSupported("men")).toBe(true);
    expect(setInSleeveWhoIsSupported("kids")).toBe(false);
    expect(setInSleeveWhoIsSupported("baby")).toBe(false);
    expect(setInSleeveAudiencePrefixLabel("women", "misses")).toBe("Misses");
    expect(setInSleeveAudiencePrefixLabel("plus", "plus")).toBe("Women's");
    expect(setInSleeveAudiencePrefixLabel("men", "men")).toBe("Men's");
    expect(setInSleeveAudiencePrefixLabel("women", "")).toBe("Misses");
  });

  it("accepts a size from each adult chart and rejects a kids size on those charts", () => {
    expect(isValidExpressSizeForAudience("misses", "4")).toBe(true);
    expect(isValidExpressSizeForAudience("plus", "1X")).toBe(true);
    expect(isValidExpressSizeForAudience("men", "M")).toBe(true);
    expect(resolveExpressChartFit("misses", "4", "standard")?.selectedSize).toBe("4");
    expect(resolveExpressChartFit("plus", "1X", "standard")?.selectedSize).toBe("1X");
    expect(resolveExpressChartFit("men", "M", "standard")?.selectedSize).toBe("M");
    expect(isValidExpressSizeForAudience("misses", "4 yr")).toBe(false);
    expect(isValidExpressSizeForAudience("plus", "4")).toBe(false);
    expect(isValidExpressSizeForAudience("men", "1X")).toBe(false);
  });

  it("keeps Women's on the plus key when reopening the Set-In Sleeve builder", () => {
    stubSetInBuilderPage();
    expect(chartAudienceToExpressWho("plus")).toBe("plus");
    expect(chartAudienceToExpressWho("misses")).toBe("women");
    expect(chartAudienceToExpressWho("men")).toBe("men");
  });

  it("still folds a stored plus chart back to Women outside Set-In Sleeve", () => {
    vi.stubGlobal("document", {
      querySelector: () => null,
    });
    expect(chartAudienceToExpressWho("plus")).toBe("women");
    expect(chartAudienceToExpressWho("kids")).toBe("kids");
  });

  it("drops a new Baby or Kids selection without touching a saved project", () => {
    stubSetInBuilderPage();
    const fresh: Record<string, string> = { who: "baby", selectedSize: "3 mo" };
    omitUnsupportedSetInSleeveWho(fresh, { editingSavedProject: false });
    expect(fresh.who).toBeUndefined();
    expect(fresh.selectedSize).toBeUndefined();

    const saved: Record<string, string> = { who: "kids", selectedSize: "4 yr" };
    omitUnsupportedSetInSleeveWho(saved, { editingSavedProject: true });
    expect(saved.who).toBe("kids");
    expect(saved.selectedSize).toBe("4 yr");

    const adult: Record<string, string> = { who: "plus", selectedSize: "1X" };
    omitUnsupportedSetInSleeveWho(adult, { editingSavedProject: false });
    expect(adult).toEqual({ who: "plus", selectedSize: "1X" });
  });
});
