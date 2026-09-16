import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  helpHubCategoryChoices,
  helpHubCategoryLabel,
  helpHubJsonSeedCategories,
  helpHubTipsInCategory,
} from "./categories";

const PRESERVED_KEYS = [
  "machine-not-working",
  "edges-finishing-assembly",
  "shaping-fit-problems",
  "pattern-design-confusion",
  "getting-started",
  "machines",
] as const;

const PRESERVED_IDS: Record<(typeof PRESERVED_KEYS)[number], number> = {
  "machine-not-working": 1,
  "edges-finishing-assembly": 3,
  "shaping-fit-problems": 4,
  "pattern-design-confusion": 5,
  "getting-started": 6,
  machines: 7,
};

describe("Help Hub categories", () => {
  const seed = helpHubJsonSeedCategories();
  const choices = helpHubCategoryChoices(seed);
  const keys = choices.map((choice) => choice.key);

  it("keeps existing stored keys, display labels, and IDs", () => {
    expect(keys).toEqual(expect.arrayContaining([...PRESERVED_KEYS]));
    expect(helpHubCategoryLabel("getting-started", seed)).toBe("Getting Started");
    expect(helpHubCategoryLabel("machines", seed)).toBe("Machines");
    expect(helpHubCategoryLabel("machine-not-working", seed)).toBe("Something’s Not Working");
    for (const key of PRESERVED_KEYS) {
      expect(seed.find((choice) => choice.key === key)?.id).toBe(PRESERVED_IDS[key]);
    }
    expect(seed.find((choice) => choice.key === "gauge-swatching")?.id).toBe(8);
  });

  it("places Gauge & Swatching after Getting Started and before Machines", () => {
    const started = keys.indexOf("getting-started");
    const gauge = keys.indexOf("gauge-swatching");
    const machines = keys.indexOf("machines");
    expect(started).toBeGreaterThanOrEqual(0);
    expect(gauge).toBe(started + 1);
    expect(machines).toBe(gauge + 1);
    expect(helpHubCategoryLabel("gauge-swatching", seed)).toBe("Gauge & Swatching");
  });

  it("adds LK150 after Machines with a new ID", () => {
    const machines = keys.indexOf("machines");
    const lk150 = keys.indexOf("lk150");
    expect(machines).toBeGreaterThanOrEqual(0);
    expect(lk150).toBe(machines + 1);
    expect(helpHubCategoryLabel("lk150", seed)).toBe("LK150");
    expect(choices.find((choice) => choice.key === "lk150")).toEqual(
      expect.objectContaining({ id: 9, key: "lk150", label: "LK150" }),
    );
  });

  it("retains My Knitting Doesn’t Look Right as a retired seed key without offering it", () => {
    expect(keys).not.toContain("knitting-doesnt-look-right");
    expect(choices.some((choice) => /doesn.t look right/i.test(choice.label))).toBe(false);
    const retired = seed.find((choice) => choice.key === "knitting-doesnt-look-right");
    expect(retired?.id).toBe(2);
    expect(retired?.retiredAt).toBeTruthy();
    expect(helpHubCategoryLabel("knitting-doesnt-look-right", seed)).toBe(
      "My Knitting Doesn’t Look Right",
    );
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

  it("assigns local LK150 bundled entries and has no look-right assignments", () => {
    const snapshot = JSON.parse(
      readFileSync(join(dirname(fileURLToPath(import.meta.url)), "..", "..", "data", "help-hub.json"), "utf8"),
    ) as { slug?: string; category?: string }[];
    expect(snapshot.filter((row) => row.category === "knitting-doesnt-look-right")).toEqual([]);
    expect(snapshot.find((row) => row.slug === "how-do-i-knit-tuck-stitch-on-my-lk150")?.category).toBe(
      "lk150",
    );
    expect(snapshot.find((row) => row.slug === "slip-stitch-on-the-lk150")?.category).toBe("lk150");
  });
});
