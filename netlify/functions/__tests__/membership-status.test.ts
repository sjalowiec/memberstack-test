import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../lib/member-auth.js", () => ({
  requireMember: vi.fn(),
}));

vi.mock("../../../src/lib/membership/membershipStatusService", () => ({
  loadMembershipStatusForMemberId: vi.fn(),
}));

import handler from "../membership-status";
import { requireMember } from "../lib/member-auth.js";
import { loadMembershipStatusForMemberId } from "../../../src/lib/membership/membershipStatusService";

const VERIFIED_ID = "mem_from_jwt";

function makeRequest(url = "https://example.com/.netlify/functions/membership-status", init?: RequestInit) {
  return new Request(url, init);
}

beforeEach(() => {
  vi.mocked(requireMember).mockResolvedValue({
    ok: true,
    member: { id: VERIFIED_ID, email: "jwt@example.com" },
    mode: "verified",
  });
  vi.mocked(loadMembershipStatusForMemberId).mockResolvedValue({
    identified: true,
    currentStatus: "no_plan",
    currentPlanName: null,
    previousPlanName: null,
    activeThroughDate: null,
    legacyExpirationDate: null,
    legacyLinkState: "not_found",
    accountType: "non_paid_account",
    recommendedAction: "purchase",
    customerFacingMessage:
      "You have a Knit it Now account, but it does not currently include an active Knit it Now membership.",
  });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("membership-status Netlify function", () => {
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
    expect(loadMembershipStatusForMemberId).not.toHaveBeenCalled();
  });

  it("returns 401 for invalid token", async () => {
    vi.mocked(requireMember).mockResolvedValue({
      ok: false,
      status: 401,
      error: "Invalid or expired session.",
    });
    const res = await handler(
      makeRequest("https://example.com/.netlify/functions/membership-status", {
        headers: { Authorization: "Bearer bad-token" },
      }),
    );
    expect(res.status).toBe(401);
  });

  it("uses verified JWT member id and ignores query/body identity fields", async () => {
    const res = await handler(
      makeRequest(
        "https://example.com/.netlify/functions/membership-status?memberId=mem_spoof&email=spoof@example.com",
        {
          headers: { Authorization: "Bearer good-token" },
        },
      ),
    );
    expect(res.status).toBe(200);
    expect(loadMembershipStatusForMemberId).toHaveBeenCalledTimes(1);
    expect(loadMembershipStatusForMemberId).toHaveBeenCalledWith(VERIFIED_ID);
    expect(loadMembershipStatusForMemberId).not.toHaveBeenCalledWith("mem_spoof");

    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.identified).toBe(true);
    expect(body.recommendedAction).toBe("purchase");
    expect(body).not.toHaveProperty("notes");
    expect(body).not.toHaveProperty("orders");
    expect(body).not.toHaveProperty("addresses");
    expect(body).not.toHaveProperty("planConnections");
    expect(body).not.toHaveProperty("memberId");
    expect(body).not.toHaveProperty("email");
  });

  it("rejects non-GET methods", async () => {
    const res = await handler(
      makeRequest("https://example.com/.netlify/functions/membership-status", {
        method: "POST",
        headers: { Authorization: "Bearer good-token", "Content-Type": "application/json" },
        body: JSON.stringify({ memberId: "mem_spoof", email: "spoof@example.com" }),
      }),
    );
    expect(res.status).toBe(405);
    expect(loadMembershipStatusForMemberId).not.toHaveBeenCalled();
  });

  it("returns wait summary when loader throws (does not encourage purchase)", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(loadMembershipStatusForMemberId).mockRejectedValue(new Error("boom"));
    const res = await handler(makeRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.recommendedAction).toBe("wait");
    expect(body.currentStatus).toBe("unknown");
    spy.mockRestore();
  });
});
