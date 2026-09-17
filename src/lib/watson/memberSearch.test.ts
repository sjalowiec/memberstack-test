import { describe, expect, it, vi } from "vitest";

import {
  buildLegacyMemberSearchSql,
  buildMemberSearchPattern,
  formatMemberDisplayName,
  formatMemberJoinedDate,
  isMemberSearchQueryUsable,
  MEMBER_SEARCH_LIMIT,
  MEMBER_SEARCH_SQL,
  memberSearchTokens,
  normalizeMemberSearchQuery,
  rankLegacyMemberSearchMatch,
  searchLegacyMembers,
} from "./memberSearch";

describe("memberSearch", () => {
  it("builds a case-insensitive partial-match pattern", () => {
    expect(buildMemberSearchPattern("  Sue@Example.com  ")).toBe("%Sue@Example.com%");
  });

  it("rejects empty queries without hitting the database", async () => {
    const queryFn = vi.fn();
    const result = await searchLegacyMembers("   ", queryFn);
    expect(result.rows).toEqual([]);
    expect(result.truncated).toBe(false);
    expect(queryFn).not.toHaveBeenCalled();
  });

  it("queries legacy_members with ILIKE and a limit", async () => {
    const queryFn = vi.fn(async () => [
      {
        memberid: "M1",
        fristname: "Sue",
        lastname: "Example",
        email: "sue@example.com",
        city: "Flagstaff",
        state: "AZ",
        datejoined: "2020-01-02T00:00:00.000Z",
      },
    ]);

    const result = await searchLegacyMembers("sue", queryFn);

    expect(queryFn).toHaveBeenCalledWith(MEMBER_SEARCH_SQL, [
      "sue",
      "%sue%",
      MEMBER_SEARCH_LIMIT + 1,
    ]);
    expect(result.rows).toHaveLength(1);
    expect(result.truncated).toBe(false);
  });

  it("collapses extra spaces and searches first and last name as required tokens", async () => {
    const queryFn = vi.fn(async () => []);
    await searchLegacyMembers("  Jane    Smith  ", queryFn);

    expect(normalizeMemberSearchQuery("  Jane    Smith  ")).toBe("Jane Smith");
    expect(memberSearchTokens("  Jane    Smith  ")).toEqual(["Jane", "Smith"]);
    expect(queryFn).toHaveBeenCalledWith(buildLegacyMemberSearchSql(2), [
      "Jane Smith",
      "%Jane%",
      "%Smith%",
      MEMBER_SEARCH_LIMIT + 1,
    ]);
    const sql = String(queryFn.mock.calls[0]?.[0]);
    expect(sql).toContain(" AND ");
    expect(sql).toContain("watson_legacy_customers");
    expect(sql).toContain("fristname");
    expect(sql).toContain("lastname");
  });

  it("ranks exact last-name matches ahead of partial last-name matches", () => {
    expect(
      rankLegacyMemberSearchMatch(
        { memberid: "M1", fristname: "Pat", lastname: "Hall", email: "pat.hall@example.com" },
        "Hall",
      ),
    ).toBeLessThan(
      rankLegacyMemberSearchMatch(
        {
          memberid: "M2",
          fristname: "Sam",
          lastname: "Halliday",
          email: "sam.halliday@example.com",
        },
        "Hall",
      ),
    );
  });

  it("flags truncated result sets", async () => {
    const rows = Array.from({ length: MEMBER_SEARCH_LIMIT + 3 }, (_, index) => ({
      memberid: `M${index}`,
      fristname: null,
      lastname: null,
      email: null,
      city: null,
      state: null,
      datejoined: null,
    }));
    const queryFn = vi.fn(async () => rows);

    const result = await searchLegacyMembers("example", queryFn);

    expect(result.rows).toHaveLength(MEMBER_SEARCH_LIMIT);
    expect(result.truncated).toBe(true);
  });

  it("formats member display helpers", () => {
    expect(isMemberSearchQueryUsable("abc")).toBe(true);
    expect(formatMemberDisplayName({ fristname: "Sue", lastname: "Hall" })).toBe("Sue Hall");
    expect(formatMemberJoinedDate("2009-08-21T00:43:14.703Z")).toBe("2009-08-21T00:43:14.703Z");
  });
});
