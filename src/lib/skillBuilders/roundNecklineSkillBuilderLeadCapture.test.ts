import { describe, expect, it, vi } from "vitest";
import type { ActiveCampaignClient } from "../activecampaign/client";
import { EMAIL_LIST_SIGNUP_EXPECTED_HOST } from "../email/emailListSignup";
import {
  handleRoundNecklineSkillBuilderLeadRequest,
  resolveRoundNecklineLeadActiveCampaignConfig,
  toPublicRoundNecklineLeadResponse,
  ROUND_NECKLINE_SKILL_BUILDER_AC_DEFAULT_HOST,
  ROUND_NECKLINE_SKILL_BUILDER_LEAD_MESSAGES,
  ROUND_NECKLINE_SKILL_BUILDER_LEAD_TAG,
} from "./roundNecklineSkillBuilderLeadCapture";

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

describe("handleRoundNecklineSkillBuilderLeadRequest", () => {
  it("requires a valid email and does not require a first name", async () => {
    const ac = makeAc();
    const missing = await handleRoundNecklineSkillBuilderLeadRequest(
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
      error: ROUND_NECKLINE_SKILL_BUILDER_LEAD_MESSAGES.invalidEmail,
    });
    expect(ac.spies.syncContact).not.toHaveBeenCalled();
  });

  it("creates a new contact and applies the Skill Builder lead tag", async () => {
    const ac = makeAc();
    const result = await handleRoundNecklineSkillBuilderLeadRequest(
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
      message: ROUND_NECKLINE_SKILL_BUILDER_LEAD_MESSAGES.success,
    });
    expect(ac.spies.syncContact).toHaveBeenCalledWith({ email: "ada@example.com" });
    expect(ac.spies.resolveTagId).toHaveBeenCalledWith(
      ROUND_NECKLINE_SKILL_BUILDER_LEAD_TAG,
      { create: true },
    );
    expect(ac.spies.addTag).toHaveBeenCalledWith(
      expect.any(String),
      `tag_${ROUND_NECKLINE_SKILL_BUILDER_LEAD_TAG}`,
    );
    expect(ac.spies.subscribeToList).not.toHaveBeenCalled();
    expect(ac.contacts.get("ada@example.com")?.tags.has(
      `tag_${ROUND_NECKLINE_SKILL_BUILDER_LEAD_TAG}`,
    )).toBe(true);
  });

  it("updates an existing contact and applies the tag when missing", async () => {
    const ac = makeAc({
      "ada@example.com": {
        id: "ac_1",
        tags: new Set(),
      },
    });

    const result = await handleRoundNecklineSkillBuilderLeadRequest(
      { email: "ada@example.com", firstName: "Ada" },
      {
        env: baseEnv,
        createClient: () => ac.client,
        rateLimitStore: new Map(),
        clientIp: "1.1.1.3",
      },
    );

    expect(result).toMatchObject({
      ok: true,
      outcome: "created_and_tagged",
    });
    expect(ac.contacts.size).toBe(1);
    expect(ac.spies.syncContact).toHaveBeenCalledWith({
      email: "ada@example.com",
      firstName: "Ada",
    });
    expect(ac.spies.addTag).toHaveBeenCalledWith(
      "ac_1",
      `tag_${ROUND_NECKLINE_SKILL_BUILDER_LEAD_TAG}`,
    );
  });

  it("updates the same contact when the same email submits from another browser or device", async () => {
    const ac = makeAc();
    const sharedStore = new Map();

    const first = await handleRoundNecklineSkillBuilderLeadRequest(
      { email: "ada@example.com", firstName: "Ada" },
      {
        env: baseEnv,
        createClient: () => ac.client,
        rateLimitStore: sharedStore,
        clientIp: "203.0.113.10",
      },
    );
    expect(first).toMatchObject({ ok: true, outcome: "created_and_tagged" });
    const contactId = ac.contacts.get("ada@example.com")?.id;
    expect(contactId).toBeTruthy();

    const second = await handleRoundNecklineSkillBuilderLeadRequest(
      { email: "Ada@Example.com", firstName: "Adaline" },
      {
        env: baseEnv,
        createClient: () => ac.client,
        rateLimitStore: sharedStore,
        clientIp: "198.51.100.20",
      },
    );

    expect(second).toMatchObject({ ok: true, outcome: "already_tagged" });
    expect(ac.contacts.size).toBe(1);
    expect(ac.contacts.get("ada@example.com")?.id).toBe(contactId);
    expect(ac.contacts.get("ada@example.com")?.firstName).toBe("Adaline");
    expect(ac.spies.syncContact).toHaveBeenCalledTimes(2);
    expect(ac.spies.addTag).toHaveBeenCalledTimes(1);
    expect(ac.spies.addTag).toHaveBeenCalledWith(
      contactId,
      `tag_${ROUND_NECKLINE_SKILL_BUILDER_LEAD_TAG}`,
    );
  });

  it("does not re-apply the tag when the contact already has it", async () => {
    const ac = makeAc({
      "ada@example.com": {
        id: "ac_1",
        tags: new Set([`tag_${ROUND_NECKLINE_SKILL_BUILDER_LEAD_TAG}`]),
      },
    });

    const result = await handleRoundNecklineSkillBuilderLeadRequest(
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

  it("still allows practice when ActiveCampaign fails and does not leak internals", async () => {
    const ac = makeAc();
    ac.client.syncContact = async () => {
      throw new Error("ActiveCampaign contact sync failed (HTTP 503): secret-body");
    };

    const result = await handleRoundNecklineSkillBuilderLeadRequest(
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
      message: ROUND_NECKLINE_SKILL_BUILDER_LEAD_MESSAGES.success,
    });
    const publicBody = toPublicRoundNecklineLeadResponse(result);
    expect(publicBody).toEqual({
      ok: true,
      message: ROUND_NECKLINE_SKILL_BUILDER_LEAD_MESSAGES.success,
    });
    expect(JSON.stringify(publicBody)).not.toMatch(/503|secret-body|Api-Token|test-key/i);
  });

  it("still allows practice when ActiveCampaign config is missing", async () => {
    const ac = makeAc();
    const result = await handleRoundNecklineSkillBuilderLeadRequest(
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
    const resolved = resolveRoundNecklineLeadActiveCampaignConfig(
      {
        ACTIVECAMPAIGN_API_KEY: "test-key",
      },
      { readAstroEnv: false },
    );
    expect(resolved.config).toEqual({
      apiKey: "test-key",
      baseUrl: `https://${ROUND_NECKLINE_SKILL_BUILDER_AC_DEFAULT_HOST}`,
    });
    expect(resolved.baseUrlSource).toBe("default");
    expect(resolved.hostname).toBe(ROUND_NECKLINE_SKILL_BUILDER_AC_DEFAULT_HOST);
  });

  it("returns a decoy success for honeypot submissions without calling ActiveCampaign", async () => {
    const ac = makeAc();
    const result = await handleRoundNecklineSkillBuilderLeadRequest(
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

  it("does not expose ActiveCampaign credentials or tag IDs in the public response", async () => {
    const ac = makeAc();
    const result = await handleRoundNecklineSkillBuilderLeadRequest(
      { email: "ada@example.com" },
      {
        env: baseEnv,
        createClient: () => ac.client,
        rateLimitStore: new Map(),
        clientIp: "1.1.1.7",
      },
    );
    const publicBody = toPublicRoundNecklineLeadResponse(result);
    expect(publicBody).toEqual({
      ok: true,
      message: ROUND_NECKLINE_SKILL_BUILDER_LEAD_MESSAGES.success,
    });
    expect(JSON.stringify(publicBody)).not.toMatch(/tag_|ACTIVECAMPAIGN|Api-Token|outcome/i);
  });
});
