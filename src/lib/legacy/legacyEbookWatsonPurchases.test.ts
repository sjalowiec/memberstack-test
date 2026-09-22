import { describe, expect, it, vi } from "vitest";
import { listApprovedLegacyEbookItemIds } from "./legacyEbookEntitlements";
import {
  LEGACY_EBOOK_WATSON_PURCHASES_BY_MEMBERID_SQL,
  LEGACY_EBOOK_WATSON_PURCHASES_SQL,
  isLegacyStoreTransactionPaid,
  legacyEbookEmailLookupKeys,
  loadLegacyEbookPurchasesFromWatson,
  loadLegacyEbookPurchasesFromWatsonByMemberid,
  normalizeTrustedLegacyMemberid,
  shouldReadLegacyEbooksFromWatson,
  watsonEbookRowToPurchase,
  type WatsonEbookPurchaseRow,
} from "./legacyEbookWatsonPurchases";

function row(
  partial: Partial<WatsonEbookPurchaseRow> = {},
): WatsonEbookPurchaseRow {
  return {
    storetransactionid: 29763,
    purchasedate: "2026-04-03T22:24:49.637Z",
    billing_email: "karen.l.wylie@gmail.com",
    billing_firstname: "Karen",
    billing_lastname: "Wylie",
    paid: 1,
    itemid: 675,
    itemname: "Decorative Raglan Seams for Machine Knitters",
    priceperitem: "14.9900",
    totalprice: "14.9900",
    ...partial,
  };
}

describe("shouldReadLegacyEbooksFromWatson", () => {
  it("is off when WATSON_DATABASE_URL is missing", () => {
    expect(
      shouldReadLegacyEbooksFromWatson({
        CONTEXT: "branch-deploy",
      }),
    ).toBe(false);
  });

  it("is off on production even when the database URL is set", () => {
    expect(
      shouldReadLegacyEbooksFromWatson({
        WATSON_DATABASE_URL: "postgresql://example",
        CONTEXT: "production",
        SITE_NAME: "knititnow",
      }),
    ).toBe(false);
  });

  it("is on for local/dev when CONTEXT is unset", () => {
    expect(
      shouldReadLegacyEbooksFromWatson({
        WATSON_DATABASE_URL: "postgresql://example",
      }),
    ).toBe(true);
  });

  it("is on for kin-dev even when CONTEXT=production", () => {
    expect(
      shouldReadLegacyEbooksFromWatson({
        WATSON_DATABASE_URL: "postgresql://example",
        CONTEXT: "production",
        SITE_NAME: "kin-dev",
      }),
    ).toBe(true);
  });

  it("honors an explicit off flag on DEV", () => {
    expect(
      shouldReadLegacyEbooksFromWatson({
        WATSON_DATABASE_URL: "postgresql://example",
        CONTEXT: "branch-deploy",
        LEGACY_EBOOK_WATSON_LOOKUP: "false",
      }),
    ).toBe(false);
  });

  it("honors an explicit on flag for a reviewed production deploy", () => {
    expect(
      shouldReadLegacyEbooksFromWatson({
        WATSON_DATABASE_URL: "postgresql://example",
        CONTEXT: "production",
        SITE_NAME: "knititnow",
        LEGACY_EBOOK_WATSON_LOOKUP: "true",
      }),
    ).toBe(true);
  });
});

