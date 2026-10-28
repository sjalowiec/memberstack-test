import { describe, expect, it, vi } from "vitest";

import { COMPLIMENTARY_MEMBERSHIPS, MEMBERSHIPS } from "../../config/memberships";
import type { MemberstackMember } from "../membership/membershipSummary";
import type {
  ActiveCampaignClient,
  ActiveCampaignListStatus,
} from "../activecampaign/client";
import { LEGACY_ANNUAL_PLAN_ID } from "./legacyAnnualExpiry";
import type { WatsonQueryFn } from "./memberSearch";
import { readFileSync } from "node:fs";

import {
  addDaysYmd,
  dailyCronIsAfterPacificMidnight,
  EXPIRED_REMINDER_TAG,
  getLegacyReminderActiveCampaignSettings,
  LEGACY_RENEWAL_REMINDER_CRON,
  REMINDER_TAG_BY_WINDOW,
  REMINDER_WINDOW_DAYS,
  REMINDER_WINDOW_MEMBERS_SQL,
  runLegacyRenewalReminders,
  type ReminderAuditRow,
  type ReminderCandidateRow,
} from "./legacyRenewalReminders";

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
  auth: { email: "a@x.com" },
  planConnections: [
    { planId: MEMBERSHIPS.membership.memberstackPlanId, active: true },
  ],
};
const trialingPaidMember: MemberstackMember = {
  id: "mem_trial",
  auth: { email: "a@x.com" },
  planConnections: [
    { planId: MEMBERSHIPS.membership.memberstackPlanId, status: "TRIALING", active: true },
  ],
};
const openComplimentaryMember: MemberstackMember = {
  id: "mem_comp",
  auth: { email: "a@x.com" },
  planConnections: [
    { planId: LEGACY_ANNUAL_PLAN_ID, active: true },
    {
      planId: COMPLIMENTARY_MEMBERSHIPS.complimentaryMembership.memberstackPlanId,
      status: "ACTIVE",
      active: true,
    },
  ],
};

interface FakeContact {
  id: string;
  listStatus: ActiveCampaignListStatus;
  tags: Set<string>;
}

function makeAc(seed: Record<string, FakeContact> = {}) {
  const contacts = new Map<string, FakeContact>(Object.entries(seed));
  let nextId = 900;
  const spies = {
    syncContact: vi.fn(),
    subscribeToList: vi.fn(),
    addTag: vi.fn(),
  };
  const findById = (id: string): FakeContact | undefined =>
    [...contacts.values()].find((c) => c.id === id);

  const client: ActiveCampaignClient = {
    async listExists() {
      return true;
    },
    async findContactByEmail(email) {
      const c = contacts.get(email);
      return c ? { id: c.id } : null;
    },
    async syncContact(input) {
      spies.syncContact(input);
      let c = contacts.get(input.email);
      if (!c) {
        c = { id: `ac_${nextId++}`, listStatus: "not_on_list", tags: new Set() };
        contacts.set(input.email, c);
      }
      return { id: c.id };
    },
    async getListStatus(contactId) {
      return findById(contactId)?.listStatus ?? "not_on_list";
    },
    async subscribeToList(contactId) {
      spies.subscribeToList(contactId);
      const c = findById(contactId);
      if (c) c.listStatus = "active";
    },
    async resolveTagId(tagName) {
      return `tag_${tagName}`;
    },
    async contactHasTag(contactId, tagId) {
      return findById(contactId)?.tags.has(tagId) ?? false;
    },
    async addTag(contactId, tagId) {
      spies.addTag(contactId, tagId);
      findById(contactId)?.tags.add(tagId);
    },
  };
  return { client, spies, contacts };
}

/** Fake Watson query keyed on the window-days param ($2). */
function makeQueryFn(
  rowsByWindow: Partial<Record<number, ReminderCandidateRow[]>>,
): WatsonQueryFn {
  return (async (_sql: string, params?: unknown[]) => {
    const windowDays = Number(params?.[1]);
    return rowsByWindow[windowDays] ?? [];
  }) as unknown as WatsonQueryFn;
}

