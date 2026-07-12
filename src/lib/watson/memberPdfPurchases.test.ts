import { describe, expect, it, vi } from "vitest";

import {
  buildPdfPurchaseDisplay,
  getMemberPdfPurchaseCount,
  getMemberPdfPurchases,
  getVisiblePdfPurchaseColumns,
  MEMBER_PDF_PURCHASE_COUNT_SQL,
  MEMBER_PDF_PURCHASES_SQL,
  MEMBER_PDF_PURCHASE_SORTABLE_COLUMNS,
} from "./memberPdfPurchases";

describe("memberPdfPurchases", () => {
  const memberId = "3B43FD8E-A9F3-4B1A-74CC-255ACCD77E11";

  const firstRow = {
    pattern_library_purchases: 1,
    transactionguid: "D6882858-D701-9B03-1DB1-A562508FE7FE",
    dateadded: "2010-05-26T17:32:47.920Z",
    memberid_fk: memberId,
    patternlibarry_id: 27,
    vendorpaid: 0,
    title: "Sample PDF Pattern",
    filename: "sample.pdf",
    patterntype: "Machine",
    cost: "5.00",
    netcost: "0.00",
    active: 0,
    freewithsubscription: 1,
    transaction_total: null,
  };

  const secondRow = {
    pattern_library_purchases: 7,
    transactionguid: "6D4A3551-01F6-F8C9-9763-D8B0A00397D6",
    dateadded: "2010-06-25T00:07:47.747Z",
    memberid_fk: memberId,
    patternlibarry_id: 29,
    vendorpaid: 0,
    title: null,
    filename: null,
    patterntype: null,
    cost: null,
    netcost: null,
    active: null,
    freewithsubscription: null,
    transaction_total: "5.00",
  };

  it("filters PDF purchases by memberid_fk", async () => {
    const queryFn = vi.fn().mockResolvedValueOnce([]);

    await getMemberPdfPurchases(memberId, queryFn);

    expect(queryFn).toHaveBeenCalledWith(MEMBER_PDF_PURCHASES_SQL, [memberId]);
    expect(MEMBER_PDF_PURCHASES_SQL).toContain("legacy_pattern_library_purchases");
    expect(MEMBER_PDF_PURCHASES_SQL).toContain("WHERE p.memberid_fk = $1");
    expect(MEMBER_PDF_PURCHASES_SQL).toContain("legacy_pattern_library");
  });

  it("defaults to newest dateadded first in SQL", () => {
    expect(MEMBER_PDF_PURCHASES_SQL).toContain(
      "ORDER BY p.dateadded DESC NULLS LAST, p.pattern_library_purchases DESC",
    );
  });

  it("counts PDF purchase records without loading full rows on the detail page", async () => {
    const queryFn = vi.fn().mockResolvedValueOnce([{ purchase_count: "3" }]);

    const count = await getMemberPdfPurchaseCount(memberId, queryFn);

    expect(queryFn).toHaveBeenCalledWith(MEMBER_PDF_PURCHASE_COUNT_SQL, [memberId]);
    expect(count).toBe(3);
  });

  it("exposes sortable PDF purchase columns for the UI", () => {
    expect(MEMBER_PDF_PURCHASE_SORTABLE_COLUMNS).toContain("purchaseRecordId");
    expect(MEMBER_PDF_PURCHASE_SORTABLE_COLUMNS).toContain("pdfTitle");
    expect(MEMBER_PDF_PURCHASE_SORTABLE_COLUMNS).toContain("transactionGuid");
  });

  it("preserves multiple historical PDF purchase records", async () => {
    const queryFn = vi.fn().mockResolvedValueOnce([firstRow, secondRow]);

    const records = await getMemberPdfPurchases(memberId, queryFn);

    expect(records).toHaveLength(2);
    expect(records.map((record) => record.purchaseRecordId)).toEqual(["1", "7"]);
  });

  it("handles incomplete legacy data safely", () => {
    const display = buildPdfPurchaseDisplay({
      ...secondRow,
      dateadded: "not-a-date",
      title: "   ",
      transaction_total: "not-a-number",
    });

    expect(display.purchaseDate).toBeNull();
    expect(display.purchaseDateSort).toBe("");
    expect(display.pdfTitle).toBeNull();
    expect(display.amountPaid).toBeNull();
    expect(display.catalogCost).toBeNull();
  });

  it("shows store transaction totals separately from catalog cost", () => {
    const withStoreTotal = buildPdfPurchaseDisplay(secondRow);
    const withCatalogCost = buildPdfPurchaseDisplay(firstRow);

    expect(withStoreTotal.amountPaid).toBe("$5.00");
    expect(withStoreTotal.catalogCost).toBeNull();
    expect(withCatalogCost.catalogCost).toBe("$5.00");
    expect(withCatalogCost.amountPaid).toBeNull();
  });

  it("hides optional columns when a member has no useful values", () => {
    const visible = getVisiblePdfPurchaseColumns([
      buildPdfPurchaseDisplay(firstRow),
      buildPdfPurchaseDisplay(secondRow),
    ]);

    expect(visible.showPdfTitle).toBe(true);
    expect(visible.showAmountPaid).toBe(true);
    expect(visible.showCatalogCost).toBe(true);
    expect(visible.showFilename).toBe(true);
    expect(visible.showPatternType).toBe(true);
  });
});
