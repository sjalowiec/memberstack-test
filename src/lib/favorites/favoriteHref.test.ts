import { describe, expect, it } from "vitest";
import { normalizeFavoriteHref, titleFromFavoriteHref } from "./favoriteHref";

describe("favoriteHref", () => {
  it("normalizes reference paths", () => {
    expect(normalizeFavoriteHref("/reference/abbreviations/")).toBe("/reference/abbreviations");
    expect(normalizeFavoriteHref("glossary")).toBe("/glossary");
    expect(normalizeFavoriteHref("")).toBeNull();
  });

  it("builds a readable title from a path", () => {
    expect(titleFromFavoriteHref("/reference/yarn-weight")).toBe("Yarn Weight");
  });
});