function resolverFor(
  map: Record<
    string,
    { status: "unique"; member: MemberstackMember } | { status: "not_found" } | { status: "ambiguous" }
  >,
) {
  return async (email: string) => map[email] ?? { status: "not_found" as const };
}

function row(
  overrides: Partial<ReminderCandidateRow> & Pick<ReminderCandidateRow, "memberid">,
): ReminderCandidateRow {
  return {
    memberid: overrides.memberid,
    fristname: "fristname" in overrides ? (overrides.fristname ?? null) : "Ada",
    lastname: "lastname" in overrides ? (overrides.lastname ?? null) : "Lovelace",
    email: "email" in overrides ? (overrides.email ?? null) : "a@x.com",
    subscriptionexpiring: overrides.subscriptionexpiring ?? "2026-08-27",
  };
}

const baseOpts = (extra: Record<string, unknown>) => ({
  now: NOW,
  listId: LIST_ID,
  paidThroughFieldId: FIELD_ID,
  skipListValidation: true,
  hasTaggedRecord: async () => false,
  recordAttempt: async () => {},
  ...extra,
});

describe("addDaysYmd", () => {
  it("steps back one calendar day for the day-after tag", () => {
    expect(addDaysYmd("2027-12-31", -1)).toBe("2027-12-30");
    expect(addDaysYmd("2026-07-28", -1)).toBe("2026-07-27");
    expect(addDaysYmd("2026-03-01", -1)).toBe("2026-02-28");
  });
});

describe("runLegacyRenewalReminders - dry-run safety", () => {
  it("previews would_tag for an existing on-list contact without any writes", async () => {
    const ac = makeAc({
      "a@x.com": { id: "ac_1", listStatus: "active", tags: new Set() },
    });
    const recordAttempt = vi.fn(async () => {});
    const result = await runLegacyRenewalReminders(
      baseOpts({
        dryRun: true,
        activeCampaign: ac.client,
        queryFn: makeQueryFn({ 1: [row({ memberid: "m1" })] }),
        resolveMemberstackMemberByEmail: resolverFor({
          "a@x.com": { status: "unique", member: legacyOnlyMember },
        }),
        recordAttempt,
      }),
    );

    expect(result.dryRun).toBe(true);
    expect(result.totals.wouldTag).toBe(1);
    expect(result.totals.tagged).toBe(0);
    expect(ac.spies.syncContact).not.toHaveBeenCalled();
    expect(ac.spies.subscribeToList).not.toHaveBeenCalled();
    expect(ac.spies.addTag).not.toHaveBeenCalled();
    // Dry-run never persists audit rows.
    expect(recordAttempt).not.toHaveBeenCalled();
    expect(result.details[0]?.paidThrough).toBe("2026-07-27");
    expect(result.details[0]?.tag).toBe("legacy-renewal-expired");
  });

  it("does not preview a tag for a contact who is not on the list", async () => {
    const ac = makeAc();
    const result = await runLegacyRenewalReminders(
      baseOpts({
        dryRun: true,
        activeCampaign: ac.client,
        queryFn: makeQueryFn({ 1: [row({ memberid: "m1", subscriptionexpiring: "2026-08-04" })] }),
        resolveMemberstackMemberByEmail: resolverFor({ "a@x.com": { status: "not_found" } }),
      }),
    );

    expect(result.totals.wouldTag).toBe(0);
    expect(result.totals.skippedNotSubscribed).toBe(1);
    expect(result.details[0]?.created).toBe(false);
    expect(ac.spies.syncContact).not.toHaveBeenCalled();
    expect(ac.spies.subscribeToList).not.toHaveBeenCalled();
  });

  it("defaults to dry-run when dryRun is not specified", async () => {
    const ac = makeAc({ "a@x.com": { id: "ac_1", listStatus: "active", tags: new Set() } });
    const result = await runLegacyRenewalReminders(
      baseOpts({
        activeCampaign: ac.client,
        queryFn: makeQueryFn({ 1: [row({ memberid: "m1", subscriptionexpiring: "2026-07-29" })] }),
        resolveMemberstackMemberByEmail: resolverFor({
          "a@x.com": { status: "unique", member: legacyOnlyMember },
        }),
      }),
    );
    expect(result.dryRun).toBe(true);
    expect(ac.spies.addTag).not.toHaveBeenCalled();
  });
});

