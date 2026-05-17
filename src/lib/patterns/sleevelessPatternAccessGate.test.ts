import { describe, expect, it } from "vitest";
import { resolveHasAdvancedPatternAccess } from "./sleevelessPatternAccessGate";

describe("resolveHasAdvancedPatternAccess", () => {
  it("returns true when advanced=1 query param is set", () => {
    expect(resolveHasAdvancedPatternAccess(new URL("https://example.test/review?advanced=1"))).toBe(true);
  });

  it("returns false when advanced=0 query param is set", () => {
    expect(resolveHasAdvancedPatternAccess(new URL("https://example.test/review?advanced=0"))).toBe(false);
  });

  it("defaults to false when no override is present", () => {
    expect(resolveHasAdvancedPatternAccess(new URL("https://example.test/review"))).toBe(false);
  });
});
