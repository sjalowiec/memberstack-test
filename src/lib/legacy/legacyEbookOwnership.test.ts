import { describe, expect, it, beforeEach } from "vitest";
import {
  LEGACY_EBOOK_ENTITLEMENT_CATALOG,
  LEGACY_EBOOK_EXCLUDED_ITEM_IDS,
  LEGACY_EBOOK_EXCLUSION_REASON,
  approvedLegacyEbookTitleCount,
  getLegacyEbookEntitlement,
  isLegacyEbookItemApproved,
  isLegacyEbookItemExcluded,
  legacyEbookPublicDownloadUrl,
  normalizeLegacyPurchaseEmail,
  toCustomerLegacyEbookEntitlement,
} from "./legacyEbookEntitlements";
import {
  findMissingLegacyEbookPublicFiles,
  legacyEbookPublicFileExists,
} from "./legacyEbookPublicFileCheck";
import {
  buildApprovedLegacyEbookOwnershipRecords,
  clearLegacyEbookOwnershipIndexCache,
  countApprovedLegacyEbookOwnershipRecords,
  isLegacyEbookPurchasePaid,
  resolveLegacyEbookEntitlementsForEmail,
} from "./legacyEbookOwnership";
import {
  loadLegacyEbookPurchases,
  type LegacyEbookPurchaseRow,
} from "./legacyEbookPurchases";

function purchase(partial: Partial<LegacyEbookPurchaseRow>): LegacyEbookPurchaseRow {
  return {
    storeTransactionId: "1",
    purchaseDate: "2020-01-01",
    billingEmail: "buyer@example.com",
    billingFirstName: "Test",
    billingLastName: "Buyer",
    paid: "1",
    legacyItemId: "416",
    itemName: "Cheat Sheets",
    pricePerItem: "4.99",
    totalPrice: "4.99",
    downloadFile: "cheet_sheet_book2.pdf",
    thumbnail: null,
    active: "1",
    subscriberFree: "0",
    ...partial,
  };
}

describe("normalizeLegacyPurchaseEmail", () => {
  it("trims and lowercases email", () => {
    expect(normalizeLegacyPurchaseEmail("  Jane.Doe@Example.COM ")).toBe(
      "jane.doe@example.com",
    );
  });

  it("returns null for empty or non-string values", () => {
    expect(normalizeLegacyPurchaseEmail("   ")).toBeNull();
    expect(normalizeLegacyPurchaseEmail("")).toBeNull();
    expect(normalizeLegacyPurchaseEmail(null)).toBeNull();
    expect(normalizeLegacyPurchaseEmail(undefined)).toBeNull();
  });
});

