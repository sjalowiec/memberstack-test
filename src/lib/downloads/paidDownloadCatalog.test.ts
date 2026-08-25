import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { printables } from "../../data/printables";
import { findPrintableResourceBySlug } from "../../data/printableResources";
import {
  CHARTING_RULERS_PAID_DOWNLOAD,
  CHARTING_RULERS_SLUG,
  CUT_N_SEW_PAID_DOWNLOAD,
  getPaidDownloadBySlug,
  getPaidDownloadByStripePaymentLinkId,
  getPaidDownloadByStripePriceId,
  getPaidDownloadByStripeProductId,
  NEEDLE_SELECTION_PAID_DOWNLOAD,
  paidDownloadItemId,
  PAID_DOWNLOAD_CATALOG,
  TECHNIQUE_CARDS_PAID_DOWNLOAD,
  toPaidDownloadCustomerEntitlement,
} from "./paidDownloadCatalog";
import { matchPaidDownloadCatalogEntry } from "./stripeCheckoutSession";

function printable(slug: string) {
  const item = printables.find((row) => row.slug === slug);
  if (!item) throw new Error(`Missing printable ${slug}`);
  return item;
}

const EXPECTED = [
  {
    entry: CHARTING_RULERS_PAID_DOWNLOAD,
    slug: "charting-rulers",
    stripeProductId: "prod_UAQrHwZdhtys66",
    stripePriceId: "price_1TC5zUCW7QxJHpQOFGijR9sD",
    stripePaymentLinkId: "plink_1TC5zXCW7QxJHpQOsDbz1Wrp",
    paymentLinkUrl: "https://buy.stripe.com/4gMdR87pYeKTfhQ3q20oM0Q",
  },
  {
    entry: TECHNIQUE_CARDS_PAID_DOWNLOAD,
    slug: "machine-technique-reference-cards",
    stripeProductId: "prod_UAQnqHWiVtwBrS",
    stripePriceId: "price_1TC5vzCW7QxJHpQOrJc2FPBq",
    stripePaymentLinkId: "plink_1TC5wtCW7QxJHpQOVzwUoLmJ",
    paymentLinkUrl: "https://buy.stripe.com/00wfZg39I8mv0mW2lY0oM0O",
  },
  {
    entry: CUT_N_SEW_PAID_DOWNLOAD,
    slug: "cut-n-sew-neckline-templates",
    stripeProductId: "prod_UAQsmPjVdexe1A",
    stripePriceId: "price_1TC60QCW7QxJHpQOAmXYScwW",
    stripePaymentLinkId: "plink_1TC60UCW7QxJHpQOmWjoTrXR",
    paymentLinkUrl: "https://buy.stripe.com/00w4gybGeeKTglU6Ce0oM0R",
  },
  {
    entry: NEEDLE_SELECTION_PAID_DOWNLOAD,
    slug: "needle-selection-worksheet",
    stripeProductId: "prod_UAQpSb0FUXJVIs",
    stripePriceId: "price_1TC5yECW7QxJHpQOzzdFqz6s",
    stripePaymentLinkId: "plink_1TC5yLCW7QxJHpQO0wRoHhqY",
    paymentLinkUrl: "https://buy.stripe.com/bJe6oG5hQ0U37Po4u60oM0P",
  },
] as const;

describe("paid-download Stripe catalog", () => {
  it("catalogs all four printables from existing product data and supplied Stripe IDs", () => {
    expect(PAID_DOWNLOAD_CATALOG).toHaveLength(4);
    expect(PAID_DOWNLOAD_CATALOG).toEqual(EXPECTED.map((row) => row.entry));

    for (const row of EXPECTED) {
      const product = printable(row.slug);
      expect(row.entry).toMatchObject({
        slug: product.slug,
        title: product.title,
        downloadUrl: product.file,
        stripeProductId: row.stripeProductId,
        stripePriceId: row.stripePriceId,
        stripePaymentLinkId: row.stripePaymentLinkId,
        paymentLinkUrl: row.paymentLinkUrl,
      });
      expect(row.entry.paymentLinkUrl).toBe(product.stripeLink);
    }

    expect(NEEDLE_SELECTION_PAID_DOWNLOAD.downloadUrl).toBe(
      "/downloads/shop/cheat-sheet-hand-hand-manipulated-stitches.pdf",
    );
    expect(NEEDLE_SELECTION_PAID_DOWNLOAD.downloadUrl).not.toContain("placeholder");
    expect(printable("needle-selection-worksheet").file).toBe(
      "/downloads/shop/cheat-sheet-hand-hand-manipulated-stitches.pdf",
    );
    expect(findPrintableResourceBySlug("needle-selection-worksheet")?.pdfFile).toBe(
      "/downloads/shop/cheat-sheet-hand-hand-manipulated-stitches.pdf",
    );
    expect(CUT_N_SEW_PAID_DOWNLOAD.downloadUrl).toBe(
      "/downloads/shop/cut-n-sew-neckline-templates.pdf",
    );

    for (const entry of PAID_DOWNLOAD_CATALOG) {
      const publicFile = resolve(`public${entry.downloadUrl}`);
      expect(existsSync(publicFile), `missing ${entry.downloadUrl}`).toBe(true);
    }
  });

  it("resolves each printable by Stripe product, price, and payment link IDs", () => {
    for (const row of EXPECTED) {
      expect(getPaidDownloadBySlug(row.slug)).toBe(row.entry);
      expect(getPaidDownloadByStripeProductId(row.stripeProductId)).toBe(row.entry);
      expect(getPaidDownloadByStripePriceId(row.stripePriceId)).toBe(row.entry);
      expect(getPaidDownloadByStripePaymentLinkId(row.stripePaymentLinkId)).toBe(row.entry);
    }
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
    for (const row of EXPECTED) {
      expect(
        matchPaidDownloadCatalogEntry({
          payment_link: row.stripePaymentLinkId,
        })?.slug,
      ).toBe(row.slug);
      expect(
        matchPaidDownloadCatalogEntry({
          line_items: {
            data: [{ price: { id: row.stripePriceId, product: "prod_other" } }],
          },
        })?.slug,
      ).toBe(row.slug);
      expect(
        matchPaidDownloadCatalogEntry({
          line_items: {
            data: [{ price: { id: "price_other", product: row.stripeProductId } }],
          },
        })?.slug,
      ).toBe(row.slug);
      expect(
        matchPaidDownloadCatalogEntry({
          metadata: { download_slug: row.slug },
        })?.slug,
      ).toBe(row.slug);
    }
  });
});
