import { describe, expect, it, vi } from "vitest";

import type { ActiveCampaignClient } from "./client";
import {
  membershipAccessBatchSize,
  membershipAccessLockIsActive,
  membershipAccessShouldChain,
  membershipAccessShouldRetryError,
  MEMBERSHIP_ACCESS_LOCK_MS,
  MEMBERSHIP_ACCESS_WRITE_BATCH,
  planCurrentMembershipAccessUpdates,
} from "./currentMembershipAccessSync";
import { CURRENT_MEMBERSHIP_ACCESS_FIELD } from "../membership/currentMembershipAccess";
import type { CurrentMembershipAccessCensus } from "../membership/currentMembershipAccessCensus";
import { runCurrentMembershipAccessSync } from "./currentMembershipAccessSync";

function census(
  people: CurrentMembershipAccessCensus["people"],
): CurrentMembershipAccessCensus {
  return {
    todayLosAngeles: "2026-10-31",
    memberstackTruncated: false,
    legacyLoaded: true,
    complimentaryLoaded: true,
    missingEmail: 0,
    watsonYesCount: people.filter((person) => person.outcome === "yes").length,
    watsonNoCount: people.filter((person) => person.outcome === "no").length,
    unresolvedCount: people.filter((person) => person.outcome === "unresolved").length,
    people,
  };
}

describe("planCurrentMembershipAccessUpdates", () => {
  it("matches one yes person to one contact and leaves a missing contact unmatched", () => {
    const plan = planCurrentMembershipAccessUpdates({
      census: census([
        {
          email: "renewed@example.com",
          outcome: "yes",
          value: "yes",
          reason: null,
          memberstackId: "mem_yes",
          legacyMemberIds: ["leg_yes"],
        },
        {
          email: "expired@example.com",
          outcome: "no",
          value: "no",
          reason: null,
          memberstackId: "mem_no",
          legacyMemberIds: ["leg_no"],
        },
        {
          email: "shared@example.com",
          outcome: "unresolved",
          value: null,
          reason: "ambiguous_memberstack_email",
          memberstackId: null,
          legacyMemberIds: [],
        },
        {
          email: "nocontact@example.com",
          outcome: "yes",
          value: "yes",
          reason: null,
          memberstackId: "mem_missing",
          legacyMemberIds: [],
        },
      ]),
      contacts: [
        { id: "ac_yes", email: "renewed@example.com", fieldValue: null },
        { id: "ac_no", email: "expired@example.com", fieldValue: "yes" },
        { id: "ac_dup_1", email: "shared@example.com", fieldValue: "yes" },
        { id: "ac_dup_2", email: "shared@example.com", fieldValue: null },
      ],
    });

    expect(plan.watsonYesCount).toBe(2);
    expect(plan.matchedYesCount).toBe(1);
    expect(plan.wouldWrite.map((write) => [write.email, write.value])).toEqual([
      ["renewed@example.com", "yes"],
      ["expired@example.com", "no"],
    ]);
    expect(plan.missingFromActiveCampaign).toEqual(["nocontact@example.com"]);
    expect(plan.duplicateContacts).toEqual([
      {
        email: "shared@example.com",
        contactIds: ["ac_dup_1", "ac_dup_2"],
        outcome: "unresolved",
      },
    ]);
    expect(plan.unresolved.map((item) => item.reason)).toContain("ambiguous_memberstack_email");
    expect(plan.missingFromWatson.map((item) => item.contactId)).toContain("ac_dup_1");
  });
});

