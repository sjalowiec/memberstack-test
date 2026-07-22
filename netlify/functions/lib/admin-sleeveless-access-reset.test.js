import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * In-memory Memberstack admin double. Keyed by member id; lookups resolve by id OR email so the
 * handler's "lookup then reset by id" path is exercised end to end without any network.
 */
const memberStore = new Map();

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

vi.mock("./memberstack-admin.js", () => {
  return {
    isLookupDebugEnabled: () => false,
    maskEmailForLog: (email) => String(email ?? "(no-email)"),
    describeSecretKeyEnvironment: () => ({ mode: "test", keyHint: "mock" }),
    getMemberstackAdminClient: () => ({
      async getMember(idOrEmail) {
        for (const member of memberStore.values()) {
          if (member.id === idOrEmail || member?.auth?.email === idOrEmail) {
            return clone(member);
          }
        }
        return null;
      },
      async updateMemberJson(memberId, json) {
        const member = memberStore.get(memberId);
        if (!member) throw new Error("member not found");
        member.json = clone(json);
        return clone(member);
      },
    }),
  };
});

// Identity from Bearer JWT only (never X-KBM-Member-Id). Token value = member id in these tests.
vi.mock("./require-member-access.js", () => ({
  resolveVerifiedProjectUserId: async (req) => {
    const header = req.headers.get("authorization") || "";
    const match = header.match(/^Bearer\s+(.+)$/i);
    if (!match) return { error: "Sign in required.", status: 401 };
    return { userId: match[1].trim(), mode: "member" };
  },
}));

import handler from "../admin-sleeveless-access-reset.js";

const ADMIN_ID = "mem_admin";
const ADMIN_EMAIL = "admin@knitbymachine.com";
const MEMBER_ID = "mem_regular";
const TARGET_ID = "mem_target_123";
const TARGET_EMAIL = "knitter@example.com";

const ENV_KEYS = [
  "NODE_ENV",
  "CONTEXT",
  "ALLOW_DEV_PATTERN_USER",
  "PATTERN_ACTIVITY_ADMIN_MEMBER_IDS",
  "PATTERN_ACTIVITY_ADMIN_EMAILS",
  "MEMBERSTACK_SECRET_KEY",
];

let savedEnv = {};

function makeReq(method, { memberId, email, body, query } = {}) {
  const headers = {};
  if (memberId) headers.authorization = `Bearer ${memberId}`;
  if (email) headers["x-kbm-member-email"] = email;
  if (body) headers["content-type"] = "application/json";
  const url = `https://site.test/.netlify/functions/admin-sleeveless-access-reset${query ? `?${query}` : ""}`;
  return new Request(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
}

function seedTargetMember(json) {
  memberStore.set(TARGET_ID, {
    id: TARGET_ID,
    auth: { email: TARGET_EMAIL },
    customFields: { "first-name": "Pat", "last-name": "Knitter" },
    json: clone(json),
  });
}

beforeEach(() => {
  memberStore.clear();
  savedEnv = {};
  for (const key of ENV_KEYS) savedEnv[key] = process.env[key];
  // Production-like: disables the local-dev admin bypass so the allowlist is exercised.
  process.env.NODE_ENV = "production";
  process.env.CONTEXT = "production";
  delete process.env.ALLOW_DEV_PATTERN_USER;
  delete process.env.PATTERN_ACTIVITY_ADMIN_MEMBER_IDS;
  delete process.env.PATTERN_ACTIVITY_ADMIN_EMAILS;
  process.env.PATTERN_ACTIVITY_ADMIN_MEMBER_IDS = ADMIN_ID;
  process.env.PATTERN_ACTIVITY_ADMIN_EMAILS = ADMIN_EMAIL;
  process.env.MEMBERSTACK_SECRET_KEY = "sk_sb_test_key";
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (savedEnv[key] === undefined) delete process.env[key];
    else process.env[key] = savedEnv[key];
  }
});

describe("admin-sleeveless-access-reset — access control", () => {
  it("returns 401 when no member id / not signed in", async () => {
    const res = await handler(makeReq("GET", { query: `email=${encodeURIComponent(TARGET_EMAIL)}` }));
    expect(res.status).toBe(401);
  });

  it("returns 403 for a signed-in non-admin", async () => {
    seedTargetMember({ freeSleevelessPatternClaimed: true });
    const res = await handler(
      makeReq("GET", {
        memberId: MEMBER_ID,
        query: `email=${encodeURIComponent(TARGET_EMAIL)}`,
      }),
    );
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.ok).toBe(false);
  });

  it("allows an admin via the member id allowlist", async () => {
    seedTargetMember({ freeSleevelessPatternClaimed: false });
    const res = await handler(
      makeReq("GET", {
        memberId: ADMIN_ID,
        query: `email=${encodeURIComponent(TARGET_EMAIL)}`,
      }),
    );
    expect(res.status).toBe(200);
  });

  it("allows an admin via the email allowlist", async () => {
    seedTargetMember({ freeSleevelessPatternClaimed: false });
    const res = await handler(
      makeReq("GET", {
        memberId: "mem_someone",
        email: ADMIN_EMAIL,
        query: `email=${encodeURIComponent(TARGET_EMAIL)}`,
      }),
    );
    expect(res.status).toBe(200);
  });
});

