import { afterEach, describe, expect, it, vi } from "vitest";

import { MEMBERSHIPS } from "../../config/memberships";
import type { MemberstackMember } from "../membership/membershipSummary";
import type {
  ActiveCampaignClient,
  ActiveCampaignListStatus,
} from "../activecampaign/client";
import { LEGACY_ANNUAL_PLAN_ID } from "./legacyAnnualExpiry";
import {
  runLegacyRenewalReminders,
  REMINDER_WINDOW_MEMBERS_SQL,
  type ReminderCandidateRow,
  type ReminderTotals,
} from "./legacyRenewalReminders";
import {
  buildReminderPreviewCards,
  buildReminderPreviewRows,
  loadLegacyRenewalReminderPreview,
} from "./legacyRenewalReminderPreview";
import type { WatsonQueryFn } from "./memberSearch";

/** Fixed instant -> America/Los_Angeles calendar day 2026-07-28 (12:00 PDT). */
const NOW = new Date("2026-07-28T19:00:00Z");
const LIST_ID = "5";
const FIELD_ID = "42";

const legacyOnlyMember: MemberstackMember = {
  id: "mem_legacy",
  auth: { email: "a@x.com" },
  planConnections: [{ planId: LEGACY_ANNUAL_PLAN_ID, active: true }],
};
const paidMember: MemberstackMember = {
  id: "mem_paid",
  auth: { email: "paid@x.com" },
  planConnections: [{ planId: MEMBERSHIPS.membership.memberstackPlanId, active: true }],
};

interface FakeContact {
  id: string;
  listStatus: ActiveCampaignListStatus;
  tags: Set<string>;
}

function makeAc(seed: Record<string, FakeContact> = {}): ActiveCampaignClient {
  const contacts = new Map<string, FakeContact>(Object.entries(seed));
  const findById = (id: string) => [...contacts.values()].find((c) => c.id === id);
  return {
    async listExists() {
      return true;
    },
    async findContactByEmail(email) {
      const c = contacts.get(email);
      return c ? { id: c.id } : null;
    },
    async syncContact(input) {
      return { id: contacts.get(input.email)?.id ?? "ac_new" };
    },
    async getListStatus(contactId) {
      return findById(contactId)?.listStatus ?? "not_on_list";
    },
    async subscribeToList() {},
    async resolveTagId(tagName) {
      return `tag_${tagName}`;
    },
    async contactHasTag(contactId, tagId) {
      return findById(contactId)?.tags.has(tagId) ?? false;
    },
    async addTag() {},
  };
}

function makeQueryFn(
  rowsByWindow: Partial<Record<number, ReminderCandidateRow[]>>,
): WatsonQueryFn {
  return (async (_sql: string, params?: unknown[]) => {
    const windowDays = Number(params?.[1]);
    return rowsByWindow[windowDays] ?? [];
  }) as unknown as WatsonQueryFn;
}

function row(overrides: Partial<ReminderCandidateRow> & Pick<ReminderCandidateRow, "memberid">) {
  return {
    memberid: overrides.memberid,
    fristname: "fristname" in overrides ? (overrides.fristname ?? null) : "Ada",
    lastname: "lastname" in overrides ? (overrides.lastname ?? null) : "Lovelace",
    email: "email" in overrides ? (overrides.email ?? null) : "a@x.com",
    subscriptionexpiring: overrides.subscriptionexpiring ?? "2026-08-27",
  } satisfies ReminderCandidateRow;
}

/** Fakes shared by both the "scheduled" run and the preview loader. */
function sharedFakes() {
  return {
    now: NOW,
    listId: LIST_ID,
    paidThroughFieldId: FIELD_ID,
    skipListValidation: true,
    hasTaggedRecord: async () => false,
    recordAttempt: async () => {},
    activeCampaign: makeAc({
      "a@x.com": { id: "ac_1", listStatus: "active", tags: new Set() },
    }),
    queryFn: makeQueryFn({
      30: [row({ memberid: "m30", email: "a@x.com" })],
      7: [
        row({
          memberid: "m7",
          email: "paid@x.com",
          subscriptionexpiring: "2026-08-04",
          fristname: "Grace",
          lastname: "Hopper",
        }),
      ],
      1: [
        row({
          memberid: "m1",
          email: null,
          subscriptionexpiring: "2026-07-29",
          fristname: "No",
          lastname: "Email",
        }),
      ],
    }),
    resolveMemberstackMemberByEmail: async (email: string) =>
      email === "a@x.com"
        ? { status: "unique" as const, member: legacyOnlyMember }
        : email === "paid@x.com"
          ? { status: "unique" as const, member: paidMember }
          : { status: "not_found" as const },
  };
}

