import { describe, expect, it, vi } from "vitest";

import { MEMBER_BY_EMAIL_SQL } from "./customerIdentifier";
import {
  canRunMemberstackDirectorySearch,
  CUSTOMER_NAME_SEARCH_MIN_LENGTH,
  MEMBER_SEARCH_LIMIT,
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
      secretKey: "sk_live_test_key",
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

  it("links a gmail.com search to a googlemail.com dump customer without rewriting the dump email", async () => {
    const queryFn = vi.fn(async (sql: string, params?: unknown[]) => {
      if (sql === MEMBER_BY_EMAIL_SQL && params?.[0] === "beckyc.callow8@googlemail.com") {
        return [
          {
            memberid: "F1A91EE9-F002-5DD0-39F2-51AE099F4FB2",
            fristname: "Rebecca",
            lastname: "Callow",
            email: "beckyc.callow8@googlemail.com",
            address: null,
            address2: null,
            city: null,
            state: null,
            postalcode: null,
            country: null,
            birthdayinfo: null,
            datejoined: "2026-01-17T00:00:00.000Z",
            active: 0,
            betaactive: null,
            currentsubscriber: null,
          },
        ];
      }
      return [];
    });

    const result = await searchCustomers("beckyc.callow8@gmail.com", {
      queryFn,
      getClient: async () => ({
        getMember: async (lookup: string) =>
          lookup === "beckyc.callow8@gmail.com"
            ? {
                id: "mem_becky",
                auth: { email: "beckyc.callow8@gmail.com" },
                planConnections: [],
              }
            : null,
        listMembers: async () => ({ data: [], hasNextPage: false }),
      }),
    });

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]?.linkStatus).toBe("linked");
    expect(result.rows[0]?.legacyMemberid).toBe("F1A91EE9-F002-5DD0-39F2-51AE099F4FB2");
    expect(result.rows[0]?.email).toBe("beckyc.callow8@gmail.com");
    expect(result.rows[0]?.legacyProfileHref).toContain(
      "/watson/customers/legacy/F1A91EE9-F002-5DD0-39F2-51AE099F4FB2",
    );
  });
});

