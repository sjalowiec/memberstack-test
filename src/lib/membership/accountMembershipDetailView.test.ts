import { describe, expect, it } from "vitest";
import type { AccountMembershipDetail } from "./accountMembershipDetail";
import type { MembershipHistoryEvent } from "./membershipHistory";
import {
  resolveAccountMembershipDetailPaint,
  resolveAccountMembershipDetailView,
} from "./accountMembershipDetailView";

function event(title: string): MembershipHistoryEvent {
  return { type: "joined", title, date: "January 1, 2020", dateSort: "2020-01-01" };
}

function detail(
  overrides: Partial<AccountMembershipDetail>,
): AccountMembershipDetail {
  return {
    identified: true,
    membershipName: null,
    statusLabel: null,
    billingLabel: null,
    nextRenewalDate: null,
    activeThroughDate: null,
    legacyPaidThroughDate: null,
    legacyAccessActive: null,
    memberSince: null,
    history: [],
    ...overrides,
  };
}

describe("resolveAccountMembershipDetailView", () => {
  it("hides the history accordion when there are no events", () => {
    const view = resolveAccountMembershipDetailView(detail({ history: [] }));
    expect(view.history.visible).toBe(false);
    expect(view.history.count).toBe(0);
    expect(view.history.headerLabel).toBeNull();
  });

  it("shows a header count that matches the number of events", () => {
    const view = resolveAccountMembershipDetailView(
      detail({
        history: [event("Joined Knit it Now"), event("Renewed"), event("Migrated")],
      }),
    );
    expect(view.history.visible).toBe(true);
    expect(view.history.count).toBe(3);
    expect(view.history.headerLabel).toBe("Membership History (3)");
  });

  it("labels a future legacy member as Legacy Membership / Legacy Access", () => {
    const view = resolveAccountMembershipDetailView(
      detail({
        membershipName: null,
        legacyPaidThroughDate: "December 1, 2029",
        legacyAccessActive: true,
      }),
    );
    expect(view.planOverride).toBe("Legacy Membership");
    expect(view.statusOverride).toBe("Legacy Access");
    expect(view.legacyAccessValue).toBe("Available through December 1, 2029");
  });

  it("labels an expired legacy member as Legacy Membership / Expired", () => {
    const view = resolveAccountMembershipDetailView(
      detail({
        membershipName: null,
        legacyPaidThroughDate: "April 6, 2026",
        legacyAccessActive: false,
      }),
    );
    expect(view.planOverride).toBe("Legacy Membership");
    expect(view.statusOverride).toBe("Expired");
    expect(view.legacyAccessValue).toBe("Ended April 6, 2026");
  });

  it("does not overlay Expired or Become a Member for an active paid member", () => {
    const view = resolveAccountMembershipDetailView(
      detail({
        membershipName: "Knit it Now Membership",
        statusLabel: "Active",
        legacyPaidThroughDate: null,
        legacyAccessActive: null,
        memberSince: "March 14, 2017",
        history: [event("Joined Knit it Now")],
      }),
    );
    expect(view.planOverride).toBeNull();
    expect(view.statusOverride).toBeNull();
    expect(view.visibleActions).toBeNull();
    expect(view.membershipDateLabel).toBe("Member Since");
    expect(view.legacyAccessValue).toBeNull();
  });

  it("shows Paid through (not Member Since) for a legacy member with a paid-through date", () => {
    const view = resolveAccountMembershipDetailView(
      detail({
        membershipName: "Legacy Membership",
        statusLabel: "Legacy Access",
        legacyPaidThroughDate: "September 15, 2026",
        legacyAccessActive: true,
        memberSince: "April 27, 2026",
      }),
    );
    expect(view.membershipDateLabel).toBe("Paid through");
    expect(view.membershipDateValue).toBe("September 15, 2026");
    expect(view.planOverride).toBe("Legacy Membership");
    expect(view.statusOverride).toBe("Legacy Access");
  });

  it("keeps Paid through for an expired legacy member (no empty row)", () => {
    const view = resolveAccountMembershipDetailView(
      detail({
        membershipName: null,
        legacyPaidThroughDate: "April 6, 2026",
        legacyAccessActive: false,
        memberSince: "October 27, 2023",
      }),
    );
    expect(view.membershipDateLabel).toBe("Paid through");
    expect(view.membershipDateValue).toBe("April 6, 2026");
    expect(view.planOverride).toBe("Legacy Membership");
    expect(view.statusOverride).toBe("Expired");
  });

  it("overlays Expired when a connected free plan name is still present after paid-through ended", () => {
    const view = resolveAccountMembershipDetailView(
      detail({
        membershipName: "Legacy Membership",
        statusLabel: "Legacy Access",
        legacyPaidThroughDate: "April 6, 2026",
        legacyAccessActive: false,
        memberSince: "October 27, 2023",
      }),
    );
    expect(view.planOverride).toBe("Legacy Membership");
    expect(view.statusOverride).toBe("Expired");
    expect(view.legacyAccessValue).toBe("Ended April 6, 2026");
  });

  it("keeps Member Since for a paid member and never shows Paid through", () => {
    const view = resolveAccountMembershipDetailView(
      detail({
        membershipName: "Knit it Now Membership",
        statusLabel: "Active",
        legacyPaidThroughDate: null,
        legacyAccessActive: null,
        memberSince: "March 14, 2017",
      }),
    );
    expect(view.membershipDateLabel).toBe("Member Since");
    expect(view.membershipDateValue).toBe("March 14, 2017");
  });

  it("keeps Member Since for a canceling paid member", () => {
    const view = resolveAccountMembershipDetailView(
      detail({
        membershipName: "Knit it Now Membership",
        statusLabel: "Canceling",
        legacyPaidThroughDate: null,
        legacyAccessActive: null,
        memberSince: "January 1, 2020",
      }),
    );
    expect(view.membershipDateLabel).toBe("Member Since");
    expect(view.membershipDateValue).toBe("January 1, 2020");
  });

  it("hides the date row when there is neither a legacy date nor a member-since date", () => {
    const view = resolveAccountMembershipDetailView(
      detail({
        membershipName: null,
        legacyPaidThroughDate: null,
        legacyAccessActive: null,
        memberSince: null,
      }),
    );
    expect(view.membershipDateLabel).toBeNull();
    expect(view.membershipDateValue).toBeNull();
  });

  it("replaces unconfirmed labels when the detail is an identified active annual membership", () => {
    const paint = resolveAccountMembershipDetailPaint(
      detail({
        membershipName: "Knit it Now Membership",
        statusLabel: "Active",
        billingLabel: "Annual",
        memberSince: "April 1, 2017",
      }),
      {
        planLabel: "Membership status unavailable",
        statusLabel: "Could not confirm",
      },
    );
    expect(paint.planLabel).toBe("Annual Membership");
    expect(paint.statusLabel).toBe("Active");
    expect(paint.visibleActions).toEqual(["manageBilling"]);
    expect(paint.markMember).toBe(true);
    expect(paint.manageBillingDescription).toContain("payment method");
  });

  it("replaces blank labels when an identified active detail arrives first", () => {
    const paint = resolveAccountMembershipDetailPaint(
      detail({
        membershipName: "Knit it Now Membership",
        statusLabel: "Active",
        billingLabel: "Annual",
      }),
      { planLabel: "", statusLabel: "" },
    );
    expect(paint.planLabel).toBe("Annual Membership");
    expect(paint.statusLabel).toBe("Active");
    expect(paint.visibleActions).toEqual(["manageBilling"]);
  });

  it("replaces Legacy Membership with the annual plan and the Stripe renewal date", () => {
    const paint = resolveAccountMembershipDetailPaint(
      detail({
        membershipName: "Knit it Now Membership",
        statusLabel: "Active",
        billingLabel: "Annual",
        nextRenewalDate: "November 30, 2027",
        legacyPaidThroughDate: null,
      }),
      { planLabel: "Legacy Membership", statusLabel: "Legacy Access" },
    );
    expect(paint.planLabel).toBe("Annual Membership");
    expect(paint.statusLabel).toBe("Active");
    expect(paint.visibleActions).toEqual(["manageBilling"]);
    expect(paint.renewsLabel).toBe("November 30, 2027");
  });

  it("omits Next renewal when the Stripe billing date is missing", () => {
    const paint = resolveAccountMembershipDetailPaint(
      detail({
        membershipName: "Knit it Now Membership",
        statusLabel: "Active",
        billingLabel: "Annual",
        nextRenewalDate: null,
        legacyPaidThroughDate: "November 30, 2027",
      }),
      { planLabel: "Legacy Membership", statusLabel: "Legacy Access" },
    );
    expect(paint.planLabel).toBe("Annual Membership");
    expect(paint.renewsLabel).toBeNull();
  });

  it("does not replace an already active annual panel", () => {
    const paint = resolveAccountMembershipDetailPaint(
      detail({
        membershipName: "Knit it Now Membership",
        statusLabel: "Active",
        billingLabel: "Annual",
      }),
      { planLabel: "Annual Membership", statusLabel: "Active" },
    );
    expect(paint.planLabel).toBeNull();
    expect(paint.statusLabel).toBeNull();
    expect(paint.visibleActions).toBeNull();
    expect(paint.markMember).toBe(false);
  });

  it("keeps an expired legacy detail as Expired when the panel was unconfirmed", () => {
    const paint = resolveAccountMembershipDetailPaint(
      detail({
        membershipName: null,
        statusLabel: "Expired",
        legacyPaidThroughDate: "January 1, 2020",
        legacyAccessActive: false,
      }),
      {
        planLabel: "Membership status unavailable",
        statusLabel: "Could not confirm",
      },
    );
    expect(paint.planLabel).toBe("Legacy Membership");
    expect(paint.statusLabel).toBe("Expired");
    expect(paint.visibleActions).toEqual(["join"]);
  });

  it("overlays could-not-confirm when the detail is unidentified", () => {
    const view = resolveAccountMembershipDetailView(
      detail({ identified: false, history: [event("Joined")] }),
    );
    expect(view.planOverride).toBe("Membership status unavailable");
    expect(view.statusOverride).toBe("Could not confirm");
    expect(view.visibleActions).toEqual([]);
    expect(view.history.visible).toBe(false);
  });
});
