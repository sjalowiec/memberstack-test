import { describe, expect, it } from "vitest";
import {
  isFavoriteContentType,
  normalizeFavoriteContentId,
} from "./favoriteContentTypes";

describe("favoriteContentTypes", () => {
  it("recognizes video only in version one", () => {
    expect(isFavoriteContentType("video")).toBe(true);
    expect(isFavoriteContentType("skill-builder")).toBe(false);
  });

  it("normalizes content ids to strings", () => {
    expect(normalizeFavoriteContentId(7)).toBe("7");
    expect(normalizeFavoriteContentId("  x  ")).toBe("x");
    expect(normalizeFavoriteContentId("")).toBeNull();
  });
});
