import fs from "fs";
import path from "path";

import { describe, expect, it, vi } from "vitest";

import {
  fillSupportResponse,
  getCustomerSupportResponseTemplates,
} from "./supportResponses";
import {
  buildCleanedLegacyHistoryView,
  cleanedLegacyHistoryAccordionCount,
  formatCleanedLegacyDateDisplay,
  hasVisibleCleanedLegacyHistory,
  LEGACY_CUSTOMER_NOTES_AUDIENCE,
  loadCleanedLegacyHistoryForProfile,
  membershipHistoryShowsProcessor,
  resolveCleanedLegacyHistoryMemberid,
  resolveCleanedLegacyLinkByEmail,
  WATSON_LEGACY_CUSTOMER_BY_MEMBERID_SQL,
  WATSON_LEGACY_CUSTOMERS_BY_EMAIL_SQL,
  WATSON_LEGACY_HISTORY_BY_MEMBERID_SQL,
  type WatsonCleanedLegacyHistoryRow,
} from "./legacyHistoryStore";

const MIXED_HISTORY_ROWS: WatsonCleanedLegacyHistoryRow[] = [
  {
    category: "Membership",
    transaction_date: "2019-03-01",
    description: "Annual membership",
    amount: 0,
    expiration_date: "2020-03-01",
    processor: "Authorize.Net",
  },
  {
    category: "Membership",
    transaction_date: "2020-03-01",
    description: "Renewal",
    amount: 1,
    expiration_date: "2021-03-01",
    processor: null,
  },
  {
    category: "Course Purchase",
    transaction_date: "2018-06-15",
    description: "Machine Knitting 101",
    amount: "49.00",
    expiration_date: null,
    processor: null,
  },
  {
    category: "LK150 Bundle",
    transaction_date: "2017-11-02",
    description: "LK150 Bundle",
    amount: "199.00",
    expiration_date: null,
    processor: null,
  },
];

