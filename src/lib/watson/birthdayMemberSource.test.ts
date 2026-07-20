import { describe, expect, it, vi } from "vitest";

import {
  ACTIVE_LEGACY_BIRTHDAY_MEMBERS_SQL,
  buildMailingAddressParts,
  loadActiveLegacyBirthdayMembers,
  mapLegacyBirthdayMemberRow,
  parseBirthdayMonthDay,
  type LegacyBirthdayMemberQueryRow,
} from "./birthdayMemberSource";
import { CURRENT_LEGACY_MEMBER_WHERE_SQL } from "./legacyMembershipReportsShared";

function sampleRow(
  overrides: Partial<LegacyBirthdayMemberQueryRow> = {},
): LegacyBirthdayMemberQueryRow {
  return {
    memberid: "M-100",
    fristname: "Ada",
    lastname: "Lovelace",
    birthdayinfo: "1900-12-10",
    subscriptiontype: "Basic Membership",
    subscriptiondate: "2018-03-01T00:00:00.000Z",
    datejoined: "2017-01-15T00:00:00.000Z",
    address: "1 Computing Lane",
    address2: null,
    city: "London",
    state: null,
    postalcode: "SW1A 1AA",
    country: "UK",
    ...overrides,
  };
}

describe("birthdayMemberSource", () => {
  it("reuses the shared current-member WHERE filter", () => {
    expect(ACTIVE_LEGACY_BIRTHDAY_MEMBERS_SQL).toContain(
      CURRENT_LEGACY_MEMBER_WHERE_SQL.trim(),
    );
    expect(ACTIVE_LEGACY_BIRTHDAY_MEMBERS_SQL).toContain("birthdayinfo IS NOT NULL");
  });

  it("includes only rows returned by the active-member query and maps them", async () => {
    const queryFn = vi.fn(async () => [
      sampleRow(),
      sampleRow({
        memberid: "M-inactive-skipped-by-sql",
        fristname: "Inactive",
        lastname: "Person",
        // Query layer already applies active filter; this asserts mapping of returned rows.
      }),
    ]);

    const members = await loadActiveLegacyBirthdayMembers(queryFn);
    expect(queryFn).toHaveBeenCalledWith(ACTIVE_LEGACY_BIRTHDAY_MEMBERS_SQL);
    expect(members).toHaveLength(2);
    expect(members[0]?.memberId).toBe("M-100");
    expect(members[0]?.profileHref).toBe("/watson/customers/legacy/M-100");
    expect(members[0]?.notesHref).toBe("/watson/customers/legacy/M-100#customer-notes");
  });

  it("excludes members without a valid birthday after query", async () => {
    const queryFn = vi.fn(async () => [
      sampleRow({ birthdayinfo: null }),
      sampleRow({ memberid: "M-bad", birthdayinfo: "not-a-date" }),
      sampleRow({ memberid: "M-ok", birthdayinfo: "1900-07-04" }),
    ]);

    const members = await loadActiveLegacyBirthdayMembers(queryFn);
    expect(members).toHaveLength(1);
    expect(members[0]?.memberId).toBe("M-ok");
    expect(members[0]?.birthMonth).toBe(7);
    expect(members[0]?.birthDay).toBe(4);
  });

  it("parses birthdays as month/day regardless of birth year", () => {
    expect(parseBirthdayMonthDay("1900-03-15")).toEqual({ month: 3, day: 15 });
    expect(parseBirthdayMonthDay("1999-03-15")).toEqual({ month: 3, day: 15 });
    expect(parseBirthdayMonthDay("2000-02-29")).toEqual({ month: 2, day: 29 });
    expect(parseBirthdayMonthDay(null)).toBeNull();
    expect(parseBirthdayMonthDay("1900-02-30")).toBeNull();
  });

  it("builds member record and notes links on the existing customer routes", () => {
    const member = mapLegacyBirthdayMemberRow(sampleRow({ memberid: "ABC 123" }));
    expect(member?.profileHref).toBe("/watson/customers/legacy/ABC%20123");
    expect(member?.notesHref).toBe("/watson/customers/legacy/ABC%20123#customer-notes");
    expect(member?.birthdayLabel).toBe("December 10");
    expect(member?.memberSinceDisplay).toBeTruthy();
    expect(member?.planDisplay).toBe("Basic Membership");
    expect(member?.mailingCountry).toBe("UK");
    expect(member?.hasMailingAddress).toBe(true);
  });

  it("flags missing mailing address clearly", () => {
    const address = buildMailingAddressParts({
      address: null,
      address2: null,
      city: null,
      state: null,
      postalcode: null,
      country: null,
    });
    expect(address.hasMailingAddress).toBe(false);
    expect(address.mailingAddressDisplay).toBeNull();
  });
});
