import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildSockSizeOptionLabel,
  chartRowToMeasurements,
  createSockSizingAdapter,
  findSockChartSize,
  listSockSizingOptions,
  parseSockSizingChart,
  SOCK_CHART_FIELD_NOTES,
  SOCK_SIZING_DATA_URL,
} from "./sockSizing";

const chartPath = resolve(process.cwd(), "public/data/sizing_socks.json");
const rawChart = JSON.parse(readFileSync(chartPath, "utf8")) as unknown;

describe("sock sizing adapter", () => {
  const adapter = createSockSizingAdapter(rawChart);

  it("reads the existing public/data/sizing_socks.json without altering it", () => {
    expect(SOCK_SIZING_DATA_URL).toBe("/data/sizing_socks.json");
    expect(adapter.rows).toHaveLength(8);
    expect(adapter.rows.map((row) => row.size)).toEqual([
      "baby",
      "child",
      "woman_sm",
      "woman_med",
      "woman_lg",
      "man_sm",
      "man_med",
      "man_lg",
    ]);
  });

  it("exposes finished foot circumference as the primary size measurement", () => {
    const womanMed = findSockChartSize(adapter, "woman_med");
    expect(womanMed).toMatchObject({
      size: "woman_med",
      label: "Woman Medium",
      footCircumferenceInches: 8.5,
      footLengthInches: 9,
      legLengthInches: 4.5,
      defaultLegCircumferenceInches: 8.5,
    });
    expect(womanMed?.extendedLabel).toContain("US shoe 7–8");
  });

  it("treats chart cuff_length as default leg length and does not invent missing columns", () => {
    expect(SOCK_CHART_FIELD_NOTES.missing).toEqual([
      "leg_circumference",
      "ankle_circumference",
      "heel_depth",
      "toe_depth",
    ]);
    for (const row of adapter.rows) {
      expect(row).not.toHaveProperty("leg_circumference");
      expect(chartRowToMeasurements(row).defaultLegCircumferenceInches).toBe(
        row.foot_circumference,
      );
      expect(chartRowToMeasurements(row).legLengthInches).toBe(row.cuff_length);
    }
  });

  it("keeps Woman Large and Man Small as distinct sizes that share a 9\" foot circumference", () => {
    const womanLg = findSockChartSize(adapter, "woman_lg");
    const manSm = findSockChartSize(adapter, "man_sm");
    expect(womanLg?.footCircumferenceInches).toBe(9);
    expect(manSm?.footCircumferenceInches).toBe(9);
    expect(womanLg?.footLengthInches).toBe(9.5);
    expect(manSm?.footLengthInches).toBe(10);
    expect(womanLg?.legLengthInches).toBe(5);
    expect(manSm?.legLengthInches).toBe(5);
    expect(SOCK_CHART_FIELD_NOTES.overlappingFootCircumferenceSizes).toEqual([
      "woman_lg",
      "man_sm",
    ]);
  });

  it("looks up by size id, not by circumference", () => {
    expect(findSockChartSize(adapter, "custom")).toBeNull();
    expect(findSockChartSize(adapter, "")).toBeNull();
    expect(findSockChartSize(adapter, "missing")).toBeNull();
  });

  it("builds future-builder labels from foot circumference", () => {
    const baby = findSockChartSize(adapter, "baby")!;
    expect(buildSockSizeOptionLabel(baby)).toBe('Baby — 4" foot circumference');
    expect(buildSockSizeOptionLabel(baby, "cm")).toBe("Baby — 10 cm foot circumference");
    expect(listSockSizingOptions(adapter)[0].optionLabel).toContain("foot circumference");
  });

  it("drops malformed chart entries instead of inventing measurements", () => {
    expect(parseSockSizingChart({ not: "an array" })).toEqual([]);
    expect(
      parseSockSizingChart([{ size: "broken", foot_circumference: 8 }]),
    ).toEqual([]);
  });
});