describe("loadLegacyRenewalReminderPreview - safety", () => {
  it("always forces dryRun:true and a manual trigger source", async () => {
    const run = vi.fn(async () => ({
      ok: true,
      dryRun: true,
      triggerSource: "manual" as const,
      todayLosAngeles: "2026-07-28",
      listId: LIST_ID,
      paidThroughFieldId: FIELD_ID,
      windows: [],
      totals: emptyTotals(),
      details: [],
      errorMessage: null,
      completedAt: "2026-07-28T19:00:00.000Z",
    }));

    await loadLegacyRenewalReminderPreview({
      run,
      // A caller trying to force a live run must be ignored.
      overrides: { dryRun: false } as never,
    });

    expect(run).toHaveBeenCalledTimes(1);
    const passed = run.mock.calls[0]![0];
    expect(passed.dryRun).toBe(true);
    expect(passed.triggerSource).toBe("manual");
  });
});

describe("loadLegacyRenewalReminderPreview - environment resolution", () => {
  const ENV_KEYS = [
    "ACTIVECAMPAIGN_KIN_LIST_ID",
    "ACTIVECAMPAIGN_PAID_THROUGH_FIELD_ID",
  ] as const;
  const savedEnv: Record<string, string | undefined> = {};

  afterEach(() => {
    for (const key of ENV_KEYS) {
      if (savedEnv[key] === undefined) delete process.env[key];
      else process.env[key] = savedEnv[key];
    }
  });

  function stashEnv() {
    for (const key of ENV_KEYS) savedEnv[key] = process.env[key];
  }

  it("passes ACTIVECAMPAIGN_KIN_LIST_ID from process.env into the shared runner", async () => {
    stashEnv();
    process.env.ACTIVECAMPAIGN_KIN_LIST_ID = "2";
    process.env.ACTIVECAMPAIGN_PAID_THROUGH_FIELD_ID = "42";

    const run = vi.fn(async () => passThroughResult());
    await loadLegacyRenewalReminderPreview({ run });

    expect(run).toHaveBeenCalledTimes(1);
    const passed = run.mock.calls[0]![0];
    expect(passed.dryRun).toBe(true);
    // The env object handed to the runner carries the process.env value.
    expect(passed.env?.ACTIVECAMPAIGN_KIN_LIST_ID).toBe("2");
    expect(passed.env?.ACTIVECAMPAIGN_PAID_THROUGH_FIELD_ID).toBe("42");
  });

  it("resolves the list id from process.env end-to-end (no explicit listId option)", async () => {
    stashEnv();
    process.env.ACTIVECAMPAIGN_KIN_LIST_ID = "2";
    process.env.ACTIVECAMPAIGN_PAID_THROUGH_FIELD_ID = "42";

    // Real shared runner (default), but with fakes so no network/DB is touched.
    const preview = await loadLegacyRenewalReminderPreview({
      overrides: {
        now: NOW,
        skipListValidation: true,
        activeCampaign: makeAc(),
        queryFn: makeQueryFn({}),
        resolveMemberstackMemberByEmail: async () => ({ status: "not_found" as const }),
      },
    });

    expect(preview.ok).toBe(true);
    expect(preview.errorMessage).toBeNull();
    // The old failure mode was this exact message; it must not appear now.
    expect(preview.errorMessage ?? "").not.toContain("ACTIVECAMPAIGN_KIN_LIST_ID");
  });
});

