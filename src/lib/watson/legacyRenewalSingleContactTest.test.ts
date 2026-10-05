import { describe, expect, it, vi } from "vitest";

import { COMPLIMENTARY_MEMBERSHIPS, MEMBERSHIPS } from "../../config/memberships";
import type { ActiveCampaignClient } from "../activecampaign/client";
import type { MemberstackMember } from "../membership/membershipSummary";
import { LEGACY_ANNUAL_PLAN_ID } from "./legacyAnnualExpiry";
import { runLegacyRenewalReminders } from "./legacyRenewalReminders";
import {
  applyExplicitLegacyRenewalTest,
  LEGACY_RENEWAL_TEST_EMAIL,
  preflightLegacyRenewalTestContact,
} from "./legacyRenewalSingleContactTest";
import type { WatsonQueryFn } from "./memberSearch";

const NOW = new Date("2026-10-05T19:00:00Z");
const SEVEN_DAY = "2026-10-12";

function member(planIds: string[], id = "mem_test"): MemberstackMember {
  return {
    id,
    auth: { email: LEGACY_RENEWAL_TEST_EMAIL },
    planConnections: planIds.map((planId) => ({ planId, status: "ACTIVE", active: true })),
  };
}

function acClient(status: "active" | "not_on_list" = "active", hasTag = false): {
  client: ActiveCampaignClient;
  spies: { syncContact: ReturnType<typeof vi.fn>; addTag: ReturnType<typeof vi.fn>; subscribeToList: ReturnType<typeof vi.fn> };
} {
  const spies = {
    syncContact: vi.fn(),
    addTag: vi.fn(),
    subscribeToList: vi.fn(),
  };
  const client: ActiveCampaignClient = {
    async listExists() {
      return true;
    },
    async findContactByEmail() {
      return status === "not_on_list" && arguments.length ? { id: "ac_test" } : { id: "ac_test" };
    },
    async syncContact(input) {
      spies.syncContact(input);
      return { id: "ac_test" };
    },
    async getListStatus() {
      return status;
    },
    async subscribeToList(contactId) {
      spies.subscribeToList(contactId);
    },
    async resolveTagId() {
      return "tag_legacy-renewal-7-days";
    },
    async contactHasTag() {
      return hasTag;
    },
    async addTag(contactId, tagId) {
      spies.addTag(contactId, tagId);
    },
    async resolveFieldId(_title, options) {
      expect(options).toEqual({ create: false });
      return "9";
    },
    async findAutomationByExactName() {
      return { name: "Legacy Annual Renewal - 7 Days", active: false, ambiguous: false };
    },
  };
  if (status === "not_on_list") {
    client.findContactByEmail = async () => null;
  }
  return { client, spies };
}

function queryFn(paidThrough = SEVEN_DAY): WatsonQueryFn {
  return (async (sql: string) => {
    if (sql.includes("FROM legacy_members")) {
      return [
        {
          memberid: "m_test",
          fristname: "No",
          paid_through_ymd: paidThrough,
          betaactive: 0,
          monthlysubscriber: 0,
        },
      ];
    }
    if (sql.includes("watson_complimentary_access")) return [];
    if (sql.includes("watson_legacy_renewal_reminders") && sql.includes("SELECT")) return [];
    if (sql.includes("INSERT")) return [];
    return [];
  }) as unknown as WatsonQueryFn;
}

const ready = {
  now: NOW,
  env: { ACTIVECAMPAIGN_KIN_LIST_ID: "5" } as NodeJS.ProcessEnv,
  loadMemberstackMembers: async () => ({
    members: [member([LEGACY_ANNUAL_PLAN_ID])],
    truncated: false,
  }),
};

