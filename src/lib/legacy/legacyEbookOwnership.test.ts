import { describe, expect, it, beforeEach, vi } from "vitest";
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
  resolveCustomerLegacyEbookEntitlementsForEmail,
  resolveLegacyEbookEntitlementsForEmail,
} from "./legacyEbookOwnership";
import {
  loadLegacyEbookPurchases,
  type LegacyEbookPurchaseRow,
} from "./legacyEbookPurchases";
import {
  watsonEbookRowToPurchase,
  type WatsonEbookPurchaseRow,
} from "./legacyEbookWatsonPurchases";

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

describe("customer My Downloads CSV + Watson union", () => {
  beforeEach(() => {
    clearLegacyEbookOwnershipIndexCache();
  });

  it("restores Karen Wylie's two paid ebooks from Watson when the CSV snapshot omitted them", async () => {
    const ebooks = await resolveCustomerLegacyEbookEntitlementsForEmail(
      "karen.l.wylie@gmail.com",
      {
        csvPurchases: [
          purchase({
            storeTransactionId: "21293",
            billingEmail: "karen.l.wylie@gmail.com",
            legacyItemId: "687",
            itemName: "Mousam Falls 4/6 Aran",
            paid: "1",
          }),
        ],
        watsonPurchases: [
          purchase({
            storeTransactionId: "29763",
            billingEmail: "karen.l.wylie@gmail.com",
            legacyItemId: "675",
            itemName: "Decorative Raglan Seams for Machine Knitters",
            pricePerItem: "14.99",
            totalPrice: "14.99",
          }),
          purchase({
            storeTransactionId: "29763",
            billingEmail: "karen.l.wylie@gmail.com",
            legacyItemId: "505",
            itemName: "Machine Knitting Trims and Edges - Single Bed",
            pricePerItem: "18.99",
            totalPrice: "18.99",
          }),
          purchase({
            storeTransactionId: "29763",
            billingEmail: "karen.l.wylie@gmail.com",
            legacyItemId: "687",
            itemName: "Mousam Falls 4/6 Aran",
            paid: "1",
          }),
          purchase({
            storeTransactionId: "99999",
            billingEmail: "karen.l.wylie@gmail.com",
            legacyItemId: "416",
            paid: "0",
          }),
        ],
      },
    );

    expect(ebooks.map((row) => row.itemId).sort()).toEqual(["505", "675"]);
    expect(ebooks).toEqual(
      expect.arrayContaining([
        {
          itemId: "675",
          title: "Decorative Raglan Seams for Machine Knitters",
          downloadUrl: "/downloads/shop/raglan_seam_ebook_optimized.pdf",
        },
        {
          itemId: "505",
          title: "Machine Knitting Trims and Edges - Single Bed",
          downloadUrl: "/downloads/shop/505_Single_bed_trims_and_edges1.pdf",
        },
      ]),
    );
  });

  it("keeps CSV entitlements when Watson is empty", async () => {
    const ebooks = await resolveCustomerLegacyEbookEntitlementsForEmail(
      "owner@example.com",
      {
        csvPurchases: [
          purchase({ billingEmail: "owner@example.com", legacyItemId: "416" }),
        ],
        watsonPurchases: [],
      },
    );
    expect(ebooks.map((row) => row.itemId)).toEqual(["416"]);
  });

  it("still returns CSV ebooks if Watson lookup throws", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const ebooks = await resolveCustomerLegacyEbookEntitlementsForEmail(
      "owner@example.com",
      {
        csvPurchases: [
          purchase({ billingEmail: "owner@example.com", legacyItemId: "416" }),
        ],
        loadWatson: async () => {
          throw new Error("watson unavailable");
        },
      },
    );
    expect(ebooks.map((row) => row.itemId)).toEqual(["416"]);
    errorSpy.mockRestore();
  });

  it("unions a Watson-native grant and collapses it with a paid purchase of the same title", async () => {
    const ebooks = await resolveCustomerLegacyEbookEntitlementsForEmail(
      "owner@example.com",
      {
        csvPurchases: [
          purchase({ billingEmail: "owner@example.com", legacyItemId: "416" }),
        ],
        watsonPurchases: [],
        nativeGrants: [
          {
            itemId: "416",
            title: "Cheat Sheets for Hand Manipulated Stitch Patterns",
            downloadUrl: "/downloads/shop/cheet_sheet_book2.pdf",
          },
          {
            itemId: "505",
            title: "Machine Knitting Trims and Edges - Single Bed",
            downloadUrl: "/downloads/shop/505_Single_bed_trims_and_edges1.pdf",
          },
        ],
      },
    );
    expect(ebooks.map((row) => row.itemId)).toEqual(["416", "505"]);
  });

  it("keeps a Memberstack-ID grant when the authenticated email no longer matches the snapshot", async () => {
    const ebooks = await resolveCustomerLegacyEbookEntitlementsForEmail(
      "new-email@example.com",
      {
        csvPurchases: [],
        watsonPurchases: [],
        memberstackId: "mem_abc123",
        loadNativeGrants: async ({ memberstackId }) => {
          if (memberstackId !== "mem_abc123") return [];
          return [
            {
              itemId: "416",
              title: "Cheat Sheets for Hand Manipulated Stitch Patterns",
              downloadUrl: "/downloads/shop/cheet_sheet_book2.pdf",
            },
          ];
        },
      },
    );
    expect(ebooks.map((row) => row.itemId)).toEqual(["416"]);
  });

  it("uses email fallback for an older grant when Memberstack ID is missing on the row", async () => {
    const ebooks = await resolveCustomerLegacyEbookEntitlementsForEmail(
      "legacy-owner@example.com",
      {
        csvPurchases: [],
        watsonPurchases: [],
        memberstackId: "mem_later",
        loadNativeGrants: async ({ email }) => {
          if (email !== "legacy-owner@example.com") return [];
          return [
            {
              itemId: "589",
              title: "A Guide to Knitting with Yarn on Cones",
              downloadUrl: "/downloads/shop/yarn_counts_doc_PDF_format.pdf",
            },
          ];
        },
      },
    );
    expect(ebooks.map((row) => row.itemId)).toEqual(["589"]);
  });
});

