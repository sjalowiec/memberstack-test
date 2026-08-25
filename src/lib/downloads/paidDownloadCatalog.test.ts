import { describe, expect, it } from "vitest";
import {
  CHARTING_RULERS_PAID_DOWNLOAD,
  CHARTING_RULERS_SLUG,
  getPaidDownloadBySlug,
  getPaidDownloadByStripePaymentLinkId,
  getPaidDownloadByStripePriceId,
  getPaidDownloadByStripeProductId,
  paidDownloadItemId,
  PAID_DOWNLOAD_CATALOG,
  toPaidDownloadCustomerEntitlement,
} from "./paidDownloadCatalog";
import { matchPaidDownloadCatalogEntry } from "./stripeCheckoutSession";

describe("Charting Rulers Stripe ID mapping", () => {
  it("catalogs Charting Rulers with the known Stripe and file identifiers", () => {
    expect(PAID_DOWNLOAD_CATALOG).toHaveLength(1);
    expect(CHARTING_RULERS_PAID_DOWNLOAD).toMatchObject({
      slug: "charting-rulers",
      title: "Printable Gauge Rulers",
      downloadUrl: "/downloads/shop/gauge-rulers.pdf",
      stripeProductId: "prod_UAQrHwZdhtys66",
      stripePriceId: "price_1TC5zUCW7QxJHpQOFGijR9sD",
      stripePaymentLinkId: "plink_1TC5zXCW7QxJHpQOsDbz1Wrp",
      paymentLinkUrl: "https://buy.stripe.com/4gMdR87pYeKTfhQ3q20oM0Q",
    });
    expect(paidDownloadItemId(CHARTING_RULERS_SLUG)).toBe("printable:charting-rulers");
    expect(toPaidDownloadCustomerEntitlement(CHARTING_RULERS_PAID_DOWNLOAD).itemId).toBe(
      "printable:charting-rulers",
    );
  });

  it("resolves Charting Rulers by Stripe product, price, and payment link IDs", () => {
    expect(getPaidDownloadBySlug("charting-rulers")).toBe(CHARTING_RULERS_PAID_DOWNLOAD);
    expect(getPaidDownloadByStripeProductId("prod_UAQrHwZdhtys66")).toBe(
      CHARTING_RULERS_PAID_DOWNLOAD,
    );
    expect(getPaidDownloadByStripePriceId("price_1TC5zUCW7QxJHpQOFGijR9sD")).toBe(
      CHARTING_RULERS_PAID_DOWNLOAD,
    );
    expect(getPaidDownloadByStripePaymentLinkId("plink_1TC5zXCW7QxJHpQOsDbz1Wrp")).toBe(
      CHARTING_RULERS_PAID_DOWNLOAD,
    );
  });

  it("does not match unrelated Stripe IDs or title/amount", () => {
    expect(getPaidDownloadByStripeProductId("prod_other")).toBeNull();
    expect(getPaidDownloadByStripePriceId("price_other")).toBeNull();
    expect(getPaidDownloadByStripePaymentLinkId("plink_other")).toBeNull();
    expect(
      matchPaidDownloadCatalogEntry({
        payment_status: "paid",
        metadata: { name: "Charting Rulers" },
      }),
    ).toBeNull();
  });

  it("matches a Checkout Session by payment link, price, product, or metadata slug", () => {
    expect(
      matchPaidDownloadCatalogEntry({
        payment_link: "plink_1TC5zXCW7QxJHpQOsDbz1Wrp",
      })?.slug,
    ).toBe("charting-rulers");
    expect(
      matchPaidDownloadCatalogEntry({
        line_items: {
          data: [{ price: { id: "price_1TC5zUCW7QxJHpQOFGijR9sD", product: "prod_other" } }],
        },
      })?.slug,
    ).toBe("charting-rulers");
    expect(
      matchPaidDownloadCatalogEntry({
        line_items: {
          data: [{ price: { id: "price_other", product: "prod_UAQrHwZdhtys66" } }],
        },
      })?.slug,
    ).toBe("charting-rulers");
    expect(
      matchPaidDownloadCatalogEntry({
        metadata: { download_slug: "charting-rulers" },
      })?.slug,
    ).toBe("charting-rulers");
  });
});
