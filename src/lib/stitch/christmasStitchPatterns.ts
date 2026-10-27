/**
 * Christmas stitch collection.
 * Patterns stay in the stitch catalog. This list only gathers Christmas 1, 2, and 3.
 * Pattern pages at /stitch/{id} keep the existing chart and member-download rules.
 */
import { getStitchCatalogItems, type StitchCatalogItem } from "../stitch-data";

export const CHRISTMAS_STITCH_PATTERNS_PATH = "/stitch/christmas";

export const CHRISTMAS_STITCH_PATTERNS_TITLE = "Christmas Stitch Patterns";

export const CHRISTMAS_STITCH_PATTERNS_INTRO =
  "Browse Knit It Now’s Christmas stitch patterns in one collection. Open any pattern for its chart. Downloadable files follow the same membership rules as the Stitch Browser.";

export const CHRISTMAS_STITCH_PATTERNS_LINK_LABEL = "Browse Christmas stitch patterns";

/** Technique titles from src/data/stitch/techniques.json. Not a separate pattern library. */
export const CHRISTMAS_STITCH_TECHNIQUE_TITLES = ["Christmas 1", "Christmas 2", "Christmas 3"] as const;

export function christmasStitchPatternHref(id: number): string {
  return `/stitch/${id}`;
}

/** Catalog rows for the three Christmas techniques, in title order. */
export function getChristmasStitchPatterns(): StitchCatalogItem[] {
  const titles = new Set<string>(CHRISTMAS_STITCH_TECHNIQUE_TITLES);
  return getStitchCatalogItems()
    .filter((item) => titles.has(item.techniqueTitle))
    .sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: "base" }));
}
