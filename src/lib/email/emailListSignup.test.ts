import { describe, expect, it, vi } from "vitest";
import type {
  ActiveCampaignClient,
  ActiveCampaignListStatus,
} from "../activecampaign/client";
import {
  checkActiveCampaignSignupHostname,
  EMAIL_LIST_SIGNUP_DASHBOARD_HOST,
  EMAIL_LIST_SIGNUP_EXPECTED_HOST,
  EMAIL_LIST_SIGNUP_MESSAGES,
  EMAIL_LIST_SIGNUP_RETIRED_HOST,
  EMAIL_LIST_SIGNUP_SOURCE_TAG,
  handleEmailListSignupRequest,
  toPublicEmailListSignupResponse,
} from "./emailListSignup";

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
        c = {
          id: `ac_${nextId++}`,
          firstName: input.firstName,
          listStatus: "not_on_list",
          tags: new Set(),
        };
        contacts.set(input.email, c);
      } else if (input.firstName) {
        c.firstName = input.firstName;
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
  ACTIVECAMPAIGN_BASE_URL: `https://${EMAIL_LIST_SIGNUP_EXPECTED_HOST}`,
  ACTIVECAMPAIGN_KIN_LIST_ID: "2",
};

describe("checkActiveCampaignSignupHostname", () => {
  it("accepts the Knit It Now ActiveCampaign Admin API host", () => {
    expect(
      checkActiveCampaignSignupHostname(
        `https://${EMAIL_LIST_SIGNUP_EXPECTED_HOST}`,
      ),
    ).toEqual({ ok: true, hostname: EMAIL_LIST_SIGNUP_EXPECTED_HOST });
    expect(EMAIL_LIST_SIGNUP_EXPECTED_HOST).toBe("knititnow.api-us1.com");
  });

  it("rejects the retired Knit By Machine host", () => {
    expect(
      checkActiveCampaignSignupHostname(
        `https://${EMAIL_LIST_SIGNUP_RETIRED_HOST}`,
      ),
    ).toEqual({
      ok: false,
      hostname: EMAIL_LIST_SIGNUP_RETIRED_HOST,
      reason: "retired_host",
    });
  });

  it("rejects the dashboard host — API base URL must be api-us1, not activehosted", () => {
    expect(
      checkActiveCampaignSignupHostname(
        `https://${EMAIL_LIST_SIGNUP_DASHBOARD_HOST}`,
      ),
    ).toEqual({
      ok: false,
      hostname: EMAIL_LIST_SIGNUP_DASHBOARD_HOST,
      reason: "unexpected_host",
    });
  });
});

