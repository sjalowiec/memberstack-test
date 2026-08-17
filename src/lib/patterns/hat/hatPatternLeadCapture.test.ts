import { describe, expect, it, vi } from "vitest";
import type { ActiveCampaignClient } from "../../activecampaign/client";
import { EMAIL_LIST_SIGNUP_EXPECTED_HOST } from "../../email/emailListSignup";
import {
  handleHatPatternLeadRequest,
  resolveHatPatternLeadActiveCampaignConfig,
  toPublicHatPatternLeadResponse,
  HAT_PATTERN_LEAD_AC_DEFAULT_HOST,
  HAT_PATTERN_LEAD_MESSAGES,
  HAT_PATTERN_LEAD_TAG,
} from "./hatPatternLeadCapture";

interface FakeContact {
  id: string;
  firstName?: string;
  tags: Set<string>;
}

function emailKey(email: string): string {
  return email.trim().toLowerCase();
}

function makeAc(seed: Record<string, FakeContact> = {}) {
  const contacts = new Map<string, FakeContact>(
    Object.entries(seed).map(([email, contact]) => [emailKey(email), contact]),
  );
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
      const c = contacts.get(emailKey(email));
      return c ? { id: c.id } : null;
    },
    async syncContact(input) {
      spies.syncContact(input);
      const key = emailKey(input.email);
      let c = contacts.get(key);
      if (!c) {
        c = {
          id: `ac_${nextId++}`,
          firstName: input.firstName,
          tags: new Set(),
        };
        contacts.set(key, c);
      } else if (input.firstName) {
        c.firstName = input.firstName;
      }
      return { id: c.id };
    },
    async getListStatus() {
      return "not_on_list";
    },
    async subscribeToList(contactId) {
      spies.subscribeToList(contactId);
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
};

