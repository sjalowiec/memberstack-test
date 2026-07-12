import { describe, expect, it, vi } from "vitest";

import { MEMBER_BY_EMAIL_SQL, resolveLegacyLinkByMemberstackEmail } from "./customerIdentifier";
import {
  buildProfileLegacyLinkState,
  buildCustomerHeaderFields,
  buildCustomerProfileActions,
  buildCustomerProfileHeaderView,
  buildCustomerSnapshot,
  buildNotLinkedMemberstackSummary,
  loadLegacyCustomerProfile,
  loadMemberstackCustomerProfile,
} from "./customerProfile";
import { type CustomerMemberstackSummary } from "./customerMemberstack";

const memberstackSummary = (
  overrides: Partial<CustomerMemberstackSummary> = {},
): CustomerMemberstackSummary => ({
  memberstackId: "mem_123",
  email: "sue@example.com",
  displayName: "sue@example.com",
  accountCreatedAt: "Jan 1, 2020",
  accountCreatedAtSort: "2020-01-01T00:00:00.000Z",
  connections: [],
  hasActiveConnection: false,
  membershipStatusLabel: "Inactive",
  configured: true,
  loadError: null,
  ...overrides,
});

const legacyMember = {
  memberid: "M1",
  fristname: "Sue",
  lastname: "Hall",
  email: "sue@example.com",
  address: null,
  address2: null,
  city: null,
  state: null,
  postalcode: null,
  country: null,
  birthdayinfo: null,
  datejoined: "2019-05-10T00:00:00.000Z",
  active: 1,
  betaactive: null,
  currentsubscriber: null,
};