describe("legacy ebook Watson purchase mapping", () => {
  it("requires paid = 1", () => {
    expect(isLegacyStoreTransactionPaid(1)).toBe(true);
    expect(isLegacyStoreTransactionPaid("1")).toBe(true);
    expect(isLegacyStoreTransactionPaid(0)).toBe(false);
    expect(isLegacyStoreTransactionPaid("0")).toBe(false);
    expect(isLegacyStoreTransactionPaid(null)).toBe(false);
    expect(watsonEbookRowToPurchase(row({ paid: 0 }))).toBeNull();
  });

  it("drops unapproved item IDs", () => {
    expect(watsonEbookRowToPurchase(row({ itemid: 687 }))).toBeNull();
    expect(watsonEbookRowToPurchase(row({ itemid: 520 }))).toBeNull();
    expect(watsonEbookRowToPurchase(row({ itemid: 621 }))).toBeNull();
  });

  it("drops rows without a billing email unless a trusted owner email is supplied", () => {
    expect(watsonEbookRowToPurchase(row({ billing_email: null, itemid: 505 }))).toBeNull();
    expect(watsonEbookRowToPurchase(row({ billing_email: "  ", itemid: 416 }))).toBeNull();
    expect(
      watsonEbookRowToPurchase(row({ billing_email: null, itemid: 505 }), {
        ownerEmail: "texas44@gmail.com",
      }),
    ).toMatchObject({
      billingEmail: "texas44@gmail.com",
      paid: "1",
      legacyItemId: "505",
    });
  });

  it("attributes an old billing email to the authenticated owner on the member-ID path", () => {
    expect(
      watsonEbookRowToPurchase(
        row({
          billing_email: "texas44@comcast.net",
          itemid: 416,
        }),
        { ownerEmail: "texas44@gmail.com" },
      ),
    ).toMatchObject({
      billingEmail: "texas44@gmail.com",
      legacyItemId: "416",
    });
  });

  it("maps Karen's paid ebook rows", () => {
    const mapped = watsonEbookRowToPurchase(row());
    expect(mapped).toMatchObject({
      storeTransactionId: "29763",
      billingEmail: "karen.l.wylie@gmail.com",
      paid: "1",
      legacyItemId: "675",
      itemName: "Decorative Raglan Seams for Machine Knitters",
    });
  });

  it("includes Gmail aliases for lookup only", () => {
    expect(legacyEbookEmailLookupKeys("Karen.L.Wylie@Gmail.com")).toEqual([
      "karen.l.wylie@gmail.com",
      "karen.l.wylie@googlemail.com",
    ]);
  });

  it("SELECT requires paid=1 and approved catalog item IDs", () => {
    expect(LEGACY_EBOOK_WATSON_PURCHASES_SQL).toContain("t.paid = 1");
    expect(LEGACY_EBOOK_WATSON_PURCHASES_SQL).toContain("i.itemid = ANY($1::int[])");
    expect(LEGACY_EBOOK_WATSON_PURCHASES_SQL).toContain(
      "LOWER(TRIM(t.billing_email)) = ANY($2::text[])",
    );
    expect(LEGACY_EBOOK_WATSON_PURCHASES_BY_MEMBERID_SQL).toContain("t.paid = 1");
    expect(LEGACY_EBOOK_WATSON_PURCHASES_BY_MEMBERID_SQL).toContain(
      "i.itemid = ANY($1::int[])",
    );
    expect(LEGACY_EBOOK_WATSON_PURCHASES_BY_MEMBERID_SQL).toContain("t.memberid_fk = $2");
    expect(LEGACY_EBOOK_WATSON_PURCHASES_BY_MEMBERID_SQL).not.toContain(
      "LOWER(TRIM(t.billing_email))",
    );
    expect(listApprovedLegacyEbookItemIds()).toEqual(
      expect.arrayContaining([505, 675, 416]),
    );
    expect(listApprovedLegacyEbookItemIds()).not.toContain(687);
    expect(listApprovedLegacyEbookItemIds()).not.toContain(520);
    expect(listApprovedLegacyEbookItemIds()).not.toContain(621);
  });
});

describe("loadLegacyEbookPurchasesFromWatson", () => {
  it("does not query when the email is empty", async () => {
    const queryFn = vi.fn();
    await expect(loadLegacyEbookPurchasesFromWatson("  ", queryFn)).resolves.toEqual(
      [],
    );
    expect(queryFn).not.toHaveBeenCalled();
  });

  it("filters unpaid, yarn, excluded, and blank-email rows from the query result", async () => {
    const queryFn = vi.fn().mockResolvedValue([
      row({ paid: 0, itemid: 505 }),
      row({ itemid: 687, itemname: "Mousam Falls 4/6 Aran" }),
      row({ billing_email: null, itemid: 505, totalprice: "0.0000" }),
      row({ itemid: 520, itemname: "Mitten Magic" }),
      row({ itemid: 505, itemname: "Machine Knitting Trims and Edges - Single Bed" }),
      row(),
    ]);

    const purchases = await loadLegacyEbookPurchasesFromWatson(
      "karen.l.wylie@gmail.com",
      queryFn,
    );

    expect(queryFn).toHaveBeenCalledTimes(1);
    const [, params] = queryFn.mock.calls[0];
    expect(params[0]).toEqual(expect.arrayContaining([505, 675]));
    expect(params[1]).toEqual([
      "karen.l.wylie@gmail.com",
      "karen.l.wylie@googlemail.com",
    ]);
    expect(purchases.map((p) => p.legacyItemId).sort()).toEqual(["505", "675"]);
  });
});