describe("handleEmailListSignupRequest", () => {
  it("requires first name and a valid email", async () => {
    const ac = makeAc();
    const missingName = await handleEmailListSignupRequest(
      { firstName: "  ", email: "ada@example.com" },
      {
        env: baseEnv,
        createClient: () => ac.client,
        rateLimitStore: new Map(),
        clientIp: "1.1.1.1",
      },
    );
    expect(missingName).toMatchObject({
      ok: false,
      status: 400,
      error: EMAIL_LIST_SIGNUP_MESSAGES.invalidFirstName,
    });

    const badEmail = await handleEmailListSignupRequest(
      { firstName: "Ada", email: "not-an-email" },
      {
        env: baseEnv,
        createClient: () => ac.client,
        rateLimitStore: new Map(),
        clientIp: "1.1.1.2",
      },
    );
    expect(badEmail).toMatchObject({
      ok: false,
      status: 400,
      error: EMAIL_LIST_SIGNUP_MESSAGES.invalidEmail,
    });
  });

  it("rejects unreasonable field lengths", async () => {
    const ac = makeAc();
    const result = await handleEmailListSignupRequest(
      {
        firstName: "A".repeat(81),
        email: "ada@example.com",
      },
      {
        env: baseEnv,
        createClient: () => ac.client,
        rateLimitStore: new Map(),
        clientIp: "1.1.1.3",
      },
    );
    expect(result).toMatchObject({
      ok: false,
      status: 400,
      error: EMAIL_LIST_SIGNUP_MESSAGES.fieldTooLong,
    });
  });

  it("creates a new contact, subscribes, and applies the source tag", async () => {
    const ac = makeAc();
    const result = await handleEmailListSignupRequest(
      { firstName: "Ada", email: "ada@example.com" },
      {
        env: baseEnv,
        createClient: () => ac.client,
        rateLimitStore: new Map(),
        clientIp: "1.1.1.4",
      },
    );

    expect(result).toMatchObject({
      ok: true,
      messageKey: "subscribed",
      outcome: "created_and_subscribed",
      message: EMAIL_LIST_SIGNUP_MESSAGES.subscribed,
    });
    expect(ac.spies.syncContact).toHaveBeenCalledWith({
      email: "ada@example.com",
      firstName: "Ada",
    });
    expect(ac.spies.subscribeToList).toHaveBeenCalledTimes(1);
    expect(ac.spies.resolveTagId).toHaveBeenCalledWith(
      EMAIL_LIST_SIGNUP_SOURCE_TAG,
      { create: true },
    );
    expect(ac.spies.addTag).toHaveBeenCalled();
  });

  it("updates an existing contact without creating a duplicate and subscribes when not on list", async () => {
    const ac = makeAc({
      "ada@example.com": {
        id: "ac_1",
        firstName: "Old",
        listStatus: "not_on_list",
        tags: new Set(),
      },
    });

    const result = await handleEmailListSignupRequest(
      { firstName: "Ada", email: "ada@example.com" },
      {
        env: baseEnv,
        createClient: () => ac.client,
        rateLimitStore: new Map(),
        clientIp: "1.1.1.5",
      },
    );

    expect(result).toMatchObject({
      ok: true,
      messageKey: "subscribed",
      outcome: "subscribed_existing",
    });
    expect(ac.contacts.size).toBe(1);
    expect(ac.contacts.get("ada@example.com")?.firstName).toBe("Ada");
    expect(ac.spies.subscribeToList).toHaveBeenCalledWith("ac_1");
  });

  it("returns the neutral already message for an active subscriber and does not re-subscribe", async () => {
    const ac = makeAc({
      "ada@example.com": {
        id: "ac_1",
        firstName: "Ada",
        listStatus: "active",
        tags: new Set(),
      },
    });

    const result = await handleEmailListSignupRequest(
      { firstName: "Ada", email: "ada@example.com" },
      {
        env: baseEnv,
        createClient: () => ac.client,
        rateLimitStore: new Map(),
        clientIp: "1.1.1.6",
      },
    );

    expect(result).toMatchObject({
      ok: true,
      messageKey: "already",
      outcome: "already_subscribed",
      message: EMAIL_LIST_SIGNUP_MESSAGES.already,
    });
    expect(ac.spies.subscribeToList).not.toHaveBeenCalled();
    expect(ac.spies.addTag).toHaveBeenCalled();
  });

  it("does not silently resubscribe a previously unsubscribed contact", async () => {
    const ac = makeAc({
      "ada@example.com": {
        id: "ac_1",
        firstName: "Ada",
        listStatus: "unsubscribed",
        tags: new Set(),
      },
    });

    const result = await handleEmailListSignupRequest(
      { firstName: "Ada", email: "ada@example.com" },
      {
        env: baseEnv,
        createClient: () => ac.client,
        rateLimitStore: new Map(),
        clientIp: "1.1.1.7",
      },
    );

    expect(result).toMatchObject({
      ok: true,
      messageKey: "already",
      outcome: "skipped_unsubscribed",
      message: EMAIL_LIST_SIGNUP_MESSAGES.already,
    });
    expect(ac.spies.subscribeToList).not.toHaveBeenCalled();
    expect(ac.spies.addTag).not.toHaveBeenCalled();
    expect(ac.contacts.get("ada@example.com")?.listStatus).toBe("unsubscribed");

    const publicBody = toPublicEmailListSignupResponse(result);
    expect(publicBody).toEqual({
      ok: true,
      message: EMAIL_LIST_SIGNUP_MESSAGES.already,
    });
    expect(JSON.stringify(publicBody)).not.toMatch(/unsubscribed/i);
  });

  it("returns a decoy success for honeypot submissions", async () => {
    const ac = makeAc();
    const result = await handleEmailListSignupRequest(
      {
        firstName: "Ada",
        email: "ada@example.com",
        "bot-field": "spam-bot",
      },
      {
        env: baseEnv,
        createClient: () => ac.client,
        rateLimitStore: new Map(),
        clientIp: "1.1.1.8",
      },
    );

    expect(result).toMatchObject({
      ok: true,
      outcome: "honeypot",
      messageKey: "already",
    });
    expect(ac.spies.syncContact).not.toHaveBeenCalled();
  });

  it("rate-limits repeated submissions from the same IP with a decoy success", async () => {
    const ac = makeAc();
    const store = new Map();
    const opts = {
      env: baseEnv,
      createClient: () => ac.client,
      rateLimitStore: store,
      clientIp: "9.9.9.9",
      now: 1_000_000,
    };

    for (let i = 0; i < 5; i += 1) {
      const result = await handleEmailListSignupRequest(
        { firstName: "Ada", email: `ada${i}@example.com` },
        opts,
      );
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.outcome).not.toBe("rate_limited");
      }
    }

    const limited = await handleEmailListSignupRequest(
      { firstName: "Ada", email: "ada6@example.com" },
      opts,
    );
    expect(limited).toMatchObject({
      ok: true,
      outcome: "rate_limited",
      messageKey: "already",
    });
  });

  it("returns a safe generic message when ActiveCampaign fails", async () => {
    const ac = makeAc();
    ac.client.findContactByEmail = async () => {
      throw new Error("ActiveCampaign contact lookup failed (HTTP 500): secret-body");
    };

    const result = await handleEmailListSignupRequest(
      { firstName: "Ada", email: "ada@example.com" },
      {
        env: baseEnv,
        createClient: () => ac.client,
        rateLimitStore: new Map(),
        clientIp: "1.1.1.9",
      },
    );

    expect(result).toMatchObject({
      ok: false,
      status: 502,
      error: EMAIL_LIST_SIGNUP_MESSAGES.genericFailure,
    });
    expect(JSON.stringify(result)).not.toContain("secret-body");
    expect(JSON.stringify(result)).not.toContain("ada@example.com");
  });

  it("fails safely when the ActiveCampaign hostname is the retired host", async () => {
    const ac = makeAc();
    const result = await handleEmailListSignupRequest(
      { firstName: "Ada", email: "ada@example.com" },
      {
        env: {
          ...baseEnv,
          ACTIVECAMPAIGN_BASE_URL: `https://${EMAIL_LIST_SIGNUP_RETIRED_HOST}`,
        },
        createClient: () => ac.client,
        rateLimitStore: new Map(),
        clientIp: "1.1.1.10",
      },
    );

    expect(result).toMatchObject({
      ok: false,
      status: 500,
      error: EMAIL_LIST_SIGNUP_MESSAGES.genericFailure,
    });
    expect(ac.spies.syncContact).not.toHaveBeenCalled();
  });
});
