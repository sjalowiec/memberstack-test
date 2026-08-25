import { describe, expect, it } from "vitest";
import {
  CHARTING_RULERS_PAID_DOWNLOAD,
  TECHNIQUE_CARDS_PAID_DOWNLOAD,
} from "./paidDownloadCatalog";
import {
  grantPaidDownloadEntitlement,
  listPaidDownloadCustomerEntitlementsForEmail,
  paidDownloadEntitlementBlobKey,
  type PaidDownloadEntitlementsDocument,
} from "./paidDownloadEntitlements";

function memoryStore(initial = new Map<string, string>()) {
  const data = initial;
  return {
    data,
    async get(key: string, opts?: { type?: string }) {
      if (!data.has(key)) return null;
      const value = data.get(key)!;
      return opts?.type === "json" ? JSON.parse(value) : value;
    },
    async setJSON(key: string, value: unknown) {
      data.set(key, JSON.stringify(value));
    },
  };
}

describe("paid download entitlements store", () => {
  it("records Charting Rulers by normalized email and does not duplicate on replay", async () => {
    const store = memoryStore();
    const first = await grantPaidDownloadEntitlement(
      {
        email: "  Buyer@Example.COM ",
        entry: CHARTING_RULERS_PAID_DOWNLOAD,
        stripeSessionId: "cs_test_1",
        stripePaymentIntentId: "pi_test_1",
        stripePaymentLinkId: CHARTING_RULERS_PAID_DOWNLOAD.stripePaymentLinkId,
      },
      store,
    );
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(first.created).toBe(true);
    expect(first.email).toBe("buyer@example.com");

    const second = await grantPaidDownloadEntitlement(
      {
        email: "buyer@example.com",
        entry: CHARTING_RULERS_PAID_DOWNLOAD,
        stripeSessionId: "cs_test_1",
      },
      store,
    );
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.created).toBe(false);

    const key = paidDownloadEntitlementBlobKey("buyer@example.com");
    expect(store.data.size).toBe(1);
    const document = JSON.parse(store.data.get(key)!) as PaidDownloadEntitlementsDocument;
    expect(Object.keys(document.items)).toEqual(["charting-rulers"]);
    expect(document.items["charting-rulers"].stripeSessionIds).toEqual(["cs_test_1"]);
    expect(document.items["charting-rulers"].stripePaymentLinkId).toBe(
      "plink_1TC5zXCW7QxJHpQOsDbz1Wrp",
    );
  });

  it("returns Charting Rulers for the matching email and nothing for a mismatch", async () => {
    const store = memoryStore();
    await grantPaidDownloadEntitlement(
      {
        email: "owner@example.com",
        entry: CHARTING_RULERS_PAID_DOWNLOAD,
        stripeSessionId: "cs_owner",
      },
      store,
    );

    expect(await listPaidDownloadCustomerEntitlementsForEmail("owner@example.com", store)).toEqual([
      {
        itemId: "printable:charting-rulers",
        title: "Printable Gauge Rulers",
        downloadUrl: "/downloads/shop/gauge-rulers.pdf",
      },
    ]);
    expect(
      await listPaidDownloadCustomerEntitlementsForEmail("other@example.com", store),
    ).toEqual([]);
  });

  it("stores Technique Cards alongside Charting Rulers for the same email", async () => {
    const store = memoryStore();
    await grantPaidDownloadEntitlement(
      {
        email: "owner@example.com",
        entry: CHARTING_RULERS_PAID_DOWNLOAD,
        stripeSessionId: "cs_rulers",
      },
      store,
    );
    await grantPaidDownloadEntitlement(
      {
        email: "owner@example.com",
        entry: TECHNIQUE_CARDS_PAID_DOWNLOAD,
        stripeSessionId: "cs_cards",
        stripePaymentLinkId: TECHNIQUE_CARDS_PAID_DOWNLOAD.stripePaymentLinkId,
      },
      store,
    );

    expect(await listPaidDownloadCustomerEntitlementsForEmail("owner@example.com", store)).toEqual([
      {
        itemId: "printable:machine-technique-reference-cards",
        title: "Machine Technique Reference Cards",
        downloadUrl: "/downloads/shop/machine-technique-reference-cards.pdf",
      },
      {
        itemId: "printable:charting-rulers",
        title: "Printable Gauge Rulers",
        downloadUrl: "/downloads/shop/gauge-rulers.pdf",
      },
    ]);
  });
});
