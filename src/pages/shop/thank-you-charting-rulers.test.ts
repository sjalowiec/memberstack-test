import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  CHARTING_RULERS_THANK_YOU_DOWNLOAD_HREF,
  CHARTING_RULERS_THANK_YOU_DOWNLOAD_LABEL,
  CHARTING_RULERS_THANK_YOU_PATH,
} from "../../lib/downloads/chartingRulersThankYou";
import {
  CHARTING_RULERS_THANK_YOU,
  CUT_N_SEW_THANK_YOU,
  NEEDLE_SELECTION_THANK_YOU,
  PAID_DOWNLOAD_THANK_YOU_PAGES,
  TECHNIQUE_CARDS_THANK_YOU,
} from "../../lib/downloads/paidDownloadThankYou";
import {
  CUT_N_SEW_PAID_DOWNLOAD,
  NEEDLE_SELECTION_PAID_DOWNLOAD,
  TECHNIQUE_CARDS_PAID_DOWNLOAD,
} from "../../lib/downloads/paidDownloadCatalog";

const pageSource = readFileSync(
  resolve("src/pages/shop/thank-you-charting-rulers.astro"),
  "utf8",
);
const sharedSource = readFileSync(
  resolve("src/components/downloads/PaidDownloadThankYou.astro"),
  "utf8",
);

describe("Charting Rulers thank-you page", () => {
  it("is a display-only download page and does not create ownership", () => {
    expect(CHARTING_RULERS_THANK_YOU_PATH).toBe("/shop/thank-you-charting-rulers");
    expect(CHARTING_RULERS_THANK_YOU_DOWNLOAD_HREF).toBe("/downloads/shop/gauge-rulers.pdf");
    expect(CHARTING_RULERS_THANK_YOU_DOWNLOAD_LABEL).toBe("Download Charting Rulers");
    expect(pageSource).toContain("export const prerender = true");
    expect(pageSource).toContain("CHARTING_RULERS_THANK_YOU");
    expect(pageSource).toContain("PaidDownloadThankYou");
    expect(sharedSource).toContain(
      "Your payment was successful. Download the printable now and save it to your",
    );
    expect(sharedSource).toContain("Already have a Knit It Now account?");
    expect(sharedSource).toContain("/account#my-downloads");
    expect(sharedSource).toContain("/shop/downloads");
    expect(sharedSource).toContain(
      "No Knit It Now account is required for this purchase.",
    );
    expect(sharedSource).toContain(
      "You will also receive a confirmation email from Stripe for your records.",
    );
    expect(sharedSource).toContain('href="/contact"');

    expect(pageSource).not.toContain("does not grant access");
    expect(pageSource).not.toContain("Stripe records the purchase");
    expect(pageSource).not.toContain("data-ms-content");
    expect(pageSource).not.toMatch(/create an account/i);
    expect(pageSource).not.toMatch(/membership is required/i);

    expect(pageSource).not.toContain("paidDownloadEntitlements");
    expect(pageSource).not.toContain("grantPaidDownloadEntitlement");
    expect(pageSource).not.toContain("processStripePaidDownloadEvent");
    expect(pageSource).not.toContain("stripe-download-webhook");
    expect(pageSource).not.toContain("STRIPE_WEBHOOK_SECRET");
    expect(pageSource).not.toMatch(/fetch\s*\(/);
    expect(sharedSource).not.toContain("grantPaidDownloadEntitlement");
    expect(sharedSource).not.toContain("stripe-download-webhook");
  });
});

describe("paid-download thank-you pages", () => {
  it("maps each remaining printable to its own thank-you path and file", () => {
    expect(CHARTING_RULERS_THANK_YOU.purchaseName).toBe("Charting Rulers");
    expect(CHARTING_RULERS_THANK_YOU.path).toBe("/shop/thank-you-charting-rulers");

    expect(TECHNIQUE_CARDS_THANK_YOU).toMatchObject({
      path: "/shop/thank-you-machine-technique-reference-cards",
      purchaseName: TECHNIQUE_CARDS_PAID_DOWNLOAD.title,
      downloadHref: TECHNIQUE_CARDS_PAID_DOWNLOAD.downloadUrl,
      downloadLabel: "Download Machine Technique Reference Cards",
    });
    expect(CUT_N_SEW_THANK_YOU).toMatchObject({
      path: "/shop/thank-you-cut-n-sew-neckline-templates",
      purchaseName: CUT_N_SEW_PAID_DOWNLOAD.title,
      downloadHref: "/downloads/shop/cut-n-sew-neckline-templates.pdf",
    });
    expect(NEEDLE_SELECTION_THANK_YOU).toMatchObject({
      path: "/shop/thank-you-needle-selection-worksheet",
      purchaseName: NEEDLE_SELECTION_PAID_DOWNLOAD.title,
      downloadHref: "/downloads/shop/cheat-sheet-hand-hand-manipulated-stitches.pdf",
    });

    expect(CHARTING_RULERS_THANK_YOU.downloadHref).not.toBe(
      TECHNIQUE_CARDS_THANK_YOU.downloadHref,
    );
    expect(new Set(PAID_DOWNLOAD_THANK_YOU_PAGES.map((page) => page.downloadHref)).size).toBe(
      4,
    );

    for (const page of [
      TECHNIQUE_CARDS_THANK_YOU,
      CUT_N_SEW_THANK_YOU,
      NEEDLE_SELECTION_THANK_YOU,
    ]) {
      const source = readFileSync(
        resolve(`src/pages${page.path}.astro`),
        "utf8",
      );
      expect(source).toContain("export const prerender = true");
      expect(source).toContain("PaidDownloadThankYou");
      expect(source).not.toContain("grantPaidDownloadEntitlement");
      expect(source).not.toContain("stripe-download-webhook");
    }
  });
});
