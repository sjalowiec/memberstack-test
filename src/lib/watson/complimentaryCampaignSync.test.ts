import fs from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";

import type { ActiveCampaignClient } from "../activecampaign/client";
import { selectExactActiveCampaignField } from "../activecampaign/client";
import { MEMBERSHIPS } from "../../config/memberships";
import type { MemberstackMember } from "../membership/membershipSummary";
import {
  ACTIVE_PAID_MEMBERSHIP_FIELD,
  ACTIVE_PAID_MEMBERSHIP_NO,
  ACTIVE_PAID_MEMBERSHIP_YES,
  COMPLIMENTARY_ACCESS_THROUGH_FIELD,
  COMPLIMENTARY_MEMBERSHIP_TAG,
  complimentaryCampaignSyncWillWrite,
  isProductionActiveCampaignWriteRuntime,
  PRODUCTION_CAMPAIGN_SITE_ID,
  runComplimentaryCampaignSync,
} from "./complimentaryCampaignSync";

const PAID = MEMBERSHIPS.membership.memberstackPlanId;
const COMPLIMENTARY = "pln_complimentary-membership-30-days-ai28093g";

function member(email: string, planIds: string[]): MemberstackMember {
  return {
    id: "mem_test",
    auth: { email },
    planConnections: planIds.map((planId) => ({
      planId,
      status: "ACTIVE",
      active: true,
    })),
  };
}

function acDouble() {
  const fieldValues = new Map<string, Map<string, string>>();
  const tags = new Set<string>();
  const spies = {
    syncContact: vi.fn(),
    addTag: vi.fn(),
    subscribeToList: vi.fn(),
    resolveFieldId: vi.fn(),
    resolveTagId: vi.fn(),
  };
  const client: ActiveCampaignClient = {
    async listExists() {
      return true;
    },
    async findContactByEmail() {
      return { id: "ac_1" };
    },
    async syncContact(input) {
      spies.syncContact(input);
      const values = fieldValues.get("ac_1") ?? new Map<string, string>();
      for (const field of input.fieldValues ?? []) values.set(field.field, field.value);
      fieldValues.set("ac_1", values);
      return { id: "ac_1" };
    },
    async getListStatus() {
      return "active";
    },
    async subscribeToList(contactId, listId) {
      spies.subscribeToList(contactId, listId);
    },
    async resolveTagId(tagName, options) {
      spies.resolveTagId(tagName, options);
      return `tag_${tagName}`;
    },
    async contactHasTag(_contactId, tagId) {
      return tags.has(tagId);
    },
    async addTag(contactId, tagId) {
      spies.addTag(contactId, tagId);
      tags.add(tagId);
    },
    async resolveFieldId(title, options) {
      spies.resolveFieldId(title, options);
      return `field_${title}`;
    },
    async readFieldValue(_contactId, fieldId) {
      return fieldValues.get("ac_1")?.get(fieldId) ?? null;
    },
  };
  return { client, spies, tags };
}

describe("complimentary campaign sync guards", () => {
  it("writes only from the production site when the flag is exactly true", () => {
    const production = {
      CONTEXT: "production",
      SITE_ID: PRODUCTION_CAMPAIGN_SITE_ID,
      COMPLIMENTARY_CAMPAIGN_SYNC_LIVE_ENABLED: "true",
    };
    expect(isProductionActiveCampaignWriteRuntime(production)).toBe(true);
    expect(complimentaryCampaignSyncWillWrite(production)).toBe(true);
    expect(
      complimentaryCampaignSyncWillWrite({
        ...production,
        COMPLIMENTARY_CAMPAIGN_SYNC_LIVE_ENABLED: "TRUE",
      }),
    ).toBe(false);
    expect(
      complimentaryCampaignSyncWillWrite({
        CONTEXT: "production",
        SITE_ID: "3196ab5e-c5a1-4cd4-a13a-980523087e9a",
        SITE_NAME: "kin-dev",
        URL: "https://kin-dev.netlify.app",
        COMPLIMENTARY_CAMPAIGN_SYNC_LIVE_ENABLED: "true",
      }),
    ).toBe(false);
    expect(
      complimentaryCampaignSyncWillWrite({
        CONTEXT: "production",
        URL: "https://knititnow.com",
        COMPLIMENTARY_CAMPAIGN_SYNC_LIVE_ENABLED: "true",
      }),
    ).toBe(true);
    expect(
      complimentaryCampaignSyncWillWrite({
        CONTEXT: "production",
        URL: "https://kin-dev.netlify.app",
        COMPLIMENTARY_CAMPAIGN_SYNC_LIVE_ENABLED: "true",
      }),
    ).toBe(false);
  });

  it("lets Watson routes read the Astro build env before deciding to write", () => {
    const root = path.resolve(import.meta.dirname, "../../..");
    const syncRoute = fs.readFileSync(
      path.join(root, "src/pages/api/watson/complimentary-campaign-sync.ts"),
      "utf8",
    );
    const dateRoute = fs.readFileSync(
      path.join(
        root,
        "src/pages/api/watson/memberstack/[memberstackId]/complimentary-access.ts",
      ),
      "utf8",
    );
    expect(syncRoute).toContain("complimentaryCampaignSyncWillWrite(complimentaryCampaignAstroEnv())");
    expect(dateRoute).toContain("complimentaryCampaignSyncWillWrite(complimentaryCampaignAstroEnv())");
  });

  it("reuses an existing field title instead of creating another", () => {
    expect(
      selectExactActiveCampaignField(
        [
          { id: "9", title: "Legacy Membership Paid Through" },
          { id: "15", title: COMPLIMENTARY_ACCESS_THROUGH_FIELD },
        ],
        COMPLIMENTARY_ACCESS_THROUGH_FIELD,
      ),
    ).toBe("15");
  });
});

