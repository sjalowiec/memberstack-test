import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { printables } from "../../data/printables";

const layoutSource = readFileSync(
  resolve("src/components/downloads/PrintableResourceLayout.astro"),
  "utf8",
);
const shopPageSource = readFileSync(
  resolve("src/pages/downloads/shop/[slug].astro"),
  "utf8",
);
const productPageSource = readFileSync(
  resolve("src/pages/downloads/[slug].astro"),
  "utf8",
);
const downloadCardSource = readFileSync(
  resolve("src/components/downloads/PrintableDownloadCard.astro"),
  "utf8",
);

describe("shop printable resource purchase actions", () => {
  it("reuses the Cut 'n Sew product-action contract and existing Stripe links", () => {
    expect(layoutSource).toContain("data-printable-product-actions");
    expect(layoutSource).toContain("data-buy-now");
    expect(layoutSource).toContain("Buy Now");
    expect(layoutSource).toContain("printables");
    expect(layoutSource).toContain("product?.stripeLink");
    expect(shopPageSource).toContain("PrintableResourceLayout");

    const technique = printables.find(
      (item) => item.slug === "machine-technique-reference-cards",
    );
    const needle = printables.find((item) => item.slug === "needle-selection-worksheet");
    expect(technique?.memberFree).toBe(true);
    expect(needle?.memberFree).toBe(true);
    expect(technique?.stripeLink).toBe("https://buy.stripe.com/00wfZg39I8mv0mW2lY0oM0O");
    expect(needle?.stripeLink).toBe("https://buy.stripe.com/bJe6oG5hQ0U37Po4u60oM0P");
  });

  it("does not render a download file link for guests in the download card markup", () => {
    expect(downloadCardSource).not.toMatch(/<a[^>]+href=\{pdfFile\}/);
    expect(downloadCardSource).not.toContain("(member only)");
  });

  it("leaves the Cut 'n Sew / Gauge Rulers product page purchase markup in place", () => {
    expect(productPageSource).toContain("data-printable-product-actions");
    expect(productPageSource).toContain("data-buy-now");
    expect(productPageSource).toContain("Buy Now");
    expect(productPageSource).toContain("product.stripeLink");
    expect(productPageSource).toContain("buy.hidden = memberFree && state === \"memberAccess\"");
  });
});
