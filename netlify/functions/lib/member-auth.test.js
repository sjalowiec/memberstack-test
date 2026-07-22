import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./memberstack-admin.js", () => ({
  getMemberstackAdminClient: vi.fn(),
  getMemberstackSecretKey: vi.fn(() => "sk_test_secret"),
  logMemberstackEnvironmentMismatch: vi.fn(() => false),
}));

vi.mock("./custom-pattern-projects-store.js", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    isAllowDevPatternUser: vi.fn(() => false),
  };
});

import { requireMember, DEV_MEMBER } from "./member-auth.js";
import {
  getMemberstackAdminClient,
  getMemberstackSecretKey,
  logMemberstackEnvironmentMismatch,
} from "./memberstack-admin.js";
import { isAllowDevPatternUser } from "./custom-pattern-projects-store.js";

const MEMBER_ID = "mem_favorites_123";

const ENV_KEYS = ["MEMBERSTACK_SECRET_KEY", "ALLOW_DEV_PATTERN_USER", "NODE_ENV", "CONTEXT"];

let savedEnv = {};

function makeRequest(token, extraHeaders = {}) {
  const headers = new Headers(extraHeaders);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  return new Request("https://example.com/.netlify/functions/favorites", {
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
  vi.mocked(isAllowDevPatternUser).mockReturnValue(false);
  vi.mocked(getMemberstackSecretKey).mockReturnValue("sk_test_secret");
  vi.mocked(logMemberstackEnvironmentMismatch).mockReturnValue(false);
  vi.mocked(getMemberstackAdminClient).mockReturnValue({
    verifyMemberToken: vi.fn(async (token) => (token === "good-token" ? { id: MEMBER_ID } : null)),
    getMember: vi.fn(async () => ({ auth: { email: "member@example.com" } })),
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

describe("requireMember", () => {
  it("rejects missing authentication with 401", async () => {
    const result = await requireMember(makeRequest());
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(401);
      expect(result.error).toMatch(/sign in required/i);
    }
  });

  it("rejects invalid tokens with 401", async () => {
    const result = await requireMember(makeRequest("bad-token"));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(401);
  });

  it("uses the verified member id from the token, not a browser-provided header", async () => {
    const result = await requireMember(
      makeRequest("good-token", { "X-KBM-Member-Id": "mem_spoofed_other_user" }),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.member.id).toBe(MEMBER_ID);
      expect(result.member.id).not.toBe("mem_spoofed_other_user");
      expect(result.mode).toBe("verified");
    }
  });

  it("allows a stable dev member when ALLOW_DEV_PATTERN_USER is on and no token is sent", async () => {
    vi.mocked(isAllowDevPatternUser).mockReturnValue(true);
    const result = await requireMember(makeRequest());
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.member.id).toBe(DEV_MEMBER.id);
      expect(result.mode).toBe("dev");
    }
  });

  it("does not silently use the development-user bypass when a Bearer token is present", async () => {
    vi.mocked(isAllowDevPatternUser).mockReturnValue(true);
    vi.mocked(getMemberstackAdminClient).mockReturnValue({
      verifyMemberToken: vi.fn(async () => null),
      getMember: vi.fn(),
    });
    const result = await requireMember(makeRequest("bad-token"));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(401);
      expect(result.error).toMatch(/invalid or expired/i);
    }
    expect(result.ok === true && result.member?.id === DEV_MEMBER.id).toBe(false);
  });

  it("returns controlled 503 when Memberstack auth cannot run because the secret is unavailable", async () => {
    vi.mocked(isAllowDevPatternUser).mockReturnValue(true);
    vi.mocked(getMemberstackAdminClient).mockReturnValue(null);
    const result = await requireMember(makeRequest("any-token"));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(503);
      expect(result.error).toBe("Favorites are unavailable in this environment.");
    }
  });
});
