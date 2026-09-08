import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../lib/member-auth.js", () => ({
  requireMember: vi.fn(),
}));

vi.mock("../lib/memberstack-admin.js", () => ({
  getMemberstackAdminClient: vi.fn(),
}));

vi.mock("../../../src/lib/memberAccessServer", () => ({
  evaluateMemberAccessForRecord: vi.fn(),
}));

import handler from "../member-access";
import { requireMember } from "../lib/member-auth.js";
import { getMemberstackAdminClient } from "../lib/memberstack-admin.js";
import { evaluateMemberAccessForRecord } from "../../../src/lib/memberAccessServer";

const VERIFIED_ID = "mem_from_jwt";

function makeRequest(init?: RequestInit) {
  return new Request("https://example.com/.netlify/functions/member-access", {
    method: "GET",
    ...init,
  });
}

function mockAdminClient() {
  return {
    getMember: vi.fn(async () => ({
      id: VERIFIED_ID,
      planConnections: [],
    })),
  };
}

beforeEach(() => {
  vi.mocked(requireMember).mockResolvedValue({
    ok: true,
    member: { id: VERIFIED_ID, email: "jwt@example.com" },
    mode: "verified",
  });
  vi.mocked(getMemberstackAdminClient).mockReturnValue(
    mockAdminClient() as ReturnType<typeof getMemberstackAdminClient>,
  );
  vi.mocked(evaluateMemberAccessForRecord).mockResolvedValue({
    hasMemberAccess: false,
    viewerAccessState: "loggedInNoAccess",
    legacyPaidThroughYmd: null,
  });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("member-access Netlify function", () => {
  it("returns 401 when no token", async () => {
    vi.mocked(requireMember).mockResolvedValue({
      ok: false,
      status: 401,
      error: "Sign in required.",
    });
    const res = await handler(makeRequest());
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(evaluateMemberAccessForRecord).not.toHaveBeenCalled();
  });

  it("uses the verified JWT member id, not query identity", async () => {
    vi.mocked(evaluateMemberAccessForRecord).mockResolvedValue({
      hasMemberAccess: true,
      viewerAccessState: "memberAccess",
      legacyPaidThroughYmd: "2026-12-01",
    });
    const res = await handler(
      new Request(
        "https://example.com/.netlify/functions/member-access?memberId=mem_spoof",
        { method: "GET", headers: { Authorization: "Bearer good-token" } },
      ),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({
      ok: true,
      hasMemberAccess: true,
      viewerAccessState: "memberAccess",
      legacyPaidThroughYmd: "2026-12-01",
    });
    const client = getMemberstackAdminClient();
    expect(client?.getMember).toHaveBeenCalledWith(VERIFIED_ID);
  });

  it("returns 503 when Admin client is unavailable", async () => {
    vi.mocked(getMemberstackAdminClient).mockReturnValue(null);
    const res = await handler(makeRequest({ headers: { Authorization: "Bearer good-token" } }));
    expect(res.status).toBe(503);
  });
});