const LINDA_MEMBERID = "6ECD81B4-B172-04D6-2FDF-9D46FFB6B909";
const LINDA_EMAIL = "texas44@gmail.com";
const LINDA_OLD_EMAIL = "texas44@comcast.net";
const LINDA_QUALIFYING_ITEM_IDS = [
  "416",
  "418",
  "422",
  "474",
  "505",
  "536",
  "589",
  "620",
  "675",
];

function watsonRow(
  partial: Partial<WatsonEbookPurchaseRow>,
): WatsonEbookPurchaseRow {
  return {
    storetransactionid: 1,
    purchasedate: "2014-07-01",
    billing_email: null,
    billing_firstname: "Linda",
    billing_lastname: "Dawson",
    paid: 1,
    itemid: 505,
    itemname: "Machine Knitting Trims and Edges - Single Bed",
    priceperitem: "0.0000",
    totalprice: "0.0000",
    ...partial,
  };
}

function lindaWatsonStoreRows(): WatsonEbookPurchaseRow[] {
  return [
    watsonRow({ storetransactionid: 8318, itemid: 589, itemname: "Yarn on Cones" }),
    watsonRow({ storetransactionid: 9142, itemid: 620, itemname: "Stitch Symbols" }),
    watsonRow({ storetransactionid: 10428, itemid: 422, itemname: "Signature Hats" }),
    watsonRow({ storetransactionid: 11415, itemid: 474, itemname: "Cut n Sew" }),
    watsonRow({ storetransactionid: 12405, itemid: 536, itemname: "Picture Knits" }),
    watsonRow({
      storetransactionid: 13819,
      itemid: 621,
      itemname: "Passap E-6000 Guidebook",
      billing_email: LINDA_OLD_EMAIL,
      priceperitem: "24.95",
      totalprice: "24.95",
    }),
    watsonRow({ storetransactionid: 14190, itemid: 418, itemname: "Shirt for All Seasons" }),
    watsonRow({ storetransactionid: 17512, itemid: 505 }),
    watsonRow({ storetransactionid: 18154, itemid: 675, itemname: "Decorative Raglan Seams" }),
    watsonRow({
      storetransactionid: 20740,
      itemid: 416,
      itemname: "Cheat Sheets",
      billing_email: LINDA_OLD_EMAIL,
      priceperitem: "4.99",
      totalprice: "4.99",
    }),
    watsonRow({
      storetransactionid: 29152,
      itemid: 737,
      itemname: "Japanese Patterns",
    }),
    watsonRow({
      storetransactionid: 9000,
      itemid: 279,
      itemname: "Machine Knitting Workbook 3",
    }),
  ];
}

