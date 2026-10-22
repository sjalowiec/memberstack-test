import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { renderAccountPurchaseOrders } from "./accountPurchaseHistoryView";
import type { AccountPurchaseOrder } from "./accountPurchaseHistory";

const accountPage = readFileSync(resolve("src/pages/account.astro"), "utf8");
const purchasePanel = readFileSync(
  resolve("src/components/dashboard/AccountPurchaseHistoryPanel.astro"),
  "utf8",
);
const purchaseScript = readFileSync(resolve("src/scripts/account-purchase-history.ts"), "utf8");

const order: AccountPurchaseOrder = {
  orderNumber: "#1502",
  orderDate: "Oct 2, 2026",
  paymentStatus: "Paid",
  fulfillmentStatus: "Fulfilled",
  items: [
    { title: `Mast <kit> & "extra"`, quantity: "1" },
    { title: "Standard Gauge Knitting Machine", quantity: "1" },
  ],
  trackingLinks: [
    {
      label: "Track with UPS",
      url: "https://www.ups.com/track?tracknum=1Z999AA10123456784",
      trackingNumber: "1Z999AA10123456784",
    },
    {
      label: "Track package",
      url: "javascript:alert(1)",
      trackingNumber: null,
    },
  ],
};

describe("account purchase history view", () => {
  it("renders the customer's order fields and escapes item text", () => {
    const html = renderAccountPurchaseOrders([order]);
    expect(html).toContain("Order #1502");
    expect(html).toContain("Oct 2, 2026");
    expect(html).toContain("Paid");
    expect(html).toContain("Fulfilled");
    expect(html).toContain("Standard Gauge Knitting Machine");
    expect(html).toContain("Mast &lt;kit&gt; &amp; &quot;extra&quot;");
    expect(html).toContain("https://www.ups.com/track?tracknum=1Z999AA10123456784");
    expect(html).not.toContain("javascript:");
    expect(html).not.toContain("@");
    expect(html).toContain('rel="noopener noreferrer"');
  });

  it("keeps every order detail inside a collapsed accordion", () => {
    const detailsStart = purchasePanel.indexOf("<details");
    const summaryEnd = purchasePanel.indexOf("</summary>");
    const detailsEnd = purchasePanel.indexOf("</details>");
    expect(detailsStart).toBeGreaterThan(-1);
    expect(purchasePanel.slice(detailsStart, summaryEnd)).not.toMatch(/\sopen(?:\s|>|=)/);
    expect(purchasePanel).toMatch(/>\s*Purchase History\s*</);
    expect(purchasePanel).toContain("account-purchases__chevron");
    expect(purchasePanel.indexOf("data-kbm-account-purchases-list")).toBeGreaterThan(summaryEnd);
    expect(purchasePanel.indexOf("data-kbm-account-purchases-list")).toBeLessThan(detailsEnd);
    expect(purchasePanel.indexOf("data-kbm-account-purchases-empty")).toBeLessThan(detailsEnd);
    expect(purchaseScript).toContain("reportAccountPurchaseHistoryOpen");
    expect(purchaseScript).toContain('if (accordion.open) reportAccountPurchaseHistoryOpen()');
    expect(purchaseScript).toContain("reportAccountPurchaseHistoryView");
    expect(purchaseScript).toContain("reportAccountPurchaseTrackingClick");
  });

  it("is on the account page, separate from membership billing", () => {
    expect(accountPage).toContain("AccountPurchaseHistoryPanel");
    expect(accountPage).toContain("account-purchase-history.ts");
    expect(accountPage).toContain("AccountMembershipPanel");
    const purchaseAt = accountPage.indexOf("<AccountPurchaseHistoryPanel");
    const membershipAt = accountPage.indexOf("<AccountMembershipPanel");
    expect(purchaseAt).toBeGreaterThan(membershipAt);
  });
});
