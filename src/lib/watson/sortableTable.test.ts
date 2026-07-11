import { describe, expect, it } from "vitest";

import { compareSortValues, getNextSortDirection } from "./sortableTable";

describe("sortableTable", () => {
  it("toggles sort direction", () => {
    expect(getNextSortDirection(null)).toBe("asc");
    expect(getNextSortDirection("asc")).toBe("desc");
    expect(getNextSortDirection("desc")).toBe("asc");
  });

  it("compares strings case-insensitively", () => {
    expect(compareSortValues("beta", "Alpha", "string")).toBeGreaterThan(0);
    expect(compareSortValues("Alpha", "beta", "string")).toBeLessThan(0);
  });

  it("compares ISO dates", () => {
    expect(
      compareSortValues("2024-01-02T00:00:00.000Z", "2023-12-01T00:00:00.000Z", "date"),
    ).toBeGreaterThan(0);
    expect(compareSortValues("", "2023-12-01T00:00:00.000Z", "date")).toBeLessThan(0);
  });
});