describe("loadLegacyRenewalReminderPreview - single source of truth", () => {
  it("produces the identical candidate list as the shared reminder job (default runner)", async () => {
    // Simulate the scheduled job's dry run using the shared entry point directly.
    const scheduled = await runLegacyRenewalReminders({ ...sharedFakes(), dryRun: true });

    // The preview loader (no injected run -> uses runLegacyRenewalReminders) with
    // the same fakes must yield the same candidates and outcomes.
    const preview = await loadLegacyRenewalReminderPreview({ overrides: sharedFakes() });

    expect(preview.rows).toHaveLength(scheduled.details.length);

    const scheduledByMember = scheduled.details
      .map((d) => ({ email: d.email ?? "", status: d.outcome }))
      .sort((a, b) => a.email.localeCompare(b.email));
    const previewByMember = preview.rows
      .map((r) => ({ email: r.email, status: r.status }))
      .sort((a, b) => a.email.localeCompare(b.email));

    // Same emails evaluated, same count of eligible vs skipped.
    expect(previewByMember.map((r) => r.email)).toEqual(
      scheduledByMember.map((r) => r.email),
    );
    expect(preview.totals).toEqual(scheduled.totals);
  });

  it("maps summary cards straight from the shared totals object", async () => {
    const preview = await loadLegacyRenewalReminderPreview({ overrides: sharedFakes() });
    const byId = Object.fromEntries(preview.cards.map((c) => [c.id, c.value]));
    expect(byId.candidatesFound).toBe(preview.totals.candidatesFound);
    expect(byId.eligible).toBe(preview.totals.wouldTag + preview.totals.tagged);
    expect(byId.skippedActivePaid).toBe(preview.totals.skippedActivePaid);
    expect(byId.skippedMissingEmail).toBe(preview.totals.skippedMissingEmail);
  });

  it("sorts rows by legacy expiration date ascending", async () => {
    const preview = await loadLegacyRenewalReminderPreview({ overrides: sharedFakes() });
    const dates = preview.rows.map((r) => r.legacyExpiration);
    expect(dates).toEqual([...dates].sort((a, b) => a.localeCompare(b)));
  });

  it("labels statuses using the shared outcomes (Eligible / Active Paid / Missing Email)", async () => {
    const preview = await loadLegacyRenewalReminderPreview({ overrides: sharedFakes() });
    const byEmail = Object.fromEntries(preview.rows.map((r) => [r.email, r]));
    expect(byEmail["a@x.com"].status).toBe("Eligible");
    expect(byEmail["paid@x.com"].status).toBe("Active Paid");
    expect(byEmail[""].status).toBe("Missing Email");
  });
});

describe("preview view helpers", () => {
  it("builds all eleven summary cards in the requested order", () => {
    const cards = buildReminderPreviewCards(emptyTotals());
    expect(cards.map((c) => c.label)).toEqual([
      "Candidates Found",
      "Eligible",
      "Skipped - Active Paid",
      "Skipped - Already Tagged",
      "Skipped - Missing Email",
      "Skipped - Ambiguous",
      "Skipped - Staff/Test",
      "Skipped - Unsubscribed",
      "Skipped - Bounced",
      "Skipped - Unconfirmed",
      "Failures",
    ]);
  });

  it("carries the reason string produced by the shared logic", () => {
    const rows = buildReminderPreviewRows([
      {
        windowDays: 30,
        tag: "legacy-renewal-30-day",
        legacyMemberId: "m1",
        fristname: "Ada",
        lastname: "Lovelace",
        email: "a@x.com",
        paidThrough: "2026-08-27",
        memberstackId: null,
        memberstackResolution: null,
        acContactId: null,
        listStatus: null,
        created: false,
        subscribed: false,
        outcome: "would_tag",
        reason: "would_update_field_and_tag",
      },
    ]);
    expect(rows[0].reason).toBe("would_update_field_and_tag");
    expect(rows[0].daysUntilExpiration).toBe(30);
    expect(rows[0].statusModifier).toBe("eligible");
  });
});

describe("shared reminder SQL", () => {
  it("selects the last name so the preview can display it", () => {
    expect(REMINDER_WINDOW_MEMBERS_SQL).toContain("m.lastname");
  });
});

function passThroughResult() {
  return {
    ok: true,
    dryRun: true,
    triggerSource: "manual" as const,
    todayLosAngeles: "2026-07-28",
    listId: LIST_ID,
    paidThroughFieldId: FIELD_ID,
    windows: [],
    totals: emptyTotals(),
    details: [],
    errorMessage: null,
    completedAt: "2026-07-28T19:00:00.000Z",
  };
}

function emptyTotals(): ReminderTotals {
  return {
    candidatesFound: 0,
    tagged: 0,
    wouldTag: 0,
    skippedActivePaid: 0,
    skippedAmbiguous: 0,
    skippedMissingEmail: 0,
    skippedStaffOrTest: 0,
    skippedAlreadyTagged: 0,
    skippedUnsubscribed: 0,
    skippedBounced: 0,
    skippedUnconfirmed: 0,
    createdContacts: 0,
    failures: 0,
  };
}
