import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import patterns from "../../data/stitch/patterns.json";
import { getStitchCatalogItems } from "../stitch-data";
import {
  CHRISTMAS_STITCH_PATTERNS_INTRO,
  CHRISTMAS_STITCH_PATTERNS_LINK_LABEL,
  CHRISTMAS_STITCH_PATTERNS_PATH,
  CHRISTMAS_STITCH_PATTERNS_TITLE,
  CHRISTMAS_STITCH_TECHNIQUE_TITLES,
  christmasStitchPatternHref,
  getChristmasStitchPatterns,
} from "./christmasStitchPatterns";

const pageSource = readFileSync(resolve("src/pages/stitch/christmas.astro"), "utf8");

describe("Christmas stitch patterns collection", () => {
  it("gathers the existing Christmas 1, 2, and 3 catalog rows without copying them", () => {
    const catalog = getStitchCatalogItems();
    const titles = new Set<string>(CHRISTMAS_STITCH_TECHNIQUE_TITLES);
    const expected = catalog.filter((item) => titles.has(item.techniqueTitle));
    const patterns = getChristmasStitchPatterns();

    expect(CHRISTMAS_STITCH_TECHNIQUE_TITLES).toEqual(["Christmas 1", "Christmas 2", "Christmas 3"]);
    expect(patterns.length).toBe(expected.length);
    expect(patterns.length).toBeGreaterThan(0);
    expect(new Set(patterns.map((pattern) => pattern.techniqueTitle))).toEqual(titles);
    expect(patterns.map((pattern) => pattern.id).sort((a, b) => a - b)).toEqual(
      expected.map((pattern) => pattern.id).sort((a, b) => a - b),
    );
    for (const title of CHRISTMAS_STITCH_TECHNIQUE_TITLES) {
      expect(patterns.some((pattern) => pattern.techniqueTitle === title)).toBe(true);
    }
    expect(patterns.map((pattern) => christmasStitchPatternHref(pattern.id))).toEqual(
      patterns.map((pattern) => `/stitch/${pattern.id}`),
    );
    expect(pageSource).toContain("getChristmasStitchPatterns");
    expect(pageSource).toContain("christmasStitchPatternHref(pattern.id)");
    expect(pageSource).not.toContain("patterns.json");
    expect(pageSource).not.toContain('data-gated="locked"');
    expect(pageSource).toContain("export const prerender = true");
    expect(CHRISTMAS_STITCH_PATTERNS_PATH).toBe("/stitch/christmas");
    expect(CHRISTMAS_STITCH_PATTERNS_TITLE).toBe("Christmas Stitch Patterns");
    expect(CHRISTMAS_STITCH_PATTERNS_LINK_LABEL).toBe("Browse Christmas stitch patterns");
    expect(pageSource).toContain("{CHRISTMAS_STITCH_PATTERNS_INTRO}");
    expect(pageSource).toContain("{CHRISTMAS_STITCH_PATTERNS_TITLE}");
  });

  it("keeps Border 10 in the stitch data and out of the published catalogs", () => {
    const record = patterns.find((pattern) => pattern.id === 1207);
    expect(record).toMatchObject({
      id: 1207,
      title: "Border10",
      techniqueId: 15,
      stitchMultiple: "11x7",
      punchcard: true,
      active: false,
    });
    expect(getStitchCatalogItems().some((pattern) => pattern.id === 1207)).toBe(false);
    expect(getChristmasStitchPatterns().some((pattern) => pattern.id === 1207)).toBe(false);
    expect(getStitchCatalogItems().some((pattern) => pattern.id === 1206)).toBe(true);
    expect(getChristmasStitchPatterns().some((pattern) => pattern.title === "Border10")).toBe(false);
  });
});