describe("cleaned legacy history store", () => {
  it("reads only watson_legacy_customers and watson_legacy_history", () => {
    expect(WATSON_LEGACY_CUSTOMER_BY_MEMBERID_SQL).toContain("FROM watson_legacy_customers");
    expect(WATSON_LEGACY_CUSTOMERS_BY_EMAIL_SQL).toContain("FROM watson_legacy_customers");
    expect(WATSON_LEGACY_HISTORY_BY_MEMBERID_SQL).toContain("FROM watson_legacy_history");
    expect(WATSON_LEGACY_CUSTOMER_BY_MEMBERID_SQL).not.toContain("legacy_members");
    expect(WATSON_LEGACY_HISTORY_BY_MEMBERID_SQL).not.toContain("legacy_subscriptions");
    expect(WATSON_LEGACY_HISTORY_BY_MEMBERID_SQL).not.toMatch(/SourceRecordID|ItemID|TransactionID|identity_key/);
  });

  it("keeps internal identifiers out of the display SQL", () => {
    expect(WATSON_LEGACY_HISTORY_BY_MEMBERID_SQL).not.toContain("identity_key");
    expect(WATSON_LEGACY_HISTORY_BY_MEMBERID_SQL).not.toContain("source_record_id");
    expect(WATSON_LEGACY_HISTORY_BY_MEMBERID_SQL).not.toContain("item_id");
    expect(WATSON_LEGACY_HISTORY_BY_MEMBERID_SQL).not.toContain("transaction_id");
    expect(WATSON_LEGACY_HISTORY_BY_MEMBERID_SQL).not.toContain("SourceRecordID");
    expect(WATSON_LEGACY_HISTORY_BY_MEMBERID_SQL).not.toMatch(/\bid\b/);
  });

  it("groups memberships, courses, and LK150 bundle for a mixed customer", () => {
    const view = buildCleanedLegacyHistoryView({
      legacyMemberid: "M-mixed",
      customerNotes: "",
      rows: MIXED_HISTORY_ROWS,
    });

    expect(view.memberships).toHaveLength(2);
    expect(view.coursePurchases).toHaveLength(1);
    expect(view.coursePurchases[0]?.description).toBe("Machine Knitting 101");
    expect(view.lk150Bundles).toHaveLength(1);
    expect(view.patternPurchases).toHaveLength(0);
    expect(view.memberships[0]?.amount).toBe("$0.00");
    expect(view.memberships[1]?.amount).toBe("$1.00");
    expect(membershipHistoryShowsProcessor(view.memberships)).toBe(true);
    expect(hasVisibleCleanedLegacyHistory(view)).toBe(true);
  });

  it("shows memberships only when that is the only category", () => {
    const view = buildCleanedLegacyHistoryView({
      legacyMemberid: "M-memberships",
      rows: [
        {
          category: "Membership",
          transaction_date: "2021-04-10",
          description: "Monthly",
          amount: "19.99",
          expiration_date: "2021-05-10",
          processor: "PayPal",
        },
      ],
    });

    expect(view.memberships).toHaveLength(1);
    expect(view.coursePurchases).toHaveLength(0);
    expect(view.patternPurchases).toHaveLength(0);
    expect(view.lk150Bundles).toHaveLength(0);
    expect(view.customerNotes).toBeNull();
    expect(cleanedLegacyHistoryAccordionCount(view)).toBe(1);
  });

  it("shows a verified pattern purchase without inventing other sections", () => {
    const view = buildCleanedLegacyHistoryView({
      legacyMemberid: "M-pattern",
      rows: [
        {
          category: "Pattern Purchase",
          transaction_date: "2016-08-20",
          description: "Cabled Pullover PDF",
          amount: "8.00",
          expiration_date: null,
          processor: null,
        },
      ],
    });

    expect(view.patternPurchases).toHaveLength(1);
    expect(view.patternPurchases[0]?.description).toBe("Cabled Pullover PDF");
    expect(view.patternPurchases[0]?.amount).toBe("$8.00");
    expect(view.memberships).toHaveLength(0);
    expect(view.coursePurchases).toHaveLength(0);
    expect(view.lk150Bundles).toHaveLength(0);
  });

  it("keeps legacy customer notes as admin-only when present", () => {
    const view = buildCleanedLegacyHistoryView({
      legacyMemberid: "M-notes",
      customerNotes: "  Called about expired card.  ",
      rows: [],
    });

    expect(view.customerNotes).toEqual({
      audience: LEGACY_CUSTOMER_NOTES_AUDIENCE,
      text: "Called about expired card.",
    });
    expect(hasVisibleCleanedLegacyHistory(view)).toBe(true);
    expect(cleanedLegacyHistoryAccordionCount(view)).toBe(1);
  });

  it("does not treat empty notes and empty history as visible", () => {
    const view = buildCleanedLegacyHistoryView({
      legacyMemberid: "M-empty",
      customerNotes: "   ",
      rows: [],
    });

    expect(view.customerNotes).toBeNull();
    expect(hasVisibleCleanedLegacyHistory(view)).toBe(false);
    expect(hasVisibleCleanedLegacyHistory(null)).toBe(false);
  });

  it("formats date-only values without timezone drift", () => {
    expect(formatCleanedLegacyDateDisplay("2019-03-01")).toBe("Mar 1, 2019");
    expect(formatCleanedLegacyDateDisplay(new Date("2019-03-01T00:00:00.000Z"))).toBe(
      "Mar 1, 2019",
    );
  });

  it("uses LegacyMemberID for legacy profiles even when the email is shared", () => {
    const memberid = resolveCleanedLegacyHistoryMemberid({
      profileType: "legacy",
      routeLegacyMemberid: "M-shared-1",
      dumpLinkAmbiguous: true,
      dumpLegacyMemberid: null,
      cleanedEmailLink: {
        status: "ambiguous",
        legacyMemberids: ["M-shared-1", "M-shared-2"],
      },
    });

    expect(memberid).toBe("M-shared-1");
  });

  it("never uses name to auto-link customers", () => {
    const source = fs.readFileSync(path.resolve("src/lib/watson/legacyHistoryStore.ts"), "utf8");
    expect(source).not.toMatch(/first_name|last_name|fristname|lastname/);
    expect(WATSON_LEGACY_CUSTOMERS_BY_EMAIL_SQL).toContain("LOWER(TRIM(email))");
  });

  it("attaches cleaned history for a unique Memberstack email match", async () => {
    const queryFn = vi.fn(async (sql: string) => {
      if (sql === WATSON_LEGACY_CUSTOMERS_BY_EMAIL_SQL) {
        return [{ legacy_memberid: "M1", email: "sue@example.com", customer_notes: "" }];
      }
      if (sql === WATSON_LEGACY_CUSTOMER_BY_MEMBERID_SQL) {
        return [{ legacy_memberid: "M1", email: "sue@example.com", customer_notes: "" }];
      }
      if (sql === WATSON_LEGACY_HISTORY_BY_MEMBERID_SQL) {
        return [
          {
            category: "Membership",
            transaction_date: "2020-01-01",
            description: "Annual",
            amount: "99.00",
            expiration_date: "2021-01-01",
            processor: null,
          },
        ];
      }
      return [];
    });

    const view = await loadCleanedLegacyHistoryForProfile({
      profileType: "memberstack",
      memberstackEmail: "Sue@Example.com",
      dumpLinkAmbiguous: false,
      dumpLegacyMemberid: "M1",
      queryFn,
    });

    expect(queryFn).toHaveBeenCalledWith(WATSON_LEGACY_CUSTOMERS_BY_EMAIL_SQL, [
      "sue@example.com",
    ]);
    expect(view?.legacyMemberid).toBe("M1");
    expect(view?.memberships).toHaveLength(1);
  });

  it("associates a unique cleaned email with a Memberstack profile even without a dump match", async () => {
    const queryFn = vi.fn(async (sql: string) => {
      if (sql === WATSON_LEGACY_CUSTOMERS_BY_EMAIL_SQL) {
        return [{ legacy_memberid: "M-cleaned", email: "unique@example.com", customer_notes: "" }];
      }
      if (sql === WATSON_LEGACY_CUSTOMER_BY_MEMBERID_SQL) {
        return [{ legacy_memberid: "M-cleaned", email: "unique@example.com", customer_notes: "" }];
      }
      if (sql === WATSON_LEGACY_HISTORY_BY_MEMBERID_SQL) {
        return [
          {
            category: "Pattern Purchase",
            transaction_date: "2016-08-20",
            description: "Cabled Pullover PDF",
            amount: "8.00",
            expiration_date: null,
            processor: null,
          },
        ];
      }
      return [];
    });

    const view = await loadCleanedLegacyHistoryForProfile({
      profileType: "memberstack",
      memberstackEmail: "unique@example.com",
      dumpLinkAmbiguous: false,
      dumpLegacyMemberid: null,
      queryFn,
    });

    expect(view?.legacyMemberid).toBe("M-cleaned");
    expect(view?.patternPurchases).toHaveLength(1);
  });

  it("does not attach cleaned history when the Memberstack email is ambiguous", async () => {
    const queryFn = vi.fn(async (sql: string) => {
      if (sql === WATSON_LEGACY_CUSTOMERS_BY_EMAIL_SQL) {
        return [
          { legacy_memberid: "M1", email: "shared@example.com", customer_notes: "Do not show" },
          { legacy_memberid: "M2", email: "shared@example.com", customer_notes: "Other notes" },
        ];
      }
      throw new Error(`Unexpected SQL: ${sql}`);
    });

    const link = await resolveCleanedLegacyLinkByEmail("shared@example.com", queryFn);
    expect(link.status).toBe("ambiguous");

    const view = await loadCleanedLegacyHistoryForProfile({
      profileType: "memberstack",
      memberstackEmail: "shared@example.com",
      dumpLinkAmbiguous: false,
      dumpLegacyMemberid: "M1",
      queryFn,
    });

    expect(view).toBeNull();
    expect(queryFn).not.toHaveBeenCalledWith(
      WATSON_LEGACY_HISTORY_BY_MEMBERID_SQL,
      expect.anything(),
    );
  });

  it("preserves dump-table ambiguity and does not guess a cleaned history row", async () => {
    const queryFn = vi.fn(async () => {
      throw new Error("Should not query cleaned tables when dump email is ambiguous");
    });

    const memberid = resolveCleanedLegacyHistoryMemberid({
      profileType: "memberstack",
      dumpLinkAmbiguous: true,
      dumpLegacyMemberid: null,
      cleanedEmailLink: { status: "unique", legacyMemberid: "M-unique-cleaned" },
    });
    expect(memberid).toBeNull();

    const view = await loadCleanedLegacyHistoryForProfile({
      profileType: "memberstack",
      memberstackEmail: "shared@example.com",
      dumpLinkAmbiguous: true,
      dumpLegacyMemberid: null,
      queryFn,
    });

    expect(view).toBeNull();
    expect(queryFn).not.toHaveBeenCalled();
  });

  it("returns null for a customer with no cleaned legacy history", async () => {
    const queryFn = vi.fn(async () => []);

    const view = await loadCleanedLegacyHistoryForProfile({
      profileType: "legacy",
      routeLegacyMemberid: "M-none",
      dumpLinkAmbiguous: false,
      dumpLegacyMemberid: "M-none",
      queryFn,
    });

    expect(view).toBeNull();
  });
});

