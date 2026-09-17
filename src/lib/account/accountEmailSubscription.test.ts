import { describe, expect, it, vi } from "vitest";
import type {
  ActiveCampaignClient,
  ActiveCampaignListStatus,
} from "../activecampaign/client";
import {
  ACCOUNT_EMAIL_SUBSCRIPTION_MESSAGES,
  ACCOUNT_EMAIL_SUBSCRIPTION_TAG,
  checkAccountEmailSubscription,
  namesFromMemberstackRecord,
  resubscribeAccountEmailSubscription,
  toPublicAccountEmailSubscriptionResubscribe,
  toPublicAccountEmailSubscriptionStatus,
} from "./accountEmailSubscription";

interface FakeContact {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  listStatus: ActiveCampaignListStatus;
  tags: Set<string>;
}

function makeAc(seed: Record<string, Omit<FakeContact, "email">> = {}) {
  const contacts = new Map<string, FakeContact>();
  for (const [email, contact] of Object.entries(seed)) {
    contacts.set(email, { ...contact, email });
  }
  let nextId = 100;
  const spies = {
    syncContact: vi.fn(),
    subscribeToList: vi.fn(),
    addTag: vi.fn(),
    resolveTagId: vi.fn(),
    findContactByEmail: vi.fn(),
    getListStatus: vi.fn(),
  };

  const findById = (id: string): FakeContact | undefined =>
    [...contacts.values()].find((c) => c.id === id);

  const client: ActiveCampaignClient = {
    async listExists() {
      return true;
    },
    async findContactByEmail(email) {
      spies.findContactByEmail(email);
      const c = contacts.get(email);
      return c ? { id: c.id } : null;
    },
    async syncContact(input) {
      spies.syncContact(input);
      let c = contacts.get(input.email);
      if (!c) {
        c = {
          id: `ac_${nextId++}`,
          email: input.email,
          firstName: input.firstName,
          lastName: input.lastName,
          listStatus: "not_on_list",
          tags: new Set(),
        };
        contacts.set(input.email, c);
      } else {
        if (input.firstName) c.firstName = input.firstName;
        if (input.lastName) c.lastName = input.lastName;
      }
      return { id: c.id };
    },
    async getListStatus(contactId) {
      spies.getListStatus(contactId);
      return findById(contactId)?.listStatus ?? "not_on_list";
    },
    async subscribeToList(contactId) {
      spies.subscribeToList(contactId);
      const c = findById(contactId);
      if (c) c.listStatus = "active";
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

const baseEnv = {
  ACTIVECAMPAIGN_API_KEY: "test-key",
  ACTIVECAMPAIGN_BASE_URL: "https://knititnow.api-us1.com",
  ACTIVECAMPAIGN_KIN_LIST_ID: "2",
};

const SESSION_EMAIL = "member@example.com";

describe("checkAccountEmailSubscription", () => {
  it("reports an active subscriber without writing to ActiveCampaign", async () => {
    const ac = makeAc({
      [SESSION_EMAIL]: {
        id: "ac_1",
        firstName: "Ada",
        listStatus: "active",
        tags: new Set(),
      },
    });

    const result = await checkAccountEmailSubscription(SESSION_EMAIL, {
      env: baseEnv,
      createClient: () => ac.client,
    });

    expect(result).toEqual({
      ok: true,
      status: 200,
      state: "active",
      canResubscribe: false,
    });
    expect(ac.spies.subscribeToList).not.toHaveBeenCalled();
    expect(ac.spies.syncContact).not.toHaveBeenCalled();
    expect(ac.spies.addTag).not.toHaveBeenCalled();
  });

  it("reports an unsubscribed contact as eligible to resubscribe", async () => {
    const ac = makeAc({
      [SESSION_EMAIL]: {
        id: "ac_1",
        listStatus: "unsubscribed",
        tags: new Set(),
      },
    });

    const result = await checkAccountEmailSubscription(SESSION_EMAIL, {
      env: baseEnv,
      createClient: () => ac.client,
    });

    expect(result).toMatchObject({
      ok: true,
      state: "unsubscribed",
      canResubscribe: true,
    });
    expect(ac.spies.subscribeToList).not.toHaveBeenCalled();
  });

  it("reports contact not found without creating a contact", async () => {
    const ac = makeAc();
    const result = await checkAccountEmailSubscription(SESSION_EMAIL, {
      env: baseEnv,
      createClient: () => ac.client,
    });

    expect(result).toEqual({
      ok: true,
      status: 200,
      state: "not_found",
      canResubscribe: true,
    });
    expect(ac.spies.syncContact).not.toHaveBeenCalled();
    expect(ac.spies.subscribeToList).not.toHaveBeenCalled();
  });

  it("does not describe bounced contacts as a voluntary unsubscribe", async () => {
    const ac = makeAc({
      [SESSION_EMAIL]: {
        id: "ac_1",
        listStatus: "bounced",
        tags: new Set(),
      },
    });

    const result = await checkAccountEmailSubscription(SESSION_EMAIL, {
      env: baseEnv,
      createClient: () => ac.client,
    });

    expect(result).toMatchObject({
      ok: true,
      state: "bounced",
      canResubscribe: false,
    });
    const publicBody = toPublicAccountEmailSubscriptionStatus(result);
    expect(publicBody.state).toBe("bounced");
    expect(publicBody.state).not.toBe("unsubscribed");
  });

  it("distinguishes unconfirmed contacts from unsubscribed", async () => {
    const ac = makeAc({
      [SESSION_EMAIL]: {
        id: "ac_1",
        listStatus: "unconfirmed",
        tags: new Set(),
      },
    });

    const result = await checkAccountEmailSubscription(SESSION_EMAIL, {
      env: baseEnv,
      createClient: () => ac.client,
    });

    expect(result).toMatchObject({
      ok: true,
      state: "unconfirmed",
      canResubscribe: true,
    });
  });

  it("returns a temporary unavailable state when ActiveCampaign fails", async () => {
    const ac = makeAc();
    ac.client.findContactByEmail = async () => {
      throw new Error("ActiveCampaign contact lookup failed (HTTP 503): secret-body");
    };
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await checkAccountEmailSubscription(SESSION_EMAIL, {
      env: baseEnv,
      createClient: () => ac.client,
    });

    expect(result).toMatchObject({
      ok: false,
      status: 502,
      state: "unavailable",
      error: ACCOUNT_EMAIL_SUBSCRIPTION_MESSAGES.unavailable,
    });
    expect(JSON.stringify(result)).not.toMatch(/secret-body|test-key/i);
    spy.mockRestore();
  });

  it("uses only the session email and ignores a different address if one were passed in", async () => {
    const ac = makeAc({
      [SESSION_EMAIL]: {
        id: "ac_1",
        listStatus: "active",
        tags: new Set(),
      },
      "spoof@example.com": {
        id: "ac_spoof",
        listStatus: "unsubscribed",
        tags: new Set(),
      },
    });

    const result = await checkAccountEmailSubscription(SESSION_EMAIL, {
      env: baseEnv,
      createClient: () => ac.client,
    });

    expect(ac.spies.findContactByEmail).toHaveBeenCalledWith(SESSION_EMAIL);
    expect(ac.spies.findContactByEmail).not.toHaveBeenCalledWith("spoof@example.com");
    expect(result).toMatchObject({ state: "active" });
  });

  it("returns unavailable when the session has no usable email", async () => {
    const ac = makeAc();
    const result = await checkAccountEmailSubscription(" ", {
      env: baseEnv,
      createClient: () => ac.client,
    });
    expect(result).toMatchObject({
      ok: false,
      state: "unavailable",
      error: ACCOUNT_EMAIL_SUBSCRIPTION_MESSAGES.missingEmail,
    });
    expect(ac.spies.findContactByEmail).not.toHaveBeenCalled();
  });
});

describe("resubscribeAccountEmailSubscription", () => {
  it("resubscribes an unsubscribed contact and tags the explicit consent", async () => {
    const ac = makeAc({
      [SESSION_EMAIL]: {
        id: "ac_1",
        firstName: "Ada",
        lastName: "Lovelace",
        listStatus: "unsubscribed",
        tags: new Set(),
      },
    });

    const result = await resubscribeAccountEmailSubscription(
      SESSION_EMAIL,
      { firstName: "ShouldNotOverwrite", lastName: "Nope" },
      { env: baseEnv, createClient: () => ac.client },
    );

    expect(result).toEqual({
      ok: true,
      status: 200,
      state: "active",
      message: ACCOUNT_EMAIL_SUBSCRIPTION_MESSAGES.nowSubscribed,
    });
    expect(ac.spies.subscribeToList).toHaveBeenCalledTimes(1);
    expect(ac.spies.subscribeToList).toHaveBeenCalledWith("ac_1");
    expect(ac.spies.syncContact).not.toHaveBeenCalled();
    expect(ac.contacts.get(SESSION_EMAIL)?.firstName).toBe("Ada");
    expect(ac.contacts.get(SESSION_EMAIL)?.lastName).toBe("Lovelace");
    expect(ac.spies.resolveTagId).toHaveBeenCalledWith(ACCOUNT_EMAIL_SUBSCRIPTION_TAG, {
      create: true,
    });
    expect(ac.spies.addTag).toHaveBeenCalled();
  });

  it("creates a missing contact with the member name then subscribes", async () => {
    const ac = makeAc();
    const result = await resubscribeAccountEmailSubscription(
      SESSION_EMAIL,
      { firstName: "Ada", lastName: "Lovelace" },
      { env: baseEnv, createClient: () => ac.client },
    );

    expect(result.ok).toBe(true);
    expect(ac.spies.syncContact).toHaveBeenCalledWith({
      email: SESSION_EMAIL,
      firstName: "Ada",
      lastName: "Lovelace",
    });
    expect(ac.spies.subscribeToList).toHaveBeenCalledTimes(1);
    expect(ac.contacts.get(SESSION_EMAIL)?.listStatus).toBe("active");
  });

  it("does not change a bounced contact to active", async () => {
    const ac = makeAc({
      [SESSION_EMAIL]: {
        id: "ac_1",
        listStatus: "bounced",
        tags: new Set(),
      },
    });

    const result = await resubscribeAccountEmailSubscription(SESSION_EMAIL, {}, {
      env: baseEnv,
      createClient: () => ac.client,
    });

    expect(result).toMatchObject({
      ok: false,
      status: 409,
      state: "bounced",
      error: ACCOUNT_EMAIL_SUBSCRIPTION_MESSAGES.bouncedBlocked,
    });
    expect(ac.spies.subscribeToList).not.toHaveBeenCalled();
    expect(ac.contacts.get(SESSION_EMAIL)?.listStatus).toBe("bounced");
    const publicBody = toPublicAccountEmailSubscriptionResubscribe(result);
    expect(JSON.stringify(publicBody)).not.toMatch(/HTTP|Api-Token|contactLists/i);
  });

  it("returns a friendly error when ActiveCampaign fails", async () => {
    const ac = makeAc({
      [SESSION_EMAIL]: {
        id: "ac_1",
        listStatus: "unsubscribed",
        tags: new Set(),
      },
    });
    ac.client.subscribeToList = async () => {
      throw new Error("ActiveCampaign list subscribe failed (HTTP 500): secret-body");
    };
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await resubscribeAccountEmailSubscription(SESSION_EMAIL, {}, {
      env: baseEnv,
      createClient: () => ac.client,
    });

    expect(result).toMatchObject({
      ok: false,
      status: 502,
      error: ACCOUNT_EMAIL_SUBSCRIPTION_MESSAGES.genericFailure,
    });
    expect(JSON.stringify(result)).not.toMatch(/secret-body|test-key/i);
    spy.mockRestore();
  });

  it("does not look up a client-supplied spoof email", async () => {
    const ac = makeAc({
      [SESSION_EMAIL]: {
        id: "ac_1",
        listStatus: "unsubscribed",
        tags: new Set(),
      },
      "spoof@example.com": {
        id: "ac_spoof",
        listStatus: "unsubscribed",
        tags: new Set(),
      },
    });

    await resubscribeAccountEmailSubscription(SESSION_EMAIL, {}, {
      env: baseEnv,
      createClient: () => ac.client,
    });

    expect(ac.spies.findContactByEmail).toHaveBeenCalledWith(SESSION_EMAIL);
    expect(ac.spies.findContactByEmail).not.toHaveBeenCalledWith("spoof@example.com");
    expect(ac.spies.subscribeToList).toHaveBeenCalledWith("ac_1");
    expect(ac.spies.subscribeToList).not.toHaveBeenCalledWith("ac_spoof");
  });
});

describe("namesFromMemberstackRecord", () => {
  it("reads first and last name from Memberstack custom fields", () => {
    expect(
      namesFromMemberstackRecord({
        customFields: { "first-name": " Ada ", "last-name": " Lovelace " },
      }),
    ).toEqual({ firstName: "Ada", lastName: "Lovelace" });
  });
});
