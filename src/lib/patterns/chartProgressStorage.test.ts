import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  chartProgressStorageKey,
  readChartProgressBlob,
  writeChartProgressBlob,
} from "./chartProgressStorage";
import { stubLocalStorage } from "./test/stubLocalStorage";

describe("chartProgressStorage", () => {
  beforeEach(() => {
    stubLocalStorage();
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("builds stable localStorage namespaces with sanitized id segments", () => {
    expect(chartProgressStorageKey("pat/a", "ns-chart-primary")).toBe(
      "kbm:chart-rows:pat_a:ns-chart-primary",
    );
  });

  it("reads legacy array format as checked rows only", () => {
    const key = chartProgressStorageKey("p1", "chart1");
    localStorage.setItem(key, JSON.stringify(["a", "b"]));
    expect(readChartProgressBlob(key)).toEqual({
      checkedRowIds: ["a", "b"],
      hideCompleted: false,
    });
  });

  it("round-trips blob with hideCompleted", () => {
    const key = chartProgressStorageKey("p1", "chart1");
    writeChartProgressBlob(key, { checkedRowIds: ["x"], hideCompleted: true });
    expect(readChartProgressBlob(key)).toEqual({
      checkedRowIds: ["x"],
      hideCompleted: true,
    });
  });
});
