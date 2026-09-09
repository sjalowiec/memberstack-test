import { afterEach, describe, expect, it } from "vitest";
import { expressWhoToChartAudience } from "./syncSleevelessExpressDesignToStorage";
import {
  resetExpressSweaterChartsForTests,
  seedExpressSweaterChartsForTests,
  type ChartRow,
} from "./sleevelessExpressSizeChartClient";
import {
  buildSidewaysCardiganWomenChartRows,
  findSidewaysCardiganWomenChartRow,
  getSidewaysCardiganChartRowsForAudience,
  isSidewaysCardiganWomenSize,
  resolveSidewaysCardiganChartAudienceFromSize,
} from "./sidewaysCardiganSizeCharts";

const missesRows: ChartRow[] = [
  { size: 1, bust_or_chest: 31.5 },
  { size: 8, bust_or_chest: 42 },
];
const plusRows: ChartRow[] = [
  { size: "X", bust_or_chest: 39 },
  { size: "6x", bust_or_chest: 63 },
];

describe("sideways cardigan women's combined chart", () => {
  afterEach(() => {
    resetExpressSweaterChartsForTests();
  });

  it("lists misses 1–8 then plus X–6X without changing Express Women→misses mapping", () => {
    seedExpressSweaterChartsForTests("misses", missesRows);
    seedExpressSweaterChartsForTests("plus", plusRows);

    expect(expressWhoToChartAudience("women")).toBe("misses");

    const rows = buildSidewaysCardiganWomenChartRows();
    expect(rows.map((r) => String(r.size))).toEqual(["1", "8", "X", "6x"]);
    expect(rows.map((r) => r.chartAudience)).toEqual(["misses", "misses", "plus", "plus"]);
    expect(resolveSidewaysCardiganChartAudienceFromSize("8")).toBe("misses");
    expect(resolveSidewaysCardiganChartAudienceFromSize("X")).toBe("plus");
    expect(resolveSidewaysCardiganChartAudienceFromSize("6x")).toBe("plus");
    expect(isSidewaysCardiganWomenSize("X")).toBe(true);
    expect(isSidewaysCardiganWomenSize("M")).toBe(false);
    expect(findSidewaysCardiganWomenChartRow("X")?.bust_or_chest).toBe(39);
  });

  it("filters Misses vs Plus charts independently", () => {
    seedExpressSweaterChartsForTests("misses", missesRows);
    seedExpressSweaterChartsForTests("plus", plusRows);

    const misses = getSidewaysCardiganChartRowsForAudience("misses");
    const plus = getSidewaysCardiganChartRowsForAudience("plus");
    expect(misses.every((row) => row.chartAudience === "misses")).toBe(true);
    expect(plus.every((row) => row.chartAudience === "plus")).toBe(true);
    expect(misses.map((r) => String(r.size))).toEqual(["1", "8"]);
    expect(plus.map((r) => String(r.size))).toEqual(["X", "6x"]);
    expect(findSidewaysCardiganWomenChartRow("8", "misses")?.chartAudience).toBe("misses");
    expect(findSidewaysCardiganWomenChartRow("8", "plus")).toBeNull();
    expect(findSidewaysCardiganWomenChartRow("X", "plus")?.chartAudience).toBe("plus");
  });
});