describe("legacy ebook entitlement catalog + public files", () => {
  it("includes exactly 47 approved titles each with a download URL", () => {
    expect(approvedLegacyEbookTitleCount()).toBe(47);
    expect(LEGACY_EBOOK_ENTITLEMENT_CATALOG).toHaveLength(47);
    for (const entry of LEGACY_EBOOK_ENTITLEMENT_CATALOG) {
      expect(entry.downloadUrl).toMatch(/^\/downloads\/shop\//);
      expect(entry.downloadUrl.includes("..")).toBe(false);
    }
  });

  it("resolves all 47 download URLs to physical files under public/", () => {
    const missing = findMissingLegacyEbookPublicFiles();
    expect(missing).toEqual([]);
    for (const entry of LEGACY_EBOOK_ENTITLEMENT_CATALOG) {
      expect(legacyEbookPublicFileExists(entry.downloadUrl)).toBe(true);
    }
  });

  it("keeps excluded item IDs out of the approved catalog", () => {
    for (const itemId of LEGACY_EBOOK_EXCLUDED_ITEM_IDS) {
      expect(isLegacyEbookItemExcluded(itemId)).toBe(true);
      expect(isLegacyEbookItemApproved(itemId)).toBe(false);
      expect(getLegacyEbookEntitlement(itemId)).toBeNull();
    }
    expect(LEGACY_EBOOK_EXCLUSION_REASON).toBe(
      "Legacy title unavailable for redistribution",
    );
  });

  it("maps remapped SKUs to recovered/current public URLs", () => {
    expect(getLegacyEbookEntitlement("346")?.downloadUrl).toBe(
      "/downloads/shop/legacy/ultimate_socks.pdf",
    );
    expect(getLegacyEbookEntitlement("346")?.title).toBe(
      "The ULTIMATE Machine Knit Socks",
    );
    expect(getLegacyEbookEntitlement("710")?.downloadUrl).toBe(
      "/downloads/shop/electronic_version10-19-16_electronic.pdf",
    );
    expect(
      legacyEbookPublicFileExists("/downloads/shop/legacy/ultimate_socks.pdf"),
    ).toBe(true);
    expect(
      legacyEbookPublicFileExists(
        "/downloads/shop/electronic_version10-19-16_electronic.pdf",
      ),
    ).toBe(true);
    expect(getLegacyEbookEntitlement("536")?.downloadUrl).toBe(
      "/downloads/shop/legacy/picture_knits_optimized.pdf",
    );
    expect(getLegacyEbookEntitlement("620")?.downloadUrl).toBe(
      "/downloads/shop/legacy/hand_knit_to_machine_knit.pdf",
    );
    expect(getLegacyEbookEntitlement("437")?.downloadUrl).toBe(
      "/downloads/shop/legacy/hearts_flowers1.pdf",
    );
    expect(getLegacyEbookEntitlement("443")?.downloadUrl).toBe(
      "/downloads/shop/legacy/pockets_mini.pdf",
    );
  });

  it("keeps top-down titles on the top-down subfolder path", () => {
    expect(getLegacyEbookEntitlement("425")?.downloadUrl).toBe(
      "/downloads/shop/top-down/top_down_round_everyone.pdf",
    );
    expect(getLegacyEbookEntitlement("483")?.downloadUrl).toBe(
      "/downloads/shop/top-down/v_neck_standard_all.pdf",
    );
  });

  it("URL-encodes spaces in legacy filenames", () => {
    expect(legacyEbookPublicDownloadUrl("legacy", "Love Gloves.pdf")).toBe(
      "/downloads/shop/legacy/Love%20Gloves.pdf",
    );
    expect(getLegacyEbookEntitlement("628")?.downloadUrl).toBe(
      "/downloads/shop/legacy/Love%20Gloves.pdf",
    );
    expect(legacyEbookPublicFileExists("/downloads/shop/legacy/Love%20Gloves.pdf")).toBe(
      true,
    );
  });

  it("customer entitlement includes downloadUrl but not storageKey/active", () => {
    const entry = getLegacyEbookEntitlement("416");
    expect(entry).not.toBeNull();
    const customer = toCustomerLegacyEbookEntitlement(entry!);
    expect(customer).toEqual({
      itemId: "416",
      title: "Cheat Sheets for Hand Manipulated Stitch Patterns",
      downloadUrl: "/downloads/shop/cheet_sheet_book2.pdf",
    });
    expect(customer).not.toHaveProperty("storageKey");
    expect(customer).not.toHaveProperty("active");
  });
});

describe("legacy ebook ownership resolver", () => {
  beforeEach(() => {
    clearLegacyEbookOwnershipIndexCache();
  });

  it("filters to Paid = 1 rows only", () => {
    expect(isLegacyEbookPurchasePaid("1")).toBe(true);
    expect(isLegacyEbookPurchasePaid("0")).toBe(false);

    const records = buildApprovedLegacyEbookOwnershipRecords([
      purchase({ paid: "1", legacyItemId: "416", billingEmail: "a@example.com" }),
      purchase({ paid: "0", legacyItemId: "417", billingEmail: "a@example.com" }),
    ]);
    expect(records.map((r) => r.itemId)).toEqual(["416"]);
  });

  it("collapses duplicate purchases for the same email + item ID", () => {
    const records = buildApprovedLegacyEbookOwnershipRecords([
      purchase({
        storeTransactionId: "10",
        billingEmail: " Same@Example.com ",
        legacyItemId: "416",
      }),
      purchase({
        storeTransactionId: "11",
        billingEmail: "same@example.com",
        legacyItemId: "416",
      }),
      purchase({
        storeTransactionId: "12",
        billingEmail: "same@example.com",
        legacyItemId: "417",
      }),
    ]);
    expect(records).toHaveLength(2);
  });

  it("includes approved items and removes excluded items", () => {
    const records = buildApprovedLegacyEbookOwnershipRecords([
      purchase({ legacyItemId: "416", billingEmail: "x@example.com" }),
      purchase({ legacyItemId: "520", billingEmail: "x@example.com" }),
      purchase({ legacyItemId: "434", billingEmail: "x@example.com" }),
      purchase({ legacyItemId: "437", billingEmail: "x@example.com" }),
    ]);
    expect(records.map((r) => r.itemId).sort()).toEqual(["416", "437"]);
  });

  it("returns owned download URLs for matching purchasers", () => {
    const ebooks = resolveLegacyEbookEntitlementsForEmail("owner@example.com", {
      purchases: [
        purchase({ billingEmail: "owner@example.com", legacyItemId: "346" }),
        purchase({ billingEmail: "owner@example.com", legacyItemId: "536" }),
        purchase({ billingEmail: "owner@example.com", legacyItemId: "620" }),
        purchase({ billingEmail: "owner@example.com", legacyItemId: "437" }),
        purchase({ billingEmail: "owner@example.com", legacyItemId: "443" }),
        purchase({ billingEmail: "owner@example.com", legacyItemId: "520" }),
      ],
    });

    expect(ebooks.find((e) => e.itemId === "346")?.downloadUrl).toBe(
      "/downloads/shop/legacy/ultimate_socks.pdf",
    );
    expect(ebooks.find((e) => e.itemId === "536")?.downloadUrl).toBe(
      "/downloads/shop/legacy/picture_knits_optimized.pdf",
    );
    expect(ebooks.find((e) => e.itemId === "620")?.downloadUrl).toBe(
      "/downloads/shop/legacy/hand_knit_to_machine_knit.pdf",
    );
    expect(ebooks.find((e) => e.itemId === "437")?.downloadUrl).toBe(
      "/downloads/shop/legacy/hearts_flowers1.pdf",
    );
    expect(ebooks.find((e) => e.itemId === "443")?.downloadUrl).toBe(
      "/downloads/shop/legacy/pockets_mini.pdf",
    );
    expect(ebooks.some((e) => e.itemId === "520")).toBe(false);
  });

  it("returns an empty list for a purchaser with no matching approved rows", () => {
    expect(
      resolveLegacyEbookEntitlementsForEmail("nobody@example.com", {
        purchases: [
          purchase({ billingEmail: "other@example.com", legacyItemId: "416" }),
          purchase({
            billingEmail: "nobody@example.com",
            legacyItemId: "520",
            paid: "1",
          }),
        ],
      }),
    ).toEqual([]);
  });

  it("customer entitlements contain no PII, price, transaction ID, or local path", () => {
    const ebooks = resolveLegacyEbookEntitlementsForEmail("safe@example.com", {
      purchases: [
        purchase({
          billingEmail: "safe@example.com",
          legacyItemId: "416",
          storeTransactionId: "secret-txn",
          pricePerItem: "4.99",
          totalPrice: "4.99",
          billingFirstName: "Secret",
          billingLastName: "Name",
        }),
      ],
    });
    expect(ebooks).toHaveLength(1);
    const row = ebooks[0] as Record<string, unknown>;
    expect(Object.keys(row).sort()).toEqual(["downloadUrl", "itemId", "title"]);
    expect(JSON.stringify(row)).not.toMatch(/secret/i);
    expect(JSON.stringify(row)).not.toMatch(/4\.99/);
    expect(JSON.stringify(row)).not.toMatch(/E:\\|public\\downloads/i);
    expect(JSON.stringify(row)).not.toMatch(/@/);
    expect(String(row.downloadUrl)).toMatch(/^\/downloads\/shop\//);
  });

  it("counts exact approved ownership records from repository purchase data", () => {
    expect(countApprovedLegacyEbookOwnershipRecords()).toBe(4590);
  });

  it("resolves Jacqueline's 13 titles with valid public download URLs", () => {
    const paid = loadLegacyEbookPurchases().filter((row) =>
      isLegacyEbookPurchasePaid(row.paid),
    );

    const byEmail = new Map<string, LegacyEbookPurchaseRow[]>();
    for (const row of paid) {
      const email = normalizeLegacyPurchaseEmail(row.billingEmail);
      if (!email) continue;
      const list = byEmail.get(email) ?? [];
      list.push(row);
      byEmail.set(email, list);
    }

    const candidate = [...byEmail.entries()].find(([, rows]) => {
      if (rows[0]?.billingFirstName.trim().toLowerCase() !== "jacqueline") {
        return false;
      }
      const uniqueApproved = new Set(
        rows
          .map((r) => r.legacyItemId.trim())
          .filter((id) => isLegacyEbookItemApproved(id)),
      );
      return uniqueApproved.size === 13;
    });

    expect(candidate).toBeDefined();
    const [email] = candidate!;
    const ebooks = resolveLegacyEbookEntitlementsForEmail(email);
    expect(ebooks).toHaveLength(13);

    for (const ebook of ebooks) {
      expect(ebook.downloadUrl).toMatch(/^\/downloads\/shop\//);
      expect(legacyEbookPublicFileExists(ebook.downloadUrl)).toBe(true);
    }

    const payload = JSON.stringify(ebooks);
    expect(payload).not.toContain(email);
    expect(payload).not.toMatch(/@/);
    expect(payload).not.toMatch(/storageKey|PurchaseDate|Price|E:\\/i);
  });
});