describe("handleHatPatternLeadRequest", () => {
  it("requires a valid email and does not require a first name", async () => {
    const ac = makeAc();
    const missing = await handleHatPatternLeadRequest(
      { email: "  " },
      {
        env: baseEnv,
        createClient: () => ac.client,
        rateLimitStore: new Map(),
        clientIp: "1.1.1.1",
      },
    );
    expect(missing).toMatchObject({
      ok: false,
      status: 400,
      error: HAT_PATTERN_LEAD_MESSAGES.invalidEmail,
    });
    expect(ac.spies.syncContact).not.toHaveBeenCalled();
  });

  it("creates a new contact and applies exactly the Hat Pattern lead tag", async () => {
    const ac = makeAc();
    const result = await handleHatPatternLeadRequest(
      { email: "ada@example.com" },
      {
        env: baseEnv,
        createClient: () => ac.client,
        rateLimitStore: new Map(),
        clientIp: "1.1.1.2",
      },
    );

    expect(result).toMatchObject({
      ok: true,
      outcome: "created_and_tagged",
      message: HAT_PATTERN_LEAD_MESSAGES.success,
    });
    expect(ac.spies.syncContact).toHaveBeenCalledWith({ email: "ada@example.com" });
    expect(ac.spies.resolveTagId).toHaveBeenCalledWith(HAT_PATTERN_LEAD_TAG, {
      create: true,
    });
    expect(HAT_PATTERN_LEAD_TAG).toBe("lead: Hat Pattern");
    expect(ac.spies.addTag).toHaveBeenCalledWith(
      expect.any(String),
      `tag_${HAT_PATTERN_LEAD_TAG}`,
    );
    expect(ac.spies.subscribeToList).not.toHaveBeenCalled();
  });

  it("does not re-apply the tag when the contact already has it", async () => {
    const ac = makeAc({
      "ada@example.com": {
        id: "ac_1",
        tags: new Set([`tag_${HAT_PATTERN_LEAD_TAG}`]),
      },
    });

    const result = await handleHatPatternLeadRequest(
      { email: "ada@example.com" },
      {
        env: baseEnv,
        createClient: () => ac.client,
        rateLimitStore: new Map(),
        clientIp: "1.1.1.4",
      },
    );

    expect(result).toMatchObject({
      ok: true,
      outcome: "already_tagged",
    });
    expect(ac.spies.addTag).not.toHaveBeenCalled();
  });

  it("still allows the pattern when ActiveCampaign fails and does not leak internals", async () => {
    const ac = makeAc();
    ac.client.syncContact = async () => {
      throw new Error("ActiveCampaign contact sync failed (HTTP 503): secret-body");
    };

    const result = await handleHatPatternLeadRequest(
      { email: "ada@example.com" },
      {
        env: baseEnv,
        createClient: () => ac.client,
        rateLimitStore: new Map(),
        clientIp: "1.1.1.5",
      },
    );

    expect(result).toMatchObject({
      ok: true,
      outcome: "ac_unavailable",
      message: HAT_PATTERN_LEAD_MESSAGES.success,
    });
    const publicBody = toPublicHatPatternLeadResponse(result);
    expect(publicBody).toEqual({
      ok: true,
      message: HAT_PATTERN_LEAD_MESSAGES.success,
    });
    expect(JSON.stringify(publicBody)).not.toMatch(/503|secret-body|Api-Token|test-key|outcome/i);
  });

  it("still allows the pattern when ActiveCampaign config is missing", async () => {
    const ac = makeAc();
    const result = await handleHatPatternLeadRequest(
      { email: "ada@example.com" },
      {
        env: {},
        createClient: () => ac.client,
        rateLimitStore: new Map(),
        clientIp: "1.1.1.8",
      },
    );

    expect(result).toMatchObject({
      ok: true,
      outcome: "ac_unavailable",
    });
    expect(ac.spies.syncContact).not.toHaveBeenCalled();
  });

  it("uses the known Admin API host when only the API key is configured", () => {
    const resolved = resolveHatPatternLeadActiveCampaignConfig(
      {
        ACTIVECAMPAIGN_API_KEY: "test-key",
      },
      { readAstroEnv: false },
    );
    expect(resolved.config).toEqual({
      apiKey: "test-key",
      baseUrl: `https://${HAT_PATTERN_LEAD_AC_DEFAULT_HOST}`,
    });
    expect(resolved.baseUrlSource).toBe("default");
    expect(resolved.hostname).toBe(HAT_PATTERN_LEAD_AC_DEFAULT_HOST);
  });

  it("returns a decoy success for honeypot submissions without calling ActiveCampaign", async () => {
    const ac = makeAc();
    const result = await handleHatPatternLeadRequest(
      { email: "ada@example.com", "bot-field": "spam-bot" },
      {
        env: baseEnv,
        createClient: () => ac.client,
        rateLimitStore: new Map(),
        clientIp: "1.1.1.6",
      },
    );

    expect(result).toMatchObject({
      ok: true,
      outcome: "honeypot",
    });
    expect(ac.spies.syncContact).not.toHaveBeenCalled();
    expect(ac.spies.addTag).not.toHaveBeenCalled();
  });

  it("returns a decoy success when the IP is rate limited", async () => {
    const ac = makeAc();
    const store = new Map();
    const now = 1_700_000_000_000;
    let last;
    for (let i = 0; i < 6; i++) {
      last = await handleHatPatternLeadRequest(
        { email: "ada@example.com" },
        {
          env: baseEnv,
          createClient: () => ac.client,
          rateLimitStore: store,
          clientIp: "203.0.113.9",
          now,
        },
      );
    }
    expect(last).toMatchObject({
      ok: true,
      outcome: "rate_limited",
    });
  });

  it("does not expose ActiveCampaign credentials or tag IDs in the public response", async () => {
    const ac = makeAc();
    const result = await handleHatPatternLeadRequest(
      { email: "ada@example.com" },
      {
        env: baseEnv,
        createClient: () => ac.client,
        rateLimitStore: new Map(),
        clientIp: "1.1.1.7",
      },
    );
    const publicBody = toPublicHatPatternLeadResponse(result);
    expect(publicBody).toEqual({
      ok: true,
      message: HAT_PATTERN_LEAD_MESSAGES.success,
    });
    expect(JSON.stringify(publicBody)).not.toMatch(/tag_|ACTIVECAMPAIGN|Api-Token|outcome/i);
  });
});