describe("runLegacyRenewalReminders - live tagging", () => {
  it("updates the date field and tags an active subscriber without subscribing", async () => {
    const ac = makeAc({
      "a@x.com": { id: "ac_1", listStatus: "active", tags: new Set() },
    });
    const recorded: ReminderAuditRow[] = [];
    const result = await runLegacyRenewalReminders(
      baseOpts({
        dryRun: false,
        activeCampaign: ac.client,
        queryFn: makeQueryFn({ 1: [row({ memberid: "m1" })] }),
        resolveMemberstackMemberByEmail: resolverFor({
          "a@x.com": { status: "unique", member: legacyOnlyMember },
        }),
        recordAttempt: async (r: ReminderAuditRow) => {
          recorded.push(r);
        },
      }),
    );

    expect(result.totals.tagged).toBe(1);
    expect(ac.spies.syncContact).toHaveBeenCalledWith({
      email: "a@x.com",
      firstName: "Ada",
      fieldValues: [{ field: FIELD_ID, value: "2026-07-27" }],
    });
    expect(ac.spies.subscribeToList).not.toHaveBeenCalled();
    expect(ac.spies.addTag).toHaveBeenCalledWith("ac_1", "tag_legacy-renewal-expired");
    expect(recorded).toHaveLength(1);
    expect(recorded[0]?.outcome).toBe("tagged");
  });

  it("does not create or subscribe a brand-new contact", async () => {
    const ac = makeAc();
    const result = await runLegacyRenewalReminders(
      baseOpts({
        dryRun: false,
        activeCampaign: ac.client,
        queryFn: makeQueryFn({ 1: [row({ memberid: "m1", subscriptionexpiring: "2026-07-29" })] }),
        resolveMemberstackMemberByEmail: resolverFor({ "a@x.com": { status: "not_found" } }),
      }),
    );
    expect(result.totals.tagged).toBe(0);
    expect(result.totals.skippedNotSubscribed).toBe(1);
    expect(result.totals.createdContacts).toBe(0);
    expect(ac.spies.syncContact).not.toHaveBeenCalled();
    expect(ac.spies.subscribeToList).not.toHaveBeenCalled();
    expect(ac.spies.addTag).not.toHaveBeenCalled();
  });

  it("does not subscribe a contact who is not on the list", async () => {
    const ac = makeAc({
      "a@x.com": { id: "ac_1", listStatus: "not_on_list", tags: new Set() },
    });
    const result = await runLegacyRenewalReminders(
      baseOpts({
        dryRun: false,
        activeCampaign: ac.client,
        queryFn: makeQueryFn({ 1: [row({ memberid: "m1" })] }),
        resolveMemberstackMemberByEmail: resolverFor({
          "a@x.com": { status: "unique", member: legacyOnlyMember },
        }),
      }),
    );
    expect(result.totals.skippedNotSubscribed).toBe(1);
    expect(ac.spies.subscribeToList).not.toHaveBeenCalled();
    expect(ac.spies.addTag).not.toHaveBeenCalled();
  });
});