describe("cleaned legacy customer notes stay off customer-facing surfaces", () => {
  const customerFacingFiles = [
    "src/lib/watson/supportResponses.ts",
    "src/components/watson/WatsonCustomerSupportResponses.astro",
    "src/lib/membership/membershipHistory.ts",
    "src/lib/membership/accountMembershipDetail.ts",
    "src/lib/membership/membershipStatusSummary.ts",
    "src/lib/membership/membershipStatusService.ts",
    "netlify/functions/membership-status.ts",
  ];

  it("does not import cleaned notes into support-response or public membership output", () => {
    for (const relative of customerFacingFiles) {
      const source = fs.readFileSync(path.resolve(relative), "utf8");
      expect(source).not.toContain("customer_notes");
      expect(source).not.toContain("legacyHistoryStore");
      expect(source).not.toContain("WatsonCustomerLegacyHistory");
      expect(source).not.toContain("LEGACY_CUSTOMER_NOTES_AUDIENCE");
    }
  });

  it("does not copy legacy customer notes into support-response templates", () => {
    const templates = getCustomerSupportResponseTemplates();
    const filled = templates.map((template) =>
      fillSupportResponse(template.body, { firstName: "Sue" }),
    );

    for (const body of filled) {
      expect(body).not.toContain("customer_notes");
      expect(body).not.toContain("Called about expired card");
      expect(body).not.toContain("Legacy Customer Notes");
      expect(body).not.toContain("admin notes");
    }
  });
});