describe("runCurrentMembershipAccessSync", () => {
  it("does not write in a dry run and does not create contacts or other fields", async () => {
    const writeFieldValue = vi.fn();
    const syncContact = vi.fn();
    const client = {
      async listExists() {
        return true;
      },
      async findContactByEmail() {
        return null;
      },
      syncContact,
      async getListStatus() {
        return "active" as const;
      },
      async subscribeToList() {},
      async resolveTagId() {
        return null;
      },
      async contactHasTag() {
        return false;
      },
      async addTag() {},
      async resolveFieldId(title: string) {
        expect(title).toBe(CURRENT_MEMBERSHIP_ACCESS_FIELD);
        return null;
      },
      writeFieldValue,
      async listContacts() {
        return [{ id: "ac_1", email: "renewed@example.com" }];
      },
      async listFieldValues() {
        return [];
      },
    } as ActiveCampaignClient;

    const result = await runCurrentMembershipAccessSync({
      liveWrite: false,
      census: census([
        {
          email: "renewed@example.com",
          outcome: "yes",
          value: "yes",
          reason: null,
          memberstackId: "mem_1",
          legacyMemberIds: [],
        },
      ]),
      activeCampaign: client,
    });

    expect(result.ok).toBe(true);
    expect(result.liveWrite).toBe(false);
    expect(writeFieldValue).not.toHaveBeenCalled();
    expect(syncContact).not.toHaveBeenCalled();
    expect(result.plan?.wouldWrite).toEqual([
      {
        email: "renewed@example.com",
        contactId: "ac_1",
        value: "yes",
        previous: null,
      },
    ]);
    expect(result.remainingWrites).toBe(1);
  });

  it("does not write when existing field values cannot be listed", async () => {
    const writeFieldValue = vi.fn();
    const client = {
      async listExists() {
        return true;
      },
      async findContactByEmail() {
        return null;
      },
      async syncContact() {
        return { id: "unused" };
      },
      async getListStatus() {
        return "active" as const;
      },
      async subscribeToList() {},
      async resolveTagId() {
        return null;
      },
      async contactHasTag() {
        return false;
      },
      async addTag() {},
      async resolveFieldId() {
        return "field_1";
      },
      writeFieldValue,
      async listContacts() {
        return [{ id: "ac_1", email: "expired@example.com" }];
      },
      async listFieldValues() {
        return null;
      },
    } as ActiveCampaignClient;

    const result = await runCurrentMembershipAccessSync({
      liveWrite: true,
      census: census([
        {
          email: "expired@example.com",
          outcome: "no",
          value: "no",
          reason: null,
          memberstackId: "mem_no",
          legacyMemberIds: [],
        },
      ]),
      activeCampaign: client,
    });

    expect(result.ok).toBe(false);
    expect(result.written).toBe(0);
    expect(writeFieldValue).not.toHaveBeenCalled();
    expect(result.errorMessage).toContain("already marked yes");
  });
});

describe("membership access continuation", () => {
  it("caps each live batch and continues while writes remain", () => {
    expect(membershipAccessBatchSize(undefined)).toBe(MEMBERSHIP_ACCESS_WRITE_BATCH);
    expect(membershipAccessBatchSize(5000)).toBe(MEMBERSHIP_ACCESS_WRITE_BATCH);
    expect(membershipAccessBatchSize(40)).toBe(40);
    expect(
      membershipAccessShouldChain({
        liveWrite: true,
        fieldValuesKnown: true,
        truncated: false,
        legacyLoaded: true,
        written: 1000,
        remainingWrites: 2000,
        failures: 1,
        retry: 0,
      }),
    ).toBe(true);
    expect(
      membershipAccessShouldChain({
        liveWrite: true,
        fieldValuesKnown: true,
        truncated: false,
        legacyLoaded: true,
        written: 0,
        remainingWrites: 1,
        failures: 1,
        retry: 2,
      }),
    ).toBe(false);
    expect(
      membershipAccessShouldChain({
        liveWrite: false,
        fieldValuesKnown: true,
        truncated: false,
        legacyLoaded: true,
        written: 0,
        remainingWrites: 10,
        failures: 0,
        retry: 0,
      }),
    ).toBe(false);
  });

  it("treats a lock younger than 16 minutes as an active worker", () => {
    const now = Date.parse("2026-10-31T20:00:00.000Z");
    expect(membershipAccessLockIsActive(new Date(now - 60_000).toISOString(), now)).toBe(true);
    expect(
      membershipAccessLockIsActive(new Date(now - MEMBERSHIP_ACCESS_LOCK_MS).toISOString(), now),
    ).toBe(false);
    expect(membershipAccessLockIsActive(null, now)).toBe(false);
    expect(membershipAccessShouldRetryError({ liveWrite: true, retry: 0 })).toBe(true);
    expect(membershipAccessShouldRetryError({ liveWrite: true, retry: 3 })).toBe(false);
    expect(membershipAccessShouldRetryError({ liveWrite: false, retry: 0 })).toBe(false);
  });
});
