import { describe, expect, it, vi } from "vitest";
import type {
  ActiveCampaignClient,
  ActiveCampaignListStatus,
} from "../activecampaign/client";
import { EMAIL_LIST_SIGNUP_EXPECTED_HOST } from "../email/emailListSignup";
import {
  GETTING_STARTED_GUIDE_LEAD_TAG,
  GETTING_STARTED_GUIDE_MESSAGES,
  handleGettingStartedGuideLeadRequest,
  toPublicGettingStartedGuideLeadResponse,
} from "./guideLeadCapture";

interface FakeContact {
  id: string;
  firstName?: string;
  listStatus: ActiveCampaignListStatus;
  tags: Set<string>;
}

function makeAc(seed: Record<string, FakeContact> = {}) {
  const contacts = new Map<string, FakeContact>(Object.entries(seed));
  let nextId = 100;
  const spies = {
    syncContact: vi.fn(),
    subscribeToList: vi.fn(),
    addTag: vi.fn(),
    resolveTagId: vi.fn(),
  };

  const findById = (id: string): FakeContact | undefined =>
    [...contacts.values()].find((contact) => contact.id === id);

  const client: ActiveCampaignClient = {
    async listExists(listId) {
      return listId === "2" || listId === "77";
    },
    async findContactByEmail(email) {
      const contact = contacts.get(email);
      return contact ? { id: contact.id } : null;
    },
    async syncContact(input) {
      spies.syncContact(input);
      let contact = contacts.get(input.email);
      if (!contact) {
        contact = {
          id: `ac_${nextId++}`,
          firstName: input.firstName,
          listStatus: "not_on_list",
          tags: new Set(),
        };
        contacts.set(input.email, contact);
      } else if (input.firstName) {
        contact.firstName = input.firstName;
      }
      return { id: contact.id };
    },
    async getListStatus(contactId) {
      return findById(contactId)?.listStatus ?? "not_on_list";
    },
    async subscribeToList(contactId, listId) {
      spies.subscribeToList(contactId, listId);
      const contact = findById(contactId);
      if (contact) contact.listStatus = "active";
    },
    async resolveTagId(tagName, options) {
      spies.resolveTagId(tagName, options);
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

const envFor = (listId: string) => ({
  ACTIVECAMPAIGN_API_KEY: "test-key",
  ACTIVECAMPAIGN_BASE_URL: `https://${EMAIL_LIST_SIGNUP_EXPECTED_HOST}`,
  ACTIVECAMPAIGN_KIN_LIST_ID: listId,
});

const body = {
  firstName: "Ada",
  email: "ada@example.com",
  "bot-field": "",
};

describe("Getting Started Guide ActiveCampaign signup", () => {
  it("subscribes a new contact to the configured list and tags them by name", async () => {
    const ac = makeAc();
    const result = await handleGettingStartedGuideLeadRequest(body, {
      env: envFor("77"),
      createClient: () => ac.client,
      clientIp: "203.0.113.10",
    });

    expect(result.ok).toBe(true);
    expect(ac.spies.resolveTagId).toHaveBeenCalledWith(GETTING_STARTED_GUIDE_LEAD_TAG, {
      create: true,
    });
    expect(GETTING_STARTED_GUIDE_LEAD_TAG).toBe("Lead: Getting Started Guide");
    expect(ac.spies.subscribeToList).toHaveBeenCalledWith("ac_100", "77");
    expect(ac.spies.addTag).toHaveBeenCalledWith("ac_100", "tag_Lead: Getting Started Guide");
    expect(toPublicGettingStartedGuideLeadResponse(result)).toEqual({
      ok: true,
      message: GETTING_STARTED_GUIDE_MESSAGES.success,
    });
    expect(JSON.stringify(toPublicGettingStartedGuideLeadResponse(result))).not.toMatch(/77|tag_/);
  });

  it("updates the same contact on repeat signup and does not subscribe or tag again", async () => {
    const ac = makeAc({
      "ada@example.com": {
        id: "ac_ada",
        listStatus: "active",
        tags: new Set(["tag_Lead: Getting Started Guide"]),
      },
    });
    const options = {
      env: envFor("2"),
      createClient: () => ac.client,
      clientIp: "203.0.113.11",
    };

    await handleGettingStartedGuideLeadRequest(body, options);
    await handleGettingStartedGuideLeadRequest({ ...body, firstName: "Adelaide" }, options);

    expect(ac.contacts.size).toBe(1);
    expect(ac.contacts.get("ada@example.com")?.id).toBe("ac_ada");
    expect(ac.contacts.get("ada@example.com")?.firstName).toBe("Adelaide");
    expect(ac.spies.subscribeToList).not.toHaveBeenCalled();
    expect(ac.spies.addTag).not.toHaveBeenCalled();
    expect(ac.spies.syncContact).toHaveBeenCalledTimes(2);
  });

  it("does not resubscribe or tag an unsubscribed contact", async () => {
    const ac = makeAc({
      "ada@example.com": {
        id: "ac_ada",
        listStatus: "unsubscribed",
        tags: new Set(),
      },
    });
    const result = await handleGettingStartedGuideLeadRequest(body, {
      env: envFor("2"),
      createClient: () => ac.client,
      clientIp: "203.0.113.12",
    });

    expect(result).toMatchObject({ ok: true, outcome: "skipped_unsubscribed" });
    expect(ac.spies.subscribeToList).not.toHaveBeenCalled();
    expect(ac.spies.addTag).not.toHaveBeenCalled();
    expect(ac.contacts.get("ada@example.com")?.listStatus).toBe("unsubscribed");
  });

  it("does not unlock when ActiveCampaign is unavailable", async () => {
    const ac = makeAc();
    ac.client.syncContact = async () => {
      throw new Error("ActiveCampaign contact sync failed (HTTP 503)");
    };
    const result = await handleGettingStartedGuideLeadRequest(body, {
      env: envFor("2"),
      createClient: () => ac.client,
      clientIp: "203.0.113.13",
    });

    expect(result).toMatchObject({
      ok: false,
      status: 502,
      error: GETTING_STARTED_GUIDE_MESSAGES.genericFailure,
    });
    expect(ac.spies.subscribeToList).not.toHaveBeenCalled();
  });

  it("refuses to run without the configured Knit It Now list id", async () => {
    const ac = makeAc();
    const result = await handleGettingStartedGuideLeadRequest(body, {
      env: {
        ACTIVECAMPAIGN_API_KEY: "test-key",
        ACTIVECAMPAIGN_BASE_URL: `https://${EMAIL_LIST_SIGNUP_EXPECTED_HOST}`,
      },
      createClient: () => ac.client,
      clientIp: "203.0.113.14",
    });

    expect(result).toMatchObject({ ok: false, status: 500 });
    expect(ac.spies.syncContact).not.toHaveBeenCalled();
    expect(ac.spies.subscribeToList).not.toHaveBeenCalled();
  });

  it("requires a first name before talking to ActiveCampaign", async () => {
    const ac = makeAc();
    const result = await handleGettingStartedGuideLeadRequest(
      { email: "ada@example.com", firstName: "  " },
      { env: envFor("2"), createClient: () => ac.client, clientIp: "203.0.113.15" },
    );
    expect(result).toMatchObject({
      ok: false,
      status: 400,
      error: GETTING_STARTED_GUIDE_MESSAGES.invalidFirstName,
    });
    expect(ac.spies.syncContact).not.toHaveBeenCalled();
  });
});
