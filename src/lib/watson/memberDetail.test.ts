import { describe, expect, it, vi } from "vitest";

import {
  buildMemberOverviewFields,
  buildMemberSearchReturnUrl,
  formatBirthdayMonthDay,
  formatLegacyMemberStatus,
  getLegacyMemberById,
  MEMBER_DETAIL_SQL,
} from "./memberDetail";

describe("memberDetail", () => {
  const sampleMember = {
    memberid: "3B43FD8E-A9F3-4B1A-74CC-255ACCD77E11",
    fristname: "Matthew",
    lastname: "Friedman",
    email: "matt@example.com",
    address: "21 Lorraine Terrace",
    address2: null,
    city: "Marblehead",
    state: "MA",
    postalcode: "01945",
    country: "US",
    birthdayinfo: "1900-03-15",
    datejoined: "2009-08-21T00:43:14.703Z",
    subscriptionexpiring: "2026-07-29",
    active: 1,
    betaactive: 1,
    currentsubscriber: 1,
  };

  it("selects subscriptionexpiring for the Watson paid-through date", () => {
    expect(MEMBER_DETAIL_SQL).toContain("subscriptionexpiring");
  });

  it("loads a member by legacy member ID", async () => {
    const queryFn = vi.fn(async () => [sampleMember]);
    const member = await getLegacyMemberById(sampleMember.memberid, queryFn);
    expect(queryFn).toHaveBeenCalledWith(MEMBER_DETAIL_SQL, [sampleMember.memberid]);
    expect(member?.email).toBe("matt@example.com");
  });

  it("returns null when the member does not exist", async () => {
    const queryFn = vi.fn(async () => []);
    const member = await getLegacyMemberById("missing-id", queryFn);
    expect(member).toBeNull();
  });

  it("formats birthday as month/day only", () => {
    expect(formatBirthdayMonthDay("1900-03-15")).toBe("March 15");
  });

  it("builds overview fields and hides empty values", () => {
    const fields = buildMemberOverviewFields({
      ...sampleMember,
      address2: "Suite 2",
      email: "",
      state: null,
    });

    expect(fields.map((field) => field.label)).toEqual([
      "Member ID",
      "First name",
      "Last name",
      "Mailing address",
      "City",
      "Zip / Postal code",
      "Country",
      "Birthday",
      "Date joined",
      "Legacy member status",
    ]);
    expect(fields.find((field) => field.label === "Mailing address")?.value).toBe(
      "21 Lorraine Terrace\nSuite 2",
    );
    expect(formatLegacyMemberStatus(1)).toBe("Active");
  });

  it("builds a search return URL when q is present", () => {
    expect(buildMemberSearchReturnUrl("sue@example.com")).toBe(
      "/watson?q=sue%40example.com",
    );
    expect(buildMemberSearchReturnUrl("")).toBe("/watson");
  });
});
