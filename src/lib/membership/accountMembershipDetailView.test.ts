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

  it("keeps everything neutral when the detail is unidentified", () => {
    const view = resolveAccountMembershipDetailView(
      detail({ identified: false, history: [event("Joined")] }),
    );
    expect(view.planOverride).toBeNull();
    expect(view.statusOverride).toBeNull();
    expect(view.history.visible).toBe(false);
  });
});