describe("admin-sleeveless-access-reset — lookup", () => {
  it("returns 400 when the email is missing", async () => {
    const res = await handler(makeReq("GET", { memberId: ADMIN_ID }));
    expect(res.status).toBe(400);
  });

  it("returns 404 when the member is not found", async () => {
    const res = await handler(
      makeReq("GET", {
        memberId: ADMIN_ID,
        query: `email=${encodeURIComponent("missing@example.com")}`,
      }),
    );
    expect(res.status).toBe(404);
  });

  it("returns only safe support fields, never the full member JSON", async () => {
    seedTargetMember({
      freeSleevelessPatternClaimed: true,
      freeSleevelessPatternId: "pat_abc",
      secretNote: "do-not-leak",
      theme: "dark",
    });
    const res = await handler(
      makeReq("GET", {
        memberId: ADMIN_ID,
        query: `email=${encodeURIComponent(TARGET_EMAIL)}`,
      }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.member).toEqual({
      memberId: TARGET_ID,
      email: TARGET_EMAIL,
      name: "Pat Knitter",
      freeSleevelessPatternClaimed: true,
      freeSleevelessPatternId: "pat_abc",
      hasMemberJson: true,
    });
    // The raw JSON blob and its unrelated keys must never be exposed.
    const serialized = JSON.stringify(body);
    expect(serialized).not.toContain("secretNote");
    expect(serialized).not.toContain("do-not-leak");
    expect(body.member.json).toBeUndefined();
  });
});

describe("admin-sleeveless-access-reset — reset", () => {
  it("returns 400 when neither email nor memberId is provided", async () => {
    const res = await handler(
      makeReq("POST", { memberId: ADMIN_ID, body: { action: "reset" } }),
    );
    expect(res.status).toBe(400);
  });

  it("returns 404 when resetting a member that does not exist", async () => {
    const res = await handler(
      makeReq("POST", {
        memberId: ADMIN_ID,
        body: { action: "reset", memberId: "mem_nope" },
      }),
    );
    expect(res.status).toBe(404);
  });

  it("clears the two claim keys and preserves unrelated JSON keys", async () => {
    seedTargetMember({
      freeSleevelessPatternClaimed: true,
      freeSleevelessPatternId: "pat_abc",
      sleevelessPatternSystemUnlocked: true,
      theme: "dark",
      nested: { a: 1 },
    });

    const res = await handler(
      makeReq("POST", {
        memberId: ADMIN_ID,
        body: { action: "reset", memberId: TARGET_ID },
      }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.reset).toBe(true);
    expect(body.member.freeSleevelessPatternClaimed).toBe(false);
    expect(body.member.freeSleevelessPatternId).toBeNull();

    // The stored JSON should keep everything else and only flip the two claim keys.
    const storedJson = memberStore.get(TARGET_ID).json;
    expect(storedJson).toEqual({
      freeSleevelessPatternClaimed: false,
      freeSleevelessPatternId: null,
      sleevelessPatternSystemUnlocked: true,
      theme: "dark",
      nested: { a: 1 },
    });
  });

  it("can resolve the member by email then reset by id", async () => {
    seedTargetMember({ freeSleevelessPatternClaimed: true, freeSleevelessPatternId: "pat_x" });
    const res = await handler(
      makeReq("POST", {
        memberId: ADMIN_ID,
        body: { action: "reset", email: TARGET_EMAIL },
      }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.member.freeSleevelessPatternClaimed).toBe(false);
    expect(memberStore.get(TARGET_ID).json.freeSleevelessPatternClaimed).toBe(false);
  });

  it("returns 403 for a non-admin attempting a reset", async () => {
    seedTargetMember({ freeSleevelessPatternClaimed: true });
    const res = await handler(
      makeReq("POST", {
        memberId: MEMBER_ID,
        body: { action: "reset", memberId: TARGET_ID },
      }),
    );
    expect(res.status).toBe(403);
    // The claim must remain untouched.
    expect(memberStore.get(TARGET_ID).json.freeSleevelessPatternClaimed).toBe(true);
  });
});