describe("customerProfile", () => {
  it("omits empty header fields for Memberstack-only customers", () => {
    const fields = buildCustomerHeaderFields(null, memberstackSummary());

    expect(fields.find((field) => field.label === "Legacy member ID")).toBeUndefined();
    expect(fields.find((field) => field.label === "Memberstack member ID")?.value).toBe("mem_123");
    expect(fields.find((field) => field.label === "Email")?.value).toBe("sue@example.com");
  });

  it("shows legacy member ID when linked", () => {
    const fields = buildCustomerHeaderFields(
      legacyMember,
      memberstackSummary({ hasActiveConnection: true, membershipStatusLabel: "Active" }),
    );

    expect(fields.find((field) => field.label === "Legacy member ID")?.value).toBe("M1");
    expect(fields.find((field) => field.label === "Current membership status")?.value).toBe(
      "Active",
    );
  });

  it("shows not linked membership status for legacy-only header fields", () => {
    const fields = buildCustomerHeaderFields(legacyMember, buildNotLinkedMemberstackSummary(), {
      memberstackLinkStatus: "not_linked",
    });

    expect(fields.find((field) => field.label === "Current membership status")?.value).toBe(
      "Not yet linked to Memberstack",
    );
  });

  it("builds dashboard header view for legacy-only customers", () => {
    const header = buildCustomerProfileHeaderView({
      displayName: "Sue Hall",
      member: legacyMember,
      memberstack: buildNotLinkedMemberstackSummary(),
      memberstackLinkStatus: "not_linked",
      legacyMemberid: "M1",
      memberstackId: null,
      timeline: [],
    });

    expect(header.displayName).toBe("Sue Hall");
    expect(header.email).toBe("sue@example.com");
    expect(header.legacyMemberid).toBe("M1");
    expect(header.memberstackId).toBeNull();
    expect(header.membershipStatus).toBe("Not yet linked to Memberstack");
    expect(header.joinDate).toBeTruthy();
    expect(header.lastActivityDate).toBeNull();
  });

  it("builds snapshot metrics with unavailable placeholders when legacy history is missing", () => {
    const snapshot = buildCustomerSnapshot({
      member: null,
      memberstack: memberstackSummary({ hasActiveConnection: true, membershipStatusLabel: "Active" }),
      memberstackLinkStatus: "linked",
      courses: [],
      orders: [],
      pdfPurchaseCount: null,
      timeline: [],
      hasLegacyHistory: false,
    });

    expect(snapshot.find((metric) => metric.label === "Store orders")?.unavailable).toBe(true);
    expect(snapshot.find((metric) => metric.label === "Knit It Now courses owned")?.unavailable).toBe(
      true,
    );
    expect(snapshot.find((metric) => metric.label === "Current membership plan")?.value).not.toBe(
      "Not available yet",
    );
  });

  it("builds snapshot metrics from legacy purchase data", () => {
    const snapshot = buildCustomerSnapshot({
      member: legacyMember,
      memberstack: buildNotLinkedMemberstackSummary(),
      memberstackLinkStatus: "not_linked",
      courses: [
        {
          libraryRecordId: "1",
          courseId: "101",
          courseIdSort: "101",
          courseName: "Intro",
          dateAdded: "Jan 1, 2020",
          dateAddedSort: "2020-01-01T00:00:00.000Z",
          accessStatus: "Standard enrollment",
          creditId: null,
          creditIdSort: "",
        },
      ],
      orders: [
        {
          storeTransactionId: "1",
          transactionId: "txn-1",
          orderDate: "Feb 1, 2020",
          orderDateSort: "2020-02-01T00:00:00.000Z",
          orderStatus: "Paid",
          orderTotal: "$12.00",
          orderTotalSort: "12",
          paymentMethod: null,
          items: [],
        },
      ],
      pdfPurchaseCount: 3,
      timeline: [
        {
          eventType: "store_order",
          eventTypeLabel: "Store order",
          dateDisplay: "Feb 1, 2020",
          dateSort: "2020-02-01T00:00:00.000Z",
          description: "Order",
          source: "legacy_store_transactions",
        },
      ],
      hasLegacyHistory: true,
    });

    expect(snapshot.find((metric) => metric.label === "Store orders")?.value).toBe("1");
    expect(snapshot.find((metric) => metric.label === "Store lifetime sales")?.value).toBe("$12.00");
    expect(snapshot.find((metric) => metric.label === "Pattern PDF purchases")?.value).toBe("3");
    expect(snapshot.find((metric) => metric.label === "Last activity")?.value).toBe("Feb 1, 2020");
  });

  it("builds cross-navigation actions when linked", () => {
    const legacyActions = buildCustomerProfileActions({
      profileType: "legacy",
      memberstackId: "mem_123",
      legacyMemberid: "M1",
    });
    expect(legacyActions.some((action) => action.label === "Memberstack customer profile")).toBe(
      true,
    );

    const memberstackActions = buildCustomerProfileActions({
      profileType: "memberstack",
      memberstackId: "mem_123",
      legacyMemberid: "M1",
    });
    expect(memberstackActions.some((action) => action.label === "Legacy customer profile")).toBe(
      true,
    );
  });

  it("loads a full legacy-only profile without Memberstack", async () => {
    const queryFn = vi.fn(async (sql: string) => {
      if (sql.includes("memberid = $1")) {
        return [legacyMember];
      }
      if (sql.includes("FROM legacy_members")) {
        return [];
      }
      return [];
    });

    const result = await loadLegacyCustomerProfile("M1", {
      queryFn,
      getClient: async () => ({
        getMember: async () => null,
        listMembers: async () => ({ data: [], hasNextPage: false }),
      }),
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.profile.profileType).toBe("legacy");
    expect(result.profile.memberstackId).toBeNull();
    expect(result.profile.hasLegacyHistory).toBe(true);
    expect(result.profile.memberstackLinkStatus).toBe("not_linked");
    expect(result.profile.notesWriteId).toBe("M1");
    expect(result.profile.headerView.legacyMemberid).toBe("M1");
    expect(result.profile.snapshot.length).toBeGreaterThan(0);
    expect(result.profile.pdfPurchaseCount).toBe(0);
  });

  it("loads a linked legacy profile when Memberstack email matches", async () => {
    const queryFn = vi.fn(async (sql: string) => {
      if (sql.includes("memberid = $1")) {
        return [legacyMember];
      }
      return [];
    });

    const result = await loadLegacyCustomerProfile("M1", {
      queryFn,
      getClient: async () => ({
        getMember: async (lookup: string) =>
          lookup === "sue@example.com"
            ? {
                id: "mem_linked",
                auth: { email: "sue@example.com" },
                planConnections: [],
              }
            : null,
        listMembers: async () => ({ data: [], hasNextPage: false }),
      }),
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.profile.memberstackId).toBe("mem_linked");
    expect(result.profile.memberstackLinkStatus).toBe("linked");
    expect(result.profile.hasLiveMembership).toBe(true);
  });

  it("loads a full Memberstack-only profile without legacy history", async () => {
    const result = await loadMemberstackCustomerProfile("mem_only", {
      getClient: async () => ({
        getMember: async (lookup: string) =>
          lookup === "mem_only"
            ? {
                id: "mem_only",
                auth: { email: "ms-only@example.com" },
                planConnections: [],
              }
            : null,
        listMembers: async () => ({ data: [], hasNextPage: false }),
      }),
      queryFn: vi.fn(async () => []),
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.profile.profileType).toBe("memberstack");
    expect(result.profile.hasLegacyHistory).toBe(false);
    expect(result.profile.notesWriteId).toBe("mem_only");
    expect(result.profile.headerView.memberstackId).toBe("mem_only");
    expect(result.profile.snapshot.some((metric) => metric.unavailable)).toBe(true);
  });

  it("loads linked Memberstack profile with legacy history", async () => {
    const queryFn = vi.fn(async (sql: string, params?: unknown[]) => {
      if (sql === MEMBER_BY_EMAIL_SQL) {
        return [legacyMember];
      }
      return [];
    });

    const result = await loadMemberstackCustomerProfile("mem_linked", {
      getClient: async () => ({
        getMember: async (lookup: string) =>
          lookup === "mem_linked"
            ? {
                id: "mem_linked",
                auth: { email: "sue@example.com" },
                planConnections: [],
              }
            : null,
        listMembers: async () => ({ data: [], hasNextPage: false }),
      }),
      queryFn,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.profile.hasLegacyHistory).toBe(true);
    expect(result.profile.legacyMemberid).toBe("M1");
  });

  it("does not attach legacy history when multiple legacy emails match", () => {
    const state = buildProfileLegacyLinkState(
      {
        status: "ambiguous",
        members: [
          {
            memberid: "M1",
            fristname: "Sue",
            lastname: "One",
            email: "shared@example.com",
            address: null,
            address2: null,
            city: null,
            state: null,
            postalcode: null,
            country: null,
            birthdayinfo: null,
            datejoined: "2020-01-01T00:00:00.000Z",
            active: null,
            betaactive: null,
            currentsubscriber: null,
          },
          {
            memberid: "M2",
            fristname: "Sue",
            lastname: "Two",
            email: "shared@example.com",
            address: null,
            address2: null,
            city: null,
            state: null,
            postalcode: null,
            country: null,
            birthdayinfo: null,
            datejoined: "2019-01-01T00:00:00.000Z",
            active: null,
            betaactive: null,
            currentsubscriber: null,
          },
        ],
      },
      "shared@example.com",
    );

    expect(state.hasLegacyHistory).toBe(false);
    expect(state.legacyMemberid).toBeNull();
    expect(state.legacyLinkAmbiguous).toBe(true);
    expect(state.ambiguousLegacyMemberids).toEqual(["M1", "M2"]);
  });

  it("detects ambiguous legacy email matches without picking newest datejoined", async () => {
    const queryFn = vi.fn(async () => [
      {
        memberid: "M-newer",
        email: "shared@example.com",
        datejoined: "2020-01-01T00:00:00.000Z",
        fristname: null,
        lastname: null,
        address: null,
        address2: null,
        city: null,
        state: null,
        postalcode: null,
        country: null,
        birthdayinfo: null,
        active: null,
        betaactive: null,
        currentsubscriber: null,
      },
      {
        memberid: "M-older",
        email: "shared@example.com",
        datejoined: "2019-01-01T00:00:00.000Z",
        fristname: null,
        lastname: null,
        address: null,
        address2: null,
        city: null,
        state: null,
        postalcode: null,
        country: null,
        birthdayinfo: null,
        active: null,
        betaactive: null,
        currentsubscriber: null,
      },
    ]);

    const link = await resolveLegacyLinkByMemberstackEmail("shared@example.com", queryFn);
    const state = buildProfileLegacyLinkState(link, "shared@example.com");

    expect(queryFn).toHaveBeenCalledWith(MEMBER_BY_EMAIL_SQL, ["shared@example.com"]);
    expect(link.status).toBe("ambiguous");
    expect(state.hasLegacyHistory).toBe(false);
    expect(state.legacyMemberid).not.toBe("M-newer");
  });
});
