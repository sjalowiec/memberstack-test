import { describe, expect, it } from "vitest";
import {
  helpHubCategoryChoices,
  helpHubCategoryLabel,
  helpHubTipsInCategory,
} from "./categories";

const PRESERVED_KEYS = [
  "machine-not-working",
  "knitting-doesnt-look-right",
  "edges-finishing-assembly",
  "shaping-fit-problems",
  "pattern-design-confusion",
  "getting-started",
  "machines",
] as const;

describe("Help Hub categories", () => {
  const choices = helpHubCategoryChoices();
  const keys = choices.map((choice) => choice.key);

  it("keeps existing stored keys and display labels", () => {
    expect(keys).toEqual(expect.arrayContaining([...PRESERVED_KEYS]));
    expect(helpHubCategoryLabel("getting-started")).toBe("Getting Started");
    expect(helpHubCategoryLabel("machines")).toBe("Machines");
    expect(choices.find((choice) => choice.key === "getting-started")?.id).toBe(6);
    expect(choices.find((choice) => choice.key === "machines")?.id).toBe(7);
  });

  it("places Gauge & Swatching after Getting Started and before Machines", () => {
    const started = keys.indexOf("getting-started");
    const gauge = keys.indexOf("gauge-swatching");
    const machines = keys.indexOf("machines");
    expect(started).toBeGreaterThanOrEqual(0);
    expect(gauge).toBe(started + 1);
    expect(machines).toBe(gauge + 1);
    expect(helpHubCategoryLabel("gauge-swatching")).toBe("Gauge & Swatching");
  });

  it("stores Gauge & Swatching as a kebab-case key, matching existing convention", () => {
    const gauge = choices.find((choice) => choice.key === "gauge-swatching");
    expect(gauge).toEqual(
      expect.objectContaining({
        key: "gauge-swatching",
        label: "Gauge & Swatching",
      }),
    );
    expect(gauge?.key).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });

  it("filters tips by stored category key without moving other entries", () => {
    const tips = [
      { slug: "every-other-needle-swatch", category: "gauge-swatching" },
      { slug: "cut-and-sew-shaping", category: "edges-finishing-assembly" },
      { slug: "no-category" },
    ];
    expect(helpHubTipsInCategory(tips, "gauge-swatching")).toEqual([tips[0]]);
    expect(helpHubTipsInCategory(tips, "edges-finishing-assembly")).toEqual([tips[1]]);
    expect(helpHubTipsInCategory(tips, "machines")).toEqual([]);
  });
});
