import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { DROP_SHOULDER_SLEEVE_LENGTH_CHOICES } from "./patternConstructionIdentity";
import { HAT_BUILDER_ALLOWED_CROWNS } from "./hat/hatBuilderValidation";
import { HAT_BRIM_TYPES, HAT_NAMED_FIT_STYLES } from "./hat/hatMath";
import {
  DROP_SHOULDER_CATALOG_PILL_REST,
  DROP_SHOULDER_PATTERN_POSSIBILITIES,
  HAT_CATALOG_PILL_REST,
  HAT_PATTERN_POSSIBILITIES,
  SLEEVELESS_CATALOG_BODY_SHAPES,
  SLEEVELESS_CATALOG_PILL_REST,
  SLEEVELESS_PATTERN_POSSIBILITIES,
  SWEATER_CATALOG_AUDIENCES,
  SWEATER_CATALOG_FRONT_STYLES,
  SWEATER_CATALOG_NECKLINES,
} from "./patternCatalogPossibilities";

const catalog = readFileSync(resolve("src/pages/patterns/index.astro"), "utf8");
const whoPicker = readFileSync(
  resolve("src/components/patterns/ExpressBuilderWhoPicker.astro"),
  "utf8",
);
const sleevelessBuilder = readFileSync(
  resolve("src/pages/patterns/sleeveless/builder.astro"),
  "utf8",
);
const sleevelessCustomStyle = readFileSync(
  resolve("src/pages/patterns/sleeveless/custom-style.astro"),
  "utf8",
);
const hatBuilder = readFileSync(resolve("src/pages/patterns/hat/builder.astro"), "utf8");
const dropShoulderBuilder = readFileSync(
  resolve("src/pages/patterns/drop-shoulder/builder.astro"),
  "utf8",
);