describe("runLegacyRenewalReminders - skips and protections", () => {
  it("skips a member with another active paid plan (no AC contact touched)", async () => {
    const ac = makeAc({ "a@x.com": { id: "ac_1", listStatus: "active", tags: new Set() } });
    const result = await runLegacyRenewalReminders(
      baseOpts({
        dryRun: false,
        activeCampaign: ac.client,
        queryFn: makeQueryFn({ 1: [row({ memberid: "m1" })] }),
        resolveMemberstackMemberByEmail: resolverFor({
          "a@x.com": { status: "unique", member: paidMember },
        }),
      }),
    );
    expect(result.totals.skippedActivePaid).toBe(1);
    expect(ac.spies.addTag).not.toHaveBeenCalled();
  });

  it("skips a trialing paid membership", async () => {
    const ac = makeAc({ "a@x.com": { id: "ac_1", listStatus: "active", tags: new Set() } });
    const result = await runLegacyRenewalReminders(
      baseOpts({
        dryRun: false,
        activeCampaign: ac.client,
        queryFn: makeQueryFn({ 1: [row({ memberid: "m1" })] }),
        resolveMemberstackMemberByEmail: resolverFor({
          "a@x.com": { status: "unique", member: trialingPaidMember },
        }),
      }),
    );
    expect(result.totals.skippedActivePaid).toBe(1);
    expect(ac.spies.addTag).not.toHaveBeenCalled();
  });

  it("skips open-ended complimentary access and complimentary dates past the legacy date", async () => {
    const ac = makeAc({ "a@x.com": { id: "ac_1", listStatus: "active", tags: new Set() } });
    const open = await runLegacyRenewalReminders(
      baseOpts({
        dryRun: true,
        activeCampaign: ac.client,
        queryFn: makeQueryFn({ 1: [row({ memberid: "m1" })] }),
        resolveMemberstackMemberByEmail: resolverFor({
          "a@x.com": { status: "unique", member: openComplimentaryMember },
        }),
        loadComplimentaryAccessYmdByMemberstackId: async () => new Map(),
      }),
    );
    expect(open.totals.skippedComplimentary).toBe(1);
    expect(open.totals.wouldTag).toBe(0);

    const later = await runLegacyRenewalReminders(
      baseOpts({
        dryRun: true,
        activeCampaign: ac.client,
        queryFn: makeQueryFn({ 1: [row({ memberid: "m1" })] }),
        resolveMemberstackMemberByEmail: resolverFor({
          "a@x.com": { status: "unique", member: openComplimentaryMember },
        }),
        loadComplimentaryAccessYmdByMemberstackId: async () => new Map([["mem_comp", "2026-12-01"]]),
      }),
    );
    expect(later.totals.skippedComplimentary).toBe(1);

    const endingFirst = await runLegacyRenewalReminders(
      baseOpts({
        dryRun: true,
        activeCampaign: ac.client,
        queryFn: makeQueryFn({ 1: [row({ memberid: "m1" })] }),
        resolveMemberstackMemberByEmail: resolverFor({
          "a@x.com": { status: "unique", member: openComplimentaryMember },
        }),
        loadComplimentaryAccessYmdByMemberstackId: async () => new Map([["mem_comp", "2026-07-01"]]),
      }),
    );
    expect(endingFirst.totals.wouldTag).toBe(1);
    expect(ac.spies.subscribeToList).not.toHaveBeenCalled();
  });

  it("respects an unsubscribed list status", async () => {
    const ac = makeAc({ "a@x.com": { id: "ac_1", listStatus: "unsubscribed", tags: new Set() } });
    const result = await runLegacyRenewalReminders(
      baseOpts({
        dryRun: false,
        activeCampaign: ac.client,
        queryFn: makeQueryFn({ 1: [row({ memberid: "m1" })] }),
        resolveMemberstackMemberByEmail: resolverFor({
          "a@x.com": { status: "unique", member: legacyOnlyMember },
        }),
      }),
    );
    expect(result.totals.skippedUnsubscribed).toBe(1);
    expect(ac.spies.addTag).not.toHaveBeenCalled();
    expect(ac.spies.subscribeToList).not.toHaveBeenCalled();
  });

  it("respects bounced and unconfirmed statuses", async () => {
    for (const [status, key] of [
      ["bounced", "skippedBounced"],
      ["unconfirmed", "skippedUnconfirmed"],
    ] as const) {
      const ac = makeAc({
        "a@x.com": { id: "ac_1", listStatus: status, tags: new Set() },
      });
      const result = await runLegacyRenewalReminders(
        baseOpts({
          dryRun: false,
          activeCampaign: ac.client,
          queryFn: makeQueryFn({ 1: [row({ memberid: "m1" })] }),
          resolveMemberstackMemberByEmail: resolverFor({
            "a@x.com": { status: "unique", member: legacyOnlyMember },
          }),
        }),
      );
      expect(result.totals[key]).toBe(1);
      expect(ac.spies.addTag).not.toHaveBeenCalled();
    }
  });

  it("skips when the AC contact already has the tag", async () => {
    const ac = makeAc({
      "a@x.com": {
        id: "ac_1",
        listStatus: "active",
        tags: new Set(["tag_legacy-renewal-expired"]),
      },
    });
    const result = await runLegacyRenewalReminders(
      baseOpts({
        dryRun: false,
        activeCampaign: ac.client,
        queryFn: makeQueryFn({ 1: [row({ memberid: "m1" })] }),
        resolveMemberstackMemberByEmail: resolverFor({
          "a@x.com": { status: "unique", member: legacyOnlyMember },
        }),
      }),
    );
    expect(result.totals.skippedAlreadyTagged).toBe(1);
    expect(ac.spies.addTag).not.toHaveBeenCalled();
  });

  it("treats a missing audit table as no reminder history (no failure)", async () => {
    const ac = makeAc({ "a@x.com": { id: "ac_1", listStatus: "active", tags: new Set() } });
    // Candidate SELECT returns rows; the audit SELECT fails as if the table is absent.
    const queryFn = (async (sql: string, params?: unknown[]) => {
      if (sql.includes("watson_legacy_renewal_reminders")) {
        const err = new Error(
          'relation "watson_legacy_renewal_reminders" does not exist',
        ) as Error & { code?: string };
        err.code = "42P01";
        throw err;
      }
      const windowDays = Number(params?.[1]);
      return windowDays === 1 ? [row({ memberid: "m1" })] : [];
    }) as unknown as WatsonQueryFn;

    const result = await runLegacyRenewalReminders({
      now: NOW,
      dryRun: true,
      listId: LIST_ID,
      paidThroughFieldId: FIELD_ID,
      skipListValidation: true,
      activeCampaign: ac.client,
      queryFn,
      resolveMemberstackMemberByEmail: resolverFor({
        "a@x.com": { status: "unique", member: legacyOnlyMember },
      }),
      // Use the real default hasTaggedRecord so the missing-table path is exercised.
    });

    expect(result.ok).toBe(true);
    expect(result.totals.failures).toBe(0);
    expect(result.totals.wouldTag).toBe(1);
  });

  it("skips (without contacting AC) when the durable audit already recorded a tag", async () => {
    const ac = makeAc({ "a@x.com": { id: "ac_1", listStatus: "active", tags: new Set() } });
    const findContact = vi.spyOn(ac.client, "findContactByEmail");
    const result = await runLegacyRenewalReminders(
      baseOpts({
        dryRun: false,
        activeCampaign: ac.client,
        queryFn: makeQueryFn({ 1: [row({ memberid: "m1" })] }),
        resolveMemberstackMemberByEmail: resolverFor({
          "a@x.com": { status: "unique", member: legacyOnlyMember },
        }),
        hasTaggedRecord: async () => true,
      }),
    );
    expect(result.totals.skippedAlreadyTagged).toBe(1);
    expect(findContact).not.toHaveBeenCalled();
  });

  it("skips a missing email and a staff/test email", async () => {
    const ac = makeAc();
    const result = await runLegacyRenewalReminders(
      baseOpts({
        dryRun: false,
        activeCampaign: ac.client,
        queryFn: makeQueryFn({
          1: [
            row({ memberid: "blank", email: null }),
            row({ memberid: "staff", email: "test@knititnow.com" }),
          ],
        }),
        resolveMemberstackMemberByEmail: resolverFor({}),
      }),
    );
    expect(result.totals.skippedMissingEmail).toBe(1);
    expect(result.totals.skippedStaffOrTest).toBe(1);
    expect(ac.spies.addTag).not.toHaveBeenCalled();
  });

  it("treats one email on two legacy rows as ambiguous", async () => {
    const ac = makeAc();
    const result = await runLegacyRenewalReminders(
      baseOpts({
        dryRun: false,
        activeCampaign: ac.client,
        queryFn: makeQueryFn({
          1: [
            row({ memberid: "dupA", email: "dup@x.com" }),
            row({ memberid: "dupB", email: "dup@x.com" }),
          ],
        }),
        resolveMemberstackMemberByEmail: resolverFor({}),
      }),
    );
    expect(result.totals.skippedAmbiguous).toBe(2);
    expect(ac.spies.addTag).not.toHaveBeenCalled();
  });

  it("skips an ambiguous Memberstack match", async () => {
    const ac = makeAc();
    const result = await runLegacyRenewalReminders(
      baseOpts({
        dryRun: false,
        activeCampaign: ac.client,
        queryFn: makeQueryFn({ 1: [row({ memberid: "m1" })] }),
        resolveMemberstackMemberByEmail: resolverFor({ "a@x.com": { status: "ambiguous" } }),
      }),
    );
    expect(result.totals.skippedAmbiguous).toBe(1);
    expect(ac.spies.addTag).not.toHaveBeenCalled();
  });
});

