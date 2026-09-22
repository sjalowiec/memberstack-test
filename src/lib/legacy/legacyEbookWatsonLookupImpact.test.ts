import { describe, expect, it } from "vitest";
import { LEGACY_EBOOK_EXCLUDED_ITEM_IDS } from "./legacyEbookEntitlements";
import {
  LEGACY_EBOOK_WATSON_LOOKUP_IMPACT_EMAIL_UNIQUENESS_SQL,
  LEGACY_EBOOK_WATSON_LOOKUP_IMPACT_EXCLUDED_SQL,
  LEGACY_EBOOK_WATSON_LOOKUP_IMPACT_PAID_CLASS_SQL,
  LEGACY_EBOOK_WATSON_LOOKUP_IMPACT_QUALIFYING_SQL,
  classifyImpactBillingEmail,
  summarizeLegacyEbookWatsonLookupImpact,
} from "./legacyEbookWatsonLookupImpact";

describe("legacy ebook Watson lookup impact", () => {
  it("uses SELECT-only SQL", () => {
    for (const sql of [
      LEGACY_EBOOK_WATSON_LOOKUP_IMPACT_QUALIFYING_SQL,
      LEGACY_EBOOK_WATSON_LOOKUP_IMPACT_EMAIL_UNIQUENESS_SQL,
      LEGACY_EBOOK_WATSON_LOOKUP_IMPACT_PAID_CLASS_SQL,
      LEGACY_EBOOK_WATSON_LOOKUP_IMPACT_EXCLUDED_SQL,
    ]) {
      expect(sql).toMatch(/SELECT/i);
      expect(sql).not.toMatch(/\b(INSERT|UPDATE|DELETE|DROP|ALTER)\b/i);
    }
    expect(LEGACY_EBOOK_WATSON_LOOKUP_IMPACT_QUALIFYING_SQL).toContain("t.paid = 1");
    expect(LEGACY_EBOOK_WATSON_LOOKUP_IMPACT_EXCLUDED_SQL).toContain("t.paid = 1");
  });

  it("classifies blank, matching, and changed billing emails", () => {
    expect(classifyImpactBillingEmail(null, "texas44@gmail.com")).toBe("blank");
    expect(classifyImpactBillingEmail("texas44@gmail.com", "texas44@gmail.com")).toBe(
      "matching",
    );
    expect(
      classifyImpactBillingEmail("texas44@comcast.net", "texas44@gmail.com"),
    ).toBe("changed");
  });

  it("counts Linda-style recoveries and skips ambiguous, excluded, and colliding rows", () => {
    const summary = summarizeLegacyEbookWatsonLookupImpact({
      qualifyingItems: [
        {
          memberid: "LINDA",
          member_email: "texas44@gmail.com",
          billing_email: null,
          itemid: 589,
        },
        {
          memberid: "LINDA",
          member_email: "texas44@gmail.com",
          billing_email: null,
          itemid: 505,
        },
        {
          memberid: "LINDA",
          member_email: "texas44@gmail.com",
          billing_email: "texas44@comcast.net",
          itemid: 416,
        },
        {
          memberid: "LINDA",
          member_email: "texas44@gmail.com",
          billing_email: null,
          itemid: 589,
        },
        {
          memberid: "KAREN",
          member_email: "karen.l.wylie@gmail.com",
          billing_email: "karen.l.wylie@gmail.com",
          itemid: 675,
        },
        {
          memberid: "SHARED-1",
          member_email: "shared@example.com",
          billing_email: null,
          itemid: 416,
        },
        {
          memberid: "SHARED-2",
          member_email: "shared@example.com",
          billing_email: null,
          itemid: 418,
        },
        {
          memberid: null,
          member_email: null,
          billing_email: "orphan@example.com",
          itemid: 416,
        },
        {
          memberid: "NO-EMAIL",
          member_email: null,
          billing_email: null,
          itemid: 422,
        },
      ],
      emailUniqueness: [
        { email: "texas44@gmail.com", member_count: 1, sample_memberid: "LINDA" },
        {
          email: "karen.l.wylie@gmail.com",
          member_count: 1,
          sample_memberid: "KAREN",
        },
        { email: "shared@example.com", member_count: 2, sample_memberid: "SHARED-1" },
        {
          email: "texas44@comcast.net",
          member_count: 1,
          sample_memberid: "OTHER-COMCAST",
        },
      ],
      paidClass: {
        approved_paid: 20,
        excluded_paid: 4,
        non_catalog_paid: 100,
      },
      excludedItems: [
        { memberid: "LINDA", itemid: 621 },
        { memberid: "LINDA", itemid: 621 },
        { memberid: "OTHER", itemid: 520 },
      ],
      csvOwnership: [
        { email: "karen.l.wylie@gmail.com", itemId: "675" },
      ],
    });

    expect(summary.customersWhoWouldGainDownloads).toBe(1);
    expect(summary.additionalApprovedTitleEntitlements).toBe(3);
    expect(summary.additionalByBilling).toEqual({
      blankBillingEmail: 2,
      changedBillingEmail: 1,
      matchingBillingEmail: 0,
    });
    expect(summary.ambiguousLinksSkipped).toEqual({
      emails: 1,
      members: 2,
      qualifyingTitles: 2,
    });
    expect(summary.excludedItemsSkipped.lineItems).toBe(4);
    expect(summary.excludedItemsSkipped.uniqueItemIds).toBe(2);
    expect(summary.nonCatalogPaidItemsSkipped).toBe(100);
    expect(summary.identityCollisions.orphanMemberid).toBe(1);
    expect(summary.identityCollisions.membersWithoutEmail).toBe(1);
    expect(summary.identityCollisions.billingEmailBelongsToDifferentUniqueMember).toBe(
      1,
    );
    expect(summary.queryVolume.perMyDownloadsRequestWhenUniqueLink).toBe(3);
    expect(LEGACY_EBOOK_EXCLUDED_ITEM_IDS.has("621")).toBe(true);
  });
});
