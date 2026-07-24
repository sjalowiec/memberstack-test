import { describe, expect, it } from "vitest";

import {
  classifyShopifyOrder,
  isDesignaKnitLineItem,
  KNOWN_DESIGNAKNIT_HANDLES,
  orderTagsIndicateDesignaKnit,
} from "./shopifyOrderClassify";

describe("shopifyOrderClassify", () => {
  it("classifies known DesignaKnit handles", () => {
    for (const handle of KNOWN_DESIGNAKNIT_HANDLES) {
      expect(isDesignaKnitLineItem({ productHandle: handle, title: "Other" })).toBe(true);
    }
  });

  it("classifies DesignaKnit by title even without handle", () => {
    expect(
      isDesignaKnitLineItem({ title: "DesignaKnit Machine Pro", productHandle: null }),
    ).toBe(true);
  });

  it("does not classify ordinary KIN products as DesignaKnit", () => {
    expect(
      isDesignaKnitLineItem({
        title: "Add a Hood to Any Knitting Pattern",
        productHandle: "add-a-hood-to-any-knitting-pattern",
        vendor: "Knit it Now",
      }),
    ).toBe(false);
  });

  it("classifies order from tags when line items lack DAK cues", () => {
    expect(orderTagsIndicateDesignaKnit("digital, designaknit")).toBe(true);
    const result = classifyShopifyOrder({
      lineItems: [{ title: "Misc accessory" }],
      tags: "designaknit",
    });
    expect(result).toEqual({ isDesignaknit: true, siteBrand: "designaknit" });
  });

  it("defaults to knit_it_now", () => {
    expect(
      classifyShopifyOrder({
        lineItems: [{ title: "BrotherLink 5 USB Cable", productHandle: "brotherlink-5-usb-cable" }],
        tags: "",
      }),
    ).toEqual({ isDesignaknit: false, siteBrand: "knit_it_now" });
  });
});
