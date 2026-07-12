import { describe, expect, it, vi } from "vitest";

import {
  buildMembershipDisplay,
  formatLegacyTimestampDisplay,
  formatLegacyTimestampSort,
  getMemberMembershipCount,
  getMemberMemberships,
  getVisibleMembershipColumns,
  MEMBER_MEMBERSHIP_COUNT_SQL,
  MEMBER_MEMBERSHIPS_SQL,
  MEMBER_MEMBERSHIP_SORTABLE_COLUMNS,
} from "./memberMembership";

describe("memberMembership", () => {
  const memberId = "4A9377D7-5056-A02D-DF1A-002D5814F282";

  const firstRow = {
    subscriptionid: 21316,
    memberid_fk: memberId,
    datebought: "2021-10-15T08:36:01.667Z",
    expirationdate: "2022-12-14T20:11:53.783Z",
    transactionguid_fk: "27851AD5-AC0C-1B45-95AA-EC5AE212F7FF",
    dollaramount: "135.00",
    renewal: 1,
    monthlybilling: 0,
    cancelled: 0,
    canceldate: null,
    premium: 0,
    processor: null,
    subscriptionrate_id: "E3D8E51D-0EA6-C8CE-6FB9-9F476CD61899",
    arb_id: "54777200",
    abr_inovicenumber: "20211015_083601",
  };

  const secondRow = {
    subscriptionid: 14571,
    memberid_fk: memberId,
    datebought: "2020-09-15T09:51:18.277Z",
    expirationdate: "2021-11-14T20:11:53.783Z",
    transactionguid_fk: "B4559513-CE0C-98D4-1C15-EC3B0F670FA3",
    dollaramount: "135.00",
    renewal: 1,
    monthlybilling: 0,
    cancelled: 0,
    canceldate: null,
    premium: 0,
    processor: null,
    subscriptionrate_id: null,
    arb_id: "49882099",
    abr_inovicenumber: "20200915_095118",
  };

  it("filters subscriptions by memberid_fk", async () => {
    const queryFn = vi.fn().mockResolvedValueOnce([]);

    await getMemberMemberships(memberId, queryFn);

    expect(queryFn).toHaveBeenCalledWith(MEMBER_MEMBERSHIPS_SQL, [memberId]);
    expect(MEMBER_MEMBERSHIPS_SQL).toContain("legacy_subscriptions");
    expect(MEMBER_MEMBERSHIPS_SQL).toContain("WHERE memberid_fk = $1");
  });

  it("defaults to newest Datebought first in SQL", () => {
    expect(MEMBER_MEMBERSHIPS_SQL).toContain(
      "ORDER BY datebought DESC NULLS LAST, subscriptionid DESC",
    );
  });

  it("counts membership records without loading full rows on the detail page", async () => {
    const queryFn = vi.fn().mockResolvedValueOnce([{ subscription_count: "4" }]);

    const count = await getMemberMembershipCount(memberId, queryFn);

    expect(queryFn).toHaveBeenCalledWith(MEMBER_MEMBERSHIP_COUNT_SQL, [memberId]);
    expect(count).toBe(4);
  });

  it("exposes sortable membership columns for the UI", () => {
    expect(MEMBER_MEMBERSHIP_SORTABLE_COLUMNS).toContain("subscriptionId");
    expect(MEMBER_MEMBERSHIP_SORTABLE_COLUMNS).toContain("startDate");
    expect(MEMBER_MEMBERSHIP_SORTABLE_COLUMNS).toContain("transactionGuid");
  });

  it("preserves multiple historical subscription records", async () => {
    const queryFn = vi.fn().mockResolvedValueOnce([firstRow, secondRow]);

    const records = await getMemberMemberships(memberId, queryFn);

    expect(records).toHaveLength(2);
    expect(records.map((record) => record.subscriptionId)).toEqual(["21316", "14571"]);
  });

  it("handles null or malformed legacy dates safely", () => {
    expect(formatLegacyTimestampDisplay(null)).toBeNull();
    expect(formatLegacyTimestampDisplay("not-a-date")).toBeNull();
    expect(formatLegacyTimestampSort("not-a-date")).toBe("");
    expect(formatLegacyTimestampDisplay("2021-10-15T08:36:01.667Z")).not.toBeNull();
  });

  it("hides optional columns when a member has no useful values", () => {
    const visible = getVisibleMembershipColumns([
      buildMembershipDisplay(firstRow),
      buildMembershipDisplay({
        ...secondRow,
        processor: null,
        subscriptionrate_id: null,
        canceldate: null,
        cancelled: null,
      }),
    ]);

    expect(visible.showProcessor).toBe(false);
    expect(visible.showSubscriptionRateId).toBe(true);
    expect(visible.showCancelledFlag).toBe(true);
    expect(visible.showCancelDate).toBe(false);
  });

  it("shows raw legacy flag values without reinterpretation", () => {
    const display = buildMembershipDisplay(firstRow);
    expect(display.cancelledFlag).toBe("0");
    expect(display.renewalFlag).toBe("1");
    expect(display.monthlyBillingFlag).toBe("0");
    expect(display.amount).toBe("$135.00");
  });
});