describe("pattern catalog possibility counts", () => {
  it("counts sleeveless as 4 audiences × 2 fronts × 2 necklines × 2 body shapes = 32", () => {
    expect(SWEATER_CATALOG_AUDIENCES).toEqual(["women", "men", "kids", "baby"]);
    expect(SWEATER_CATALOG_FRONT_STYLES).toEqual(["pullover", "cardigan"]);
    expect(SWEATER_CATALOG_NECKLINES).toEqual(["round", "v-neck"]);
    expect(SLEEVELESS_CATALOG_BODY_SHAPES).toEqual(["straight", "aline"]);
    expect(SLEEVELESS_PATTERN_POSSIBILITIES).toBe(32);

    for (const who of SWEATER_CATALOG_AUDIENCES) {
      expect(whoPicker).toContain(`value: "${who}"`);
    }
    expect(sleevelessBuilder).toContain('data-value="closed"');
    expect(sleevelessBuilder).toContain('data-value="open"');
    expect(sleevelessBuilder).toContain('data-value="round"');
    expect(sleevelessBuilder).toContain('data-value="v-neck"');
    expect(sleevelessCustomStyle).toContain('data-cb-style-value="straight"');
    expect(sleevelessCustomStyle).toContain('data-cb-style-value="aline"');
    expect(sleevelessCustomStyle).toContain("cb-style-option--disabled");
    expect(sleevelessCustomStyle).toContain('data-cb-style-value="shaped"');
  });

  it("counts hat as 3 brims × 3 crowns × 3 lengths = 27, without audience categories", () => {
    expect(HAT_BRIM_TYPES).toEqual(["rolled", "single", "folded"]);
    expect(HAT_BUILDER_ALLOWED_CROWNS).toEqual(["gathered", "wedge-4-decrease", "spiral"]);
    expect(HAT_NAMED_FIT_STYLES).toEqual(["beanie", "watchcap", "slouchy"]);
    expect(HAT_PATTERN_POSSIBILITIES).toBe(27);
    expect(HAT_PATTERN_POSSIBILITIES).toBe(
      HAT_BRIM_TYPES.length * HAT_BUILDER_ALLOWED_CROWNS.length * HAT_NAMED_FIT_STYLES.length,
    );
    expect(HAT_PATTERN_POSSIBILITIES).not.toBe(
      SWEATER_CATALOG_AUDIENCES.length *
        HAT_BRIM_TYPES.length *
        HAT_BUILDER_ALLOWED_CROWNS.length *
        HAT_NAMED_FIT_STYLES.length,
    );

    for (const brim of HAT_BRIM_TYPES) {
      expect(hatBuilder).toContain(`data-value="${brim}"`);
    }
    for (const crown of HAT_BUILDER_ALLOWED_CROWNS) {
      expect(hatBuilder).toContain(`data-value="${crown}"`);
    }
    for (const fit of HAT_NAMED_FIT_STYLES) {
      expect(hatBuilder).toContain(`data-value="${fit}"`);
    }
    expect(hatBuilder).not.toContain('data-value="hung-hem"');
    expect(hatBuilder).not.toContain('data-value="wedge-4"');
  });

  it("counts drop shoulder as 4 audiences × 2 fronts × 2 necklines × 4 sleeve lengths = 64", () => {
    expect(DROP_SHOULDER_SLEEVE_LENGTH_CHOICES).toEqual([
      "long",
      "three-quarter",
      "elbow",
      "short",
    ]);
    expect(DROP_SHOULDER_PATTERN_POSSIBILITIES).toBe(64);
    expect(DROP_SHOULDER_PATTERN_POSSIBILITIES).not.toBe(128);

    expect(dropShoulderBuilder).toContain("ExpressBuilderWhoSizeSection");
    expect(dropShoulderBuilder).toContain('data-value="closed"');
    expect(dropShoulderBuilder).toContain('data-value="open"');
    expect(dropShoulderBuilder).toContain('data-value="round"');
    expect(dropShoulderBuilder).toContain('data-value="v-neck"');
    for (const length of DROP_SHOULDER_SLEEVE_LENGTH_CHOICES) {
      expect(dropShoulderBuilder).toContain(`data-value="${length}"`);
    }
    expect(dropShoulderBuilder).not.toContain("data-cb-style-group=\"bodyShape\"");
  });

  it("shows compact count pills on available cards and leaves Coming soon unchanged", () => {
    expect(catalog).toContain("pattern.pillCount");
    expect(catalog).toContain("pattern.pillRest");
    expect(catalog).toContain("catalog-card__status-count");
    expect(catalog).toContain("catalog-card__status-rest");
    expect(catalog).toContain("font-size: 1.6em");
    expect(catalog).not.toContain("Pattern Possibilities");
    expect(catalog).not.toContain("PATTERN POSSIBILITIES");
    expect(catalog).not.toContain("possibilitiesHelper");
    expect(catalog).not.toContain("catalog-card__possibilities-note");
    expect(catalog).not.toContain("4 audiences ×");
    expect(catalog).not.toContain("3 brim styles ×");
    expect(catalog).not.toMatch(
      /catalog-card__status--available">Available now<\/span>/,
    );
    expect(catalog).toContain('catalog-card__status catalog-card__status--soon">Coming soon</span>');
    expect(catalog).toContain("title: 'Raglan Sweater'");
    expect(catalog).toContain("title: 'Set-In Sleeve Sweater'");
  });

  it("uses the approved short pill copy with no formulas or helper lines", () => {
    expect(SLEEVELESS_PATTERN_POSSIBILITIES).toBe(32);
    expect(HAT_PATTERN_POSSIBILITIES).toBe(27);
    expect(DROP_SHOULDER_PATTERN_POSSIBILITIES).toBe(64);
    expect(SLEEVELESS_CATALOG_PILL_REST).toBe("Styles in 1 Builder");
    expect(HAT_CATALOG_PILL_REST).toBe("Hats in 1 Builder");
    expect(DROP_SHOULDER_CATALOG_PILL_REST).toBe("Patterns for Anyone");
    expect(SLEEVELESS_CATALOG_PILL_REST).not.toMatch(/×/);
    expect(HAT_CATALOG_PILL_REST).not.toMatch(/×/);
    expect(DROP_SHOULDER_CATALOG_PILL_REST).not.toMatch(/×/);
  });
});