describe("expired-day selection", () => {
  it("tags only legacy-renewal-expired for yesterday and does not query advance windows", async () => {
    const ac = makeAc({
      "a@x.com": { id: "ac_1", listStatus: "active", tags: new Set() },
    });
    const calls: unknown[][] = [];
    const queryFn = (async (_sql: string, params?: unknown[]) => {
      calls.push(params ?? []);
      return Number(params?.[1]) === 1 ? [row({ memberid: "m1", email: "a@x.com" })] : [];
    }) as unknown as WatsonQueryFn;
    const result = await runLegacyRenewalReminders(
      baseOpts({
        dryRun: false,
        activeCampaign: ac.client,
        queryFn,
        loadComplimentaryAccessYmdByMemberstackId: async () => new Map(),
        resolveMemberstackMemberByEmail: resolverFor({
          "a@x.com": { status: "not_found" },
        }),
      }),
    );
    expect(REMINDER_WINDOW_DAYS).toEqual([1]);
    expect(REMINDER_TAG_BY_WINDOW).toEqual({ 1: EXPIRED_REMINDER_TAG });
    expect(calls).toEqual([["2026-07-28", 1]]);
    expect(result.totals.tagged).toBe(1);
    expect(ac.spies.addTag).toHaveBeenCalledTimes(1);
    expect(ac.spies.addTag).toHaveBeenCalledWith("ac_1", "tag_legacy-renewal-expired");
    expect(REMINDER_WINDOW_MEMBERS_SQL).toContain(
      "m.subscriptionexpiring::date = ($1::date - ($2 || ' days')::interval)::date",
    );
    expect(REMINDER_WINDOW_MEMBERS_SQL).toContain("COALESCE(m.monthlysubscriber, 0) <> 1");
    expect(REMINDER_WINDOW_MEMBERS_SQL).toContain("COALESCE(m.betaactive, 0) = 0");
    expect(REMINDER_WINDOW_MEMBERS_SQL).not.toMatch(/subscriptionexpiring::date\s*</);
  });

  it("runs after Pacific midnight in both standard time and daylight time", () => {
    expect(LEGACY_RENEWAL_REMINDER_CRON).toBe("0 9 * * *");
    expect(dailyCronIsAfterPacificMidnight(LEGACY_RENEWAL_REMINDER_CRON)).toBe(true);
    expect(dailyCronIsAfterPacificMidnight("0 8 * * *")).toBe(false);
    expect(dailyCronIsAfterPacificMidnight("30 7 * * *")).toBe(false);
    const toml = readFileSync("netlify.toml", "utf8");
    expect(toml).toContain('[functions."legacy-renewal-reminders"]');
    expect(toml).toContain('schedule = "0 9 * * *"');
    expect(toml).not.toContain('schedule = "0 8 * * *"');
  });
});

