import { describe, expect, it } from "vitest";
import {
  isFavoriteContentType,
  normalizeFavoriteContentId,
} from "./favoriteContentTypes";

describe("favoriteContentTypes", () => {
  it("recognizes supported content types", () => {
    expect(isFavoriteContentType("video")).toBe(true);
    expect(isFavoriteContentType("stitch")).toBe(true);
    expect(isFavoriteContentType("reference")).toBe(true);
    expect(isFavoriteContentType("tool")).toBe(true);
    expect(isFavoriteContentType("stitches")).toBe(false);
    expect(isFavoriteContentType("skill-builder")).toBe(false);
  });

  it("normalizes content ids to strings", () => {
    expect(normalizeFavoriteContentId(7)).toBe("7");
    expect(normalizeFavoriteContentId("  x  ")).toBe("x");
    expect(normalizeFavoriteContentId("")).toBeNull();
  });
});
