import { describe, expect, it, vi } from "vitest";

import { MEMBER_BY_EMAIL_SQL } from "./customerIdentifier";
import {
  canRunMemberstackDirectorySearch,
  CUSTOMER_NAME_SEARCH_MIN_LENGTH,
  searchCustomers,
} from "./customerSearch";

describe("customerSearch", () => {
  it("links exact email search results to Memberstack profile URLs", async () => {
    const result = await searchCustomers("exact@example.com", {
      getClient: async () => ({
        getMember: async (lookup: string) =>
          lookup === "exact@example.com"
            ? {
                id: "mem_exact",
                auth: { email: "exact@example.com" },
                planConnections: [{ active: true, status: "ACTIVE" }],
              }
            : null,
        listMembers: async () => ({ data: [], hasNextPage: false }),
      }),
      queryFn: vi.fn(async () => []),
    });

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]?.memberstackId).toBe("mem_exact");
    expect(result.rows[0]?.profileHref).toBe(
      "/watson/customers/memberstack/mem_exact?q=exact%40example.com",
    );
    expect(result.rows[0]?.membershipStatus).toBe("Active");
  });

  it("returns legacy-only customers with legacy profile URLs", async () => {
    const queryFn = vi.fn(async (sql: string) => {
      if (sql.includes("memberid = $1")) {
        return [
          {
            memberid: "M9",
            fristname: "Legacy",
            lastname: "Only",
            email: "legacy-only@example.com",
            address: null,
            address2: null,
            city: null,
            state: null,
            postalcode: null,
            country: null,
            birthdayinfo: null,
            datejoined: null,
            active: null,
            betaactive: null,
            currentsubscriber: null,
          },
        ];
      }
      return [];
    });

    const result = await searchCustomers("M9", {
      queryFn,
      getClient: async () => ({
        getMember: async () => null,
        listMembers: async () => ({ data: [], hasNextPage: false }),
      }),
    });

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]?.profileHref).toBe("/watson/customers/legacy/M9?q=M9");
    expect(result.rows[0]?.legacyProfileHref).toBe("/watson/customers/legacy/M9?q=M9");
    expect(result.rows[0]?.statusLabel).toBe("Legacy customer (not linked to Memberstack)");
    expect(result.rows[0]?.legacyMemberHref).toBe("/watson/members/M9");
  });

  it("shows both profile URLs for linked customers", async () => {
    const queryFn = vi.fn(async (sql: string, params?: unknown[]) => {
      if (sql === MEMBER_BY_EMAIL_SQL) {
        return [
          {
            memberid: "M99",
            fristname: "Exact",
            lastname: "Match",
            email: "exact@example.com",
            address: null,
            address2: null,
            city: null,
            state: null,
            postalcode: null,
            country: null,
            birthdayinfo: null,
            datejoined: "2020-01-02T00:00:00.000Z",
            active: 1,
            betaactive: null,
            currentsubscriber: null,
          },
        ];
      }
      return [];
    });

    const result = await searchCustomers("exact@example.com", {
      queryFn,
      getClient: async () => ({
        getMember: async () => ({
          id: "mem_exact",
          auth: { email: "exact@example.com" },
          planConnections: [],
        }),
        listMembers: async () => ({ data: [], hasNextPage: false }),
      }),
    });

    expect(result.rows[0]?.legacyMemberid).toBe("M99");
    expect(result.rows[0]?.profileHref).toContain("/watson/customers/memberstack/mem_exact");
    expect(result.rows[0]?.legacyProfileHref).toContain("/watson/customers/legacy/M99");
    expect(result.rows[0]?.linkStatus).toBe("linked");
  });

  it("finds Memberstack-only customers by directory search", async () => {
    const result = await searchCustomers("mem_only", {
      getClient: async () => ({
        getMember: async (lookup: string) =>
          lookup === "mem_only"
            ? {
                id: "mem_only",
                auth: { email: "ms-only@example.com", firstName: "MS", lastName: "Only" },
                planConnections: [],
              }
            : null,
        listMembers: async () => ({ data: [], hasNextPage: false }),
      }),
      queryFn: vi.fn(async () => []),
    });

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]?.linkStatus).toBe("memberstack_only");
    expect(result.rows[0]?.profileHref).toContain("/watson/customers/memberstack/mem_only");
  });

  it("requires at least two characters for name search", async () => {
    expect(canRunMemberstackDirectorySearch("s")).toBe(false);
    expect(canRunMemberstackDirectorySearch("su")).toBe(true);
    expect(canRunMemberstackDirectorySearch("sue@example.com")).toBe(true);
    expect(canRunMemberstackDirectorySearch("mem_abc")).toBe(true);

    const result = await searchCustomers("s", {
      queryFn: vi.fn(async () => []),
      getClient: async () => ({
        getMember: async () => null,
        listMembers: async () => ({ data: [], hasNextPage: false }),
      }),
    });

    expect(result.rows).toHaveLength(0);
    expect(result.searchError).toBe(
      `Enter at least ${CUSTOMER_NAME_SEARCH_MIN_LENGTH} characters for a name search.`,
    );
  });

  it("does not merge ambiguous legacy email matches into one row", async () => {
    const queryFn = vi.fn(async (sql: string) => {
      if (sql === MEMBER_BY_EMAIL_SQL) {
        return [
          {
            memberid: "M1",
            fristname: "A",
            lastname: "One",
            email: "shared@example.com",
            address: null,
            address2: null,
            city: null,
            state: null,
            postalcode: null,
            country: null,
            birthdayinfo: null,
            datejoined: null,
            active: null,
            betaactive: null,
            currentsubscriber: null,
          },
          {
            memberid: "M2",
            fristname: "B",
            lastname: "Two",
            email: "shared@example.com",
            address: null,
            address2: null,
            city: null,
            state: null,
            postalcode: null,
            country: null,
            birthdayinfo: null,
            datejoined: null,
            active: null,
            betaactive: null,
            currentsubscriber: null,
          },
        ];
      }
      return [];
    });

    const result = await searchCustomers("shared@example.com", {
      queryFn,
      getClient: async () => ({
        getMember: async () => ({
          id: "mem_shared",
          auth: { email: "shared@example.com" },
          planConnections: [],
        }),
        listMembers: async () => ({ data: [], hasNextPage: false }),
      }),
    });

    expect(result.rows[0]?.legacyMemberid).toBeNull();
    expect(result.rows[0]?.profileHref).toBe(
      "/watson/customers/memberstack/mem_shared?q=shared%40example.com",
    );
    expect(result.rows.filter((row) => row.linkStatus === "ambiguous_email")).toHaveLength(2);
  });
});