describe("runLegacyRenewalReminders - configuration guards", () => {
  it("fails fast when the list id is missing", async () => {
    const result = await runLegacyRenewalReminders({
      now: NOW,
      dryRun: true,
      env: {},
      listId: undefined,
      paidThroughFieldId: FIELD_ID,
      activeCampaign: makeAc().client,
      queryFn: makeQueryFn({}),
    });
    expect(result.ok).toBe(false);
    expect(result.errorMessage).toContain("ACTIVECAMPAIGN_KIN_LIST_ID");
  });

  it("reads the existing paid-through field by name without creating one", async () => {
    const ac = makeAc({ "a@x.com": { id: "ac_1", listStatus: "active", tags: new Set() } });
    const resolveFieldId = vi.fn(async () => "9");
    ac.client.resolveFieldId = resolveFieldId;
    const result = await runLegacyRenewalReminders(
      baseOpts({
        dryRun: true,
        env: { ACTIVECAMPAIGN_KIN_LIST_ID: LIST_ID } as NodeJS.ProcessEnv,
        listId: undefined,
        paidThroughFieldId: undefined,
        activeCampaign: ac.client,
        queryFn: makeQueryFn({ 1: [row({ memberid: "m1" })] }),
        resolveMemberstackMemberByEmail: resolverFor({
          "a@x.com": { status: "unique", member: legacyOnlyMember },
        }),
      }),
    );
    expect(resolveFieldId).toHaveBeenCalledWith("Legacy Membership Paid Through", {
      create: false,
    });
    expect(result.ok).toBe(true);
    expect(result.totals.wouldTag).toBe(1);
    expect(result.paidThroughFieldId).toBe("9");
  });

  it("fails fast when the paid-through field id is missing", async () => {
    const result = await runLegacyRenewalReminders({
      now: NOW,
      dryRun: true,
      env: {},
      listId: LIST_ID,
      paidThroughFieldId: undefined,
      activeCampaign: makeAc().client,
      queryFn: makeQueryFn({}),
    });
    expect(result.ok).toBe(false);
    expect(result.errorMessage).toContain("ACTIVECAMPAIGN_PAID_THROUGH_FIELD_ID");
  });

  it("reads the list id and field id from the supplied env (process.env pattern)", async () => {
    const ac = makeAc();
    const result = await runLegacyRenewalReminders({
      now: NOW,
      dryRun: true,
      env: {
        ACTIVECAMPAIGN_KIN_LIST_ID: "2",
        ACTIVECAMPAIGN_PAID_THROUGH_FIELD_ID: "42",
      } as NodeJS.ProcessEnv,
      activeCampaign: ac.client,
      skipListValidation: true,
      queryFn: makeQueryFn({}),
    });
    expect(result.ok).toBe(true);
    expect(result.listId).toBe("2");
    expect(result.paidThroughFieldId).toBe("42");
    expect(result.errorMessage).toBeNull();
  });
});

describe("getLegacyReminderActiveCampaignSettings", () => {
  it("reads ACTIVECAMPAIGN_KIN_LIST_ID and field id from the env object", () => {
    expect(
      getLegacyReminderActiveCampaignSettings({
        ACTIVECAMPAIGN_KIN_LIST_ID: " 2 ",
        ACTIVECAMPAIGN_PAID_THROUGH_FIELD_ID: "42",
      } as NodeJS.ProcessEnv),
    ).toEqual({ listId: "2", paidThroughFieldId: "42" });
  });

  it("returns null for blank/missing values", () => {
    expect(getLegacyReminderActiveCampaignSettings({} as NodeJS.ProcessEnv)).toEqual({
      listId: null,
      paidThroughFieldId: null,
    });
    expect(
      getLegacyReminderActiveCampaignSettings({
        ACTIVECAMPAIGN_KIN_LIST_ID: "   ",
      } as NodeJS.ProcessEnv),
    ).toEqual({ listId: null, paidThroughFieldId: null });
  });
});