describe("runComplimentaryCampaignSync", () => {
  it("syncs a saved date and paid status without subscribing", async () => {
    const { client, spies } = acDouble();
    const result = await runComplimentaryCampaignSync({
      liveWrite: true,
      activeCampaign: client,
      queryFn: async () => [
        { memberstack_id: "mem_snow", access_through: "2027-01-04" },
      ],
      loadMember: async () => member("mrshappysnow@gmail.com", [COMPLIMENTARY]),
    });

    expect(result.synced).toBe(1);
    expect(spies.subscribeToList).not.toHaveBeenCalled();
    expect(spies.resolveFieldId).toHaveBeenCalledWith(COMPLIMENTARY_ACCESS_THROUGH_FIELD, {
      create: true,
      type: "date",
    });
    expect(spies.resolveFieldId).toHaveBeenCalledWith(ACTIVE_PAID_MEMBERSHIP_FIELD, {
      create: true,
      type: "text",
    });
    expect(spies.syncContact).toHaveBeenCalledWith({
      email: "mrshappysnow@gmail.com",
      fieldValues: [
        { field: `field_${COMPLIMENTARY_ACCESS_THROUGH_FIELD}`, value: "2027-01-04" },
        { field: `field_${ACTIVE_PAID_MEMBERSHIP_FIELD}`, value: ACTIVE_PAID_MEMBERSHIP_NO },
      ],
    });
    expect(spies.addTag).toHaveBeenCalledWith("ac_1", `tag_${COMPLIMENTARY_MEMBERSHIP_TAG}`);
    expect(result.details[0]?.dateFieldValue).toBe("2027-01-04");
    expect(result.details[0]?.paidFieldValue).toBe(ACTIVE_PAID_MEMBERSHIP_NO);
  });

  it("replaces the complimentary date and records a later paid membership", async () => {
    const { client, spies } = acDouble();
    await runComplimentaryCampaignSync({
      liveWrite: true,
      activeCampaign: client,
      queryFn: async () => [
        { memberstack_id: "mem_snow", access_through: "2027-01-04" },
      ],
      loadMember: async () => member("mrshappysnow@gmail.com", [COMPLIMENTARY]),
    });
    spies.addTag.mockClear();
    spies.syncContact.mockClear();

    const extended = await runComplimentaryCampaignSync({
      liveWrite: true,
      activeCampaign: client,
      queryFn: async () => [
        { memberstack_id: "mem_snow", access_through: "2027-06-01" },
      ],
      loadMember: async () => member("mrshappysnow@gmail.com", [COMPLIMENTARY, PAID]),
    });

    expect(spies.addTag).not.toHaveBeenCalled();
    expect(spies.syncContact).toHaveBeenCalledWith({
      email: "mrshappysnow@gmail.com",
      fieldValues: [
        { field: `field_${COMPLIMENTARY_ACCESS_THROUGH_FIELD}`, value: "2027-06-01" },
        { field: `field_${ACTIVE_PAID_MEMBERSHIP_FIELD}`, value: ACTIVE_PAID_MEMBERSHIP_YES },
      ],
    });
    expect(extended.details[0]?.dateFieldValue).toBe("2027-06-01");
    expect(extended.details[0]?.paidMembership).toBe(true);
    expect(extended.details[0]?.reason).toBe("date_updated");
  });

  it("does not sync staff or test addresses, including sept13", async () => {
    const { client, spies } = acDouble();
    const result = await runComplimentaryCampaignSync({
      liveWrite: true,
      activeCampaign: client,
      queryFn: async () => [
        { memberstack_id: "mem_staff", access_through: "2027-01-04" },
      ],
      loadMember: async () => member("sept13@knititnow.com", [COMPLIMENTARY]),
    });
    expect(result.synced).toBe(0);
    expect(result.details[0]?.outcome).toBe("skipped_staff_or_test");
    expect(spies.syncContact).not.toHaveBeenCalled();
    expect(spies.addTag).not.toHaveBeenCalled();
  });

  it("does not write from a dry run", async () => {
    const { client, spies } = acDouble();
    const result = await runComplimentaryCampaignSync({
      liveWrite: false,
      activeCampaign: client,
      queryFn: async () => [
        { memberstack_id: "mem_snow", access_through: "2027-01-04" },
      ],
      loadMember: async () => member("mrshappysnow@gmail.com", [COMPLIMENTARY]),
    });
    expect(result.wouldSync).toBe(1);
    expect(spies.syncContact).not.toHaveBeenCalled();
    expect(spies.addTag).not.toHaveBeenCalled();
    expect(spies.resolveFieldId).not.toHaveBeenCalled();
  });
});