describe("customerSearch name and partial matching", () => {
  type LegacyFixture = {
    memberid: string;
    fristname: string;
    lastname: string;
    email: string;
    datejoined?: string | null;
  };

  type MemberstackFixture = {
    id: string;
    auth: { email: string; firstName?: string; lastName?: string };
    planConnections?: Array<{ active?: boolean; status?: string }>;
  };

  function haystacksForLegacy(row: LegacyFixture): string[] {
    return [
      row.memberid,
      row.email,
      row.fristname,
      row.lastname,
      `${row.fristname} ${row.lastname}`,
    ].map((value) => value.toLowerCase());
  }

  function createSearchDeps(args: {
    legacyMembers?: LegacyFixture[];
    memberstackMembers?: MemberstackFixture[];
  }) {
    const legacyMembers = args.legacyMembers ?? [];
    const memberstackMembers = args.memberstackMembers ?? [];
    const listMembers = vi.fn(async () => ({
      data: memberstackMembers,
      hasNextPage: false,
    }));

    const queryFn = vi.fn(async (sql: string, params?: unknown[]) => {
      if (sql.includes("ILIKE") && sql.includes("fristname")) {
        const tokens = (params ?? []).slice(1, -1).map((param) =>
          String(param).replace(/^%/, "").replace(/%$/, "").toLowerCase(),
        );
        return legacyMembers.filter((row) => {
          const haystacks = haystacksForLegacy(row);
          return tokens.every((token) => haystacks.some((value) => value.includes(token)));
        });
      }

      if (sql === MEMBER_BY_EMAIL_SQL) {
        const email = String(params?.[0] ?? "").toLowerCase();
        return legacyMembers
          .filter((row) => row.email.toLowerCase() === email)
          .map((row) => ({
            ...row,
            address: null,
            address2: null,
            city: null,
            state: null,
            postalcode: null,
            country: null,
            birthdayinfo: null,
            datejoined: row.datejoined ?? null,
            active: null,
            betaactive: null,
            currentsubscriber: null,
          }));
      }

      if (sql.includes("WHERE memberid = $1")) {
        const memberid = String(params?.[0] ?? "");
        return legacyMembers
          .filter((row) => row.memberid === memberid)
          .map((row) => ({
            ...row,
            address: null,
            address2: null,
            city: null,
            state: null,
            postalcode: null,
            country: null,
            birthdayinfo: null,
            datejoined: row.datejoined ?? null,
            active: null,
            betaactive: null,
            currentsubscriber: null,
          }));
      }

      return [];
    });

    return {
      listMembers,
      queryFn,
      deps: {
        secretKey: "sk_live_test_key",
        queryFn,
        getClient: async () => ({
          getMember: async (lookup: string) =>
            memberstackMembers.find(
              (member) => member.id === lookup || member.auth.email === lookup,
            ) ?? null,
          listMembers,
        }),
      },
    };
  }

  const janeSmith: LegacyFixture = {
    memberid: "M-JANE-SMITH",
    fristname: "Jane",
    lastname: "Smith",
    email: "jane.smith@example.com",
  };
  const janeOther: LegacyFixture = {
    memberid: "M-JANE-OTHER",
    fristname: "Jane",
    lastname: "Other",
    email: "jane.other@example.com",
  };
  const janeSmithDuplicate: LegacyFixture = {
    memberid: "M-JANE-SMITH-2",
    fristname: "Jane",
    lastname: "Smith",
    email: "jane.smith.2@example.com",
  };
  const patHall: LegacyFixture = {
    memberid: "M-PAT-HALL",
    fristname: "Pat",
    lastname: "Hall",
    email: "pat.hall@example.com",
  };
  const samHalliday: LegacyFixture = {
    memberid: "M-SAM-HALLIDAY",
    fristname: "Sam",
    lastname: "Halliday",
    email: "sam.halliday@example.com",
  };

  it("keeps complete emails on the exact-email path and does not directory-search", async () => {
    const { listMembers, deps } = createSearchDeps({
      legacyMembers: [janeSmith],
      memberstackMembers: [
        {
          id: "mem_jane",
          auth: { email: "jane.smith@example.com", firstName: "Jane", lastName: "Smith" },
          planConnections: [{ active: true, status: "ACTIVE" }],
        },
      ],
    });

    const result = await searchCustomers("jane.smith@example.com", deps);

    expect(listMembers).not.toHaveBeenCalled();
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]?.email).toBe("jane.smith@example.com");
    expect(result.rows[0]?.name).toBe("Jane Smith");
    expect(result.rows[0]?.memberstackId).toBe("mem_jane");
    expect(result.rows[0]?.legacyMemberid).toBe("M-JANE-SMITH");
    expect(result.rows[0]?.membershipStatus).toBe("Active");
    expect(result.searchError).toBeNull();
  });

  it("finds a customer by a partial email address", async () => {
    const { listMembers, deps } = createSearchDeps({
      legacyMembers: [janeSmith, janeOther],
      memberstackMembers: [
        {
          id: "mem_jane",
          auth: { email: "jane.smith@example.com", firstName: "Jane", lastName: "Smith" },
          planConnections: [],
        },
      ],
    });

    const result = await searchCustomers("jane.smi", deps);

    expect(listMembers).not.toHaveBeenCalled();
    expect(result.rows.map((row) => row.email)).toEqual(["jane.smith@example.com"]);
    expect(result.rows[0]?.name).toBe("Jane Smith");
    expect(result.rows[0]?.legacyMemberid).toBe("M-JANE-SMITH");
  });

  it("finds a customer by a partial email that includes @", async () => {
    const { listMembers, deps } = createSearchDeps({
      legacyMembers: [janeSmith, janeOther],
      memberstackMembers: [
        {
          id: "mem_jane",
          auth: { email: "jane.smith@example.com", firstName: "Jane", lastName: "Smith" },
          planConnections: [],
        },
      ],
    });

    const result = await searchCustomers("jane.smith@exam", deps);

    expect(listMembers).not.toHaveBeenCalled();
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]?.email).toBe("jane.smith@example.com");
  });

  it("finds a customer by exact last name and ranks it before a partial last-name match", async () => {
    const { deps } = createSearchDeps({
      legacyMembers: [patHall, samHalliday],
    });

    const result = await searchCustomers("Hall", deps);

    expect(result.rows.map((row) => row.legacyMemberid)).toEqual(["M-PAT-HALL", "M-SAM-HALLIDAY"]);
    expect(result.rows[0]?.name).toBe("Pat Hall");
    expect(result.rows[0]?.email).toBe("pat.hall@example.com");
  });

  it("finds a customer by a partial last name", async () => {
    const { deps } = createSearchDeps({
      legacyMembers: [janeSmith, janeOther],
    });

    const result = await searchCustomers("Smi", deps);

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]?.name).toBe("Jane Smith");
    expect(result.rows[0]?.email).toBe("jane.smith@example.com");
  });

  it("finds customers by first name", async () => {
    const { deps } = createSearchDeps({
      legacyMembers: [janeSmith, janeOther, patHall],
    });

    const result = await searchCustomers("Jane", deps);

    expect(result.rows.map((row) => row.legacyMemberid).sort()).toEqual([
      "M-JANE-OTHER",
      "M-JANE-SMITH",
    ]);
  });

  it("requires both first and last name parts to match the same customer", async () => {
    const { deps } = createSearchDeps({
      legacyMembers: [janeSmith, janeOther, patHall],
      memberstackMembers: [
        {
          id: "mem_jane",
          auth: { email: "jane.smith@example.com", firstName: "Jane", lastName: "Smith" },
          planConnections: [],
        },
        {
          id: "mem_other",
          auth: { email: "jane.other@example.com", firstName: "Jane", lastName: "Other" },
          planConnections: [],
        },
      ],
    });

    const result = await searchCustomers("Jane Smith", deps);

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]?.name).toBe("Jane Smith");
    expect(result.rows[0]?.email).toBe("jane.smith@example.com");
    expect(result.rows[0]?.legacyMemberid).toBe("M-JANE-SMITH");
    expect(result.rows[0]?.memberstackId).toBe("mem_jane");
  });

  it("matches names with mixed capitalization", async () => {
    const { deps } = createSearchDeps({
      legacyMembers: [janeSmith],
    });

    const result = await searchCustomers("jAnE sMiTh", deps);

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]?.name).toBe("Jane Smith");
  });

  it("matches names with leading, trailing, or repeated spaces", async () => {
    const { deps } = createSearchDeps({
      legacyMembers: [janeSmith],
    });

    const result = await searchCustomers("  Jane    Smith  ", deps);

    expect(result.rows).toHaveLength(1);
    expect(result.query).toBe("Jane Smith");
    expect(result.rows[0]?.email).toBe("jane.smith@example.com");
  });

  it("returns duplicate names with enough identifying information to tell them apart", async () => {
    const { deps } = createSearchDeps({
      legacyMembers: [janeSmith, janeSmithDuplicate],
      memberstackMembers: [
        {
          id: "mem_jane",
          auth: { email: "jane.smith@example.com", firstName: "Jane", lastName: "Smith" },
          planConnections: [{ active: true, status: "ACTIVE" }],
        },
        {
          id: "mem_jane_2",
          auth: { email: "jane.smith.2@example.com", firstName: "Jane", lastName: "Smith" },
          planConnections: [],
        },
      ],
    });

    const result = await searchCustomers("Jane Smith", deps);

    expect(result.rows).toHaveLength(2);
    expect(result.rows.map((row) => row.name)).toEqual(["Jane Smith", "Jane Smith"]);
    expect(result.rows.map((row) => row.email).sort()).toEqual([
      "jane.smith.2@example.com",
      "jane.smith@example.com",
    ]);
    expect(result.rows.map((row) => row.legacyMemberid).sort()).toEqual([
      "M-JANE-SMITH",
      "M-JANE-SMITH-2",
    ]);
    expect(result.rows.map((row) => row.memberstackId).sort()).toEqual(["mem_jane", "mem_jane_2"]);
    expect(result.rows.some((row) => row.membershipStatus === "Active")).toBe(true);
    expect(result.rows.some((row) => row.membershipStatus === "Inactive")).toBe(true);
  });

  it("returns no results when nothing matches", async () => {
    const { deps } = createSearchDeps({
      legacyMembers: [janeSmith, patHall],
      memberstackMembers: [
        {
          id: "mem_jane",
          auth: { email: "jane.smith@example.com", firstName: "Jane", lastName: "Smith" },
          planConnections: [],
        },
      ],
    });

    const result = await searchCustomers("zzznomatch", deps);

    expect(result.rows).toHaveLength(0);
    expect(result.truncated).toBe(false);
  });

  it("caps a common last-name search instead of returning thousands of rows", async () => {
    const legacyMembers = Array.from({ length: MEMBER_SEARCH_LIMIT + 8 }, (_, index) => ({
      memberid: `M-SMITH-${index}`,
      fristname: `First${index}`,
      lastname: "Smith",
      email: `smith${index}@example.com`,
    }));
    const { deps } = createSearchDeps({ legacyMembers });

    const result = await searchCustomers("Smith", deps);

    expect(result.rows).toHaveLength(MEMBER_SEARCH_LIMIT);
    expect(result.truncated).toBe(true);
    expect(result.rows.every((row) => row.name.endsWith("Smith"))).toBe(true);
    expect(result.rows.every((row) => row.email && row.legacyMemberid)).toBe(true);
  });
});
