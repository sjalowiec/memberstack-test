import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MEMBERSHIPS, LEGACY_MEMBERSHIPS } from "../../../src/config/memberships.ts";

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

import { requirePatternProjectAccess, resolveVerifiedProjectUserId } from "./require-member-access.js";
import { getMemberstackAdminClient } from "./memberstack-admin.js";
import { isAllowDevPatternUser } from "./custom-pattern-projects-store.js";

const MEMBER_ID = "mem_pattern_owner";
const OTHER_ID = "mem_other_owner";
const ACTIVE_PLAN = MEMBERSHIPS.membership.memberstackPlanId;
const BETA_PLAN = MEMBERSHIPS.beta.memberstackPlanId;
const LEGACY_PLAN = LEGACY_MEMBERSHIPS.grandfatheredAnnual.memberstackPlanId;

function makeRequest(token, extraHeaders = {}) {
  const headers = new Headers(extraHeaders);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  return new Request("https://example.com/.netlify/functions/custom-pattern-project-list", {
    method: "GET",
    headers,
  });
}

function memberRecord(planId, { status = "ACTIVE", active = true } = {}) {
  return {
    id: MEMBER_ID,
    planConnections: [{ planId, status, active }],
  };
}

beforeEach(() => {
  vi.mocked(isAllowDevPatternUser).mockReturnValue(false);
  vi.mocked(getMemberstackAdminClient).mockReturnValue({
    verifyMemberToken: vi.fn(async (token) => (token === "good-token" ? { id: MEMBER_ID } : null)),
    getMember: vi.fn(async () => memberRecord(ACTIVE_PLAN)),
  });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("requirePatternProjectAccess", () => {
  it("rejects anonymous requests with 401", async () => {
    const result = await requirePatternProjectAccess(makeRequest());
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(401);
    }
  });

  it("rejects invalid bearer tokens with 401", async () => {
    const result = await requirePatternProjectAccess(makeRequest("bad-token"));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(401);
  });

  it("ignores spoofed X-KBM-Member-Id and uses the verified token id", async () => {
    const result = await requirePatternProjectAccess(
      makeRequest("good-token", { "X-KBM-Member-Id": OTHER_ID }),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.userId).toBe(MEMBER_ID);
      expect(result.userId).not.toBe(OTHER_ID);
    }
  });

  it("rejects logged-in non-members with 403 (no qualifying plan)", async () => {
    vi.mocked(getMemberstackAdminClient).mockReturnValue({
      verifyMemberToken: vi.fn(async () => ({ id: MEMBER_ID })),
      getMember: vi.fn(async () => ({ id: MEMBER_ID, planConnections: [] })),
    });
    const result = await requirePatternProjectAccess(makeRequest("good-token"));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(403);
      expect(result.error).toMatch(/membership/i);
    }
  });

  it("rejects inactive / canceled membership plans with 403", async () => {
    vi.mocked(getMemberstackAdminClient).mockReturnValue({
      verifyMemberToken: vi.fn(async () => ({ id: MEMBER_ID })),
      getMember: vi.fn(async () => memberRecord(ACTIVE_PLAN, { status: "CANCELED", active: false })),
    });
    const result = await requirePatternProjectAccess(makeRequest("good-token"));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(403);
  });

  it("rejects unrecognized plan ids with 403", async () => {
    vi.mocked(getMemberstackAdminClient).mockReturnValue({
      verifyMemberToken: vi.fn(async () => ({ id: MEMBER_ID })),
      getMember: vi.fn(async () => memberRecord("pln_lifetime-sleeveless-pattern-builder-i2ac0rya")),
    });
    const result = await requirePatternProjectAccess(makeRequest("good-token"));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(403);
  });

  it("allows an active paid member in MEMBER_PLAN_IDS", async () => {
    const result = await requirePatternProjectAccess(makeRequest("good-token"));
    expect(result).toEqual({ ok: true, userId: MEMBER_ID, mode: "member" });
  });

  it("allows Beta membership shells in MEMBER_PLAN_IDS", async () => {
    vi.mocked(getMemberstackAdminClient).mockReturnValue({
      verifyMemberToken: vi.fn(async () => ({ id: MEMBER_ID })),
      getMember: vi.fn(async () => memberRecord(BETA_PLAN)),
    });
    const result = await requirePatternProjectAccess(makeRequest("good-token"));
    expect(result.ok).toBe(true);
  });

  it("allows approved legacy membership shells in MEMBER_PLAN_IDS", async () => {
    vi.mocked(getMemberstackAdminClient).mockReturnValue({
      verifyMemberToken: vi.fn(async () => ({ id: MEMBER_ID })),
      getMember: vi.fn(async () => memberRecord(LEGACY_PLAN)),
    });
    const result = await requirePatternProjectAccess(makeRequest("good-token"));
    expect(result.ok).toBe(true);
  });

  it("fails closed with 503 when Memberstack client is unavailable", async () => {
    vi.mocked(getMemberstackAdminClient).mockReturnValue(null);
    const result = await requirePatternProjectAccess(makeRequest("good-token"));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(503);
      expect(result.error).toMatch(/unavailable/i);
    }
  });

  it("fails closed with 503 when getMember throws", async () => {
    vi.mocked(getMemberstackAdminClient).mockReturnValue({
      verifyMemberToken: vi.fn(async () => ({ id: MEMBER_ID })),
      getMember: vi.fn(async () => {
        throw new Error("upstream");
      }),
    });
    const result = await requirePatternProjectAccess(makeRequest("good-token"));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(503);
  });

  it("does not grant access from spoofed hasSystemAccess headers or body markers", async () => {
    vi.mocked(getMemberstackAdminClient).mockReturnValue({
      verifyMemberToken: vi.fn(async () => ({ id: MEMBER_ID })),
      getMember: vi.fn(async () => ({ id: MEMBER_ID, planConnections: [] })),
    });
    const result = await requirePatternProjectAccess(
      makeRequest("good-token", {
        "X-KBM-Has-System-Access": "true",
        "X-KBM-Member-Id": MEMBER_ID,
      }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(403);
  });
});

describe("resolveVerifiedProjectUserId (identity only)", () => {
  it("derives userId from the verified token, not X-KBM-Member-Id", async () => {
    const result = await resolveVerifiedProjectUserId(
      makeRequest("good-token", { "X-KBM-Member-Id": OTHER_ID }),
    );
    expect(result).toEqual({ userId: MEMBER_ID, mode: "member" });
  });

  it("rejects anonymous requests", async () => {
    const result = await resolveVerifiedProjectUserId(makeRequest());
    expect("error" in result).toBe(true);
    if ("error" in result) expect(result.status).toBe(401);
  });
});

describe("project ownership keying", () => {
  it("scopes blob keys so one member cannot address another member's project id", async () => {
    const { projectBlobKey } = await import("./custom-pattern-projects-store.js");
    const access = await requirePatternProjectAccess(makeRequest("good-token"));
    expect(access.ok).toBe(true);
    if (!access.ok) return;
    const ownKey = projectBlobKey("sleeveless", access.userId, "proj-shared-id");
    const otherKey = projectBlobKey("sleeveless", OTHER_ID, "proj-shared-id");
    expect(ownKey).not.toBe(otherKey);
    expect(ownKey).toContain(MEMBER_ID);
    expect(ownKey).not.toContain(OTHER_ID);
  });
});
