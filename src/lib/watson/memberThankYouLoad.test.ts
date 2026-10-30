import { describe, expect, it } from "vitest";

import type { LegacyMemberDetailRow } from "./memberDetail";
import type { LegacySubscriptionRow } from "./memberMembership";
import {
  loadMemberThankYouPage,
  THANK_YOU_CHARGE_EXPAND,
  THANK_YOU_STRIPE_EXPAND,
} from "./memberThankYouLoad";
import type { NormalizedStripeCharge } from "./stripeReportingClient";

const ON_DAY = Math.floor(Date.parse("2026-10-30T18:00:00.000Z") / 1000);
const NOW = new Date("2026-10-30T20:00:00.000Z");

function member(id: string, email = "ada@example.com"): LegacyMemberDetailRow {
  return {
    memberid: id,
    fristname: "Ada",
    lastname: "Lovelace",
    email,
    address: "1 Main St",
    address2: null,
    city: "Portland",
    state: "OR",
    postalcode: "97201",
    country: "United States",
    birthdayinfo: null,
    datejoined: null,
    subscriptionexpiring: null,
    active: 1,
    betaactive: 0,
    currentsubscriber: 1,
  };
}

function annualCharge(overrides: Partial<NormalizedStripeCharge> = {}): NormalizedStripeCharge {
  return {
    id: "ch_annual1",
    created: ON_DAY,
    createdIso: "2026-10-30T18:00:00.000Z",
    currency: "usd",
    livemode: true,
    status: "succeeded",
    paid: true,
    amount: 228,
    amountRequested: 228,
    amountRefunded: 0,
    lines: [
      {
        priceId: "price_annual",
        productId: "prod_annual",
        recurringInterval: "year",
        recurringIntervalCount: 1,
      },
    ],
    hasShopifyMarker: false,
    shopifyMarkerReason: null,
    description: "",
    invoiceId: "in_1",
    paymentIntentId: null,
    paymentMethodType: "card",
    billingReason: "subscription_create",
    channel: "subscription",
    customerId: "cus_1",
    customerEmail: "ada@example.com",
    customerName: "Ada Lovelace",
    subscriptionId: "sub_1",
    refunded: false,
    ...overrides,
  };
}

function endedSubscription(): LegacySubscriptionRow {
  return {
    subscriptionid: 10,
    memberid_fk: "m1",
    datebought: "2024-01-15",
    expirationdate: "2025-01-15",
    transactionguid_fk: null,
    dollaramount: 144,
    renewal: 0,
    monthlybilling: 0,
    cancelled: 0,
    canceldate: null,
    premium: 1,
    processor: "Stripe",
    subscriptionrate_id: null,
    arb_id: null,
    abr_inovicenumber: null,
  };
}

