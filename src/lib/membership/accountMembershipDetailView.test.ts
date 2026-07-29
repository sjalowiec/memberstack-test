import { describe, expect, it } from "vitest";
import type { AccountMembershipDetail } from "./accountMembershipDetail";
import type { MembershipHistoryEvent } from "./membershipHistory";
import { resolveAccountMembershipDetailView } from "./accountMembershipDetailView";

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

  it("does not override plan/status for an active paid member", () => {
    const view = resolveAccountMembershipDetailView(
      detail({
        membershipName: "Knit it Now Membership",
        statusLabel: "Active",
        legacyPaidThroughDate: null,
        legacyAccessActive: null,
        history: [event("Joined Knit it Now")],
      }),
    );
    expect(view.planOverride).toBeNull();
    expect(view.statusOverride).toBeNull();
    expect(view.legacyAccessValue).toBeNull();
  });

  it("shows Legacy Access Through (not Member Since) for a legacy member with a paid-through date", () => {
    const view = resolveAccountMembershipDetailView(
      detail({
        membershipName: "Legacy Membership",
        statusLabel: "Legacy Access",
        legacyPaidThroughDate: "September 15, 2026",
        legacyAccessActive: true,
        memberSince: "April 27, 2026",
      }),
    );
    expect(view.membershipDateLabel).toBe("Legacy Access Through");
    expect(view.membershipDateValue).toBe("September 15, 2026");
  });

  it("keeps Legacy Access Through for an expired legacy member (no empty row)", () => {
    const view = resolveAccountMembershipDetailView(
      detail({
        membershipName: null,
        legacyPaidThroughDate: "April 6, 2026",
        legacyAccessActive: false,
        memberSince: "October 27, 2023",
      }),
    );
    expect(view.membershipDateLabel).toBe("Legacy Access Through");
    expect(view.membershipDateValue).toBe("April 6, 2026");
  });

  it("keeps Member Since for a paid member and never shows Legacy Access Through", () => {
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

  it("keeps everything neutral when the detail is unidentified", () => {
    const view = resolveAccountMembershipDetailView(
      detail({ identified: false, history: [event("Joined")] }),
    );
    expect(view.planOverride).toBeNull();
    expect(view.statusOverride).toBeNull();
    expect(view.history.visible).toBe(false);
  });
});
