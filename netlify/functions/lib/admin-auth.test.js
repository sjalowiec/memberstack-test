import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./memberstack-admin.js", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    getMemberstackAdminClient: vi.fn(),
    getMemberstackAdminClientForMemberId: vi.fn(),
    resolveMemberstackAdminSecret: vi.fn(() => ({
      secretKey: "sk_test_secret",
      mode: "sandbox",
      source: "test",
      usedSandboxEnv: true,
    })),
  };
});

import { isAdminMember, parseAllowList, requireAdmin, requireVerifiedMember } from "./admin-auth.js";
import {
  getMemberstackAdminClient,
  getMemberstackAdminClientForMemberId,
} from "./memberstack-admin.js";
import { isAllowDevPatternUser } from "./custom-pattern-projects-store.js";

vi.mock("./custom-pattern-projects-store.js", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    isAllowDevPatternUser: vi.fn(() => false),
  };
});

const ADMIN_ID = "mem_admin_123";
const NON_ADMIN_ID = "mem_regular_456";

/** Sue's verified Memberstack JWT on kin-dev: subject in `sub`, type copied to `id`, no email. */
const SUE_TEST_MEMBER_ID = "mem_sb_cms4tl24v00eb0sqx143i4a9r";
const SUE_LIVE_MEMBER_ID = "mem_cms4tl24v00eb0sqx143i4a9r";
const SUE_EMAIL = "sue@knititnow.com";
const SUE_VERIFIED_JWT_CLAIMS = {
  id: "member",
  sub: SUE_TEST_MEMBER_ID,
  type: "member",
  iat: 1710000000,
  exp: 1910000000,
  aud: "app_cmfh3d1n802vb0wy706205810",
  iss: "https://api.memberstack.com",
};

const ENV_KEYS = [
  "ADMIN_MEMBER_IDS",
  "ADMIN_MEMBER_EMAILS",
  "MEMBERSTACK_SECRET_KEY",
  "MEMBERSTACK_SANDBOX_SECRET_KEY",
  "ALLOW_DEV_PATTERN_USER",
  "NODE_ENV",
  "CONTEXT",
  "SITE_NAME",
  "SITE_ID",
  "URL",
];

let savedEnv = {};

function makeRequest(token) {
  const headers = new Headers();
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  return new Request("https://example.com/.netlify/functions/admin-membership-report", {
    method: "GET",
    headers,
  });
}

function mockClients(options) {
  const client = {
    verifyMemberToken: vi.fn(async (token) => {
      if (token === "admin-token") return { id: ADMIN_ID };
      if (token === "member-token") return { id: NON_ADMIN_ID };
      if (token === "sue-token") return { ...SUE_VERIFIED_JWT_CLAIMS };
      return null;
    }),
    getMember: vi.fn(async (id) => {
      if (typeof options?.getMember === "function") return options.getMember(id);
      if (id === NON_ADMIN_ID) return { auth: { email: "member@example.com" } };
      if (id === SUE_TEST_MEMBER_ID) return { auth: { email: SUE_EMAIL } };
      if (id === ADMIN_ID) return { auth: { email: "admin@knititnow.com" } };
      return null;
    }),
  };
  vi.mocked(getMemberstackAdminClient).mockReturnValue(client);
  vi.mocked(getMemberstackAdminClientForMemberId).mockReturnValue(client);
  return client;
}

beforeEach(() => {
  savedEnv = {};
  for (const key of ENV_KEYS) {
    savedEnv[key] = process.env[key];
  }
  process.env.MEMBERSTACK_SECRET_KEY = "sk_test_secret";
  process.env.ADMIN_MEMBER_IDS = ADMIN_ID;
  delete process.env.ADMIN_MEMBER_EMAILS;
  delete process.env.CONTEXT;
  process.env.NODE_ENV = "test";
  vi.mocked(isAllowDevPatternUser).mockReturnValue(false);
  mockClients();
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (savedEnv[key] === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = savedEnv[key];
    }
  }
  vi.clearAllMocks();
});