describe("loadMemberThankYouPage", () => {
  it("asks Stripe only for expands it will accept", () => {
    for (const expand of [...THANK_YOU_STRIPE_EXPAND, ...THANK_YOU_CHARGE_EXPAND]) {
      expect(expand.split(".").length).toBeLessThanOrEqual(4);
    }
    expect(THANK_YOU_STRIPE_EXPAND).toEqual(["data.invoice"]);
    expect(THANK_YOU_CHARGE_EXPAND).toEqual(["invoice"]);
  });

  it("lists one eligible annual payment and leaves refunds, monthly charges, and the next renewal unchecked", async () => {
    const page = await loadMemberThankYouPage({
      now: NOW,
      annualPriceIds: new Set(["price_annual"]),
      monthlyPriceIds: new Set(["price_monthly"]),
      fetchCharges: async () => [
        annualCharge(),
        annualCharge({
          id: "ch_partial",
          amountRefunded: 10,
          customerEmail: "ada@example.com",
        }),
        annualCharge({
          id: "ch_month",
          amount: 19.99,
          lines: [
            {
              priceId: "price_monthly",
              productId: "prod_monthly",
              recurringInterval: "month",
              recurringIntervalCount: 1,
            },
          ],
        }),
        annualCharge({
          id: "ch_nextyear",
          subscriptionId: "sub_1",
          billingReason: "subscription_cycle",
          invoiceId: "in_next",
        }),
      ],
      legacyByEmail: async () => ({ status: "unique", member: member("m1") }),
      legacyByStripeCustomerId: async () => ({ status: "unique", member: member("m1") }),
      subscriptionsForMember: async () => [],
      memberstackByEmail: async () => ({ status: "not_found" }),
      earlyRenewalForInvoice: async () => ({ status: "none" }),
      statusesForCharges: async () => [
        {
          stripeChargeId: "ch_annual1",
          videoSentAt: "2026-10-30T19:00:00.000Z",
          cardSentAt: null,
          updatedAt: "2026-10-30T19:00:00.000Z",
        },
      ],
    });

    expect(page.error).toBeNull();
    expect(page.rows.map((row) => row.stripeChargeId)).toEqual(["ch_annual1", "ch_nextyear"]);
    const renewal = page.rows.find((row) => row.stripeChargeId === "ch_nextyear");
    const first = page.rows.find((row) => row.stripeChargeId === "ch_annual1");
    expect(renewal?.videoSent).toBe(false);
    expect(renewal?.cardSent).toBe(false);
    expect(renewal?.kind).toBe("renewing");
    expect(first?.videoSent).toBe(true);
    expect(first?.cardSent).toBe(false);
    expect(first?.kind).toBe("new");
    expect(first?.addressLines).toContain("1 Main St");
    expect(first?.addressLabel).toBe("Address on file, may need confirmation.");
    expect(first?.displayName).toBe("Ada Lovelace");
  });

  it("does not guess when an email matches more than one person", async () => {
    const page = await loadMemberThankYouPage({
      now: NOW,
      annualPriceIds: new Set(["price_annual"]),
      monthlyPriceIds: new Set(),
      fetchCharges: async () => [annualCharge({ billingReason: "subscription_create" })],
      legacyByEmail: async () => ({
        status: "ambiguous",
        members: [member("m1"), member("m2")],
      }),
      legacyByStripeCustomerId: async () => ({ status: "none" }),
      subscriptionsForMember: async () => {
        throw new Error("should not load a guessed member");
      },
      memberstackByEmail: async () => ({ status: "not_found" }),
      earlyRenewalForInvoice: async () => ({ status: "none" }),
      statusesForCharges: async () => [],
    });

    expect(page.rows).toHaveLength(1);
    expect(page.rows[0]?.kind).toBe("unknown");
    expect(page.rows[0]?.addressLines).toBeNull();
    expect(page.rows[0]?.noAddressMessage).toBe("No mailing address on file.");
    expect(page.rows[0]?.profileHref).toBeNull();
  });

  it("marks a lapsed paid membership as returning", async () => {
    const page = await loadMemberThankYouPage({
      now: NOW,
      annualPriceIds: new Set(["price_annual"]),
      monthlyPriceIds: new Set(),
      fetchCharges: async () => [annualCharge()],
      legacyByEmail: async () => ({ status: "unique", member: member("m1") }),
      legacyByStripeCustomerId: async () => ({ status: "none" }),
      subscriptionsForMember: async () => [endedSubscription()],
      memberstackByEmail: async () => ({ status: "not_found" }),
      earlyRenewalForInvoice: async () => ({ status: "none" }),
      statusesForCharges: async () => [],
    });

    expect(page.rows[0]?.kind).toBe("returning");
  });

  it("reports missing annual price configuration instead of guessing", async () => {
    let fetched = false;
    const page = await loadMemberThankYouPage({
      now: NOW,
      annualPriceIds: new Set(),
      monthlyPriceIds: new Set(),
      fetchCharges: async () => {
        fetched = true;
        return [annualCharge()];
      },
    });
    expect(fetched).toBe(false);
    expect(page.priceConfigReady).toBe(false);
    expect(page.rows).toHaveLength(0);
    expect(page.warnings.join(" ")).toMatch(/not configured/i);
  });
});
