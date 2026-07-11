import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./memberstack-admin.js", () => ({
  getMemberstackAdminClient: vi.fn(),
}));

import { requireAdmin } from "./admin-auth.js";
import { getMemberstackAdminClient } from "./memberstack-admin.js";
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

const ENV_KEYS = [
  "ADMIN_MEMBER_IDS",
  "ADMIN_MEMBER_EMAILS",
  "MEMBERSTACK_SECRET_KEY",
  "ALLOW_DEV_PATTERN_USER",
  "NODE_ENV",
  "CONTEXT",
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

beforeEach(() => {
  savedEnv = {};
  for (const key of ENV_KEYS) {
    savedEnv[key] = process.env[key];
  }
  process.env.MEMBERSTACK_SECRET_KEY = "sk_test_secret";
  process.env.ADMIN_MEMBER_IDS = ADMIN_ID;
  delete process.env.ADMIN_MEMBER_EMAILS;
  vi.mocked(isAllowDevPatternUser).mockReturnValue(false);
  vi.mocked(getMemberstackAdminClient).mockReturnValue({
    verifyMemberToken: vi.fn(async (token) =>
      token === "admin-token"
        ? { id: ADMIN_ID }
        : token === "member-token"
          ? { id: NON_ADMIN_ID }
          : null,
    ),
    getMember: vi.fn(async (id) =>
      id === NON_ADMIN_ID
        ? { auth: { email: "member@example.com" } }
        : { auth: { email: "admin@knititnow.com" } },
    ),
  });
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
});