describe("explicit nosub1 legacy renewal test", () => {
  it("keeps the scheduled job from reminding this staff address", async () => {
    const ac = acClient();
    const result = await runLegacyRenewalReminders({
      now: NOW,
      dryRun: true,
      listId: "5",
      paidThroughFieldId: "9",
      skipListValidation: true,
      activeCampaign: ac.client,
      hasTaggedRecord: async () => false,
      queryFn: (async (_sql: string, params?: unknown[]) => {
        return Number(params?.[1]) === 7
          ? [
              {
                memberid: "m_test",
                fristname: "No",
                lastname: "Sub",
                email: LEGACY_RENEWAL_TEST_EMAIL,
                subscriptionexpiring: SEVEN_DAY,
              },
            ]
          : [];
      }) as unknown as WatsonQueryFn,
      resolveMemberstackMemberByEmail: async () => ({
        status: "unique" as const,
        member: member([LEGACY_ANNUAL_PLAN_ID]),
      }),
    });
    expect(result.totals.skippedStaffOrTest).toBe(1);
    expect(result.totals.wouldTag).toBe(0);
    expect(ac.spies.addTag).not.toHaveBeenCalled();
  });

  it("preflights only nosub1 and does not write when the contact is eligible", async () => {
    const ac = acClient();
    const result = await preflightLegacyRenewalTestContact({
      ...ready,
      activeCampaign: ac.client,
      queryFn: queryFn(),
    });
    expect(result.email).toBe("nosub1@knititnow.com");
    expect(result.eligible).toBe(true);
    expect(result.blockers).toEqual([]);
    expect(result.automation).toEqual({ found: true, active: false, ambiguous: false });
    expect(ac.spies.syncContact).not.toHaveBeenCalled();
    expect(ac.spies.addTag).not.toHaveBeenCalled();
    expect(ac.spies.subscribeToList).not.toHaveBeenCalled();
  });

  it("blocks a paid plan, open complimentary access, a missing subscription, and the wrong date", async () => {
    const paid = await preflightLegacyRenewalTestContact({
      ...ready,
      activeCampaign: acClient().client,
      queryFn: queryFn(),
      loadMemberstackMembers: async () => ({
        members: [member([LEGACY_ANNUAL_PLAN_ID, MEMBERSHIPS.membership.memberstackPlanId])],
        truncated: false,
      }),
    });
    expect(paid.blockers).toContain("active_paid");

    const complimentary = await preflightLegacyRenewalTestContact({
      ...ready,
      activeCampaign: acClient().client,
      queryFn: queryFn(),
      loadMemberstackMembers: async () => ({
        members: [
          member([
            LEGACY_ANNUAL_PLAN_ID,
            COMPLIMENTARY_MEMBERSHIPS.complimentaryMembership.memberstackPlanId,
          ]),
        ],
        truncated: false,
      }),
    });
    expect(complimentary.blockers).toContain("complimentary_outlasts");

    const unsubscribed = await preflightLegacyRenewalTestContact({
      ...ready,
      activeCampaign: acClient("not_on_list").client,
      queryFn: queryFn(),
    });
    expect(unsubscribed.blockers).toContain("not_subscribed");

    const wrongDate = await preflightLegacyRenewalTestContact({
      ...ready,
      activeCampaign: acClient().client,
      queryFn: queryFn("2026-12-01"),
    });
    expect(wrongDate.blockers).toContain("outside_seven_day_window");
    expect(wrongDate.eligible).toBe(false);
  });

  it("does not tag when writes are not allowed, and tags only this contact when they are", async () => {
    const blocked = acClient();
    const dry = await applyExplicitLegacyRenewalTest({
      ...ready,
      productionWritesAllowed: false,
      activeCampaign: blocked.client,
      queryFn: queryFn(),
    });
    expect(dry.applied).toBe(false);
    expect(blocked.spies.addTag).not.toHaveBeenCalled();

    const live = acClient();
    const applied = await applyExplicitLegacyRenewalTest({
      ...ready,
      productionWritesAllowed: true,
      activeCampaign: live.client,
      queryFn: queryFn(),
    });
    expect(applied.applied).toBe(true);
    expect(live.spies.addTag).toHaveBeenCalledWith("ac_test", "tag_legacy-renewal-7-days");
    expect(live.spies.subscribeToList).not.toHaveBeenCalled();
    expect(live.spies.syncContact).toHaveBeenCalledWith(
      expect.objectContaining({ email: "nosub1@knititnow.com" }),
    );
  });
});