describe("trusted member-ID My Downloads recovery", () => {
  beforeEach(() => {
    clearLegacyEbookOwnershipIndexCache();
  });

  it("restores Linda's nine qualifying titles, including blank and old billing emails", async () => {
    const mapped = lindaWatsonStoreRows()
      .map((row) => watsonEbookRowToPurchase(row, { ownerEmail: LINDA_EMAIL }))
      .filter((row): row is LegacyEbookPurchaseRow => row != null);

    const ebooks = await resolveCustomerLegacyEbookEntitlementsForEmail(LINDA_EMAIL, {
      csvPurchases: [],
      watsonPurchases: [],
      resolveTrustedLegacyMemberid: async () => ({
        status: "unique",
        memberid: LINDA_MEMBERID,
        source: "email",
      }),
      loadWatsonByMemberid: async (memberid, ownerEmail) => {
        expect(memberid).toBe(LINDA_MEMBERID);
        expect(ownerEmail).toBe(LINDA_EMAIL);
        return mapped;
      },
    });

    expect(ebooks.map((row) => row.itemId).sort()).toEqual([...LINDA_QUALIFYING_ITEM_IDS].sort());
    expect(ebooks.some((row) => row.itemId === "621")).toBe(false);
    expect(ebooks.some((row) => row.itemId === "737")).toBe(false);
    expect(ebooks.some((row) => row.itemId === "279")).toBe(false);
    expect(ebooks.find((row) => row.itemId === "416")?.downloadUrl).toBe(
      "/downloads/shop/cheet_sheet_book2.pdf",
    );
    expect(ebooks.find((row) => row.itemId === "589")?.downloadUrl).toBe(
      "/downloads/shop/yarn_counts_doc_PDF_format.pdf",
    );
  });

  it("does not recover ebooks when the legacy link is missing", async () => {
    const loadWatsonByMemberid = vi.fn();
    const ebooks = await resolveCustomerLegacyEbookEntitlementsForEmail(LINDA_EMAIL, {
      csvPurchases: [
        purchase({ billingEmail: LINDA_EMAIL, legacyItemId: "416" }),
      ],
      watsonPurchases: [],
      resolveTrustedLegacyMemberid: async () => ({ status: "none" }),
      loadWatsonByMemberid,
    });
    expect(loadWatsonByMemberid).not.toHaveBeenCalled();
    expect(ebooks.map((row) => row.itemId)).toEqual(["416"]);
  });

  it("does not recover ebooks when the legacy link is ambiguous", async () => {
    const loadWatsonByMemberid = vi.fn();
    const ebooks = await resolveCustomerLegacyEbookEntitlementsForEmail(
      "shared@example.com",
      {
        csvPurchases: [],
        watsonPurchases: [],
        resolveTrustedLegacyMemberid: async () => ({ status: "ambiguous" }),
        loadWatsonByMemberid,
      },
    );
    expect(loadWatsonByMemberid).not.toHaveBeenCalled();
    expect(ebooks).toEqual([]);
  });

  it("collapses duplicate titles from email lookup and trusted member-ID lookup", async () => {
    const ebooks = await resolveCustomerLegacyEbookEntitlementsForEmail(LINDA_EMAIL, {
      csvPurchases: [
        purchase({ billingEmail: LINDA_EMAIL, legacyItemId: "416" }),
        purchase({ billingEmail: LINDA_EMAIL, legacyItemId: "505" }),
      ],
      watsonPurchases: [
        purchase({ billingEmail: LINDA_EMAIL, legacyItemId: "505" }),
      ],
      watsonMemberidPurchases: [
        purchase({ billingEmail: LINDA_EMAIL, legacyItemId: "416" }),
        purchase({ billingEmail: LINDA_EMAIL, legacyItemId: "675" }),
      ],
    });
    expect(ebooks.map((row) => row.itemId).sort()).toEqual(["416", "505", "675"]);
    expect(ebooks).toHaveLength(3);
  });

  it("keeps existing email-based access unchanged when member-ID recovery is skipped", async () => {
    const ebooks = await resolveCustomerLegacyEbookEntitlementsForEmail(
      "karen.l.wylie@gmail.com",
      {
        csvPurchases: [],
        watsonPurchases: [
          purchase({
            billingEmail: "karen.l.wylie@gmail.com",
            legacyItemId: "675",
          }),
          purchase({
            billingEmail: "karen.l.wylie@gmail.com",
            legacyItemId: "505",
          }),
        ],
      },
    );
    expect(ebooks.map((row) => row.itemId).sort()).toEqual(["505", "675"]);
  });
});