describe("parseAllowList", () => {
  it("strips wrapping quotes copied from the Netlify UI", () => {
    expect(parseAllowList(`"${SUE_EMAIL}"`).has(SUE_EMAIL)).toBe(true);
    expect(parseAllowList(`'${SUE_TEST_MEMBER_ID}'`).has(SUE_TEST_MEMBER_ID)).toBe(true);
  });
});

describe("requireAdmin", () => {
  it("denies logged-out access with 401", async () => {
    const result = await requireAdmin(makeRequest());
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(401);
      expect(result.error).toMatch(/sign in required/i);
    }
  });

  it("allows an authorized admin member", async () => {
    const result = await requireAdmin(makeRequest("admin-token"));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.member.id).toBe(ADMIN_ID);
      expect(result.mode).toBe("verified");
    }
  });

  it("denies a logged-in non-admin member with 403", async () => {
    const result = await requireAdmin(makeRequest("member-token"));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(403);
      expect(result.error).toMatch(/admin access required/i);
    }
  });

  it("authorizes Sue from her verified JWT claim shape via email lookup", async () => {
    process.env.ADMIN_MEMBER_IDS = SUE_LIVE_MEMBER_ID;
    process.env.ADMIN_MEMBER_EMAILS = `"${SUE_EMAIL}"`;
    process.env.SITE_NAME = "kin-dev";
    const client = mockClients();

    const result = await requireAdmin(makeRequest("sue-token"));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.member.id).toBe(SUE_TEST_MEMBER_ID);
      expect(result.member.email).toBe(SUE_EMAIL);
    }
    expect(client.getMember).toHaveBeenCalledWith(SUE_TEST_MEMBER_ID);
    expect(client.getMember).not.toHaveBeenCalledWith("member");
  });

  it("does not treat the JWT type claim as the member id", async () => {
    process.env.ADMIN_MEMBER_IDS = "member";
    delete process.env.ADMIN_MEMBER_EMAILS;
    mockClients({ getMember: async () => null });

    const result = await requireAdmin(makeRequest("sue-token"));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(403);
      expect(result.diagnostics?.claimKeys).toEqual(
        expect.arrayContaining(["id", "sub", "type", "aud", "iss"]),
      );
      expect(result.diagnostics?.claimKeys).not.toContain("email");
      expect(result.diagnostics?.subjectExists).toBe(true);
      expect(result.diagnostics?.emailExists).toBe(false);
      expect(result.diagnostics?.allowlist).toEqual({ idMatched: false, emailMatched: false });
      expect(result.diagnostics?.env.ADMIN_MEMBER_IDS).toBe(true);
      expect(result.diagnostics?.env.ADMIN_MEMBER_EMAILS).toBe(false);
      expect(JSON.stringify(result)).not.toContain(SUE_TEST_MEMBER_ID);
      expect(JSON.stringify(result)).not.toContain(SUE_EMAIL);
    }
  });

  it("fails closed when the live id is allowlisted but the TEST JWT has no email lookup", async () => {
    process.env.ADMIN_MEMBER_IDS = SUE_LIVE_MEMBER_ID;
    process.env.ADMIN_MEMBER_EMAILS = SUE_EMAIL;
    mockClients({ getMember: async () => null });

    const result = await requireAdmin(makeRequest("sue-token"));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(403);
      expect(result.diagnostics?.allowlist.idMatched).toBe(false);
      expect(result.diagnostics?.allowlist.emailMatched).toBe(false);
      expect(result.diagnostics?.emailExists).toBe(false);
    }
  });
});

describe("isAdminMember", () => {
  it("matches quoted email allowlists", () => {
    expect(
      isAdminMember(
        { id: SUE_TEST_MEMBER_ID, email: SUE_EMAIL },
        { ADMIN_MEMBER_EMAILS: `"${SUE_EMAIL}"` },
      ),
    ).toBe(true);
  });
});

describe("requireVerifiedMember", () => {
  it("denies logged-out access with 401", async () => {
    const result = await requireVerifiedMember(makeRequest());
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(401);
      expect(result.error).toMatch(/sign in required/i);
    }
  });

  it("allows a signed-in member who is not on the reporting admin allowlist", async () => {
    const result = await requireVerifiedMember(makeRequest("member-token"));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.member.id).toBe(NON_ADMIN_ID);
      expect(result.mode).toBe("verified");
    }
  });
});
