import { describe, expect, it } from "vitest";
import { EBOOK_SALES_PAUSED } from "./legacyEbookSalesHold";
import { isLegacyEbookTemporarilyUnavailable } from "./legacyEbookStorefrontUi";

describe("EBOOK_SALES_PAUSED", () => {
  it("is a boolean flag that can be flipped to restore sales", () => {
    expect(typeof EBOOK_SALES_PAUSED).toBe("boolean");
  });

  it("marks every eBook unavailable while the global pause is on", () => {
    if (!EBOOK_SALES_PAUSED) return;
    expect(isLegacyEbookTemporarilyUnavailable("416")).toBe(true);
    expect(isLegacyEbookTemporarilyUnavailable("589")).toBe(true);
    expect(isLegacyEbookTemporarilyUnavailable("99999")).toBe(true);
  });
});
