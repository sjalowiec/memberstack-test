import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../lib/member-auth.js", () => ({
  requireMember: vi.fn(),
}));

vi.mock("../../../src/lib/membership/accountMembershipDetail", () => ({
  loadAccountMembershipDetail: vi.fn(),
}));

import handler from "../account-membership-detail";
import { requireMember } from "../lib/member-auth.js";
import { loadAccountMembershipDetail } from "../../../src/lib/membership/accountMembershipDetail";

const VERIFIED_ID = "mem_from_jwt";

function makeRequest(
  url = "https://example.com/.netlify/functions/account-membership-detail",
  init?: RequestInit,
) {
  return new Request(url, init);
}

beforeEach(() => {
  vi.mocked(requireMember).mockResolvedValue({
    ok: true,
    member: { id: VERIFIED_ID, email: "jwt@example.com" },
    mode: "verified",
  });
  vi.mocked(loadAccountMembershipDetail).mockResolvedValue({
    identified: true,
    membershipName: "Knit it Now Membership",
    statusLabel: "Active",
    billingLabel: "Monthly",
    nextRenewalDate: "August 28, 2026",
    activeThroughDate: null,
    legacyPaidThroughDate: null,
    memberSince: "March 14, 2017",
    history: [
      {
        type: "joined",
        title: "Joined Knit it Now",
        date: "March 14, 2017",
        dateSort: "2017-03-14",
      },
    ],
  });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("account-membership-detail Netlify function", () => {
  it("returns 401 when no token", async () => {
    vi.mocked(requireMember).mockResolvedValue({
      ok: false,
      status: 401,
      error: "Sign in required.",
    });
    const res = await handler(makeRequest());
    expect(res.status).toBe(401);
    expect(loadAccountMembershipDetail).not.toHaveBeenCalled();
  });

  it("uses verified JWT member id and ignores spoofed identity fields", async () => {
    const res = await handler(
      makeRequest(
        "https://example.com/.netlify/functions/account-membership-detail?memberId=mem_spoof&email=spoof@example.com",
        { headers: { Authorization: "Bearer good-token" } },
      ),
    );
    expect(res.status).toBe(200);
    expect(loadAccountMembershipDetail).toHaveBeenCalledTimes(1);
    expect(loadAccountMembershipDetail).toHaveBeenCalledWith(VERIFIED_ID);
    expect(loadAccountMembershipDetail).not.toHaveBeenCalledWith("mem_spoof");

    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.memberSince).toBe("March 14, 2017");
    expect(body.history).toHaveLength(1);
    expect(body).not.toHaveProperty("memberId");
    expect(body).not.toHaveProperty("email");
    expect(body).not.toHaveProperty("planConnections");
  });

  it("rejects non-GET methods", async () => {
    const res = await handler(
      makeRequest("https://example.com/.netlify/functions/account-membership-detail", {
        method: "POST",
        headers: { Authorization: "Bearer good-token" },
      }),
    );
    expect(res.status).toBe(405);
    expect(loadAccountMembershipDetail).not.toHaveBeenCalled();
  });

  it("returns a calm unidentified detail when the loader throws", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(loadAccountMembershipDetail).mockRejectedValue(new Error("boom"));
    const res = await handler(makeRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.identified).toBe(false);
    expect(body.history).toEqual([]);
    spy.mockRestore();
  });
});
