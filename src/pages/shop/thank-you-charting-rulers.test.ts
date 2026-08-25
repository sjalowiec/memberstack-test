import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  CHARTING_RULERS_THANK_YOU_DOWNLOAD_HREF,
  CHARTING_RULERS_THANK_YOU_DOWNLOAD_LABEL,
  CHARTING_RULERS_THANK_YOU_PATH,
} from "../../lib/downloads/chartingRulersThankYou";

const pageSource = readFileSync(
  resolve("src/pages/shop/thank-you-charting-rulers.astro"),
  "utf8",
);

describe("Charting Rulers thank-you page", () => {
  it("is a display-only download page and does not create ownership", () => {
    expect(CHARTING_RULERS_THANK_YOU_PATH).toBe("/shop/thank-you-charting-rulers");
    expect(CHARTING_RULERS_THANK_YOU_DOWNLOAD_HREF).toBe("/downloads/shop/gauge-rulers.pdf");
    expect(CHARTING_RULERS_THANK_YOU_DOWNLOAD_LABEL).toBe("Download Charting Rulers");
    expect(pageSource).toContain("export const prerender = true");
    expect(pageSource).toContain("CHARTING_RULERS_THANK_YOU_DOWNLOAD_HREF");
    expect(pageSource).toContain("CHARTING_RULERS_THANK_YOU_DOWNLOAD_LABEL");
    expect(pageSource).toContain(
      "Your payment was successful. Download the printable now and save it to your",
    );
    expect(pageSource).toContain("Already have a Knit It Now account?");
    expect(pageSource).toContain(
      "you'll also find your Charting Rulers under",
    );
    expect(pageSource).toContain("/account#my-downloads");
    expect(pageSource).toContain(
      "No Knit It Now account is required for this purchase.",
    );
    expect(pageSource).toContain(
      "You will also receive a confirmation email from Stripe for your records.",
    );
    expect(pageSource).toContain('href="/contact"');

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
  });
});
