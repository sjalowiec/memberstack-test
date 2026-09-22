import { describe, expect, it } from "vitest";

import { buildCustomerEbookLibraryItems } from "./customerEbookLibrary";
import type { WatsonEbookEntitlementRow } from "./ebookEntitlements";

describe("customer ebook library merge", () => {
  it("collapses a paid purchase and a manual grant for the same title", () => {
    const items = buildCustomerEbookLibraryItems({
      purchases: [
        {
          itemId: "416",
          title: "Cheat Sheets for Hand Manipulated Stitch Patterns",
          downloadUrl: "/downloads/shop/cheet_sheet_book2.pdf",
        },
      ],
      grants: [
        {
          id: "ent_1",
          item_id: "416",
          memberstack_id: "mem_abc123",
          entitlement_email: "owner@example.com",
          legacy_memberid: "M1",
          reason: "manual_correction",
          note: null,
          source_storetransactionid: null,
          granted_by: "Sue",
          granted_at: "2026-09-21T12:00:00.000Z",
          revoked_by: null,
          revoked_at: null,
        } satisfies WatsonEbookEntitlementRow,
      ],
    });

    expect(items).toHaveLength(1);
    expect(items[0]?.sources).toEqual(["purchase", "grant"]);
    expect(items[0]?.purchase).toBe(true);
    expect(items[0]?.canRevoke).toBe(true);
  });

  it("does not allow revoking a purchase-only title", () => {
    const items = buildCustomerEbookLibraryItems({
      purchases: [
        {
          itemId: "416",
          title: "Cheat Sheets for Hand Manipulated Stitch Patterns",
          downloadUrl: "/downloads/shop/cheet_sheet_book2.pdf",
        },
      ],
      grants: [],
    });
    expect(items[0]?.canRevoke).toBe(false);
  });
});
