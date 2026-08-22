import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  HAT_PATTERN_HERO_IMAGE_ALT,
  HAT_PATTERN_HERO_IMAGE_SRC,
} from "./hatPatternHeroImage";

const builderPage = readFileSync(resolve("src/pages/patterns/hat/builder.astro"), "utf8");
const patternPage = readFileSync(resolve("src/pages/patterns/hat/pattern.astro"), "utf8");

describe("Hat Pattern promotional hero image", () => {
  it("uses one shared square photo on Builder and finished Pattern pages", () => {
    expect(HAT_PATTERN_HERO_IMAGE_SRC).toBe("/images/patterns/hat.png");
    expect(HAT_PATTERN_HERO_IMAGE_ALT).toBe(
      "Fashion-flat illustration of a custom knit hat",
    );
    expect(builderPage).toContain("HAT_PATTERN_HERO_IMAGE_SRC");
    expect(patternPage).toContain("HAT_PATTERN_HERO_IMAGE_SRC");
    expect(builderPage).not.toContain("/images/patterns/basic-hat.webp");
    expect(patternPage).not.toContain("/images/patterns/basic-hat.webp");
    expect(builderPage).toContain("object-fit: contain");
    expect(patternPage).toContain("object-fit: contain");
  });
});
