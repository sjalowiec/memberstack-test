import { describe, expect, it } from "vitest";
import { chartProgressStorageKey } from "./chartProgressTracker.ts";

describe("chartProgressTracker", () => {
  describe("chartProgressStorageKey", () => {
    it("builds stable localStorage namespaces with sanitized id segments", () => {
      expect(chartProgressStorageKey("pat/a", "ns-chart-primary")).toBe(
        "kbm:chart-rows:pat_a:ns-chart-primary",
      );
    });

    it("normalizes punctuation in pattern ids to underscores", () => {
      expect(chartProgressStorageKey("my pattern!", "chart_1")).toBe(
        "kbm:chart-rows:my_pattern_:chart_1",
      );
    });
  });
});