describe("normalizeTrustedLegacyMemberid", () => {
  it("rejects empty values, emails, and Memberstack IDs", () => {
    expect(normalizeTrustedLegacyMemberid("  ")).toBeNull();
    expect(normalizeTrustedLegacyMemberid("texas44@gmail.com")).toBeNull();
    expect(normalizeTrustedLegacyMemberid("mem_from_browser")).toBeNull();
    expect(normalizeTrustedLegacyMemberid("mem_cmub5343c00eo0ttp7wsv63aa")).toBeNull();
    expect(
      normalizeTrustedLegacyMemberid("6ECD81B4-B172-04D6-2FDF-9D46FFB6B909"),
    ).toBe("6ECD81B4-B172-04D6-2FDF-9D46FFB6B909");
  });
});

describe("loadLegacyEbookPurchasesFromWatsonByMemberid", () => {
  it("does not query when the member ID or owner email is empty", async () => {
    const queryFn = vi.fn();
    await expect(
      loadLegacyEbookPurchasesFromWatsonByMemberid("  ", "texas44@gmail.com", queryFn),
    ).resolves.toEqual([]);
    await expect(
      loadLegacyEbookPurchasesFromWatsonByMemberid(
        "6ECD81B4-B172-04D6-2FDF-9D46FFB6B909",
        "  ",
        queryFn,
      ),
    ).resolves.toEqual([]);
    await expect(
      loadLegacyEbookPurchasesFromWatsonByMemberid(
        "mem_spoof",
        "texas44@gmail.com",
        queryFn,
      ),
    ).resolves.toEqual([]);
    expect(queryFn).not.toHaveBeenCalled();
  });

  it("keeps blank-email and old-email paid approved rows and drops excluded or non-ebook items", async () => {
    const queryFn = vi.fn().mockResolvedValue([
      row({ paid: 0, itemid: 505, billing_email: null }),
      row({ itemid: 687, itemname: "Mousam Falls 4/6 Aran", billing_email: null }),
      row({ itemid: 621, itemname: "Passap E-6000 Guidebook", billing_email: "texas44@comcast.net" }),
      row({ itemid: 737, itemname: "Japanese Patterns", billing_email: null }),
      row({ billing_email: null, itemid: 505, totalprice: "0.0000" }),
      row({
        billing_email: "texas44@comcast.net",
        itemid: 416,
        itemname: "Cheat Sheets",
      }),
      row(),
    ]);

    const purchases = await loadLegacyEbookPurchasesFromWatsonByMemberid(
      "6ECD81B4-B172-04D6-2FDF-9D46FFB6B909",
      "texas44@gmail.com",
      queryFn,
    );

    expect(queryFn).toHaveBeenCalledTimes(1);
    const [sql, params] = queryFn.mock.calls[0];
    expect(sql).toBe(LEGACY_EBOOK_WATSON_PURCHASES_BY_MEMBERID_SQL);
    expect(params[0]).toEqual(expect.arrayContaining([505, 675, 416]));
    expect(params[0]).not.toContain(621);
    expect(params[1]).toBe("6ECD81B4-B172-04D6-2FDF-9D46FFB6B909");
    expect(purchases.map((p) => p.legacyItemId).sort()).toEqual(["416", "505", "675"]);
    expect(purchases.every((p) => p.billingEmail === "texas44@gmail.com")).toBe(true);
  });
});
