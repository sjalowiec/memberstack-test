import { describe, expect, it, vi } from "vitest";

import {
  buildMemberSearchPattern,
  formatMemberDisplayName,
  formatMemberJoinedDate,
  isMemberSearchQueryUsable,
  MEMBER_SEARCH_LIMIT,
  MEMBER_SEARCH_SQL,
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

    expect(queryFn).toHaveBeenCalledWith(MEMBER_SEARCH_SQL, ["%sue%", MEMBER_SEARCH_LIMIT + 1]);
    expect(result.rows).toHaveLength(1);
    expect(result.truncated).toBe(false);
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
