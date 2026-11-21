import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const membershipPage = readFileSync(resolve("src/pages/membership.astro"), "utf8");
const pricingCard = readFileSync(
  resolve("src/components/membership/MembershipPricing.astro"),
  "utf8",
);

const SAVED_PATTERN_BENEFIT =
  "Keep read-only access to the patterns you save, even if your membership ends.";

const PATTERN_BUILDERS_FAQ_ANSWER =
  "Pattern Builders require an active membership. If your membership ends, the patterns saved in My Patterns remain available for you to view, print, download, and knit. Renew your membership whenever you want to edit or recalculate a pattern, change its size or gauge, or create new patterns.";

describe("membership page copy", () => {
  it("adds the saved-pattern benefit once on the shared Knit it Now Membership offer card", () => {
    expect(pricingCard).toContain(SAVED_PATTERN_BENEFIT);
    expect(pricingCard.split(SAVED_PATTERN_BENEFIT)).toHaveLength(2);
    expect(pricingCard).toContain("const membershipFeatures = [");
    expect(pricingCard).toMatch(
      /membershipFeatures\.map\(\(item\) => \(\s*<li>\{item\}<\/li>/,
    );
  });

  it("opens on annual billing and keeps both checkout prices", () => {
    const monthlyInput =
      pricingCard.match(/<input\b[\s\S]*?id="membership-billing-monthly"[\s\S]*?>/)?.[0] ?? "";
    const annualInput =
      pricingCard.match(/<input\b[\s\S]*?id="membership-billing-annual"[\s\S]*?>/)?.[0] ?? "";
    expect(annualInput).toContain("checked");
    expect(monthlyInput).not.toContain("checked");
    expect(pricingCard).not.toContain("billed annually");
    expect(pricingCard).not.toContain("compared with monthly");
    expect(pricingCard).toContain("Save $${annualSavings}/year.");
    expect(pricingCard).toContain("/year with annual membership.");
    expect(pricingCard).toContain("View annual option");
    expect(pricingCard).toContain("data-membership-view-annual");
    expect(pricingCard).toContain('data-join-checkout="monthly"');
    expect(pricingCard).toContain('data-join-checkout="annual"');
    expect(pricingCard).toContain("data-membership-price-id={MEMBERSHIP_PRICE_IDS.monthly}");
    expect(pricingCard).toContain("data-membership-price-id={MEMBERSHIP_PRICE_IDS.annual}");
    expect(pricingCard).toContain("MEMBERSHIPS.membership.prices.monthly.price");
    expect(pricingCard).toContain("MEMBERSHIPS.membership.prices.annual.price");
  });

  it("keeps the Pattern Builders FAQ question and uses the approved answer", () => {
    expect(membershipPage).toContain(
      "<summary>Do I keep access to the pattern builders?</summary>",
    );
    expect(membershipPage).toContain(PATTERN_BUILDERS_FAQ_ANSWER);
    expect(membershipPage).not.toContain(
      "Details about purchasing individual pattern systems will be provided separately",
    );
    expect(membershipPage).not.toContain("Yes. Active members have access to all pattern builders.");
  });
});
