import { describe, expect, it } from "vitest";
import { hidePrintableBuyNow } from "./printableProductBuyNow";

describe("hidePrintableBuyNow", () => {
  it("hides Buy Now only for active members when the product is included with membership", () => {
    expect(hidePrintableBuyNow(true, "memberAccess")).toBe(true);
  });

  it("keeps Buy Now for guests and logged-in non-members", () => {
    expect(hidePrintableBuyNow(true, "loggedOut")).toBe(false);
    expect(hidePrintableBuyNow(true, "loggedInNoAccess")).toBe(false);
    expect(hidePrintableBuyNow(true, null)).toBe(false);
  });

  it("keeps Buy Now when the product is not included with membership", () => {
    expect(hidePrintableBuyNow(false, "memberAccess")).toBe(false);
    expect(hidePrintableBuyNow(false, "loggedOut")).toBe(false);
  });
});
